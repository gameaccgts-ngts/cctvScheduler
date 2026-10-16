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

// IMPORTANT: do NOT intercept fetches.
//
// A naive `event.respondWith(fetch(event.request))` looks like a harmless
// pass-through, but it isn't: once you hand a promise to respondWith(), any
// time that fetch rejects (e.g. the single-threaded PowerShell server is busy
// streaming a large video and briefly refuses another connection) the browser
// surfaces it as a hard load error — including for the page navigation itself,
// which is the "page load error that F5 fixes" we were seeing.
//
// By not calling respondWith at all, the browser handles every request
// natively (which is also better for large-video range requests). We keep the
// service worker only so the app stays installable as a PWA.
self.addEventListener('fetch', () => {
    // Intentionally empty — browser default handling.
});
