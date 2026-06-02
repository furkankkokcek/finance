// Expense (Gider) page + status modal

function renderGider(){
  buildMonthTabs('gider-month-tabs','gider');
  const year=S.settings.currentYear;
  const month=S.settings.currentMonth;
  const yd=getYear(year);
  const el=document.getElementById('gider-content');

  let html='';

  ['sabit','kredi','kk','abonelik'].forEach(cat=>{
    const items=yd.expenses.filter(e=>e.category===cat);
    const catTotal=items.reduce((s,e)=>s+parseFloat(e.amounts[month]||0),0);
    const isOpen=giderOpenCats.has(cat);
    html+=`<div class="exp-accordion" data-cat="${cat}">
      <div class="acc-header" onclick="toggleAcc(this)">
        <div class="acc-title">${CAT_LABELS[cat]}</div>
        <div class="acc-right">
          <div class="acc-total">${fmtTRY(catTotal)}</div>
          <div class="acc-arrow${isOpen?' open':''}">›</div>
        </div>
      </div>
      <div class="acc-body${isOpen?' open':''}">`;

    if(items.length===0){
      html+=`<div style="padding:16px;color:var(--muted);font-size:13px;text-align:center">Kayıt yok</div>`;
    } else {
      let anyRendered=false;
      items.forEach(exp=>{
        const amt=parseFloat(exp.amounts[month]||0);
        if(amt===0) return;
        anyRendered=true;
        const status=exp.status?.[month]||'unpaid';
        const adj=exp.dueDay?getAdjustedDueDate(year,month,exp.dueDay):null;
        const isDue=adj&&isPaymentDueToday(year,month,exp.dueDay);
        let dueStr=adj?`${adj.getDate()} ${MONTHS[adj.getMonth()]}`:'-';
        if(cat==='kk'&&exp.statementDay){
          const nomStat=nominalDate(year,month,exp.statementDay);
          const statIsHol=isHoliday(nomStat);
          const statNote=statIsHol?'*':'';
          const nomDue=nominalDate(year,month,exp.dueDay||0);
          const adjDue=exp.dueDay?getAdjustedDueDate(year,month,exp.dueDay):null;
          const extended=adjDue&&(adjDue.getDate()!==nomDue.getDate()||adjDue.getMonth()!==nomDue.getMonth());
          const dueNote=extended?`→${adjDue.getDate()} ${MONTHS[adjDue.getMonth()]}`:adjDue?`${adjDue.getDate()} ${MONTHS[adjDue.getMonth()]}`:'-';
          dueStr=`Kesim:${nomStat.getDate()}${statNote} · Ödeme:${dueNote}`;
        }
        const dueLabel=cat==='abonelik'?'Yenileme':cat==='kk'?'':'Ödeme';
        const instInfo=exp.installments>0?` (${exp.installmentPaid||0}/${exp.installments})`:'';
        const bgColor=status==='paid'?'rgba(34,197,94,0.08)':status==='partial'?'rgba(245,158,11,0.08)':status==='unpaid'?'rgba(239,68,68,0.15)':'transparent';
        html+=`<div class="exp-item" style="background:${bgColor};justify-content:space-between" onclick="openStatusModal('${exp.id}',${month})">
          <div class="exp-item-left" style="flex:1">
            <div class="exp-item-name">
              ${S.settings.ppfEnabled!==false&&exp.ppf?'<span class="badge badge-ppf">PPF</span>':''}
              ${exp.name}
              ${isDue?'<span class="badge badge-due">BUGÜN</span>':''}
              ${instInfo?'<span style="font-size:11px;color:var(--muted)">'+instInfo+'</span>':''}
            </div>
            <div class="exp-item-meta">${dueLabel?dueLabel+': ':''}${dueStr}${exp.detail?' · '+exp.detail:''}</div>
          </div>
          <div class="exp-item-right" style="display:flex;gap:8px;align-items:center">
            <div style="text-align:right">
              <div class="exp-item-amount">${fmtTRY(amt)}</div>
              <div class="exp-item-status"><span class="badge badge-${status}">${status==='paid'?'Ödendi':status==='partial'?'Kısmen':'Ödenmedi'}</span></div>
            </div>
            <button onclick="event.stopPropagation();openAddExpense('${exp.id}')" style="padding:6px 10px;background:var(--bg4);border:1px solid var(--border);border-radius:var(--r3);color:var(--accent);font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">✏️</button>
          </div>
        </div>`;
      });
      if(!anyRendered){
        html+=`<div style="padding:16px;color:var(--muted);font-size:13px;text-align:center">Bu ay için tutar girilmemiş</div>`;
      }
    }
    html+=`</div></div>`;
  });

  el.innerHTML=html;
}

function toggleAcc(hdr){
  const body=hdr.nextElementSibling;
  const arrow=hdr.querySelector('.acc-arrow');
  body.classList.toggle('open');
  arrow.classList.toggle('open');
  const cat=hdr.closest('[data-cat]')?.dataset.cat;
  if(cat){ body.classList.contains('open')?giderOpenCats.add(cat):giderOpenCats.delete(cat); }
}

// Build options from KK expense items (used for abonelik card selector)
function kkExpOptionsHtml(selectedId){
  const year=S.settings.currentYear;
  const yd=getYear(year);
  const kkExps=yd.expenses.filter(e=>e.category==='kk');
  const opts=['<option value="">— Kart seç —</option>'];
  kkExps.forEach(e=>{
    opts.push(`<option value="${e.id}"${e.id===selectedId?' selected':''}>${e.name}</option>`);
  });
  return opts.join('');
}

function onExpCatChange(){
  const cat=document.getElementById('exp-cat').value;
  const statField=document.getElementById('exp-statement-field');
  const cardField=document.getElementById('exp-card-field');
  const kkInfo=document.getElementById('exp-kk-info');
  const dueLabel=document.getElementById('exp-due-label');
  const ppfField=document.getElementById('exp-ppf-field');

  if(statField) statField.style.display=cat==='kk'?'block':'none';
  if(kkInfo) kkInfo.style.display=cat==='kk'?'block':'none';

  if(cardField){
    cardField.style.display=cat==='abonelik'?'block':'none';
    if(cat==='abonelik'){
      const sel=document.getElementById('exp-card-id');
      if(sel) sel.innerHTML=kkExpOptionsHtml(sel.value||'');
    }
  }

  if(dueLabel) dueLabel.textContent=cat==='abonelik'?'Yenileme Günü':cat==='kk'?'Son Ödeme Günü':'Ödeme Günü';
  if(ppfField) ppfField.style.display=(S.settings.ppfEnabled!==false&&cat!=='abonelik')?'':'none';

  if(cat==='kk') updateExpKKInfo();
}

function updateExpKKInfo(){
  const infoEl=document.getElementById('exp-kk-info');
  if(!infoEl) return;
  const statDay=parseInt(document.getElementById('exp-statement-day')?.value)||0;
  const dueDay=parseInt(document.getElementById('exp-due').value)||0;
  const year=S.settings.currentYear;
  const month=S.settings.currentMonth;
  const lines=[];
  if(statDay){
    const nomStat=nominalDate(year,month,statDay);
    const isHol=isHoliday(nomStat);
    const holNote=isHol?' (tatil — banka ertesi iş günü işler)':'';
    lines.push(`Hesap kesim: ${nomStat.getDate()} ${MONTHS_FULL[nomStat.getMonth()]}${holNote}`);
  }
  if(dueDay){
    const adjDue=getAdjustedDueDate(year,month,dueDay);
    const nomDue=nominalDate(year,month,dueDay);
    const extended=adjDue.getDate()!==nomDue.getDate()||adjDue.getMonth()!==nomDue.getMonth();
    const extNote=extended?` → ${adjDue.getDate()} ${MONTHS_FULL[adjDue.getMonth()]} (uzatıldı)`:'';
    lines.push(`Son ödeme: ${nomDue.getDate()} ${MONTHS_FULL[nomDue.getMonth()]}${extNote}`);
  }
  infoEl.innerHTML=lines.join('<br>');
}

function openAddExpense(id=null, defaultCat=null){
  const yd=getYear(S.settings.currentYear);
  const exp=id?yd.expenses.find(e=>e.id===id):null;
  document.getElementById('exp-modal-title').textContent=exp?'Gider Düzenle':'Gider Ekle';
  document.getElementById('exp-id').value=id||'';
  document.getElementById('exp-name').value=exp?exp.name:'';
  document.getElementById('exp-cat').value=exp?exp.category:(defaultCat||'sabit');
  document.getElementById('exp-due').value=exp?exp.dueDay||'':'';
  document.getElementById('exp-inst').value=exp?exp.installments||0:0;
  document.getElementById('exp-inst-paid').value=exp?exp.installmentPaid||0:0;
  document.getElementById('exp-detail').value=exp?exp.detail||'':'';
  document.getElementById('exp-fixed').value='';
  document.getElementById('exp-ppf').checked=exp?!!exp.ppf:false;
  const statDayEl=document.getElementById('exp-statement-day');
  if(statDayEl) statDayEl.value=exp?exp.statementDay||'':'';
  const cardSel=document.getElementById('exp-card-id');
  if(cardSel) cardSel.innerHTML=kkExpOptionsHtml(exp?exp.cardId||'':'');
  document.getElementById('exp-delete-btn').style.display=exp?'block':'none';
  buildAmountsGrid('exp-amounts',exp?exp.amounts:{});
  onExpCatChange();
  openModal('overlay-expense');
}

function saveExpense(){
  const year=S.settings.currentYear;
  const yd=getYear(year);
  const id=document.getElementById('exp-id').value;
  const name=document.getElementById('exp-name').value.trim();
  if(!name){alert('Gider adı girin');return;}
  const amounts=readAmountsGrid('exp-amounts');
  const cat=document.getElementById('exp-cat').value;
  const cardSel=document.getElementById('exp-card-id');
  const obj={
    id:id||uid('exp'),
    name,
    category:cat,
    dueDay:parseInt(document.getElementById('exp-due').value)||0,
    statementDay:cat==='kk'?(parseInt(document.getElementById('exp-statement-day')?.value)||0):0,
    installments:parseInt(document.getElementById('exp-inst').value)||0,
    installmentPaid:parseInt(document.getElementById('exp-inst-paid').value)||0,
    detail:document.getElementById('exp-detail').value.trim(),
    ppf:document.getElementById('exp-ppf').checked,
    cardId:cardSel?cardSel.value||'':'',
    amounts,
    status:{}
  };
  if(id){
    const idx=yd.expenses.findIndex(e=>e.id===id);
    if(idx>=0){ obj.status=yd.expenses[idx].status||{}; yd.expenses[idx]=obj; }
  } else {
    yd.expenses.push(obj);
  }
  closeModal('overlay-expense');
  renderGider();
  renderDashboard();
  trackChange();
}

function deleteExpense(){
  if(!confirm('Bu gideri silmek istiyor musunuz?')) return;
  const year=S.settings.currentYear;
  const yd=getYear(year);
  const id=document.getElementById('exp-id').value;
  yd.expenses=yd.expenses.filter(e=>e.id!==id);
  closeModal('overlay-expense');
  renderGider();
  renderDashboard();
  trackChange();
}

function openStatusModal(expId,month){
  document.getElementById('status-exp-id').value=expId;
  document.getElementById('status-month').value=month;
  const yd=getYear(S.settings.currentYear);
  const exp=yd.expenses.find(e=>e.id===expId);
  const status=exp?.status?.[month]||'unpaid';
  document.getElementById('status-modal-title').textContent=exp?.name||'Ödeme Durumu';
  ['paid','partial','unpaid'].forEach(s=>{
    document.getElementById('sopt-'+s).classList.toggle('sel',s===status);
  });
  _selectedStatus=status;
  openModal('overlay-status');
}

function selectStatus(s){
  _selectedStatus=s;
  ['paid','partial','unpaid'].forEach(opt=>{
    document.getElementById('sopt-'+opt).classList.toggle('sel',opt===s);
  });
}

function saveStatus(){
  const expId=document.getElementById('status-exp-id').value;
  const month=parseInt(document.getElementById('status-month').value);
  const yd=getYear(S.settings.currentYear);
  const exp=yd.expenses.find(e=>e.id===expId);
  if(!exp) return;
  if(!exp.status) exp.status={};
  const prev=exp.status[month]||'unpaid';
  exp.status[month]=_selectedStatus;
  closeModal('overlay-status');
  renderGider();
  renderDashboard();
  trackChange();
  if(prev!==_selectedStatus){
    const statusLabel={paid:'Ödendi',partial:'Kısmi Ödendi',unpaid:'Ödenmedi'}[_selectedStatus]||_selectedStatus;
    const icon=_selectedStatus==='paid'?'✅':_selectedStatus==='partial'?'⚠️':'↩️';
    addNotifEntry('status_change',icon,'Durum Güncellendi',`${exp.name} — ${MONTHS_FULL[month-1]}: ${statusLabel}`);
  }
}
