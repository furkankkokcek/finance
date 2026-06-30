// Server-driven push notifications (Firebase Cloud Messaging).
//
// Why: native local notifications only cover the months the app has scheduled
// and can be delayed/dropped by Doze/battery optimization. With FCM, a Firebase
// Cloud Function sends the day's reminders from the server, so they arrive even
// when the app is closed or hasn't been opened for a long time — as long as the
// app was opened at least ONCE to register its FCM token.
//
// Privacy ("minimum data"): only pre-rendered notification text (title/body) and
// the trigger DATE leave the device — never the raw budget structure. The text
// does contain amounts, since that's the point of the reminder.
//
// Native-only; no-op on web/PWA and when PUSH_ENDPOINT is empty.
//
// SETUP: deploy the Firebase functions (see PUSH-SETUP.md), then paste your
// deployed `registerSchedule` URL below. Empty = push disabled (local
// notifications still work).
const PUSH_ENDPOINT = 'https://europe-west1-fintrack-d74b7.cloudfunctions.net/registerSchedule';

const PUSH_HORIZON_MONTHS = 6; // how far ahead to pre-render notifications

function getPushPlugin(){
  return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications) || null;
}
function pushAvailable(){
  return !!(window.Capacitor
    && typeof window.Capacitor.isNativePlatform === 'function'
    && window.Capacitor.isNativePlatform()
    && getPushPlugin());
}
function pushConfigured(){ return !!PUSH_ENDPOINT; }

let _pushToken = null;
let _pushUploadTimer = null;
let _pushListenersAdded = false;

// Stable per-install id so token refreshes update the same Firestore doc.
function pushDeviceId(){
  if(!S.settings.pushDeviceId){
    S.settings.pushDeviceId = 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,10);
    saveS();
  }
  return S.settings.pushDeviceId;
}

async function initPush(){
  if(!pushAvailable() || !pushConfigured()) return;
  const Push = getPushPlugin();
  try{
    let perm = await Push.checkPermissions();
    if(perm.receive !== 'granted') perm = await Push.requestPermissions();
    if(perm.receive !== 'granted') return;

    if(!_pushListenersAdded){
      _pushListenersAdded = true;
      // Token arrives (and on refresh) → (re)upload schedule.
      Push.addListener('registration', token => { _pushToken = token.value; uploadPushSchedule(); });
      Push.addListener('registrationError', () => {});
      // Dedicated Android channel so server messages land in a known channel.
      if(Push.createChannel){
        try{ await Push.createChannel({ id:'fintrack', name:'FinTrack', importance:5, visibility:1 }); }catch(e){}
      }
    }
    await Push.register();
  }catch(e){}
}

// Build pre-rendered {date, title, body} items for the next N months.
function buildPushSchedule(){
  if(typeof collectMonthNotifEvents !== 'function') return [];
  const out = [];
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  let y = now.getFullYear(), m = now.getMonth()+1;
  for(let i=0; i<PUSH_HORIZON_MONTHS; i++){
    collectMonthNotifEvents(y, m).forEach(ev=>{
      if(ev.at < todayStart) return;
      const dt = ev.at;
      const date = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
      out.push({ date, title: ev.title, body: ev.body });
    });
    m++; if(m>12){ m=1; y++; }
  }
  return out;
}

// Debounced upload — coalesces the many saveS() calls during editing.
function uploadPushSchedule(){
  if(!pushAvailable() || !pushConfigured()) return;
  clearTimeout(_pushUploadTimer);
  _pushUploadTimer = setTimeout(doUploadPushSchedule, 1500);
}

async function doUploadPushSchedule(){
  if(!_pushToken) return;
  try{
    // Notifications disabled → remove server schedule so nothing is sent.
    if(!S.settings.notifEnabled){
      await fetch(PUSH_ENDPOINT, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ deviceId: pushDeviceId(), remove: true })
      });
      return;
    }
    const payload = {
      deviceId: pushDeviceId(),
      token: _pushToken,
      lang: (typeof getLang==='function') ? getLang() : 'tr',
      tz: (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'Europe/Istanbul',
      notifications: buildPushSchedule()
    };
    await fetch(PUSH_ENDPOINT, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
  }catch(e){}
}
