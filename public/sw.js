// Red primero; si no hay conexión, usa lo último guardado. Así la app instalada abre sin internet
// los capítulos ya leídos, y nunca sirve una versión vieja cuando hay red.
//
// Lo descargado para leer sin conexión (src/lib/descargas.ts) está en DESCARGAS: esos archivos se sirven
// desde ahí al momento, aunque la red sea lenta, y se actualizan por detrás cuando hay conexión.
const CACHE = 'biblia-v1';
const DESCARGAS = 'biblia-descargas';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

function networkFirst(event, request) {
  return fetch(request)
    .then((res) => {
      if (res.ok) {
        const copy = res.clone();
        event.waitUntil(caches.open(CACHE).then((c) => c.put(request, copy)));
      }
      return res;
    })
    .catch(async () => {
      const saved = await caches.match(request);
      if (saved) return saved;
      if (request.mode === 'navigate') return (await caches.match('/app.html')) ?? (await caches.match('/')) ?? Response.error();
      return Response.error();
    });
}

async function downloadedFirst(event, request) {
  const downloads = await caches.open(DESCARGAS);
  const saved = await downloads.match(request);
  if (!saved) return networkFirst(event, request);
  event.waitUntil(
    fetch(request)
      .then((res) => res.ok && downloads.put(request, res))
      .catch(() => {}),
  );
  return saved;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Las descargas piden con no-store y guardan ellas mismas su copia.
  if (request.cache === 'no-store') return;
  // De las funciones solo se guardan los comentarios ya abiertos; la IA y la comunidad necesitan red.
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/comentario') event.respondWith(networkFirst(event, request));
    return;
  }
  event.respondWith(url.pathname.startsWith('/data/') ? downloadedFirst(event, request) : networkFirst(event, request));
});
