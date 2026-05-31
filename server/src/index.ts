import crypto from 'node:crypto';

import cors from '@fastify/cors';
import Fastify from 'fastify';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

import { SqliteStore } from './store.js';
import { buildUiCritique } from './ui-critique.js';
import { pickProvider } from './llm/provider.js';
import { createComposioRuntime } from './tools/composio.js';
import { buildRegistry } from './tools/registry.js';
import { openSSE } from './chat/sse.js';
import { runChatTurn } from './chat/orchestrator.js';
import type { ChatEvent } from './llm/types.js';

loadEnv();

const env = z.object({
  PORT: z.coerce.number().default(3002),
  FRONTEND_URL: z.string().default('http://localhost:8082'),
  DEFAULT_LLM_PROVIDER: z.string().default('demo'),
  LLM_PROVIDER: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  COMPOSIO_API_KEY: z.string().optional(),
  COMPOSIO_AUTH_CONFIGS: z.string().optional(),
}).parse(process.env);

const app = Fastify({ logger: true });
const store = new SqliteStore();
const llmProvider = pickProvider({
  LLM_PROVIDER: env.LLM_PROVIDER,
  LLM_MODEL: env.LLM_MODEL,
  OPENAI_API_KEY: env.OPENAI_API_KEY,
});
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

function authHeaderToken(header?: string) {
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length);
}

function getAuthedUser(request: { headers: Record<string, unknown> }) {
  const token = authHeaderToken(String(request.headers.authorization ?? ''));
  if (!token) {
    return null;
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

await store.init();
await app.register(cors, { origin: true });

app.get('/health', async () => ({
  ok: true,
  provider: llmProvider.id,
  composio: composioRuntime.enabled,
}));

app.post('/auth/demo/create', async (request, reply) => {
  const payload = createPayloadSchema.parse(request.body);
  const result = await store.createAccount(payload);
  if (!result.ok) {
    return reply.status(400).send({ error: result.error });
  }
  const token = await store.createSession(result.account.id);
  return reply.status(201).send(serializeAuth(result.account, token));
});

app.post('/auth/demo/login', async (request, reply) => {
  const payload = authPayloadSchema.parse(request.body);
  const result = await store.signIn(payload.email, payload.password);
  if (!result.ok) {
    return reply.status(401).send({ error: result.error });
  }
  return reply.send(serializeAuth(result.account, result.token));
});

app.get('/me', async (request, reply) => {
  const user = getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  return reply.send({ user });
});

app.get('/apps', async (request, reply) => {
  const user = getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  return reply.send({
    totalAvailable: 1003,
    items: store.getApps(user.id),
  });
});

app.get('/apps/status', async (request, reply) => {
  const user = getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  const connected = store.getApps(user.id).filter((item) => item.connected).map((item) => item.slug);
  const missing = store.getApps(user.id).filter((item) => !item.connected).map((item) => item.slug);
  return reply.send({ connected, missing });
});

app.post('/connect/create-connect-token', async (request, reply) => {
  const user = getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  const payload = z.object({ app: appSlugSchema }).parse(request.body);
  const connectToken = await store.createConnectToken(user.id, payload.app);
  return reply.send({
    connectToken,
    initiateUrl: `${env.FRONTEND_URL.replace('8082', String(env.PORT))}/connect/initiate?connectToken=${encodeURIComponent(connectToken)}`,
  });
});

app.get('/connect/initiate', async (request, reply) => {
  const token = z.object({ connectToken: z.string() }).parse(request.query).connectToken;
  return reply.redirect(`${env.FRONTEND_URL.replace('8082', String(env.PORT))}/connect/callback?connectToken=${encodeURIComponent(token)}`);
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
  const user = getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  return reply.send({ ok: true });
});

app.post('/chat/stream', async (request, reply) => {
  const user = getAuthedUser(request);
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
  const user = getAuthedUser(request);
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
  const user = getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  store.clearHistory(user.id);
  return reply.send({ ok: true });
});

app.delete('/me', async (request, reply) => {
  const user = getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  await store.deleteAccount(user.id);
  store.clearHistory(user.id);
  return reply.status(204).send();
});

app.get('/briefing/today', async (request, reply) => {
  const user = getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  return reply.send(store.getBriefing(user.id));
});

app.get('/activity', async (request, reply) => {
  const user = getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  return reply.send({ items: store.getActivities(user.id) });
});

app.get('/flows', async (request, reply) => {
  const user = getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  return reply.send({ items: store.getFlows(user.id) });
});

app.post('/flows', async (request, reply) => {
  const user = getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  const flow = await store.createFlow(user.id);
  return reply.status(201).send({ flow });
});

app.patch('/flows/:id', async (request, reply) => {
  const user = getAuthedUser(request);
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
  const user = getAuthedUser(request);
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

await app.listen({ host: '0.0.0.0', port: env.PORT });
