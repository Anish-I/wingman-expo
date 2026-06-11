import crypto from 'node:crypto';

import cors from '@fastify/cors';
import Fastify from 'fastify';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

import { PgStore } from './store.js';
import { createSupabaseAuth, type AuthedIdentity } from './auth/supabase.js';
import { buildUiCritique } from './ui-critique.js';
import { pickProvider } from './llm/provider.js';
import { createComposioRuntime } from './tools/composio.js';
import { buildRegistry } from './tools/registry.js';
import { openSSE } from './chat/sse.js';
import { runChatTurn } from './chat/orchestrator.js';
import { startScheduler, runDueFlows } from './flows/scheduler.js';
import { runFlowDefinition, validateSteps } from './flows/runner.js';
import { builtinTools } from './tools/builtin.js';
import type { ChatEvent } from './llm/types.js';

loadEnv();

const env = z.object({
  PORT: z.coerce.number().default(3002),
  FRONTEND_URL: z.string().default('http://localhost:8082'),
  // Where THIS server is reachable from the browser (for OAuth callbacks).
  // Defaults to localhost:PORT; set to the deployed URL in production.
  PUBLIC_API_URL: z.string().optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL (Supabase Postgres connection string) is required.'),
  DEFAULT_LLM_PROVIDER: z.string().default('demo'),
  LLM_PROVIDER: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  LLM_BASE_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  COMPOSIO_API_KEY: z.string().optional(),
  COMPOSIO_AUTH_CONFIGS: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
}).parse(process.env);

// Public base URL of this API (used to build OAuth callback URLs the browser hits).
const apiBaseUrl = env.PUBLIC_API_URL ?? `http://localhost:${env.PORT}`;

const app = Fastify({ logger: true });
// When Supabase Auth owns identity, skip the legacy demo-account seed (it would
// collide on email with the Supabase demo user). createSupabaseAuth is created
// below, but enablement is a pure env check, so compute it here.
const supabaseAuthEnabled = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY);
const store = await PgStore.open(env.DATABASE_URL, { seedDemoAccount: !supabaseAuthEnabled });
const llmProvider = pickProvider({
  LLM_PROVIDER: env.LLM_PROVIDER,
  LLM_MODEL: env.LLM_MODEL,
  LLM_BASE_URL: env.LLM_BASE_URL,
  OPENAI_API_KEY: env.OPENAI_API_KEY,
  DEEPSEEK_API_KEY: env.DEEPSEEK_API_KEY,
});
const supabaseAuth = createSupabaseAuth({
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
});
const DEMO_EMAIL = 'sam@wingman.dev';
const composioRuntime = createComposioRuntime({
  COMPOSIO_API_KEY: env.COMPOSIO_API_KEY,
  COMPOSIO_AUTH_CONFIGS: env.COMPOSIO_AUTH_CONFIGS,
});

const authPayloadSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const createPayloadSchema = authPayloadSchema.extend({
  name: z.string().min(2),
});

const chatPayloadSchema = z.object({
  message: z.string().min(1),
});

const critiquePayloadSchema = z.object({
  screenId: z.string(),
  theme: z.string().default('light'),
  viewport: z.object({
    width: z.number(),
    height: z.number(),
  }).nullable().optional(),
});

const appSlugSchema = z.enum(['gmail', 'googlecalendar', 'slack', 'notion', 'linear', 'github', 'spotify', 'dropbox']);

const flowScheduleSchema = z.object({
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  days: z.array(z.number().int().min(0).max(6)).default([]),
});

const flowStepSchema = z.object({
  id: z.string().min(1),
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()).default({}),
});

const createFlowSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  emoji: z.string().optional(),
  color: z.string().optional(),
  appSlug: z.string().optional(),
  schedule: flowScheduleSchema.nullable().optional(),
  steps: z.array(flowStepSchema).optional(),
}).optional();

// Partial update — every field optional (title is not required to PATCH a flow).
const updateFlowSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  emoji: z.string().optional(),
  color: z.string().optional(),
  appSlug: z.string().optional(),
  schedule: flowScheduleSchema.nullable().optional(),
  steps: z.array(flowStepSchema).optional(),
});

function authHeaderToken(header?: string) {
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length);
}

// Map a verified Supabase identity onto our users row. First sight upserts and,
// for the demo account, seeds sample content so the demo has flows/events.
async function userFromIdentity(identity: AuthedIdentity) {
  const existing = await store.getUserById(identity.id);
  if (existing) return existing;
  const { user, created } = await store.upsertUser(identity);
  if (created && identity.email.toLowerCase() === DEMO_EMAIL) {
    await store.seedDemoContent(user.id);
  }
  return user;
}

// Short-lived cache so we don't call Supabase to verify the JWT on every request.
const tokenCache = new Map<string, { identity: AuthedIdentity; at: number }>();
const TOKEN_CACHE_MS = 60_000;

async function getAuthedUser(request: { headers: Record<string, unknown> }) {
  const token = authHeaderToken(String(request.headers.authorization ?? ''));
  if (!token) {
    return null;
  }
  if (supabaseAuth.enabled) {
    const cached = tokenCache.get(token);
    let identity: AuthedIdentity | null;
    if (cached && Date.now() - cached.at < TOKEN_CACHE_MS) {
      identity = cached.identity;
    } else {
      identity = await supabaseAuth.verifyToken(token);
      if (identity) tokenCache.set(token, { identity, at: Date.now() });
    }
    if (!identity) return null;
    return userFromIdentity(identity);
  }
  return store.getUserBySession(token);
}

function serializeAuth(account: { id: string; name: string; email: string; phone: string; tier: 'Pro' }, token: string) {
  return {
    session: {
      token,
      user: {
        id: account.id,
        name: account.name,
        email: account.email,
        phone: account.phone,
        tier: account.tier,
      },
    },
    demoCredentials: {
      email: account.email,
      password: account.email === 'sam@wingman.dev' ? 'pigeon123' : undefined,
    },
  };
}

// origin:true reflects the caller's origin. The default method set is only
// GET,HEAD,POST — so list every verb we use, or PUT/PATCH/DELETE get blocked by
// the browser preflight (Save = PUT, flow toggle = PATCH, delete account = DELETE).
/**
 * Apps with their TRUE connection status. Composio is the source of truth for
 * OAuth connections, so when it's enabled we reconcile our DB flag against the
 * user's ACTIVE connected accounts (and persist the correction, so the rest of
 * the app — registry, tools, briefing — agrees). When Composio is off we fall
 * back to the stored flag.
 */
async function appsForUser(userId: string) {
  const apps = await store.getApps(userId);
  if (!composioRuntime.enabled) return apps;
  const live = await composioRuntime.connectedToolkits(userId);
  for (const app of apps) {
    const nowConnected = live.has(app.slug.toLowerCase());
    if (app.connected !== nowConnected) {
      if (nowConnected) await store.connectApp(userId, app.slug);
      else await store.disconnectApp(userId, app.slug);
      app.connected = nowConnected;
      if (!nowConnected) app.connectedAt = undefined;
    }
  }
  return apps;
}

await app.register(cors, {
  origin: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

app.get('/health', async () => ({
  ok: true,
  provider: llmProvider.id,
  composio: composioRuntime.enabled,
  auth: supabaseAuth.enabled ? 'supabase' : 'legacy',
}));

app.post('/auth/demo/create', async (request, reply) => {
  const payload = createPayloadSchema.parse(request.body);
  if (supabaseAuth.enabled) {
    const created = await supabaseAuth.signUp(payload.name, payload.email, payload.password);
    if (!created.ok) {
      return reply.status(400).send({ error: created.error });
    }
    const signedIn = await supabaseAuth.signIn(payload.email, payload.password);
    if (!signedIn.ok) {
      return reply.status(400).send({ error: signedIn.error });
    }
    const user = await userFromIdentity(signedIn.identity);
    return reply.status(201).send(serializeAuth(user, signedIn.token));
  }
  const result = await store.createAccount(payload);
  if (!result.ok) {
    return reply.status(400).send({ error: result.error });
  }
  const token = await store.createSession(result.account.id);
  return reply.status(201).send(serializeAuth(result.account, token));
});

app.post('/auth/demo/login', async (request, reply) => {
  const payload = authPayloadSchema.parse(request.body);
  if (supabaseAuth.enabled) {
    const signedIn = await supabaseAuth.signIn(payload.email, payload.password);
    if (!signedIn.ok) {
      return reply.status(401).send({ error: signedIn.error });
    }
    const user = await userFromIdentity(signedIn.identity);
    return reply.send(serializeAuth(user, signedIn.token));
  }
  const result = await store.signIn(payload.email, payload.password);
  if (!result.ok) {
    return reply.status(401).send({ error: result.error });
  }
  return reply.send(serializeAuth(result.account, result.token));
});

app.get('/me', async (request, reply) => {
  const user = await getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  return reply.send({ user });
});

app.get('/apps', async (request, reply) => {
  const user = await getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  return reply.send({
    totalAvailable: 1003,
    items: await appsForUser(user.id),
  });
});

app.get('/apps/status', async (request, reply) => {
  const user = await getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  const apps = await appsForUser(user.id);
  const connected = apps.filter((item) => item.connected).map((item) => item.slug);
  const missing = apps.filter((item) => !item.connected).map((item) => item.slug);
  return reply.send({ connected, missing });
});

app.post('/connect/create-connect-token', async (request, reply) => {
  const user = await getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  const payload = z.object({ app: appSlugSchema }).parse(request.body);
  // Our connect token round-trips the (userId, appSlug) through the OAuth dance:
  // we hand it to Composio as the callback URL, and consume it when the user
  // returns to mark the app connected.
  const connectToken = await store.createConnectToken(user.id, payload.app);
  const callbackUrl = `${apiBaseUrl}/connect/callback?connectToken=${encodeURIComponent(connectToken)}`;

  // Real OAuth via Composio when a managed auth config exists for this toolkit.
  if (composioRuntime.enabled) {
    const { url } = await composioRuntime.initiateConnection(user.id, payload.app, callbackUrl);
    if (url) {
      return reply.send({ connectToken, initiateUrl: url });
    }
    // Composio is on but this toolkit has no auth config yet.
    return reply.status(400).send({ error: `${payload.app} isn't available to connect yet.` });
  }

  // Mock fallback (Composio not configured) — keeps the offline/demo flow working.
  return reply.send({
    connectToken,
    initiateUrl: `${apiBaseUrl}/connect/initiate?connectToken=${encodeURIComponent(connectToken)}`,
  });
});

// Mock-only hop: simulate the provider redirect when Composio isn't configured.
app.get('/connect/initiate', async (request, reply) => {
  const token = z.object({ connectToken: z.string() }).parse(request.query).connectToken;
  return reply.redirect(`${apiBaseUrl}/connect/callback?connectToken=${encodeURIComponent(token)}`);
});

app.get('/connect/callback', async (request, reply) => {
  const token = z.object({ connectToken: z.string() }).parse(request.query).connectToken;
  const record = await store.consumeConnectToken(token);
  if (!record) {
    return reply.status(400).send({ error: 'Invalid connect token.' });
  }
  await store.connectApp(record.userId, record.appSlug);
  return reply.redirect(`${env.FRONTEND_URL}/apps?connected=${encodeURIComponent(record.appSlug)}`);
});

app.delete('/connect/:app', async (request, reply) => {
  const user = await getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  return reply.send({ ok: true });
});

app.post('/chat/stream', async (request, reply) => {
  const user = await getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  const payload = chatPayloadSchema.parse(request.body);
  const writer = openSSE(reply);
  const ctx = { userId: user.id, store };
  const registry = await buildRegistry({ ctx, composio: composioRuntime, message: payload.message });
  await runChatTurn({
    provider: llmProvider,
    registry,
    ctx,
    userMessage: payload.message,
    writer,
  }).catch((err) => {
    writer.send({ type: 'error', message: (err as Error).message });
    writer.close();
  });
});

app.post('/chat', async (request, reply) => {
  const user = await getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  const payload = chatPayloadSchema.parse(request.body);
  const ctx = { userId: user.id, store };
  const registry = await buildRegistry({ ctx, composio: composioRuntime, message: payload.message });
  let assembled = '';
  let connectionRequired: { appSlug: string; oauthUrl?: string | null } | null = null;
  let createdEvent: { eventId: string; title: string; startIso: string } | null = null;
  let activityCreated = false;

  const bufferingWriter = {
    send(event: ChatEvent) {
      if (event.type === 'token') assembled += event.text;
      if (event.type === 'final' && event.content) assembled = event.content;
      const meta = (event as unknown as { meta?: { kind: string; appSlug?: string; oauthUrl?: string | null; eventId?: string; title?: string; startIso?: string } }).meta;
      if (meta?.kind === 'connection_required' && meta.appSlug) {
        connectionRequired = { appSlug: meta.appSlug, oauthUrl: meta.oauthUrl ?? null };
      }
      if (meta?.kind === 'calendar_event_created' && meta.eventId && meta.title && meta.startIso) {
        createdEvent = { eventId: meta.eventId, title: meta.title, startIso: meta.startIso };
        activityCreated = true;
      }
    },
    close() {},
  };
  await runChatTurn({
    provider: llmProvider,
    registry,
    ctx,
    userMessage: payload.message,
    writer: bufferingWriter,
  });
  const conn = connectionRequired as { appSlug: string; oauthUrl?: string | null } | null;
  const evt = createdEvent as { eventId: string; title: string; startIso: string } | null;
  const action = conn
    ? { type: 'connection_required', appSlug: conn.appSlug, toolName: null, oauthUrl: conn.oauthUrl ?? null }
    : evt
    ? { type: 'calendar_create', appSlug: 'googlecalendar', toolName: 'calendar_create_event', createdEvent: evt }
    : { type: 'general_reply', appSlug: null, toolName: null };
  return reply.send({ assistantMessage: assembled, action, activityCreated });
});

app.post('/chat/clear', async (request, reply) => {
  const user = await getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  await store.clearHistory(user.id);
  return reply.send({ ok: true });
});

app.delete('/me', async (request, reply) => {
  const user = await getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  await store.deleteAccount(user.id);
  await store.clearHistory(user.id);
  if (supabaseAuth.enabled) {
    await supabaseAuth.deleteUser(user.id);
  }
  return reply.status(204).send();
});

app.get('/briefing/today', async (request, reply) => {
  const user = await getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  return reply.send(await store.getBriefing(user.id));
});

app.get('/activity', async (request, reply) => {
  const user = await getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  return reply.send({ items: await store.getActivities(user.id) });
});

app.get('/flows', async (request, reply) => {
  const user = await getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  return reply.send({ items: await store.getFlows(user.id) });
});

// One flow with its executable definition — lets the builder hydrate the real
// schedule + steps when opened for editing.
app.get('/flows/:id', async (request, reply) => {
  const user = await getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  const params = z.object({ id: z.string() }).parse(request.params);
  const flow = await store.getFlowById(params.id, user.id);
  if (!flow) {
    return reply.status(404).send({ error: 'Flow not found.' });
  }
  return reply.send({ flow });
});

app.post('/flows', async (request, reply) => {
  const user = await getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  const input = createFlowSchema.parse(request.body);
  // Validate steps against the known tool set before persisting.
  if (input?.steps?.length) {
    const known = new Set(Object.keys(builtinTools));
    const error = validateSteps(input.steps, known);
    if (error) {
      return reply.status(400).send({ error });
    }
  }
  const flow = await store.createFlow(user.id, input);
  return reply.status(201).send({ flow });
});

// Update a flow's display fields + executable definition (the builder's Save).
app.put('/flows/:id', async (request, reply) => {
  const user = await getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  const params = z.object({ id: z.string() }).parse(request.params);
  const input = updateFlowSchema.parse(request.body);
  if (input.steps?.length) {
    const known = new Set(Object.keys(builtinTools));
    const error = validateSteps(input.steps, known);
    if (error) {
      return reply.status(400).send({ error });
    }
  }
  const flow = await store.updateFlow(params.id, user.id, input);
  if (!flow) {
    return reply.status(404).send({ error: 'Flow not found.' });
  }
  return reply.send({ flow });
});

// Manually run a flow now (used by "Test" / dry-run and immediate execution).
app.post('/flows/:id/run', async (request, reply) => {
  const user = await getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  const params = z.object({ id: z.string() }).parse(request.params);
  const flow = await store.getFlowById(params.id, user.id);
  if (!flow || !flow.definition || flow.definition.steps.length === 0) {
    return reply.status(404).send({ error: 'Flow not found or has no runnable steps.' });
  }
  const ctx = { userId: user.id, store };
  const registry = await buildRegistry({ ctx, composio: composioRuntime });
  const result = await runFlowDefinition(flow.definition, registry, ctx);
  await store.recordFlowRun(flow.id, new Date().toISOString());
  await store.addActivity(user.id, {
    title: result.ok ? 'Flow ran' : 'Flow failed',
    subtitle: result.ok ? flow.title : `${flow.title}: ${result.error ?? 'unknown error'}`,
    pip: result.ok ? 'clap' : 'sad',
    color: result.ok ? flow.color : '#EF4444',
  });
  return reply.send({ result });
});

app.patch('/flows/:id', async (request, reply) => {
  const user = await getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  const params = z.object({ id: z.string() }).parse(request.params);
  const payload = z.object({ active: z.boolean() }).parse(request.body);
  const flow = await store.setFlowActive(params.id, payload.active);
  if (!flow) {
    return reply.status(404).send({ error: 'Flow not found.' });
  }
  await store.addActivity(user.id, {
    title: payload.active ? 'Enabled flow' : 'Paused flow',
    subtitle: flow.title,
    pip: payload.active ? 'clap' : 'sad',
    color: payload.active ? '#3B82F6' : '#8892BC',
  });
  return reply.send({ flow });
});

app.post('/dev/ui-critique', async (request, reply) => {
  const user = await getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  const payload = critiquePayloadSchema.parse(request.body);
  return reply.send(buildUiCritique({
    screenId: payload.screenId,
    theme: payload.theme,
    viewport: payload.viewport ?? null,
  }));
});

// Start the flow scheduler (once-a-minute tick; runs due flows).
const scheduler = startScheduler(store, composioRuntime);
app.addHook('onClose', async () => {
  scheduler.stop();
});

await app.listen({ host: '0.0.0.0', port: env.PORT });
