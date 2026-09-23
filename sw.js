// Service worker de HQSE MILSA (v3).
// Sube este archivo SIEMPRE junto a HQSE_MILSA.html, manifest.json, icon-192/512.png
// y la carpeta assets/img/, todo en la misma carpeta del repositorio.
//
// Estrategia:
// - La app (HTML) se sirve desde la cache al instante y se actualiza en segundo plano:
//   funciona sin cobertura y con cobertura mala no se queda colgada esperando a la red.
//   La version nueva se ve en la siguiente apertura.
// - Las fotos de producto (assets/img/) se descargan todas en segundo plano la primera vez
//   que se abre la app con cobertura, y despues se sirven siempre desde la cache.
// - Lo demas (SharePoint: FDS, fichas tecnicas, manuales) va por red; sin cobertura no abre.
const CACHE = 'hqse-milsa-v3';
const APP = './HQSE_MILSA.html';
const SHELL = [APP, './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => precacheFotos())
  );
});

async function precacheFotos() {
  try {
    const c = await caches.open(CACHE);
    const res = await fetch('./assets/img/lista.json', { cache: 'no-store' });
    if (!res.ok) return;
    const lista = await res.json();
    for (const f of lista) {
      const url = './assets/img/' + encodeURIComponent(f);
      if (await c.match(url)) continue;
      try { const r = await fetch(url); if (r.ok) await c.put(url, r); } catch (_) {}
    }
  } catch (_) {}
}

self.addEventListener('message', (e) => { if (e.data === 'precache-fotos') e.waitUntil(precacheFotos()); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const mismoOrigen = url.origin === self.location.origin;

  // Navegacion a la app: cache primero, actualizacion en segundo plano.
  if (req.mode === 'navigate' || (mismoOrigen && url.pathname.endsWith('/HQSE_MILSA.html'))) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const cached = await c.match(APP);
      const red = fetch(req).then((r) => { if (r.ok) c.put(APP, r.clone()); return r; }).catch(() => null);
      if (cached) { e.waitUntil(red); return cached; }
      return (await red) || new Response('Sin conexion y la app aun no se ha guardado en este movil. Abrela una vez con cobertura.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    })());
    return;
  }

  // Recursos propios (fotos, iconos, manifest): cache primero.
  if (mismoOrigen) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const cached = await c.match(req, { ignoreSearch: true });
      if (cached) return cached;
      try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; }
      catch (_) { return new Response('', { status: 504 }); }
    })());
    return;
  }

  // Externos (SharePoint, fuentes): red, con cache como respaldo.
  e.respondWith(
    fetch(req).then((r) => { if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return r; })
      .catch(() => caches.match(req))
  );
});
