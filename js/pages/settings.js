// Settings modal + import/export + card/holiday management

function openSettingsModal(){
  document.getElementById('cfg-salary').value=S.settings.salaryDay;
  document.getElementById('cfg-nw').value=S.settings.netWorth||0;
  document.getElementById('cfg-theme').checked=S.settings.theme==='light';
  document.getElementById('cfg-notif').checked=S.settings.notifEnabled&&Notification.permission==='granted';
  document.getElementById('cfg-ppf').checked=S.settings.ppfEnabled!==false;
  const testEl=document.getElementById('cfg-test-notif');
  if(testEl) testEl.checked=S.settings.testNotifEnabled===true;
  updatePpfInfoTexts();
  renderSettingsCards();
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
  S.settings.netWorth=parseFloat(document.getElementById('cfg-nw').value)||0;
  S.settings.ppfEnabled=document.getElementById('cfg-ppf').checked;
  saveS();
  closeModal('overlay-settings');
  renderPage(currentPage);
  alert('Ayarlar kaydedildi.');
}

// ---- Card management ----

function renderSettingsCards(){
  const el=document.getElementById('settings-cards-list');
  if(!el) return;
  if(!S.cards||S.cards.length===0){
    el.innerHTML=`<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px">Kart eklenmemiş</div>`;
    return;
  }
  const year=S.settings.currentYear,month=S.settings.currentMonth;
  el.innerHTML=S.cards.map(c=>{
    const total=cardStatementTotal(year,month,c.id);
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--bg4);border-radius:var(--r2);border-left:3px solid ${c.color||'#f59e0b'};margin-bottom:6px;cursor:pointer" onclick="openEditCard('${c.id}')">
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${c.name}</div>
        <div style="font-size:11px;color:var(--muted)">Kesim: ${c.statementDay}. gün · Son ödeme: ${c.dueDay}. gün</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:12px;font-weight:700;color:var(--accent)">${fmtTRY(total)}</div>
        <div style="font-size:10px;color:var(--muted)">bu ay ekstre</div>
      </div>
    </div>`;
  }).join('');
}

function openAddCard(){
  document.getElementById('card-modal-title').textContent='Kart Ekle';
  document.getElementById('card-id').value='';
  document.getElementById('card-name').value='';
  document.getElementById('card-statement-day').value='';
  document.getElementById('card-due-day').value='';
  document.getElementById('card-color').value='#f59e0b';
  document.getElementById('card-delete-btn').style.display='none';
  openModal('overlay-card');
}

function openEditCard(id){
  const c=(S.cards||[]).find(x=>x.id===id);
  if(!c) return;
  document.getElementById('card-modal-title').textContent='Kart Düzenle';
  document.getElementById('card-id').value=c.id;
  document.getElementById('card-name').value=c.name;
  document.getElementById('card-statement-day').value=c.statementDay||'';
  document.getElementById('card-due-day').value=c.dueDay||'';
  document.getElementById('card-color').value=c.color||'#f59e0b';
  document.getElementById('card-delete-btn').style.display='block';
  openModal('overlay-card');
}

function saveCard(){
  const id=document.getElementById('card-id').value;
  const name=document.getElementById('card-name').value.trim();
  if(!name){alert('Kart adı girin');return;}
  const obj={
    id:id||uid('card'),
    name,
    statementDay:parseInt(document.getElementById('card-statement-day').value)||1,
    dueDay:parseInt(document.getElementById('card-due-day').value)||1,
    color:document.getElementById('card-color').value||'#f59e0b'
  };
  if(!S.cards) S.cards=[];
  if(id){
    const idx=S.cards.findIndex(c=>c.id===id);
    if(idx>=0) S.cards[idx]=obj; else S.cards.push(obj);
  } else {
    S.cards.push(obj);
  }
  saveS();
  closeModal('overlay-card');
  renderSettingsCards();
}

function deleteCard(){
  const id=document.getElementById('card-id').value;
  if(!confirm('Bu kartı silmek istiyor musunuz?')) return;
  S.cards=(S.cards||[]).filter(c=>c.id!==id);
  saveS();
  closeModal('overlay-card');
  renderSettingsCards();
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
