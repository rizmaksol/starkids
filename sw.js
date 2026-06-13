// StarKids V10 — Service Worker with smart app shell caching
const CACHE = "starkids-v10-shell-v2";
const SHELL = [
  "/starkids/",
  "/starkids/index.html",
  "/starkids/styles.css",
  "/starkids/manifest.json",
  "/starkids/icons/icon-192.png",
  "/starkids/icons/icon-512.png"
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL).catch(()=>{}))
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = e.request.url;
  // Don't touch Firestore, Firebase, Auth, or external API calls AT ALL.
  // Returning without calling respondWith lets the browser handle them
  // natively — no service worker interference, no "Failed to fetch" errors.
  if (url.includes("firestore.googleapis.com") ||
      url.includes("firebase") ||
      url.includes("googleapis.com") ||
      url.includes("identitytoolkit") ||
      url.includes("securetoken") ||
      url.includes("aladhan.com") ||
      url.includes("gstatic.com")) {
    return; // browser handles it directly
  }
  // Only intercept same-origin app-shell GET requests
  if (e.request.method !== "GET") return;
  // Cache-first for app shell files
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(resp => {
        if (resp.ok && url.includes("/starkids/")) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached); // fall back to cache if network fails
    })
  );
});
