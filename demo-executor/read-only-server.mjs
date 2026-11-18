import {createServer} from 'node:http';
import {BinanceDemoClient} from './binance-demo-client.mjs';
const port=Number(process.env.PORT||3000);
const host='0.0.0.0';
const startedAt=Date.now();
// Deliberately read-only until original strategy parity and exchange order safety are proven.
const server=createServer(async(req,res)=>{
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('cache-control','no-store');
  if(req.method!=='GET'){res.writeHead(405);res.end(JSON.stringify({error:'METHOD_NOT_ALLOWED'}));return;}
  if(req.url==='/health') {res.writeHead(200);res.end(JSON.stringify({status:'ok',venue:'BINANCE_FUTURES_DEMO',execution:'DISABLED',uptimeMs:Date.now()-startedAt}));return;}
  if(req.url==='/readiness') {
    const credentialsPresent=Boolean(process.env.BINANCE_DEMO_API_KEY&&process.env.BINANCE_DEMO_API_SECRET);
    res.writeHead(200);res.end(JSON.stringify({execution:'DISABLED',strategyParity:'NOT_VERIFIED',credentialsPresent,readyForTrading:false}));return;
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
if(import.meta.url===`file://${process.argv[1]}`)server.listen(port,host,()=>console.log(`Setting2 Demo read-only on ${port}`));
export {server};
