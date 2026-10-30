// Cache-first service worker: the whole app is precached on install, so it
// loads with no network after the first visit. A new build id replaces the
// cache on the next load.
const BUILD = "mvuoec8v";
const CACHE = `outage-ready-${BUILD}`;
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./js/app/main.js",
  "./js/app/store.js",
  "./js/app/ui.js",
  "./js/app/wizard.js",
  "./js/app/dashboard.js",
  "./js/app/timeline.js",
  "./js/app/plan-print.js",
  "./js/app/assumptions.js",
  "./js/engine/index.js",
  "./js/engine/types.js",
  "./js/engine/format.js",
  "./js/engine/assumptions.js",
  "./js/engine/scenarios.js",
  "./js/engine/graph.js",
  "./js/engine/simulate.js",
  "./js/engine/prioritize.js",
  "./js/engine/sample.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok && new URL(req.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match("./index.html"));
    }),
  );
});
