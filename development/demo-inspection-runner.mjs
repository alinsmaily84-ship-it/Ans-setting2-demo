// One-shot, read-only Demo account protection audit CLI.
// Run manually with BINANCE_DEMO_API_KEY and BINANCE_DEMO_API_SECRET.
// Never submits orders, starts a loop, or contacts Binance Live.
import {inspectDemoProtection} from './demo-protection-inspector.mjs';

const origin='https://demo-fapi.binance.com';
async function publicJson(path,fetchImpl){
  const r=await fetchImpl(origin+path,{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new Error('DEMO_MARKET_READ_FAILED_'+r.status);
  return r.json();
}

export async function runDemoInspection({apiKey,apiSecret,fetchImpl=fetch,marketInfo,nowMs=Date.now()}={}){
  if(!apiKey||!apiSecret)throw new Error('DEMO_CREDENTIALS_MISSING');
  const exchangeInfo=marketInfo?.exchangeInfo ?? await publicJson('/fapi/v1/exchangeInfo',fetchImpl);
  const marks=marketInfo?.marks ?? await publicJson('/fapi/v1/premiumIndex',fetchImpl);
  if(!Array.isArray(exchangeInfo.symbols)||!Array.isArray(marks))
    throw new Error('DEMO_MARKET_RESPONSE_INVALID');
  const bySymbol=new Map(marks.map(x=>[x.symbol,Number(x.markPrice)]));
  const marketBySymbol={};
  for(const s of exchangeInfo.symbols){
    const tickSize=Number(s.filters?.find(x=>x.filterType==='PRICE_FILTER')?.tickSize);
    const markPrice=bySymbol.get(s.symbol);
    if(Number.isFinite(tickSize)&&tickSize>0&&Number.isFinite(markPrice)&&markPrice>0)
      marketBySymbol[s.symbol]={tickSize,markPrice};
  }
  const report=await inspectDemoProtection({apiKey,apiSecret,fetchImpl,nowMs,marketBySymbol});
  // Summary deliberately excludes raw positions, credentials and full order details.
  return {venue:report.venue,readOnly:true,observedAt:report.observedAt,
    openPositionCount:report.exposure.openPositionCount,
    withinFivePositions:report.exposure.withinLimit,
    allOpenPositionsProtected:report.allOpenPositionsProtected,
    reports:report.reports.map(r=>({symbol:r.symbol,protected:r.protected,reason:r.reason})),
    ordersPlaced:0};
}

if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
  try{
    const result=await runDemoInspection({
      apiKey:process.env.BINANCE_DEMO_API_KEY,
      apiSecret:process.env.BINANCE_DEMO_API_SECRET
    });
    process.stdout.write(JSON.stringify(result)+'\n');
  }catch(e){
    process.stderr.write(JSON.stringify({ok:false,error:e.message})+'\n');
    process.exitCode=1;
  }
}
