// Service worker des inscriptions associatives : garde l'interface disponible hors ligne.
// Les appels à l'API ne sont jamais mis en cache (données personnelles, toujours fraîches).
// À l'activation, seuls les anciens caches de CE template (préfixe « inscriptions- ») sont supprimés.
const PREFIXE = 'inscriptions-';
const VERSION = PREFIXE + '20261113c';
const COQUILLE = ['./', 'app.css?v=20261113c', 'donnees.js?v=20261113c', 'regles.js?v=20261113c', 'app.js?v=20261113c', 'icone.svg', 'manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k.startsWith(PREFIXE) && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
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
