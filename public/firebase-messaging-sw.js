// public/firebase-messaging-sw.js
// SW xử lý push notification khi app đóng / background

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAxcmuNkX1dXG7286rar0pCYBE29Xx8oDo",
  authDomain: "managerclass-3b6ed.firebaseapp.com",
  projectId: "managerclass-3b6ed",
  storageBucket: "managerclass-3b6ed.firebasestorage.app",
  messagingSenderId: "256973791670",
  appId: "1:256973791670:web:dda672ff9e810a723ce117"
});

const messaging = firebase.messaging();

// ===== Background message handler =====
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message:', payload);

  const notif = payload.notification || {};
  const data = payload.data || {};

  // Ưu tiên data (vì worker đã push cả 2)
  const title = notif.title || data.title || 'Thi Đua Lớp';
  const body = notif.body || data.body || 'Bạn có thông báo mới';
  const link = data.link || '/';
  const type = data.type || 'default';

  const options = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    tag: type,
    renotify: true,
    requireInteraction: false,
    data: {
      url: link,
      type,
      ...data
    }
  };

  return self.registration.showNotification(title, options);
});

// ===== Click handler =====
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientsArr) => {
        for (const client of clientsArr) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// ===== Nhận SKIP_WAITING =====
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});