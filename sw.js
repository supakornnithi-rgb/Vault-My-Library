/*
  HTML Vault — Service Worker
  ---------------------------
  Purpose: let the app shell (html-vault.html, manifest.json, icon.svg) and
  Google Fonts load fully offline once visited once.

  Firestore/Firebase network calls are deliberately NOT intercepted here.
  Firestore's own SDK (via db.enablePersistence() in html-vault.html) already
  keeps an IndexedDB cache and gives "network first, fall back to last known
  data when offline" behavior for free. Proxying firestore.googleapis.com
  through this service worker would risk breaking its realtime
  Listen/Write streaming channel (chunked long-polling responses do not
  behave well when read through Cache API), so those requests are left to
  pass straight through to the network.
*/

const VERSION = 'v2';
const SHELL_CACHE = `vault-shell-${VERSION}`;
const FONT_CACHE = `vault-fonts-${VERSION}`;

const SHELL_FILES = [
  './html-vault.html',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES))
  );
});

self.addEventListener('activate', (event) => {
  const keep = [SHELL_CACHE, FONT_CACHE];
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => !keep.includes(n)).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || networkPromise;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    // Cross-origin <link>/<script> loads often come back as opaque
    // responses (status 0, ok === false) — still safe/worth caching.
    if (res && (res.ok || res.type === 'opaque')) {
      cache.put(request, res.clone());
    }
    return res;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Never intercept non-GET requests — Firestore writes, etc. must pass through untouched.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Let Firebase/Firestore/Google API traffic go straight to the network untouched.
  if (
    url.hostname.endsWith('googleapis.com') ||
    url.hostname.endsWith('firebaseio.com') ||
    url.hostname.endsWith('firebasestorage.app')
  ) {
    return;
  }

  // App shell navigations: always fetch fresh from the network (bypassing
  // HTTP cache, so a new deploy is picked up immediately instead of showing
  // a stale cached page), falling back to the cached shell only when truly
  // offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() => caches.match('./html-vault.html'))
    );
    return;
  }

  // Google Fonts (stylesheet + font files) and the Firebase SDK CDN scripts
  // are all versioned/immutable URLs — safe to cache-first.
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    (url.hostname === 'www.gstatic.com' && url.pathname.includes('/firebasejs/'))
  ) {
    event.respondWith(cacheFirst(req, FONT_CACHE));
    return;
  }

  // Same-origin app shell files: stale-while-revalidate.
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Anything else: default network behavior (no interception).
});
