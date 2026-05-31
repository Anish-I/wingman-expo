import type { ServerTool, ToolContext, ToolResult } from './types.js';

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

function fmtWeekday(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

function parseTargetDay(intent: string): number {
  return intent.toLowerCase().includes('tomorrow') ? 1 : 0;
}

function parseTime(intent: string): { hour: number; minute: number } {
  const lower = intent.toLowerCase();
  if (lower.includes('noon')) return { hour: 12, minute: 0 };
  const match = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!match) return { hour: 10, minute: 0 };
  const rawHour = Number(match[1]);
  const minute = Number(match[2] ?? '0');
  const suffix = match[3].toLowerCase();
  const hour = suffix === 'pm' && rawHour < 12 ? rawHour + 12 : suffix === 'am' && rawHour === 12 ? 0 : rawHour;
  return { hour, minute };
}

function parseTitle(intent: string): string {
  const lower = intent.toLowerCase();
  if (lower.includes('lunch')) return 'Lunch';
  if (lower.includes('meeting')) return 'Meeting';
  if (lower.includes('review')) return 'Review';
  return 'New event';
}

export const calendarReadToday: ServerTool = {
  definition: {
    name: 'calendar_read_today',
    description: "Read the user's calendar for today (offset 0) or a relative day. Returns a human-friendly summary.",
    parameters: {
      type: 'object',
      properties: {
        offset: { type: 'integer', description: 'Days from today (0 = today, 1 = tomorrow). Default 0.' },
      },
    },
  },
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    const offset = typeof args.offset === 'number' ? args.offset : 0;
    const connected = ctx.store.getApps(ctx.userId).some((a) => a.slug === 'googlecalendar' && a.connected);
    if (!connected) {
      return {
        output: 'Calendar is not connected. Generate an OAuth link with create_app_connection({ app: "googlecalendar" }).',
        meta: { kind: 'connection_required', appSlug: 'googlecalendar' },
      };
    }
    const target = new Date();
    target.setDate(target.getDate() + offset);
    const events = ctx.store.getCalendarEventsForUser(ctx.userId).filter((event) => {
      return new Date(event.startIso).toDateString() === target.toDateString();
    });
    await ctx.store.addActivity(ctx.userId, {
      title: 'Checked calendar',
      subtitle: offset === 1 ? "Tomorrow's events" : "Today's events",
      pip: 'calendar',
      color: '#F5BC1E',
    });
    if (events.length === 0) {
      return { output: `You are clear ${offset === 1 ? 'tomorrow' : 'today'}.` };
    }
    const summary = events.map((e) => `${e.title} at ${fmtTime(e.startIso)}`).join(', ');
    return { output: `${offset === 1 ? 'Tomorrow' : 'Today'}: ${events.length} event${events.length === 1 ? '' : 's'} — ${summary}.` };
  },
};

export const calendarCreateEvent: ServerTool = {
  definition: {
    name: 'calendar_create_event',
    description: 'Create a calendar event from a natural-language intent (e.g. "lunch with Mara tomorrow at noon"). Returns the created event details.',
    parameters: {
      type: 'object',
      properties: {
        intent: { type: 'string', description: 'Free-form description of the event the user wants to create.' },
        title: { type: 'string', description: 'Optional override for the event title.' },
      },
      required: ['intent'],
    },
  },
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    const intent = String(args.intent ?? '');
    const connected = ctx.store.getApps(ctx.userId).some((a) => a.slug === 'googlecalendar' && a.connected);
    if (!connected) {
      return {
        output: 'Calendar is not connected. Generate an OAuth link with create_app_connection({ app: "googlecalendar" }).',
        meta: { kind: 'connection_required', appSlug: 'googlecalendar' },
      };
    }
    const offset = parseTargetDay(intent);
    const { hour, minute } = parseTime(intent);
    const start = new Date();
    start.setDate(start.getDate() + offset);
    start.setHours(hour, minute, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 30);
    const title = typeof args.title === 'string' && args.title.trim() ? args.title : parseTitle(intent);
    const event = await ctx.store.createCalendarEvent(ctx.userId, {
      title,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      subtitle: `Created from chat · ${fmtWeekday(start.toISOString())}`,
    });
    await ctx.store.addActivity(ctx.userId, {
      title: 'Created calendar event',
      subtitle: `${event.title} · ${fmtWeekday(event.startIso)}`,
      pip: 'checkmark',
      color: '#3BB273',
    });
    return {
      output: `Created "${event.title}" for ${fmtWeekday(event.startIso)}.`,
      meta: { kind: 'calendar_event_created', eventId: event.id, title: event.title, startIso: event.startIso },
    };
  },
};

export const briefingToday: ServerTool = {
  definition: {
    name: 'briefing_today',
    description: "Return today's briefing (next events + counts) for the user.",
    parameters: { type: 'object', properties: {} },
  },
  async execute(_args, ctx: ToolContext): Promise<ToolResult> {
    const b = ctx.store.getBriefing(ctx.userId);
    const chips = b.chips.join(' · ');
    const items = b.items.map((i) => `${i.time} ${i.title}`).join('; ');
    return {
      output: `${b.greeting} ${chips}. ${items || 'Nothing on the schedule right now.'}`,
      meta: { kind: 'briefing', items: b.items.length },
    };
  },
};

export const createAppConnection: ServerTool = {
  definition: {
    name: 'create_app_connection',
    description: 'Generate an OAuth link the user can tap to connect an app (e.g. googlecalendar, gmail, slack, notion). Use this when another tool returned connection_required.',
    parameters: {
      type: 'object',
      properties: {
        app: { type: 'string', description: 'App slug (e.g. googlecalendar, gmail, slack).' },
      },
      required: ['app'],
    },
  },
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    const app = String(args.app ?? '').toLowerCase();
    if (!app) {
      return { output: 'app slug is required.' };
    }
    const token = await ctx.store.createConnectToken(ctx.userId, app);
    const url = `${process.env.FRONTEND_URL ?? 'http://localhost:8082'}/apps?connect_token=${encodeURIComponent(token)}&app=${encodeURIComponent(app)}`;
    return {
      output: `Tap to connect ${app}: ${url}`,
      meta: { kind: 'connection_required', appSlug: app, oauthUrl: url },
    };
  },
};

export const remember: ServerTool = {
  definition: {
    name: 'remember',
    description:
      "Save a durable fact, preference, routine, person, or day-to-day note about the user to long-term memory so you can recall it in future conversations. Use this whenever the user shares something worth remembering (e.g. 'I prefer tea', 'my standup is 9am', 'my sister's name is Mara').",
    parameters: {
      type: 'object',
      properties: {
        note: { type: 'string', description: 'The concise fact to remember, written in third person (e.g. "Prefers tea over coffee").' },
      },
      required: ['note'],
    },
  },
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    const note = String(args.note ?? '').trim();
    if (!note) {
      return { output: 'Nothing to remember — provide a note.' };
    }
    ctx.store.appendDailyLog(ctx.userId, note);
    await ctx.store.addActivity(ctx.userId, {
      title: 'Remembered something',
      subtitle: note.length > 60 ? `${note.slice(0, 57)}…` : note,
      pip: 'sparkle',
      color: '#8B7CF6',
    });
    return { output: `Got it — I'll remember that: ${note}`, meta: { kind: 'memory_saved', note } };
  },
};

export const builtinTools: Record<string, ServerTool> = {
  [calendarReadToday.definition.name]: calendarReadToday,
  [calendarCreateEvent.definition.name]: calendarCreateEvent,
  [briefingToday.definition.name]: briefingToday,
  [createAppConnection.definition.name]: createAppConnection,
  [remember.definition.name]: remember,
};
