// ============================================================
// sw.js — StarKids V10 Service Worker
// Enables: Install to home screen · Basic offline shell
// ============================================================

const CACHE    = "starkids-v10-cache-v5";
const PRECACHE = [
  "/starkids/",
  "/starkids/index.html",
  "/starkids/css/styles.css",
  "/starkids/js/app.js",
  "/starkids/js/auth.js",
  "/starkids/js/firebase.js",
  "/starkids/js/kid.js",
  "/starkids/js/tasks.js",
  "/starkids/js/goals.js",
  "/starkids/js/rewards.js",
  "/starkids/manifest.json",
  "/starkids/icons/icon-192.png",
  "/starkids/icons/icon-512.png"
];

// ── Install: cache app shell ──────────────────────────────────
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ────────────────────────────────
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network first, cache fallback ─────────────────────
self.addEventListener("fetch", e => {
  // Only handle same-origin GET requests
  if (e.request.method !== "GET") return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  // Firebase API calls — always go to network
  if (e.request.url.includes("firestore") || e.request.url.includes("firebase")) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
