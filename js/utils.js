// Utilities - formatters, date helpers, data calculations

function fmtTRY(n, showSign=false){
  if(n===undefined||n===null||isNaN(n)) return '—';
  const abs = Math.abs(n);
  const str = abs.toLocaleString('tr-TR',{minimumFractionDigits:0,maximumFractionDigits:0});
  if(showSign) return (n>=0?'+':'-')+str+' ₺';
  return str+' ₺';
}

function fmtPct(n){ return isNaN(n)?'%0':'%'+n.toFixed(1); }

function uid(prefix){ return prefix+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,7); }

function getAdjustedDueDate(year, month, day){
  // If day > last day of month, use last day
  const lastDay = new Date(year, month, 0).getDate();
  const d = Math.min(day, lastDay);
  let date = new Date(year, month-1, d);
  const dow = date.getDay();
  if(dow===6) date.setDate(date.getDate()+2); // Sat -> Mon
  else if(dow===0) date.setDate(date.getDate()+1); // Sun -> Mon
  return date;
}

function isPaymentDueToday(year, month, dueDay){
  if(!dueDay) return false;
  const today = new Date();
  const adj = getAdjustedDueDate(year, month, dueDay);
  return adj.getDate()===today.getDate() && adj.getMonth()===today.getMonth() && adj.getFullYear()===today.getFullYear();
}

function todayStr(){ const d=new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }

function getMonthlyData(year, month){
  const yd = getYear(year);
  let totalIncome=0, sabitTotal=0, krediTotal=0, kkTotal=0, ppfTotal=0;

  yd.income.forEach(inc=>{
    totalIncome += parseFloat(inc.amounts[month]||0);
  });
  yd.expenses.forEach(exp=>{
    const amt = parseFloat(exp.amounts[month]||0);
    if(exp.category==='sabit') sabitTotal+=amt;
    else if(exp.category==='kredi') krediTotal+=amt;
    else if(exp.category==='kk') kkTotal+=amt;
    if(exp.ppf) ppfTotal+=amt;
  });

  const totalExpense = sabitTotal+krediTotal+kkTotal;
  const investment = parseFloat(yd.investments[month]||0);
  const totalGoing = totalExpense+investment;
  const cashLeft = totalIncome - totalGoing;
  const savingsRate = totalIncome>0? (investment/totalIncome)*100 : 0;
  const spendingTotal = yd.spending.filter(s=>{
    const d=new Date(s.date);
    return d.getFullYear()===year && d.getMonth()+1===month;
  }).reduce((a,b)=>a+parseFloat(b.amount||0),0);

  return {totalIncome,sabitTotal,krediTotal,kkTotal,totalExpense,investment,cashLeft,savingsRate,ppfTotal,spendingTotal};
}

function getAvgMonthlyExpense(year){
  let total=0, cnt=0;
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
      if(totalInst===0) return; // continuous, no defined end
      const paidInst=Math.max(0,parseInt(exp.installmentPaid)||0);
      const remaining=Math.max(0,totalInst-paidInst);
      if(remaining===0) return;
      // monthly payment: first non-zero amount entry
      const amounts=Object.values(exp.amounts||{}).map(v=>parseFloat(v)||0).filter(v=>v>0);
      const monthlyAmt=amounts.length>0?amounts[0]:0;
      total+=remaining*monthlyAmt;
    } else if(exp.category==='kk'){
      // only current year, only unpaid
      for(let m=1;m<=12;m++){
        const amt=parseFloat(exp.amounts[m]||0);
        const status=exp.status?.[m]||'unpaid';
        if(amt>0&&status!=='paid') total+=amt;
      }
    }
  });
  return total;
}
