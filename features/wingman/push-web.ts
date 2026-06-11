import { Platform } from 'react-native';

import { fetchVapidKey, subscribePush, unsubscribePush } from '@/features/wingman/api';

/**
 * Web Push registration (browser only). Wires the page to the service worker at
 * /sw.js, asks for notification permission, creates a VAPID push subscription,
 * and registers it with the server so flow runs can reach this browser.
 *
 * Native (iOS/Android) push uses Expo push tokens and a dev-client build; this
 * module is a no-op there (isWebPushSupported() returns false).
 *
 * DOM globals are accessed through a loose cast because the project's TS lib does
 * not include the DOM typings — guarded by isWebPushSupported() at every entry.
 */

type AnyGlobal = any;

export function isWebPushSupported(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const w = window as AnyGlobal;
  return Boolean(w.navigator?.serviceWorker && w.PushManager && w.Notification);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const w = window as AnyGlobal;
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = w.atob(base64) as string;
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration(): Promise<AnyGlobal> {
  const nav = (window as AnyGlobal).navigator;
  const existing = await nav.serviceWorker.getRegistration('/sw.js');
  if (existing) return existing;
  return nav.serviceWorker.register('/sw.js');
}

export type WebPushResult = { ok: boolean; reason?: 'unsupported' | 'denied' | 'no-key' | 'error' };

export async function enableWebPush(token: string): Promise<WebPushResult> {
  if (!isWebPushSupported()) return { ok: false, reason: 'unsupported' };
  const w = window as AnyGlobal;
  try {
    const permission = await w.Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    const { key } = await fetchVapidKey();
    if (!key) return { ok: false, reason: 'no-key' };

    const reg = await getRegistration();
    await w.navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    await subscribePush(token, {
      platform: 'web',
      endpoint: json.endpoint,
      keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function disableWebPush(token: string): Promise<void> {
  if (!isWebPushSupported()) return;
  const w = window as AnyGlobal;
  try {
    const reg = await w.navigator.serviceWorker.getRegistration('/sw.js');
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const { endpoint } = sub;
    await sub.unsubscribe().catch(() => {});
    await unsubscribePush(token, { endpoint });
  } catch {
    // best-effort
  }
}

/** Current browser permission state, or 'unsupported' off-web. */
export function webPushPermission(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (!isWebPushSupported()) return 'unsupported';
  return (window as AnyGlobal).Notification.permission;
}
