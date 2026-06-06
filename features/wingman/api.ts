import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import type {
  ActivityEvent,
  AppIntegration,
  AuthSession,
  Briefing,
  DemoAuthCredentials,
  FlowDetail,
  FlowItem,
  FlowRunResult,
  FlowUpdateInput,
  UiCritiqueReport,
} from '@/features/wingman/data';

function getApiBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const expoConfig = Constants.expoConfig as { hostUri?: string } | null;
  const metroHost = expoConfig?.hostUri?.split(':')[0];
  if (Platform.OS !== 'web' && metroHost) {
    return `http://${metroHost}:3002`;
  }

  return 'http://localhost:3002';
}

const API_BASE_URL = getApiBaseUrl();
const REQUEST_TIMEOUT_MS = 4500;

type RequestOptions = {
  method?: string;
  token?: string | null;
  body?: unknown;
};

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutError = new Error('Request timed out. Check that the Wingman server is running.');
  let didTimeout = false;
  const timeout = setTimeout(() => {
    didTimeout = true;
    controller.abort(timeoutError);
  }, REQUEST_TIMEOUT_MS);

  // Only advertise a JSON body when we actually send one. Fastify rejects an
  // empty body when Content-Type is application/json (FST_ERR_CTP_EMPTY_JSON_BODY),
  // which would otherwise break body-less POSTs like /flows/:id/run and /chat/clear.
  const hasBody = options.body !== undefined && options.body !== null;
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (didTimeout || controller.signal.aborted) {
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'Request failed.');
  }
  return payload as T;
}

export async function demoCreateAccount(credentials: DemoAuthCredentials & { name: string }) {
  return requestJson<{ session: AuthSession }>('/auth/demo/create', {
    method: 'POST',
    body: credentials,
  });
}

export async function demoLogin(credentials: DemoAuthCredentials) {
  return requestJson<{ session: AuthSession }>('/auth/demo/login', {
    method: 'POST',
    body: credentials,
  });
}

export async function fetchMe(token: string) {
  return requestJson<{ user: AuthSession['user'] }>('/me', { token });
}

export async function fetchApps(token: string) {
  return requestJson<{ totalAvailable: number; items: AppIntegration[] }>('/apps', { token });
}

export async function beginAppConnection(token: string, app: string) {
  const { initiateUrl } = await requestJson<{ connectToken: string; initiateUrl: string }>('/connect/create-connect-token', {
    method: 'POST',
    token,
    body: { app },
  });

  if (typeof window !== 'undefined') {
    window.location.assign(initiateUrl);
    return;
  }

  await Linking.openURL(initiateUrl);
}

export async function fetchBriefing(token: string) {
  return requestJson<Briefing>('/briefing/today', { token });
}

export async function fetchActivity(token: string) {
  return requestJson<{ items: ActivityEvent[] }>('/activity', { token });
}

export async function fetchFlows(token: string) {
  return requestJson<{ items: FlowItem[] }>('/flows', { token });
}

export async function patchFlow(token: string, flowId: string, active: boolean) {
  return requestJson<{ flow: FlowItem }>(`/flows/${flowId}`, {
    method: 'PATCH',
    token,
    body: { active },
  });
}

export async function createFlow(token: string) {
  return requestJson<{ flow: FlowItem }>('/flows', {
    method: 'POST',
    token,
    body: {},
  });
}

export async function fetchFlow(token: string, flowId: string) {
  return requestJson<{ flow: FlowDetail }>(`/flows/${flowId}`, { token });
}

export async function updateFlow(token: string, flowId: string, input: FlowUpdateInput) {
  return requestJson<{ flow: FlowItem }>(`/flows/${flowId}`, {
    method: 'PUT',
    token,
    body: input,
  });
}

export async function runFlow(token: string, flowId: string) {
  return requestJson<{ result: FlowRunResult }>(`/flows/${flowId}/run`, {
    method: 'POST',
    token,
  });
}

export async function sendChat(token: string, message: string) {
  return requestJson<{
    assistantMessage: string;
    action: {
      type: string;
      appSlug: string | null;
      toolName: string | null;
      oauthUrl?: string | null;
    };
  }>('/chat', {
    method: 'POST',
    token,
    body: { message },
  });
}

export type ChatStreamEvent =
  | { type: 'token'; text: string }
  | { type: 'tool_call'; call: { id: string; name: string; arguments: Record<string, unknown> } }
  | {
      type: 'tool_result';
      toolCallId: string;
      name: string;
      output: string;
      error?: string;
      meta?: { kind: string; appSlug?: string; oauthUrl?: string | null; eventId?: string; title?: string; startIso?: string };
    }
  | { type: 'final'; content: string }
  | { type: 'error'; message: string };

async function* fallbackBufferedChat(token: string, message: string): AsyncGenerator<ChatStreamEvent, void, void> {
  const result = await sendChat(token, message);
  if (result.assistantMessage) {
    yield { type: 'token', text: result.assistantMessage };
  }
  if (result.action?.type === 'connection_required' && result.action.appSlug) {
    yield {
      type: 'tool_result',
      toolCallId: 'fallback',
      name: 'create_app_connection',
      output: result.assistantMessage ?? '',
      meta: { kind: 'connection_required', appSlug: result.action.appSlug, oauthUrl: result.action.oauthUrl ?? null },
    };
  }
  yield { type: 'final', content: result.assistantMessage ?? '' };
}

export async function* sendChatStream(token: string, message: string): AsyncGenerator<ChatStreamEvent, void, void> {
  // React Native fetch (Expo Go on iOS/Android) doesn't expose a readable response.body
  // with a .getReader(), so SSE chunked reads silently fail. Use the buffered endpoint there.
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    yield* fallbackBufferedChat(token, message);
    return;
  }
  const response = await fetch(`${API_BASE_URL}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Unauthorized');
    const text = await response.text().catch(() => '');
    throw new Error(text || 'Chat stream failed.');
  }
  if (!response.body || typeof (response.body as ReadableStream<Uint8Array>).getReader !== 'function') {
    // Streaming reader not supported (e.g. Expo Go's RN fetch). Fall back to buffered /chat.
    yield* fallbackBufferedChat(token, message);
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separatorIdx = buffer.indexOf('\n\n');
    while (separatorIdx !== -1) {
      const rawEvent = buffer.slice(0, separatorIdx);
      buffer = buffer.slice(separatorIdx + 2);
      separatorIdx = buffer.indexOf('\n\n');
      const lines = rawEvent.split('\n');
      let payload = '';
      let eventName = 'message';
      for (const line of lines) {
        if (line.startsWith('data:')) payload += line.slice(5).trim();
        else if (line.startsWith('event:')) eventName = line.slice(6).trim();
      }
      if (!payload) continue;
      if (eventName === 'done') return;
      try {
        const parsed = JSON.parse(payload) as ChatStreamEvent;
        yield parsed;
      } catch {
        // ignore unparsable chunk
      }
    }
  }
}

export async function clearChat(token: string) {
  return requestJson<{ ok: boolean }>('/chat/clear', { method: 'POST', token });
}

export async function deleteAccount(token: string) {
  const response = await fetch(`${API_BASE_URL}/me`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 204) {
    throw new Error('Failed to delete account.');
  }
}

export async function runUiCritique(
  token: string,
  payload: {
    screenId: string;
    theme: string;
    viewport: { width: number; height: number };
  },
) {
  return requestJson<UiCritiqueReport>('/dev/ui-critique', {
    method: 'POST',
    token,
    body: payload,
  });
}
