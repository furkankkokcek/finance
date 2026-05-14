// Spending (Harcama) page

function renderHarcama(){
  buildMonthTabs('harcama-month-tabs','harcama');
  const year=S.settings.currentYear;
  const month=S.settings.currentMonth;
  const yd=getYear(year);
  const el=document.getElementById('harcama-content');

  // Gerçek harcamalar (satın alma ayı)
  const items=yd.spending.filter(s=>{
    const d=new Date(s.date);
    return d.getFullYear()===year&&d.getMonth()+1===month;
  }).sort((a,b)=>new Date(b.date)-new Date(a.date));

  // KK taksit sanal kayıtları (ödeme ayı)
  const kkInsts=[];
  yd.spending.forEach(s=>{
    if(!s.kk) return;
    const dateObj=new Date(s.date);
    const pm0=dateObj.getMonth()+1; // satın alma ayı
    const py=dateObj.getFullYear();
    for(let i=0;i<s.kk.n;i++){
      let pm=pm0+1+i;
      let pyr=py;
      if(pm>12){pm-=12;pyr++;}
      if(pm===month&&pyr===year){
        kkInsts.push({s, instIdx:i, instNum:i+1, total:s.kk.n, perInst:s.kk.perInst});
      }
    }
  });

  const total=items.reduce((acc,i)=>acc+parseFloat(i.amount||0),0);

  let html=`<div class="section-hdr"><div class="section-title">Harcamalar — ${MONTHS_FULL[month-1]}</div><div class="section-badge neg" style="color:var(--danger);background:var(--danger-bg)">${fmtTRY(total)}</div></div>`;

  if(items.length===0&&kkInsts.length===0){
    html+=`<div class="empty"><div class="empty-icon">🛍️</div><div class="empty-text">Bu ay harcama kaydı yok</div><div class="empty-sub">Sağ alttaki + butonuna bas</div></div>`;
  } else {
    items.forEach(s=>{
      const d=new Date(s.date);
      const kkBadge=s.kk?`<span style="font-size:10px;background:rgba(168,85,247,.15);color:var(--purple);border-radius:4px;padding:1px 5px;font-weight:700;margin-left:4px">💳 ${s.kk.n} taksit</span>`:'';
      html+=`<div class="spending-item" onclick="openEditSpending('${s.id}')">
        <div class="spending-left">
          <div class="spending-desc">${s.description}${kkBadge}</div>
          <div class="spending-meta">${SPD_CATS[s.category]||s.category} · ${d.getDate()} ${MONTHS[d.getMonth()]}</div>
        </div>
        <div class="spending-amount">-${fmtTRY(parseFloat(s.amount))}</div>
      </div>`;
    });

    if(kkInsts.length>0){
      if(items.length>0) html+=`<div style="height:6px"></div>`;
      html+=`<div class="section-hdr" style="margin-top:4px"><div class="section-title" style="font-size:12px">💳 KK Taksitleri</div></div>`;
      kkInsts.forEach(({s,instNum,total,perInst})=>{
        const d=new Date(s.date);
        html+=`<div class="spending-item" onclick="openEditSpending('${s.id}')" style="background:rgba(168,85,247,.05);border-left:3px solid rgba(168,85,247,.4)">
          <div class="spending-left">
            <div class="spending-desc">${s.description}</div>
            <div class="spending-meta">${instNum}/${total} taksit · alış ${d.getDate()} ${MONTHS[d.getMonth()]} · ${findKKCardName(s.kk.cardId)}</div>
          </div>
          <div class="spending-amount" style="color:var(--purple)">-${fmtTRY(perInst)}</div>
        </div>`;
      });
    }
  }

  el.innerHTML=html;
}

function resetSpdKK(){
  document.getElementById('spd-normal-form').style.display='block';
  document.getElementById('spd-kk-readonly').style.display='none';
  document.getElementById('spd-kk-toggle').checked=false;
  document.getElementById('spd-kk-section').style.display='none';
  document.getElementById('spd-kk-type').value='single';
  document.getElementById('spd-kk-inst-row').style.display='none';
  document.getElementById('spd-kk-inst').value='';
}

function toggleSpdKK(cb){
  document.getElementById('spd-kk-section').style.display=cb.checked?'block':'none';
  if(cb.checked){
    const cards=getYear(S.settings.currentYear).expenses.filter(e=>e.category==='kk');
    document.getElementById('spd-kk-card').innerHTML=cards.length
      ?cards.map(k=>`<option value="${k.id}">${k.name}</option>`).join('')
      :'<option value="">— KK tanımlanmamış —</option>';
  }
}

function openAddSpending(){
  document.getElementById('spending-modal-title').textContent='Harcama Ekle';
  document.getElementById('spd-id').value='';
  document.getElementById('spd-desc').value='';
  document.getElementById('spd-amount').value='';
  document.getElementById('spd-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('spd-cat').value='market';
  document.getElementById('spd-delete-btn').style.display='none';
  resetSpdKK();
  openModal('overlay-spending');
}

function openEditSpending(id){
  const yd=getYear(S.settings.currentYear);
  const s=yd.spending.find(x=>x.id===id);
  if(!s) return;
  document.getElementById('spd-id').value=id;

  if(s.kk){
    // KK harcaması — sadece sil izni
    document.getElementById('spending-modal-title').textContent='KK Harcaması';
    document.getElementById('spd-normal-form').style.display='none';
    document.getElementById('spd-kk-readonly').style.display='block';
    const cardName=findKKCardName(s.kk.cardId);
    const typeLabel=s.kk.n>1?`${s.kk.n} Taksit (aylık ${fmtTRY(s.kk.perInst)})`:'Tek Çekim';
    document.getElementById('spd-kk-readonly-info').innerHTML=
      `<div style="font-weight:700;font-size:14px;margin-bottom:6px">${s.description}</div>`+
      `<div>💳 ${cardName}</div>`+
      `<div>💰 ${fmtTRY(s.amount)} · ${typeLabel}</div>`+
      `<div>📅 ${s.date}</div>`+
      `<div style="color:var(--muted);font-size:12px;margin-top:6px">${SPD_CATS[s.category]||s.category}</div>`;
  } else {
    // Normal harcama — düzenlenebilir
    document.getElementById('spending-modal-title').textContent='Harcama Düzenle';
    document.getElementById('spd-normal-form').style.display='block';
    document.getElementById('spd-kk-readonly').style.display='none';
    document.getElementById('spd-desc').value=s.description;
    document.getElementById('spd-amount').value=s.amount;
    document.getElementById('spd-date').value=s.date;
    document.getElementById('spd-cat').value=s.category;
    document.getElementById('spd-delete-btn').style.display='block';
    resetSpdKK();
  }
  openModal('overlay-spending');
}

function findKKCardName(cardId){
  for(const y of Object.values(S.years)){
    const exp=(y.expenses||[]).find(e=>e.id===cardId);
    if(exp) return exp.name;
  }
  return 'Bilinmeyen KK';
}

function saveSpending(){
  const year=S.settings.currentYear;
  const yd=getYear(year);
  const id=document.getElementById('spd-id').value;
  const desc=document.getElementById('spd-desc').value.trim();
  const amount=parseFloat(document.getElementById('spd-amount').value)||0;
  const date=document.getElementById('spd-date').value;
  const cat=document.getElementById('spd-cat').value;
  if(!desc||!amount||!date){alert('Tüm alanları doldurun');return;}

  const kkActive=document.getElementById('spd-kk-toggle').checked;
  let kkMeta=null;
  if(kkActive){
    const kkId=document.getElementById('spd-kk-card').value;
    if(!kkId){alert('Kredi kartı seçin');return;}
    const type=document.getElementById('spd-kk-type').value;
    const n=type==='inst'?(parseInt(document.getElementById('spd-kk-inst').value)||1):1;
    if(type==='inst'&&n<2){alert('Taksit sayısı en az 2 olmalı');return;}
    const perInst=Math.round(amount/n*100)/100;
    const dateObj=new Date(date);
    const purchaseMonth=dateObj.getMonth()+1;
    const purchaseYear=dateObj.getFullYear();
    let skipped=0;
    for(let i=0;i<n;i++){
      let pm=purchaseMonth+1+i;
      let py=purchaseYear;
      if(pm>12){pm-=12;py++;}
      const kkExp=(S.years[py]?.expenses||[]).find(e=>e.id===kkId);
      if(!kkExp){skipped++;continue;}
      kkExp.amounts=kkExp.amounts||{};
      kkExp.amounts[pm]=Math.round((parseFloat(kkExp.amounts[pm]||0)+perInst)*100)/100;
    }
    if(skipped>0) alert(`${skipped} taksit farklı yıla taşıdığı için eklenemedi. Gider sekmesinden manuel ekleyebilirsin.`);
    kkMeta={cardId:kkId, n, perInst};
  }

  const obj={id:id||uid('spd'),description:desc,amount,date,category:cat};
  if(kkMeta) obj.kk=kkMeta;
  if(id){
    const idx=yd.spending.findIndex(s=>s.id===id);
    if(idx>=0) yd.spending[idx]=obj;
  } else {
    yd.spending.push(obj);
  }
  closeModal('overlay-spending');
  renderHarcama();
  if(kkActive) renderGider();
  trackChange();
}

function deleteSpending(){
  const id=document.getElementById('spd-id').value;
  const year=S.settings.currentYear;
  const yd=getYear(year);
  const s=yd.spending.find(x=>x.id===id);
  if(!s) return;

  const confirmMsg=s.kk
    ?'Bu KK harcaması silinecek ve ilgili KK tutarlarından geri çıkarılacak. Onaylıyor musun?'
    :'Bu harcamayı silmek istiyor musun?';
  if(!confirm(confirmMsg)) return;

  if(s.kk){
    const {cardId,n,perInst}=s.kk;
    const dateObj=new Date(s.date);
    const purchaseMonth=dateObj.getMonth()+1;
    const purchaseYear=dateObj.getFullYear();
    for(let i=0;i<n;i++){
      let pm=purchaseMonth+1+i;
      let py=purchaseYear;
      if(pm>12){pm-=12;py++;}
      const kkExp=(S.years[py]?.expenses||[]).find(e=>e.id===cardId);
      if(!kkExp) continue;
      kkExp.amounts[pm]=Math.round((parseFloat(kkExp.amounts[pm]||0)-perInst)*100)/100;
      if(kkExp.amounts[pm]<0) kkExp.amounts[pm]=0;
    }
  }

  yd.spending=yd.spending.filter(x=>x.id!==id);
  closeModal('overlay-spending');
  renderHarcama();
  if(s.kk) renderGider();
  trackChange();
}
