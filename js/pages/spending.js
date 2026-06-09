// Spending (Harcama) page

function renderHarcama(){
  buildMonthTabs('harcama-month-tabs','harcama');
  const year=S.settings.currentYear;
  const month=S.settings.currentMonth;
  const yd=getYear(year);
  const el=document.getElementById('harcama-content');

  const items=yd.spending.filter(s=>{
    const d=new Date(s.date);
    return d.getFullYear()===year&&d.getMonth()+1===month;
  }).sort((a,b)=>new Date(b.date)-new Date(a.date));

  // KK installment virtual records (payment month)
  const kkInsts=[];
  yd.spending.forEach(s=>{
    if(!s.kk) return;
    if(s.kk.paymentMonths&&s.kk.paymentMonths.length){
      s.kk.paymentMonths.forEach(({year:pyr,month:pm},i)=>{
        if(pm===month&&pyr===year){
          kkInsts.push({s,instIdx:i,instNum:i+1,total:s.kk.n,perInst:s.kk.perInst});
        }
      });
    } else {
      const dateObj=new Date(s.date);
      const pm0=dateObj.getMonth()+1;
      const py=dateObj.getFullYear();
      for(let i=0;i<s.kk.n;i++){
        let pm=pm0+1+i,pyr=py;
        if(pm>12){pm-=12;pyr++;}
        if(pm===month&&pyr===year){
          kkInsts.push({s,instIdx:i,instNum:i+1,total:s.kk.n,perInst:s.kk.perInst});
        }
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
      const kkBadge=(s.kk&&s.kk.n>1)?`<span style="font-size:10px;background:rgba(168,85,247,.15);color:var(--purple);border-radius:4px;padding:1px 5px;font-weight:700;margin-left:4px">💳 ${s.kk.n} taksit</span>`:'';
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
      html+=`<div class="section-hdr" style="margin-top:4px"><div class="section-title" style="font-size:12px">💳 Önceki Dönem & Tek Çekim</div></div>`;
      kkInsts.forEach(({s,instNum,total,perInst})=>{
        const d=new Date(s.date);
        const metaLabel=total>1?`${instNum}/${total} taksit`:'tek çekim';
        html+=`<div class="spending-item" onclick="openEditSpending('${s.id}')" style="background:rgba(168,85,247,.05);border-left:3px solid rgba(168,85,247,.4)">
          <div class="spending-left">
            <div class="spending-desc">${s.description}</div>
            <div class="spending-meta">${metaLabel} · alış ${d.getDate()} ${MONTHS[d.getMonth()]} · ${findKKCardName(s)}</div>
          </div>
          <div class="spending-amount" style="color:var(--purple)">-${fmtTRY(perInst)}</div>
        </div>`;
      });
    }
  }

  el.innerHTML=html;
}

function findKKCardName(s){
  if(!s.kk) return 'Bilinmeyen';
  // Look up by expense ID (kk.cardId is the KK expense id)
  const expId=s.kk.cardId||'';
  if(expId){
    for(const y of Object.values(S.years)){
      const exp=(y.expenses||[]).find(e=>e.id===expId);
      if(exp) return exp.name;
    }
  }
  return 'Bilinmeyen KK';
}

// Returns note about which statement month a KK purchase will fall into
function spdCardNote(dateStr, expId){
  if(!dateStr||!expId) return '';
  let exp=null;
  for(const y of Object.values(S.years)){
    exp=(y.expenses||[]).find(e=>e.id===expId&&e.category==='kk');
    if(exp) break;
  }
  if(!exp||!exp.statementDay) return '';
  const per=statementPeriod(dateStr,exp.statementDay);
  return `→ ${MONTHS_FULL[per.month-1]} ${per.year} ekstresi`;
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
    const cardSel=document.getElementById('spd-kk-card');
    const cards=getYear(S.settings.currentYear).expenses.filter(e=>e.category==='kk');
    cardSel.innerHTML=cards.length
      ?cards.map(k=>`<option value="${k.id}">${k.name}</option>`).join('')
      :'<option value="">— KK tanımlanmamış —</option>';
    cardSel.dataset.mode='expenses';
    updateSpdCardNote();
  }
}

function updateSpdCardNote(){
  const noteEl=document.getElementById('spd-card-note');
  if(!noteEl) return;
  const cardSel=document.getElementById('spd-kk-card');
  const dateInp=document.getElementById('spd-date');
  if(cardSel&&dateInp&&cardSel.value){
    noteEl.textContent=spdCardNote(dateInp.value,cardSel.value);
  } else {
    noteEl.textContent='';
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
    document.getElementById('spending-modal-title').textContent='KK Harcaması';
    document.getElementById('spd-normal-form').style.display='none';
    document.getElementById('spd-kk-readonly').style.display='block';
    const cardName=findKKCardName(s);
    const typeLabel=s.kk.n>1?`${s.kk.n} Taksit (aylık ${fmtTRY(s.kk.perInst)})`:'Tek Çekim';
    let ekstreLabel='';
    const kpm=s.kk.paymentMonths;
    if(kpm&&kpm.length){
      if(kpm.length===1){
        ekstreLabel=`📋 ${MONTHS_FULL[kpm[0].month-1]} ${kpm[0].year} ekstresi`;
      } else {
        const first=kpm[0],last=kpm[kpm.length-1];
        ekstreLabel=`📋 ${MONTHS_FULL[first.month-1]} ${first.year} – ${MONTHS_FULL[last.month-1]} ${last.year}`;
      }
    } else {
      const dateObj=new Date(s.date);
      let fm=dateObj.getMonth()+2,fy=dateObj.getFullYear();
      if(fm>12){fm=1;fy++;}
      if(s.kk.n<=1){
        ekstreLabel=`📋 ${MONTHS_FULL[fm-1]} ${fy} ekstresi`;
      } else {
        let lm=fm+(s.kk.n-1),ly=fy;
        while(lm>12){lm-=12;ly++;}
        ekstreLabel=`📋 ${MONTHS_FULL[fm-1]} ${fy} – ${MONTHS_FULL[lm-1]} ${ly}`;
      }
    }
    document.getElementById('spd-kk-readonly-info').innerHTML=
      `<div style="font-weight:700;font-size:14px;margin-bottom:6px">${s.description}</div>`+
      `<div>💳 ${cardName}</div>`+
      `<div>💰 ${fmtTRY(s.amount)} · ${typeLabel}</div>`+
      `<div>📅 ${s.date}</div>`+
      (ekstreLabel?`<div style="color:var(--purple);font-size:13px;margin-top:4px">${ekstreLabel}</div>`:'')+
      `<div style="color:var(--muted);font-size:12px;margin-top:6px">${SPD_CATS[s.category]||s.category}</div>`;
  } else {
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
    const cardSel=document.getElementById('spd-kk-card');
    const selId=cardSel.value;
    if(!selId){alert('Kredi kartı seçin');return;}
    const type=document.getElementById('spd-kk-type').value;
    const n=type==='inst'?(parseInt(document.getElementById('spd-kk-inst').value)||1):1;
    if(type==='inst'&&n<2){alert('Taksit sayısı en az 2 olmalı');return;}
    const perInst=Math.round(amount/n*100)/100;

    if(cardSel.dataset.mode==='cards'){
      // New S.cards[] mode: find linked KK expense for amount tracking
      const linkedExp=yd.expenses.find(e=>e.category==='kk'&&e.cardId===selId);
      const dateObj=new Date(date);
      const purchaseMonth=dateObj.getMonth()+1;
      const purchaseYear=dateObj.getFullYear();
      if(linkedExp){
        const stDay=linkedExp.statementDay||0;
        let firstM=purchaseMonth+1,firstY=purchaseYear;
        if(firstM>12){firstM=1;firstY++;}
        const firstPer=stDay>0?statementPeriod(date,stDay):{year:firstY,month:firstM};
        let skipped=0;
        const paymentMonths=[];
        for(let i=0;i<n;i++){
          let pm=firstPer.month+i,py=firstPer.year;
          if(pm>12){pm-=12;py++;}
          paymentMonths.push({year:py,month:pm});
          const kkExp=(S.years[py]?.expenses||[]).find(e=>e.id===linkedExp.id);
          if(!kkExp){skipped++;continue;}
          kkExp.amounts=kkExp.amounts||{};
          kkExp.amounts[pm]=Math.round((parseFloat(kkExp.amounts[pm]||0)+perInst)*100)/100;
        }
        if(skipped>0) alert(`${skipped} taksit farklı yıla taşıdı; manuel ekleyebilirsin.`);
        kkMeta={cardId:linkedExp.id,cardRef:selId,n,perInst,paymentMonths};
      } else {
        // No linked KK expense: store only card reference
        kkMeta={cardId:'',cardRef:selId,n,perInst};
      }
    } else {
      // Legacy expense-ID mode
      const dateObj=new Date(date);
      const purchaseMonth=dateObj.getMonth()+1;
      const purchaseYear=dateObj.getFullYear();
      const kkExpForDay=(yd.expenses||[]).find(e=>e.id===selId);
      const stDay=kkExpForDay?.statementDay||0;
      let firstM=purchaseMonth+1,firstY=purchaseYear;
      if(firstM>12){firstM=1;firstY++;}
      const firstPer=stDay>0?statementPeriod(date,stDay):{year:firstY,month:firstM};
      let skipped=0;
      const paymentMonths=[];
      for(let i=0;i<n;i++){
        let pm=firstPer.month+i,py=firstPer.year;
        if(pm>12){pm-=12;py++;}
        paymentMonths.push({year:py,month:pm});
        const kkExp=(S.years[py]?.expenses||[]).find(e=>e.id===selId);
        if(!kkExp){skipped++;continue;}
        kkExp.amounts=kkExp.amounts||{};
        kkExp.amounts[pm]=Math.round((parseFloat(kkExp.amounts[pm]||0)+perInst)*100)/100;
      }
      if(skipped>0) alert(`${skipped} taksit farklı yıla taşıdı; manuel ekleyebilirsin.`);
      kkMeta={cardId:selId,n,perInst,paymentMonths};
    }
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
    const kkExpId=s.kk.cardId||'';
    if(kkExpId){
      const {n,perInst,paymentMonths}=s.kk;
      if(paymentMonths&&paymentMonths.length){
        for(const {year:py,month:pm} of paymentMonths){
          const kkExp=(S.years[py]?.expenses||[]).find(e=>e.id===kkExpId);
          if(!kkExp) continue;
          kkExp.amounts[pm]=Math.round((parseFloat(kkExp.amounts[pm]||0)-perInst)*100)/100;
          if(kkExp.amounts[pm]<0) kkExp.amounts[pm]=0;
        }
      } else {
        const dateObj=new Date(s.date);
        const purchaseMonth=dateObj.getMonth()+1;
        const purchaseYear=dateObj.getFullYear();
        for(let i=0;i<n;i++){
          let pm=purchaseMonth+1+i,py=purchaseYear;
          if(pm>12){pm-=12;py++;}
          const kkExp=(S.years[py]?.expenses||[]).find(e=>e.id===kkExpId);
          if(!kkExp) continue;
          kkExp.amounts[pm]=Math.round((parseFloat(kkExp.amounts[pm]||0)-perInst)*100)/100;
          if(kkExp.amounts[pm]<0) kkExp.amounts[pm]=0;
        }
      }
    }
  }

  yd.spending=yd.spending.filter(x=>x.id!==id);
  closeModal('overlay-spending');
  renderHarcama();
  if(s.kk) renderGider();
  trackChange();
}
