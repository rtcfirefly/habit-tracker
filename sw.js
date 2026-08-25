// Semantic version, shared by CACHE_NAME, the ?v= on every asset below, and the
// number shown in the settings dialog. tools/check-sw-cache.sh keeps the three
// in agreement and refuses a version that does not move forward.
//
//   patch  fixes and cosmetic changes
//   minor  new user-visible capability
//   major  anything that breaks stored data or the export format
//
// Not to be confused with the "version" field inside an export file, which
// describes that file's shape and moves independently.
//
// Any shipped change to a versioned asset needs a bump: the ?v= is the cache
// key, so new bytes under an old key are exactly what a stale cache keeps
// serving.
//
// The ?v= on the stylesheet and scripts must match the number here, and must
// match index.html. A cache entry keyed on one version can never satisfy a
// request for the next, which is what makes a stale stylesheet against a
// fresh index.html impossible - the failure that made this necessary.
// tools/check-sw-cache.sh enforces that they agree.
const CACHE_NAME = 'habit-tracker-v1.2.1';

const ASSETS = [
  './',
  './index.html',
  './styles.css?v=1.2.1',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './emoji-utils.js?v=1.2.1',
  './data-manager.js?v=1.2.1',
  './calendar-view.js?v=1.2.1',
  './habits-view.js?v=1.2.1',
  './habit-manager.js?v=1.2.1',
  './theme-manager.js?v=1.2.1',
  './import-export-manager.js?v=1.2.1',
  './script.js?v=1.2.1'
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
