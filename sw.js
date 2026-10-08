// Works offline after the first visit: always try the network first (so updates land
// straight away), fall back to the last copy kept here.
const CACHE = 'mahatta-v1';
const CORE = ['./', 'index.html', 'app.js', 'brand.js', 'scene.js', 'smoke.js', 'export.js', 'lib/mp4-muxer.min.js',
  'assets/mark.json', 'assets/icon-180.png', 'assets/icon-192.png', 'manifest.webmanifest',
  'fonts/Almarai-Regular.ttf', 'fonts/Almarai-Bold.ttf', 'fonts/Almarai-ExtraBold.ttf'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
