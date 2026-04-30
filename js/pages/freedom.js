// Freedom (Özgürlük) page

function renderOzgurluk(){
  const year=S.settings.currentYear;
  const nw=parseFloat(S.settings.netWorth||0);
  const avgExp=getAvgMonthlyExpense(year);
  const totalDebt=getTotalDebt(year);

  const levels=[
    {key:'bagimli', name:'Finansal Bağımlı',color:'#ef4444',
      desc:'Tüm borçların bittiği durum',
      target:totalDebt, label:'Toplam Borç'},
    {key:'stabilite', name:'Finansal Stabilite',color:'#f59e0b',
      desc:'Ortalama aylık giderin 3 katı',
      target:avgExp*3, label:'3× Aylık Gider'},
    {key:'portfoy', name:'Portföy Sahibi',color:'#3b82f6',
      desc:'Aylık gider × 12 × 5',
      target:avgExp*12*5, label:'5 Yıllık Gider'},
    {key:'guvenlik', name:'Finansal Güvenlik',color:'#a855f7',
      desc:'Aylık gider × 12 × 15',
      target:avgExp*12*15, label:'15 Yıllık Gider'},
    {key:'ozgur', name:'Finansal Özgür',color:'#22c55e',
      desc:'Aylık gider × 12 × 25',
      target:avgExp*12*25, label:'25 Yıllık Gider'},
  ];

  const el=document.getElementById('ozgurluk-content');

  let html=`<div class="nw-input-wrap">
    <div class="nw-label">Net Servet (Toplam Varlıklarınız)</div>
    <input class="nw-input" type="number" id="nw-input" value="${nw}" placeholder="0" onchange="updateNetWorth(this.value)">
    <div style="font-size:12px;color:var(--muted);margin-top:6px">Ort. Aylık Gider: <b style="color:var(--text)">${fmtTRY(avgExp)}</b> · Toplam Borç: <b style="color:var(--danger)">${fmtTRY(totalDebt)}</b></div>
  </div>`;

  levels.forEach((lv,i)=>{
    const progress=lv.target>0?Math.min(100,(nw/lv.target)*100):0;
    const reached=nw>=lv.target;
    html+=`<div class="freedom-card" style="${reached?`border-color:${lv.color};background:rgba(${hexToRgb(lv.color)},0.05)`:''}">
      <div class="freedom-level" style="color:${lv.color}">Seviye ${i+1}</div>
      <div class="freedom-name">${reached?'✅ ':''} ${lv.name}</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:8px">${lv.desc}</div>
      <div class="freedom-target"><b style="color:${lv.color}">${fmtTRY(lv.target)}</b> hedef (${lv.label})</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${progress}%;background:${lv.color}"></div></div>
      <div class="freedom-status">
        <span>${fmtPct(progress)} tamamlandı</span>
        <span>${reached?'<b style="color:'+lv.color+'">Ulaşıldı!</b>':`Kalan: ${fmtTRY(lv.target-nw)}`}</span>
      </div>
    </div>`;
  });

  el.innerHTML=html;
}

function hexToRgb(hex){
  const r=parseInt(hex.slice(1,3),16);
  const g=parseInt(hex.slice(3,5),16);
  const b=parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

function updateNetWorth(val){
  S.settings.netWorth=parseFloat(val)||0;
  saveS();
  renderOzgurluk();
}
