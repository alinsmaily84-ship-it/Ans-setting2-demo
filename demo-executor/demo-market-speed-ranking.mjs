// Read-only 15-minute speed ranking across eligible Demo USDT perpetual symbols.
// Bounded concurrency limits load; every eligible symbol is considered.
import {fetchDemoCandles} from './demo-candle-feed.mjs';
export async function rankDemoMarketSpeed({exchangeSymbols,fetchCandles=fetchDemoCandles,concurrency=8}={}){
 if(!Array.isArray(exchangeSymbols)||!Number.isInteger(concurrency)||concurrency<1||concurrency>16)throw Error('INVALID_SCANNER_INPUT');
 const eligible=exchangeSymbols.filter(s=>s?.status==='TRADING'&&s?.contractType==='PERPETUAL'&&s?.quoteAsset==='USDT').map(s=>s.symbol);
 let next=0;const ranked=[],failed=[];
 async function worker(){
  while(next<eligible.length){
   const symbol=eligible[next++];
   try{
    const {candles}=await fetchCandles(symbol,'1m',{limit:17});
    // Last 15 complete one-minute candles; never use an unfinished candle.
    const complete=candles.filter(c=>c.closeTime<Date.now());
    if(complete.length<16)throw Error('INSUFFICIENT_15M_HISTORY');
    const start=complete.at(-16).close,end=complete.at(-1).close;
    if(!(start>0&&end>0))throw Error('INVALID_CANDLE_CLOSE');
    ranked.push({symbol,close15mAgo:start,closeNow:end,speedPct15m:Math.abs(end/start-1)*100});
   }catch{failed.push(symbol);}
  }
 }
 await Promise.all(Array.from({length:Math.min(concurrency,eligible.length)},()=>worker()));
 ranked.sort((a,b)=>b.speedPct15m-a.speedPct15m||a.symbol.localeCompare(b.symbol));
 return {ranked,scanned:eligible.length,successful:ranked.length,failed:failed.length,failedSymbols:failed,complete:failed.length===0};
}
