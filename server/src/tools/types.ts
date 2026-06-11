import type { PgStore } from '../store.js';
import type { LLMProvider, ToolDefinition } from '../llm/types.js';
import type { ComposioRuntime } from './composio.js';

export type ToolContext = {
  userId: string;
  store: PgStore;
  /** Composio runtime, present when a request wired it in. Built-in tools that
   *  drive a real third-party app (Gmail/Slack/Spotify) read this; it's optional
   *  so non-Composio code paths and tests can build a context without it. */
  composio?: ComposioRuntime;
  /** LLM provider, present on any path that may execute an `ai_step` (smart node):
   *  chat, manual flow run, and the scheduler. Optional so tests/non-LLM paths can
   *  build a context without it; `ai_step` errors clearly if it's missing. */
  llm?: LLMProvider;
};

export type ToolMeta =
  | { kind: 'connection_required'; appSlug: string; oauthUrl?: string | null }
  | { kind: 'calendar_event_created'; eventId: string; title: string; startIso: string }
  | { kind: 'briefing'; items: number }
  | { kind: 'memory_saved'; note: string }
  | { kind: 'app_action'; appSlug: string; action: string }
  | { kind: 'composio_result'; appSlug: string; tool: string }
  | { kind: 'flow_created'; flowId: string; title: string };

export type ToolResult = {
  output: string;
  meta?: ToolMeta;
};

export interface ServerTool {
  definition: ToolDefinition;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}
