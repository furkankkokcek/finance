// FinTrack push backend (Firebase Cloud Functions, v2).
//
// Two functions:
//   registerSchedule  (HTTPS)  — the app POSTs its FCM token + pre-rendered
//                                 notification schedule; stored in Firestore.
//   sendDailyNotifications (scheduled) — runs daily at 09:00 Europe/Istanbul,
//                                 sends each device the notifications dated today.
//
// "Minimum data": Firestore only holds pre-rendered {date,title,body} strings +
// the FCM token, never the raw budget structure.

const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();

const REGION = 'europe-west1';
const COLLECTION = 'pushSchedules';
const MAX_NOTIFS = 400; // safety cap per device

// The app uploads its token + schedule here (and `{remove:true}` to opt out).
exports.registerSchedule = onRequest({ region: REGION, cors: true }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const b = req.body || {};
  if (!b.deviceId || typeof b.deviceId !== 'string') { res.status(400).json({ error: 'deviceId required' }); return; }

  const ref = db.collection(COLLECTION).doc(b.deviceId);

  if (b.remove) {
    await ref.delete().catch(() => {});
    res.json({ ok: true, removed: true });
    return;
  }

  if (!b.token || typeof b.token !== 'string') { res.status(400).json({ error: 'token required' }); return; }

  const notifications = Array.isArray(b.notifications)
    ? b.notifications
        .filter(n => n && typeof n.date === 'string' && typeof n.title === 'string' && typeof n.body === 'string')
        .slice(0, MAX_NOTIFS)
    : [];

  await ref.set({
    token: b.token,
    lang: typeof b.lang === 'string' ? b.lang : 'tr',
    tz: typeof b.tz === 'string' ? b.tz : 'Europe/Istanbul',
    notifications,
    updatedAt: Date.now()
  });

  res.json({ ok: true, count: notifications.length });
});

// Today's date as yyyy-mm-dd in Europe/Istanbul (matches the client's local-date keys for TR users).
function istanbulTodayStr() {
  // en-CA formats as yyyy-mm-dd.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

exports.sendDailyNotifications = onSchedule(
  { schedule: 'every day 09:00', timeZone: 'Europe/Istanbul', region: REGION },
  async () => {
    const today = istanbulTodayStr();
    const snap = await db.collection(COLLECTION).get();
    const sends = [];

    snap.forEach(docSnap => {
      const data = docSnap.data() || {};
      if (!data.token || !Array.isArray(data.notifications)) return;
      const due = data.notifications.filter(n => n.date === today);
      due.forEach(n => {
        sends.push(
          getMessaging().send({
            token: data.token,
            notification: { title: n.title, body: n.body },
            android: { priority: 'high', notification: { channelId: 'fintrack' } }
          }).catch(err => {
            // Drop devices whose token is no longer valid.
            const code = err && err.code;
            if (code === 'messaging/registration-token-not-registered' ||
                code === 'messaging/invalid-argument' ||
                code === 'messaging/invalid-registration-token') {
              return docSnap.ref.delete().catch(() => {});
            }
          })
        );
      });
    });

    await Promise.all(sends);
    console.log(`sendDailyNotifications: ${today} → ${sends.length} message(s)`);
  }
);
