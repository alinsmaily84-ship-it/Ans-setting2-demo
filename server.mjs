import { createServer } from 'node:http';
import { prepareDemoProbe } from './development/demo-order-preparation.mjs';
import { planStopAfterFill, profitFloorFromPeak } from './development/demo-protection-planner.mjs';
// Isolated read-only deployment check. This does not run the Setting2 strategy.
const startedAt = Date.now();
const server = createServer(async (req,res)=>{
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('cache-control','no-store');
  const send=(code,body)=>{res.writeHead(code);res.end(JSON.stringify(body));};
  if(req.method!=='GET')return send(405,{error:'METHOD_NOT_ALLOWED'});
  if(req.url==='/health')return send(200,{status:'ok',venue:'BINANCE_FUTURES_DEMO',execution:'DISABLED',uptimeMs:Date.now()-startedAt});
  if(req.url==='/readiness')return send(200,{execution:'DISABLED',strategyParity:'NOT_VERIFIED',credentialsPresent:Boolean(process.env.BINANCE_DEMO_API_KEY&&process.env.BINANCE_DEMO_API_SECRET),readyForTrading:false});
  if(req.url==='/demo-connectivity'){
    try {
      const response=await fetch('https://demo-fapi.binance.com/fapi/v1/exchangeInfo',{signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const info=await response.json();
      return send(200,{connected:true,venue:'DEMO',publicMarketDataOnly:true,symbols:Array.isArray(info.symbols)?info.symbols.length:null});
    } catch {return send(503,{connected:false,error:'DEMO_CONNECTION_FAILED'});}
  }
  if(new URL(req.url,'http://localhost').pathname==='/demo-probe-preview'){
    try {
      const url=new URL(req.url,'http://localhost');
      const symbol=url.searchParams.get('symbol')||'';
      const side=url.searchParams.get('side')||'BUY';
      if(!/^[A-Z0-9]{1,25}USDT$/.test(symbol) || !['BUY','SELL'].includes(side))
        return send(400,{error:'INVALID_PREVIEW_PARAMETERS'});
      const [infoResponse,priceResponse]=await Promise.all([
        fetch('https://demo-fapi.binance.com/fapi/v1/exchangeInfo',{signal:AbortSignal.timeout(10000)}),
        fetch('https://demo-fapi.binance.com/fapi/v1/ticker/price?symbol='+encodeURIComponent(symbol),{signal:AbortSignal.timeout(10000)})
      ]);
      if(!infoResponse.ok||!priceResponse.ok)throw Error('DEMO_PUBLIC_DATA_UNAVAILABLE');
      const info=await infoResponse.json(),price=await priceResponse.json();
      const exchangeSymbol=info.symbols.find(x=>x.symbol===symbol);
      const preview=prepareDemoProbe({symbol,side,price:Number(price.price),exchangeSymbol});
      return send(200,{...preview,publicMarketDataOnly:true,ordersPlaced:0});
    }catch{return send(503,{error:'DEMO_PREVIEW_UNAVAILABLE',ordersPlaced:0});}
  }
  if(new URL(req.url,'http://localhost').pathname==='/demo-protection-preview'){
    const url=new URL(req.url,'http://localhost');
    const symbol=url.searchParams.get('symbol')||'';
    const qty=Number(url.searchParams.get('positionQty'));
    const entry=Number(url.searchParams.get('entryPrice'));
    const mark=Number(url.searchParams.get('markPrice'));
    const tick=Number(url.searchParams.get('tickSize'));
    const peak=Number(url.searchParams.get('peakUsd'));
    try {
      if(![qty,entry,mark,tick,peak].every(Number.isFinite) || peak<0)
        return send(400,{error:'INVALID_PROTECTION_PARAMETERS'});
      const primary=planStopAfterFill({symbol,positionQty:qty,entryPrice:entry,markPrice:mark,tickSize:tick,maxLossUsdt:5});
      const backup=planStopAfterFill({symbol,positionQty:qty,entryPrice:entry,markPrice:mark,tickSize:tick,maxLossUsdt:10});
      return send(200,{venue:'BINANCE_FUTURES_DEMO',primary,backup,profit:profitFloorFromPeak(peak),executionEnabled:false,ordersPlaced:0,exchangeOrdersVerified:false});
    }catch{return send(400,{error:'INVALID_PROTECTION_PARAMETERS',ordersPlaced:0});}
  }
  return send(404,{error:'NOT_FOUND'});
});
server.listen(Number(process.env.PORT||3000),'0.0.0.0');
