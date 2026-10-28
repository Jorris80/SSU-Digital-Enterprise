/* SSU Digital Enterprise — service worker v1.2.0
 * - App shell & pustaka CDN: cache-first (aplikasi terbuka tanpa internet)
 * - Ubin peta: stale-while-revalidate, hanya ubin yang pernah dilihat (maks 1500) — tidak ada prefetch massal
 * - Panggilan API Apps Script (POST) TIDAK pernah di-cache; data lapangan disimpan di IndexedDB oleh aplikasi */
const V = 'ssu-1.2.0', SHELL = V + '-shell', TILES = 'ssu-tiles', MAX_TILES = 1500;
const ASSETS = ['./', './index.html', './offline.html', './manifest.json', './icon.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css', 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js', 'https://unpkg.com/pmtiles@3.2.1/dist/pmtiles.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(ASSETS.map(u => c.add(new Request(u, { mode: u.startsWith('http') ? 'no-cors' : 'same-origin' })).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('ssu-') && k !== SHELL && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
async function trim(name, max) { const c = await caches.open(name), ks = await c.keys(); for (let i = 0; i < ks.length - max; i++) await c.delete(ks[i]); }
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || /script\.google(usercontent)?\.com$/.test(url.hostname)) return;   // API: selalu jaringan
  if (/tile\.openstreetmap\.org|arcgisonline\.com/.test(url.hostname)) {
    e.respondWith(caches.open(TILES).then(async c => { const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') { c.put(req, r.clone()); trim(TILES, MAX_TILES); } return r; }).catch(() => hit);
      return hit || net; }));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { caches.open(SHELL).then(c => c.put('./index.html', r.clone())); return r; })
      .catch(async () => (await caches.match('./index.html')) || caches.match('./offline.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok && url.origin === location.origin) caches.open(SHELL).then(c => c.put(req, r.clone())); return r; })));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
