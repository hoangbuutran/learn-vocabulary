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
const CACHE_VERSION = 'v32';
const SHELL_CACHE = `vocab-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `vocab-runtime-${CACHE_VERSION}`;
// Audio is large and rarely changes; keep it in a version-independent cache so
// downloaded-for-offline audio survives app updates.
const AUDIO_CACHE = 'vocab-audio';

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
  './js/config.js',
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
  './js/views/ipa-view.js',
  './js/views/shadowing-view.js',
  './js/views/review-view.js',
  './js/views/import-view.js',
  './js/views/settings-view.js',
  './data/vocabulary-a1-a2.json',
  './data/vocabulary-3000.json',
  './data/word-extras.json',
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
        .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE && k !== AUDIO_CACHE)
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
    // Cache-first for instant launch (no blank screen waiting on the network).
    // Update the cached shell in the background for next time.
    event.respondWith(
      caches.match('./index.html').then((cached) => {
        const fetchAndUpdate = fetch(request).then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((c) => c.put('./index.html', copy));
          }
          return response;
        }).catch(() => cached);
        return cached || fetchAndUpdate;
      })
    );
    return;
  }

  // Same-origin assets: cache-first, then network.
  if (sameOrigin) {
    // Audio files go into a persistent cache that survives app updates.
    const isAudio = url.pathname.includes('/assets/audio/') &&
      /\.(mp3|ogg|wav|m4a)$/i.test(url.pathname);
    const targetCache = isAudio ? AUDIO_CACHE : RUNTIME_CACHE;

    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(targetCache).then((cache) => cache.put(request, copy));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Cross-origin: cache-first for known CDN resources (Transformers.js library +
  // Whisper model weights from HuggingFace). This avoids re-downloading ~40MB+
  // of model data on every page reload.
  const isCacheable = url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('huggingface.co') ||
    url.hostname.includes('hf.co');
  if (isCacheable) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200 && response.type !== 'opaqueredirect') {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // Other cross-origin: just try the network (no cache).
});
