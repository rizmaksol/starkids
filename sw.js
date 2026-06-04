// StarKids V10 — Service Worker DISABLED
// Caching caused too many issues during development
// Re-enable for production after testing is complete

self.addEventListener("install", e => {
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  // Clear ALL caches
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Pass all requests directly to network — no caching
self.addEventListener("fetch", e => {
  e.respondWith(fetch(e.request));
});
