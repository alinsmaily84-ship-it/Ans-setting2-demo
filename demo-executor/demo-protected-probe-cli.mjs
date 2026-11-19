#!/usr/bin/env node
// Explicit single-probe Binance Futures Demo execution. Not a scheduler.
// Never use with Live credentials. Only runs when explicitly invoked by operator.
import {BinanceDemoClient} from './binance-demo-client.mjs';
import {fetchDemoPrice} from './demo-price-feed.mjs';
import {executeOneDemoProtectedProbe} from './demo-one-shot-entry.mjs';

const [symbol,side]=process.argv.slice(2);
if(!/^[A-Z0-9]+USDT$/.test(symbol||'')||!['BUY','SELL'].includes(side)){
 console.error(JSON.stringify({ok:false,reason:'USAGE: node demo-protected-probe-cli.mjs SYMBOLUSDT BUY|SELL'}));
 process.exitCode=2;
}else if(process.env.ANS_DEMO_PROTECTED_PROBE!=='YES'){
 console.error(JSON.stringify({ok:false,reason:'PROTECTED_PROBE_DISABLED'}));
 process.exitCode=2;
}else{
 try{
  const apiKey=process.env.BINANCE_DEMO_API_KEY,apiSecret=process.env.BINANCE_DEMO_API_SECRET;
  const client=new BinanceDemoClient({apiKey,apiSecret});
  const [exchange,ticker,mark]=await Promise.all([
   client.exchangeInfo(),
   fetchDemoPrice(symbol),
   client.request('GET','/fapi/v1/premiumIndex',{symbol},false)
  ]);
  const exchangeSymbol=exchange.symbols?.find(s=>s.symbol===symbol);
  const price=Number(ticker.price),markPrice=Number(mark.markPrice);
  const priceFilter=exchangeSymbol?.filters?.find(f=>f.filterType==='PRICE_FILTER');
  const lot=exchangeSymbol?.filters?.find(f=>f.filterType==='MARKET_LOT_SIZE')||
            exchangeSymbol?.filters?.find(f=>f.filterType==='LOT_SIZE');
  const tickSize=Number(priceFilter?.tickSize),stepSize=Number(lot?.stepSize);
  if(!exchangeSymbol||![price,markPrice,tickSize,stepSize].every(x=>Number.isFinite(x)&&x>0))
   throw Error('EXCHANGE_MARKET_METADATA_INVALID');
  const result=await executeOneDemoProtectedProbe({
   symbol,side,price,exchangeSymbol,markPrice,tickSize,stepSize,
   apiKey,apiSecret,explicitDemoAuthorization:true
  });
  console.log(JSON.stringify({venue:'BINANCE_FUTURES_DEMO',...result}));
  if(result.action!=='DEMO_PROBE_PROTECTED')process.exitCode=1;
 }catch(error){
  console.error(JSON.stringify({venue:'BINANCE_FUTURES_DEMO',ok:false,
   reason:String(error?.message||error).slice(0,160)}));
  process.exitCode=1;
 }
}
