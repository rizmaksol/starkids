// StarKids V10 — Service Worker with smart app shell caching
const CACHE = "starkids-v10-shell-v1";
const SHELL = [
  "/starkids/",
  "/starkids/index.html",
  "/starkids/styles.css",
  "/starkids/js/app.js?v=24",
  "/starkids/js/tasks.js?v=13",
  "/starkids/js/kid.js?v=12",
  "/starkids/js/auth.js?v=12",
  "/starkids/js/firebase.js?v=12",
  "/starkids/js/rush.js?v=12",
  "/starkids/js/rewards.js?v=12",
  "/starkids/js/goals.js?v=12",
  "/starkids/js/finance.js?v=12",
  "/starkids/js/values.js?v=12",
  "/starkids/js/achievements.js?v=12",
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
  // Never cache Firestore, Firebase Auth, or API calls
  if (url.includes("firestore.googleapis.com") ||
      url.includes("firebase") ||
      url.includes("googleapis.com") ||
      url.includes("aladhan.com") ||
      url.includes("gstatic.com")) {
    e.respondWith(fetch(e.request));
    return;
  }
  // Cache-first for app shell files
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(resp => {
        // Cache new shell files dynamically
        if (resp.ok && (url.includes("/starkids/"))) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached); // Return cached version if network fails
    })
  );
});
