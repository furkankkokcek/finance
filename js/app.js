// App init + boot + service worker

function initApp(){
  if(!S.notifLog) S.notifLog=[];
  if(!S.cards) S.cards=[];
  if(!S.settings.customHolidays) S.settings.customHolidays=[];
  document.getElementById('year-btn').textContent=S.settings.currentYear;
  buildMonthTabs('month-tabs','');
  buildMonthTabs('gelir-month-tabs','gelir');
  buildMonthTabs('gider-month-tabs','gider');
  buildMonthTabs('harcama-month-tabs','harcama');
  applyTheme(S.settings.theme||'dark');
  applyAmountsVisibility();
  renderDashboard();
  checkDailyNotifications();
  updateNotifBadge();
  syncNotifSchedule();
  setupExitGuard();
  if(S.settings.notifEnabled&&Notification.permission==='granted') registerPeriodicSync();
  if(S.settings.testNotifEnabled&&Notification.permission==='granted') startTestNotifMode();
  setTimeout(()=>{
    document.querySelectorAll('.month-tab.active').forEach(t=>t.scrollIntoView({inline:'center',block:'nearest',behavior:'auto'}));
  },100);
}

// Silent save on tab hide / page unload
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'&&typeof saveS==='function') saveS();
});
window.addEventListener('pagehide',()=>{ if(typeof saveS==='function') saveS(); });

// Service worker
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}

// Boot
const loaded=loadS();
if(loaded&&S.setupDone){
  document.getElementById('setup').style.display='none';
  document.getElementById('app').style.display='block';
  initApp();
} else {
  document.getElementById('setup').style.display='flex';
  document.getElementById('app').style.display='none';
}
