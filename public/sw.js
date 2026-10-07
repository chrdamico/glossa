const VERSION = 'dev';
const ASSETS = ["./favicon.svg","./fonts/cinzel-latin-ext.woff2","./fonts/cinzel-latin.woff2","./icons/apple-touch-icon.png","./icons/favicon-32.png","./icons/icon-192.png","./icons/icon-512.png","./icons/maskable-512.png","./index.html","./js/audio.js","./js/curriculum.js","./js/grammar.js","./js/lang.js","./js/learner.js","./js/main.js","./js/pwa.js","./js/render.js","./js/rng.js","./js/store.js","./js/version.js","./manifest.webmanifest","./style.css"];
const CACHE = `glossa-${VERSION}`;
const DEV = ['localhost', '127.0.0.1'].includes(self.location.hostname);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(['./', ...ASSETS].map((u) => cache.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('glossa-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function fromNetwork(request) {
  const res = await fetch(request);
  if (res.ok && res.type === 'basic') {
    const cache = await caches.open(CACHE);
    cache.put(request, res.clone());
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fromNetwork(request).catch(() => caches.match('./', { ignoreSearch: true })));
    return;
  }
  if (DEV) {
    event.respondWith(fromNetwork(request).catch(() => caches.match(request, { ignoreSearch: true })));
    return;
  }
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((hit) => hit || fromNetwork(request)),
  );
});
