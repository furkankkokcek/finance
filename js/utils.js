// Utilities - formatters, date helpers, data calculations

function fmtTRY(n, showSign=false){
  if(n===undefined||n===null||isNaN(n)) return '—';
  const abs=Math.abs(n);
  const str=abs.toLocaleString('tr-TR',{minimumFractionDigits:0,maximumFractionDigits:0});
  if(showSign) return (n>=0?'+':'-')+str+' ₺';
  return str+' ₺';
}

function fmtPct(n){ return isNaN(n)?'%0':'%'+n.toFixed(1); }
function uid(prefix){ return prefix+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,7); }

// Turkish public holiday data
const FIXED_HOLIDAYS=['01-01','04-23','05-01','05-19','07-15','08-30','10-29'];
const RELIGIOUS_HOLIDAYS={
  2024:['04-10','04-11','04-12','04-13','06-16','06-17','06-18','06-19'],
  2025:['03-30','03-31','04-01','04-02','06-06','06-07','06-08','06-09'],
  2026:['03-19','03-20','03-21','03-22','05-26','05-27','05-28','05-29'],
  2027:['03-09','03-10','03-11','03-12','05-15','05-16','05-17','05-18'],
  2028:['02-26','02-27','02-28','02-29','05-05','05-06','05-07','05-08'],
  2029:['02-14','02-15','02-16','02-17','04-24','04-25','04-26','04-27'],
  2030:['02-04','02-05','02-06','02-07','04-13','04-14','04-15','04-16'],
};

function isHoliday(date){
  const dow=date.getDay();
  if(dow===0||dow===6) return true;
  const mm=String(date.getMonth()+1).padStart(2,'0');
  const dd=String(date.getDate()).padStart(2,'0');
  const mmdd=mm+'-'+dd;
  if(FIXED_HOLIDAYS.includes(mmdd)) return true;
  const yr=date.getFullYear();
  if((RELIGIOUS_HOLIDAYS[yr]||[]).includes(mmdd)) return true;
  const ymd=`${yr}-${mm}-${dd}`;
  if((S.settings.customHolidays||[]).includes(ymd)) return true;
  return false;
}

function nominalDate(year,month,day){
  const lastDay=new Date(year,month,0).getDate();
  return new Date(year,month-1,Math.min(day,lastDay));
}

function getAdjustedDueDate(year,month,day){
  let date=nominalDate(year,month,day);
  let guard=0;
  while(isHoliday(date)&&guard<20){
    date=new Date(date.getTime());
    date.setDate(date.getDate()+1);
    guard++;
  }
  return date;
}

function prevBusinessDay(date){
  const d=new Date(date.getTime());
  let guard=0;
  do{
    d.setDate(d.getDate()-1);
    guard++;
  }while(isHoliday(d)&&guard<20);
  return d;
}

function isPaymentDueToday(year,month,dueDay){
  if(!dueDay) return false;
  const today=new Date();
  const adj=getAdjustedDueDate(year,month,dueDay);
  return adj.getDate()===today.getDate()&&adj.getMonth()===today.getMonth()&&adj.getFullYear()===today.getFullYear();
}

function todayStr(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Returns {year, month} of the statement a purchase falls into
function statementPeriod(purchaseDate,statementDay){
  const d=new Date(purchaseDate);
  const day=d.getDate(),m=d.getMonth()+1,y=d.getFullYear();
  if(day<=statementDay) return {year:y,month:m};
  let nm=m+1,ny=y;
  if(nm>12){nm=1;ny++;}
  return {year:ny,month:nm};
}

// Sum spending linked to a card (from S.cards) for a given statement month
function cardStatementTotal(year,month,cardId){
  if(!cardId) return 0;
  const card=(S.cards||[]).find(c=>c.id===cardId);
  if(!card) return 0;
  let total=0;
  Object.values(S.years||{}).forEach(yd=>{
    (yd.spending||[]).forEach(s=>{
      if(!s.kk) return;
      const ref=s.kk.cardRef||s.kk.cardId;
      if(ref!==cardId) return;
      const per=statementPeriod(s.date,card.statementDay);
      if(per.year===year&&per.month===month) total+=parseFloat(s.amount||0);
    });
  });
  return total;
}

// All payment/reminder events for a month (used by calendar)
function getMonthEvents(year,month){
  const yd=getYear(year);
  const events=[];
  const expColor=cat=>cat==='sabit'?'#3b82f6':cat==='kredi'?'#a855f7':cat==='kk'?'#f59e0b':cat==='abonelik'?'#ec4899':'#6b7280';

  // Income items appear on the (adjusted) salary day
  const salAdj=getAdjustedDueDate(year,month,S.settings.salaryDay);
  if(salAdj.getFullYear()===year&&salAdj.getMonth()+1===month){
    yd.income.forEach(inc=>{
      const amt=parseFloat(inc.amounts[month]||0);
      if(amt>0) events.push({day:salAdj.getDate(),name:inc.name,amount:amt,type:'income',color:'#22c55e',isReminder:false});
    });
  }

  // Expenses
  yd.expenses.forEach(exp=>{
    if(!exp.dueDay) return;
    const amt=parseFloat(exp.amounts[month]||0);
    if(amt===0) return;
    const nominal=nominalDate(year,month,exp.dueDay);
    const adj=getAdjustedDueDate(year,month,exp.dueDay);
    if(adj.getFullYear()===year&&adj.getMonth()+1===month){
      events.push({day:adj.getDate(),name:exp.name,amount:amt,type:exp.category,color:expColor(exp.category),expId:exp.id,isReminder:false});
    }
    // PPF prev-business-day reminder — only when nominal falls on a holiday
    if(S.settings.ppfEnabled!==false&&exp.ppf&&isHoliday(nominal)){
      const pbd=prevBusinessDay(nominal);
      if(pbd.getFullYear()===year&&pbd.getMonth()+1===month){
        events.push({day:pbd.getDate(),name:exp.name,amount:amt,type:'ppf',color:'#a855f7',expId:exp.id,isReminder:true});
      }
    }
  });

  return events;
}

function getMonthlyData(year,month){
  const yd=getYear(year);
  let totalIncome=0,sabitTotal=0,krediTotal=0,kkTotal=0,abonelikTotal=0,ppfTotal=0;
  yd.income.forEach(inc=>{ totalIncome+=parseFloat(inc.amounts[month]||0); });
  yd.expenses.forEach(exp=>{
    const amt=parseFloat(exp.amounts[month]||0);
    if(exp.category==='sabit') sabitTotal+=amt;
    else if(exp.category==='kredi') krediTotal+=amt;
    else if(exp.category==='kk') kkTotal+=amt;
    else if(exp.category==='abonelik') abonelikTotal+=amt;
    if(exp.ppf) ppfTotal+=amt;
  });
  const totalExpense=sabitTotal+krediTotal+kkTotal+abonelikTotal;
  const investment=parseFloat(yd.investments[month]||0);
  const cashLeft=totalIncome-(totalExpense+investment);
  const savingsRate=totalIncome>0?(investment/totalIncome)*100:0;
  const spendingTotal=yd.spending.filter(s=>{
    const d=new Date(s.date);
    return d.getFullYear()===year&&d.getMonth()+1===month;
  }).reduce((a,b)=>a+parseFloat(b.amount||0),0);
  return {totalIncome,sabitTotal,krediTotal,kkTotal,abonelikTotal,totalExpense,investment,cashLeft,savingsRate,ppfTotal,spendingTotal};
}

function getAvgMonthlyExpense(year){
  let total=0,cnt=0;
  for(let m=1;m<=12;m++){
    const d=getMonthlyData(year,m);
    if(d.totalExpense>0){total+=d.totalExpense;cnt++;}
  }
  return cnt>0?total/cnt:0;
}

function getTotalDebt(year){
  const yd=getYear(year);
  let total=0;
  yd.expenses.forEach(exp=>{
    if(exp.category==='kredi'){
      const totalInst=parseInt(exp.installments)||0;
      if(totalInst===0) return;
      const paidInst=Math.max(0,parseInt(exp.installmentPaid)||0);
      const remaining=Math.max(0,totalInst-paidInst);
      if(remaining===0) return;
      const amounts=Object.values(exp.amounts||{}).map(v=>parseFloat(v)||0).filter(v=>v>0);
      const monthlyAmt=amounts.length>0?amounts[0]:0;
      total+=remaining*monthlyAmt;
    } else if(exp.category==='kk'){
      for(let m=1;m<=12;m++){
        const amt=parseFloat(exp.amounts[m]||0);
        const status=exp.status?.[m]||'unpaid';
        if(amt>0&&status!=='paid') total+=amt;
      }
    }
  });
  return total;
}
