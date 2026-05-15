// Notifications

async function toggleNotif(el){
  if(el.checked){
    if(!('Notification' in window)){el.checked=false;alert('Tarayıcınız bildirimleri desteklemiyor.');return;}
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){el.checked=false;return;}
    S.settings.notifEnabled=true;
    saveS();
    registerPeriodicSync();
  } else {
    S.settings.notifEnabled=false;
    saveS();
    unregisterPeriodicSync();
  }
}

function checkDailyNotifications(){
  if(!S.settings.notifEnabled||Notification.permission!=='granted') return;
  const today=todayStr();
  if(S.settings.lastNotifDate===today) return;
  S.settings.lastNotifDate=today;
  saveS();

  const now=new Date();
  const year=now.getFullYear();
  const month=now.getMonth()+1;

  // Payment due today
  getYear(year).expenses.forEach(exp=>{
    if(!exp.dueDay) return;
    const adj=getAdjustedDueDate(year,month,exp.dueDay);
    if(adj.toDateString()===now.toDateString()){
      const amt=parseFloat(exp.amounts[month]||0);
      if(amt===0) return;
      const body=`${exp.name} — ${fmtTRY(amt)} bugün ödenmeli.`;
      new Notification('💳 Ödeme Günü!',{body,icon:'/icons/icon-192.png'});
      addNotifEntry('payment_due','💳','Ödeme Günü!',body);
    }
  });

  // Salary day
  const sd=S.settings.salaryDay;
  if(now.getDate()===sd){
    const d=getMonthlyData(year,month);
    if(S.settings.ppfEnabled!==false&&d.ppfTotal>0){
      const body=`Bu ay PPF hesabına atılacak tutar: ${fmtTRY(d.ppfTotal)}`;
      new Notification('🏦 PPF Hatırlatması',{body,icon:'/icons/icon-192.png'});
      addNotifEntry('ppf','🏦','PPF Hatırlatması',body);
    }
    const body=`${MONTHS_FULL[month-1]} ${year} — Gelir: ${fmtTRY(d.totalIncome)}, Gider: ${fmtTRY(d.totalExpense)}, Nakit: ${fmtTRY(d.cashLeft)}`;
    new Notification('💵 Aylık Mali Özet',{body:`${MONTHS_FULL[month-1]} ${year}\nGelir: ${fmtTRY(d.totalIncome)}\nGider: ${fmtTRY(d.totalExpense)}\nNakit Kalan: ${fmtTRY(d.cashLeft)}`,icon:'/icons/icon-192.png'});
    addNotifEntry('monthly_summary','💵','Aylık Mali Özet',body);
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

function renderNotifCenter(){
  const body=document.getElementById('notif-center-body');
  if(!body) return;
  if(!S.notifLog||!S.notifLog.length){
    body.innerHTML='<div style="text-align:center;color:var(--muted);padding:40px 0;font-size:14px">Henüz bildirim yok</div>';
    return;
  }
  body.innerHTML=S.notifLog.map(n=>`
    <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
      <div style="font-size:22px;line-height:1;padding-top:2px;flex-shrink:0">${n.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;color:var(--text);font-size:14px">${n.title}</div>
        <div style="color:var(--muted);font-size:13px;margin-top:2px;line-height:1.4">${n.body}</div>
        <div style="color:var(--muted2,var(--muted));font-size:11px;margin-top:4px">${fmtRelTime(n.ts)}</div>
      </div>
    </div>`).join('');
}

function fmtRelTime(ts){
  const diff=Date.now()-ts;
  if(diff<60000) return 'Az önce';
  if(diff<3600000) return Math.floor(diff/60000)+' dk önce';
  if(diff<86400000) return Math.floor(diff/3600000)+' saat önce';
  return Math.floor(diff/86400000)+' gün önce';
}

// ── Background Sync (IndexedDB bridge for SW) ─────────────────────────────

function syncNotifSchedule(){
  if(!window.indexedDB) return;
  const now=new Date(); const year=now.getFullYear(); const month=now.getMonth()+1;
  const d=getMonthlyData(year,month);
  const dueDayExpenses=getYear(year).expenses
    .filter(exp=>exp.dueDay&&exp.dueDay>0)
    .map(exp=>({name:exp.name,dueDay:exp.dueDay,amount:parseFloat(exp.amounts[month]||0),isPaid:!!(exp.status&&exp.status[month]==='paid')}));
  const schedule={id:'current',notifEnabled:S.settings.notifEnabled,salaryDay:S.settings.salaryDay,
    lastNotifDate:S.settings.lastNotifDate,year,month,
    monthSummary:{totalIncome:d.totalIncome,totalExpense:d.totalExpense,investment:d.investment,cashLeft:d.cashLeft,ppfTotal:d.ppfTotal,monthName:MONTHS_FULL[month-1]},
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
  if(Notification.permission!=='granted') return;
  _testNotifIntervalId = setInterval(()=>{
    const ts = new Date().toLocaleTimeString('tr-TR');
    const body = `Test bildirimi: ${ts}`;
    new Notification('🧪 Test Bildirimi',{body,icon:'/icons/icon-192.png'});
    addNotifEntry('test','🧪','Test Bildirimi',body);
  }, 10*60*1000);
}

function stopTestNotifMode(){
  if(_testNotifIntervalId){ clearInterval(_testNotifIntervalId); _testNotifIntervalId=null; }
}

async function toggleTestNotif(el){
  if(el.checked){
    if(!('Notification' in window)){el.checked=false;alert('Tarayıcınız bildirimleri desteklemiyor.');return;}
    if(Notification.permission!=='granted'){
      const p = await Notification.requestPermission();
      if(p!=='granted'){el.checked=false;return;}
    }
    S.settings.testNotifEnabled=true;
    saveS();
    startTestNotifMode();
    const body = 'Her 10 dakikada bir test bildirimi gelecek (uygulama açıkken).';
    new Notification('🧪 Test Modu Aktif',{body,icon:'/icons/icon-192.png'});
    addNotifEntry('test','🧪','Test Modu Aktif',body);
  } else {
    S.settings.testNotifEnabled=false;
    saveS();
    stopTestNotifMode();
  }
}

function sendTestNotificationNow(){
  if(!('Notification' in window)){alert('Tarayıcınız bildirimleri desteklemiyor.');return;}
  if(Notification.permission!=='granted'){
    alert('Önce bildirim izni vermelisiniz. Bildirimler toggle\'ını açın.');
    return;
  }
  const ts = new Date().toLocaleTimeString('tr-TR');
  const body = `Anlık test bildirimi — ${ts}`;
  new Notification('🔔 Anlık Test',{body,icon:'/icons/icon-192.png'});
  addNotifEntry('test','🔔','Anlık Test',body);
}

// ── Diagnostic ────────────────────────────────────────────────────────────

function getNotifDiagnostic(){
  const lines = [];
  if(!('Notification' in window)){
    lines.push('❌ Tarayıcı bildirimleri desteklemiyor');
  } else {
    const p = Notification.permission;
    lines.push(`İzin durumu: ${p==='granted'?'✅ İzinli':p==='denied'?'❌ Reddedildi':'⚠️ Sorulmadı'}`);
  }
  lines.push(`Uygulama içi bildirim: ${S.settings.notifEnabled?'✅ Açık':'❌ Kapalı'}`);
  const installed = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  lines.push(`PWA yüklü: ${installed?'✅ Evet':'⚠️ Hayır (sadece tarayıcıda — arka plan bildirimi için yüklü olmalı)'}`);
  lines.push(`Servis Worker: ${'serviceWorker' in navigator?'✅ Destekleniyor':'❌ Desteklenmiyor'}`);
  const periodicSupport = 'PeriodicSyncManager' in window;
  lines.push(`Arka plan sync: ${periodicSupport?'Tarayıcı destekliyor':'⚠️ Desteklenmiyor (sadece Chrome Android yüklü PWA)'}`);
  lines.push(`Son bildirim tarihi: ${S.settings.lastNotifDate||'—'}`);
  lines.push(`Test Modu: ${S.settings.testNotifEnabled?'✅ Aktif':'Kapalı'}`);
  return lines.join('\n');
}

function showNotifDiagnostic(){
  alert('Bildirim Durumu:\n\n' + getNotifDiagnostic());
}
