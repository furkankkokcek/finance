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

// ── IDB helpers ───────────────────────────────────────────────────────────
const IDB_NAME = 'fintrack_notif';
const IDB_VERSION = 1;
const STORE = 'schedule';

function openScheduleDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

function readSchedule(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('current');
    req.onsuccess = e => resolve(e.target.result || null);
    req.onerror   = e => reject(e.target.error);
  });
}

function writeSchedule(db, schedule) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(schedule);
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
}

// ── Self-contained date/format helpers ───────────────────────────────────
function swTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function swGetAdjustedDueDate(year, month, day) {
  const lastDay = new Date(year, month, 0).getDate();
  const d = Math.min(day, lastDay);
  let date = new Date(year, month - 1, d);
  const dow = date.getDay();
  if (dow === 6) date.setDate(date.getDate() + 2);
  else if (dow === 0) date.setDate(date.getDate() + 1);
  return date;
}

function swFmtTRY(n) {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return Math.abs(n).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₺';
}

// ── Periodic Background Sync ──────────────────────────────────────────────
self.addEventListener('periodicsync', e => {
  if (e.tag === 'daily-notif') e.waitUntil(runDailyNotifications());
});

async function runDailyNotifications() {
  let db;
  try {
    db = await openScheduleDB();
    const schedule = await readSchedule(db);
    if (!schedule || !schedule.notifEnabled) return;

    const today = swTodayStr();
    if (schedule.lastNotifDate === today) return;

    schedule.lastNotifDate = today;
    await writeSchedule(db, schedule);

    const now = new Date();
    const { year, month, salaryDay, monthSummary, dueDayExpenses } = schedule;

    for (const exp of dueDayExpenses) {
      if (exp.isPaid || !exp.amount) continue;
      const adj = swGetAdjustedDueDate(year, month, exp.dueDay);
      if (adj.toDateString() === now.toDateString()) {
        await self.registration.showNotification('💳 Ödeme Günü!', {
          body:  `${exp.name} — ${swFmtTRY(exp.amount)} bugün ödenmeli.`,
          icon:  '/icons/icon-192.png',
          tag:   `due-${exp.name}-${today}`,
          data:  { url: '/' }
        });
      }
    }

    if (now.getDate() === salaryDay) {
      if (monthSummary.ppfTotal > 0) {
        await self.registration.showNotification('🏦 PPF Hatırlatması', {
          body:  `Bu ay PPF hesabına atılacak tutar: ${swFmtTRY(monthSummary.ppfTotal)}`,
          icon:  '/icons/icon-192.png',
          tag:   `ppf-${today}`,
          data:  { url: '/' }
        });
      }
      await self.registration.showNotification('💵 Aylık Mali Özet', {
        body:  `${monthSummary.monthName} ${year}\nGelir: ${swFmtTRY(monthSummary.totalIncome)}\nGider: ${swFmtTRY(monthSummary.totalExpense)}\nNakit Kalan: ${swFmtTRY(monthSummary.cashLeft)}`,
        icon:  '/icons/icon-192.png',
        tag:   `summary-${today}`,
        data:  { url: '/' }
      });
    }
  } catch (err) {
    // Silent fail — foreground checkDailyNotifications is the fallback
  } finally {
    if (db) db.close();
  }
}

// ── Notification click: open / focus app ─────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client)
          return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
