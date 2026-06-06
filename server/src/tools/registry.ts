import type { ToolDefinition, ToolCall } from '../llm/types.js';
import type { ToolContext, ToolResult } from './types.js';
import { builtinTools } from './builtin.js';
import type { ComposioRuntime } from './composio.js';

export type Registry = {
  definitions: ToolDefinition[];
  dispatch(call: ToolCall, ctx: ToolContext): Promise<ToolResult>;
};

/** Hard cap on Composio tools exposed to the model per turn (Codex guardrail: avoid tool explosion). */
export const MAX_COMPOSIO_TOOLS = 25;
const CACHE_TTL_MS = 5 * 60 * 1000;

type CachedTools = { defs: { definition: ToolDefinition; slug: string; toolkit: string }[]; expires: number };
const toolCache = new Map<string, CachedTools>();

/** Lightweight intent → toolkit keyword hints. Used only to narrow an already-connected set. */
const TOOLKIT_KEYWORDS: Record<string, string[]> = {
  gmail: ['email', 'mail', 'inbox', 'gmail', 'send a message', 'reply'],
  googlecalendar: ['calendar', 'event', 'meeting', 'schedule', 'availability', 'invite'],
  slack: ['slack', 'channel', 'dm', 'message the team', 'post to'],
  notion: ['notion', 'note', 'page', 'doc', 'database'],
  linear: ['linear', 'issue', 'ticket', 'bug', 'sprint'],
  github: ['github', 'repo', 'pull request', 'pr', 'commit', 'issue'],
  spotify: ['spotify', 'song', 'music', 'playlist', 'play'],
  dropbox: ['dropbox', 'file', 'folder', 'upload'],
};

function selectToolkits(connected: string[], message?: string): string[] {
  if (!message) return connected;
  const lower = message.toLowerCase();
  const matched = connected.filter((tk) => (TOOLKIT_KEYWORDS[tk] ?? []).some((kw) => lower.includes(kw)));
  // Fall back to all connected toolkits when the message doesn't clearly map to one.
  return matched.length ? matched : connected;
}

async function loadComposioTools(composio: ComposioRuntime, userId: string, toolkit: string) {
  const key = `${userId}:${toolkit}`;
  const hit = toolCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.defs;
  const defs = await composio.listTools(userId, [toolkit]);
  toolCache.set(key, { defs, expires: Date.now() + CACHE_TTL_MS });
  return defs;
}

export async function buildRegistry(opts: {
  ctx: ToolContext;
  composio: ComposioRuntime;
  message?: string;
}): Promise<Registry> {
  const { ctx, composio, message } = opts;

  let composioTools: { definition: ToolDefinition; slug: string; toolkit: string }[] = [];
  if (composio.enabled) {
    const connected = (await ctx.store.getApps(ctx.userId)).filter((a) => a.connected).map((a) => a.slug);
    const toolkits = selectToolkits(connected, message);
    for (const toolkit of toolkits) {
      if (composioTools.length >= MAX_COMPOSIO_TOOLS) break;
      const defs = await loadComposioTools(composio, ctx.userId, toolkit);
      composioTools.push(...defs);
    }
    composioTools = composioTools.slice(0, MAX_COMPOSIO_TOOLS);
  }

  const composioByName = new Map(composioTools.map((t) => [t.definition.name, t]));

  const definitions: ToolDefinition[] = [
    ...Object.values(builtinTools).map((t) => t.definition),
    ...composioTools.map((t) => t.definition),
  ];

  return {
    definitions,
    async dispatch(call, dispatchCtx): Promise<ToolResult> {
      const builtin = builtinTools[call.name];
      if (builtin) {
        return builtin.execute(call.arguments, dispatchCtx);
      }
      const composioTool = composioByName.get(call.name);
      if (composioTool) {
        const output = await composio.execute(dispatchCtx.userId, call);
        return { output, meta: { kind: 'composio_result', appSlug: composioTool.toolkit, tool: call.name } };
      }
      return { output: `Unknown tool: ${call.name}` };
    },
  };
}
