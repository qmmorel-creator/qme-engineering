// Service worker du journal nutrition : garde l'interface disponible hors ligne.
// Les appels à l'API ne sont jamais mis en cache (données de santé personnelles, toujours fraîches).
// La base aliments (aliments.js, chargée à la demande) est mise en cache à sa première lecture.
// Seuls les anciens caches de CE template sont supprimés : d'autres templates partagent le domaine.
const VERSION = 'nutrition-20261113';
const COQUILLE = ['./', 'app.css?v=20261113', 'donnees.js?v=20261113', 'regles.js?v=20261113', 'app.js?v=20261113', 'icone.svg', 'manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  const prefixe = VERSION.slice(0, VERSION.lastIndexOf('-'));
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== VERSION && k.slice(0, k.lastIndexOf('-')) === prefixe).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
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
