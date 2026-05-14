// Year selector modal

function openYearModal(){
  const curYear=new Date().getFullYear();
  const years=[];
  for(let y=curYear-3;y<=curYear+3;y++) years.push(y);
  // Add any years that have data
  Object.keys(S.years).forEach(y=>{if(!years.includes(parseInt(y)))years.push(parseInt(y));});
  years.sort((a,b)=>b-a);
  document.getElementById('year-list').innerHTML=years.map(y=>`
    <div class="year-opt${y===S.settings.currentYear?' active':''}" onclick="selectYear(${y})">${y}</div>
  `).join('')+`<div class="year-opt" onclick="addNewYear()">+ Yeni Yıl Ekle</div>`;
  openModal('overlay-year');
}

function selectYear(y){
  S.settings.currentYear=y;
  getYear(y); // ensure initialized
  saveS();
  document.getElementById('year-btn').textContent=y;
  closeModal('overlay-year');
  renderPage(currentPage);
}

function addNewYear(){
  const y=parseInt(prompt('Hangi yıl?', new Date().getFullYear()+1));
  if(y&&y>=2000&&y<=2100){
    selectYear(y);
  }
}
