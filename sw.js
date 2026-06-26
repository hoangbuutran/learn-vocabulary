/**
 * Service Worker for the English Vocabulary PWA.
 *
 * Strategy:
 *  - Precache the app shell (HTML/CSS/JS/data) on install.
 *  - Runtime cache audio files and other GET requests (cache-first), so
 *    pronunciation works offline after first play.
 *  - Network-first for navigations so updates show up, falling back to cache
 *    when offline.
 *
 * Bump CACHE_VERSION whenever the shell changes to force a refresh.
 */
const CACHE_VERSION = 'v1';
const SHELL_CACHE = `vocab-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `vocab-runtime-${CACHE_VERSION}`;

// Core files needed for the app to boot offline.
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/themes.css',
  './css/main.css',
  './css/flashcard.css',
  './css/responsive.css',
  './js/app.js',
  './js/modules/storage-manager.js',
  './js/modules/memory-system.js',
  './js/modules/spaced-repetition.js',
  './js/modules/quiz-engine.js',
  './js/modules/speech-module.js',
  './js/modules/pronunciation-validator.js',
  './js/modules/data-importer.js',
  './js/utils/event-bus.js',
  './js/utils/helpers.js',
  './js/views/dashboard-view.js',
  './js/views/flashcard-view.js',
  './js/views/quiz-view.js',
  './js/views/match-view.js',
  './js/views/review-view.js',
  './js/views/import-view.js',
  './js/views/settings-view.js',
  './data/vocabulary-a1-a2.json',
  './data/vocabulary-3000.json',
  './assets/audio/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // Cache best-effort: don't fail the whole install if one asset 404s.
      .then((cache) => Promise.allSettled(
        SHELL_ASSETS.map((url) => cache.add(url))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
        .map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Navigations: network-first, fall back to cached index.html offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Same-origin assets (including audio): cache-first, then network.
  if (sameOrigin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          // Cache successful responses for next time (e.g. audio mp3s).
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Cross-origin (e.g. CDN, dictionary API): just try the network.
});
