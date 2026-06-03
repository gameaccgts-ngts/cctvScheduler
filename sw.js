// Child Life Calendar - Service Worker
// Simple service worker for PWA functionality

self.addEventListener('install', event => {
    console.log('📱 Service worker installed');
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('📱 Service worker activated');
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
    // Let all requests pass through normally
    event.respondWith(fetch(event.request));
});
