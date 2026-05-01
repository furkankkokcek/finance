// Year table modal

function openYearTable(){
  const year=S.settings.currentYear;
  const yd=getYear(year);
  document.getElementById('yeartable-title').textContent=`${year} Yıllık Tablo`;

  const header=`<tr><th>Kalem</th>${MONTHS.map(m=>`<th>${m}</th>`).join('')}<th>Toplam</th></tr>`;
  let rows='';

  const addSection=(label,items,color)=>{
    if(rows) rows+=`<tr class="spacer-row"><td colspan="14"></td></tr>`;
    rows+=`<tr class="cat-row"><td>${label}</td>${MONTHS.map(()=>`<td></td>`).join('')}<td></td></tr>`;
    let secTotals=Array(12).fill(0);
    items.forEach(exp=>{
      let itemTotal=0;
      rows+=`<tr><td>${exp.name}${S.settings.ppfEnabled!==false&&exp.ppf?' 🟣':''}</td>`;
      MONTHS.forEach((_,i)=>{
        const m=i+1;
        const amt=parseFloat(exp.amounts[m]||0);
        const st=exp.status?.[m]||'unpaid';
        const c=st==='paid'?'var(--success)':st==='partial'?'var(--accent)':'var(--text)';
        rows+=`<td style="color:${c}">${amt>0?amt.toLocaleString('tr-TR',{maximumFractionDigits:0}):'-'}</td>`;
        secTotals[i]+=amt;
        itemTotal+=amt;
      });
      rows+=`<td style="font-weight:700">${itemTotal.toLocaleString('tr-TR',{maximumFractionDigits:0})}</td></tr>`;
    });
    // Section total row
    const secTotal=secTotals.reduce((a,b)=>a+b,0);
    rows+=`<tr class="total-row"><td>${label} TOPLAM</td>${secTotals.map(v=>`<td>${v.toLocaleString('tr-TR',{maximumFractionDigits:0})}</td>`).join('')}<td>${secTotal.toLocaleString('tr-TR',{maximumFractionDigits:0})}</td></tr>`;
  };

  addSection('SABİT GİDERLER',yd.expenses.filter(e=>e.category==='sabit'));
  addSection('KREDİLER',yd.expenses.filter(e=>e.category==='kredi'));
  addSection('KREDİ KARTLARI',yd.expenses.filter(e=>e.category==='kk'));

  // Grand totals
  let gTotals=Array(12).fill(0);
  let iTotals=Array(12).fill(0);
  let cashTotals=Array(12).fill(0);
  for(let m=1;m<=12;m++){
    const d=getMonthlyData(year,m);
    gTotals[m-1]=d.totalExpense;
    iTotals[m-1]=d.totalIncome;
    cashTotals[m-1]=d.cashLeft;
  }
  rows+=`<tr class="grand-divider"><td colspan="14"></td></tr>`;
  rows+=`<tr class="total-row"><td>🤑 TOPLAM GELİR</td>${iTotals.map(v=>`<td style="color:var(--success)">${v.toLocaleString('tr-TR',{maximumFractionDigits:0})}</td>`).join('')}<td>${iTotals.reduce((a,b)=>a+b,0).toLocaleString('tr-TR',{maximumFractionDigits:0})}</td></tr>`;
  rows+=`<tr class="total-row"><td>💸 TOPLAM GİDER</td>${gTotals.map(v=>`<td style="color:var(--danger)">${v.toLocaleString('tr-TR',{maximumFractionDigits:0})}</td>`).join('')}<td>${gTotals.reduce((a,b)=>a+b,0).toLocaleString('tr-TR',{maximumFractionDigits:0})}</td></tr>`;
  const invTotals=Array.from({length:12},(_,i)=>parseFloat(getYear(year).investments[i+1]||0));
  rows+=`<tr class="total-row"><td>💼 YATIRIM</td>${invTotals.map(v=>`<td style="color:var(--info)">${v>0?v.toLocaleString('tr-TR',{maximumFractionDigits:0}):'-'}</td>`).join('')}<td>${invTotals.reduce((a,b)=>a+b,0).toLocaleString('tr-TR',{maximumFractionDigits:0})}</td></tr>`;
  rows+=`<tr class="total-row"><td>💲 NAKİT KALAN</td>${cashTotals.map(v=>`<td style="color:${v>=0?'var(--success)':'var(--danger)'}">${v.toLocaleString('tr-TR',{maximumFractionDigits:0})}</td>`).join('')}<td>${cashTotals.reduce((a,b)=>a+b,0).toLocaleString('tr-TR',{maximumFractionDigits:0})}</td></tr>`;

  document.getElementById('year-table-content').innerHTML=`<table class="year-table"><thead>${header}</thead><tbody>${rows}</tbody></table>`;
  openModal('overlay-yeartable');
}
