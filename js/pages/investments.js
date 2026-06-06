// Investments (Yatırımlar) page

const INV_TYPES = {hisse:'Hisse',fon:'Fon',altin:'Altın',btc:'Bitcoin',kripto:'Kripto',diger:'Diğer'};
const INV_COLORS = {hisse:'#3b82f6',fon:'#8b5cf6',altin:'#f59e0b',btc:'#f97316',kripto:'#ec4899',diger:'#6b7280'};

let _currentUsdRate = 0;
let _fetchingUsdRate = false;

async function fetchCurrentUsdRate(){
  if(_fetchingUsdRate) return;
  _fetchingUsdRate=true;
  try{
    const res=await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
    if(!res.ok) throw new Error();
    const data=await res.json();
    const rate=data?.usd?.try;
    if(rate&&rate>0){ _currentUsdRate=rate; renderYatirim(); }
  }catch{}
  _fetchingUsdRate=false;
}

function getPortfolio(){
  if(!S.investmentPortfolio) S.investmentPortfolio=[];
  return S.investmentPortfolio;
}

function calcInv(inv){
  const lots=inv.lots||[];
  const totalQty=lots.reduce((s,l)=>s+parseFloat(l.qty||0),0);
  const totalCostTL=lots.reduce((s,l)=>s+parseFloat(l.qty||0)*parseFloat(l.price||0),0);
  const totalCostUSD=lots.reduce((s,l)=>{
    const rate=parseFloat(l.usdRate||0);
    return s+(rate>0?(parseFloat(l.qty||0)*parseFloat(l.price||0))/rate:0);
  },0);
  const avgCostTL=totalQty>0?totalCostTL/totalQty:0;
  const avgCostUSD=totalQty>0?totalCostUSD/totalQty:0;
  const cur=parseFloat(inv.currentPrice||0);
  const currentValueTL=totalQty*cur;
  const currentValueUSD=_currentUsdRate>0?currentValueTL/_currentUsdRate:0;
  const pnlTL=currentValueTL-totalCostTL;
  const hasUsd=totalCostUSD>0&&_currentUsdRate>0;
  const pnlUSD=hasUsd?currentValueUSD-totalCostUSD:0;
  const pnlPct=totalCostTL>0?(pnlTL/totalCostTL)*100:0;
  return {totalQty,totalCostTL,totalCostUSD,avgCostTL,avgCostUSD,currentValueTL,currentValueUSD,pnlTL,pnlUSD,pnlPct,hasUsd};
}

function fmtUSD(n){
  if(!n&&n!==0||isNaN(n)) return '—';
  const abs=Math.abs(n);
  const str=abs.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  return (n<0?'-':'')+'$'+str;
}

function pnlColor(v){ return v>=0?'var(--success)':'var(--danger)'; }
function pnlSign(v){ return v>=0?'+':''; }

function renderYatirim(){
  const el=document.getElementById('yatirim-content');
  if(!el) return;
  const port=getPortfolio();

  // Kick off USD rate fetch if not yet loaded
  if(_currentUsdRate===0&&!_fetchingUsdRate) fetchCurrentUsdRate();

  const usdReady=_currentUsdRate>0;
  const usdNote=usdReady
    ?`$1 = ${_currentUsdRate.toFixed(2)}₺ (güncel, otomatik)`
    :'Dolar kuru yükleniyor...';

  let totalCostTL=0,totalCostUSD=0,totalValueTL=0,totalValueUSD=0;
  port.forEach(inv=>{
    const c=calcInv(inv);
    totalCostTL+=c.totalCostTL;
    totalCostUSD+=c.totalCostUSD;
    totalValueTL+=c.currentValueTL;
    totalValueUSD+=c.currentValueUSD;
  });
  const totalPnlTL=totalValueTL-totalCostTL;
  const totalPnlUSD=totalValueUSD-totalCostUSD;
  const totalPnlPct=totalCostTL>0?(totalPnlTL/totalCostTL)*100:0;

  let html='';

  if(port.length>0){
    html+=`<div style="padding:14px;background:var(--bg3);border-radius:var(--r2);border:1px solid var(--border);margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div class="section-title">PORTFÖY ÖZETİ</div>
        <div style="font-size:10px;color:var(--muted)">${usdNote}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:var(--bg4);padding:10px;border-radius:var(--r3)">
          <div style="font-size:10px;color:var(--muted);margin-bottom:3px">Toplam Maliyet</div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">${fmtTRY(totalCostTL)}</div>
          <div style="font-size:11px;color:var(--muted)">${usdReady?fmtUSD(totalCostUSD):'—'}</div>
        </div>
        <div style="background:var(--bg4);padding:10px;border-radius:var(--r3)">
          <div style="font-size:10px;color:var(--muted);margin-bottom:3px">Güncel Değer</div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">${fmtTRY(totalValueTL)}</div>
          <div style="font-size:11px;color:var(--muted)">${usdReady?fmtUSD(totalValueUSD):'—'}</div>
        </div>
        <div style="background:var(--bg4);padding:10px;border-radius:var(--r3);grid-column:1/-1">
          <div style="font-size:10px;color:var(--muted);margin-bottom:3px">Toplam Kâr / Zarar</div>
          <div style="font-size:15px;font-weight:700;color:${pnlColor(totalPnlTL)}">${pnlSign(totalPnlTL)}${fmtTRY(totalPnlTL)} (${pnlSign(totalPnlPct)}${totalPnlPct.toFixed(1)}%)</div>
          <div style="font-size:12px;color:${usdReady?pnlColor(totalPnlUSD):'var(--muted)'}">${usdReady?pnlSign(totalPnlUSD)+fmtUSD(totalPnlUSD):'USD yükleniyor...'}</div>
        </div>
      </div>
    </div>`;
  }

  if(port.length===0){
    html+=`<div class="empty"><div class="empty-icon">📈</div><div class="empty-text">Henüz yatırım kaydı yok</div><div class="empty-sub">Sağ alttaki + butonuna bas</div></div>`;
  } else {
    port.forEach(inv=>{
      const c=calcInv(inv);
      const tc=INV_COLORS[inv.type]||'#6b7280';
      html+=`<div style="padding:12px;background:var(--bg3);border-radius:var(--r2);border:1px solid var(--border);border-left:3px solid ${tc};margin-bottom:8px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
          <div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span style="font-size:14px;font-weight:700;color:var(--text)">${inv.name}</span>
              <span style="font-size:10px;padding:1px 6px;border-radius:10px;background:${tc}22;color:${tc};font-weight:700">${INV_TYPES[inv.type]||inv.type}</span>
            </div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">${c.totalQty} adet</div>
          </div>
          <div style="display:flex;gap:6px">
            <button onclick="openAddLot('${inv.id}')" style="padding:5px 10px;background:var(--accent);border:none;border-radius:var(--r3);color:#000;font-size:11px;font-weight:700;cursor:pointer">+ Alım</button>
            <button onclick="openEditInv('${inv.id}')" style="padding:5px 10px;background:var(--bg4);border:1px solid var(--border);border-radius:var(--r3);color:var(--accent);font-size:12px;cursor:pointer">✏️</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <div style="background:var(--bg4);padding:8px;border-radius:var(--r3)">
            <div style="font-size:10px;color:var(--muted)">Ort. Maliyet</div>
            <div style="font-size:12px;font-weight:600;color:var(--text)">${fmtTRY(c.avgCostTL)}</div>
            <div style="font-size:11px;color:var(--muted)">${fmtUSD(c.avgCostUSD)}</div>
          </div>
          <div style="background:var(--bg4);padding:8px;border-radius:var(--r3)">
            <div style="font-size:10px;color:var(--muted)">Güncel Fiyat</div>
            <div style="font-size:12px;font-weight:600;color:var(--text)">${inv.currentPrice?fmtTRY(parseFloat(inv.currentPrice)):'—'}</div>
            <div style="font-size:11px;color:var(--muted)">${usdReady?fmtUSD(parseFloat(inv.currentPrice||0)/_currentUsdRate):'—'}</div>
          </div>
          <div style="background:var(--bg4);padding:8px;border-radius:var(--r3);grid-column:1/-1">
            <div style="font-size:10px;color:var(--muted)">Kâr / Zarar</div>
            <div style="font-size:13px;font-weight:700;color:${pnlColor(c.pnlTL)}">${pnlSign(c.pnlTL)}${fmtTRY(c.pnlTL)} (${pnlSign(c.pnlPct)}${c.pnlPct.toFixed(1)}%)</div>
            <div style="font-size:11px;color:${c.hasUsd?pnlColor(c.pnlUSD):'var(--muted)'}">${c.hasUsd?pnlSign(c.pnlUSD)+fmtUSD(c.pnlUSD):'—'}</div>
          </div>
        </div>
      </div>`;
    });
  }

  el.innerHTML=html;
}

// --- Investment CRUD ---

function openAddInv(){
  document.getElementById('inv-modal-title').textContent='Yatırım Ekle';
  document.getElementById('inv-id').value='';
  document.getElementById('inv-name').value='';
  document.getElementById('inv-type').value='hisse';
  document.getElementById('inv-cur-price').value='';
  document.getElementById('inv-delete-btn').style.display='none';
  document.getElementById('inv-lots-section').style.display='none';
  openModal('overlay-inv');
}

function openEditInv(id){
  const inv=(S.investmentPortfolio||[]).find(x=>x.id===id);
  if(!inv) return;
  document.getElementById('inv-modal-title').textContent='Yatırım Düzenle';
  document.getElementById('inv-id').value=id;
  document.getElementById('inv-name').value=inv.name;
  document.getElementById('inv-type').value=inv.type||'hisse';
  document.getElementById('inv-cur-price').value=inv.currentPrice||'';
  document.getElementById('inv-delete-btn').style.display='block';
  renderInvLots(inv);
  document.getElementById('inv-lots-section').style.display='block';
  openModal('overlay-inv');
}

function renderInvLots(inv){
  const el=document.getElementById('inv-lots-list');
  if(!el) return;
  const lots=(inv.lots||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
  if(lots.length===0){
    el.innerHTML=`<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px 0">Henüz alım yok</div>`;
    return;
  }
  el.innerHTML=lots.map(l=>{
    const total=parseFloat(l.qty||0)*parseFloat(l.price||0);
    const usdTotal=parseFloat(l.usdRate||0)>0?total/parseFloat(l.usdRate):0;
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)">
      <div>
        <div style="font-size:12px;font-weight:600;color:var(--text)">${l.date} · ${l.qty} adet @ ${fmtTRY(l.price)}</div>
        <div style="font-size:11px;color:var(--muted)">$1 = ${parseFloat(l.usdRate||0).toFixed(4)}₺</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:12px;font-weight:700;color:var(--text)">${fmtTRY(total)}</div>
        <div style="font-size:11px;color:var(--muted)">${fmtUSD(usdTotal)}</div>
        <button onclick="deleteLot('${inv.id}','${l.id}')" style="font-size:10px;padding:1px 7px;background:var(--danger-bg);border:none;border-radius:var(--r3);color:var(--danger);cursor:pointer;margin-top:2px">Sil</button>
      </div>
    </div>`;
  }).join('');
}

function saveInv(){
  const id=document.getElementById('inv-id').value;
  const name=document.getElementById('inv-name').value.trim();
  if(!name){alert('Yatırım adı girin');return;}
  if(!S.investmentPortfolio) S.investmentPortfolio=[];
  const existing=id?S.investmentPortfolio.find(x=>x.id===id):null;
  const obj={
    id:id||uid('ip'),
    name,
    type:document.getElementById('inv-type').value,
    currentPrice:parseFloat(document.getElementById('inv-cur-price').value)||0,
    lots:existing?existing.lots:[]
  };
  if(id){
    const idx=S.investmentPortfolio.findIndex(x=>x.id===id);
    if(idx>=0) S.investmentPortfolio[idx]=obj; else S.investmentPortfolio.push(obj);
  } else {
    S.investmentPortfolio.push(obj);
  }
  saveS();
  closeModal('overlay-inv');
  renderYatirim();
  trackChange();
}

function deleteInv(){
  const id=document.getElementById('inv-id').value;
  if(!confirm('Bu yatırımı ve tüm alım geçmişini silmek istiyor musunuz?')) return;
  S.investmentPortfolio=(S.investmentPortfolio||[]).filter(x=>x.id!==id);
  saveS();
  closeModal('overlay-inv');
  renderYatirim();
  trackChange();
}

// --- Lot CRUD ---

function openAddLot(invId){
  document.getElementById('lot-inv-id').value=invId;
  document.getElementById('lot-date').value=todayStr();
  document.getElementById('lot-qty').value='';
  document.getElementById('lot-price').value='';
  document.getElementById('lot-usd-rate').value='';
  document.getElementById('lot-usd-status').textContent='';
  fetchUsdRate(todayStr());
  openModal('overlay-lot');
}

async function fetchUsdRate(date){
  if(!date) return;
  const statusEl=document.getElementById('lot-usd-status');
  const rateEl=document.getElementById('lot-usd-rate');
  if(statusEl) statusEl.textContent='Kur yükleniyor...';
  try{
    const url=`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/usd.json`;
    const res=await fetch(url,{cache:'force-cache'});
    if(!res.ok) throw new Error();
    const data=await res.json();
    const rate=data?.usd?.try;
    if(rate){
      if(rateEl) rateEl.value=rate.toFixed(4);
      if(statusEl) statusEl.textContent=`✓ ${date} günü TCMB kuru`;
    } else {
      throw new Error();
    }
  }catch{
    if(statusEl) statusEl.textContent='Kur alınamadı — manuel girin';
  }
}

function saveLot(){
  const invId=document.getElementById('lot-inv-id').value;
  const inv=(S.investmentPortfolio||[]).find(x=>x.id===invId);
  if(!inv){alert('Yatırım bulunamadı');return;}
  const date=document.getElementById('lot-date').value;
  const qty=parseFloat(document.getElementById('lot-qty').value);
  const price=parseFloat(document.getElementById('lot-price').value);
  const usdRate=parseFloat(document.getElementById('lot-usd-rate').value)||0;
  if(!date||!(qty>0)||!(price>0)){alert('Tarih, adet ve fiyat zorunludur');return;}
  if(!inv.lots) inv.lots=[];
  inv.lots.push({id:uid('lot'),date,qty,price,usdRate});
  saveS();
  closeModal('overlay-lot');
  renderInvLots(inv);
  renderYatirim();
  trackChange();
}

function deleteLot(invId,lotId){
  if(!confirm('Bu alımı silmek istiyor musunuz?')) return;
  const inv=(S.investmentPortfolio||[]).find(x=>x.id===invId);
  if(!inv) return;
  inv.lots=(inv.lots||[]).filter(l=>l.id!==lotId);
  saveS();
  renderInvLots(inv);
  renderYatirim();
  trackChange();
}
