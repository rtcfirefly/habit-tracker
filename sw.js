// Bump CACHE_NAME when the list of cached files changes, so old versions get
// cleared out on activate. It no longer gates whether a change reaches anyone:
// the fetch handler below is network-first.
const CACHE_NAME = 'habit-tracker-v6';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './emoji-utils.js',
  './data-manager.js',
  './calendar-view.js',
  './habits-view.js',
  './habit-manager.js',
  './theme-manager.js',
  './import-export-manager.js',
  './script.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) {
    return;
  }

  // Network first, cache as the fallback. Cache-first meant an edit only ever
  // reached anyone when CACHE_NAME was bumped - easy to forget, and it made a
  // plain reload show the previous version. This way a reload always shows the
  // current files, and offline still works from the last successful fetch.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
