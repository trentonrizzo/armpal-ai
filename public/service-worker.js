<<<<<<< HEAD
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open("armpal-cache-v1").then(cache => {
      return cache.addAll([
        "/",
        "/index.html",
        "/pwa-192x192.png",
        "/pwa-512x512.png"
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(resp => {
      return resp || fetch(event.request);
=======
// service-worker.js
const CACHE_NAME = "armpal-cache-v1";
const urlsToCache = ["/", "/index.html", "/manifest.json"];

// Install event: cache important files
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Activate event: clear old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});

// Fetch event: serve cached files when offline
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return (
        response ||
        fetch(event.request).catch(() =>
          caches.match("/index.html")
        )
      );
>>>>>>> 95603c70bcd9d0cd6cd4173f5a0222830ab18d40
    })
  );
});
