import type { FastifyReply } from 'fastify';
import type { ChatEvent } from '../llm/types.js';

export type SSEWriter = {
  send(event: ChatEvent): void;
  close(): void;
};

export function openSSE(reply: FastifyReply): SSEWriter {
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('X-Accel-Buffering', 'no');
  reply.hijack();
  reply.raw.flushHeaders?.();

  let closed = false;
  reply.raw.on('close', () => {
    closed = true;
  });

  return {
    send(event) {
      if (closed) return;
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    },
    close() {
      if (closed) return;
      reply.raw.write(`event: done\ndata: {}\n\n`);
      reply.raw.end();
      closed = true;
    },
  };
}
