import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { subscribePush, unsubscribePush } from '@/features/wingman/api';

/**
 * Native (iOS/Android) push via Expo push tokens.
 *
 * Mirrors push-web.ts: request permission, obtain a token, register it with the
 * server so flow runs can reach this device. The server delivers through Expo's
 * push service (see server/src/push/notifier.ts). No-op on web.
 *
 * Requires a dev-client / standalone build (Expo Go can't receive remote push on
 * SDK 53+) and an EAS projectId in app config to mint the token.
 */

// How a notification behaves when it arrives while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function isNativePushSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function getProjectId(): string | undefined {
  const c = Constants as unknown as {
    expoConfig?: { extra?: { eas?: { projectId?: string } } };
    easConfig?: { projectId?: string };
  };
  return c.expoConfig?.extra?.eas?.projectId ?? c.easConfig?.projectId;
}

export type NativePushResult = {
  ok: boolean;
  reason?: 'unsupported' | 'no-device' | 'denied' | 'no-project' | 'error';
  token?: string;
};

// Cached so we can unsubscribe the exact token even if a later token fetch fails.
let lastToken: string | null = null;

export async function enableNativePush(authToken: string): Promise<NativePushResult> {
  if (!isNativePushSupported()) return { ok: false, reason: 'unsupported' };
  if (!Device.isDevice) return { ok: false, reason: 'no-device' };
  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return { ok: false, reason: 'denied' };

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId = getProjectId();
    if (!projectId) return { ok: false, reason: 'no-project' };

    const { data: expoToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    lastToken = expoToken;
    await subscribePush(authToken, {
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      expoToken,
    });
    return { ok: true, token: expoToken };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function disableNativePush(authToken: string): Promise<void> {
  if (!isNativePushSupported()) return;
  try {
    let token = lastToken;
    if (!token) {
      const projectId = getProjectId();
      if (projectId) token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    }
    if (token) await unsubscribePush(authToken, { expoToken: token });
  } catch {
    // best-effort
  }
}

/** Register a tap-to-navigate handler. Returns an unsubscribe function. */
export function addNotificationResponseListener(onNavigate: (url: string) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as { url?: unknown } | undefined;
    if (data && typeof data.url === 'string' && data.url) onNavigate(data.url);
  });
  return () => sub.remove();
}
