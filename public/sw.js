/* TRACK AI Coach service worker: offline app shell + cached AI runtime/model. */
// `npm run build` fills in this build's files and a hash of them (see vite.config.ts): the whole app
// is saved on the first visit, so it opens offline straight away, and a new deploy replaces it.
const BUILD = 'dev';
const PRECACHE = [];
const SHELL = `track-ai-shell-${BUILD}`;
const HEAVY = 'track-ai-v2-ai'; // WASM runtime + pose models (large, rarely change; rename to refresh)

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(['./', ...PRECACHE]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== HEAVY).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isHeavy = (url) =>
  url.pathname.includes('/mediapipe/wasm/') ||
  url.pathname.endsWith('.task') ||
  url.hostname === 'storage.googleapis.com';

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && !(res.headers.get('content-type') || '').includes('html')) cache.put(request, res.clone());
  return res;
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request)) || (await cache.match('./')) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return; // never cache the AI debrief
  // Videos stream with byte ranges; the Cache API can't store partial responses.
  if (request.headers.has('range') || /\.(mp4|webm)$/.test(url.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  } else if (isHeavy(url)) {
    event.respondWith(cacheFirst(request, HEAVY));
  } else if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, SHELL));
  }
});
