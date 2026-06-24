// Amounts grid helpers

function pasteFromExcel(gridId){
  // navigator.clipboard is unavailable in many Android WebViews and in non-HTTPS
  // contexts; calling .readText() then throws synchronously, which the promise
  // .catch() below cannot see — show the user a friendly message instead.
  if(!navigator.clipboard||typeof navigator.clipboard.readText!=='function'){
    alert(t('grid.clipboardDenied'));
    return;
  }
  navigator.clipboard.readText().then(text=>{
    const values=text.trim().split(/\t|\n/).map(v=>v.trim()).filter(v=>v);
    const inputs=document.querySelectorAll(`#${gridId} input[data-month]`);
    inputs.forEach((inp,i)=>{
      if(i>=values.length) return;
      const num=parseFloat(values[i].replace(/\./g,'').replace(',','.'));
      inp.value=isNaN(num)?'':num;
    });
  }).catch(()=>alert(t('grid.clipboardDenied')));
}

function buildAmountsGrid(containerId, amounts){
  const el=document.getElementById(containerId);
  if(!el) return;
  el.innerHTML=MONTHS.map((m,i)=>`
    <div class="month-amt-field">
      <label>${m}</label>
      <input type="number" data-month="${i+1}" value="${parseFloat(amounts[i+1]||0)||''}" placeholder="0" step="any">
    </div>
  `).join('');
}

function readAmountsGrid(containerId){
  const result={};
  document.querySelectorAll(`#${containerId} input[data-month]`).forEach(inp=>{
    result[parseInt(inp.dataset.month)]=parseFloat(inp.value)||0;
  });
  return result;
}

function fillAllMonths(val){
  const v=parseFloat(val)||0;
  document.querySelectorAll('#exp-amounts input').forEach(inp=>inp.value=v||'');
}
