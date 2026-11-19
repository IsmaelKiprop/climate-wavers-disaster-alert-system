/* Climate Wavers offline shell — works without mobile data after first visit. */
const VERSION = "cw-offline-v3";
const SHELL = [
  "/",
  "/offline.html",
  "/site.webmanifest",
  "/logo.jpg",
  "/Vector.png",
  "/environment-sm.jpg",
  "/community-respond-sm.jpg",
];

function offlineResponse() {
  return new Response("Offline", {
    status: 503,
    statusText: "Service Unavailable",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function matchOrOffline(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const shell = await caches.match("/offline.html");
  return shell || offlineResponse();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

function isApi(url) {
  return url.pathname.startsWith("/api/");
}

function isDisasterRead(url) {
  return (
    url.pathname.includes("/disasters") ||
    url.pathname.includes("/live") ||
    url.pathname.includes("/official")
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => matchOrOffline(request))
    );
    return;
  }

  if (isApi(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && isDisasterRead(url)) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || offlineResponse();
        })
    );
    return;
  }

  // Hashed app bundles: network-first so deploys are not stuck on old JS.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || offlineResponse())
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => cached || offlineResponse());
      return cached || network;
    })
  );
});
