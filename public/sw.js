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
  // Las grabaciones (MP3 de varios MB) llegan por trozos: el navegador las pide directo, sin pasar por la caché.
  if (url.pathname.startsWith('/audio/') && url.pathname !== '/audio/index.json') return;
  // De las funciones solo se guardan los comentarios ya abiertos; la IA y la comunidad necesitan red.
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/comentario') event.respondWith(networkFirst(event, request));
    return;
  }
  event.respondWith(url.pathname.startsWith('/data/') ? downloadedFirst(event, request) : networkFirst(event, request));
});

// Notificaciones push (src/lib/avisos.ts, api/notificaciones.ts): el aviso trae título, texto y la pantalla
// que se abre al tocarlo. Mismo «tag»: el aviso nuevo reemplaza al anterior (varios «me gusta» en uno).
self.addEventListener('push', (event) => {
  let aviso = {};
  try {
    aviso = event.data ? event.data.json() : {};
  } catch {
    aviso = { body: event.data ? event.data.text() : '' };
  }
  // El despertador (src/lib/despertarTexto.ts) se queda hasta que se toque, vibra largo y ofrece posponer.
  const alarma = aviso.alarma
    ? {
        requireInteraction: true,
        vibrate: [600, 300, 600, 300, 1200, 600, 600, 300, 600],
        actions: [
          { action: 'despertar', title: 'Despertar' },
          { action: 'posponer', title: '10 minutos más' },
        ],
      }
    : {};
  event.waitUntil(
    self.registration.showNotification(aviso.title || 'Biblia de estudio', {
      body: aviso.body || '',
      icon: '/logo192.png',
      badge: '/badge96.png',
      tag: aviso.tag || undefined,
      renotify: Boolean(aviso.tag),
      lang: 'es',
      data: { url: aviso.url || '/' },
      ...alarma,
    }),
  );
});

/** «10 minutos más»: el servidor vuelve a mandar el despertador (la dirección de la suscripción lo identifica). */
async function posponer() {
  const sub = await self.registration.pushManager.getSubscription();
  if (!sub) return;
  await fetch('/api/notificaciones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accion: 'posponer', endpoint: sub.endpoint }),
  }).catch(() => {});
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'posponer') {
    event.waitUntil(posponer());
    return;
  }
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil(
    (async () => {
      // Si la app ya está abierta, la app misma cambia de pantalla (src/components/AvisosSync.tsx); si no, se abre.
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = open.find((c) => new URL(c.url).origin === self.location.origin);
      if (client) {
        client.postMessage({ tipo: 'abrir', url: url.pathname + url.search });
        return client.focus();
      }
      return self.clients.openWindow(url.href);
    })(),
  );
});
