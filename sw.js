// Service worker: todo funciona sin conexión.
const V = 'petiz-v4';
const SHELL = ['./', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/engine.js', 'js/synth.js', 'js/catalog.js', 'js/store.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/cormorant.woff2', 'fonts/cormorant-italic.woff2', 'fonts/manrope.woff2'];
const SOUNDS = [  "sounds/bosque.m4a",  "sounds/chimenea.m4a",  "sounds/grillos.m4a",  "sounds/hoguera.m4a",  "sounds/lluvia-bosque.m4a",  "sounds/lluvia-tejado.m4a",  "sounds/olas.m4a",  "sounds/pajaros.m4a",  "sounds/riachuelo.m4a",  "sounds/rio.m4a",  "sounds/tormenta.m4a",  "sounds/tren.m4a",];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(async c => {
    await c.addAll(SHELL);
    await Promise.all(SOUNDS.map(u => c.add(u).catch(() => {})));
  }));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isSound = req.url.includes('/sounds/');
  e.respondWith(caches.open(V).then(async c => {
    const net = () => fetch(req).then(r => { if (r.ok && r.status === 200) c.put(req, r.clone()); return r; });
    const hit = await c.match(req, { ignoreSearch: true });
    // Sonidos: primero la caché. Resto: primero la red (siempre la última versión) y si no hay conexión, la caché.
    if (isSound) return hit || net();
    try { return await net(); } catch (e) { if (hit) return hit; throw e; }
  }));
});
