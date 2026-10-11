const CACHE_NAME = 'gastos-build-319404a58acf';
const APP_VERSION = '20261011-011';

const PRECACHE = ["./","./assets/index-Bcf5-i91.css","./assets/index-D4WEj7gp.js","./assets/manrope-variable-DIRNzeTG.ttf","./css/app.css","./css/chat.css","./index.html","./js/api.js","./js/app.js","./js/core/api-contracts.js","./js/core/behavior-engine.js","./js/core/event-stream.js","./js/core/http-client.js","./js/core/latest-loader.js","./js/core/receipt-parser.js","./js/core/script-loader.js","./js/core/settlements.js","./js/core/utils.js","./js/core/wallet-planner.js","./js/modules/ai-settings.js","./js/modules/budgets.js","./js/modules/charts.js","./js/modules/dashboard.js","./js/modules/expenses.js","./js/modules/experience.js","./js/modules/insights.js","./js/modules/members.js","./js/modules/navigation.js","./js/modules/radar.js","./js/modules/receipt-import.js","./js/modules/recurring.js","./js/modules/scanner.js","./js/modules/settlements.js","./js/modules/smart-entry.js","./js/modules/wallets.js","./js/ui.js","./manifest.json","./js/core/utils.js?v=20261011-011","./js/core/behavior-engine.js?v=20261011-011","./js/core/receipt-parser.js?v=20261011-011","./js/core/settlements.js?v=20261011-011","./js/core/api-contracts.js?v=20261011-011","./js/core/script-loader.js?v=20261011-011","./js/core/http-client.js?v=20261011-011","./js/core/latest-loader.js?v=20261011-011","./js/core/event-stream.js?v=20261011-011","./js/api.js?v=20261011-011","./js/ui.js?v=20261011-011","./js/modules/navigation.js?v=20261011-011","./js/modules/smart-entry.js?v=20261011-011","./js/modules/receipt-import.js?v=20261011-011","./js/modules/scanner.js?v=20261011-011","./js/modules/radar.js?v=20261011-011","./js/modules/budgets.js?v=20261011-011","./js/modules/members.js?v=20261011-011","./js/modules/recurring.js?v=20261011-011","./js/modules/expenses.js?v=20261011-011","./js/modules/settlements.js?v=20261011-011","./js/modules/insights.js?v=20261011-011","./js/core/wallet-planner.js?v=20261011-011","./js/modules/charts.js?v=20261011-011","./js/modules/dashboard.js?v=20261011-011","./js/modules/wallets.js?v=20261011-011","./js/modules/experience.js?v=20261011-011","./js/modules/ai-settings.js?v=20261011-011","./js/app.js?v=20261011-011"];

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
