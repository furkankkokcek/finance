// Settings modal + import/export

function openSettingsModal(){
  document.getElementById('cfg-salary').value=S.settings.salaryDay;
  document.getElementById('cfg-nw').value=S.settings.netWorth||0;
  document.getElementById('cfg-theme').checked=S.settings.theme==='light';
  document.getElementById('cfg-notif').checked=S.settings.notifEnabled&&Notification.permission==='granted';
  document.getElementById('cfg-ppf').checked=S.settings.ppfEnabled!==false;
  updatePpfInfoTexts();
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

function exportData(){
  const json=JSON.stringify(S,null,2);
  const blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`fintrack_${S.settings.currentYear}_${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
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
