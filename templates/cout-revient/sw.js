// Service worker du template « Coût de revient et prix » : garde l'interface disponible hors ligne.
// Les appels à l'API ne sont jamais mis en cache (données personnelles, toujours fraîches).
const VERSION = 'cout-revient-2026111201';
const COQUILLE = ['./', 'app.css?v=2026111201', 'donnees.js?v=2026111201', 'calculs.js?v=2026111201', 'app.js?v=2026111201', 'icone.svg', 'manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  // Réseau d'abord (versions à jour), cache en secours hors ligne.
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok && url.origin === location.origin) { const copie = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copie)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: false }).then((r) => r || caches.match('./'))));
});
