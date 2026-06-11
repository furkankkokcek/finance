// Investments (Yatırımlar) page

const INV_TYPES = {hisse:'Hisse',fon:'Fon',altin:'Altın',btc:'Bitcoin',kripto:'Kripto',diger:'Diğer'};
const INV_COLORS = {hisse:'#3b82f6',fon:'#8b5cf6',altin:'#f59e0b',btc:'#f97316',kripto:'#ec4899',diger:'#6b7280'};
const ALTIN_SUBTYPES = {gram:'Gram Altın', ayar22:'22 Ayar Altın', ceyrek:'Çeyrek Altın'};

let _currentUsdRate = 0;
let _fetchingUsdRate = false;
let _fetchingPrices = false;
let _lastPriceFetch = 0;   // timestamp ms
let _priceStatus = {};     // { invId: 'ok'|'err'|'loading' }
let _altinCache = null;
let _altinFetching = false;
let _fetchLog = [];        // price fetch diagnostics

function addFetchLog(source, status, detail, ms){
  _fetchLog.unshift({ts:Date.now(),source,status,detail,ms:Math.round(ms)});
  if(_fetchLog.length>150) _fetchLog.length=150;
}

function openFetchLog(){
  renderFetchLog();
  openModal('overlay-price-log');
}

function renderFetchLog(){
  const el=document.getElementById('price-log-body');
  if(!el) return;
  if(!_fetchLog.length){
    el.innerHTML='<div style="text-align:center;color:var(--muted);padding:28px 0;font-size:13px">Henüz log yok — fiyatlar yüklendikten sonra tekrar açın</div>';
    return;
  }
  el.innerHTML=_fetchLog.map(e=>{
    const t=new Date(e.ts).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const ok=e.status==='ok';
    return `<div style="display:flex;align-items:baseline;gap:6px;padding:5px 0;border-bottom:1px solid var(--border)">
      <span style="color:var(--muted);flex-shrink:0;font-size:10px;font-family:monospace">${t}</span>
      <span style="color:${ok?'var(--success)':'var(--danger)'};flex-shrink:0;font-size:12px">${ok?'✓':'✗'}</span>
      <span style="color:var(--text);flex:1;font-size:12px">${e.source}</span>
      <span style="color:var(--muted);font-size:11px">${e.detail}</span>
      <span style="color:var(--muted);flex-shrink:0;font-size:10px;font-family:monospace">${e.ms}ms</span>
    </div>`;
  }).join('');
}

function calcAltinFromGram(gramHas){
  const gram=Math.round(gramHas*100)/100;
  const ayar22=Math.round(gramHas*(22/24)*100)/100;
  const ceyrek=Math.round(gramHas*(22/24)*1.752*1.10*100)/100;
  return {gram,ayar22,ceyrek,ts:Date.now()};
}

// ── USD rate ────────────────────────────────────────────────────────────────

async function fetchCurrentUsdRate(){
  if(_fetchingUsdRate) return;
  _fetchingUsdRate=true;
  const tryParse=d=>{
    if(d?.usd?.try>0) return {rate:d.usd.try,xauPerUsd:d?.usd?.xau||0};
    const r=parseFloat((d?.USD?.satis||d?.USD?.alis||'').toString().replace(',','.'));
    if(r>0) return {rate:r,xauPerUsd:0};
    throw new Error('no rate');
  };
  const t0=Date.now();
  const tagU=(label,p)=>p.then(v=>{addFetchLog(label,'ok',`$1 = ${v.rate.toFixed(2)}₺`,Date.now()-t0);return v;}).catch(e=>{addFetchLog(label,'err','',Date.now()-t0);throw e;});
  try{
    const {rate,xauPerUsd}=await Promise.any([
      tagU('USD (Cloudflare)',fetch('https://latest.currency-api.pages.dev/v1/currencies/usd.json',{signal:AbortSignal.timeout(3000)}).then(r=>r.json()).then(tryParse)),
      tagU('USD (jsDelivr)',fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',{signal:AbortSignal.timeout(3000)}).then(r=>r.json()).then(tryParse)),
      tagU('USD (genelpara)',fetch('https://api.genelpara.com/embed/doviz.json',{signal:AbortSignal.timeout(3000)}).then(r=>r.json()).then(tryParse)),
    ]);
    _currentUsdRate=rate;
    if(xauPerUsd>0&&!_altinCache) _altinCache=calcAltinFromGram((1/xauPerUsd)/31.1035*rate);
    renderYatirim();
  }catch{}
  _fetchingUsdRate=false;
}

// ── Live price helpers ───────────────────────────────────────────────────────

async function fetchBistPrice(ticker){
  const code=ticker.replace(/\.IS$/i,'').toUpperCase();
  const t0=Date.now();
  const tag=(label,p)=>p
    .then(v=>{ addFetchLog(`${code} (${label})`,'ok',fmtTRY(v),Date.now()-t0); return v; })
    .catch(()=>{ addFetchLog(`${code} (${label})`,'err','',Date.now()-t0); throw new Error(); });

  const yahooSym=code+'.IS';

  // v8/chart endpoint parsers
  const v8Url=`https://query2.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=1d&range=1d&corsDomain=finance.yahoo.com`;
  const v8UrlAlt=`https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=1d&range=1d`;
  const parseV8=async r=>{
    if(!r.ok) throw new Error();
    const text=await r.text();
    if(!text||text[0]!=='{') throw new Error();
    const p=JSON.parse(text)?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if(!(p>0)) throw new Error();
    return p;
  };

  // v7/quote endpoint parsers
  const v7Url=`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooSym}&corsDomain=finance.yahoo.com`;
  const parseV7=async r=>{
    if(!r.ok) throw new Error();
    const text=await r.text();
    if(!text||text[0]!=='{') throw new Error();
    const p=JSON.parse(text)?.quoteResponse?.result?.[0]?.regularMarketPrice;
    if(!(p>0)) throw new Error();
    return p;
  };

  // search endpoint — reportedly no crumb required
  const searchUrl=`https://query1.finance.yahoo.com/v1/finance/search?q=${yahooSym}&quotesCount=1&newsCount=0&enableFuzzyQuery=false`;
  const parseSearch=async r=>{
    if(!r.ok) throw new Error();
    const text=await r.text();
    if(!text||text[0]!=='{') throw new Error();
    const p=JSON.parse(text)?.quotes?.[0]?.regularMarketPrice;
    if(!(p>0)) throw new Error();
    return p;
  };

  // spark endpoint
  const sparkUrl=`https://query1.finance.yahoo.com/v8/finance/spark?symbols=${yahooSym}&range=1d&interval=1d`;
  const parseSpark=async r=>{
    if(!r.ok) throw new Error();
    const text=await r.text();
    if(!text||text[0]!=='{') throw new Error();
    const p=JSON.parse(text)?.spark?.result?.[0]?.response?.[0]?.meta?.regularMarketPrice;
    if(!(p>0)) throw new Error();
    return p;
  };

  const ao=(url,parser,ms)=>fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,{signal:AbortSignal.timeout(ms)}).then(parser);
  const aoGet=(url,parser,ms)=>fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,{signal:AbortSignal.timeout(ms)})
    .then(async r=>{ const j=await r.json(); return parser(new Response(j.contents||'{}',{status:j.status?.http_code||200})); });
  const cp=(url,parser,ms)=>fetch(`https://corsproxy.io/?${url}`,{signal:AbortSignal.timeout(ms)}).then(parser);
  const ct=(url,parser,ms)=>fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,{signal:AbortSignal.timeout(ms)}).then(parser);
  const tp=(url,parser,ms)=>fetch(`https://thingproxy.freeboard.io/fetch/${url}`,{signal:AbortSignal.timeout(ms)}).then(parser);

  return Promise.any([
    tag('Yahoo v8 direct',      fetch(v8Url,{signal:AbortSignal.timeout(6000)}).then(parseV8)),
    tag('Yahoo v8 (allorigins raw)', ao(v8Url,parseV8,10000)),
    tag('Yahoo v8 (allorigins get)', aoGet(v8Url,parseV8,10000)),
    tag('Yahoo v8 (corsproxy)',  cp(v8Url,parseV8,10000)),
    tag('Yahoo v8 (codetabs)',   ct(v8UrlAlt,parseV8,10000)),
    tag('Yahoo v8 (thingproxy)',  tp(v8UrlAlt,parseV8,12000)),
    tag('Yahoo v7 (corsproxy)',  cp(v7Url,parseV7,10000)),
    tag('Yahoo v7 (codetabs)',   ct(v7Url.replace('corsDomain=finance.yahoo.com&',''),parseV7,10000)),
    tag('Yahoo search direct',   fetch(searchUrl,{signal:AbortSignal.timeout(6000)}).then(parseSearch)),
    tag('Yahoo search (allorigins)', ao(searchUrl,parseSearch,10000)),
    tag('Yahoo search (corsproxy)',  cp(searchUrl,parseSearch,10000)),
    tag('Yahoo spark (allorigins)', ao(sparkUrl,parseSpark,10000)),
    tag('Yahoo spark (corsproxy)',  cp(sparkUrl,parseSpark,10000)),
  ]);
}

async function fetchAltinPrices(){
  if(_altinCache&&Date.now()-_altinCache.ts<5*60*1000) return _altinCache;
  if(_altinFetching) return _altinCache;
  _altinFetching=true;
  if(_altinCache){ _altinFetching=false; return _altinCache; }

  function parseTR(v){ return parseFloat((v||'').toString().replace(/\./g,'').replace(',','.')); }

  const t0a=Date.now();
  try{
    _altinCache=await fetch('https://finans.truncgil.com/today.json',{signal:AbortSignal.timeout(6000)})
      .then(r=>r.json())
      .then(d=>{
        const gram=parseTR(d['gram-altin']?.['Alış']);
        if(!(gram>0)) throw new Error();
        const ayar22=parseTR(d['22-ayar-bilezik']?.['Alış']);
        const ceyrek=parseTR(d['ceyrek-altin']?.['Alış']);
        const result={gram,ayar22:ayar22||Math.round(gram*(22/24)*100)/100,ceyrek:ceyrek||0,ts:Date.now()};
        addFetchLog('Altın (truncgil)','ok',`gram = ${fmtTRY(gram)}`,Date.now()-t0a);
        return result;
      });
  }catch{ addFetchLog('Altın (truncgil)','err','',Date.now()-t0a); }

  _altinFetching=false;
  return _altinCache;
}

async function fetchAllInvPrices(){
  if(_fetchingPrices) return;
  const port=getPortfolio();
  if(!port.length) return;
  _fetchingPrices=true;
  renderYatirim();

  const promises=[];

  // Gold
  const goldInvs=port.filter(i=>i.type==='altin');
  if(goldInvs.length){
    promises.push(
      fetchAltinPrices()
        .then(prices=>{
          if(!prices?.gram) throw new Error('no altin data');
          goldInvs.forEach(i=>{
            const sub=i.goldSubtype||'gram';
            const price=sub==='ayar22'?prices.ayar22:sub==='ceyrek'?prices.ceyrek:prices.gram;
            if(price>0){ i.currentPrice=Math.round(price*100)/100; i.priceUpdatedAt=Date.now(); _priceStatus[i.id]='ok'; }
            else if(!_priceStatus[i.id]) _priceStatus[i.id]='err';
          });
          renderYatirim();
        })
        .catch(()=>{ goldInvs.forEach(i=>{ if(!_priceStatus[i.id]) _priceStatus[i.id]='err'; }); renderYatirim(); })
    );
  }

  // Bitcoin — Binance BTCTRY (sub-200ms) with CoinGecko fallback
  const btcInvs=port.filter(i=>i.type==='btc');
  if(btcInvs.length){
    const t0b=Date.now();
    const tagB=(label,p)=>p.then(v=>{addFetchLog(label,'ok',fmtTRY(v),Date.now()-t0b);return v;}).catch(e=>{addFetchLog(label,'err','',Date.now()-t0b);throw e;});
    promises.push(
      Promise.any([
        tagB('BTC (BTCTurk)',fetch('https://api.btcturk.com/api/v2/ticker?pairSymbol=BTCTRY',{signal:AbortSignal.timeout(5000)})
          .then(r=>r.json()).then(d=>{ const p=parseFloat(d?.data?.[0]?.last||d?.data?.last||0); if(!(p>0)) throw new Error(); return p; })),
        tagB('BTC (Binance)',fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCTRY',{signal:AbortSignal.timeout(5000)})
          .then(r=>r.json()).then(d=>{ const p=parseFloat(d.price); if(!(p>0)) throw new Error(); return p; })),
        tagB('BTC (CoinGecko)',fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=try',{signal:AbortSignal.timeout(8000)})
          .then(r=>r.json()).then(d=>{ const p=d?.bitcoin?.try; if(!(p>0)) throw new Error(); return p; })),
      ])
      .then(price=>{ btcInvs.forEach(i=>{ i.currentPrice=price; i.priceUpdatedAt=Date.now(); _priceStatus[i.id]='ok'; }); renderYatirim(); })
      .catch(()=>{ btcInvs.forEach(i=>{ if(!_priceStatus[i.id]) _priceStatus[i.id]='err'; }); renderYatirim(); })
    );
  }

  // Crypto — CoinGecko by ticker (coinId)
  const kriptoInvs=port.filter(i=>i.type==='kripto'&&i.ticker);
  if(kriptoInvs.length){
    const t0k=Date.now();
    const ids=[...new Set(kriptoInvs.map(i=>i.ticker.toLowerCase()))].join(',');
    promises.push(
      fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=try`,{signal:AbortSignal.timeout(5000)})
        .then(r=>r.json())
        .then(data=>{
          kriptoInvs.forEach(i=>{
            const price=data?.[i.ticker.toLowerCase()]?.try;
            if(price){ addFetchLog(`${i.ticker} (CoinGecko)`,'ok',fmtTRY(price),Date.now()-t0k); i.currentPrice=price; i.priceUpdatedAt=Date.now(); _priceStatus[i.id]='ok'; }
            else{ addFetchLog(`${i.ticker} (CoinGecko)`,'err','bulunamadı',Date.now()-t0k); if(!_priceStatus[i.id]) _priceStatus[i.id]='err'; }
          });
          renderYatirim();
        })
        .catch(()=>{ kriptoInvs.forEach(i=>{ addFetchLog(`${i.ticker} (CoinGecko)`,'err','',Date.now()-t0k); if(!_priceStatus[i.id]) _priceStatus[i.id]='err'; }); renderYatirim(); })
    );
  }

  // Stocks & funds — Yahoo Finance (multiple proxies, race for first success)
  const bistInvs=port.filter(i=>(i.type==='hisse'||i.type==='fon')&&i.ticker);
  if(bistInvs.length){
    bistInvs.forEach(inv=>{
      promises.push(
        fetchBistPrice(inv.ticker)
          .then(price=>{ inv.currentPrice=Math.round(price*100)/100; inv.priceUpdatedAt=Date.now(); _priceStatus[inv.id]='ok'; renderYatirim(); })
          .catch(()=>{ if(!_priceStatus[inv.id]) _priceStatus[inv.id]='err'; renderYatirim(); })
      );
    });
  }

  await Promise.allSettled(promises);
  _lastPriceFetch=Date.now();
  _fetchingPrices=false;
  saveS();
  renderYatirim();
}

function refreshPrices(){
  _fetchLog=[];
  _priceStatus={};
  _lastPriceFetch=0;
  _altinCache=null;
  _bistData=null;
  fetchCurrentUsdRate();
  fetchAllInvPrices();
}

function updateInvPrice(id, val){
  const inv=(S.investmentPortfolio||[]).find(x=>x.id===id);
  if(!inv) return;
  const price=parseFloat(val)||0;
  if(price===inv.currentPrice) return;
  inv.currentPrice=price;
  inv.priceUpdatedAt=Date.now();
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

function renderInvGoal(port){
  const goal=S.settings.invGoal||{};
  const goalAmt=parseFloat(goal.amount||0);
  const goalCur=goal.currency||'usd';

  let totalValueTL=0;
  port.forEach(inv=>{ const c=calcInv(inv); totalValueTL+=c.currentValueTL; });

  const goalInTL=goalCur==='usd'&&_currentUsdRate>0?goalAmt*_currentUsdRate:goalCur==='try'?goalAmt:0;
  const pct=goalInTL>0?Math.min(100,(totalValueTL/goalInTL)*100):0;
  const remaining=Math.max(0,goalInTL-totalValueTL);
  const reached=goalAmt>0&&goalInTL>0&&totalValueTL>=goalInTL;
  const progressColor=reached?'var(--success)':'var(--accent)';
  const usdActive=goalCur==='usd';

  let progressHtml='';
  if(goalAmt>0){
    const goalLabel=usdActive
      ?'$'+goalAmt.toLocaleString('en-US')+(_currentUsdRate>0?' ('+fmtTRY(goalAmt*_currentUsdRate)+')':'')
      :fmtTRY(goalAmt);
    const remainLabel=usdActive&&_currentUsdRate>0
      ?fmtTRY(remaining)+' ('+fmtUSD(remaining/_currentUsdRate)+')'
      :fmtTRY(remaining);
    progressHtml=`
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:5px">
        <span>Mevcut: <span class="inv-amount" style="font-weight:600;color:var(--text)">${fmtTRY(totalValueTL)}</span></span>
        <span>Hedef: <span class="inv-amount">${goalLabel}</span></span>
      </div>
      <div style="background:var(--bg4);border-radius:4px;height:10px;overflow:hidden;margin-bottom:6px">
        <div style="height:100%;width:${pct.toFixed(1)}%;background:${progressColor};border-radius:4px;transition:width .3s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px">
        <span style="color:var(--muted)">${reached?'🎯 Hedefe ulaşıldı!':'Kalan: <span class="inv-amount">'+remainLabel+'</span>'}</span>
        <span style="color:${progressColor};font-weight:700">${pct.toFixed(1)}% tamamlandı</span>
      </div>`;
  }

  return `<div style="padding:12px;background:var(--bg3);border-radius:var(--r2);border:1px solid var(--border);margin-bottom:12px">
    <div class="section-title" style="margin-bottom:10px">HEDEF</div>
    <div style="display:flex;gap:6px;align-items:stretch;margin-bottom:${goalAmt>0?'10':'0'}px">
      <input id="inv-goal-input" type="number" min="0" step="any" value="${goalAmt||''}" placeholder="Hedef tutarı girin…"
        onchange="saveInvGoal(this.value,'${goalCur}')"
        style="flex:1;background:var(--bg4);border:1px solid var(--border);border-radius:var(--r3);color:var(--text);font-size:14px;font-weight:700;padding:8px 10px;outline:none">
      <button onclick="saveInvGoal(document.getElementById('inv-goal-input').value,'usd')"
        style="padding:6px 12px;border-radius:var(--r3);font-size:13px;font-weight:700;cursor:pointer;border:1px solid var(--border);background:${usdActive?'var(--accent)':'var(--bg4)'};color:${usdActive?'#000':'var(--text)'}">$</button>
      <button onclick="saveInvGoal(document.getElementById('inv-goal-input').value,'try')"
        style="padding:6px 12px;border-radius:var(--r3);font-size:13px;font-weight:700;cursor:pointer;border:1px solid var(--border);background:${!usdActive?'var(--accent)':'var(--bg4)'};color:${!usdActive?'#000':'var(--text)'}">₺</button>
    </div>
    ${progressHtml}
  </div>`;
}

function saveInvGoal(amount, currency){
  if(!S.settings.invGoal) S.settings.invGoal={};
  S.settings.invGoal.amount=parseFloat(amount)||0;
  S.settings.invGoal.currency=currency||'usd';
  saveS();
  renderYatirim();
}

function updateGoalProgressBtn(){
  const btn=document.getElementById('goal-progress-btn');
  if(!btn) return;
  const goal=S.settings.invGoal||{};
  const goalAmt=parseFloat(goal.amount||0);
  if(!goalAmt){ btn.style.display='none'; return; }
  const port=getPortfolio();
  let totalValueTL=0;
  port.forEach(inv=>{ const c=calcInv(inv); totalValueTL+=c.currentValueTL; });
  const goalCur=goal.currency||'usd';
  const goalInTL=goalCur==='usd'&&_currentUsdRate>0?goalAmt*_currentUsdRate:goalCur==='try'?goalAmt:0;
  const pct=goalInTL>0?Math.min(100,(totalValueTL/goalInTL)*100):0;
  const C=56.55;
  const dashLen=(pct/100)*C;
  const color=pct>=100?'var(--success)':'var(--accent)';
  const pctRnd=Math.round(pct);
  btn.style.display='flex';
  btn.innerHTML=`<svg viewBox="0 0 24 24" width="22" height="22">
    <circle cx="12" cy="12" r="9" fill="none" stroke="var(--border2)" stroke-width="2.5"/>
    <circle cx="12" cy="12" r="9" fill="none" stroke="${color}" stroke-width="2.5"
      stroke-dasharray="${dashLen.toFixed(1)} ${C}"
      transform="rotate(-90 12 12)" stroke-linecap="round"/>
    <text x="12" y="15" text-anchor="middle" font-size="${pctRnd>=100?5:6}" fill="var(--text)" font-weight="700" font-family="Outfit,sans-serif">${pctRnd}%</text>
  </svg>`;
}

function renderAllocationChart(port){
  const groups={};
  port.forEach(inv=>{
    const c=calcInv(inv);
    if(c.currentValueTL<=0) return;
    groups[inv.type]=(groups[inv.type]||0)+c.currentValueTL;
  });
  const segs=Object.entries(groups).filter(([,v])=>v>0).map(([type,val])=>({
    type,val,color:INV_COLORS[type]||'#6b7280',label:INV_TYPES[type]||type
  })).sort((a,b)=>b.val-a.val);
  if(segs.length<2) return '';
  const total=segs.reduce((s,seg)=>s+seg.val,0);
  if(total<=0) return '';
  const cx=60,cy=60,R=52,ri=30;
  let angle=-Math.PI/2,paths='';
  segs.forEach(seg=>{
    const sw=(seg.val/total)*Math.PI*2;
    const ea=angle+sw;
    const x1=cx+R*Math.cos(angle),y1=cy+R*Math.sin(angle);
    const x2=cx+R*Math.cos(ea),y2=cy+R*Math.sin(ea);
    const x3=cx+ri*Math.cos(ea),y3=cy+ri*Math.sin(ea);
    const x4=cx+ri*Math.cos(angle),y4=cy+ri*Math.sin(angle);
    const la=sw>Math.PI?1:0;
    paths+=`<path d="M${x4.toFixed(1)},${y4.toFixed(1)} A${ri},${ri} 0 ${la},1 ${x3.toFixed(1)},${y3.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} A${R},${R} 0 ${la},0 ${x1.toFixed(1)},${y1.toFixed(1)} Z" fill="${seg.color}" opacity=".9"/>`;
    angle=ea;
  });
  paths+=`<circle cx="${cx}" cy="${cy}" r="${ri}" fill="var(--bg3)"/>`;
  paths+=`<text x="${cx}" y="${cy-4}" text-anchor="middle" fill="var(--muted)" font-size="9" font-family="Outfit">${segs.length} varlık</text>`;
  paths+=`<text x="${cx}" y="${cy+10}" text-anchor="middle" fill="var(--text)" font-size="11" font-weight="700" font-family="Outfit">${fmtTRY(total)}</text>`;
  const rows=segs.map(s=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:7px">
    <div style="display:flex;align-items:center;gap:5px">
      <div style="width:8px;height:8px;border-radius:50%;background:${s.color};flex-shrink:0"></div>
      <span style="font-size:11px;color:var(--muted)">${s.label}</span>
    </div>
    <div style="text-align:right">
      <span class="inv-amount" style="font-size:11px;font-weight:600;color:var(--text)">${fmtTRY(s.val)}</span>
      <span style="font-size:10px;color:var(--muted2);margin-left:3px">${Math.round(s.val/total*100)}%</span>
    </div>
  </div>`).join('');
  return `<div style="padding:12px;background:var(--bg3);border-radius:var(--r2);border:1px solid var(--border);margin-bottom:12px">
    <div class="section-title" style="margin-bottom:10px">DAĞILIM</div>
    <div style="display:flex;align-items:flex-start;gap:10px">
      <svg viewBox="0 0 120 120" width="110" height="110" style="flex-shrink:0">${paths}</svg>
      <div style="flex:1;padding-top:6px">${rows}</div>
    </div>
  </div>`;
}

function renderYatirim(){
  const el=document.getElementById('yatirim-content');
  if(!el) return;
  const port=getPortfolio();

  // Boot: start USD and price fetches simultaneously (decoupled)
  if(_currentUsdRate===0&&!_fetchingUsdRate) fetchCurrentUsdRate();
  if(!_fetchingPrices&&_lastPriceFetch===0) fetchAllInvPrices();

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
          <button onclick="openFetchLog()" style="padding:3px 9px;background:var(--bg4);border:1px solid var(--border);border-radius:var(--r3);font-size:11px;color:var(--muted);cursor:pointer" title="Fiyat günlüğü">📋</button>
          <button onclick="refreshPrices()" style="padding:3px 9px;background:var(--bg4);border:1px solid var(--border);border-radius:var(--r3);font-size:11px;color:var(--accent);cursor:pointer" title="Fiyatları yenile">↻</button>
        </div>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:8px">${usdNote}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:var(--bg4);padding:10px;border-radius:var(--r3)">
          <div style="font-size:10px;color:var(--muted);margin-bottom:3px">Toplam Maliyet</div>
          <div class="inv-amount" style="font-size:13px;font-weight:700;color:var(--text)">${fmtTRY(totalCostTL)}</div>
          <div class="inv-amount" style="font-size:11px;color:var(--muted)">${usdReady?fmtUSD(totalCostUSD):'—'}</div>
        </div>
        <div style="background:var(--bg4);padding:10px;border-radius:var(--r3)">
          <div style="font-size:10px;color:var(--muted);margin-bottom:3px">Güncel Değer</div>
          <div class="inv-amount" style="font-size:13px;font-weight:700;color:var(--text)">${fmtTRY(totalValueTL)}</div>
          <div class="inv-amount" style="font-size:11px;color:var(--muted)">${usdReady?fmtUSD(totalValueUSD):'—'}</div>
        </div>
        <div style="background:var(--bg4);padding:10px;border-radius:var(--r3);grid-column:1/-1">
          <div style="font-size:10px;color:var(--muted);margin-bottom:3px">Toplam K/Z</div>
          <div class="inv-amount" style="font-size:15px;font-weight:700;color:${pnlColor(totalPnlTL)}">${pnlSign(totalPnlTL)}${fmtTRY(totalPnlTL)} (${pnlSign(totalPnlPct)}${totalPnlPct.toFixed(1)}%)</div>
          <div class="inv-amount" style="font-size:12px;color:${usdReady?pnlColor(totalPnlUSD):'var(--muted)'}">${usdReady?pnlSign(totalPnlUSD)+fmtUSD(totalPnlUSD):'—'}</div>
        </div>
      </div>
    </div>`;

    html+=renderInvGoal(port);
    html+=renderAllocationChart(port);

    port.forEach(inv=>{
      const c=calcInv(inv);
      const tc=INV_COLORS[inv.type]||'#6b7280';
      const status=_priceStatus[inv.id];
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
            <div style="font-size:11px;color:var(--muted);margin-top:2px">${c.totalQty} ${inv.type==='altin'&&(inv.goldSubtype==='gram'||inv.goldSubtype==='ayar22')?'gram':'adet'}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button onclick="openAddLot('${inv.id}')" style="padding:5px 10px;background:var(--accent);border:none;border-radius:var(--r3);color:#000;font-size:11px;font-weight:700;cursor:pointer">+ Alım</button>
            <button onclick="openEditInv('${inv.id}')" style="padding:5px 10px;background:var(--bg4);border:1px solid var(--border);border-radius:var(--r3);color:var(--accent);font-size:12px;cursor:pointer">✏️</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <div style="background:var(--bg4);padding:8px;border-radius:var(--r3)">
            <div style="font-size:10px;color:var(--muted)">Ort. Maliyet</div>
            <div class="inv-amount" style="font-size:12px;font-weight:600;color:var(--text)">${fmtTRY(c.avgCostTL)}</div>
            <div class="inv-amount" style="font-size:11px;color:var(--muted)">${c.totalCostUSD>0?fmtUSD(c.avgCostUSD):'—'}</div>
          </div>
          <div style="background:var(--bg4);padding:8px;border-radius:var(--r3)">
            <div style="font-size:10px;color:var(--muted);margin-bottom:3px">Güncel Fiyat</div>
            <input class="inv-amount" type="number" min="0" step="any"
              value="${parseFloat(inv.currentPrice||0)||''}"
              placeholder="Gir…"
              onchange="updateInvPrice('${inv.id}',this.value)"
              style="width:100%;background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text);font-size:12px;font-weight:600;padding:2px 0;outline:none">
            <div class="inv-amount" style="font-size:11px;color:var(--muted);margin-top:2px">${usdReady&&inv.currentPrice?fmtUSD(parseFloat(inv.currentPrice)/_currentUsdRate):'—'}</div>
            <div style="font-size:10px;color:var(--muted);margin-top:3px">${inv.priceUpdatedAt?fmtRelTime(inv.priceUpdatedAt):'güncellenmedi'}</div>
          </div>
          <div style="background:var(--bg4);padding:8px;border-radius:var(--r3);grid-column:1/-1">
            <div style="font-size:10px;color:var(--muted)">Kâr / Zarar</div>
            <div class="inv-amount" style="font-size:13px;font-weight:700;color:${pnlColor(c.pnlTL)}">${pnlSign(c.pnlTL)}${fmtTRY(c.pnlTL)} (${pnlSign(c.pnlPct)}${c.pnlPct.toFixed(1)}%)</div>
            <div class="inv-amount" style="font-size:11px;color:${c.hasUsd?pnlColor(c.pnlUSD):'var(--muted)'}">${c.hasUsd?pnlSign(c.pnlUSD)+fmtUSD(c.pnlUSD):'—'}</div>
          </div>
        </div>
      </div>`;
    });
  } else {
    html+=`<div class="empty"><div class="empty-icon">📈</div><div class="empty-text">Henüz yatırım kaydı yok</div><div class="empty-sub">Sağ alttaki + butonuna bas</div></div>`;
  }

  el.innerHTML=html;
  updateGoalProgressBtn();
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
    tickerLabel.textContent='Borsa Sembolü';
    tickerEl.placeholder=type==='hisse'?'örn: GARAN, THYAO':'örn: YFAS';
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
    if(l.lotType==='temettu'){
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--text)">${l.date} · ${l.qty} adet</div>
          <div style="font-size:11px;color:#f59e0b">💰 Temettü · ${fmtTRY(l.totalDiv||0)} → 0₺ maliyet</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:12px;font-weight:700;color:var(--success)">0 ₺</div>
          <button onclick="deleteLot('${inv.id}','${l.id}')" style="font-size:10px;padding:1px 7px;background:var(--danger-bg);border:none;border-radius:var(--r3);color:var(--danger);cursor:pointer;margin-top:2px">Sil</button>
        </div>
      </div>`;
    }
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
  const inv=(S.investmentPortfolio||[]).find(x=>x.id===invId);
  document.getElementById('lot-inv-id').value=invId;
  document.getElementById('lot-date').value=todayStr();
  document.getElementById('lot-qty').value='';
  document.getElementById('lot-price').value='';
  document.getElementById('lot-usd-rate').value='';
  document.getElementById('lot-usd-status').textContent='';
  const typeField=document.getElementById('lot-type-field');
  const typeSel=document.getElementById('lot-type-sel');
  if(typeSel) typeSel.value='alim';
  const isStock=inv&&(inv.type==='hisse'||inv.type==='fon');
  if(typeField) typeField.style.display=isStock?'':'none';
  onLotTypeChange('alim');
  fetchUsdRate(todayStr());
  openModal('overlay-lot');
}

function onLotTypeChange(type){
  const stdFields=document.getElementById('lot-std-fields');
  const divFields=document.getElementById('lot-div-fields');
  const isTemettu=type==='temettu';
  if(stdFields) stdFields.style.display=isTemettu?'none':'';
  if(divFields) divFields.style.display=isTemettu?'':'none';
  if(isTemettu){
    const invId=document.getElementById('lot-inv-id').value;
    const inv=(S.investmentPortfolio||[]).find(x=>x.id===invId);
    const curQtyEl=document.getElementById('lot-cur-qty-display');
    if(inv&&curQtyEl){ const c=calcInv(inv); curQtyEl.value=c.totalQty+' adet'; }
    const divEl=document.getElementById('lot-div-per-share');
    const rebuyEl=document.getElementById('lot-div-rebuy-price');
    if(divEl) divEl.value='';
    if(rebuyEl) rebuyEl.value='';
    calcDivFields();
  }
}

function calcDivFields(){
  const invId=document.getElementById('lot-inv-id').value;
  const inv=(S.investmentPortfolio||[]).find(x=>x.id===invId);
  if(!inv) return;
  const c=calcInv(inv);
  const divPerShare=parseFloat(document.getElementById('lot-div-per-share')?.value)||0;
  const rebuyPrice=parseFloat(document.getElementById('lot-div-rebuy-price')?.value)||0;
  const totalDiv=c.totalQty*divPerShare;
  const newQty=rebuyPrice>0?Math.floor(totalDiv/rebuyPrice*10000)/10000:0;
  const totalEl=document.getElementById('lot-div-total-display');
  const newQtyEl=document.getElementById('lot-div-new-qty-display');
  const infoEl=document.getElementById('lot-div-info');
  if(totalEl) totalEl.value=divPerShare>0?fmtTRY(totalDiv):'—';
  if(newQtyEl) newQtyEl.value=newQty>0?newQty+' adet':'—';
  if(infoEl){
    if(newQty>0){
      const newTotal=c.totalQty+newQty;
      const newAvg=newTotal>0?c.totalCostTL/newTotal:0;
      infoEl.innerHTML=`${newQty} adet 0₺ maliyetle eklenir. Yeni ort. maliyet: <strong>${fmtTRY(newAvg)}</strong>`;
    } else { infoEl.innerHTML=''; }
  }
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
  const isTemettu=document.getElementById('lot-type-sel')?.value==='temettu';
  if(!inv.lots) inv.lots=[];
  if(isTemettu){
    const divPerShare=parseFloat(document.getElementById('lot-div-per-share').value)||0;
    const rebuyPrice=parseFloat(document.getElementById('lot-div-rebuy-price').value)||0;
    if(!date||!(divPerShare>0)||!(rebuyPrice>0)){alert('Tarih, pay başına temettü ve yeniden alış fiyatı zorunludur');return;}
    const c=calcInv(inv);
    const totalDiv=c.totalQty*divPerShare;
    const newQty=Math.floor(totalDiv/rebuyPrice*10000)/10000;
    if(!(newQty>0)){alert('Hesaplanan yeni pay adedi 0 — fiyat veya temettü miktarını kontrol edin');return;}
    inv.lots.push({id:uid('lot'),date,qty:newQty,price:0,usdRate:0,lotType:'temettu',divPerShare,totalDiv});
  } else {
    const qty=parseFloat(document.getElementById('lot-qty').value);
    const price=parseFloat(document.getElementById('lot-price').value);
    const usdRate=parseFloat(document.getElementById('lot-usd-rate').value)||0;
    if(!date||!(qty>0)||!(price>0)){alert('Tarih, adet ve fiyat zorunludur');return;}
    inv.lots.push({id:uid('lot'),date,qty,price,usdRate});
  }
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
