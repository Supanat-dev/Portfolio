// Retirement script for browsers that registered the previous notification worker.
self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const subscription = await self.registration.pushManager?.getSubscription();
      if (subscription) await subscription.unsubscribe();
    } catch { /* The server no longer sends notifications. */ }
    try {
      const notifications = await self.registration.getNotifications();
      notifications.forEach((notification) => notification.close());
    } catch { /* Unregister even when closing notifications is unsupported. */ }
    await self.registration.unregister();
  })());
});
