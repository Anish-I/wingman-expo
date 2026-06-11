import OpenAI from 'openai';
import type { LLMProvider, LLMRequest, LLMStreamChunk, ToolCall, ChatMessage } from './types.js';

function toOpenAIMessages(messages: ChatMessage[]) {
  return messages.map((m): OpenAI.Chat.Completions.ChatCompletionMessageParam => {
    if (m.role === 'user') return { role: 'user', content: m.content };
    if (m.role === 'system') return { role: 'system', content: m.content };
    if (m.role === 'assistant') {
      const base: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam = {
        role: 'assistant',
        content: m.content || null,
      };
      if (m.toolCalls?.length) {
        base.tool_calls = m.toolCalls.map((c) => ({
          id: c.id,
          type: 'function' as const,
          function: { name: c.name, arguments: JSON.stringify(c.arguments) },
        }));
      }
      return base;
    }
    return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
  });
}

// Works for any OpenAI-compatible Chat Completions endpoint (OpenAI, DeepSeek, …).
export function createOpenAIProvider(params: { apiKey: string; model: string; baseURL?: string; id?: string }): LLMProvider {
  const client = new OpenAI({ apiKey: params.apiKey, baseURL: params.baseURL });
  return {
    id: params.id ?? 'openai',
    async *stream(req: LLMRequest): AsyncIterable<LLMStreamChunk> {
      const tools: OpenAI.Chat.Completions.ChatCompletionTool[] | undefined = req.tools?.map((t) => ({
        type: 'function' as const,
        function: { name: t.name, description: t.description, parameters: t.parameters as Record<string, unknown> },
      }));

      const stream = await client.chat.completions.create({
        model: req.model ?? params.model,
        messages: toOpenAIMessages(req.messages),
        tools,
        tool_choice: tools && tools.length ? 'auto' : undefined,
        stream: true,
      });

      type PartialToolCall = { id?: string; name?: string; argsBuffer: string };
      const partials: Record<number, PartialToolCall> = {};
      let assembledContent = '';
      let finishReason: 'stop' | 'tool_calls' | 'length' | 'error' = 'stop';

      for await (const chunk of stream) {
        const choice = chunk.choices?.[0];
        if (!choice) continue;
        const delta = choice.delta;

        if (delta?.content) {
          assembledContent += delta.content;
          yield { type: 'content_delta', delta: delta.content };
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            const existing = partials[idx] ?? { argsBuffer: '' };
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name = tc.function.name;
            if (tc.function?.arguments) existing.argsBuffer += tc.function.arguments;
            partials[idx] = existing;
          }
        }

        if (choice.finish_reason) {
          finishReason =
            choice.finish_reason === 'tool_calls' ? 'tool_calls'
            : choice.finish_reason === 'length' ? 'length'
            : choice.finish_reason === 'stop' ? 'stop'
            : 'error';
        }
      }

      const completedCalls: ToolCall[] = Object.values(partials)
        .filter((p) => p.id && p.name)
        .map((p) => {
          let args: Record<string, unknown> = {};
          try { args = p.argsBuffer ? JSON.parse(p.argsBuffer) : {}; } catch { args = { _raw: p.argsBuffer }; }
          return { id: p.id!, name: p.name!, arguments: args };
        });

      for (const call of completedCalls) {
        yield { type: 'tool_call', call };
      }

      yield {
        type: 'finish',
        reason: completedCalls.length ? 'tool_calls' : finishReason,
        full: { content: assembledContent, toolCalls: completedCalls.length ? completedCalls : undefined },
      };
    },
  };
}
