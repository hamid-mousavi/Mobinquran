// Service Worker for Quran Mobin PWA
const CACHE_NAME = 'quran-mobin-cache-v5';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/data/quran-core-v1.json'
];

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch('/index.html', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not cache app shell: ${response.status}`);

  await cache.put('/index.html', response.clone());

  // Vite emits hashed JS/CSS files. Cache those files during installation so
  // the app can reopen offline immediately after it is installed.
  const html = await response.text();
  const assetPaths = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)]
    .map((match) => new URL(match[1], self.location.origin).pathname);

  await Promise.all(assetPaths.map(async (path) => {
    try {
      const assetResponse = await fetch(path, { cache: 'no-cache' });
      if (assetResponse.ok) await cache.put(path, assetResponse);
    } catch {
      // A later network-first request can retry a transient asset failure.
    }
  }));

  await Promise.all(STATIC_ASSETS.filter((asset) => asset !== '/index.html').map(async (asset) => {
    try {
      const assetResponse = await fetch(asset, { cache: 'no-cache' });
      if (assetResponse.ok) await cache.put(asset, assetResponse);
    } catch {
      // Do not make the entire installation fail because an optional icon failed.
    }
  }));
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(cacheAppShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Cleaning old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension / live-reload requests
  if (request.method !== 'GET' || url.protocol.startsWith('chrome-extension')) {
    return;
  }

  // Network-first strategy for dynamic /api/ endpoints with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Network-First for HTML navigation and JS/CSS assets so user always sees the latest updates immediately
  if (
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname === '/' ||
    url.pathname === '/index.html'
  ) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Cache-first strategy for Google Fonts and static images
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Network-first with cache fallback for everything else
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});
