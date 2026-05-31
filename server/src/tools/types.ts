import type { SqliteStore } from '../store.js';
import type { ToolDefinition } from '../llm/types.js';

export type ToolContext = {
  userId: string;
  store: SqliteStore;
};

export type ToolMeta =
  | { kind: 'connection_required'; appSlug: string; oauthUrl?: string | null }
  | { kind: 'calendar_event_created'; eventId: string; title: string; startIso: string }
  | { kind: 'briefing'; items: number }
  | { kind: 'memory_saved'; note: string }
  | { kind: 'composio_result'; appSlug: string; tool: string };

export type ToolResult = {
  output: string;
  meta?: ToolMeta;
};

export interface ServerTool {
  definition: ToolDefinition;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}
