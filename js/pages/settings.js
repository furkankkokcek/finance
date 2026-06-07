// Settings modal + import/export + card/holiday management

function openSettingsModal(){
  document.getElementById('cfg-salary').value=S.settings.salaryDay;
  document.getElementById('cfg-theme').checked=S.settings.theme==='light';
  document.getElementById('cfg-notif').checked=S.settings.notifEnabled&&Notification.permission==='granted';
  document.getElementById('cfg-ppf').checked=S.settings.ppfEnabled!==false;
  const testEl=document.getElementById('cfg-test-notif');
  if(testEl) testEl.checked=S.settings.testNotifEnabled===true;
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
  if(subEl) subEl.textContent=enabled?'Ödeme ve PPF bildirimleri':'Ödeme bildirimleri';
}

function saveSettings(){
  S.settings.salaryDay=parseInt(document.getElementById('cfg-salary').value)||1;
  S.settings.ppfEnabled=document.getElementById('cfg-ppf').checked;
  saveS();
  closeModal('overlay-settings');
  renderPage(currentPage);
  alert('Ayarlar kaydedildi.');
}

// ---- Holiday management ----

function renderHolidayList(){
  const el=document.getElementById('holiday-list');
  if(!el) return;
  const holidays=(S.settings.customHolidays||[]).slice().sort();
  if(holidays.length===0){
    el.innerHTML=`<div style="font-size:12px;color:var(--muted);text-align:center;padding:6px">Özel tatil eklenmemiş</div>`;
    return;
  }
  el.innerHTML=holidays.map(d=>{
    const dt=new Date(d+'T12:00:00');
    const label=`${dt.getDate()} ${MONTHS_FULL[dt.getMonth()]} ${dt.getFullYear()}`;
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:var(--bg4);border-radius:var(--r3);margin-bottom:4px">
      <span style="font-size:13px;color:var(--text)">${label}</span>
      <button onclick="removeHoliday('${d}')" style="padding:2px 8px;background:var(--danger-bg);border:none;border-radius:var(--r3);color:var(--danger);font-size:11px;cursor:pointer">Sil</button>
    </div>`;
  }).join('');
}

function addHoliday(){
  const inp=document.getElementById('holiday-input');
  if(!inp||!inp.value){alert('Tarih seçin');return;}
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

function exportData(){
  const now=new Date();
  const pad=n=>String(n).padStart(2,'0');
  const ts=`${todayStr()}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const json=JSON.stringify(S,null,2);
  const blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`fintrack_${ts}.json`;a.click();
  URL.revokeObjectURL(url);
  S.settings.changeCount=0;
  saveS();
}

function showBackupDialog(){
  if(confirm('💾 Veri yedeği almanız önerilir. Şimdi dışa aktarmak ister misiniz?')){
    exportData();
  }
}

function importData(e){
  const file=e.target.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const data=JSON.parse(reader.result);
      if(!data.settings){alert('Geçersiz dosya');return;}
      if(confirm('Tüm veriler bu dosyayla değiştirilecek. Devam?')){
        S=data;
        if(!S.cards||!S.settings.customHolidays) migrateToV4(S);
        saveS();
        applyTheme(S.settings.theme||'dark');
        closeModal('overlay-settings');
        document.getElementById('year-btn').textContent=S.settings.currentYear;
        renderPage(currentPage);
        alert('İçe aktarma başarılı!');
      }
    }catch(err){alert('Dosya okunamadı');}
  };
  reader.readAsText(file);
  e.target.value='';
}

function clearAllData(){
  if(!confirm('⚠️ Tüm veriler silinecek!\nBu işlem geri alınamaz.')) return;
  if(!confirm('Son onay: Tüm yıllara ait gelir, gider ve harcama verileri silinecek. Emin misiniz?')) return;
  localStorage.removeItem('fintrack_v4');
  localStorage.removeItem('fintrack_v3');
  location.reload();
}

async function forceRefreshCache(){
  if(!confirm('Önbellek temizlenecek ve sayfa yenilenecek. Devam?')) return;
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
      if(confirm('💾 Kaydedilmemiş değişiklikler var. Yedek almak ister misiniz?')){
        exportData();
      }
    }
  });
}
