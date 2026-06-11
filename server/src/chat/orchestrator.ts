import type { LLMProvider, ChatMessage, ChatEvent, ToolCall } from '../llm/types.js';
import type { Registry } from '../tools/registry.js';
import type { ToolContext } from '../tools/types.js';
import type { SSEWriter } from './sse.js';

const MAX_ITERATIONS = 6;

async function buildSystemPrompt(ctx: ToolContext): Promise<string> {
  const [apps, user, settings] = await Promise.all([
    ctx.store.getApps(ctx.userId),
    ctx.store.getUserById(ctx.userId),
    ctx.store.getSettings(ctx.userId),
  ]);
  const connected = apps.filter((a) => a.connected).map((a) => a.name).join(', ') || 'none';
  const missing = apps.filter((a) => !a.connected).map((a) => a.name).join(', ') || 'none';
  // Give Pip the user's name + real "now" so it can address them and reason about
  // "today"/"tomorrow"/"in 2 hours" instead of guessing.
  const tz = settings.timezone || 'UTC';
  const localNow = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date());
  const lines = [
    "You are Pip, the Wingman assistant. Be warm, concise, and act on user requests by calling tools instead of explaining what you'd do.",
    "Prefer 1–2 sentence replies. Never hallucinate event details — read or create them through tools.",
    `You're helping ${user?.name || 'the user'}. Their current local time is ${localNow} (${tz}) — use it for any date/time reasoning like "today", "tomorrow", or "in 2 hours".`,
    `Connected apps: ${connected}. Not yet connected: ${missing}.`,
    'If a tool returns connection_required, call create_app_connection({ app: <slug> }) and surface the resulting link to the user.',
  ];
  // Memory toggle (Settings → Privacy → Memory) genuinely gates Pip's long-term
  // memory. When off, we neither inject what we know nor invite the remember tool.
  if (settings.memoryEnabled) {
    lines.push(
      'When the user shares a durable fact, preference, routine, or person, call the remember tool to save it. Use the memory below to personalize your replies.',
      '',
      await ctx.store.getMemoryContext(ctx.userId),
    );
  } else {
    lines.push('Memory is turned OFF for this user — do not call the remember tool, and rely only on the current conversation.');
  }
  return lines.join('\n');
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

  await ctx.store.appendHistory(ctx.userId, { role: 'user', content: userMessage });

  const messages: ChatMessage[] = [
    { role: 'system', content: await buildSystemPrompt(ctx) },
    ...(await ctx.store.getHistory(ctx.userId)),
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
    await ctx.store.appendHistory(ctx.userId, assistantMessage);
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
        await ctx.store.appendHistory(ctx.userId, toolMessage);
        messages.push(toolMessage);
        const evt: ChatEvent = { type: 'tool_result', toolCallId: call.id, name: call.name, output: result.output };
        if (result.meta) (evt as unknown as { meta: unknown }).meta = result.meta;
        writer.send(evt);
      } catch (err) {
        const message = (err as Error).message;
        const toolMessage: ChatMessage = { role: 'tool', toolCallId: call.id, name: call.name, content: `Error: ${message}` };
        await ctx.store.appendHistory(ctx.userId, toolMessage);
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
