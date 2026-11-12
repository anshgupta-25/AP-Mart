// Firebase Cloud Messaging service worker (background push).
// A service worker cannot read import.meta.env, so the public Firebase config
// is passed as query params by the registration call in the app.
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

const config = Object.fromEntries(new URL(self.location).searchParams);

if (config.apiKey && config.projectId && config.messagingSenderId) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    const title = payload.notification?.title || data.title || "AP Mart";
    self.registration.showNotification(title, {
      body: payload.notification?.body || data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data,
    });
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
