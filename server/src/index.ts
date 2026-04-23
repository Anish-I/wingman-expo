import crypto from 'node:crypto';

import cors from '@fastify/cors';
import Fastify from 'fastify';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

import { DemoStore } from './store.js';
import { buildUiCritique } from './ui-critique.js';

loadEnv();

const env = z.object({
  PORT: z.coerce.number().default(3002),
  FRONTEND_URL: z.string().default('http://localhost:8082'),
  DEFAULT_LLM_PROVIDER: z.string().default('demo'),
}).parse(process.env);

const app = Fastify({ logger: true });
const store = new DemoStore();

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

function parseTargetDay(message: string) {
  if (message.includes('tomorrow')) return 1;
  return 0;
}

function parseTime(message: string) {
  if (message.includes('noon')) return { hour: 12, minute: 0 };

  const match = message.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!match) return { hour: 10, minute: 0 };

  const rawHour = Number(match[1]);
  const minute = Number(match[2] ?? '0');
  const suffix = match[3].toLowerCase();
  const hour = suffix === 'pm' && rawHour < 12 ? rawHour + 12 : suffix === 'am' && rawHour === 12 ? 0 : rawHour;
  return { hour, minute };
}

function buildEventDraft(message: string) {
  const lower = message.toLowerCase();
  const dayOffset = parseTargetDay(lower);
  const { hour, minute } = parseTime(lower);
  const start = new Date();
  start.setDate(start.getDate() + dayOffset);
  start.setHours(hour, minute, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 30);

  let title = 'New event';
  if (lower.includes('lunch')) title = 'Lunch';
  else if (lower.includes('meeting')) title = 'Meeting';
  else if (lower.includes('review')) title = 'Review';

  return {
    title,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    subtitle: `Created from chat · ${dayOffset === 1 ? 'Tomorrow' : 'Today'} ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(start)}`,
  };
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
  provider: env.DEFAULT_LLM_PROVIDER,
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
    items: store.getApps(),
  });
});

app.get('/apps/status', async (request, reply) => {
  const user = getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  const connected = store.getApps().filter((item) => item.connected).map((item) => item.slug);
  const missing = store.getApps().filter((item) => !item.connected).map((item) => item.slug);
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

app.post('/chat', async (request, reply) => {
  const user = getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  const payload = chatPayloadSchema.parse(request.body);
  const lower = payload.message.toLowerCase();
  const calendarConnected = store.getApps().some((item) => item.slug === 'googlecalendar' && item.connected);

  if ((lower.includes('today') || lower.includes('tomorrow') || lower.includes('calendar')) && !lower.includes('schedule')) {
    if (!calendarConnected) {
      return reply.send({
        assistantMessage: 'Connect Calendar in Apps first and I can read your schedule.',
        action: {
          type: 'connection_required',
          appSlug: 'googlecalendar',
          toolName: 'GOOGLECALENDAR_FIND_EVENTS',
        },
      });
    }

    const targetOffset = lower.includes('tomorrow') ? 1 : 0;
    const events = store.getCalendarEventsForUser(user.id).filter((event) => {
      const date = new Date(event.startIso);
      const target = new Date();
      target.setDate(target.getDate() + targetOffset);
      return date.toDateString() === target.toDateString();
    });

    await store.addActivity({
      title: 'Checked calendar',
      subtitle: payload.message,
      pip: 'calendar',
      color: '#F5BC1E',
    });

    const assistantMessage = events.length === 0
      ? `You're clear ${targetOffset === 1 ? 'tomorrow' : 'today'}.`
      : `${targetOffset === 1 ? 'Tomorrow' : 'Today'} you have ${events.length} event${events.length === 1 ? '' : 's'}: ${events.map((event) => `${event.title} at ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(event.startIso))}`).join(', ')}.`;

    return reply.send({
      assistantMessage,
      action: {
        type: 'calendar_read',
        appSlug: 'googlecalendar',
        toolName: 'GOOGLECALENDAR_FIND_EVENTS',
      },
      events,
      activityCreated: true,
    });
  }

  if (lower.includes('schedule') || lower.includes('meeting') || lower.includes('lunch') || lower.includes('book')) {
    if (!calendarConnected) {
      return reply.send({
        assistantMessage: 'Connect Calendar in Apps first and I can create events for you.',
        action: {
          type: 'connection_required',
          appSlug: 'googlecalendar',
          toolName: 'GOOGLECALENDAR_CREATE_EVENT',
        },
      });
    }

    const draft = buildEventDraft(lower);
    const event = await store.createCalendarEvent(user.id, draft);
    await store.addActivity({
      title: 'Created calendar event',
      subtitle: `${event.title} · ${new Intl.DateTimeFormat('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(event.startIso))}`,
      pip: 'checkmark',
      color: '#3BB273',
    });

    return reply.send({
      assistantMessage: `Done — I scheduled ${event.title} for ${new Intl.DateTimeFormat('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' }).format(new Date(event.startIso))}.`,
      action: {
        type: 'calendar_create',
        appSlug: 'googlecalendar',
        toolName: 'GOOGLECALENDAR_CREATE_EVENT',
      },
      createdEvent: event,
      activityCreated: true,
    });
  }

  await store.addActivity({
    title: 'Handled request',
    subtitle: payload.message,
    pip: 'cool',
    color: '#3B82F6',
  });

  return reply.send({
    assistantMessage: "Coo! I can already help with Calendar reads and creates, and I'll get smarter as we wire more tools in.",
    action: {
      type: 'general_reply',
      appSlug: null,
      toolName: null,
    },
  });
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
  return reply.send({ items: store.getActivities() });
});

app.get('/flows', async (request, reply) => {
  const user = getAuthedUser(request);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  return reply.send({ items: store.getFlows() });
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
  await store.addActivity({
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
