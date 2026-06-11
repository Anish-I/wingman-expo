/* Wingman web-push service worker.
 * Receives encrypted Web Push messages and shows a notification; focuses/open
 * the app when the user taps it. Payload shape: { title, body, url }. */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = { title: 'Wingman', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Wingman';
  const options = {
    body: data.body || '',
    icon: '/icon.png',
    badge: '/icon.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    }),
  );
});
