/* =====================================================================
   sw.js — Service worker : fait fonctionner Partageo hors ligne
   ---------------------------------------------------------------------
   Stratégie « cache d'abord, mise à jour en arrière-plan » :
     1. on répond tout de suite avec la copie en cache (ouverture instantanée,
        même sans réseau) ;
     2. en parallèle, on télécharge la dernière version et on met le cache
        à jour → la version suivante s'affichera à la prochaine ouverture.

   ⚠️ Quand tu ajoutes ou renommes un fichier, ajoute-le à FILES et
      augmente le numéro de VERSION.
   ===================================================================== */
const VERSION = 'v5';
const CACHE = 'partageo-' + VERSION;

const FILES = [
  './',
  'index.html',
  'confidentialite.html',
  'style.css',
  'manifest.webmanifest',
  'js/core.js',
  'js/money.js',
  'js/store.js',
  'js/split.js',
  'js/settle.js',
  'js/share.js',
  'js/parser.js',
  'js/qr.js',
  'js/link.js',
  'js/group-share.js',
  'js/ui.js',
  'js/expense-form.js',
  'js/backup.js',
  'js/demo.js',
  'js/pwa.js',
  'js/app.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

// Installation : on met tous les fichiers en cache
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(FILES); })
      .then(function () { return self.skipWaiting(); }) // active la nouvelle version sans attendre
  );
});

// Activation : on supprime les caches des anciennes versions
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys
          .filter(function (k) { return k.indexOf('partageo-') === 0 && k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

// Chaque requête de l'appli passe par ici
self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // WhatsApp, etc. : on ne s'en mêle pas

  // Toutes les pages (/, /index.html, /?x…) sont servies par index.html
  const key = req.mode === 'navigate'
    ? new URL('index.html', self.registration.scope).href
    : req.url;

  event.respondWith(caches.open(CACHE).then(function (cache) {
    return cache.match(key, { ignoreSearch: true }).then(function (cached) {
      const network = fetch(req)
        .then(function (res) {
          if (res.ok) cache.put(key, res.clone());
          return res;
        })
        .catch(function () { return null; }); // hors ligne

      if (cached) {
        event.waitUntil(network); // mise à jour en arrière-plan
        return cached;
      }
      return network.then(function (res) {
        return res || new Response('Partageo est hors ligne et ce fichier n\'est pas encore en cache.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    });
  }));
});
