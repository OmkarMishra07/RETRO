const CACHE_NAME = 'retro-shell-v1';
const RUNTIME_CACHE = 'retro-runtime-v1';

// 1. Install: Pre-cache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/', '/index.html']);
    })
  );
  self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// 2. Fetch: Network-first, Cache-fallback for APIs, Cache-first for Assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // BYPASS: API posts, WebSockets, stream proxy, search, etc.
  if (
    event.request.method !== 'GET' || 
    url.pathname.startsWith('/jam-sync') || 
    url.pathname.startsWith('/api/') || 
    event.request.headers.get('Upgrade') === 'websocket'
  ) {
    return;
  }

  // BYPASS: Don't intercept YouTube CDN or external requests
  if (
    url.hostname.includes('googlevideo.com') ||
    url.hostname.includes('youtube.com') ||
    url.hostname.includes('googleapis.com') ||
    !url.hostname.includes('localhost')
  ) {
    return;
  }

  // CACHE-FIRST: Static Assets
  if (url.pathname.match(/\.(js|css|woff2|mp3|flac|png|jpg)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // STALE-WHILE-REVALIDATE: API GET Requests (except /api/user/* which is private)
  if (url.pathname.startsWith('/api/') && !url.pathname.includes('/user/')) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          const clone = networkResponse.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, clone));
          return networkResponse;
        });
        return cachedResponse || fetchPromise;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Default: Network First
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
