// Calendar tab - monthly grid, day detail, ICS export

let calStep=0;
let _calSelDay=null,_calSelYear=null,_calSelMonth=null;

function renderTakvim(){
  const el=document.getElementById('takvim-content');
  if(!el) return;

  const base=new Date(S.settings.currentYear,S.settings.currentMonth-1+calStep,1);
  const displayYear=base.getFullYear();
  const displayMonth=base.getMonth()+1;

  const events=getMonthEvents(displayYear,displayMonth);
  const byDay={};
  events.forEach(ev=>{ if(!byDay[ev.day]) byDay[ev.day]=[]; byDay[ev.day].push(ev); });

  const firstDow=new Date(displayYear,displayMonth-1,1).getDay();
  const firstMon=firstDow===0?6:firstDow-1; // Mon=0..Sun=6
  const daysInMonth=new Date(displayYear,displayMonth,0).getDate();
  const today=new Date();

  let html=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <button onclick="calStep--;renderTakvim()" style="padding:6px 14px;background:var(--bg4);border:1px solid var(--border);border-radius:var(--r3);color:var(--text);font-size:16px;cursor:pointer;line-height:1">‹</button>
      <div style="font-size:15px;font-weight:700;color:var(--text)">${MONTHS_FULL[displayMonth-1]} ${displayYear}</div>
      <button onclick="calStep++;renderTakvim()" style="padding:6px 14px;background:var(--bg4);border:1px solid var(--border);border-radius:var(--r3);color:var(--text);font-size:16px;cursor:pointer;line-height:1">›</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:2px">`;

  ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'].forEach(d=>{
    html+=`<div style="text-align:center;font-size:10px;font-weight:600;color:var(--muted);padding:3px 0">${d}</div>`;
  });
  html+=`</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">`;

  for(let i=0;i<firstMon;i++){
    html+=`<div style="min-height:50px;border-radius:var(--r3);background:var(--bg2)"></div>`;
  }

  for(let day=1;day<=daysInMonth;day++){
    const dayEvs=byDay[day]||[];
    const dateObj=new Date(displayYear,displayMonth-1,day);
    const isToday=today.getFullYear()===displayYear&&today.getMonth()+1===displayMonth&&today.getDate()===day;
    const isSel=_calSelDay===day&&_calSelYear===displayYear&&_calSelMonth===displayMonth;
    const dow=dateObj.getDay();
    const isWknd=dow===0||dow===6;
    const isHol=!isWknd&&isPublicHoliday(dateObj);
    const isGray=isWknd||isHol; // weekends + public holidays = same muted look

    let evHtml='';
    dayEvs.slice(0,3).forEach(ev=>{
      evHtml+=`<div style="font-size:9px;font-weight:600;color:${ev.color};background:${ev.color}22;border-radius:2px;padding:1px 2px;margin-top:1px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${ev.name.slice(0,7)}</div>`;
    });
    if(dayEvs.length>3) evHtml+=`<div style="font-size:9px;color:var(--muted)">+${dayEvs.length-3}</div>`;

    const bg=isSel?'rgba(245,158,11,.22)':isToday?'rgba(245,158,11,.1)':isGray?'var(--bg2)':'var(--bg3)';
    const bdr=isSel?'rgba(245,158,11,.55)':isToday?'rgba(245,158,11,.3)':'var(--border)';
    const numColor=isToday?'var(--accent)':isGray?'var(--muted)':'var(--text)';
    const numWeight=isToday?'700':'500';
    // Small holiday dot for official holidays (not weekends)
    const holDot=isHol?`<span style="display:inline-block;width:4px;height:4px;border-radius:50%;background:var(--muted);margin-left:2px;vertical-align:middle"></span>`:'';

    html+=`<div onclick="selectCalDay(${day},${displayYear},${displayMonth})" style="min-height:50px;border-radius:var(--r3);background:${bg};border:1px solid ${bdr};padding:3px;cursor:pointer;overflow:hidden">
      <div style="font-size:11px;font-weight:${numWeight};color:${numColor}">${day}${holDot}</div>
      ${evHtml}
    </div>`;
  }
  html+=`</div>`;

  // Selected day detail panel
  if(_calSelDay&&_calSelYear===displayYear&&_calSelMonth===displayMonth){
    const dayEvs=byDay[_calSelDay]||[];
    const selDate=new Date(displayYear,displayMonth-1,_calSelDay);
    const selIsHol=isPublicHoliday(selDate);
    html+=`<div style="margin-top:10px;padding:12px;background:var(--bg3);border-radius:var(--r2);border:1px solid var(--border)">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:6px">${_calSelDay} ${MONTHS_FULL[displayMonth-1]} ${displayYear}${selIsHol?'<span style="font-size:11px;color:var(--muted);font-weight:400;margin-left:6px">Resmi Tatil</span>':''}</div>`;
    if(dayEvs.length===0){
      html+=`<div style="font-size:12px;color:var(--muted);text-align:center;padding:4px 0">Bu gün ödeme yok</div>`;
    } else {
      dayEvs.forEach(ev=>{
        const typeLabel=ev.type==='income'?'Gelir':ev.isReminder?'PPF hatırlatma':(CAT_LABELS[ev.type]||ev.type);
        html+=`<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)">
          <div>
            <div style="font-size:13px;font-weight:600;color:${ev.color}">${ev.name}</div>
            <div style="font-size:11px;color:var(--muted)">${typeLabel}</div>
          </div>
          <div class="inv-amount" style="font-size:13px;font-weight:700;color:var(--text)">${fmtTRY(ev.amount)}</div>
        </div>`;
      });
    }
    html+=`</div>`;
  }

  // Legend
  html+=`<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;padding:8px 10px;background:var(--bg3);border-radius:var(--r2)">`;
  [{c:'#3b82f6',l:'Sabit'},{c:'#ef4444',l:'Kredi'},{c:'#f59e0b',l:'KK'},{c:'#a855f7',l:'PPF Hatırl.'},{c:'#22c55e',l:'Maaş/Gelir'}].forEach(({c,l})=>{
    html+=`<div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:50%;background:${c}"></div><span style="font-size:11px;color:var(--muted)">${l}</span></div>`;
  });
  html+=`<div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:50%;background:var(--muted)"></div><span style="font-size:11px;color:var(--muted)">Tatil/Haftasonu</span></div>`;
  html+=`</div>`;

  html+=`<div style="font-size:11px;color:var(--muted);margin-top:12px;padding:8px 10px;background:var(--bg3);border-radius:var(--r2);line-height:1.6">
    📱 <strong style="color:var(--text)">Takvime Aktar nedir?</strong> Ödeme günlerini telefonunuzun veya bilgisayarınızın takvimine <strong style="color:var(--text)">etkinlik</strong> olarak ekler. İndirilen <code style="font-size:10px;background:var(--bg4);padding:1px 4px;border-radius:3px">.ics</code> dosyasını Google Takvim, Apple Takvim veya Outlook ile açın.
  </div>`;
  html+=`<button class="btn-secondary" style="margin-top:8px" onclick="exportICS(${displayYear},${displayMonth})">📅 Bu Ayı Takvime Aktar (.ics)</button>`;

  el.innerHTML=html;
}

function selectCalDay(day,year,month){
  if(_calSelDay===day&&_calSelYear===year&&_calSelMonth===month){
    _calSelDay=null;_calSelYear=null;_calSelMonth=null;
  } else {
    _calSelDay=day;_calSelYear=year;_calSelMonth=month;
  }
  renderTakvim();
}

function exportICS(year,month){
  const pad=n=>String(n).padStart(2,'0');
  const monthName=MONTHS_FULL[month-1];
  const escICS=s=>String(s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
  // RFC 5545: fold lines longer than 75 octets (CRLF + single space continuation)
  const fold=s=>{
    const bytes=new TextEncoder();
    let out='',line='';
    for(const ch of s){
      const test=line+ch;
      if(bytes.encode(test).length>74){out+=test.slice(0,-ch.length)+'\r\n ';line=' '+ch;}
      else line=test;
    }
    return out+line;
  };
  const now=new Date();
  const dtstamp=`${now.getUTCFullYear()}${pad(now.getUTCMonth()+1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const out=['BEGIN:VCALENDAR','VERSION:2.0','CALSCALE:GREGORIAN','METHOD:PUBLISH',
    'PRODID:-//FinTrack//TR',`X-WR-CALNAME:FinTrack ${monthName} ${year}`,'X-WR-TIMEZONE:Europe/Istanbul'];

  getMonthEvents(year,month).forEach(ev=>{
    const d=new Date(year,month-1,ev.day);
    const dateStr=`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
    const dEnd=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1);
    const dateEndStr=`${dEnd.getFullYear()}${pad(dEnd.getMonth()+1)}${pad(dEnd.getDate())}`;
    const typeLabel=ev.type==='income'?'Gelir':ev.isReminder?'PPF hatirlatma':(CAT_LABELS[ev.type]||ev.type);
    const amountStr=Math.round(ev.amount).toLocaleString('tr-TR')+' TL';
    const evUid=`ft-${year}-${pad(month)}-${pad(ev.day)}-${ev.expId||'inc'}-${Math.random().toString(36).slice(2,7)}@fintrack`;
    out.push('BEGIN:VEVENT');
    out.push(`UID:${evUid}`);
    out.push(`DTSTAMP:${dtstamp}`);
    out.push(`DTSTART;VALUE=DATE:${dateStr}`);
    out.push(`DTEND;VALUE=DATE:${dateEndStr}`);
    out.push(fold(`SUMMARY:${escICS(ev.name)}`));
    out.push(fold(`DESCRIPTION:${escICS(amountStr+' - '+typeLabel)}`));
    out.push('END:VEVENT');
  });

  out.push('END:VCALENDAR');
  const blob=new Blob([out.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=`fintrack_${year}-${pad(month)}.ics`;a.click();
  URL.revokeObjectURL(url);
}
