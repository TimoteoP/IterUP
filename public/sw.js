// IterUp — service worker minimo.
//
// Obiettivo: solo caching statico di base, sufficiente per rendere la PWA
// installabile (Safari iOS "Aggiungi a Home") e per servire l'app shell da
// cache in caso di rete instabile. Nessuna strategia offline complessa,
// nessun caching di risposte API (/api/**) o di dati dinamici.

const CACHE_NAME = "iterup-static-v1";

// Asset statici noti a build time. Le route dell'app (pagine) vengono
// aggiunte alla cache "on demand" dallo stesso handler fetch, non qui,
// per evitare di dover elencare ogni pagina a mano.
const PRECACHE_URLS = [
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Coda offline diario (vedi PRD-addendum-hardening-completamento.md A4
// e lib/offline-queue.ts): la Background Sync API ha supporto
// limitato/assente su iOS Safari, quindi il meccanismo primario di
// reinvio è lato pagina (evento online/focus). Qui gestiamo solo il
// caso in cui il browser la supporta e la pagina non è già in
// primo piano: svegliamo i client aperti per far ripartire il flush,
// senza duplicare l'accesso a IndexedDB nel service worker.
self.addEventListener("sync", (event) => {
  if (event.tag !== "iterup-flush-logs") return;
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      clients.forEach((client) => client.postMessage({ type: "iterup-flush-logs" }));
    })
  );
});

// Cache-first per asset statici same-origin (GET). Tutto il resto (API,
// POST, richieste cross-origin come Supabase) passa direttamente alla rete.
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
