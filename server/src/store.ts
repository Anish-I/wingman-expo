import crypto from 'node:crypto';
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
import { openDb, type DB } from './db/sqlite.js';
import type { ChatMessage, ToolCall } from './llm/types.js';

const HISTORY_LIMIT = 30;
const DAILY_LOG_RECENT_LINES = 40;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = path.resolve(__dirname, '../.data/wingman.db');

const DEMO_EMAIL = 'sam@wingman.dev';
const DEMO_PASSWORD = 'pigeon123';

type AppCatalogEntry = Omit<AppConnection, 'connected' | 'connectedAt'>;

const APP_CATALOG: AppCatalogEntry[] = [
  { id: 'gmail', slug: 'gmail', name: 'Gmail', category: 'Communication', emoji: '📧', color: '#EA4335' },
  { id: 'googlecalendar', slug: 'googlecalendar', name: 'Calendar', category: 'Productivity', emoji: '📆', color: '#F5A623' },
  { id: 'slack', slug: 'slack', name: 'Slack', category: 'Communication', emoji: '💬', color: '#611F69' },
  { id: 'notion', slug: 'notion', name: 'Notion', category: 'Productivity', emoji: '📝', color: '#1B2240' },
  { id: 'linear', slug: 'linear', name: 'Linear', category: 'Development', emoji: '⚡', color: '#5E6AD2' },
  { id: 'github', slug: 'github', name: 'GitHub', category: 'Development', emoji: '🐙', color: '#1B2240' },
  { id: 'spotify', slug: 'spotify', name: 'Spotify', category: 'Entertainment', emoji: '🎵', color: '#1DB954' },
  { id: 'dropbox', slug: 'dropbox', name: 'Dropbox', category: 'Cloud', emoji: '☁️', color: '#0061FF' },
];

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(derived, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function timeLabel(dateIso: string) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(dateIso));
}

function relativeWhen(dateIso: string) {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 2) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 180) return `${Math.round(minutes / 60)}h ago`;
  return 'Earlier today';
}

type UserRow = { id: string; name: string; email: string; phone: string; tier: 'Pro' };

function toCurrentUser(row: UserRow): CurrentUser {
  return { id: row.id, name: row.name, email: row.email, phone: row.phone, tier: row.tier };
}

export class SqliteStore {
  readonly db: DB;

  constructor(dbPath: string = DEFAULT_DB_PATH) {
    this.db = openDb(dbPath);
  }

  async init() {
    this.seedDemoAccount();
  }

  close() {
    this.db.close();
  }

  private seedDemoAccount() {
    const existing = this.db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(DEMO_EMAIL) as
      | { id: string }
      | undefined;
    if (existing) return;

    const id = 'user-sam';
    this.db
      .prepare('INSERT INTO users (id, name, email, password_hash, phone, tier, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(id, 'Sam Ortega', DEMO_EMAIL, hashPassword(DEMO_PASSWORD), '+1 (555) 123-4567', 'Pro', nowIso());

    for (const slug of ['gmail', 'slack', 'github']) {
      this.markConnected(id, slug);
    }

    const seedFlows: Array<Omit<Flow, 'id'>> = [
      { emoji: '📆', title: 'Calendar brief', description: "Tomorrow's meetings every night", trigger: 'Nightly 9:30 PM', runs: 12, color: '#F5BC1E', active: true, appSlug: 'googlecalendar' },
      { emoji: '💬', title: 'Standup nudge', description: 'Morning reminder before your first meeting', trigger: 'Weekdays 9:00 AM', runs: 5, color: '#8B7CF6', active: false, appSlug: 'googlecalendar' },
    ];
    for (const f of seedFlows) {
      this.db
        .prepare('INSERT INTO flows (id, user_id, emoji, title, description, trigger, runs, color, active, app_slug, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .run(randomId('flow'), id, f.emoji, f.title, f.description, f.trigger, f.runs, f.color, f.active ? 1 : 0, f.appSlug, nowIso());
    }

    const today = new Date();
    const makeDate = (hour: number, minute: number) => {
      const d = new Date(today);
      d.setHours(hour, minute, 0, 0);
      return d.toISOString();
    };
    const seedEvents = [
      { title: 'Design review with Maya', start: makeDate(10, 30), end: makeDate(11, 15), subtitle: 'Google Meet · 45 min', emoji: '📆', color: '#F5BC1E' },
      { title: 'Ship launch post', start: makeDate(14, 15), end: makeDate(14, 45), subtitle: 'Draft ready · needs review', emoji: '🚀', color: '#8B7CF6' },
    ];
    for (const e of seedEvents) {
      this.db
        .prepare('INSERT INTO calendar_events (id, user_id, title, start_iso, end_iso, subtitle, emoji, color) VALUES (?,?,?,?,?,?,?,?)')
        .run(randomId('event'), id, e.title, e.start, e.end, e.subtitle, e.emoji, e.color);
    }
  }

  private markConnected(userId: string, appSlug: string, connectionId?: string) {
    this.db
      .prepare(
        `INSERT INTO app_connections (user_id, app_slug, connected_at, connection_id) VALUES (?,?,?,?)
         ON CONFLICT(user_id, app_slug) DO UPDATE SET connected_at = excluded.connected_at, connection_id = excluded.connection_id`,
      )
      .run(userId, appSlug, nowIso(), connectionId ?? null);
  }

  // --- users / auth ---

  getUserByEmail(email: string): CurrentUser | null {
    const row = this.db
      .prepare('SELECT id, name, email, phone, tier FROM users WHERE lower(email) = lower(?)')
      .get(email) as UserRow | undefined;
    return row ? toCurrentUser(row) : null;
  }

  getUserBySession(token: string): CurrentUser | null {
    const row = this.db
      .prepare(
        `SELECT u.id, u.name, u.email, u.phone, u.tier
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token = ?`,
      )
      .get(token) as UserRow | undefined;
    return row ? toCurrentUser(row) : null;
  }

  async createAccount(input: { name: string; email: string; password: string }) {
    const email = input.email.trim().toLowerCase();
    if (this.getUserByEmail(email)) {
      return { ok: false as const, error: 'That email already exists. Sign in instead.' };
    }
    const id = randomId('user');
    this.db
      .prepare('INSERT INTO users (id, name, email, password_hash, phone, tier, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(id, input.name.trim(), email, hashPassword(input.password), '+1 (555) 000-0000', 'Pro', nowIso());
    return { ok: true as const, account: this.getUserByEmail(email)! };
  }

  async createSession(userId: string): Promise<string> {
    const token = crypto.randomBytes(24).toString('hex');
    this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    this.db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)').run(token, userId, nowIso());
    return token;
  }

  async signIn(email: string, password: string) {
    const row = this.db
      .prepare('SELECT id, name, email, phone, tier, password_hash FROM users WHERE lower(email) = lower(?)')
      .get(email) as (UserRow & { password_hash: string }) | undefined;
    if (!row || !verifyPassword(password, row.password_hash)) {
      return { ok: false as const, error: 'Incorrect email or password.' };
    }
    const token = await this.createSession(row.id);
    return { ok: true as const, token, account: toCurrentUser(row) };
  }

  async deleteAccount(userId: string) {
    this.db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  }

  // --- apps / connections ---

  getApps(userId: string): AppConnection[] {
    const connected = new Map(
      (this.db.prepare('SELECT app_slug, connected_at FROM app_connections WHERE user_id = ?').all(userId) as Array<{
        app_slug: string;
        connected_at: string;
      }>).map((r) => [r.app_slug, r.connected_at]),
    );
    return APP_CATALOG.map((app) => ({
      ...app,
      connected: connected.has(app.slug),
      connectedAt: connected.get(app.slug),
    }));
  }

  async createConnectToken(userId: string, appSlug: string) {
    const token = randomId('connect');
    this.db
      .prepare('INSERT INTO connect_tokens (token, user_id, app_slug, created_at) VALUES (?,?,?,?)')
      .run(token, userId, appSlug, nowIso());
    return token;
  }

  async consumeConnectToken(token: string) {
    const row = this.db.prepare('SELECT token, user_id, app_slug FROM connect_tokens WHERE token = ?').get(token) as
      | { token: string; user_id: string; app_slug: string }
      | undefined;
    if (!row) return null;
    this.db.prepare('DELETE FROM connect_tokens WHERE token = ?').run(token);
    return { token: row.token, userId: row.user_id, appSlug: row.app_slug };
  }

  async connectApp(userId: string, appSlug: string, connectionId?: string) {
    this.markConnected(userId, appSlug, connectionId);
    if (appSlug === 'googlecalendar') {
      const has = this.db
        .prepare("SELECT 1 FROM activities WHERE user_id = ? AND title = 'Connected Calendar'")
        .get(userId);
      if (!has) {
        await this.addActivity(userId, {
          title: 'Connected Calendar',
          subtitle: 'Google Calendar is ready for reads and writes',
          pip: 'calendar',
          color: '#F5BC1E',
        });
      }
    }
  }

  // --- flows ---

  getFlows(userId: string): Flow[] {
    return (this.db
      .prepare('SELECT id, emoji, title, description, trigger, runs, color, active, app_slug AS appSlug FROM flows WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as Array<Omit<Flow, 'active'> & { active: number }>).map((f) => ({ ...f, active: Boolean(f.active) }));
  }

  async createFlow(userId: string): Promise<Flow> {
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
    this.db
      .prepare('INSERT INTO flows (id, user_id, emoji, title, description, trigger, runs, color, active, app_slug, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(flow.id, userId, flow.emoji, flow.title, flow.description, flow.trigger, flow.runs, flow.color, 1, flow.appSlug, nowIso());
    await this.addActivity(userId, { title: 'Created flow', subtitle: flow.title, pip: 'clap', color: '#3B82F6' });
    return flow;
  }

  async setFlowActive(flowId: string, active: boolean): Promise<Flow | null> {
    const info = this.db.prepare('UPDATE flows SET active = ? WHERE id = ?').run(active ? 1 : 0, flowId);
    if (info.changes === 0) return null;
    const row = this.db
      .prepare('SELECT id, emoji, title, description, trigger, runs, color, active, app_slug AS appSlug FROM flows WHERE id = ?')
      .get(flowId) as (Omit<Flow, 'active'> & { active: number }) | undefined;
    return row ? { ...row, active: Boolean(row.active) } : null;
  }

  // --- activities ---

  getActivities(userId: string): ActivityEvent[] {
    return (this.db
      .prepare('SELECT id, title, subtitle, pip, color, created_at AS createdAt FROM activities WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as Array<Omit<ActivityEvent, 'when'>>).map((item) => ({ ...item, when: relativeWhen(item.createdAt) }));
  }

  async addActivity(userId: string, input: Omit<ActivityEvent, 'id' | 'when' | 'createdAt'>) {
    this.db
      .prepare('INSERT INTO activities (id, user_id, title, subtitle, pip, color, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(randomId('activity'), userId, input.title, input.subtitle, input.pip, input.color, nowIso());
  }

  // --- calendar / briefing ---

  getCalendarEventsForUser(userId: string): CalendarEvent[] {
    return this.db
      .prepare('SELECT id, user_id AS userId, title, start_iso AS startIso, end_iso AS endIso, subtitle, emoji, color FROM calendar_events WHERE user_id = ? ORDER BY start_iso ASC')
      .all(userId) as CalendarEvent[];
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
    this.db
      .prepare('INSERT INTO calendar_events (id, user_id, title, start_iso, end_iso, subtitle, emoji, color) VALUES (?,?,?,?,?,?,?,?)')
      .run(event.id, userId, event.title, event.startIso, event.endIso, event.subtitle, event.emoji, event.color);
    return event;
  }

  // --- memory (Obsidian-style markdown docs) ---

  getMemoryDoc(userId: string, slug: string): string {
    const row = this.db.prepare('SELECT content FROM memory_docs WHERE user_id = ? AND slug = ?').get(userId, slug) as
      | { content: string }
      | undefined;
    return row?.content ?? '';
  }

  setMemoryDoc(userId: string, slug: string, content: string): void {
    this.db
      .prepare(
        `INSERT INTO memory_docs (user_id, slug, content, updated_at) VALUES (?,?,?,?)
         ON CONFLICT(user_id, slug) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
      )
      .run(userId, slug, content, nowIso());
  }

  appendDailyLog(userId: string, note: string): void {
    const date = new Intl.DateTimeFormat('en-CA').format(new Date()); // YYYY-MM-DD
    const existing = this.getMemoryDoc(userId, 'daily_log');
    const line = `- ${date}: ${note.trim()}`;
    this.setMemoryDoc(userId, 'daily_log', existing ? `${existing}\n${line}` : line);
  }

  getMemoryContext(userId: string): string {
    const profile = this.getMemoryDoc(userId, 'profile').trim();
    const log = this.getMemoryDoc(userId, 'daily_log').trim();
    const recentLog = log ? log.split('\n').slice(-DAILY_LOG_RECENT_LINES).join('\n') : '';
    return [
      '## What you remember about this user',
      profile || '(nothing recorded yet — use the remember tool to save durable facts)',
      '',
      '## Recent day-to-day notes',
      recentLog || '(no recent notes)',
    ].join('\n');
  }

  // --- chat history ---

  getHistory(userId: string): ChatMessage[] {
    const rows = this.db
      .prepare(
        `SELECT role, content, tool_calls AS toolCalls, tool_call_id AS toolCallId, name
           FROM chat_messages WHERE user_id = ? ORDER BY id ASC`,
      )
      .all(userId) as Array<{ role: string; content: string; toolCalls: string | null; toolCallId: string | null; name: string | null }>;
    return rows.map((r) => {
      if (r.role === 'tool') {
        return { role: 'tool', toolCallId: r.toolCallId ?? '', name: r.name ?? '', content: r.content };
      }
      if (r.role === 'assistant') {
        const toolCalls = r.toolCalls ? (JSON.parse(r.toolCalls) as ToolCall[]) : undefined;
        return { role: 'assistant', content: r.content, ...(toolCalls?.length ? { toolCalls } : {}) };
      }
      return { role: r.role as 'user' | 'system', content: r.content };
    });
  }

  appendHistory(userId: string, ...messages: ChatMessage[]): void {
    const insert = this.db.prepare(
      'INSERT INTO chat_messages (user_id, role, content, tool_calls, tool_call_id, name, created_at) VALUES (?,?,?,?,?,?,?)',
    );
    const now = nowIso();
    const tx = this.db.transaction((msgs: ChatMessage[]) => {
      for (const m of msgs) {
        const toolCalls = m.role === 'assistant' && m.toolCalls ? JSON.stringify(m.toolCalls) : null;
        const toolCallId = m.role === 'tool' ? m.toolCallId : null;
        const name = m.role === 'tool' ? m.name : null;
        insert.run(userId, m.role, 'content' in m ? m.content : '', toolCalls, toolCallId, name, now);
      }
      // Trim to the most recent HISTORY_LIMIT rows for this user.
      this.db
        .prepare(
          `DELETE FROM chat_messages WHERE user_id = ? AND id NOT IN (
             SELECT id FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT ?
           )`,
        )
        .run(userId, userId, HISTORY_LIMIT);
    });
    tx(messages);
  }

  clearHistory(userId: string): void {
    this.db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(userId);
  }

  getBriefing(userId: string): Briefing {
    const now = new Date();
    const items = this.getCalendarEventsForUser(userId)
      .filter((event) => new Date(event.startIso).toDateString() === now.toDateString())
      .slice(0, 3)
      .map((event) => ({
        id: event.id,
        time: timeLabel(event.startIso),
        title: event.title,
        subtitle: event.subtitle,
        emoji: event.emoji,
        color: event.color,
      }));

    const user = this.db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as { name: string } | undefined;
    const firstName = user?.name?.split(' ')[0] ?? 'there';
    const connectedAppsCount = this.getApps(userId).filter((a) => a.connected).length;
    const activeFlowsCount = this.getFlows(userId).filter((f) => f.active).length;

    return {
      greeting: `Morning, ${firstName}!`,
      chips: [`${items.length} meetings`, `${activeFlowsCount} flows running`, `${connectedAppsCount} apps connected`],
      items,
    };
  }
}
