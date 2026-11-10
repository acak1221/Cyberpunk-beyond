/* Offline support. scripts/build.mjs fills in VERSION, PRECACHE, PDFJS and VIEWS at build time. */
const VERSION = '__BUILD__';
// Exactly the URLs the page loads ('./' is the page itself; the bundles carry ?v=VERSION).
const PRECACHE = __PRECACHE__;
// The PDF reader (1.7 MB) is not part of the install. It has its own cache, named after a hash of its
// files, so app updates keep it; it is stored on first use or fetched in the background ('cache-pdf').
// files: path → SHA-256, so that only this version's files are ever stored under that name.
const PDFJS = __PDFJS__;
// Top-level routes of the app: <scope>/sheet/abc opens <scope>#/sheet/abc, as 404.html does online.
const VIEWS = __VIEWS__;
const APP_CACHE = 'nc-red-app-' + VERSION;
const PDF_CACHE = 'nc-red-pdfjs-' + PDFJS.version;
const FONT_CACHE = 'nc-red-fonts-v1';
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const SCOPE = self.registration.scope;
const SCOPE_PATH = new URL(SCOPE).pathname;
const SHELL = new URL('./', SCOPE).href;
const PINNED = '?v=' + VERSION;
const PRECACHED = new Set(PRECACHE.map(url => new URL(url, SCOPE).href));
const PDF_FILES = new Map(Object.entries(PDFJS.files));
// Workers before this one (up to c852236) kept index.html in their cache and answered nc-red.js?v=NEW with their
// own copy (ignoreSearch): while one stays in control, every new tab and offline start pairs the new page with old
// scripts. Only their caches hold index.html, so such a worker is replaced at once instead of waiting for «Обновить».
// Pages that are already open are left alone (a reload would drop whatever is being typed in them): they go on
// with the scripts they have loaded and move to this version when their «Обновить» is pressed or they are reopened.
const replacesLegacyWorker = () => caches.match(new URL('index.html', SCOPE).href).then(Boolean, () => false);
// True once this worker is the one in control. Without self.serviceWorker (older browsers) the registration tells.
const inControl = () => (self.serviceWorker
  ? /^activ/.test(self.serviceWorker.state)
  : !!self.registration.active && !self.registration.waiting && !self.registration.installing);

// Reloads a page into this version. client.url misses route changes made with replaceState, and a URL that differs
// only after # would not reload, so the path switches between ./ and ./index.html.
async function reload(client) {
  try {
    const { pathname, search, hash } = new URL(client.url);
    await client.navigate(new URL((pathname === SCOPE_PATH ? 'index.html' : './') + search + hash, SCOPE).href);
  } catch {}
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    const results = await Promise.allSettled(PRECACHE.map(async url => {
      // A ?v=VERSION file never changes, so the copy the page has just downloaded is reused from the
      // HTTP cache; everything else is revalidated so that a new version never stores a stale file.
      let response = await fetch(new Request(new URL(url, SCOPE), { cache: url.endsWith(PINNED) ? 'force-cache' : 'no-cache' }));
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      if (url === './') {
        // A CDN may serve the previous page for a few minutes after a deploy: never pair it with these bundles.
        const html = await response.clone().text();
        if (!html.includes(`data-build="${VERSION}"`)) throw new Error('the page is not build ' + VERSION);
        if (response.redirected) response = new Response(html, response);
      }
      await cache.put(new URL(url, SCOPE).href, response);
    }));
    // One missing icon must not block the update, but the page or a bundle must.
    const failed = PRECACHE.filter((url, i) => results[i].status === 'rejected' && (url === './' || url.endsWith(PINNED)));
    if (failed.length) {
      await caches.delete(APP_CACHE);
      throw new Error('precache failed: ' + failed.join(', '));
    }
    if (await replacesLegacyWorker()) self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([APP_CACHE, PDF_CACHE, FONT_CACHE]);
    const names = (await caches.keys()).filter(name => name.startsWith('nc-red-') && !keep.has(name));
    // Earlier versions kept pdf.js in a per-version cache: carry it over instead of downloading it again.
    await adoptPdf(names.filter(name => name.startsWith('nc-red-runtime-'))).catch(() => {});
    await Promise.all(names.map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  // «Обновить» on a page. Normally this worker is waiting and takes over; the page reloads itself once it has.
  // After a legacy worker was replaced this worker is in control already, and that page (old scripts) waits for a
  // change of control that will not come: it is reloaded from here.
  if (event.data === 'skip-waiting') {
    if (inControl()) event.waitUntil(reload(event.source));
    else self.skipWaiting();
  } else if (event.data === 'cache-pdf') event.waitUntil(cachePdfModule());
});

// Right after a deploy an HTTP or CDN cache may still return the other pdf.js version: never store it.
async function storePdf(cache, key, sha, response) {
  const body = await response.arrayBuffer();
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', body))].map(b => b.toString(16).padStart(2, '0')).join('');
  if (digest !== sha) return false;
  await cache.put(key, new Response(body, response));
  return true;
}

async function adoptPdf(oldCaches) {
  const cache = await caches.open(PDF_CACHE);
  for (const [file, sha] of PDF_FILES) {
    const url = new URL(file, SCOPE).href;
    if (await cache.match(url, { ignoreVary: true })) continue;
    for (const name of oldCaches) {
      const old = await caches.match(url, { cacheName: name, ignoreVary: true });
      if (old && await storePdf(cache, url, sha, old)) break;
    }
  }
}

let pdfDownload = null;
// Sent by the page when it is online and idle: downloads only the missing files, one at a time.
function cachePdfModule() {
  if (!pdfDownload) pdfDownload = (async () => {
    const cache = await caches.open(PDF_CACHE);
    for (const [file, sha] of PDF_FILES) {
      const url = new URL(file, SCOPE).href;
      if (await cache.match(url, { ignoreVary: true })) continue;
      const response = await fetch(url, { cache: 'no-cache' });
      if (response.ok) await storePdf(cache, url, sha, response);
    }
  })().catch(() => {}).finally(() => { pdfDownload = null; });
  return pdfDownload;
}

// key has no query: after a failed import the page retries with ?retry=N, which is the same file.
async function fromPdfCache(event, key, sha) {
  const cache = await caches.open(PDF_CACHE);
  const cached = await cache.match(key, { ignoreVary: true });
  if (cached) return cached;
  const response = await fetch(event.request.url, { cache: 'no-cache' });
  if (response.ok) event.waitUntil(storePdf(cache, key, sha, response.clone()).catch(() => {}));
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request).then(response => {
    if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || network;
}

// The page always comes from this version's install, like the scripts it loads: a new version arrives as a
// new worker (the update notice), never as new HTML on top of old scripts, and a slow network cannot delay
// the start. Nested paths would resolve the page's relative script links under that path, so they redirect.
function navigation(request, url, rel) {
  if (rel === '' || rel === 'index.html') {
    return caches.match(SHELL, { cacheName: APP_CACHE }).then(cached => cached || fetch(request));
  }
  const parts = rel.split('/').filter(Boolean);
  let first = parts[0];
  try { first = decodeURIComponent(first); } catch {}
  if (VIEWS.includes(first)) return Response.redirect(SCOPE + url.search + (url.hash || '#/' + parts.join('/')), 302);
  return null;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (FONT_HOSTS.has(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }
  if (!url.href.startsWith(SCOPE)) return;
  const rel = url.pathname.slice(SCOPE_PATH.length);
  if (PDF_FILES.has(rel)) {
    event.respondWith(fromPdfCache(event, url.origin + url.pathname, PDF_FILES.get(rel)));
    return;
  }
  if (request.mode === 'navigate') {
    const response = navigation(request, url, rel);
    if (response) {
      event.respondWith(response);
      return;
    }
  }
  // Exact URL, query included: nc-red.js?v=OTHER is never answered with this version's file.
  const key = url.origin + url.pathname + url.search;
  if (PRECACHED.has(key)) {
    event.respondWith(caches.match(key, { cacheName: APP_CACHE, ignoreVary: true }).then(cached => cached || fetch(request)));
  } else if (request.mode === 'navigate') {
    // Any other page: the server's answer, or the app itself while offline.
    event.respondWith(fetch(request).catch(() => Response.redirect(SCOPE + url.search + url.hash, 302)));
  }
});
