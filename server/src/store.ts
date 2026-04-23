import crypto from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  ActivityEvent,
  AppConnection,
  Briefing,
  CalendarEvent,
  CurrentUser,
  Flow,
} from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../.data');
const dataFile = path.join(dataDir, 'demo-store.json');

type DemoAccount = CurrentUser & {
  password: string;
};

type SessionRecord = {
  token: string;
  userId: string;
  createdAt: string;
};

type ConnectTokenRecord = {
  token: string;
  userId: string;
  appSlug: string;
  createdAt: string;
};

type DemoState = {
  accounts: DemoAccount[];
  sessions: SessionRecord[];
  connectTokens: ConnectTokenRecord[];
  apps: AppConnection[];
  flows: Flow[];
  activities: ActivityEvent[];
  calendarEvents: CalendarEvent[];
};

const initialUserId = 'user-sam';

const appCatalog: AppConnection[] = [
  { id: 'gmail', slug: 'gmail', name: 'Gmail', category: 'Communication', emoji: '📧', color: '#EA4335', connected: true },
  { id: 'googlecalendar', slug: 'googlecalendar', name: 'Calendar', category: 'Productivity', emoji: '📆', color: '#F5A623', connected: false },
  { id: 'slack', slug: 'slack', name: 'Slack', category: 'Communication', emoji: '💬', color: '#611F69', connected: true },
  { id: 'notion', slug: 'notion', name: 'Notion', category: 'Productivity', emoji: '📝', color: '#1B2240', connected: false },
  { id: 'linear', slug: 'linear', name: 'Linear', category: 'Development', emoji: '⚡', color: '#5E6AD2', connected: false },
  { id: 'github', slug: 'github', name: 'GitHub', category: 'Development', emoji: '🐙', color: '#1B2240', connected: true },
  { id: 'spotify', slug: 'spotify', name: 'Spotify', category: 'Entertainment', emoji: '🎵', color: '#1DB954', connected: false },
  { id: 'dropbox', slug: 'dropbox', name: 'Dropbox', category: 'Cloud', emoji: '☁️', color: '#0061FF', connected: false }
];

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

function timeLabel(dateIso: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateIso));
}

function relativeWhen(dateIso: string) {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));

  if (minutes < 2) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 180) return `${Math.round(minutes / 60)}h ago`;
  return 'Earlier today';
}

function createSeedState(): DemoState {
  const today = new Date();
  const makeDate = (dayOffset: number, hour: number, minute: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() + dayOffset);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  };

  return {
    accounts: [{
      id: initialUserId,
      name: 'Sam Ortega',
      email: 'sam@wingman.dev',
      password: 'pigeon123',
      phone: '+1 (555) 123-4567',
      tier: 'Pro',
    }],
    sessions: [],
    connectTokens: [],
    apps: appCatalog,
    flows: [
      {
        id: 'flow-digest',
        emoji: '📆',
        title: 'Calendar brief',
        description: "Tomorrow's meetings every night",
        trigger: 'Nightly 9:30 PM',
        runs: 12,
        color: '#F5BC1E',
        active: true,
        appSlug: 'googlecalendar',
      },
      {
        id: 'flow-standup',
        emoji: '💬',
        title: 'Standup nudge',
        description: 'Morning reminder before your first meeting',
        trigger: 'Weekdays 9:00 AM',
        runs: 5,
        color: '#8B7CF6',
        active: false,
        appSlug: 'googlecalendar',
      },
    ],
    activities: [],
    calendarEvents: [
      {
        id: 'event-seed-1',
        userId: initialUserId,
        title: 'Design review with Maya',
        startIso: makeDate(0, 10, 30),
        endIso: makeDate(0, 11, 15),
        subtitle: 'Google Meet · 45 min',
        emoji: '📆',
        color: '#F5BC1E',
      },
      {
        id: 'event-seed-2',
        userId: initialUserId,
        title: 'Ship launch post',
        startIso: makeDate(0, 14, 15),
        endIso: makeDate(0, 14, 45),
        subtitle: 'Draft ready · needs review',
        emoji: '🚀',
        color: '#8B7CF6',
      }
    ],
  };
}

export class DemoStore {
  private state: DemoState = createSeedState();

  async init() {
    await mkdir(dataDir, { recursive: true });

    try {
      const raw = await readFile(dataFile, 'utf8');
      this.state = JSON.parse(raw) as DemoState;
    } catch {
      await this.persist();
    }
  }

  private async persist() {
    await writeFile(dataFile, JSON.stringify(this.state, null, 2), 'utf8');
  }

  getApps() {
    return this.state.apps;
  }

  getUserByEmail(email: string) {
    return this.state.accounts.find((account) => account.email.toLowerCase() === email.toLowerCase()) ?? null;
  }

  getUserBySession(token: string) {
    const session = this.state.sessions.find((item) => item.token === token);
    if (!session) return null;
    return this.state.accounts.find((account) => account.id === session.userId) ?? null;
  }

  async createAccount(input: { name: string; email: string; password: string }) {
    const existing = this.getUserByEmail(input.email);
    if (existing) {
      if (existing.password === input.password) {
        return { ok: true as const, account: existing };
      }
      return { ok: false as const, error: 'That email already exists. Sign in instead.' };
    }

    const account: DemoAccount = {
      id: randomId('user'),
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
      phone: '+1 (555) 000-0000',
      tier: 'Pro',
    };
    this.state.accounts.unshift(account);
    await this.persist();
    return { ok: true as const, account };
  }

  async createSession(userId: string) {
    const token = crypto.randomBytes(24).toString('hex');
    this.state.sessions = this.state.sessions.filter((item) => item.userId !== userId);
    this.state.sessions.unshift({ token, userId, createdAt: nowIso() });
    await this.persist();
    return token;
  }

  async signIn(email: string, password: string) {
    const account = this.getUserByEmail(email);
    if (!account || account.password !== password) {
      return { ok: false as const, error: 'Incorrect email or password.' };
    }

    const token = await this.createSession(account.id);
    return { ok: true as const, token, account };
  }

  async createConnectToken(userId: string, appSlug: string) {
    const token = randomId('connect');
    this.state.connectTokens.unshift({
      token,
      userId,
      appSlug,
      createdAt: nowIso(),
    });
    await this.persist();
    return token;
  }

  async consumeConnectToken(token: string) {
    const existing = this.state.connectTokens.find((item) => item.token === token) ?? null;
    this.state.connectTokens = this.state.connectTokens.filter((item) => item.token !== token);
    await this.persist();
    return existing;
  }

  async connectApp(userId: string, appSlug: string) {
    this.state.apps = this.state.apps.map((app) =>
      app.slug === appSlug ? { ...app, connected: true, connectedAt: nowIso() } : app,
    );
    if (appSlug === 'googlecalendar' && !this.state.activities.some((item) => item.title === 'Connected Calendar')) {
      this.state.activities.unshift({
        id: randomId('activity'),
        when: 'Just now',
        title: 'Connected Calendar',
        subtitle: 'Google Calendar is ready for reads and writes',
        pip: 'calendar',
        color: '#F5BC1E',
        createdAt: nowIso(),
      });
    }
    await this.persist();
  }

  async setFlowActive(flowId: string, active: boolean) {
    this.state.flows = this.state.flows.map((flow) =>
      flow.id === flowId ? { ...flow, active } : flow,
    );
    await this.persist();
    return this.state.flows.find((flow) => flow.id === flowId) ?? null;
  }

  async createFlow(userId: string) {
    const flow: Flow = {
      id: randomId('flow'),
      emoji: '📅',
      title: 'Daily calendar summary',
      description: 'A daily digest of your upcoming events',
      trigger: 'Weekdays 8:00 AM',
      runs: 0,
      color: '#3B82F6',
      active: true,
      appSlug: 'googlecalendar',
    };
    this.state.flows.unshift(flow);
    this.state.activities.unshift({
      id: randomId('activity'),
      when: 'Just now',
      title: 'Created flow',
      subtitle: flow.title,
      pip: 'clap',
      color: '#3B82F6',
      createdAt: nowIso(),
    });
    await this.persist();
    return flow;
  }

  getActivities() {
    return this.state.activities
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((item) => ({ ...item, when: relativeWhen(item.createdAt) }));
  }

  async addActivity(input: Omit<ActivityEvent, 'id' | 'when' | 'createdAt'>) {
    this.state.activities.unshift({
      ...input,
      id: randomId('activity'),
      when: 'Just now',
      createdAt: nowIso(),
    });
    await this.persist();
  }

  getFlows() {
    return this.state.flows;
  }

  getCalendarEventsForUser(userId: string) {
    return this.state.calendarEvents
      .filter((event) => event.userId === userId)
      .sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());
  }

  getBriefing(userId: string): Briefing {
    const items = this.getCalendarEventsForUser(userId)
      .filter((event) => {
        const eventDate = new Date(event.startIso);
        const now = new Date();
        return eventDate.toDateString() === now.toDateString();
      })
      .slice(0, 3)
      .map((event) => ({
        id: event.id,
        time: timeLabel(event.startIso),
        title: event.title,
        subtitle: event.subtitle,
        emoji: event.emoji,
        color: event.color,
      }));

    const connectedAppsCount = this.state.apps.filter((app) => app.connected).length;
    const activeFlowsCount = this.state.flows.filter((flow) => flow.active).length;

    return {
      greeting: 'Morning, Sam!',
      chips: [`${items.length} meetings`, `${activeFlowsCount} flows running`, `${connectedAppsCount} apps connected`],
      items,
    };
  }

  async createCalendarEvent(userId: string, input: { title: string; startIso: string; endIso: string; subtitle: string }) {
    const event: CalendarEvent = {
      id: randomId('event'),
      userId,
      title: input.title,
      startIso: input.startIso,
      endIso: input.endIso,
      subtitle: input.subtitle,
      emoji: '📆',
      color: '#F5BC1E',
    };
    this.state.calendarEvents.push(event);
    await this.persist();
    return event;
  }
}
