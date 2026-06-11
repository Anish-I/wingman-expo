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

/** The hour-of-day (0–23) at `now` in the given IANA timezone. Falls back to the
 *  server's local hour when no zone is given or the zone is invalid. */
function hourInZone(now: Date, timeZone?: string): number {
  if (!timeZone) return now.getHours();
  try {
    const parts = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone }).formatToParts(now);
    const raw = parts.find((p) => p.type === 'hour')?.value;
    const h = raw ? parseInt(raw, 10) : now.getHours();
    return h === 24 ? 0 : h; // some platforms render midnight as 24
  } catch {
    return now.getHours();
  }
}

/**
 * Is `now` inside the user's quiet-hours window? Windows like "10pm - 7am" wrap
 * past midnight. "Off" (or anything unparseable) means never quiet. Evaluated in
 * the user's `timeZone` when provided, else the server's local time.
 */
export function isQuietNow(quietHours: string, now: Date = new Date(), timeZone?: string): boolean {
  if (!quietHours || quietHours.trim().toLowerCase() === 'off') return false;
  const parts = quietHours.split('-').map((s) => s.trim());
  if (parts.length !== 2) return false;
  const start = parseHour(parts[0]!);
  const end = parseHour(parts[1]!);
  if (start == null || end == null || start === end) return false;
  const h = hourInZone(now, timeZone);
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

  async function sendExpo(token: string, message: PushMessage, store: PgStore) {
    try {
      const res = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: token,
          title: message.title,
          body: message.body,
          data: message.url ? { url: message.url } : {},
        }),
      });
      // Expo replies with a per-message ticket. A DeviceNotRegistered error means
      // the app was uninstalled / token rotated — drop it so we stop trying.
      const json = (await res.json().catch(() => null)) as
        | { data?: { status?: string; details?: { error?: string } } }
        | null;
      if (json?.data?.status === 'error' && json.data.details?.error === 'DeviceNotRegistered') {
        await store.removePushExpoToken(token).catch(() => {});
      }
    } catch {
      // Best-effort; a transient Expo error shouldn't break the caller.
    }
  }

  async function notify(store: PgStore, userId: string, message: PushMessage): Promise<void> {
    const settings = await store.getSettings(userId);
    if (!settings.pushEnabled) return;
    if (isQuietNow(settings.quietHours, new Date(), settings.timezone || undefined)) return;

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
        if (t.expoToken) return sendExpo(t.expoToken, message, store);
        return Promise.resolve();
      }),
    );
  }

  return { enabled, vapidPublicKey: publicKey ?? null, notify };
}
