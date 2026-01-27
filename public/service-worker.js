// [Wellness Service Worker]
// This service worker is primarily for PWA installability and basic offline fallback.
// It actively avoids caching index.html to prevent "White Out" issues on updates.

const CACHE_NAME = 'wellness-cache-v1';
const OFFLINE_URL = '/offline.html'; // We don't have this yet, but it's a placeholder.

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete all old caches to force fresh load
                    return caches.delete(cacheName);
                })
            );
        })
    );
    return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Network First, Fallback to nothing (or cache if we implemented it)
    // For now, purely Network Only for HTML to ensure freshness.
    if (event.request.mode === 'navigate') {
        event.respondWith(fetch(event.request));
        return;
    }

    // For images/static, we could cache, but let's keep it simple for now to fix the bug.
    // Standard Browser Caching is sufficient for Vercel.
    return;
});
