// WhatsApp share

function shareWhatsApp(){
  const year=S.settings.currentYear;
  const month=S.settings.currentMonth;
  const d=getMonthlyData(year,month);

  const text=`*${t('share.title',{month:MONTHS_FULL[month-1],year})}*\n\n`+
    `${t('share.income')} ${fmtTRY(d.totalIncome)}\n\n`+
    `${t('share.expenses')}\n`+
    (d.sabitTotal>0?`${t('share.fixed')} ${fmtTRY(d.sabitTotal)}\n`:'')+
    (d.krediTotal>0?`${t('share.loans')} ${fmtTRY(d.krediTotal)}\n`:'')+
    (d.kkTotal>0?`${t('share.cc')} ${fmtTRY(d.kkTotal)}\n`:'')+
    (d.abonelikTotal>0?`${t('share.subs')} ${fmtTRY(d.abonelikTotal)}\n`:'')+
    `${t('share.totalExpense')} ${fmtTRY(d.totalExpense)}\n\n`+
    `${t('share.investment')} ${fmtTRY(d.investment)}\n\n`+
    `${d.cashLeft<0?'🚨':d.cashLeft<d.investment?'⚠️':'✅'} *${t('share.cashLeft')} ${fmtTRY(d.cashLeft)}*\n`+
    `   ÷2 → ${fmtTRY(d.cashLeft/2)}\n`+
    `${t('share.statusLabel')} ${d.cashLeft<0?t('share.critical'):d.cashLeft<d.investment?t('share.warning'):t('share.healthy')}\n`+
    `${t('share.savings')} ${fmtPct(d.savingsRate)}`+
    (S.settings.ppfEnabled!==false&&d.ppfTotal>0?`\n${t('share.ppf')} ${fmtTRY(d.ppfTotal)}`:'');

  window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank');
}
