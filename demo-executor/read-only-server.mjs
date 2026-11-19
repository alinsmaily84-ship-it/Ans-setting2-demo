import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {spawn} from 'node:child_process';
import {BinanceDemoClient} from './binance-demo-client.mjs';
import {fetchDemoPrice,createPriceHistory} from './demo-price-feed.mjs';
import {compareClampDirection} from './clamp-direction-shadow.mjs';
const observedPrices=createPriceHistory({limit:120});
const monitor={symbol:'SOLUSDT',lastTick:null,lastError:null,successes:0,failures:0,running:false};
const shadow={last:null,counts:{LONG:0,SHORT:0,WAIT:0},errors:0};
// Diagnostic read-only sampling; SOLUSDT is a test instrument, not a trading universe filter.
async function sampleMonitor(){
  if(monitor.running)return;
  monitor.running=true;
  try{
    const tick=await fetchDemoPrice(monitor.symbol);
    const prices=observedPrices.push(tick);
    if(prices.length>=9){
      try{
        const comparison=compareClampDirection({originalSide:'WAIT',prices,lookback:8});
        shadow.last={observedAt:tick.observedAt,symbol:tick.symbol,price:tick.price,clampSide:comparison.clampSide,upTicks:comparison.upTicks,downTicks:comparison.downTicks,netMove:comparison.netMove,mode:'SHADOW_ONLY',originalDecisionConnected:false};
        shadow.counts[comparison.clampSide]++;
      }catch{shadow.errors++;}
    }
    monitor.lastTick=tick;monitor.lastError=null;monitor.successes++;
  }catch(error){monitor.lastError=String(error?.message||error).slice(0,120);monitor.failures++;}
  finally{monitor.running=false;}
}
const port=Number(process.env.PORT||3000);
const host='0.0.0.0';
const startedAt=Date.now();
// Deliberately read-only until original strategy parity and exchange order safety are proven.
const server=createServer(async(req,res)=>{
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('cache-control','no-store');
  if(req.method==='GET' && req.url==='/operator') {
    res.setHeader('content-type','text/html; charset=utf-8');
    res.setHeader('content-security-policy',"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'");
    res.writeHead(200);res.end(`<!doctype html><html lang="ar" dir="rtl"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ANS Setting2 Demo</title><style>body{font:16px system-ui;max-width:480px;margin:36px auto;padding:16px;background:#101723;color:#fff}input,select,button{box-sizing:border-box;width:100%;padding:14px;margin:7px 0;border-radius:9px;border:1px solid #596273;font:inherit}button{background:#267f63;color:white;font-weight:700}button.close{background:#b35b38}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#1e2938;padding:12px;border-radius:8px}</style><h2>ANS Setting2 — Binance Demo</h2><p>أوامر فعلية على حساب Demo فقط. ليست استراتيجية تلقائية.</p><input id="token" type="password" autocomplete="off" placeholder="رمز المشغّل"><input id="symbol" value="SOLUSDT" placeholder="العملة"><select id="direction"><option>LONG</option><option>SHORT</option></select><input id="quantity" inputmode="decimal" placeholder="الكمية (عدد الوحدات، وليس USDT)"><button id="open">فتح صفقة Demo</button><button class="close" id="close">إغلاق مركز العملة بالكامل</button><pre id="result">لم يُرسل أي أمر</pre><script>async function trade(action){const out=document.getElementById('result');const symbol=document.getElementById('symbol').value.trim().toUpperCase();const body={action,symbol};if(action==='open'){body.direction=document.getElementById('direction').value;body.quantity=document.getElementById('quantity').value;}if(!confirm(action==='open'?'إرسال أمر فتح حقيقي إلى Binance Demo؟':'إغلاق مركز '+symbol+' على Binance Demo؟'))return;out.textContent='جارٍ إرسال الأمر والتحقق...';try{const response=await fetch('/manual-trade',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+document.getElementById('token').value},body:JSON.stringify(body)});out.textContent='HTTP '+response.status+'\\n'+JSON.stringify(await response.json(),null,2);}catch(e){out.textContent=String(e)}}document.getElementById('open').onclick=()=>trade('open');document.getElementById('close').onclick=()=>trade('close');</script></html>`);
    return;
  }
  if(req.method==='POST' && req.url==='/manual-trade') {
    // Explicitly user-authorized Demo-only manual operator mode.
    // Never enable on live venues or without the Demo-only switch.
    if(process.env.ANS_DEMO_UNPROTECTED_OPERATOR!=='YES'){
      const token=process.env.ANS_DEMO_OPERATOR_TOKEN||'';
      const provided=String(req.headers.authorization||'').replace(/^Bearer /,'');
      const a=Buffer.from(token),b=Buffer.from(provided);
      if(!token||!provided||a.length!==b.length||!timingSafeEqual(a,b)){
        res.writeHead(401);res.end(JSON.stringify({error:'UNAUTHORIZED'}));return;
      }
    }
    if(process.env.ANS_DEMO_MANUAL_TRADING!=='YES'){
      res.writeHead(403);res.end(JSON.stringify({error:'MANUAL_TRADING_DISABLED'}));return;
    }
    let raw='';
    try {
      for await(const chunk of req){raw+=chunk;if(raw.length>1024)throw new Error('BODY_TOO_LARGE');}
      const body=JSON.parse(raw);
      const {action,symbol,direction,quantity}=body;
      if(!['open','close'].includes(action)||typeof symbol!=='string'||!/^[A-Z0-9]{3,24}$/.test(symbol)||
         (action==='open'&&(!['LONG','SHORT'].includes(direction)||!(Number(quantity)>0)))||
         (action==='close'&&(direction!==undefined||quantity!==undefined)))
        throw new Error('INVALID_ORDER_REQUEST');
      const args=['demo-trade-cli.mjs',action,symbol];
      if(action==='open')args.push(direction,String(quantity));
      const result=await new Promise((resolve,reject)=>{
        const child=spawn(process.execPath,args,{cwd:new URL('.',import.meta.url).pathname,env:process.env,stdio:['ignore','pipe','pipe']});
        let out='',err='';
        child.stdout.on('data',x=>{out+=x;if(out.length>8192)child.kill();});
        child.stderr.on('data',x=>{err+=x;if(err.length>8192)child.kill();});
        child.on('error',reject);
        child.on('close',code=>resolve({code,out,err}));
      });
      res.writeHead(result.code===0?200:502);
      res.end(JSON.stringify({ok:result.code===0,result:result.out.slice(0,8192),error:result.code===0?null:'ORDER_NOT_CONFIRMED'}));
    } catch(error){
      res.writeHead(400);res.end(JSON.stringify({error:String(error.message).slice(0,100)}));
    }
    return;
  }
  if(req.method!=='GET'){res.writeHead(405);res.end(JSON.stringify({error:'METHOD_NOT_ALLOWED'}));return;}
  if(req.url?.startsWith('/demo-price?')) {
    try {
      const parsed=new URL(req.url,'http://localhost');
      const symbol=parsed.searchParams.get('symbol');
      const tick=await fetchDemoPrice(symbol);
      const prices=observedPrices.push(tick);
      res.writeHead(200);res.end(JSON.stringify({...tick,samples:prices.length,history:prices.slice(-12),mode:'READ_ONLY',automatedTrading:false}));
    } catch(error) {
      res.writeHead(503);res.end(JSON.stringify({error:'DEMO_PRICE_UNAVAILABLE',detail:String(error.message).slice(0,90)}));
    }
    return;
  }
  if(req.url?.startsWith('/demo-direction?')) {
    const parsed=new URL(req.url,'http://localhost');
    const originalSide=parsed.searchParams.get('originalSide');
    if(!['LONG','SHORT','WAIT'].includes(originalSide)){
      res.writeHead(400);res.end(JSON.stringify({error:'ORIGINAL_SETTING2_DECISION_REQUIRED',mode:'SHADOW_ONLY'}));return;
    }
    const prices=observedPrices.get(monitor.symbol).map(x=>x.price);
    try {
      const comparison=compareClampDirection({originalSide,prices,lookback:8});
      res.writeHead(200);res.end(JSON.stringify({symbol:monitor.symbol,samples:prices.length,...comparison,automatedTrading:false}));
    }catch(error){res.writeHead(409);res.end(JSON.stringify({error:String(error.message)}));}
    return;
  }
  if(req.url==='/demo-shadow') {
    res.writeHead(200);res.end(JSON.stringify({...shadow,automatedTrading:false,originalStrategyConnected:false}));
    return;
  }
  if(req.url==='/demo-monitor') {
    res.writeHead(200);res.end(JSON.stringify({...monitor,history:observedPrices.get(monitor.symbol),mode:'READ_ONLY',automatedTrading:false}));
    return;
  }
  if(req.url==='/health') {res.writeHead(200);res.end(JSON.stringify({status:'ok',venue:'BINANCE_FUTURES_DEMO',execution:'DISABLED',uptimeMs:Date.now()-startedAt}));return;}
  if(req.url==='/readiness') {
    const credentialsPresent=Boolean(process.env.BINANCE_DEMO_API_KEY&&process.env.BINANCE_DEMO_API_SECRET);
    res.writeHead(200);res.end(JSON.stringify({execution:'DISABLED',strategyParity:'NOT_VERIFIED',credentialsPresent,readyForTrading:false}));return;
  }
  if(req.method==='GET' && req.url==='/demo-auth-check') {
    try {
      const key=process.env.BINANCE_DEMO_API_KEY,secret=process.env.BINANCE_DEMO_API_SECRET;
      if(!key||!secret){res.writeHead(503);res.end(JSON.stringify({authenticated:false,error:'CREDENTIALS_MISSING'}));return;}
      const client=new BinanceDemoClient({apiKey:key,apiSecret:secret});
      const positions=await client.positions();
      res.writeHead(200);res.end(JSON.stringify({authenticated:Array.isArray(positions),venue:'BINANCE_FUTURES_DEMO',activePositions:Array.isArray(positions)?positions.filter(p=>Number(p.positionAmt)!==0).length:null}));
    }catch(error){
      const msg=String(error?.message||error);
      const restricted=/restricted location|eligibility|service unavailable/i.test(msg);
      const httpStatus=msg.match(/Binance Demo HTTP (\d{3})/); const binanceCode=msg.match(/\\?"code\\?"\s*:\s*(-?\d+)/);
      res.writeHead(503);res.end(JSON.stringify({authenticated:false,error:restricted?'LOCATION_RESTRICTED':'AUTH_OR_NETWORK_FAILURE',upstreamHttpStatus:httpStatus?Number(httpStatus[1]):null,binanceCode:binanceCode?Number(binanceCode[1]):null}));
    }
    return;
  }
  if(req.url==='/demo-connectivity') {
    try {
      const key=process.env.BINANCE_DEMO_API_KEY,secret=process.env.BINANCE_DEMO_API_SECRET;
      if(!key||!secret){res.writeHead(503);res.end(JSON.stringify({connected:false,error:'DEMO_CREDENTIALS_NOT_CONFIGURED'}));return;}
      const client=new BinanceDemoClient({apiKey:key,apiSecret:secret});
      const info=await client.exchangeInfo();
      res.writeHead(200);res.end(JSON.stringify({connected:true,venue:'DEMO',symbols:Array.isArray(info.symbols)?info.symbols.length:null}));
    } catch(error){res.writeHead(503);res.end(JSON.stringify({connected:false,error:'DEMO_CONNECTION_FAILED'}));}
    return;
  }
  res.writeHead(404);res.end(JSON.stringify({error:'NOT_FOUND'}));
});
if(import.meta.url===`file://${process.argv[1]}`) {
  server.listen(port,host,()=>console.log(`Setting2 Demo read-only on ${port}`));
  void sampleMonitor();
  const monitorTimer=setInterval(()=>void sampleMonitor(),1000);
  monitorTimer.unref();
}
export {server};
