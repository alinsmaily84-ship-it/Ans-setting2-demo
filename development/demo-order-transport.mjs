// Binance Futures Demo transport for the future executor.
// Not imported by the running service. No automatic order placement.
// Explicit call required; production Binance hosts and arbitrary endpoints are forbidden.
import {createHmac} from 'node:crypto';

const ORIGIN='https://demo-fapi.binance.com';
const PATHS=Object.freeze({
  marketOrder:'/fapi/v1/order',
  orderStatus:'/fapi/v1/order',
  openAlgoOrders:'/fapi/v1/openAlgoOrders'
});

export function prepareSignedDemoRequest({kind,apiKey,apiSecret,params={},timestamp=Date.now()}) {
  const spec={
    marketOrder:{method:'POST',path:PATHS.marketOrder},
    orderStatus:{method:'GET',path:PATHS.orderStatus},
    openAlgoOrders:{method:'GET',path:PATHS.openAlgoOrders}
  }[kind];
  if(!spec)throw new Error('DEMO_REQUEST_KIND_INVALID');
  if(typeof apiKey!=='string'||!apiKey.trim()||typeof apiSecret!=='string'||!apiSecret.trim())
    throw new Error('DEMO_CREDENTIALS_MISSING');
  if(!Number.isSafeInteger(timestamp))throw new Error('DEMO_TIMESTAMP_INVALID');
  const query=new URLSearchParams();
  for(const [k,v] of Object.entries(params)){
    if(!/^[a-zA-Z][a-zA-Z0-9]*$/.test(k)||v===undefined||v===null)throw new Error('DEMO_PARAM_INVALID');
    query.set(k,String(v));
  }
  if(kind==='marketOrder'){
    if(params.type!=='MARKET'||!['BUY','SELL'].includes(params.side)||
       !/^[A-Z0-9]+USDT$/.test(params.symbol||'')||
       !(Number(params.quantity)>0)||
       !Number.isFinite(Number(params.quantity)))
      throw new Error('DEMO_MARKET_ORDER_INVALID');
  }
  query.set('timestamp',String(timestamp));
  query.set('recvWindow','5000');
  query.set('signature',createHmac('sha256',apiSecret).update(query.toString()).digest('hex'));
  const encoded=query.toString();
  return {
    method:spec.method,
    url:ORIGIN+spec.path+(spec.method==='GET'?'?'+encoded:''),
    headers:{'X-MBX-APIKEY':apiKey,...(spec.method==='POST'?{'content-type':'application/x-www-form-urlencoded'}:{})},
    ...(spec.method==='POST'?{body:encoded}:{}),
    venue:'BINANCE_FUTURES_DEMO'
  };
}

// Calling this function can place an actual DEMO order; it is not wired to any timer.
// Its caller must reconcile positions and attach verified protection after a fill.
export async function sendExplicitDemoRequest({kind,apiKey,apiSecret,params,fetchImpl=fetch}) {
  const request=prepareSignedDemoRequest({kind,apiKey,apiSecret,params});
  const response=await fetchImpl(request.url,{
    method:request.method,headers:request.headers,
    ...(request.body?{body:request.body}:{}),
    redirect:'error',signal:AbortSignal.timeout(10000)
  });
  const payload=await response.json();
  if(!response.ok)throw new Error('DEMO_ORDER_TRANSPORT_HTTP_'+response.status);
  return payload;
}
