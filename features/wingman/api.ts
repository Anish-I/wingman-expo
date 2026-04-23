import * as Linking from 'expo-linking';

import type {
  ActivityEvent,
  AppIntegration,
  AuthSession,
  Briefing,
  DemoAuthCredentials,
  FlowItem,
  UiCritiqueReport,
} from '@/features/wingman/data';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3002';

type RequestOptions = {
  method?: string;
  token?: string | null;
  body?: unknown;
};

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

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

export async function sendChat(token: string, message: string) {
  return requestJson<{
    assistantMessage: string;
    action: {
      type: string;
      appSlug: string | null;
      toolName: string | null;
    };
  }>('/chat', {
    method: 'POST',
    token,
    body: { message },
  });
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
