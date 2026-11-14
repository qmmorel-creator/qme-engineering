// Service worker de Gestion de compétition sportive : garde l'interface disponible hors ligne.
// Les appels à l'API ne sont jamais mis en cache (données personnelles et classement public toujours frais).
// Seuls les anciens caches de CE template sont supprimés : d'autres templates partagent le domaine.
const VERSION = 'competition-20261114';
const COQUILLE = ['./', 'app.css?v=20261114', 'donnees.js?v=20261114', 'regles.js?v=20261114', 'app.js?v=20261114', 'icone.svg', 'manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== VERSION && k.slice(0, k.lastIndexOf('-')) === VERSION.slice(0, VERSION.lastIndexOf('-'))).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
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
