export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolCallId: string; name: string; content: string };

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type ChatEvent =
  | { type: 'token'; text: string }
  | { type: 'tool_call'; call: ToolCall }
  | { type: 'tool_result'; toolCallId: string; name: string; output: string; error?: string }
  | { type: 'final'; content: string }
  | { type: 'error'; message: string };

export type LLMRequest = {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  model?: string;
};

export type LLMStreamChunk =
  | { type: 'content_delta'; delta: string }
  | { type: 'tool_call'; call: ToolCall }
  | { type: 'finish'; reason: 'stop' | 'tool_calls' | 'length' | 'error'; full?: { content: string; toolCalls?: ToolCall[] } };

export interface LLMProvider {
  id: string;
  stream(req: LLMRequest): AsyncIterable<LLMStreamChunk>;
}
