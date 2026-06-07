// Store - constants, state, persistence

const MONTHS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const MONTHS_FULL = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const CAT_LABELS = {sabit:'Sabit Giderler', kredi:'Krediler', kk:'Kredi Kartları', abonelik:'Abonelikler'};
const SPD_CATS = {market:'Market',restoran:'Restoran',ulasim:'Ulaşım',giyim:'Giyim',eglence:'Eğlence',saglik:'Sağlık',egitim:'Eğitim',diger:'Diğer'};

let S = {
  version:4, setupDone:false,
  cards:[],
  investmentPortfolio:[],
  settings:{
    salaryDay:1, currentYear:new Date().getFullYear(), currentMonth:new Date().getMonth()+1,
    netWorth:0, invGoal:{amount:0,currency:'usd'}, notifEnabled:false, lastNotifDate:'', theme:'dark', ppfEnabled:true,
    amountsHidden:false, changeCount:0, lastOpenDate:'', testNotifEnabled:false,
    customHolidays:[]
  },
  years:{}, notifLog:[]
};
const giderOpenCats = new Set();

function getYear(y){
  y = y || S.settings.currentYear;
  if(!S.years[y]) S.years[y]={income:[],expenses:[],investments:{},spending:[]};
  return S.years[y];
}

function migrateToV4(data){
  if(!data.cards) data.cards=[];
  if(!data.investmentPortfolio) data.investmentPortfolio=[];
  if(!data.settings) data.settings={};
  if(!data.settings.customHolidays) data.settings.customHolidays=[];
  if(!data.notifLog) data.notifLog=[];
  Object.values(data.years||{}).forEach(yd=>{
    (yd.expenses||[]).forEach(e=>{ if(e.cardId===undefined) e.cardId=''; });
  });
  data.version=4;
  return data;
}

function saveS(){
  localStorage.setItem('fintrack_v4', JSON.stringify(S));
  if(typeof syncNotifSchedule==='function') syncNotifSchedule();
}

function loadS(){
  try{
    const d4=localStorage.getItem('fintrack_v4');
    if(d4){ S=JSON.parse(d4); if(!S.cards||!S.settings.customHolidays) migrateToV4(S); return true; }
    const d3=localStorage.getItem('fintrack_v3');
    if(d3){ S=migrateToV4(JSON.parse(d3)); return true; }
  }catch(e){}
  return false;
}

function trackChange(){
  S.settings.changeCount=(S.settings.changeCount||0)+1;
  saveS();
  if(S.settings.changeCount%10===0) showBackupDialog();
}
