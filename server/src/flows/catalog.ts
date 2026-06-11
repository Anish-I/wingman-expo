/**
 * Flow node catalog — the single source of truth for "what a flow step can be".
 *
 * Every entry maps to a real builtin tool the flow runner can execute. Two
 * consumers read this list:
 *   1. The AI (`create_flow` tool + `/flows/generate`) — so the model only ever
 *      assembles flows from nodes the runner can actually run.
 *   2. The frontend builder — fetched via `GET /flows/catalog` so the "Add step"
 *      sheet and the AI stay in sync (no more hardcoded-in-two-places drift).
 *
 * `CATALOG_TOOL_NAMES` is the allow-list used by `validateSteps` on save. Note it
 * deliberately does NOT include `create_flow` itself — a flow must never be able
 * to create flows (recursion guard).
 */

export type CatalogField = {
  name: string;
  label: string;
  placeholder?: string;
  optional?: boolean;
  multiline?: boolean;
};

export type CatalogNode = {
  key: string;
  label: string;
  emoji: string;
  description: string;
  /** The builtin tool this node executes. */
  tool: string;
  defaultArgs: Record<string, unknown>;
  fields?: CatalogField[];
};

export const FLOW_CATALOG: CatalogNode[] = [
  {
    key: 'briefing',
    label: 'Morning briefing',
    emoji: '🌅',
    description: "Summarize today's plan and counts",
    tool: 'briefing_today',
    defaultArgs: {},
  },
  {
    key: 'calendar-today',
    label: "Read today's calendar",
    emoji: '📆',
    description: "List today's events",
    tool: 'calendar_read_today',
    defaultArgs: { offset: 0 },
  },
  {
    key: 'calendar-tomorrow',
    label: "Read tomorrow's calendar",
    emoji: '🌙',
    description: "List tomorrow's events",
    tool: 'calendar_read_today',
    defaultArgs: { offset: 1 },
  },
  {
    key: 'create-event',
    label: 'Create a calendar event',
    emoji: '➕',
    description: 'Add an event with a title, date, and time',
    tool: 'calendar_create_event',
    defaultArgs: { title: '', date: '', time: '' },
    fields: [
      { name: 'title', label: 'Event', placeholder: 'Lunch with Mara' },
      { name: 'date', label: 'Date', placeholder: 'tomorrow · or 2026-06-15', optional: true },
      { name: 'time', label: 'Time', placeholder: '12:00 · or 2pm', optional: true },
    ],
  },
  {
    key: 'gmail-send',
    label: 'Send an email',
    emoji: '📧',
    description: 'Send an email through Gmail',
    tool: 'gmail_send_email',
    defaultArgs: { to: '', subject: '', body: '' },
    fields: [
      { name: 'to', label: 'To', placeholder: 'mara@example.com' },
      { name: 'subject', label: 'Subject', placeholder: 'Quick update', optional: true },
      { name: 'body', label: 'Message', placeholder: 'Hi Mara, just wanted to…', multiline: true },
    ],
  },
  {
    key: 'gmail-inbox',
    label: 'Summarize my inbox',
    emoji: '📥',
    description: 'Pull recent unread emails',
    tool: 'gmail_summarize_inbox',
    defaultArgs: { query: '' },
    fields: [{ name: 'query', label: 'Gmail search (optional)', placeholder: 'is:unread', optional: true }],
  },
  {
    key: 'slack-send',
    label: 'Post to Slack',
    emoji: '💬',
    description: 'Send a message to a channel',
    tool: 'slack_send_message',
    defaultArgs: { channel: '', text: '' },
    fields: [
      { name: 'channel', label: 'Channel', placeholder: '#general' },
      { name: 'text', label: 'Message', placeholder: 'Heads up team…', multiline: true },
    ],
  },
  {
    key: 'spotify-play',
    label: 'Play on Spotify',
    emoji: '🎵',
    description: 'Start a track or playlist',
    tool: 'spotify_play',
    defaultArgs: { query: '' },
    fields: [{ name: 'query', label: 'What to play', placeholder: 'Lo-fi focus playlist' }],
  },
  {
    key: 'remember',
    label: 'Remember a note',
    emoji: '📝',
    description: 'Save a fact to long-term memory',
    tool: 'remember',
    defaultArgs: { note: '' },
    fields: [{ name: 'note', label: 'Note to remember', placeholder: 'Standup is at 9am' }],
  },
  {
    // The "smart node": runs an LLM prompt mid-flow. Its `input` can template a
    // prior step's output via {{steps.<id>.output}}; the runner resolves that
    // before the tool runs, so the model sees the real upstream text.
    key: 'ai-step',
    label: 'AI smart step',
    emoji: '🧠',
    description: 'Let Pip think — summarize, decide, or draft from earlier steps',
    tool: 'ai_step',
    defaultArgs: { prompt: '', input: '' },
    fields: [
      { name: 'prompt', label: 'What should Pip do?', placeholder: 'Summarize the inbox into 3 bullets', multiline: true },
      { name: 'input', label: 'Input (optional — use {{steps.0.output}})', placeholder: '{{steps.0.output}}', optional: true, multiline: true },
    ],
  },
];

/** Allow-list of tools a saved flow step may use. Excludes `create_flow`. */
export const CATALOG_TOOL_NAMES = new Set(FLOW_CATALOG.map((n) => n.tool));

/** Compact, model-facing description of the catalog for tool/system prompts. */
export function catalogForPrompt(): string {
  return FLOW_CATALOG.map((n) => {
    const args = n.fields?.length
      ? ` args: ${n.fields.map((f) => `${f.name}${f.optional ? '?' : ''}`).join(', ')}`
      : Object.keys(n.defaultArgs).length
        ? ` args: ${Object.keys(n.defaultArgs).join(', ')}`
        : ' (no args)';
    return `- ${n.tool}: ${n.description}.${args}`;
  }).join('\n');
}
