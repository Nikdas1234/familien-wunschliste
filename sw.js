// Service Worker: hält die App-Dateien vor, damit sie auch ohne Netz startet.
// Strategie "Netz zuerst": Online gibt es immer den neuesten Stand, der Zwischenspeicher
// springt nur ein, wenn keine Verbindung besteht.
const CACHE = 'wunschliste-v2';
const SHELL = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'config.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Ältere Browser erlauben das Umbauen einer Seitenanfrage nicht; dann bleibt sie, wie sie ist.
function revalidating(req) {
  try {
    return new Request(req, { cache: 'no-cache' });
  } catch {
    return req;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Nur eigene Dateien; Anfragen an die Datenbank gehen unverändert durch.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    // "no-cache": bei jedem Laden beim Server nachfragen, ob es eine neuere Fassung gibt,
    // statt bis zu zehn Minuten eine zwischengespeicherte zu zeigen.
    fetch(revalidating(req))
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))
      )
  );
});
