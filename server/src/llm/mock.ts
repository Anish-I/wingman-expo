import type { LLMProvider, LLMRequest, LLMStreamChunk, ToolCall } from './types.js';
import { nanoid } from 'nanoid';

function* tokenize(text: string): Iterable<string> {
  const parts = text.match(/(\s+|\S+)/g) ?? [text];
  for (const part of parts) yield part;
}

function pickCalendarReadIntent(message: string): boolean {
  const m = message.toLowerCase();
  return /(today|tomorrow|schedule|calendar|meetings?)/.test(m) && !/(schedule\s+(a|an)|book|create)/.test(m);
}

function pickCalendarCreateIntent(message: string): boolean {
  const m = message.toLowerCase();
  return /(book|schedule\s+(a|an)|set\s+up|create.+(meeting|event|lunch))/.test(m);
}

function pickBriefingIntent(message: string): boolean {
  const m = message.toLowerCase();
  return /(brief|morning|recap|catch\s+me\s+up)/.test(m);
}

export function createMockProvider(): LLMProvider {
  return {
    id: 'mock',
    async *stream(req: LLMRequest): AsyncIterable<LLMStreamChunk> {
      const lastUser = [...req.messages].reverse().find((m) => m.role === 'user');
      const userText = lastUser && 'content' in lastUser ? lastUser.content : 'hello';

      const sawToolMessage = req.messages.some((m) => m.role === 'tool');
      const availableToolNames = new Set((req.tools ?? []).map((t) => t.name));

      if (!sawToolMessage) {
        let toolName: string | null = null;
        let args: Record<string, unknown> = {};
        if (availableToolNames.has('calendar_read_today') && pickCalendarReadIntent(userText)) {
          toolName = 'calendar_read_today';
          args = { offset: userText.toLowerCase().includes('tomorrow') ? 1 : 0 };
        } else if (availableToolNames.has('calendar_create_event') && pickCalendarCreateIntent(userText)) {
          toolName = 'calendar_create_event';
          args = { intent: userText };
        } else if (availableToolNames.has('briefing_today') && pickBriefingIntent(userText)) {
          toolName = 'briefing_today';
          args = {};
        }

        if (toolName) {
          const call: ToolCall = { id: `call_${nanoid(8)}`, name: toolName, arguments: args };
          yield { type: 'tool_call', call };
          yield { type: 'finish', reason: 'tool_calls', full: { content: '', toolCalls: [call] } };
          return;
        }
      }

      const reply = sawToolMessage
        ? 'Done — anything else I can wrap up?'
        : `Coo! I heard you say "${userText.slice(0, 80)}". I'll learn more once Anish drops in an OPENAI_API_KEY.`;

      let buffer = '';
      for (const token of tokenize(reply)) {
        buffer += token;
        yield { type: 'content_delta', delta: token };
        await new Promise((r) => setTimeout(r, 20));
      }
      yield { type: 'finish', reason: 'stop', full: { content: buffer } };
    },
  };
}
