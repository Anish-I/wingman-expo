import { Composio } from '@composio/core';
import type { ToolDefinition, ToolCall } from '../llm/types.js';

/**
 * Composio adapter. Wires Composio's hosted tools into our registry.
 *
 * NOTE: real activation requires per-toolkit `authConfigId`s created in the
 * Composio dashboard (see https://docs.composio.dev). Until those are set we
 * stay quiet and `listTools()` returns []. Built-in tools cover the demo path.
 */

export type ComposioRuntime = {
  enabled: boolean;
  listTools(userId: string, toolkits?: string[]): Promise<{ definition: ToolDefinition; slug: string; toolkit: string }[]>;
  execute(userId: string, call: ToolCall): Promise<string>;
  initiateConnection(userId: string, toolkit: string, callbackUrl: string): Promise<{ url: string | null; connectionId: string | null }>;
};

export function createComposioRuntime(env: { COMPOSIO_API_KEY?: string; COMPOSIO_AUTH_CONFIGS?: string }): ComposioRuntime {
  const apiKey = env.COMPOSIO_API_KEY?.trim();
  const authConfigs = parseAuthConfigs(env.COMPOSIO_AUTH_CONFIGS);
  const enabled = Boolean(apiKey);
  if (!enabled) {
    return {
      enabled: false,
      async listTools() { return []; },
      async execute() { throw new Error('Composio is not configured. Set COMPOSIO_API_KEY in server/.env.'); },
      async initiateConnection() { return { url: null, connectionId: null }; },
    };
  }

  const composio = new Composio({ apiKey });

  return {
    enabled: true,
    async listTools(userId, toolkits) {
      const slugs = (toolkits ?? Object.keys(authConfigs)).filter(Boolean);
      if (slugs.length === 0) return [];
      const items: { definition: ToolDefinition; slug: string; toolkit: string }[] = [];
      for (const toolkit of slugs) {
        try {
          const result = await composio.tools.get(String(userId), { toolkits: [toolkit] });
          const list = Array.isArray(result) ? result : (result as any)?.items ?? [];
          for (const tool of list) {
            const def = toOpenAIShape(tool);
            if (def) items.push({ definition: def, slug: def.name, toolkit });
          }
        } catch (err) {
          console.warn(`[composio] toolkit ${toolkit} failed:`, (err as Error).message);
        }
      }
      return items;
    },
    async execute(userId, call) {
      const result = await (composio as any).provider.executeToolCall(String(userId), {
        id: call.id,
        type: 'function',
        function: { name: call.name, arguments: JSON.stringify(call.arguments) },
      });
      return typeof result === 'string' ? result : JSON.stringify(result);
    },
    async initiateConnection(userId, toolkit, callbackUrl) {
      const authConfigId = authConfigs[toolkit];
      if (!authConfigId) {
        return { url: null, connectionId: null };
      }
      try {
        // `link` is the supported path for Composio-managed OAuth auth configs
        // (the older `initiate` endpoint was retired for managed auth). It returns
        // a ConnectionRequest whose redirectUrl is the provider's consent screen.
        const request = await composio.connectedAccounts.link(String(userId), authConfigId, { callbackUrl });
        return {
          url: (request as any).redirectUrl ?? (request as any).url ?? null,
          connectionId: (request as any).id ?? (request as any).connectedAccountId ?? null,
        };
      } catch (err) {
        console.warn(`[composio] link ${toolkit} failed:`, (err as Error).message);
        return { url: null, connectionId: null };
      }
    },
  };
}

function parseAuthConfigs(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const [k, v] = pair.split('=').map((s) => s.trim());
    if (k && v) out[k.toLowerCase()] = v;
  }
  return out;
}

function toOpenAIShape(tool: any): ToolDefinition | null {
  // Composio's `Tool` has snake_case input_parameters in OpenAI tool-call shape already
  // when fetched via the default OpenAI provider. We normalize to our internal shape.
  if (tool?.function?.name) {
    return {
      name: tool.function.name,
      description: tool.function.description ?? '',
      parameters: tool.function.parameters ?? { type: 'object', properties: {} },
    };
  }
  if (typeof tool?.name === 'string') {
    return {
      name: tool.name,
      description: tool.description ?? '',
      parameters: tool.inputParameters ?? tool.parameters ?? { type: 'object', properties: {} },
    };
  }
  return null;
}
