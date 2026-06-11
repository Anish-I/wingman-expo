import webpush from 'web-push';

import type { PgStore } from '../store.js';

/**
 * Push notifier — real delivery to a user's registered devices.
 *
 *  - Web browsers: Web Push (VAPID). The browser holds a subscription
 *    (endpoint + keys); we POST an encrypted payload to its push service.
 *  - Native builds: Expo push tokens, delivered via Expo's push API.
 *
 * Every send is gated by the user's own settings: `pushEnabled` (master switch)
 * and `quietHours` (a nightly window during which we stay silent). All targets
 * are read scoped to the owner, so a notification can only ever reach its user.
 */

export type PushMessage = {
  title: string;
  body: string;
  url?: string;
};

export type Notifier = {
  enabled: boolean;
  vapidPublicKey: string | null;
  notify: (store: PgStore, userId: string, message: PushMessage) => Promise<void>;
};

type NotifierEnv = {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

function parseHour(token: string): number | null {
  const m = token.trim().toLowerCase().match(/^(\d{1,2})\s*(am|pm)$/);
  if (!m) return null;
  const base = parseInt(m[1]!, 10) % 12;
  return m[2] === 'pm' ? base + 12 : base;
}

/**
 * Is `now` inside the user's quiet-hours window? Windows like "10pm - 7am" wrap
 * past midnight. "Off" (or anything unparseable) means never quiet. Evaluated in
 * the server's local time — a per-user timezone is a future refinement.
 */
export function isQuietNow(quietHours: string, now: Date = new Date()): boolean {
  if (!quietHours || quietHours.trim().toLowerCase() === 'off') return false;
  const parts = quietHours.split('-').map((s) => s.trim());
  if (parts.length !== 2) return false;
  const start = parseHour(parts[0]!);
  const end = parseHour(parts[1]!);
  if (start == null || end == null || start === end) return false;
  const h = now.getHours();
  return start < end ? h >= start && h < end : h >= start || h < end;
}

export function createNotifier(env: NotifierEnv): Notifier {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  const subject = env.VAPID_SUBJECT?.trim() || 'mailto:support@wingman.app';
  const webEnabled = Boolean(publicKey && privateKey);
  if (webEnabled) {
    webpush.setVapidDetails(subject, publicKey!, privateKey!);
  }

  // Native delivery (Expo) needs no server credentials, so it's always available.
  const enabled = true;

  async function sendWeb(target: { endpoint: string; p256dh: string; auth: string }, payload: string, store: PgStore) {
    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        payload,
      );
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      // 404/410 mean the browser unsubscribed — drop the dead endpoint.
      if (status === 404 || status === 410) {
        await store.removePushEndpoint(target.endpoint).catch(() => {});
      }
    }
  }

  async function sendExpo(token: string, message: PushMessage) {
    try {
      await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: token,
          title: message.title,
          body: message.body,
          data: message.url ? { url: message.url } : {},
        }),
      });
    } catch {
      // Best-effort; a transient Expo error shouldn't break the caller.
    }
  }

  async function notify(store: PgStore, userId: string, message: PushMessage): Promise<void> {
    const settings = await store.getSettings(userId);
    if (!settings.pushEnabled) return;
    if (isQuietNow(settings.quietHours)) return;

    const targets = await store.getPushSubscriptions(userId);
    if (targets.length === 0) return;

    const payload = JSON.stringify({ title: message.title, body: message.body, url: message.url ?? '/' });
    await Promise.all(
      targets.map((t) => {
        if (t.platform === 'web') {
          if (webEnabled && t.endpoint && t.p256dh && t.auth) {
            return sendWeb({ endpoint: t.endpoint, p256dh: t.p256dh, auth: t.auth }, payload, store);
          }
          return Promise.resolve();
        }
        if (t.expoToken) return sendExpo(t.expoToken, message);
        return Promise.resolve();
      }),
    );
  }

  return { enabled, vapidPublicKey: publicKey ?? null, notify };
}
