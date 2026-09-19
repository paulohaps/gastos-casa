const CACHE_NAME = 'gastos-ape-v39';
const APP_VERSION = '20260919-032';

const PRECACHE = [
  './',
  './index.html',
  './css/style.css?v=20260919-032',
  './css/design-system-v1.css?v=20260919-032',
  './manifest.json',
  './js/core/utils.js?v=20260919-032',
  './js/api.js?v=20260919-032',
  './js/ui.js?v=20260919-032',
  './js/modules/navigation.js?v=20260919-032',
  './js/modules/smart-entry.js?v=20260919-032',
  './js/modules/scanner.js?v=20260919-032',
  './js/modules/radar.js?v=20260919-032',
  './js/modules/budgets.js?v=20260919-032',
  './js/modules/members.js?v=20260919-032',
  './js/modules/recurring.js?v=20260919-032',
  './js/modules/expenses.js?v=20260919-032',
  './js/modules/dashboard.js?v=20260919-032',
  './js/app.js?v=20260919-032'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const url = new URL(request.url);
    if (url.origin === self.location.origin && /\/js\/(?:core\/)?(?:modules\/)?(?:api|ui|app|utils|navigation|smart-entry|scanner|radar|budgets|members|recurring|expenses|dashboard)\.js$/.test(url.pathname)) {
      url.searchParams.set('v', APP_VERSION);
      const fresh = await fetch(url.toString(), { cache: 'no-store', credentials: 'same-origin' });
      if (fresh && fresh.ok) {
        await cache.put(request, fresh.clone());
      }
      return fresh;
    }

    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok && request.method === 'GET') {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      networkFirst(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return cache.match('./index.html');
      })
    );
    return;
  }

  event.respondWith(networkFirst(event.request));
});
