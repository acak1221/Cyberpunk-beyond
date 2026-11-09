/* Offline support. scripts/build.mjs fills in VERSION and PRECACHE at build time. */
const VERSION = '__BUILD__';
const PRECACHE = __PRECACHE__;
const APP_CACHE = 'nc-red-app-' + VERSION;
// Files cached on first use (the PDF reader) belong to one version; fonts are shared across versions.
const RUNTIME_CACHE = 'nc-red-runtime-' + VERSION;
const FONT_CACHE = 'nc-red-fonts-v1';
// The app cannot start without these; everything else may be fetched later.
const CORE = new Set(['./', 'index.html', 'nc-red.js', 'nc-red.css']);
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    // Bypass the HTTP cache so a new version never precaches stale files. One missing
    // icon must not block the update, but a missing core file must.
    const results = await Promise.allSettled(PRECACHE.map(url => cache.add(new Request(url, { cache: 'reload' }))));
    const failedCore = PRECACHE.filter((url, i) => results[i].status === 'rejected' && CORE.has(url));
    if (failedCore.length) throw new Error('precache failed: ' + failedCore.join(', '));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    const keep = new Set([APP_CACHE, RUNTIME_CACHE, FONT_CACHE]);
    await Promise.all(names.filter(name => name.startsWith('nc-red-') && !keep.has(name)).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

async function fromCache(request, cacheName) {
  const cache = await caches.open(cacheName);
  return cache.match(request, { ignoreSearch: true });
}

async function staleWhileRevalidate(request, cacheName = RUNTIME_CACHE) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request).then(response => {
    if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (FONT_HOSTS.has(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) (await caches.open(APP_CACHE)).put(new URL('./', self.registration.scope).href, response.clone());
        return response;
      } catch {
        return (await fromCache(new URL('./', self.registration.scope).href, APP_CACHE)) ||
          (await fromCache(new URL('index.html', self.registration.scope).href, APP_CACHE)) ||
          Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await fromCache(request, APP_CACHE);
    if (cached) return cached;
    // Large optional files (the PDF reader) are cached on first use.
    return staleWhileRevalidate(request);
  })());
});
