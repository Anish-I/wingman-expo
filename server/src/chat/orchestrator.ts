import type { LLMProvider, ChatMessage, ChatEvent, ToolCall } from '../llm/types.js';
import type { Registry } from '../tools/registry.js';
import type { ToolContext } from '../tools/types.js';
import type { SSEWriter } from './sse.js';

const MAX_ITERATIONS = 6;

function buildSystemPrompt(ctx: ToolContext): string {
  const apps = ctx.store.getApps(ctx.userId);
  const connected = apps.filter((a) => a.connected).map((a) => a.name).join(', ') || 'none';
  const missing = apps.filter((a) => !a.connected).map((a) => a.name).join(', ') || 'none';
  return [
    "You are Pip, the Wingman assistant. Be warm, concise, and act on user requests by calling tools instead of explaining what you'd do.",
    "Prefer 1–2 sentence replies. Never hallucinate event details — read or create them through tools.",
    `Connected apps: ${connected}. Not yet connected: ${missing}.`,
    'If a tool returns connection_required, call create_app_connection({ app: <slug> }) and surface the resulting link to the user.',
    'When the user shares a durable fact, preference, routine, or person, call the remember tool to save it. Use the memory below to personalize your replies.',
    '',
    ctx.store.getMemoryContext(ctx.userId),
  ].join('\n');
}

export type OrchestratorParams = {
  provider: LLMProvider;
  registry: Registry;
  ctx: ToolContext;
  userMessage: string;
  writer: SSEWriter;
};

export async function runChatTurn(params: OrchestratorParams): Promise<void> {
  const { provider, registry, ctx, userMessage, writer } = params;

  ctx.store.appendHistory(ctx.userId, { role: 'user', content: userMessage });

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(ctx) },
    ...ctx.store.getHistory(ctx.userId),
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let assembled = '';
    const calls: ToolCall[] = [];
    let finishReason: 'stop' | 'tool_calls' | 'length' | 'error' = 'stop';

    try {
      for await (const chunk of provider.stream({ messages, tools: registry.definitions })) {
        if (chunk.type === 'content_delta') {
          assembled += chunk.delta;
          writer.send({ type: 'token', text: chunk.delta });
        } else if (chunk.type === 'tool_call') {
          calls.push(chunk.call);
          writer.send({ type: 'tool_call', call: chunk.call });
        } else if (chunk.type === 'finish') {
          finishReason = chunk.reason;
          if (chunk.full?.content) assembled = chunk.full.content;
          if (chunk.full?.toolCalls?.length) {
            for (const c of chunk.full.toolCalls) {
              if (!calls.find((existing) => existing.id === c.id)) {
                calls.push(c);
                writer.send({ type: 'tool_call', call: c });
              }
            }
          }
        }
      }
    } catch (err) {
      writer.send({ type: 'error', message: (err as Error).message });
      writer.close();
      return;
    }

    const assistantMessage: ChatMessage = { role: 'assistant', content: assembled, toolCalls: calls.length ? calls : undefined };
    ctx.store.appendHistory(ctx.userId, assistantMessage);
    messages.push(assistantMessage);

    if (!calls.length) {
      writer.send({ type: 'final', content: assembled });
      writer.close();
      return;
    }

    for (const call of calls) {
      try {
        const result = await registry.dispatch(call, ctx);
        const toolMessage: ChatMessage = { role: 'tool', toolCallId: call.id, name: call.name, content: result.output };
        ctx.store.appendHistory(ctx.userId, toolMessage);
        messages.push(toolMessage);
        const evt: ChatEvent = { type: 'tool_result', toolCallId: call.id, name: call.name, output: result.output };
        if (result.meta) (evt as unknown as { meta: unknown }).meta = result.meta;
        writer.send(evt);
      } catch (err) {
        const message = (err as Error).message;
        const toolMessage: ChatMessage = { role: 'tool', toolCallId: call.id, name: call.name, content: `Error: ${message}` };
        ctx.store.appendHistory(ctx.userId, toolMessage);
        messages.push(toolMessage);
        writer.send({ type: 'tool_result', toolCallId: call.id, name: call.name, output: '', error: message });
      }
    }

    if (finishReason !== 'tool_calls') {
      // Some providers don't set tool_calls finish reason explicitly. We loop anyway because calls > 0.
    }
  }

  writer.send({ type: 'final', content: 'Reached the tool-call limit for this turn. Try splitting the request.' });
  writer.close();
}
