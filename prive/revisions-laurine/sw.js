// Service worker de « Révisions QME X Laurine » (version privée) : garde l'interface disponible hors ligne.
// Les appels à l'API ne sont jamais mis en cache (données personnelles, toujours fraîches).
// Seuls les anciens caches de CETTE version sont supprimés : d'autres templates partagent le domaine.
const VERSION = 'revisions-laurine-20261127a';
const COQUILLE = ['./', 'app.css?v=20261127a', 'laurine.css?v=20261127a', 'donnees.js?v=20261127a', 'regles.js?v=20261127a', 'laurine-regles.js?v=20261127a', 'app.js?v=20261127a', 'icone.svg', 'manifest.webmanifest', 'icone-180.png', '/assets/fonts/outfit.css?v=20261113'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== VERSION && k.slice(0, k.lastIndexOf('-')) === VERSION.slice(0, VERSION.lastIndexOf('-'))).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.origin !== location.origin) return;
  // Réseau d'abord (versions à jour), cache en secours hors ligne.
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const copie = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copie)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: false }).then((r) => r || caches.match('./'))));
});
