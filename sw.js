// Service worker de HQSE MILSA. Estrategia: red primero (para que la próxima
// visita ya vea archivos actualizados en SharePoint), con caché como respaldo
// sin conexión. Sube este archivo SIEMPRE junto a HQSE_MILSA.html, manifest.json
// e icon-192/512.png, en la misma carpeta.
const CACHE = 'hqse-milsa-v1';
const CORE = ['./HQSE_MILSA.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
