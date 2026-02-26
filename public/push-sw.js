// Push-only service worker — must NEVER control the app.
// Scoped to /push/ so it cannot intercept navigation or compete with the main PWA SW.

self.addEventListener("install", () => {
  // Do NOT call self.skipWaiting() — let the main SW own the app lifecycle
});

self.addEventListener("activate", () => {
  // Do NOT call self.clients.claim() — this SW must not control pages
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "New message", body: "You got a message" };
  }

  const title = data.title || "ArmPal";
  const options = {
    body: data.body || "New notification",
    icon: "/pwa-512x512.png",
    badge: "/pwa-512x512.png",
    data: { link: data.link || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(link);
          return;
        }
      }
      return clients.openWindow(link);
    })
  );
});
