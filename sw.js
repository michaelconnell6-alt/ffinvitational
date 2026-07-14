// ForeFathers Invitational — Service Worker
// Network-first for everything — ensures users always get fresh code
// Only cache images/fonts for performance

const CACHE_NAME = 'ff-invitational-v3';

// Install: skip waiting so new SW activates immediately
self.addEventListener('install', event => {
  self.skipWaiting();
});

// Activate: wipe ALL old caches, claim all clients
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Fetch: network-first for HTML/JS/CSS, cache-first for images
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  const isImage = /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(url.pathname);

  if (isImage) {
    // Cache-first for images (they don't change)
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        });
      })
    );
  } else {
    // Network-first for HTML, JS, CSS, JSON — always get fresh code
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
