import crypto from 'node:crypto';

import type {
  ActivityEvent,
  AppConnection,
  Briefing,
  CalendarEvent,
  CreateFlowInput,
  CurrentUser,
  Flow,
  FlowWithDefinition,
  UpdateFlowInput,
} from './types.js';
import { openPg, closePg, type PgPool } from './db/postgres.js';
import type { FlowDefinition } from './flows/types.js';
import { describeSchedule } from './flows/schedule.js';
import type { ChatMessage, ToolCall } from './llm/types.js';

const HISTORY_LIMIT = 30;
const DAILY_LOG_RECENT_LINES = 40;

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
  { id: 'googledrive', slug: 'googledrive', name: 'Google Drive', category: 'Cloud', emoji: '📂', color: '#4285F4' },
  { id: 'googledocs', slug: 'googledocs', name: 'Google Docs', category: 'Productivity', emoji: '📄', color: '#4285F4' },
  { id: 'googlesheets', slug: 'googlesheets', name: 'Google Sheets', category: 'Productivity', emoji: '📊', color: '#0F9D58' },
  { id: 'outlook', slug: 'outlook', name: 'Outlook', category: 'Communication', emoji: '📨', color: '#0078D4' },
  { id: 'discord', slug: 'discord', name: 'Discord', category: 'Communication', emoji: '🎮', color: '#5865F2' },
  { id: 'telegram', slug: 'telegram', name: 'Telegram', category: 'Communication', emoji: '✈️', color: '#26A5E4' },
  { id: 'whatsapp', slug: 'whatsapp', name: 'WhatsApp', category: 'Communication', emoji: '🟢', color: '#25D366' },
  { id: 'twitter', slug: 'twitter', name: 'X (Twitter)', category: 'Social', emoji: '🐦', color: '#1B2240' },
  { id: 'reddit', slug: 'reddit', name: 'Reddit', category: 'Social', emoji: '👽', color: '#FF4500' },
  { id: 'youtube', slug: 'youtube', name: 'YouTube', category: 'Entertainment', emoji: '📺', color: '#FF0000' },
  { id: 'todoist', slug: 'todoist', name: 'Todoist', category: 'Productivity', emoji: '✅', color: '#E44332' },
  { id: 'trello', slug: 'trello', name: 'Trello', category: 'Productivity', emoji: '📋', color: '#0079BF' },
  { id: 'asana', slug: 'asana', name: 'Asana', category: 'Productivity', emoji: '🎯', color: '#F06A6A' },
  { id: 'jira', slug: 'jira', name: 'Jira', category: 'Development', emoji: '🧩', color: '#0052CC' },
  { id: 'figma', slug: 'figma', name: 'Figma', category: 'Design', emoji: '🎨', color: '#A259FF' },
  { id: 'stripe', slug: 'stripe', name: 'Stripe', category: 'Finance', emoji: '💳', color: '#635BFF' },
  { id: 'shopify', slug: 'shopify', name: 'Shopify', category: 'Commerce', emoji: '🛍️', color: '#96BF48' },
  { id: 'hubspot', slug: 'hubspot', name: 'HubSpot', category: 'Sales', emoji: '🧲', color: '#FF7A59' },
  { id: 'salesforce', slug: 'salesforce', name: 'Salesforce', category: 'Sales', emoji: '☁️', color: '#00A1E0' },
  { id: 'zoom', slug: 'zoom', name: 'Zoom', category: 'Communication', emoji: '🎥', color: '#2D8CFF' },
  { id: 'one_drive', slug: 'one_drive', name: 'OneDrive', category: 'Cloud', emoji: '🗄️', color: '#0078D4' },
  { id: 'airtable', slug: 'airtable', name: 'Airtable', category: 'Productivity', emoji: '🗂️', color: '#FCB400' },
];

/** Slugs the server accepts for connect requests (kept in sync with the catalog). */
export const APP_CATALOG_SLUGS = APP_CATALOG.map((app) => app.slug);

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

/**
 * Postgres-backed store (Supabase-compatible). All methods are async.
 *
 * Migrated from the sync better-sqlite3 store. SQL is preserved nearly verbatim;
 * the main changes are `?` -> `$n` placeholders and async query execution.
 * Auth (scrypt + session tokens) is unchanged here and is swapped for Supabase
 * Auth in Phase 1 task 2.2.
 */
export class PgStore {
  private constructor(readonly pool: PgPool) {}

  /** Open the pool, ensure schema + demo seed. Pass a Supabase connection string. */
  static async open(connectionString: string | undefined = process.env.DATABASE_URL): Promise<PgStore> {
    if (!connectionString) {
      throw new Error('DATABASE_URL is required (Supabase Postgres connection string).');
    }
    const pool = await openPg(connectionString);
    const store = new PgStore(pool);
    await store.seedDemoAccount();
    return store;
  }

  async close() {
    await closePg();
  }

  private async seedDemoAccount() {
    const id = 'user-sam';
    // Atomic insert-or-skip: ON CONFLICT makes this race-safe when several
    // store instances boot at once (test processes, or multiple app instances).
    // RETURNING tells us whether *this* call created the row; only then do we
    // seed the child rows, so we never double-seed flows/events on restart.
    const inserted = await this.pool.query(
      `INSERT INTO users (id, name, email, password_hash, phone, tier, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [id, 'Sam Ortega', DEMO_EMAIL, hashPassword(DEMO_PASSWORD), '+1 (555) 123-4567', 'Pro', nowIso()],
    );
    if (!inserted.rows[0]) return; // already seeded by another boot

    // NOTE: we intentionally do NOT pre-mark any apps connected. "Connected"
    // must mean a real OAuth connection (Composio is the source of truth);
    // faking it here made the Apps screen lie. Users connect apps via OAuth.

    const seedFlows: Array<Omit<Flow, 'id'>> = [
      { emoji: '📆', title: 'Calendar brief', description: "Tomorrow's meetings every night", trigger: 'Nightly 9:30 PM', runs: 12, color: '#F5BC1E', active: true, appSlug: 'googlecalendar' },
      { emoji: '💬', title: 'Standup nudge', description: 'Morning reminder before your first meeting', trigger: 'Weekdays 9:00 AM', runs: 5, color: '#8B7CF6', active: false, appSlug: 'googlecalendar' },
    ];
    for (const f of seedFlows) {
      await this.pool.query(
        'INSERT INTO flows (id, user_id, emoji, title, description, trigger, runs, color, active, app_slug, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        [randomId('flow'), id, f.emoji, f.title, f.description, f.trigger, f.runs, f.color, f.active, f.appSlug, nowIso()],
      );
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
      await this.pool.query(
        'INSERT INTO calendar_events (id, user_id, title, start_iso, end_iso, subtitle, emoji, color) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [randomId('event'), id, e.title, e.start, e.end, e.subtitle, e.emoji, e.color],
      );
    }
  }

  private async markConnected(userId: string, appSlug: string, connectionId?: string) {
    await this.pool.query(
      `INSERT INTO app_connections (user_id, app_slug, connected_at, connection_id) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, app_slug) DO UPDATE SET connected_at = EXCLUDED.connected_at, connection_id = EXCLUDED.connection_id`,
      [userId, appSlug, nowIso(), connectionId ?? null],
    );
  }

  // --- users / auth ---

  async getUserByEmail(email: string): Promise<CurrentUser | null> {
    const res = await this.pool.query('SELECT id, name, email, phone, tier FROM users WHERE lower(email) = lower($1)', [email]);
    const row = res.rows[0] as UserRow | undefined;
    return row ? toCurrentUser(row) : null;
  }

  async getUserBySession(token: string): Promise<CurrentUser | null> {
    const res = await this.pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.tier
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token = $1`,
      [token],
    );
    const row = res.rows[0] as UserRow | undefined;
    return row ? toCurrentUser(row) : null;
  }

  async createAccount(input: { name: string; email: string; password: string }) {
    const email = input.email.trim().toLowerCase();
    if (await this.getUserByEmail(email)) {
      return { ok: false as const, error: 'That email already exists. Sign in instead.' };
    }
    const id = randomId('user');
    await this.pool.query(
      'INSERT INTO users (id, name, email, password_hash, phone, tier, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, input.name.trim(), email, hashPassword(input.password), '+1 (555) 000-0000', 'Pro', nowIso()],
    );
    return { ok: true as const, account: (await this.getUserByEmail(email))! };
  }

  async createSession(userId: string): Promise<string> {
    const token = crypto.randomBytes(24).toString('hex');
    await this.pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    await this.pool.query('INSERT INTO sessions (token, user_id, created_at) VALUES ($1,$2,$3)', [token, userId, nowIso()]);
    return token;
  }

  async signIn(email: string, password: string) {
    const res = await this.pool.query(
      'SELECT id, name, email, phone, tier, password_hash FROM users WHERE lower(email) = lower($1)',
      [email],
    );
    const row = res.rows[0] as (UserRow & { password_hash: string }) | undefined;
    if (!row || !verifyPassword(password, row.password_hash)) {
      return { ok: false as const, error: 'Incorrect email or password.' };
    }
    const token = await this.createSession(row.id);
    return { ok: true as const, token, account: toCurrentUser(row) };
  }

  async deleteAccount(userId: string) {
    await this.pool.query('DELETE FROM users WHERE id = $1', [userId]);
  }

  // --- apps / connections ---

  async getApps(userId: string): Promise<AppConnection[]> {
    const res = await this.pool.query('SELECT app_slug, connected_at FROM app_connections WHERE user_id = $1', [userId]);
    const connected = new Map(
      (res.rows as Array<{ app_slug: string; connected_at: string }>).map((r) => [r.app_slug, r.connected_at]),
    );
    return APP_CATALOG.map((app) => ({
      ...app,
      connected: connected.has(app.slug),
      connectedAt: connected.get(app.slug),
    }));
  }

  async createConnectToken(userId: string, appSlug: string) {
    const token = randomId('connect');
    await this.pool.query(
      'INSERT INTO connect_tokens (token, user_id, app_slug, created_at) VALUES ($1,$2,$3,$4)',
      [token, userId, appSlug, nowIso()],
    );
    return token;
  }

  async consumeConnectToken(token: string) {
    const res = await this.pool.query('SELECT token, user_id, app_slug FROM connect_tokens WHERE token = $1', [token]);
    const row = res.rows[0] as { token: string; user_id: string; app_slug: string } | undefined;
    if (!row) return null;
    await this.pool.query('DELETE FROM connect_tokens WHERE token = $1', [token]);
    return { token: row.token, userId: row.user_id, appSlug: row.app_slug };
  }

  async disconnectApp(userId: string, appSlug: string) {
    await this.pool.query('DELETE FROM app_connections WHERE user_id = $1 AND app_slug = $2', [userId, appSlug]);
  }

  async connectApp(userId: string, appSlug: string, connectionId?: string) {
    await this.markConnected(userId, appSlug, connectionId);
    if (appSlug === 'googlecalendar') {
      const has = await this.pool.query("SELECT 1 FROM activities WHERE user_id = $1 AND title = 'Connected Calendar'", [userId]);
      if (!has.rows[0]) {
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

  async getFlows(userId: string): Promise<Flow[]> {
    const res = await this.pool.query(
      'SELECT id, emoji, title, description, trigger, runs, color, active, app_slug AS "appSlug" FROM flows WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return (res.rows as Array<Omit<Flow, 'active'> & { active: boolean }>).map((f) => ({ ...f, active: Boolean(f.active) }));
  }

  /**
   * Create a real flow. `definition` (schedule + steps) drives execution; the
   * display `trigger` string is derived from the schedule so the UI and the
   * runtime never drift. Falls back to a sensible default when fields are omitted
   * (keeps the existing "New flow" button working until the builder sends a body).
   */
  async createFlow(userId: string, input?: CreateFlowInput): Promise<Flow> {
    const schedule = input?.schedule ?? null;
    const definition: FlowDefinition = { schedule, steps: input?.steps ?? [] };
    const flow: Flow = {
      id: randomId('flow'),
      emoji: input?.emoji ?? '✨',
      title: input?.title ?? 'New workflow',
      description: input?.description ?? 'Customize the trigger, apps, and actions',
      trigger: describeSchedule(schedule),
      runs: 0,
      color: input?.color ?? '#3B82F6',
      // A fresh flow with no steps yet shouldn't be "active" (nothing to run).
      active: (input?.steps?.length ?? 0) > 0,
      appSlug: input?.appSlug ?? 'googlecalendar',
    };
    await this.pool.query(
      `INSERT INTO flows (id, user_id, emoji, title, description, trigger, runs, color, active, app_slug, definition, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [flow.id, userId, flow.emoji, flow.title, flow.description, flow.trigger, flow.runs, flow.color, flow.active, flow.appSlug, JSON.stringify(definition), nowIso()],
    );
    await this.addActivity(userId, { title: 'Created flow', subtitle: flow.title, pip: 'clap', color: flow.color });
    return flow;
  }

  async setFlowActive(flowId: string, active: boolean): Promise<Flow | null> {
    const res = await this.pool.query(
      'UPDATE flows SET active = $1 WHERE id = $2 RETURNING id, emoji, title, description, trigger, runs, color, active, app_slug AS "appSlug"',
      [active, flowId],
    );
    const row = res.rows[0] as (Omit<Flow, 'active'> & { active: boolean }) | undefined;
    return row ? { ...row, active: Boolean(row.active) } : null;
  }

  /** Active flows that have a schedule — the scheduler's candidate set. */
  async getActiveScheduledFlows(): Promise<Array<FlowWithDefinition & { userId: string }>> {
    const res = await this.pool.query(
      `SELECT id, user_id AS "userId", emoji, title, description, trigger, runs, color, active,
              app_slug AS "appSlug", definition, last_run_at AS "lastRunAt"
         FROM flows
        WHERE active = TRUE AND definition IS NOT NULL`,
    );
    return (res.rows as Array<FlowWithDefinition & { userId: string; active: boolean }>).map((f) => ({
      ...f,
      active: Boolean(f.active),
      // pg returns JSONB already parsed; normalize null/undefined.
      definition: (f.definition as FlowDefinition | null) ?? null,
    }));
  }

  /** Record a successful run: bump the counter and stamp last_run_at. */
  async recordFlowRun(flowId: string, at: string): Promise<void> {
    await this.pool.query('UPDATE flows SET runs = runs + 1, last_run_at = $2 WHERE id = $1', [flowId, at]);
  }

  /** One flow (with its executable definition), scoped to its owner. */
  async getFlowById(flowId: string, userId: string): Promise<FlowWithDefinition | null> {
    const res = await this.pool.query(
      `SELECT id, emoji, title, description, trigger, runs, color, active,
              app_slug AS "appSlug", definition, last_run_at AS "lastRunAt"
         FROM flows
        WHERE id = $1 AND user_id = $2`,
      [flowId, userId],
    );
    const row = res.rows[0] as (FlowWithDefinition & { active: boolean }) | undefined;
    if (!row) return null;
    return {
      ...row,
      active: Boolean(row.active),
      definition: (row.definition as FlowDefinition | null) ?? null,
    };
  }

  /**
   * Update a flow's display fields and executable definition. Only provided
   * fields change; the `trigger` string is re-derived from the schedule so the
   * UI label and the runtime never drift. Scoped to the owner; returns null when
   * the flow doesn't exist for this user.
   */
  async updateFlow(flowId: string, userId: string, input: UpdateFlowInput): Promise<Flow | null> {
    const current = await this.getFlowById(flowId, userId);
    if (!current) return null;

    const scheduleProvided = 'schedule' in input;
    const stepsProvided = 'steps' in input;
    const nextSchedule = scheduleProvided ? input.schedule ?? null : current.definition?.schedule ?? null;
    const nextSteps = stepsProvided ? input.steps ?? [] : current.definition?.steps ?? [];
    const definition: FlowDefinition = { schedule: nextSchedule, steps: nextSteps };

    const next: Flow = {
      id: current.id,
      emoji: input.emoji ?? current.emoji,
      title: input.title ?? current.title,
      description: input.description ?? current.description,
      trigger: describeSchedule(nextSchedule),
      runs: current.runs,
      color: input.color ?? current.color,
      active: current.active,
      appSlug: input.appSlug ?? current.appSlug,
    };

    await this.pool.query(
      `UPDATE flows
          SET emoji = $1, title = $2, description = $3, trigger = $4,
              color = $5, app_slug = $6, definition = $7
        WHERE id = $8 AND user_id = $9`,
      [next.emoji, next.title, next.description, next.trigger, next.color, next.appSlug, JSON.stringify(definition), flowId, userId],
    );
    return next;
  }

  // --- activities ---

  async getActivities(userId: string): Promise<ActivityEvent[]> {
    const res = await this.pool.query(
      'SELECT id, title, subtitle, pip, color, created_at AS "createdAt" FROM activities WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return (res.rows as Array<Omit<ActivityEvent, 'when'>>).map((item) => ({ ...item, when: relativeWhen(item.createdAt) }));
  }

  async addActivity(userId: string, input: Omit<ActivityEvent, 'id' | 'when' | 'createdAt'>) {
    await this.pool.query(
      'INSERT INTO activities (id, user_id, title, subtitle, pip, color, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [randomId('activity'), userId, input.title, input.subtitle, input.pip, input.color, nowIso()],
    );
  }

  // --- calendar / briefing ---

  async getCalendarEventsForUser(userId: string): Promise<CalendarEvent[]> {
    const res = await this.pool.query(
      'SELECT id, user_id AS "userId", title, start_iso AS "startIso", end_iso AS "endIso", subtitle, emoji, color FROM calendar_events WHERE user_id = $1 ORDER BY start_iso ASC',
      [userId],
    );
    return res.rows as CalendarEvent[];
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
    await this.pool.query(
      'INSERT INTO calendar_events (id, user_id, title, start_iso, end_iso, subtitle, emoji, color) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [event.id, userId, event.title, event.startIso, event.endIso, event.subtitle, event.emoji, event.color],
    );
    return event;
  }

  // --- memory (Obsidian-style markdown docs) ---

  async getMemoryDoc(userId: string, slug: string): Promise<string> {
    const res = await this.pool.query('SELECT content FROM memory_docs WHERE user_id = $1 AND slug = $2', [userId, slug]);
    const row = res.rows[0] as { content: string } | undefined;
    return row?.content ?? '';
  }

  async setMemoryDoc(userId: string, slug: string, content: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO memory_docs (user_id, slug, content, updated_at) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, slug) DO UPDATE SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at`,
      [userId, slug, content, nowIso()],
    );
  }

  async appendDailyLog(userId: string, note: string): Promise<void> {
    const date = new Intl.DateTimeFormat('en-CA').format(new Date()); // YYYY-MM-DD
    const existing = await this.getMemoryDoc(userId, 'daily_log');
    const line = `- ${date}: ${note.trim()}`;
    await this.setMemoryDoc(userId, 'daily_log', existing ? `${existing}\n${line}` : line);
  }

  async getMemoryContext(userId: string): Promise<string> {
    const profile = (await this.getMemoryDoc(userId, 'profile')).trim();
    const log = (await this.getMemoryDoc(userId, 'daily_log')).trim();
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

  async getHistory(userId: string): Promise<ChatMessage[]> {
    const res = await this.pool.query(
      `SELECT role, content, tool_calls AS "toolCalls", tool_call_id AS "toolCallId", name
         FROM chat_messages WHERE user_id = $1 ORDER BY id ASC`,
      [userId],
    );
    const rows = res.rows as Array<{ role: string; content: string; toolCalls: string | null; toolCallId: string | null; name: string | null }>;
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

  async appendHistory(userId: string, ...messages: ChatMessage[]): Promise<void> {
    const client = await this.pool.connect();
    const now = nowIso();
    try {
      await client.query('BEGIN');
      for (const m of messages) {
        const toolCalls = m.role === 'assistant' && m.toolCalls ? JSON.stringify(m.toolCalls) : null;
        const toolCallId = m.role === 'tool' ? m.toolCallId : null;
        const name = m.role === 'tool' ? m.name : null;
        await client.query(
          'INSERT INTO chat_messages (user_id, role, content, tool_calls, tool_call_id, name, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [userId, m.role, 'content' in m ? m.content : '', toolCalls, toolCallId, name, now],
        );
      }
      // Trim to the most recent HISTORY_LIMIT rows for this user.
      await client.query(
        `DELETE FROM chat_messages WHERE user_id = $1 AND id NOT IN (
           SELECT id FROM chat_messages WHERE user_id = $2 ORDER BY id DESC LIMIT $3
         )`,
        [userId, userId, HISTORY_LIMIT],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async clearHistory(userId: string): Promise<void> {
    await this.pool.query('DELETE FROM chat_messages WHERE user_id = $1', [userId]);
  }

  /**
   * History shaped for the client transcript: only user/assistant turns with
   * visible text (assistant tool-call shells have empty content; tool/system
   * rows are internal). `getHistory` can't be reused — it has no ids and
   * includes the LLM-only rows.
   */
  async getDisplayHistory(userId: string): Promise<Array<{ id: string; role: 'user' | 'assistant'; content: string; createdAt: string }>> {
    const res = await this.pool.query(
      `SELECT id, role, content, created_at AS "createdAt" FROM chat_messages
        WHERE user_id = $1 AND role IN ('user', 'assistant') AND content <> ''
        ORDER BY id ASC`,
      [userId],
    );
    return (res.rows as Array<{ id: number | string; role: 'user' | 'assistant'; content: string; createdAt: string }>).map((r) => ({
      id: String(r.id),
      role: r.role,
      content: r.content,
      createdAt: r.createdAt,
    }));
  }

  async getBriefing(userId: string): Promise<Briefing> {
    const now = new Date();
    const events = await this.getCalendarEventsForUser(userId);
    const items = events
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

    const userRes = await this.pool.query('SELECT name FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0] as { name: string } | undefined;
    const firstName = user?.name?.split(' ')[0] ?? 'there';
    const apps = await this.getApps(userId);
    const connectedAppsCount = apps.filter((a) => a.connected).length;
    const flows = await this.getFlows(userId);
    const activeFlowsCount = flows.filter((f) => f.active).length;

    return {
      greeting: `Morning, ${firstName}!`,
      chips: [`${items.length} meetings`, `${activeFlowsCount} flows running`, `${connectedAppsCount} apps connected`],
      items,
    };
  }
}
