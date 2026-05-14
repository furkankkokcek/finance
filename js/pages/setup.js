// Setup screen

function doSetup(){
  const year=parseInt(document.getElementById('s-year').value)||new Date().getFullYear();
  const salary=parseInt(document.getElementById('s-salary').value)||1;
  const nw=parseFloat(document.getElementById('s-nw').value)||0;
  S.settings.salaryDay=salary;
  S.settings.currentYear=year;
  S.settings.currentMonth=new Date().getMonth()+1;
  S.settings.netWorth=nw;
  S.settings.ppfEnabled=document.getElementById('s-ppf').checked;
  S.setupDone=true;
  getYear(year); // init year
  saveS();
  document.getElementById('setup').style.display='none';
  document.getElementById('app').style.display='block';
  initApp();
}
