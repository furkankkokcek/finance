// WhatsApp share

function shareWhatsApp(){
  const year=S.settings.currentYear;
  const month=S.settings.currentMonth;
  const d=getMonthlyData(year,month);

  const text=`*${MONTHS_FULL[month-1]} ${year} — Mali Özet*\n\n`+
    `🤑 *Gelir:* ${fmtTRY(d.totalIncome)}\n\n`+
    `*Harcamalar*\n`+
    (d.sabitTotal>0?`🏠 Sabit: ${fmtTRY(d.sabitTotal)}\n`:'')+
    (d.krediTotal>0?`🪙 Krediler: ${fmtTRY(d.krediTotal)}\n`:'')+
    (d.kkTotal>0?`💳 Kredi Kartı: ${fmtTRY(d.kkTotal)}\n`:'')+
    `💸 *Toplam Gider:* ${fmtTRY(d.totalExpense)}\n\n`+
    `💼 *Yatırım:* ${fmtTRY(d.investment)}\n\n`+
    `${d.cashLeft<0?'🚨':d.cashLeft<d.investment?'⚠️':'✅'} *NAKİT KALAN: ${fmtTRY(d.cashLeft)}*\n`+
    `   ÷2 → ${fmtTRY(d.cashLeft/2)}   ÷3 → ${fmtTRY(d.cashLeft/3)}   ÷4 → ${fmtTRY(d.cashLeft/4)}\n`+
    `📊 Durum: ${d.cashLeft<0?'KRİTİK 🚨':d.cashLeft<d.investment?'UYARI ⚠️':'SAĞLIKLI ✅'}\n`+
    `📈 Tasarruf: ${fmtPct(d.savingsRate)}`+
    (S.settings.ppfEnabled!==false&&d.ppfTotal>0?`\n🏦 PPF: ${fmtTRY(d.ppfTotal)}`:'');

  window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank');
}
