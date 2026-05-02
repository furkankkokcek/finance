// Notifications

function checkDailyNotifications(){
  if(!S.settings.notifEnabled||Notification.permission!=='granted') return;
  const today=todayStr();
  if(S.settings.lastNotifDate===today) return;
  S.settings.lastNotifDate=today;
  saveS();

  const now=new Date();
  const year=now.getFullYear();
  const month=now.getMonth()+1;

  // Payment due today
  getYear(year).expenses.forEach(exp=>{
    if(!exp.dueDay) return;
    const adj=getAdjustedDueDate(year,month,exp.dueDay);
    if(adj.toDateString()===now.toDateString()){
      const amt=parseFloat(exp.amounts[month]||0);
      if(amt===0) return;
      new Notification('💳 Ödeme Günü!',{body:`${exp.name} — ${fmtTRY(amt)} bugün ödenmeli.`,icon:'/icons/icon-192.png'});
    }
  });

  // Salary day: PPF notification
  const sd=S.settings.salaryDay;
  if(now.getDate()===sd){
    const d=getMonthlyData(year,month);
    if(S.settings.ppfEnabled!==false&&d.ppfTotal>0){
      new Notification('🏦 PPF Hatırlatması',{body:`Bu ay PPF hesabına atılacak tutar: ${fmtTRY(d.ppfTotal)}`,icon:'/icons/icon-192.png'});
    }
    // Cash remaining notification
    new Notification('💵 Aylık Mali Özet',{body:`${MONTHS_FULL[month-1]} ${year}\nGelir: ${fmtTRY(d.totalIncome)}\nGider: ${fmtTRY(d.totalExpense)}\nNakit Kalan: ${fmtTRY(d.cashLeft)}`,icon:'/icons/icon-192.png'});
  }
}
