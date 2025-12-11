// ArmPal Service Worker for Push Notifications + Click Actions

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};

  const title = data.title || "New Message";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png", // optional: adjust if your icons differ
    badge: "/icons/icon-72.png",
    data: {
      from_id: data.from_id,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// When user clicks notification → open correct chat
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const fromId = event.notification.data?.from_id;

  if (fromId) {
    event.waitUntil(
      clients.openWindow(`/chat/${fromId}`)
    );
  } else {
    event.waitUntil(clients.openWindow("/"));
  }
});
