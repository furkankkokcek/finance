// App init + boot + service worker

function initApp(){
  if(!S.notifLog) S.notifLog=[];
  document.getElementById('year-btn').textContent=S.settings.currentYear;
  buildMonthTabs('month-tabs','');
  buildMonthTabs('gelir-month-tabs','gelir');
  buildMonthTabs('gider-month-tabs','gider');
  buildMonthTabs('harcama-month-tabs','harcama');
  applyTheme(S.settings.theme||'dark');
  applyAmountsVisibility();
  renderDashboard();
  checkDailyNotifications();
  checkDailyBackupPrompt();
  updateNotifBadge();
  syncNotifSchedule();
  if(S.settings.notifEnabled&&Notification.permission==='granted') registerPeriodicSync();
  if(S.settings.testNotifEnabled&&Notification.permission==='granted') startTestNotifMode();
  setTimeout(()=>{
    document.querySelectorAll('.month-tab.active').forEach(t=>t.scrollIntoView({inline:'center',block:'nearest',behavior:'auto'}));
  },100);
}


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
