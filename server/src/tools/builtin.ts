import { nanoid } from 'nanoid';

import type { ServerTool, ToolContext, ToolResult } from './types.js';
import { composioActionTools } from './composio-actions.js';
import { validateSteps } from '../flows/runner.js';
import { CATALOG_TOOL_NAMES, FLOW_CATALOG, catalogForPrompt } from '../flows/catalog.js';
import type { FlowSchedule, FlowStep } from '../flows/types.js';

/** Run a single, non-streaming LLM completion and return the trimmed text.
 *  Used by the `ai_step` smart node. Consumes the provider's token stream and
 *  prefers the canonical `finish.full.content` when the provider supplies it. */
async function runLLMText(ctx: ToolContext, system: string, user: string): Promise<string> {
  if (!ctx.llm) throw new Error('No LLM provider is wired into this context.');
  let text = '';
  for await (const chunk of ctx.llm.stream({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  })) {
    if (chunk.type === 'content_delta') text += chunk.delta;
    else if (chunk.type === 'finish' && chunk.full?.content) text = chunk.full.content;
  }
  return text.trim();
}

/** Default args for a node's tool (used to backfill anything the model omits). */
function defaultArgsForTool(tool: string): Record<string, unknown> {
  return FLOW_CATALOG.find((n) => n.tool === tool)?.defaultArgs ?? {};
}

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

/**
 * Parse an explicit `date` arg (from the builder's Date field or the AI) into a
 * concrete day. Accepts "today"/"tomorrow", ISO `YYYY-MM-DD`, or `M/D[/Y]`.
 * Returns null when empty/unrecognized so the caller can fall back to the intent.
 */
function parseDateField(value: string): Date | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v === 'today') return new Date();
  if (v === 'tomorrow') {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (!Number.isNaN(d.getTime())) return d;
  }
  const slash = v.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slash) {
    const now = new Date();
    const rawYear = slash[3];
    const year = rawYear ? (rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear)) : now.getFullYear();
    const d = new Date(year, Number(slash[1]) - 1, Number(slash[2]));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Parse an explicit `time` arg. Accepts "noon"/"midnight", 12-hour `2pm`/`2:30 pm`,
 * or 24-hour `14:00`. Returns null when empty/unrecognized.
 */
function parseTimeField(value: string): { hour: number; minute: number } | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v === 'noon') return { hour: 12, minute: 0 };
  if (v === 'midnight') return { hour: 0, minute: 0 };
  const ampm = v.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (ampm) {
    const rawHour = Number(ampm[1]);
    const minute = Number(ampm[2] ?? '0');
    const suffix = ampm[3];
    const hour = suffix === 'pm' && rawHour < 12 ? rawHour + 12 : suffix === 'am' && rawHour === 12 ? 0 : rawHour;
    return { hour, minute };
  }
  const h24 = v.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    const hour = Number(h24[1]);
    const minute = Number(h24[2]);
    if (hour < 24 && minute < 60) return { hour, minute };
  }
  return null;
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
    const connected = (await ctx.store.getApps(ctx.userId)).some((a) => a.slug === 'googlecalendar' && a.connected);
    if (!connected) {
      return {
        output: 'Calendar is not connected. Generate an OAuth link with create_app_connection({ app: "googlecalendar" }).',
        meta: { kind: 'connection_required', appSlug: 'googlecalendar' },
      };
    }
    const target = new Date();
    target.setDate(target.getDate() + offset);
    const events = (await ctx.store.getCalendarEventsForUser(ctx.userId)).filter((event) => {
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
    description:
      'Create a calendar event. Prefer the explicit fields — `title` (what), `date` ("today"/"tomorrow" or YYYY-MM-DD), `time` ("2pm"/"14:00"/"noon"). `intent` is a free-form fallback (e.g. "lunch with Mara tomorrow at noon") parsed only for fields you leave blank. Returns the created event details.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Event title / what to schedule.' },
        date: { type: 'string', description: 'Event date: "today", "tomorrow", or YYYY-MM-DD.' },
        time: { type: 'string', description: 'Event time: "2pm", "2:30pm", "14:00", or "noon".' },
        intent: { type: 'string', description: 'Optional free-form description; used only to fill any blank field above.' },
      },
      required: [],
    },
  },
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    const intent = String(args.intent ?? '');
    const dateArg = String(args.date ?? '');
    const timeArg = String(args.time ?? '');
    const titleArg = typeof args.title === 'string' ? args.title.trim() : '';
    const connected = (await ctx.store.getApps(ctx.userId)).some((a) => a.slug === 'googlecalendar' && a.connected);
    if (!connected) {
      return {
        output: 'Calendar is not connected. Generate an OAuth link with create_app_connection({ app: "googlecalendar" }).',
        meta: { kind: 'connection_required', appSlug: 'googlecalendar' },
      };
    }
    // Explicit fields win; fall back to parsing the free-form intent for any blank.
    const start = parseDateField(dateArg) ?? (() => {
      const d = new Date();
      d.setDate(d.getDate() + parseTargetDay(intent));
      return d;
    })();
    const { hour, minute } = parseTimeField(timeArg) ?? parseTime(intent);
    start.setHours(hour, minute, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 30);
    const title = titleArg || (intent ? parseTitle(intent) : 'New event');
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
    const b = await ctx.store.getBriefing(ctx.userId);
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
    // Respect the user's Memory toggle: when off, never write to long-term memory.
    const { memoryEnabled } = await ctx.store.getSettings(ctx.userId);
    if (!memoryEnabled) {
      return { output: "Memory is turned off in Settings, so I won't save that. Turn Memory on if you'd like me to remember." };
    }
    await ctx.store.appendDailyLog(ctx.userId, note);
    await ctx.store.addActivity(ctx.userId, {
      title: 'Remembered something',
      subtitle: note.length > 60 ? `${note.slice(0, 57)}…` : note,
      pip: 'love',
      color: '#8B7CF6',
    });
    return { output: `Got it — I'll remember that: ${note}`, meta: { kind: 'memory_saved', note } };
  },
};

// The "smart node": runs a focused LLM sub-task inside a flow (summarize, decide,
// classify, draft). Its `input` typically templates a prior step's output via
// {{steps.<id>.output}}, which the runner resolves before this tool runs.
export const aiStep: ServerTool = {
  definition: {
    name: 'ai_step',
    description:
      'Run a focused AI sub-task inside a flow: summarize, decide, classify, or draft text. ' +
      'Reads `prompt` (what to do) and optional `input` (source text — usually a prior step output). ' +
      'Returns only the result text, ready for a later step to use.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'What the AI should do, e.g. "Summarize into 3 bullet points".' },
        input: { type: 'string', description: 'Optional source text to act on. In a flow, template a prior step with {{steps.<id>.output}}.' },
      },
      required: ['prompt'],
    },
  },
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    const prompt = String(args.prompt ?? '').trim();
    if (!prompt) {
      return { output: 'ai_step needs a prompt describing what to do.' };
    }
    const input = String(args.input ?? '').trim();
    const system =
      'You are a single step inside an automated workflow. Do exactly what the instruction asks and ' +
      'reply with ONLY the result — no preamble, no explanation, no markdown code fences.';
    const user = input ? `${prompt}\n\n---\nInput:\n${input}` : prompt;
    const output = await runLLMText(ctx, system, user);
    return { output: output || '(the AI step produced no output)' };
  },
};

// Lets the AI assemble and persist a real, user-scoped flow from the node catalog.
// Steps are validated against CATALOG_TOOL_NAMES (which excludes create_flow itself,
// so a flow can never create flows). Created flows are active by default.
export const createFlow: ServerTool = {
  definition: {
    name: 'create_flow',
    description:
      'Create a real automation (flow) for the user from the node catalog below. Steps run top-to-bottom; ' +
      'a later step can reference an earlier one with {{steps.<id>.output}} in its args (ids are auto-assigned ' +
      'in order: use {{steps.0.output}} for the first step, etc.). Provide a `schedule` to run it automatically, ' +
      'or null for a manual-only flow. The flow goes live immediately unless `activate` is false.\n\n' +
      'IMPORTANT — do not invent values you were not given. Never guess an email address, phone number, or ' +
      'Slack channel. If a required arg (e.g. a recipient email) is missing, leave it as an empty string; the ' +
      'flow is saved paused so the user can fill it in. Do NOT put a placeholder like "friend" in an email field.\n' +
      'SCHEDULE — for a one-time request ("after 2 hours", "tonight at 8", "once tomorrow") set schedule.date ' +
      '(YYYY-MM-DD) plus hour/minute: it runs once then auto-pauses. For a recurring request set days and omit ' +
      'date. Omit schedule entirely (null) for a manual-only flow.\n\n' +
      'Available step tools:\n' +
      catalogForPrompt(),
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short, human title, e.g. "Morning inbox digest".' },
        description: { type: 'string', description: 'One-line description of what the flow does.' },
        emoji: { type: 'string', description: 'A single emoji that represents the flow.' },
        color: { type: 'string', description: 'Optional hex accent color, e.g. "#3B82F6".' },
        schedule: {
          type: ['object', 'null'],
          description: 'When to run automatically, or null for manual only.',
          properties: {
            hour: { type: 'integer', description: '0–23 (local server time).' },
            minute: { type: 'integer', description: '0–59.' },
            days: { type: 'array', items: { type: 'integer' }, description: 'Recurring weekdays 0=Sun..6=Sat; empty = every day. Omit when using date.' },
            date: { type: 'string', description: 'One-shot only: YYYY-MM-DD. Runs once at this date+hour:minute, then auto-pauses.' },
          },
        },
        steps: {
          type: 'array',
          description: 'Ordered steps. Each is a tool from the catalog plus its args.',
          items: {
            type: 'object',
            properties: {
              tool: { type: 'string', description: 'A tool name from the catalog (e.g. "gmail_summarize_inbox").' },
              args: { type: 'object', description: 'Arguments for the tool.' },
            },
            required: ['tool'],
          },
        },
        activate: { type: 'boolean', description: 'Whether the flow is live immediately. Default true.' },
      },
      required: ['title', 'steps'],
    },
  },
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    const rawSteps = Array.isArray(args.steps) ? (args.steps as Array<Record<string, unknown>>) : [];
    const steps: FlowStep[] = rawSteps.map((s) => {
      const tool = String(s?.tool ?? '');
      const provided = (s?.args && typeof s.args === 'object') ? (s.args as Record<string, unknown>) : {};
      return { id: `step_${nanoid(8)}`, tool, args: { ...defaultArgsForTool(tool), ...provided } };
    });

    const error = validateSteps(steps, CATALOG_TOOL_NAMES);
    if (error) {
      return { output: `Couldn't create the flow: ${error} Use only tools from the catalog.` };
    }

    // Catch values the model may have invented or left blank. We drop obviously
    // bad emails (e.g. the literal "friend") so a flow never sends to a guess, and
    // if any required field ends up empty we save the flow PAUSED instead of live.
    const catalogByTool = new Map(FLOW_CATALOG.map((n) => [n.tool, n]));
    const isEmail = (v: unknown) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
    const gaps: string[] = [];
    for (const step of steps) {
      const node = catalogByTool.get(step.tool);
      if (!node?.fields) continue;
      for (const field of node.fields) {
        const emailField = field.name === 'to' || field.name.toLowerCase().includes('email');
        const raw = step.args[field.name];
        if (emailField && typeof raw === 'string' && raw.trim() && !isEmail(raw)) {
          step.args[field.name] = ''; // not a real address — don't keep a guess like "friend"
        }
        const value = step.args[field.name];
        const empty = value == null || (typeof value === 'string' && value.trim() === '');
        if (!field.optional && empty) {
          gaps.push(`${field.label.toLowerCase()} for "${node.label}"`);
        }
      }
    }

    // Normalize the schedule the model passed (or null for manual-only).
    let schedule: FlowSchedule | null = null;
    const rawSched = args.schedule as { hour?: unknown; minute?: unknown; days?: unknown; date?: unknown } | null | undefined;
    if (rawSched && typeof rawSched === 'object') {
      const hour = Number(rawSched.hour);
      const minute = Number(rawSched.minute);
      if (Number.isInteger(hour) && hour >= 0 && hour <= 23 && Number.isInteger(minute) && minute >= 0 && minute <= 59) {
        const days = Array.isArray(rawSched.days)
          ? (rawSched.days as unknown[]).filter((d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6)
          : [];
        // One-shot when a valid YYYY-MM-DD date is supplied; days are then ignored.
        const date = typeof rawSched.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawSched.date) ? rawSched.date : undefined;
        schedule = date ? { hour, minute, days: [], date } : { hour, minute, days };
      }
    }

    const flow = await ctx.store.createFlow(ctx.userId, {
      title: String(args.title ?? '').trim() || 'New flow',
      description: typeof args.description === 'string' ? args.description : undefined,
      emoji: typeof args.emoji === 'string' && args.emoji.trim() ? args.emoji : '✨',
      color: typeof args.color === 'string' && args.color.trim() ? args.color : undefined,
      schedule,
      steps,
    });

    // createFlow sets active = steps.length > 0; pause on an explicit activate:false
    // OR when required fields are missing (so a half-built flow never runs live).
    const incomplete = gaps.length > 0;
    let active = flow.active;
    if ((args.activate === false || incomplete) && flow.active) {
      await ctx.store.setFlowActive(flow.id, ctx.userId, false);
      active = false;
    }

    const note = incomplete
      ? `I saved it paused — still need ${gaps.join(', ')}. Open the flow to fill that in, then turn it on.`
      : undefined;
    const when = schedule ? `scheduled (${flow.trigger})` : 'manual';
    return {
      output: incomplete
        ? `Created "${flow.title}" but paused it — missing ${gaps.join(', ')}.`
        : `Created flow "${flow.title}" with ${steps.length} step${steps.length === 1 ? '' : 's'} — ${when}, ${active ? 'active now' : 'paused'}.`,
      meta: { kind: 'flow_created', flowId: flow.id, title: flow.title, note },
    };
  },
};

export const builtinTools: Record<string, ServerTool> = {
  [calendarReadToday.definition.name]: calendarReadToday,
  [calendarCreateEvent.definition.name]: calendarCreateEvent,
  [briefingToday.definition.name]: briefingToday,
  [createAppConnection.definition.name]: createAppConnection,
  [remember.definition.name]: remember,
  [aiStep.definition.name]: aiStep,
  [createFlow.definition.name]: createFlow,
  // Real Gmail / Slack / Spotify actions, exposed as flow step modules.
  ...composioActionTools,
};
