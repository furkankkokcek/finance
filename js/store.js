// Store - constants, state, persistence

const MONTHS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const MONTHS_FULL = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const CAT_LABELS = {sabit:'Sabit Giderler', kredi:'Krediler', kk:'Kredi Kartları'};
const SPD_CATS = {market:'Market',restoran:'Restoran',ulasim:'Ulaşım',giyim:'Giyim',eglence:'Eğlence',saglik:'Sağlık',egitim:'Eğitim',diger:'Diğer'};

let S = {
  version:3, setupDone:false,
  settings:{salaryDay:1, currentYear:new Date().getFullYear(), currentMonth:new Date().getMonth()+1, netWorth:0, notifEnabled:false, lastNotifDate:'', theme:'dark', ppfEnabled:true, amountsHidden:false},
  years:{}
};
const giderOpenCats = new Set();

function getYear(y){
  y = y || S.settings.currentYear;
  if(!S.years[y]) S.years[y]={income:[],expenses:[],investments:{},spending:[]};
  return S.years[y];
}

function saveS(){ localStorage.setItem('fintrack_v3', JSON.stringify(S)); }

function loadS(){
  try{
    const d = localStorage.getItem('fintrack_v3');
    if(d){ S = JSON.parse(d); return true; }
  }catch(e){}
  return false;
}
