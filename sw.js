// StarKids Service Worker v3 - Force update
const CACHE_NAME = 'starkids-v3';
const ASSETS = [
  '/starkids/',
  '/starkids/index.html',
  '/starkids/manifest.json',
  '/starkids/icon-192.png',
  '/starkids/icon-512.png'
];

// Install - cache fresh files
self.addEventListener('install', event => {
  self.skipWaiting(); // Take over immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(()=>{})
  );
});

// Activate - delete ALL old caches immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k))) // Delete ALL caches
    ).then(() => self.clients.claim())
  );
});

// Fetch - NETWORK FIRST for HTML, cache for assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Always fetch HTML fresh from network
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Update cache with fresh copy
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
  // For other assets - cache first
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
      .catch(() => caches.match('/starkids/index.html'))
  );
});
