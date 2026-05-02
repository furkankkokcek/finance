// Dashboard page + SVG charts

function renderDashboard(){
  const year=S.settings.currentYear;
  const month=S.settings.currentMonth;
  const d=getMonthlyData(year,month);

  buildMonthTabs('month-tabs','');

  // Notification banners
  const banners=document.getElementById('notif-banners');
  banners.innerHTML='';
  const today=new Date();
  getYear(year).expenses.forEach(exp=>{
    if(!exp.dueDay) return;
    const adj=getAdjustedDueDate(year,month,exp.dueDay);
    const diff=Math.ceil((adj-today)/(1000*60*60*24));
    if(diff>=0&&diff<=3){
      const status=exp.status?.[month]||'unpaid';
      if(status!=='paid'){
        const amt=parseFloat(exp.amounts[month]||0);
        if(amt===0) return;
        const dayLbl=diff===0?'Bugün':diff===1?'Yarın':`${diff} gün sonra`;
        banners.innerHTML+=`<div class="notif-banner"><div class="notif-icon">⏰</div><div class="notif-text"><b>${dayLbl}:</b> ${exp.name} — <b>${fmtTRY(amt)}</b> ödemesi</div></div>`;
      }
    }
  });

  // Salary day PPF
  const sd=S.settings.salaryDay;
  const daysToSalary=sd-today.getDate();
  if(S.settings.ppfEnabled!==false&&daysToSalary>=0&&daysToSalary<=3&&d.ppfTotal>0){
    const salaryLbl=daysToSalary===0?'Bugün':daysToSalary===1?'Yarın':`${daysToSalary} gün sonra`;
    banners.innerHTML+=`<div class="notif-banner" style="background:var(--purple-bg);border-color:rgba(168,85,247,.25)"><div class="notif-icon">🏦</div><div class="notif-text"><b>${salaryLbl}</b> maş günü! PPF: <b style="color:var(--purple)">${fmtTRY(d.ppfTotal)}</b></div></div>`;
  }

  // Stat cards
  document.getElementById('dash-stats').innerHTML=`
    <div class="stat-card">
      <div class="stat-label">🤑 Toplam Gelir</div>
      <div class="stat-value pos">${fmtTRY(d.totalIncome)}</div>
      <div class="stat-sub">${MONTHS_FULL[month-1]} ${year}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">💸 Toplam Gider</div>
      <div class="stat-value neg">${fmtTRY(d.totalExpense)}</div>
      <div class="stat-sub">+${fmtTRY(d.investment)} yatırım</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">💲 Nakit Kalan</div>
      <div class="stat-value ${d.cashLeft>=0?'pos':'neg'}">${fmtTRY(d.cashLeft)}</div>
      <div class="stat-sub">Gelir - Gider - Yatırım</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">📈 Tasarruf Oranı</div>
      <div class="stat-value acc">${fmtPct(d.savingsRate)}</div>
      <div class="stat-sub">Yatırım/Gelir</div>
    </div>`;

  // PPF Box
  const ppfBox=document.getElementById('dash-ppf');
  if(S.settings.ppfEnabled!==false && d.ppfTotal>0){
    ppfBox.innerHTML=`<div class="ppf-box"><div class="ppf-title">Bu Ay PPF Tutarı</div><div class="ppf-amount">${fmtTRY(d.ppfTotal)}</div></div>`;
  } else { ppfBox.innerHTML=''; }

  // Year Table Button
  document.getElementById('dash-yeartable-btn').innerHTML=`<button style="width:100%;padding:12px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r2);color:var(--muted);font-size:13px;font-weight:600;cursor:pointer" onclick="openYearTable()">📋 Yıllık Tablo</button>`;

  // Charts
  renderBarChart();
  renderPieChart(d);
  renderTrendChart();
  renderSpendingPieChart();

  // Share button
  const statsEl=document.getElementById('dash-stats');
  if(!document.getElementById('share-btn-wrap')){
    const wrap=document.createElement('div');
    wrap.id='share-btn-wrap';
    wrap.innerHTML=`<button class="share-btn" onclick="shareWhatsApp()"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>WhatsApp'ta Paylaş</button>`;
    statsEl.after(wrap);
  }
}

function renderBarChart(){
  const year=S.settings.currentYear;
  const W=340, H=140, PB=30, PT=10;
  let maxVal=0;
  const bars=MONTHS.map((_,i)=>{
    const d=getMonthlyData(year,i+1);
    if(d.totalIncome>maxVal) maxVal=d.totalIncome;
    if(d.totalExpense>maxVal) maxVal=d.totalExpense;
    return d;
  });
  if(maxVal===0){
    document.getElementById('chart-bar').innerHTML=`<div class="chart-title">Aylık Gelir / Gider</div><div class="empty"><div class="empty-icon">📊</div><div class="empty-text">Henüz veri yok</div></div>`;
    return;
  }
  const cm=S.settings.currentMonth;
  const barW=W/12;
  const iW=barW*0.38;
  const eW=barW*0.38;
  let svgBars='';
  bars.forEach((d,i)=>{
    const x=i*barW+barW/2;
    const iH=(d.totalIncome/maxVal)*(H-PT-PB);
    const eH=(d.totalExpense/maxVal)*(H-PT-PB);
    const active=i+1===cm;
    svgBars+=`<rect x="${x-iW-1}" y="${H-PB-iH}" width="${iW}" height="${iH}" rx="2" fill="${active?'#22c55e':'rgba(34,197,94,.35)'}}"/>`;
    svgBars+=`<rect x="${x+1}" y="${H-PB-eH}" width="${eW}" height="${eH}" rx="2" fill="${active?'#ef4444':'rgba(239,68,68,.35)'}"/>`;
    svgBars+=`<text x="${x}" y="${H-PB+14}" text-anchor="middle" fill="${active?'var(--text)':'var(--muted2)'}" font-size="8.5" font-family="Outfit">${MONTHS[i]}</text>`;
    if(active){
      svgBars+=`<rect x="${x-barW/2}" y="${PT}" width="${barW}" height="${H-PT-PB+4}" rx="2" fill="rgba(245,158,11,.06)" stroke="rgba(245,158,11,.2)" stroke-width="1"/>`;
    }
  });

  document.getElementById('chart-bar').innerHTML=`
    <div class="chart-title">Aylık Gelir / Gider</div>
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" height="${H}">
      <line x1="0" y1="${H-PB}" x2="${W}" y2="${H-PB}" stroke="var(--border)" stroke-width="1"/>
      ${svgBars}
    </svg>
    <div class="chart-legend">
      <div class="legend-item"><div class="legend-dot" style="background:#22c55e"></div>Gelir</div>
      <div class="legend-item"><div class="legend-dot" style="background:#ef4444"></div>Gider</div>
    </div>`;
}

function renderPieChart(d){
  const total=d.totalExpense;
  const el=document.getElementById('chart-pie');
  if(total===0){
    el.innerHTML=`<div class="chart-title">Gider Dağılımı</div><div style="text-align:center;color:var(--muted);font-size:12px;padding:20px 0">Veri yok</div>`;
    return;
  }
  const segs=[
    {val:d.sabitTotal,color:'#3b82f6',label:'Sabit'},
    {val:d.krediTotal,color:'#a855f7',label:'Kredi'},
    {val:d.kkTotal,color:'#f59e0b',label:'KK'},
  ].filter(s=>s.val>0);
  const R=55,cx=70,cy=70,r=40;
  let startAngle=-Math.PI/2;
  let paths='';
  segs.forEach(seg=>{
    const angle=(seg.val/total)*Math.PI*2;
    const endAngle=startAngle+angle;
    const x1=cx+R*Math.cos(startAngle)/1.27;
    const y1=cy+R*Math.sin(startAngle)/1.27;
    const x2=cx+R*Math.cos(endAngle)/1.27;
    const y2=cy+R*Math.sin(endAngle)/1.27;
    const la=angle>Math.PI?1:0;
    paths+=`<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${la},1 ${x2},${y2} Z" fill="${seg.color}" opacity=".85"/>`;
    startAngle=endAngle;
  });
  paths+=`<circle cx="${cx}" cy="${cy}" r="${r*0.5}" fill="var(--bg3)"/>`;

  const legendHtml=segs.map(s=>`<div class="legend-item"><div class="legend-dot" style="background:${s.color}"></div>${s.label}: ${Math.round(s.val/total*100)}%</div>`).join('');

  el.innerHTML=`<div class="chart-title">Gider Dağılımı</div>
    <svg class="chart-svg" viewBox="0 0 140 140" height="110" style="display:block;margin:0 auto">
      ${paths}
    </svg>
    <div class="chart-legend">${legendHtml}</div>`;
}

function renderTrendChart(){
  const year=S.settings.currentYear;
  const W=200,H=110,PB=20,PT=10;
  const vals=[];
  let minV=Infinity,maxV=-Infinity;
  for(let m=1;m<=12;m++){
    const d=getMonthlyData(year,m);
    vals.push(d.cashLeft);
    if(d.cashLeft<minV) minV=d.cashLeft;
    if(d.cashLeft>maxV) maxV=d.cashLeft;
  }
  const range=maxV-minV||1;
  const el=document.getElementById('chart-trend');

  const pts=vals.map((v,i)=>{
    const x=i*(W-10)/(11)+5;
    const y=PT+(1-(v-minV)/range)*(H-PT-PB);
    return `${x},${y}`;
  }).join(' ');

  const zeroY=PT+(1-(0-minV)/range)*(H-PT-PB);

  el.innerHTML=`<div class="chart-title">Nakit Kalan Trendi</div>
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" height="${H}">
      <line x1="0" y1="${Math.min(H-PB,Math.max(PT,zeroY))}" x2="${W}" y2="${Math.min(H-PB,Math.max(PT,zeroY))}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3,3"/>
      <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${vals.map((v,i)=>{const x=i*(W-10)/(11)+5;const y=PT+(1-(v-minV)/range)*(H-PT-PB);return `<circle cx="${x}" cy="${y}" r="${i+1===S.settings.currentMonth?4:2}" fill="${v>=0?'var(--success)':'var(--danger)'}" opacity="${i+1===S.settings.currentMonth?1:.6}"/>`;}).join('')}
    </svg>`;
}

function renderSpendingPieChart(){
  const year=S.settings.currentYear;
  const month=S.settings.currentMonth;
  const yd=getYear(year);
  const el=document.getElementById('chart-spending-pie');
  if(!el) return;

  const items=yd.spending.filter(s=>{
    const d=new Date(s.date);
    return d.getFullYear()===year&&d.getMonth()+1===month;
  });

  if(items.length===0){
    el.innerHTML=`<div class="chart-title">Harcama Dağılımı — ${MONTHS_FULL[month-1]}</div><div style="text-align:center;color:var(--muted);font-size:12px;padding:16px 0">Bu ay harcama kaydı yok</div>`;
    return;
  }

  const catColors={market:'#22c55e',restoran:'#f59e0b',ulasim:'#3b82f6',giyim:'#ec4899',eglence:'#a855f7',saglik:'#06b6d4',egitim:'#f97316',diger:'#6b7280'};
  const totals={};
  items.forEach(s=>{
    const cat=s.category||'diger';
    totals[cat]=(totals[cat]||0)+parseFloat(s.amount||0);
  });
  const grandTotal=Object.values(totals).reduce((a,b)=>a+b,0);
  const segs=Object.entries(totals)
    .filter(([,v])=>v>0)
    .sort((a,b)=>b[1]-a[1])
    .map(([cat,val])=>({cat,val,color:catColors[cat]||'#6b7280',label:SPD_CATS[cat]||cat}));

  const W=300,cx=78,cy=82,R=65,ri=40;
  let startAngle=-Math.PI/2;
  let paths='';
  segs.forEach(seg=>{
    const angle=(seg.val/grandTotal)*Math.PI*2;
    const endAngle=startAngle+angle;
    const x1=cx+R*Math.cos(startAngle);
    const y1=cy+R*Math.sin(startAngle);
    const x2=cx+R*Math.cos(endAngle);
    const y2=cy+R*Math.sin(endAngle);
    const la=angle>Math.PI?1:0;
    paths+=`<path d="M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 ${la},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${seg.color}" opacity=".9"/>`;
    startAngle=endAngle;
  });
  paths+=`<circle cx="${cx}" cy="${cy}" r="${ri}" fill="var(--bg3)"/>`;
  paths+=`<text x="${cx}" y="${cy-5}" text-anchor="middle" fill="var(--muted)" font-size="8" font-family="Outfit">TOPLAM</text>`;
  paths+=`<text x="${cx}" y="${cy+9}" text-anchor="middle" fill="var(--text)" font-size="11" font-weight="600" font-family="Outfit">${fmtTRY(grandTotal)}</text>`;

  let legend='';
  const lx=160;
  segs.slice(0,7).forEach((seg,i)=>{
    const ly=12+i*22;
    legend+=`<rect x="${lx}" y="${ly}" width="11" height="11" rx="2" fill="${seg.color}"/>`;
    legend+=`<text x="${lx+15}" y="${ly+9}" fill="var(--text)" font-size="10" font-family="Outfit" font-weight="500">${seg.label}</text>`;
    legend+=`<text x="${W-4}" y="${ly+9}" text-anchor="end" fill="var(--muted)" font-size="9" font-family="Outfit">${Math.round(seg.val/grandTotal*100)}% · ${fmtTRY(seg.val)}</text>`;
  });

  el.innerHTML=`<div class="chart-title">Harcama Dağılımı — ${MONTHS_FULL[month-1]}</div>
    <svg class="chart-svg" viewBox="0 0 ${W} 165" height="165" style="width:100%;display:block">
      ${paths}
      ${legend}
    </svg>`;
}
