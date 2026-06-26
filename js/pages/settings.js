// Settings modal + import/export + card/holiday management

function openSettingsModal(){
  document.getElementById('cfg-salary').value=S.settings.salaryDay;
  document.getElementById('cfg-theme').checked=S.settings.theme==='light';
  // On native the web Notification API is irrelevant; reflect the stored setting.
  const notifOn=(typeof nativeNotifAvailable==='function'&&nativeNotifAvailable())
    ? !!S.settings.notifEnabled
    : !!(S.settings.notifEnabled&&notifPermission()==='granted');
  document.getElementById('cfg-notif').checked=notifOn;
  document.getElementById('cfg-ppf').checked=S.settings.ppfEnabled!==false;
  const testEl=document.getElementById('cfg-test-notif');
  if(testEl) testEl.checked=S.settings.testNotifEnabled===true;
  const langSel=document.getElementById('cfg-language');
  if(langSel) langSel.value=getLang();
  updatePpfInfoTexts();
  renderHolidayList();
  openModal('overlay-settings');
}

function togglePpf(el){
  S.settings.ppfEnabled=el.checked;
  saveS();
  updatePpfInfoTexts();
}

function updatePpfInfoTexts(){
  const enabled=S.settings.ppfEnabled!==false;
  const ppfInfoEl=document.getElementById('notif-info-ppf');
  const noPpfInfoEl=document.getElementById('notif-info-noppf');
  if(ppfInfoEl) ppfInfoEl.style.display=enabled?'':'none';
  if(noPpfInfoEl) noPpfInfoEl.style.display=enabled?'none':'';
  const subEl=document.getElementById('cfg-notif-sub');
  if(subEl) subEl.textContent=enabled?t('settings.notifSubBoth'):t('settings.notifSubPay');
}

function saveSettings(){
  S.settings.salaryDay=parseInt(document.getElementById('cfg-salary').value)||1;
  S.settings.ppfEnabled=document.getElementById('cfg-ppf').checked;
  saveS();
  closeModal('overlay-settings');
  renderPage(currentPage);
  alert(t('settings.savedAlert'));
}

// Salary/income day now auto-saves on change (the explicit "Kaydet" button was removed).
function saveSalaryDay(v){
  S.settings.salaryDay=parseInt(v)||1;
  saveS();
  if(typeof renderPage==='function') renderPage(currentPage);
}

// Import a backup from the first-launch setup screen, then jump straight into the app.
function importAtSetup(e){
  const input=e.target;
  const file=input.files[0];
  if(!file){ input.value=''; return; }
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const data=JSON.parse(reader.result);
      if(!data.settings){ alert(t('settings.invalidFile')); return; }
      S=data;
      if(!S.cards||!S.settings.customHolidays) migrateToV4(S);
      S.setupDone=true;
      saveS();
      document.getElementById('setup').style.display='none';
      document.getElementById('app').style.display='block';
      applyTheme(S.settings.theme||'dark');
      if(typeof applyLocale==='function') applyLocale();
      initApp();
    }catch(err){
      alert(t('settings.fileReadError')+(err&&err.message?('\n\n['+err.message+']'):''));
    }finally{ input.value=''; }
  };
  reader.onerror=()=>{ alert(t('settings.fileReadError')); input.value=''; };
  reader.readAsText(file);
}

// ---- Holiday management ----

function renderHolidayList(){
  const el=document.getElementById('holiday-list');
  if(!el) return;
  const holidays=(S.settings.customHolidays||[]).slice().sort();
  if(holidays.length===0){
    el.innerHTML=`<div style="font-size:12px;color:var(--muted);text-align:center;padding:6px">${t('settings.noCustomHoliday')}</div>`;
    return;
  }
  el.innerHTML=holidays.map(d=>{
    const dt=new Date(d+'T12:00:00');
    const label=`${dt.getDate()} ${MONTHS_FULL[dt.getMonth()]} ${dt.getFullYear()}`;
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:var(--bg4);border-radius:var(--r3);margin-bottom:4px">
      <span style="font-size:13px;color:var(--text)">${label}</span>
      <button onclick="removeHoliday('${d}')" style="padding:2px 8px;background:var(--danger-bg);border:none;border-radius:var(--r3);color:var(--danger);font-size:11px;cursor:pointer">${t('common.delete')}</button>
    </div>`;
  }).join('');
}

function addHoliday(){
  const inp=document.getElementById('holiday-input');
  if(!inp||!inp.value){alert(t('settings.selectDate'));return;}
  if(!S.settings.customHolidays) S.settings.customHolidays=[];
  if(!S.settings.customHolidays.includes(inp.value)){
    S.settings.customHolidays.push(inp.value);
    saveS();
    renderHolidayList();
  }
  inp.value='';
}

function removeHoliday(date){
  S.settings.customHolidays=(S.settings.customHolidays||[]).filter(d=>d!==date);
  saveS();
  renderHolidayList();
}

// ---- Data export/import ----

async function exportData(){
  if(typeof showRewardedThen==='function' && !(await showRewardedThen())){ alert(t('ads.rewardNeeded')); return; }
  const now=new Date();
  const pad=n=>String(n).padStart(2,'0');
  const ts=`${todayStr()}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const json=JSON.stringify(S,null,2);
  await saveFile(`fintrack_${ts}.json`, json, 'application/json');
  S.settings.changeCount=0;
  saveS();
}

function showBackupDialog(){
  if(confirm(t('settings.backupSuggest'))){
    exportData();
  }
}

async function importData(e){
  const input=e.target;
  const file=input.files[0];
  if(!file){ input.value=''; return; }
  if(typeof showRewardedThen==='function' && !(await showRewardedThen())){ alert(t('ads.rewardNeeded')); input.value=''; return; }
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const data=JSON.parse(reader.result);
      if(!data.settings){alert(t('settings.invalidFile'));return;}
      if(confirm(t('settings.importConfirm'))){
        S=data;
        if(!S.cards||!S.settings.customHolidays) migrateToV4(S);
        saveS();
        applyTheme(S.settings.theme||'dark');
        closeModal('overlay-settings');
        document.getElementById('year-btn').textContent=S.settings.currentYear;
        applyLocale();
        renderPage(currentPage);
        alert(t('settings.importSuccess'));
      }
    }catch(err){
      alert(t('settings.fileReadError')+(err&&err.message?('\n\n['+err.message+']'):''));
    }finally{
      // Clear the input ONLY after the read finished. Clearing it earlier (before
      // readAsText) releases the file's content:// URI on Android, so the read
      // returns empty/partial data and JSON.parse fails ("file unreadable").
      input.value='';
    }
  };
  reader.onerror=()=>{ alert(t('settings.fileReadError')); input.value=''; };
  reader.readAsText(file);
}

function clearAllData(){
  if(!confirm(t('settings.clearConfirm1'))) return;
  if(!confirm(t('settings.clearConfirm2'))) return;
  // Stop the pagehide/visibilitychange autosave from writing the still-full
  // in-memory S back to storage during the reload (that's why it "didn't work").
  _skipAutoSave=true;
  localStorage.removeItem('fintrack_v4');
  localStorage.removeItem('fintrack_v3');
  location.reload();
}

async function forceRefreshCache(){
  if(!confirm(t('settings.cacheConfirm'))) return;
  try{
    if('serviceWorker' in navigator){
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.unregister()));
    }
    if('caches' in window){
      const keys=await caches.keys();
      await Promise.all(keys.map(k=>caches.delete(k)));
    }
  }catch(e){}
  location.reload();
}

// ---- Exit guard (Android back button) ----

function setupExitGuard(){
  history.pushState(null,'',location.href);
  window.addEventListener('popstate',()=>{
    if((S.settings.changeCount||0)>0){
      history.pushState(null,'',location.href);
      if(confirm(t('settings.exitGuard'))){
        exportData();
      }
    }
  });
}
