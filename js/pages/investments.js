// Investments (Yatırımlar) page

const INV_TYPES = {hisse:'Hisse',fon:'Fon',altin:'Altın',btc:'Bitcoin',kripto:'Kripto',diger:'Diğer'};
const INV_COLORS = {hisse:'#3b82f6',fon:'#8b5cf6',altin:'#f59e0b',btc:'#f97316',kripto:'#ec4899',diger:'#6b7280'};
const ALTIN_SUBTYPES = {gram:'Gram Altın', ayar22:'22 Ayar Altın', ceyrek:'Çeyrek Altın', sertifika:'Darphane Sertifikası'};

let _currentUsdRate = 0;
let _fetchingUsdRate = false;
let _fetchingPrices = false;
let _lastPriceFetch = 0;   // timestamp ms
let _priceStatus = {};     // { invId: 'ok'|'err'|'loading' }
let _altinCache = null;
let _altinFetching = false;

// ── USD rate ────────────────────────────────────────────────────────────────

async function fetchCurrentUsdRate(){
  if(_fetchingUsdRate) return;
  _fetchingUsdRate=true;
  try{
    const res=await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
    const data=await res.json();
    const rate=data?.usd?.try;
    if(rate>0){ _currentUsdRate=rate; fetchAllInvPrices(); }
  }catch{}
  _fetchingUsdRate=false;
}

// ── Live price helpers ───────────────────────────────────────────────────────

// genelpara.com bulk BIST data — fetched once, cached in module scope
let _bistData = null;
let _bistFetching = false;

async function getBistData(){
  if(_bistData) return _bistData;
  if(_bistFetching) return null;
  _bistFetching=true;
  try{
    const res=await fetch('https://api.genelpara.com/embed/borsa.json',{signal:AbortSignal.timeout(8000)});
    if(res.ok){ _bistData=await res.json(); }
  }catch{}
  _bistFetching=false;
  return _bistData;
}

async function fetchBistPrice(ticker){
  const code=ticker.replace(/\.IS$/i,'').toUpperCase();
  const data=await getBistData();
  if(data){
    const s=data[code];
    if(s){
      // Try common field names
      const price=parseFloat(s.deger||s.son||s.kapanis||s.satis||0);
      if(price>0) return price;
    }
  }
  // Fallback to Yahoo Finance proxies
  return fetchYahooPrice(ticker);
}

async function fetchAltinPrices(){
  if(_altinCache&&Date.now()-_altinCache.ts<5*60*1000) return _altinCache;
  if(_altinFetching) return _altinCache;
  _altinFetching=true;

  function parseTR(v){ return parseFloat((v||'').toString().replace(/\./g,'').replace(',','.')); }
  function calcSubtypes(gramHas){
    // gramHas = 24k (has) gold price per gram in TRY
    const gram=Math.round(gramHas*100)/100;
    const ayar22=Math.round(gramHas*(22/24)*100)/100;
    // Çeyrek altın ≈ 1.752g of 22k gold + market premium (~10%)
    const ceyrek=Math.round(gramHas*(22/24)*1.752*1.10*100)/100;
    return {gram,ayar22,ceyrek,ts:Date.now()};
  }

  // 1. fawazahmed0 XAU API — same CDN we use for USD rates, always works from browser
  try{
    const urls=[
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xau.json`,
      `https://latest.currency-api.pages.dev/v1/currencies/xau.json`
    ];
    for(const url of urls){
      try{
        const res=await fetch(url,{signal:AbortSignal.timeout(6000)});
        if(!res.ok) continue;
        const data=await res.json();
        const tryPerOz=data?.xau?.try;
        if(tryPerOz>0){
          const gramHas=tryPerOz/31.1035;
          _altinCache=calcSubtypes(gramHas);
          break;
        }
      }catch{}
    }
  }catch{}

  // 2. truncgil — actual Turkish market prices (gram, 22 ayar bilezik, çeyrek)
  if(!_altinCache){
    try{
      const res=await fetch('https://finans.truncgil.com/today.json',{signal:AbortSignal.timeout(8000)});
      if(res.ok){
        const data=await res.json();
        const gram=parseTR(data['Gram Altın']?.['Satış']);
        const ayar22=parseTR(data['22 Ayar Bilezik']?.['Satış']||data['22 Ayar']?.['Satış']);
        const ceyrek=parseTR(data['Çeyrek Altın']?.['Satış']);
        if(gram>0) _altinCache={gram,ayar22:ayar22||Math.round(gram*(22/24)*100)/100,ceyrek:ceyrek||0,ts:Date.now()};
      }
    }catch{}
  }

  // 3. genelpara — GA=gram altın, C=çeyrek
  if(!_altinCache){
    try{
      const res=await fetch('https://api.genelpara.com/embed/altin.json',{signal:AbortSignal.timeout(8000)});
      if(res.ok){
        const data=await res.json();
        const gram=parseTR(data?.GA?.satis||data?.GA?.alis);
        const ceyrek=parseTR(data?.C?.satis||data?.C?.alis);
        if(gram>0) _altinCache={gram,ayar22:Math.round(gram*(22/24)*100)/100,ceyrek:ceyrek||0,ts:Date.now()};
      }
    }catch{}
  }

  _altinFetching=false;
  return _altinCache;
}

async function fetchYahooPrice(ticker){
  const sym=ticker.toUpperCase();
  const yahooUrl=`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`;
  const attempts=[
    ()=>fetch(yahooUrl,{signal:AbortSignal.timeout(5000)}),
    ()=>fetch(`https://corsproxy.io/?${encodeURIComponent(yahooUrl)}`,{signal:AbortSignal.timeout(8000)}),
    ()=>fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`,{signal:AbortSignal.timeout(8000)}),
    ()=>fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(yahooUrl)}`,{signal:AbortSignal.timeout(8000)})
      .then(async r=>{ const j=await r.json(); return new Response(j.contents,{status:j.status?.http_code||200}); }),
  ];
  for(const attempt of attempts){
    try{
      const res=await attempt();
      if(!res.ok) continue;
      const text=await res.text();
      if(!text||text[0]!=='{') continue;
      const data=JSON.parse(text);
      const price=data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if(price>0) return price;
    }catch{}
  }
  throw new Error(`no price: ${sym}`);
}

async function fetchAllInvPrices(){
  if(_fetchingPrices) return;
  const port=getPortfolio();
  if(!port.length) return;
  _fetchingPrices=true;
  renderYatirim();

  const promises=[];

  // Gold — split: sertifika via BIST (ALTINS1), physical via fawazahmed0 XAU
  const goldInvs=port.filter(i=>i.type==='altin');
  if(goldInvs.length){
    // Darphane Sertifikası — BIST-listed, fetch like a stock
    goldInvs.filter(i=>i.goldSubtype==='sertifika').forEach(inv=>{
      promises.push(
        fetchBistPrice('ALTINS1')
          .then(price=>{ inv.currentPrice=Math.round(price*100)/100; _priceStatus[inv.id]='ok'; })
          .catch(()=>{ if(!_priceStatus[inv.id]) _priceStatus[inv.id]='err'; })
      );
    });
    // Physical gold: gram, 22 ayar, çeyrek
    const physicalGold=goldInvs.filter(i=>i.goldSubtype!=='sertifika');
    if(physicalGold.length){
      promises.push(
        fetchAltinPrices()
          .then(prices=>{
            if(!prices) throw new Error('no altin data');
            physicalGold.forEach(i=>{
              const sub=i.goldSubtype||'gram';
              const price=sub==='ayar22'?prices.ayar22:sub==='ceyrek'?prices.ceyrek:prices.gram;
              if(price>0){ i.currentPrice=Math.round(price*100)/100; _priceStatus[i.id]='ok'; }
              else if(!_priceStatus[i.id]) _priceStatus[i.id]='err';
            });
          })
          .catch(()=>{ physicalGold.forEach(i=>{ if(!_priceStatus[i.id]) _priceStatus[i.id]='err'; }); })
      );
    }
  }

  // Bitcoin — CoinGecko
  const btcInvs=port.filter(i=>i.type==='btc');
  if(btcInvs.length){
    promises.push(
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=try')
        .then(r=>r.json())
        .then(data=>{
          const price=data?.bitcoin?.try;
          if(price) btcInvs.forEach(i=>{ i.currentPrice=price; _priceStatus[i.id]='ok'; });
          else btcInvs.forEach(i=>{ if(!_priceStatus[i.id]) _priceStatus[i.id]='err'; });
        })
        .catch(()=>{ btcInvs.forEach(i=>{ if(!_priceStatus[i.id]) _priceStatus[i.id]='err'; }); })
    );
  }

  // Crypto — CoinGecko by ticker (coinId)
  const kriptoInvs=port.filter(i=>i.type==='kripto'&&i.ticker);
  if(kriptoInvs.length){
    const ids=[...new Set(kriptoInvs.map(i=>i.ticker.toLowerCase()))].join(',');
    promises.push(
      fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=try`)
        .then(r=>r.json())
        .then(data=>{
          kriptoInvs.forEach(i=>{
            const price=data?.[i.ticker.toLowerCase()]?.try;
            if(price){ i.currentPrice=price; _priceStatus[i.id]='ok'; }
            else if(!_priceStatus[i.id]) _priceStatus[i.id]='err';
          });
        })
        .catch(()=>{ kriptoInvs.forEach(i=>{ if(!_priceStatus[i.id]) _priceStatus[i.id]='err'; }); })
    );
  }

  // Stocks & funds — Yahoo Finance via allorigins proxy
  const yahooInvs=port.filter(i=>(i.type==='hisse'||i.type==='fon')&&i.ticker);
  yahooInvs.forEach(inv=>{
    promises.push(
      fetchYahooPrice(inv.ticker)
        .then(price=>{ inv.currentPrice=Math.round(price*100)/100; _priceStatus[inv.id]='ok'; })
        .catch(()=>{ if(!_priceStatus[inv.id]) _priceStatus[inv.id]='err'; })
    );
  });

  await Promise.allSettled(promises);
  _lastPriceFetch=Date.now();
  _fetchingPrices=false;
  saveS();
  renderYatirim();
}

function refreshPrices(){
  _priceStatus={};
  _lastPriceFetch=0;
  _altinCache=null;
  _bistData=null;
  if(_currentUsdRate>0) fetchAllInvPrices();
  else fetchCurrentUsdRate();
}

function updateInvPrice(id, val){
  const inv=(S.investmentPortfolio||[]).find(x=>x.id===id);
  if(!inv) return;
  const price=parseFloat(val)||0;
  if(price===inv.currentPrice) return;
  inv.currentPrice=price;
  saveS();
  renderYatirim();
}

// ── Calculations ─────────────────────────────────────────────────────────────

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

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtUSD(n){
  if(n===null||n===undefined||isNaN(n)) return '—';
  const abs=Math.abs(n);
  const str=abs.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  return (n<0?'-':'')+'$'+str;
}
function pnlColor(v){ return v>=0?'var(--success)':'var(--danger)'; }
function pnlSign(v){ return v>=0?'+':''; }

// ── Render ────────────────────────────────────────────────────────────────────

function renderYatirim(){
  const el=document.getElementById('yatirim-content');
  if(!el) return;
  const port=getPortfolio();

  // Boot: start USD+price fetch if not yet done
  if(_currentUsdRate===0&&!_fetchingUsdRate&&!_fetchingPrices) fetchCurrentUsdRate();

  const usdReady=_currentUsdRate>0;
  const fetchDone=_lastPriceFetch>0&&!_fetchingPrices;
  const usdNote=usdReady?`$1 = ${_currentUsdRate.toFixed(2)}₺`:'kur yükleniyor...';

  let totalCostTL=0,totalCostUSD=0,totalValueTL=0,totalValueUSD=0;
  port.forEach(inv=>{ const c=calcInv(inv); totalCostTL+=c.totalCostTL; totalCostUSD+=c.totalCostUSD; totalValueTL+=c.currentValueTL; totalValueUSD+=c.currentValueUSD; });
  const totalPnlTL=totalValueTL-totalCostTL;
  const totalPnlUSD=totalValueUSD-totalCostUSD;
  const totalPnlPct=totalCostTL>0?(totalPnlTL/totalCostTL)*100:0;

  let html='';

  if(port.length>0){
    const lastFetchStr=fetchDone?`Son güncelleme: ${new Date(_lastPriceFetch).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}`:'Fiyatlar yükleniyor...';
    html+=`<div style="padding:14px;background:var(--bg3);border-radius:var(--r2);border:1px solid var(--border);margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div class="section-title">PORTFÖY</div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:10px;color:var(--muted)">${lastFetchStr}</span>
          <button onclick="refreshPrices()" style="padding:3px 9px;background:var(--bg4);border:1px solid var(--border);border-radius:var(--r3);font-size:11px;color:var(--accent);cursor:pointer" title="Fiyatları yenile">↻</button>
        </div>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:8px">${usdNote}</div>
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
          <div style="font-size:10px;color:var(--muted);margin-bottom:3px">Toplam K/Z</div>
          <div style="font-size:15px;font-weight:700;color:${pnlColor(totalPnlTL)}">${pnlSign(totalPnlTL)}${fmtTRY(totalPnlTL)} (${pnlSign(totalPnlPct)}${totalPnlPct.toFixed(1)}%)</div>
          <div style="font-size:12px;color:${usdReady?pnlColor(totalPnlUSD):'var(--muted)'}">${usdReady?pnlSign(totalPnlUSD)+fmtUSD(totalPnlUSD):'—'}</div>
        </div>
      </div>
    </div>`;

    port.forEach(inv=>{
      const c=calcInv(inv);
      const tc=INV_COLORS[inv.type]||'#6b7280';
      const status=_priceStatus[inv.id];
      const priceStr=inv.currentPrice
        ?(inv.type==='btc'||inv.type==='kripto'
          ?'$'+parseFloat(inv.currentPrice).toLocaleString('en-US',{maximumFractionDigits:2})
          :fmtTRY(parseFloat(inv.currentPrice)))
        :'—';
      const statusBadge=_fetchingPrices&&!status
        ?`<span style="font-size:9px;color:var(--muted)"> ↻</span>`
        :status==='err'
        ?`<span style="font-size:9px;color:var(--danger)" title="Fiyat alınamadı"> !</span>`
        :'';
      html+=`<div style="padding:12px;background:var(--bg3);border-radius:var(--r2);border:1px solid var(--border);border-left:3px solid ${tc};margin-bottom:8px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
          <div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span style="font-size:14px;font-weight:700;color:var(--text)">${inv.name}${statusBadge}</span>
              <span style="font-size:10px;padding:1px 6px;border-radius:10px;background:${tc}22;color:${tc};font-weight:700">${INV_TYPES[inv.type]||inv.type}</span>
              ${inv.ticker?`<span style="font-size:10px;color:var(--muted)">${inv.ticker}</span>`:inv.type==='altin'&&inv.goldSubtype?`<span style="font-size:10px;color:var(--muted)">${ALTIN_SUBTYPES[inv.goldSubtype]||inv.goldSubtype}</span>`:''}
            </div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">${c.totalQty} ${inv.type==='altin'&&(inv.goldSubtype==='gram'||inv.goldSubtype==='ayar22')?'gram':'adet'}${inv.type==='altin'&&inv.goldSubtype==='sertifika'?` · ${(c.totalQty*0.01).toFixed(2)}g altın`:''}</div>
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
            <div style="font-size:11px;color:var(--muted)">${c.totalCostUSD>0?fmtUSD(c.avgCostUSD):'—'}</div>
          </div>
          <div style="background:var(--bg4);padding:8px;border-radius:var(--r3)">
            <div style="font-size:10px;color:var(--muted);margin-bottom:3px">Güncel Fiyat</div>
            <input type="number" min="0" step="any"
              value="${parseFloat(inv.currentPrice||0)||''}"
              placeholder="Gir…"
              onchange="updateInvPrice('${inv.id}',this.value)"
              style="width:100%;background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text);font-size:12px;font-weight:600;padding:2px 0;outline:none">
            <div style="font-size:11px;color:var(--muted);margin-top:2px">${usdReady&&inv.currentPrice?fmtUSD(parseFloat(inv.currentPrice)/_currentUsdRate):'—'}</div>
          </div>
          <div style="background:var(--bg4);padding:8px;border-radius:var(--r3);grid-column:1/-1">
            <div style="font-size:10px;color:var(--muted)">Kâr / Zarar</div>
            <div style="font-size:13px;font-weight:700;color:${pnlColor(c.pnlTL)}">${pnlSign(c.pnlTL)}${fmtTRY(c.pnlTL)} (${pnlSign(c.pnlPct)}${c.pnlPct.toFixed(1)}%)</div>
            <div style="font-size:11px;color:${c.hasUsd?pnlColor(c.pnlUSD):'var(--muted)'}">${c.hasUsd?pnlSign(c.pnlUSD)+fmtUSD(c.pnlUSD):'—'}</div>
          </div>
        </div>
      </div>`;
    });
  } else {
    html+=`<div class="empty"><div class="empty-icon">📈</div><div class="empty-text">Henüz yatırım kaydı yok</div><div class="empty-sub">Sağ alttaki + butonuna bas</div></div>`;
  }

  el.innerHTML=html;
}

// ── Investment CRUD ───────────────────────────────────────────────────────────

function onInvTypeChange(){
  const type=document.getElementById('inv-type').value;
  const tickerField=document.getElementById('inv-ticker-field');
  const autoNote=document.getElementById('inv-auto-note');
  const tickerLabel=document.getElementById('inv-ticker-label');
  const tickerEl=document.getElementById('inv-ticker');
  const goldSubField=document.getElementById('inv-gold-subtype-field');
  if(goldSubField) goldSubField.style.display='none';
  if(type==='altin'){
    tickerField.style.display='none';
    if(goldSubField) goldSubField.style.display='block';
    autoNote.style.display='block';
    autoNote.textContent='✓ Fiyat anlikaltinfiyatlari.com\'dan otomatik çekilir';
  } else if(type==='btc'){
    tickerField.style.display='none';
    autoNote.style.display='block';
    autoNote.textContent='✓ BTC/TRY fiyatı otomatik çekilir (CoinGecko)';
  } else if(type==='kripto'){
    tickerField.style.display='block';
    autoNote.style.display='none';
    tickerLabel.textContent='CoinGecko ID';
    tickerEl.placeholder='örn: ethereum, solana, cardano';
  } else if(type==='hisse'||type==='fon'){
    tickerField.style.display='block';
    autoNote.style.display='none';
    tickerLabel.textContent='Yahoo Finance Sembolü';
    tickerEl.placeholder=type==='hisse'?'örn: GARAN.IS, THYAO.IS':'örn: 0P00018M4X.IS';
  } else {
    tickerField.style.display='none';
    autoNote.style.display='none';
  }
}

function openAddInv(){
  document.getElementById('inv-modal-title').textContent='Yatırım Ekle';
  document.getElementById('inv-id').value='';
  document.getElementById('inv-name').value='';
  document.getElementById('inv-type').value='hisse';
  document.getElementById('inv-cur-price').value='';
  document.getElementById('inv-ticker').value='';
  document.getElementById('inv-gold-subtype').value='gram';
  document.getElementById('inv-delete-btn').style.display='none';
  document.getElementById('inv-lots-section').style.display='none';
  onInvTypeChange();
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
  document.getElementById('inv-ticker').value=inv.ticker||'';
  document.getElementById('inv-gold-subtype').value=inv.goldSubtype||'gram';
  document.getElementById('inv-delete-btn').style.display='block';
  renderInvLots(inv);
  document.getElementById('inv-lots-section').style.display='block';
  onInvTypeChange();
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
  const type=document.getElementById('inv-type').value;
  const rawTicker=document.getElementById('inv-ticker').value.trim();
  const ticker=rawTicker?(type==='kripto'?rawTicker.toLowerCase():rawTicker.toUpperCase()):'';
  const goldSubtype=type==='altin'?document.getElementById('inv-gold-subtype').value:'';
  const obj={
    id:id||uid('ip'),
    name,
    type,
    ticker:ticker||'',
    goldSubtype:goldSubtype||'',
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
  // Refresh prices for new/updated investment
  delete _priceStatus[obj.id];
  if(_currentUsdRate>0) fetchAllInvPrices(); else fetchCurrentUsdRate();
  renderYatirim();
  trackChange();
}

function deleteInv(){
  const id=document.getElementById('inv-id').value;
  if(!confirm('Bu yatırımı ve tüm alım geçmişini silmek istiyor musunuz?')) return;
  S.investmentPortfolio=(S.investmentPortfolio||[]).filter(x=>x.id!==id);
  delete _priceStatus[id];
  saveS();
  closeModal('overlay-inv');
  renderYatirim();
  trackChange();
}

// ── Lot CRUD ──────────────────────────────────────────────────────────────────

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
    const data=await res.json();
    const rate=data?.usd?.try;
    if(rate>0){
      if(rateEl) rateEl.value=rate.toFixed(4);
      if(statusEl) statusEl.textContent=`✓ ${date} kuru`;
    } else throw new Error();
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
