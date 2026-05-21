const CACHE_NAME = "nha-dat-viet-v57";
const APP_SHELL = [
  "/",
  "/index.html",
  "/style.css",
  "/mobile-app.css",
  "/mobile-app.js",
  "/app.js",
  "/supabase-client.js",
  "/admin.html",
  "/admin.css",
  "/admin.js",
  "/submit.html",
  "/submit.css",
  "/submit.js",
  "/member.html",
  "/member.css",
  "/member.js",
  "/data/listings.json",
  "/data/site.json",
  "/data/road-prices.json",
  "/data/road-prices.csv",
  "/data/supabase-config.json",
  "/data/supabase-schema.sql",
  "/data/supabase-seed.sql",
  "/data/gia-lai-units.json",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => null)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;
  if (event.request.method !== "GET") return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request).catch(() => caches.match("/")));
    return;
  }

  if (url.pathname.startsWith("/uploads/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          const network = fetch(event.request)
            .then((response) => {
              if (response.ok) cache.put(event.request, response.clone());
              return response;
            })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  if (url.pathname.startsWith("/data/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        fetch(event.request)
          .then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => cache.match(event.request))
      )
    );
    return;
  }

  const needsFreshCopy =
    event.request.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname === "/service-worker.js";

  if (needsFreshCopy) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => cached || caches.match("/"));
      return cached || network;
    })
  );
});
