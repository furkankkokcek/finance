// Notifications

// Android WebView (and some browsers) may not expose the Notification API at
// all — touching `Notification.permission` then throws a ReferenceError that can
// abort whatever code is running (e.g. the settings modal failing to open on a
// real device while working in the emulator). These helpers make every check
// safe regardless of platform.
function notifSupported(){ return typeof Notification !== 'undefined'; }
function notifPermission(){ return notifSupported() ? Notification.permission : 'denied'; }

// SW-based notification — works on iOS PWA (16.4+) and Android; falls back to Notification API.
// Inside the Capacitor native app it routes through native local notifications instead.
async function showPWANotification(title, opts) {
  if (typeof nativeNotifAvailable === 'function' && nativeNotifAvailable()) {
    const ok = await sendNativeNotificationNow(title, opts && opts.body);
    if (ok) return;
  }
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, opts);
      return;
    } catch(e) {}
  }
  try { new Notification(title, opts); } catch(e) {}
}

// True when running inside the Capacitor native app (regardless of whether the
// LocalNotifications plugin is wired up yet).
function isNativeApp(){
  return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
}

async function toggleNotif(el){
  if(el.checked){
    // Native app: use Capacitor LocalNotifications (real scheduled notifications).
    if(typeof nativeNotifAvailable==='function' && nativeNotifAvailable()){
      const granted=await requestNativeNotifPermission();
      if(!granted){el.checked=false;return;}
      S.settings.notifEnabled=true;
      saveS();
      await scheduleNativeNotifications();
      // Register for server push too (no-op until configured); saveS above
      // already queued a schedule upload.
      if(typeof initPush==='function') initPush();
      return;
    }
    // Native app but the LocalNotifications plugin is missing — `npm install` +
    // `npm run sync` weren't (re)run after the plugin was added. Web Notification
    // API doesn't work in WebView, so be explicit instead of falling back to it.
    if(isNativeApp()){el.checked=false;alert(t('notif.pluginMissing'));return;}
    if(!('Notification' in window)){el.checked=false;alert(t('notif.notSupported'));return;}
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){el.checked=false;return;}
    S.settings.notifEnabled=true;
    saveS();
    registerPeriodicSync();
  } else {
    S.settings.notifEnabled=false;
    saveS();
    if(typeof nativeNotifAvailable==='function' && nativeNotifAvailable()) await cancelAllNativeNotifications();
    else unregisterPeriodicSync();
  }
}

async function checkDailyNotifications(){
  if(!S.settings.notifEnabled||notifPermission()!=='granted') return;
  const today=todayStr();
  if(S.settings.lastNotifDate===today) return;
  S.settings.lastNotifDate=today;
  saveS();

  const now=new Date();
  const year=now.getFullYear();
  const month=now.getMonth()+1;

  // Payment due today
  for(const exp of getYear(year).expenses){
    if(!exp.dueDay) continue;
    const adj=getAdjustedDueDate(year,month,exp.dueDay);
    if(adj.toDateString()===now.toDateString()){
      const amt=parseFloat(exp.amounts[month]||0);
      if(amt===0) continue;
      const body=t('notif.paymentBody',{name:exp.name,amount:fmtTRY(amt)});
      await showPWANotification('💳 '+t('notif.paymentDay'),{body,icon:'/icons/icon-192.png'});
      addNotifEntry('payment_due','💳',t('notif.paymentDay'),body);
    }
  }

  // Salary day
  const sd=S.settings.salaryDay;
  if(now.getDate()===sd){
    const d=getMonthlyData(year,month);
    if(S.settings.ppfEnabled!==false&&d.ppfTotal>0){
      const body=t('notif.ppfBody',{amount:fmtTRY(d.ppfTotal)});
      await showPWANotification('🏦 '+t('notif.ppfTitle'),{body,icon:'/icons/icon-192.png'});
      addNotifEntry('ppf','🏦',t('notif.ppfTitle'),body);
    }
    const mname=MONTHS_FULL[month-1];
    const body=t('notif.summaryBody',{month:mname,year,income:fmtTRY(d.totalIncome),expense:fmtTRY(d.totalExpense),cash:fmtTRY(d.cashLeft)});
    await showPWANotification('💵 '+t('notif.monthlySummary'),{body:t('notif.summaryBodyLong',{month:mname,year,income:fmtTRY(d.totalIncome),expense:fmtTRY(d.totalExpense),cash:fmtTRY(d.cashLeft)}),icon:'/icons/icon-192.png'});
    addNotifEntry('monthly_summary','💵',t('notif.monthlySummary'),body);
  }
}

// ── Notification Center ───────────────────────────────────────────────────

function addNotifEntry(type,icon,title,body){
  if(!S.notifLog) S.notifLog=[];
  S.notifLog.unshift({id:Date.now()+'-'+Math.random().toString(36).slice(2),type,icon,title,body,ts:Date.now(),seen:false});
  if(S.notifLog.length>50) S.notifLog.length=50;
  saveS();
  updateNotifBadge();
}

function updateNotifBadge(){
  const count=(S.notifLog||[]).filter(n=>!n.seen).length;
  const el=document.getElementById('notif-badge');
  if(!el) return;
  if(count>0){el.textContent=count>99?'99+':count;el.style.display='';}
  else el.style.display='none';
}

function openNotifCenter(){
  (S.notifLog||[]).forEach(n=>n.seen=true);
  saveS();
  updateNotifBadge();
  renderNotifCenter();
  openModal('overlay-notif');
}

// Live "upcoming" reminders (payment due / salary day within 3 days). These used
// to render as banners on the summary page; now they live in the notification
// center so the summary stays clean.
function getUpcomingReminders(){
  const year=S.settings.currentYear;
  const month=S.settings.currentMonth;
  const today=new Date();
  const out=[];
  getYear(year).expenses.forEach(exp=>{
    if(!exp.dueDay) return;
    const adj=getAdjustedDueDate(year,month,exp.dueDay);
    const diff=Math.ceil((adj-today)/(1000*60*60*24));
    if(diff<0||diff>3) return;
    if((exp.status?.[month]||'unpaid')==='paid') return;
    const amt=parseFloat(exp.amounts[month]||0);
    if(amt===0) return;
    const dayLbl=diff===0?t('dash.today'):diff===1?t('dash.tomorrow'):t('dash.inDays',{n:diff});
    out.push({icon:'⏰',title:dayLbl,body:`${exp.name} — <b class="amt-hideable">${fmtTRY(amt)}</b> ${t('dash.paymentSuffix')}`});
  });
  const d=getMonthlyData(year,month);
  const daysToSalary=S.settings.salaryDay-today.getDate();
  if(S.settings.ppfEnabled!==false&&daysToSalary>=0&&daysToSalary<=3&&d.ppfTotal>0){
    const salaryLbl=daysToSalary===0?t('dash.today'):daysToSalary===1?t('dash.tomorrow'):t('dash.inDays',{n:daysToSalary});
    out.push({icon:'🏦',title:salaryLbl,body:`${t('dash.salaryDayLabel')} <b class="amt-hideable">${fmtTRY(d.ppfTotal)}</b>`});
  }
  return out;
}

function renderNotifCenter(){
  const body=document.getElementById('notif-center-body');
  if(!body) return;
  const upcoming=getUpcomingReminders();
  const log=S.notifLog||[];
  if(!upcoming.length && !log.length){
    body.innerHTML='<div style="text-align:center;color:var(--muted);padding:40px 0;font-size:14px">'+t('notif.empty')+'</div>';
    return;
  }
  const row=(icon,title,sub,meta)=>`
    <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
      <div style="font-size:22px;line-height:1;padding-top:2px;flex-shrink:0">${icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;color:var(--text);font-size:14px">${title}</div>
        <div style="color:var(--muted);font-size:13px;margin-top:2px;line-height:1.4">${sub}</div>
        ${meta?`<div style="color:var(--muted2,var(--muted));font-size:11px;margin-top:4px">${meta}</div>`:''}
      </div>
    </div>`;
  let html='';
  if(upcoming.length){
    html+=`<div style="font-size:11px;font-weight:700;letter-spacing:.05em;color:var(--accent);text-transform:uppercase;margin:4px 0 2px">${t('notif.upcoming')}</div>`;
    html+=upcoming.map(u=>row(u.icon,u.title,u.body,'')).join('');
  }
  if(log.length){
    if(upcoming.length) html+=`<div style="font-size:11px;font-weight:700;letter-spacing:.05em;color:var(--muted);text-transform:uppercase;margin:14px 0 2px">${t('notif.history')}</div>`;
    html+=log.map(n=>row(n.icon,n.title,n.body,fmtRelTime(n.ts))).join('');
  }
  body.innerHTML=html;
}

function fmtRelTime(ts){
  const diff=Date.now()-ts;
  if(diff<60000) return t('notif.justNow');
  if(diff<3600000) return t('notif.minAgo',{n:Math.floor(diff/60000)});
  if(diff<86400000) return t('notif.hourAgo',{n:Math.floor(diff/3600000)});
  return t('notif.dayAgo',{n:Math.floor(diff/86400000)});
}

// ── Background Sync (IndexedDB bridge for SW) ─────────────────────────────

function syncNotifSchedule(){
  // Native app: (re)schedule real local notifications on every data/lang change.
  if(typeof scheduleNativeNotifications==='function' && typeof nativeNotifAvailable==='function' && nativeNotifAvailable()){
    scheduleNativeNotifications();
  }
  // Native app: (re)upload the FCM push schedule to the server (debounced, no-op
  // until push is configured).
  if(typeof uploadPushSchedule==='function') uploadPushSchedule();
  if(!window.indexedDB) return;
  const now=new Date(); const year=now.getFullYear(); const month=now.getMonth()+1;
  const d=getMonthlyData(year,month);
  const dueDayExpenses=getYear(year).expenses
    .filter(exp=>exp.dueDay&&exp.dueDay>0)
    .map(exp=>{
      const amount=parseFloat(exp.amounts[month]||0);
      // Pre-render localized strings here (SW has no i18n / t() access)
      return {name:exp.name,dueDay:exp.dueDay,amount,isPaid:!!(exp.status&&exp.status[month]==='paid'),
        title:'💳 '+t('notif.paymentDay'),
        body:t('notif.paymentBody',{name:exp.name,amount:fmtTRY(amount)})};
    });
  const mname=MONTHS_FULL[month-1];
  const schedule={id:'current',notifEnabled:S.settings.notifEnabled,salaryDay:S.settings.salaryDay,
    lastNotifDate:S.settings.lastNotifDate,year,month,lang:(S.settings&&S.settings.language)||'tr',
    monthSummary:{totalIncome:d.totalIncome,totalExpense:d.totalExpense,investment:d.investment,cashLeft:d.cashLeft,ppfTotal:d.ppfTotal,monthName:mname,
      ppfTitle:'🏦 '+t('notif.ppfTitle'),
      ppfBody:t('notif.ppfBody',{amount:fmtTRY(d.ppfTotal)}),
      summaryTitle:'💵 '+t('notif.monthlySummary'),
      summaryBody:t('notif.summaryBodyLong',{month:mname,year,income:fmtTRY(d.totalIncome),expense:fmtTRY(d.totalExpense),cash:fmtTRY(d.cashLeft)})},
    dueDayExpenses};
  const req=indexedDB.open('fintrack_notif',1);
  req.onupgradeneeded=e=>{const db=e.target.result;if(!db.objectStoreNames.contains('schedule'))db.createObjectStore('schedule',{keyPath:'id'});};
  req.onsuccess=e=>{const db=e.target.result;const tx=db.transaction('schedule','readwrite');tx.objectStore('schedule').put(schedule);tx.oncomplete=()=>db.close();};
  req.onerror=()=>{};
}

async function registerPeriodicSync(){
  if(!('serviceWorker' in navigator)) return;
  try{
    const reg=await navigator.serviceWorker.ready;
    if(!('periodicSync' in reg)) return;
    const status=await navigator.permissions.query({name:'periodic-background-sync'});
    if(status.state==='denied') return;
    await reg.periodicSync.register('daily-notif',{minInterval:24*60*60*1000});
  }catch(e){}
}

async function unregisterPeriodicSync(){
  if(!('serviceWorker' in navigator)) return;
  try{const reg=await navigator.serviceWorker.ready;if('periodicSync' in reg)await reg.periodicSync.unregister('daily-notif');}catch(e){}
}

// ── Test Mode (10-min interval, foreground only) ──────────────────────────

let _testNotifIntervalId = null;

function startTestNotifMode(){
  stopTestNotifMode();
  const nativeOK = typeof nativeNotifAvailable==='function' && nativeNotifAvailable();
  // On native, permission was granted when the toggle was enabled; the per-fire
  // call re-checks. On web, gate on the Notification permission.
  if(!nativeOK && notifPermission()!=='granted') return;
  _testNotifIntervalId = setInterval(async ()=>{
    const ts = new Date().toLocaleTimeString(i18nLocaleCode());
    const body = t('notif.testBody',{time:ts});
    await showPWANotification('🧪 '+t('notif.testTitle'),{body,icon:'/icons/icon-192.png'});
    addNotifEntry('test','🧪',t('notif.testTitle'),body);
  }, 10*60*1000);
}

function stopTestNotifMode(){
  if(_testNotifIntervalId){ clearInterval(_testNotifIntervalId); _testNotifIntervalId=null; }
}

async function toggleTestNotif(el){
  if(el.checked){
    // Native app: request permission via LocalNotifications, not the web API.
    if(typeof nativeNotifAvailable==='function' && nativeNotifAvailable()){
      const granted=await requestNativeNotifPermission();
      if(!granted){el.checked=false;return;}
    } else if(isNativeApp()){
      el.checked=false;alert(t('notif.pluginMissing'));return;
    } else {
      if(!('Notification' in window)){el.checked=false;alert(t('notif.notSupported'));return;}
      if(notifPermission()!=='granted'){
        const p = await Notification.requestPermission();
        if(p!=='granted'){el.checked=false;return;}
      }
    }
    S.settings.testNotifEnabled=true;
    saveS();
    startTestNotifMode();
    const body = t('notif.testModeBody');
    await showPWANotification('🧪 '+t('notif.testModeActive'),{body,icon:'/icons/icon-192.png'});
    addNotifEntry('test','🧪',t('notif.testModeActive'),body);
  } else {
    S.settings.testNotifEnabled=false;
    saveS();
    stopTestNotifMode();
  }
}

async function sendTestNotificationNow(){
  const ts = new Date().toLocaleTimeString(i18nLocaleCode());
  const body = t('notif.instantTestBody',{time:ts});
  // Native app: send via LocalNotifications, requesting permission if needed.
  if(typeof nativeNotifAvailable==='function' && nativeNotifAvailable()){
    const ok=await sendNativeNotificationNow('🔔 '+t('notif.instantTest'),body);
    if(!ok){alert(t('notif.permFirst'));return;}
    addNotifEntry('test','🔔',t('notif.instantTest'),body);
    alert(t('notif.sentAlert'));
    return;
  }
  if(!('Notification' in window)&&!('serviceWorker' in navigator)){
    alert(t('notif.notSupported'));return;
  }
  if(notifPermission()!=='granted'){
    alert(t('notif.permFirst'));
    return;
  }
  await showPWANotification('🔔 '+t('notif.instantTest'),{body,icon:'/icons/icon-192.png'});
  addNotifEntry('test','🔔',t('notif.instantTest'),body);
  alert(t('notif.sentAlert'));
}

// ── Diagnostic ────────────────────────────────────────────────────────────

function getNotifDiagnostic(){
  const lines = [];
  if(typeof nativeNotifAvailable==='function' && nativeNotifAvailable()){
    lines.push(t('notif.diagNativeMode'));
  } else if(isNativeApp()){
    // Inside the native app but the plugin isn't loaded — most likely the user
    // didn't re-run `npm install` and `npm run sync` after the plugin was added.
    lines.push(t('notif.diagPluginMissing'));
  }
  // Diagnostic aid: list Capacitor plugins actually registered with the runtime,
  // so we can tell "plugin missing from native build" apart from "plugin loaded
  // but not detected".
  if(isNativeApp()){
    const plugs = (window.Capacitor && window.Capacitor.Plugins) ? Object.keys(window.Capacitor.Plugins) : [];
    lines.push(`Capacitor.Plugins: ${plugs.length ? plugs.join(', ') : '—'}`);
  }
  if(!('Notification' in window)){
    lines.push(t('notif.diagNoSupport'));
  } else {
    const p = Notification.permission;
    lines.push(`${t('notif.diagPermLabel')} ${p==='granted'?t('notif.diagAllowed'):p==='denied'?t('notif.diagDenied'):t('notif.diagNotAsked')}`);
  }
  lines.push(`${t('notif.diagInAppLabel')} ${S.settings.notifEnabled?t('notif.diagOn'):t('notif.diagOff')}`);
  const installed = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  lines.push(`${t('notif.diagInstalledLabel')} ${installed?t('notif.diagInstalledYes'):t('notif.diagInstalledNo')}`);
  lines.push(`${t('notif.diagSwLabel')} ${'serviceWorker' in navigator?t('notif.diagSwYes'):t('notif.diagSwNo')}`);
  const periodicSupport = 'PeriodicSyncManager' in window;
  lines.push(`${t('notif.diagSyncLabel')} ${periodicSupport?t('notif.diagSyncYes'):t('notif.diagSyncNo')}`);
  lines.push(`${t('notif.diagLastDate')} ${S.settings.lastNotifDate||'—'}`);
  lines.push(`${t('notif.diagTestModeLabel')} ${S.settings.testNotifEnabled?t('notif.diagTestOn'):t('notif.diagTestOff')}`);
  lines.push(`${t('notif.diagCount')} ${(S.notifLog||[]).length}`);
  return lines.join('\n');
}

function showNotifDiagnostic(){
  alert(t('notif.diagTitle') + '\n\n' + getNotifDiagnostic());
}
