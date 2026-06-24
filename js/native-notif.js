// Native local notifications (Capacitor) — real scheduled notifications that
// fire even when the app is closed. No-op on web/PWA, where the existing
// service-worker / Notification path stays in charge.
//
// Uses @capacitor/local-notifications. The app's reminders are date-based
// (payment due days, salary-day PPF, monthly summary), so we schedule concrete
// local notifications for the current and next month and re-schedule on every
// data change (saveS → syncNotifSchedule) and language change. That keeps them
// correct without relying on background sync, which is unreliable in a WebView.

function nativeNotifAvailable(){
  return !!(window.Capacitor
    && typeof window.Capacitor.isNativePlatform === 'function'
    && window.Capacitor.isNativePlatform()
    && window.Capacitor.Plugins
    && window.Capacitor.Plugins.LocalNotifications);
}

function getLocalNotif(){ return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) || null; }

const NATIVE_NOTIF_HOUR = 9; // fire at 09:00 local time

// Check-only: never shows a prompt. Used by the frequent re-schedule path.
async function nativeNotifGranted(){
  const LN = getLocalNotif();
  if(!LN) return false;
  try{ const perm = await LN.checkPermissions(); return !!perm && perm.display === 'granted'; }
  catch(e){ return false; }
}

// Requests permission (may show a system prompt). Only called from explicit user
// actions (enabling the toggle, sending a test).
async function requestNativeNotifPermission(){
  const LN = getLocalNotif();
  if(!LN) return false;
  try{
    let perm = await LN.checkPermissions();
    if(!perm || perm.display !== 'granted') perm = await LN.requestPermissions();
    return !!perm && perm.display === 'granted';
  }catch(e){ return false; }
}

async function cancelAllNativeNotifications(){
  const LN = getLocalNotif();
  if(!LN) return;
  try{
    const pending = await LN.getPending();
    const list = (pending && pending.notifications) || [];
    if(list.length) await LN.cancel({ notifications: list.map(n=>({id:n.id})) });
  }catch(e){}
}

// Build the future-dated notifications for one month. `startId` keeps IDs unique
// and stable per month so re-scheduling cleanly replaces the previous set.
function buildMonthNativeNotifs(year, month, startId){
  const out = [];
  const now = new Date();
  let id = startId;

  // Payment due reminders (unpaid, non-zero, with a due day)
  const yd = (typeof getYear === 'function') ? getYear(year) : {expenses:[]};
  (yd.expenses||[]).forEach(exp=>{
    if(!exp.dueDay || exp.dueDay<=0) return;
    const amt = parseFloat(exp.amounts && exp.amounts[month] || 0);
    if(!amt) return;
    if(exp.status && exp.status[month]==='paid') return;
    const at = getAdjustedDueDate(year, month, exp.dueDay);
    at.setHours(NATIVE_NOTIF_HOUR, 0, 0, 0);
    if(at <= now) return;
    out.push({
      id: id++,
      title: '💳 ' + t('notif.paymentDay'),
      body: t('notif.paymentBody', {name: exp.name, amount: fmtTRY(amt)}),
      schedule: { at }
    });
  });

  // Salary day: PPF reminder + monthly summary
  const d = getMonthlyData(year, month);
  const salaryDay = S.settings.salaryDay || 1;
  const lastDay = new Date(year, month, 0).getDate();
  const sDay = Math.min(salaryDay, lastDay);
  const salaryAt = new Date(year, month-1, sDay, NATIVE_NOTIF_HOUR, 0, 0, 0);
  if(salaryAt > now){
    if(S.settings.ppfEnabled!==false && d.ppfTotal>0){
      out.push({
        id: id++,
        title: '🏦 ' + t('notif.ppfTitle'),
        body: t('notif.ppfBody', {amount: fmtTRY(d.ppfTotal)}),
        schedule: { at: salaryAt }
      });
    }
    const mname = MONTHS_FULL[month-1];
    out.push({
      id: id++,
      title: '💵 ' + t('notif.monthlySummary'),
      body: t('notif.summaryBodyLong', {month: mname, year, income: fmtTRY(d.totalIncome), expense: fmtTRY(d.totalExpense), cash: fmtTRY(d.cashLeft)}),
      schedule: { at: salaryAt }
    });
  }
  return out;
}

// (Re)schedule all native notifications for the current + next month.
async function scheduleNativeNotifications(){
  if(!nativeNotifAvailable()) return;
  const LN = getLocalNotif();
  if(!LN) return;
  if(!S.settings.notifEnabled){ await cancelAllNativeNotifications(); return; }
  // Check-only here (called on every saveS) — the toggle handles asking.
  const granted = await nativeNotifGranted();
  if(!granted) return;

  await cancelAllNativeNotifications();

  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth()+1;
  const ny = m===12 ? y+1 : y;
  const nm = m===12 ? 1 : m+1;

  let notifs = buildMonthNativeNotifs(y, m, 1000).concat(buildMonthNativeNotifs(ny, nm, 2000));
  if(!notifs.length) return;
  try{ await LN.schedule({ notifications: notifs }); }catch(e){}
}

// Fire an immediate native notification (used by the "send test now" button and
// by showPWANotification on native).
async function sendNativeNotificationNow(title, body){
  const LN = getLocalNotif();
  if(!LN) return false;
  const granted = await requestNativeNotifPermission();
  if(!granted) return false;
  try{
    await LN.schedule({ notifications: [{
      id: Math.floor(Math.random()*100000) + 500000,
      title, body: body||'',
      schedule: { at: new Date(Date.now() + 600) }
    }]});
    return true;
  }catch(e){ return false; }
}
