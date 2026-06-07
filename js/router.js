// Router - pages and month tabs

function showPage(page,btn){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  if(btn) btn.classList.add('active');
  currentPage=page;
  ['gelir','gider','harcama','yatirim'].forEach(p=>{ document.getElementById('fab-'+p).style.display=(p===page?'flex':'none'); });
  renderPage(page);
}

function renderPage(page){
  if(page==='dashboard') renderDashboard();
  else if(page==='gelir') renderGelir();
  else if(page==='gider') renderGider();
  else if(page==='harcama') renderHarcama();
  else if(page==='takvim') renderTakvim();
  else if(page==='yatirim') renderYatirim();
}

function buildMonthTabs(containerId,page){
  const el=document.getElementById(containerId);
  if(!el) return;
  el.innerHTML=MONTHS.map((m,i)=>`
    <div class="month-tab${i+1===S.settings.currentMonth?' active':''}" onclick="selectMonth(${i+1},'${page}')">${m}</div>
  `).join('');
}

function selectMonth(m,page){
  S.settings.currentMonth=m;
  saveS();
  ['month-tabs','gelir-month-tabs','gider-month-tabs','harcama-month-tabs'].forEach(id=>{
    document.querySelectorAll(`#${id} .month-tab`).forEach((tab,i)=>{
      tab.classList.toggle('active',i+1===m);
    });
  });
  renderPage(currentPage);
  const activeTab=document.querySelector(`#${page}-month-tabs .month-tab.active`)||document.querySelector(`#month-tabs .month-tab.active`);
  if(activeTab) activeTab.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'});
}
