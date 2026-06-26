// ForeFathers Invitational — Service Worker
// Cache-first for static assets, network-first for live data

const CACHE_NAME = 'ff-invitational-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/favicon.ico',
  '/favicon-16.png',
  '/favicon-32.png',
  '/favicon-48.png',
  '/favicon-180.png',
  '/favicon-192.png',
  '/images/logo.png',
  '/images/champion-steins.jpg',
  '/image_from_ios_720.jpg'
];

// Live data — always try network first, fall back to cache
const NETWORK_FIRST = [
  '/scores.json',
  '/pairings.json'
];

// Install: cache all static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clear old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for static, network-first for live data
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) return;

  const isNetworkFirst = NETWORK_FIRST.some(path => url.pathname.endsWith(path.replace('/', '')));

  if (isNetworkFirst) {
    // Network first — get fresh scores/pairings, fall back to cache if offline
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache first — serve instantly from cache, update in background
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => {});
        return cached || fetchPromise;
      })
    );
  }
});
