const CACHE_NAME = 'evance-portfolio-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/css/style.css',
  '/css/admin.css',
  '/js/main.js',
  '/js/admin.js',
  '/images/logo.png',
  '/manifest.json'
];

// Service Worker Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching Static Shell Assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Service Worker Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache');
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Service Worker Fetch Event (Cache First falling back to Network)
self.addEventListener('fetch', (event) => {
  // Only cache GET requests and skip admin routes
  if (event.request.method !== 'GET' || event.request.url.includes('/admin') || event.request.url.includes('/api')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Cache dynamic images, fonts or files on the fly if needed
        if (networkResponse && networkResponse.status === 200 && (event.request.url.includes('/images/') || event.request.url.includes('/uploads/'))) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline Fallback for html pages
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/');
        }
      });
    })
  );
});
