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

  // hijack() takes over the raw socket, which bypasses @fastify/cors's onSend
  // hook — so the Access-Control-Allow-Origin header it stages on the Fastify
  // reply never reaches the wire and the browser blocks the stream with a CORS
  // error. Re-apply the same reflect-the-origin policy (origin:true) directly on
  // the raw response. Auth is a Bearer token, not a cookie, so '*' would also
  // work, but reflecting keeps parity with the rest of the API.
  const origin = reply.request.headers.origin;
  if (origin) {
    reply.raw.setHeader('Access-Control-Allow-Origin', origin);
    reply.raw.setHeader('Vary', 'Origin');
  } else {
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
  }

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
