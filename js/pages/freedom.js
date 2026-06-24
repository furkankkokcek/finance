// Freedom (Özgürlük) page

function renderOzgurluk(){
  const year=S.settings.currentYear;
  const nw=parseFloat(S.settings.netWorth||0);
  const avgExp=getAvgMonthlyExpense(year);
  const totalDebt=getTotalDebt(year);

  const levels=[
    {key:'bagimli',   color:'#ef4444', target:totalDebt,    keyN:1},
    {key:'stabilite', color:'#f59e0b', target:avgExp*3,     keyN:2},
    {key:'portfoy',   color:'#3b82f6', target:avgExp*12*5,  keyN:3},
    {key:'guvenlik',  color:'#a855f7', target:avgExp*12*15, keyN:4},
    {key:'ozgur',     color:'#22c55e', target:avgExp*12*25, keyN:5},
  ];

  const el=document.getElementById('ozgurluk-content');

  let html=`<div class="nw-input-wrap">
    <div class="nw-label">${t('freedom.netWorthLabel')}</div>
    <input class="nw-input" type="number" id="nw-input" value="${nw}" placeholder="0" onchange="updateNetWorth(this.value)">
    <div style="font-size:12px;color:var(--muted);margin-top:6px">${t('freedom.avgExpense')} <b style="color:var(--text)">${fmtTRY(avgExp)}</b> · ${t('freedom.totalDebt')} <b style="color:var(--danger)">${fmtTRY(totalDebt)}</b></div>
  </div>`;

  levels.forEach((lv,i)=>{
    const progress=lv.target>0?Math.min(100,(nw/lv.target)*100):0;
    const reached=nw>=lv.target;
    const name=t(`freedom.lvl${lv.keyN}Name`);
    const desc=t(`freedom.lvl${lv.keyN}Desc`);
    const label=t(`freedom.lvl${lv.keyN}Label`);
    html+=`<div class="freedom-card" style="${reached?`border-color:${lv.color};background:rgba(${hexToRgb(lv.color)},0.05)`:''}">
      <div class="freedom-level" style="color:${lv.color}">${t('freedom.level',{n:i+1})}</div>
      <div class="freedom-name">${reached?'✅ ':''} ${name}</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:8px">${desc}</div>
      <div class="freedom-target"><b style="color:${lv.color}">${fmtTRY(lv.target)}</b> ${t('freedom.targetSuffix')} (${label})</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${progress}%;background:${lv.color}"></div></div>
      <div class="freedom-status">
        <span>${fmtPct(progress)} ${t('freedom.completed')}</span>
        <span>${reached?'<b style="color:'+lv.color+'">'+t('freedom.reached')+'</b>':t('freedom.remaining',{amount:fmtTRY(lv.target-nw)})}</span>
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
