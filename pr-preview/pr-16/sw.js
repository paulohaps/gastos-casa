const CACHE_NAME = 'gastos-build-079135398202';
const APP_VERSION = '20261012-002';

const PRECACHE = ["./","./assets/index-BzSeaB8k.css","./assets/index-CKTppbu6.js","./assets/manrope-variable-DIRNzeTG.ttf","./css/app.css","./css/chat.css","./css/experience.css","./css/local-icons.css","./index.html","./js/api.js","./js/app.js","./js/core/analysis-period.d.mts","./js/core/analysis-period.mjs","./js/core/analysis-snapshot.d.mts","./js/core/analysis-snapshot.mjs","./js/core/api-contracts.js","./js/core/behavior-engine.js","./js/core/event-stream.js","./js/core/http-client.js","./js/core/latest-loader.js","./js/core/receipt-parser.js","./js/core/script-loader.js","./js/core/settlements.js","./js/core/utils.js","./js/core/wallet-planner.js","./js/modules/budgets.js","./js/modules/charts.js","./js/modules/dashboard.js","./js/modules/expenses.js","./js/modules/insights.js","./js/modules/navigation.js","./js/modules/radar.js","./js/modules/receipt-import.js","./js/modules/recurring.js","./js/modules/scanner.js","./js/modules/settlements.js","./js/modules/smart-entry.js","./js/ui.js","./manifest.json","./js/core/utils.js?v=20261012-002","./js/core/behavior-engine.js?v=20261012-002","./js/core/receipt-parser.js?v=20261012-002","./js/core/settlements.js?v=20261012-002","./js/core/api-contracts.js?v=20261012-002","./js/core/script-loader.js?v=20261012-002","./js/core/http-client.js?v=20261012-002","./js/core/latest-loader.js?v=20261012-002","./js/core/event-stream.js?v=20261012-002","./js/api.js?v=20261012-002","./js/ui.js?v=20261012-002","./js/modules/navigation.js?v=20261012-002","./js/modules/smart-entry.js?v=20261012-002","./js/modules/receipt-import.js?v=20261012-002","./js/modules/scanner.js?v=20261012-002","./js/modules/radar.js?v=20261012-002","./js/modules/budgets.js?v=20261012-002","./js/modules/recurring.js?v=20261012-002","./js/modules/expenses.js?v=20261012-002","./js/modules/settlements.js?v=20261012-002","./js/modules/insights.js?v=20261012-002","./js/core/wallet-planner.js?v=20261012-002","./js/modules/charts.js?v=20261012-002","./js/modules/dashboard.js?v=20261012-002","./js/app.js?v=20261012-002"];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('gastos-') && key !== CACHE_NAME).map(key => caches.delete(key))))
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
    if (url.origin === self.location.origin && /\/js\/(?:core\/)?(?:modules\/)?(?:api|ui|app|utils|api-contracts|script-loader|http-client|latest-loader|behavior-engine|receipt-parser|navigation|smart-entry|receipt-import|scanner|radar|budgets|members|recurring|expenses|insights|dashboard|settlements|wallets|experience|ai-settings|wallet-planner|charts|assistant|event-stream)\.js$/.test(url.pathname)) {
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
