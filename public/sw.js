// AVSEC Salem AI & DS Department Portal — Service Worker
const CACHE_NAME = 'avsec-aids-portal-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/images/avsec-salem-logo.png',
  '/manifest-student.webmanifest',
  '/manifest-faculty.webmanifest',
  '/manifest-hod.webmanifest',
  '/manifest-admin.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests, bypass all /api/ requests to always fetch network fresh
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api') || url.pathname.includes('/auth/')) {
    return;
  }

  // Network first for HTML navigation, cache fallback for assets
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        // Cache static fonts or images
        if (url.pathname.startsWith('/images/') || url.pathname.endsWith('.css') || url.pathname.endsWith('.js')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

