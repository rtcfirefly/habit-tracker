// Bump CACHE_NAME when the list of cached files changes, so old versions get
// cleared out on activate. It no longer gates whether a change reaches anyone:
// the fetch handler below is network-first.
//
// The ?v= on the stylesheet and scripts must match the number here, and must
// match index.html. A cache entry keyed on one version can never satisfy a
// request for the next, which is what makes a stale stylesheet against a
// fresh index.html impossible - the failure that made this necessary.
// tools/check-sw-cache.sh enforces that they agree.
const CACHE_NAME = 'habit-tracker-v10';

const ASSETS = [
  './',
  './index.html',
  './styles.css?v=10',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './emoji-utils.js?v=10',
  './data-manager.js?v=10',
  './calendar-view.js?v=10',
  './habits-view.js?v=10',
  './habit-manager.js?v=10',
  './theme-manager.js?v=10',
  './import-export-manager.js?v=10',
  './script.js?v=10'
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
