// ═══════════════════════════════════════════════════════════
//  Hany Tasks — Push Service Worker
//  يعمل في الخلفية ويستقبل إشعارات Web Push
// ═══════════════════════════════════════════════════════════

// استقبال حدث Push من السيرفر
self.addEventListener('push', function (event) {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = {
      title: '🔔 Hany Tasks',
      body: event.data.text(),
      url: '/',
    };
  }

  const options = {
    body:    data.body  || '',
    icon:    data.icon  || '/icons/icon-192x192.png',
    badge:   data.badge || '/icons/badge-72x72.png',
    tag:     data.tag   || 'hany-tasks',
    data:    { url: data.url || '/' },
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open',    title: 'فتح' },
      { action: 'dismiss', title: 'إغلاق' },
    ],
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '🔔 Hany Tasks', options)
  );
});

// لما المستخدم يضغط على الإشعار
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/';
  const fullUrl   = new URL(urlToOpen, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // لو التطبيق مفتوح — فوكس عليه وروح للصفحة المطلوبة
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(fullUrl);
          return;
        }
      }
      // لو مش مفتوح — افتح نافذة جديدة
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});

// إلغاء الإشعار بالنقر على زر إغلاق
self.addEventListener('notificationclose', function (_event) {
  // يمكن تتبع الإحصاءات هنا مستقبلاً
});
