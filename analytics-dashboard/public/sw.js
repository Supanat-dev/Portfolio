// No fetch handler or offline cache: tokens and visitor records stay out of caches.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { /* Always display a visible notification. */ }
  event.waitUntil(self.registration.showNotification(data.title || 'Portfolio Pulse', {
    body: data.body || 'มีการเข้าชมใหม่ เปิด Dashboard เพื่อดูรายละเอียด',
    icon: '/icon.svg', badge: '/icon.svg', tag: data.tag || 'portfolio-visit',
    data: { url: data.url || '/' },
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL(event.notification.data?.url || '/', self.location.origin);
    if (target.origin !== self.location.origin) return;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === target.origin && 'focus' in client) {
        await client.navigate(target.href);
        return client.focus();
      }
    }
    return self.clients.openWindow(target.href);
  })());
});
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
