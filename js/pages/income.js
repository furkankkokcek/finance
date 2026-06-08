// Income (Gelir) page

function renderGelir(){
  buildMonthTabs('gelir-month-tabs','gelir');
  const year=S.settings.currentYear;
  const month=S.settings.currentMonth;
  const yd=getYear(year);
  const el=document.getElementById('gelir-content');

  let totalIncome=0;
  yd.income.forEach(inc=>{ totalIncome+=parseFloat(inc.amounts[month]||0); });

  let html=`<div class="section-hdr"><div class="section-title">Gelir Kaynakları</div><div class="section-badge">${fmtTRY(totalIncome)}</div></div>`;

  if(yd.income.length===0){
    html+=`<div class="empty"><div class="empty-icon">💰</div><div class="empty-text">Henüz gelir eklenmedi</div><div class="empty-sub">Sağ alttaki + butonuna bas</div></div>`;
  } else {
    yd.income.forEach(inc=>{
      const amt=parseFloat(inc.amounts[month]||0);
      html+=`<div class="income-item" onclick="openEditIncome('${inc.id}')">
        <div><div class="income-item-name">${inc.name}</div><div style="font-size:11px;color:var(--muted)">${MONTHS_FULL[month-1]} ${year}</div></div>
        <div class="income-item-amount">${fmtTRY(amt)}</div>
      </div>`;
    });
  }

  el.innerHTML=html;
}

function openAddIncome(){
  document.getElementById('income-modal-title').textContent='Gelir Ekle';
  document.getElementById('inc-id').value='';
  document.getElementById('inc-name').value='';
  document.getElementById('inc-delete-btn').style.display='none';
  buildAmountsGrid('inc-amounts',{});
  openModal('overlay-income');
}

function openEditIncome(id){
  const yd=getYear(S.settings.currentYear);
  const inc=yd.income.find(i=>i.id===id);
  if(!inc) return;
  document.getElementById('income-modal-title').textContent='Gelir Düzenle';
  document.getElementById('inc-id').value=id;
  document.getElementById('inc-name').value=inc.name;
  document.getElementById('inc-delete-btn').style.display='block';
  buildAmountsGrid('inc-amounts',inc.amounts);
  openModal('overlay-income');
}

function saveIncome(){
  const year=S.settings.currentYear;
  const yd=getYear(year);
  const id=document.getElementById('inc-id').value;
  const name=document.getElementById('inc-name').value.trim();
  if(!name){alert('Gelir adı girin');return;}
  const amounts=readAmountsGrid('inc-amounts');

  if(id){
    const inc=yd.income.find(i=>i.id===id);
    if(inc){inc.name=name;inc.amounts=amounts;}
  } else {
    yd.income.push({id:uid('inc'),name,amounts});
  }
  closeModal('overlay-income');
  renderGelir();
  renderDashboard();
  trackChange();
}

function deleteIncome(){
  if(!confirm('Bu geliri silmek istiyor musunuz?')) return;
  const year=S.settings.currentYear;
  const yd=getYear(year);
  const id=document.getElementById('inc-id').value;
  yd.income=yd.income.filter(i=>i.id!==id);
  closeModal('overlay-income');
  renderGelir();
  renderDashboard();
  trackChange();
}
