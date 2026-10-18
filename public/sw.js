// Red primero; si no hay conexión, usa lo último guardado. Así la app instalada abre sin internet
// los capítulos ya leídos, y nunca sirve una versión vieja cuando hay red.
const CACHE = 'biblia-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(async () => (await caches.match(request)) ?? (request.mode === 'navigate' ? caches.match('/') : Response.error())),
  );
});
