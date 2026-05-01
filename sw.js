const CACHE = 'fintrack-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/base.css',
  '/css/app.css',
  '/css/components/header.css',
  '/css/components/setup.css',
  '/css/components/modal.css',
  '/css/components/cards.css',
  '/css/components/items.css',
  '/css/components/charts.css',
  '/js/store.js',
  '/js/utils.js',
  '/js/components/modal.js',
  '/js/components/grid.js',
  '/js/components/header.js',
  '/js/notifications.js',
  '/js/pages/setup.js',
  '/js/pages/dashboard.js',
  '/js/pages/income.js',
  '/js/pages/expense.js',
  '/js/pages/spending.js',
  '/js/pages/freedom.js',
  '/js/pages/yeartable.js',
  '/js/pages/year.js',
  '/js/pages/settings.js',
  '/js/router.js',
  '/js/share.js',
  '/js/app.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('/index.html')))
  );
});
