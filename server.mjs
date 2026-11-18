import { createServer } from 'node:http';
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
  return send(404,{error:'NOT_FOUND'});
});
server.listen(Number(process.env.PORT||3000),'0.0.0.0');
