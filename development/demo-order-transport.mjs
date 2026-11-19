// Binance Futures Demo transport for the future executor.
// Not imported by the running service. No automatic order placement.
// Explicit call required; production Binance hosts and arbitrary endpoints are forbidden.
import {createHmac} from 'node:crypto';

const ORIGIN='https://demo-fapi.binance.com';
const PATHS=Object.freeze({
  marketOrder:'/fapi/v1/order',
  protectiveAlgoOrder:'/fapi/v1/algoOrder',
  orderStatus:'/fapi/v1/order',
  openAlgoOrders:'/fapi/v1/openAlgoOrders'
});

export function prepareSignedDemoRequest({kind,apiKey,apiSecret,params={},timestamp=Date.now()}) {
  const spec={
    marketOrder:{method:'POST',path:PATHS.marketOrder},
    protectiveAlgoOrder:{method:'POST',path:PATHS.protectiveAlgoOrder},
    orderStatus:{method:'GET',path:PATHS.orderStatus},
    openAlgoOrders:{method:'GET',path:PATHS.openAlgoOrders}
  }[kind];
  if(!spec)throw new Error('DEMO_REQUEST_KIND_INVALID');
  if(typeof apiKey!=='string'||!apiKey.trim()||typeof apiSecret!=='string'||!apiSecret.trim())
    throw new Error('DEMO_CREDENTIALS_MISSING');
  if(!Number.isSafeInteger(timestamp))throw new Error('DEMO_TIMESTAMP_INVALID');
  // Permit only the exact order fields used by the Demo executor.
  // Never allow a caller to smuggle alternate order types or arbitrary parameters.
  const allowed=kind==='protectiveAlgoOrder'
    ? new Set(['algoType','symbol','side','type','triggerPrice','workingType','closePosition','positionSide','clientAlgoId'])
    : kind==='marketOrder'
    ? new Set(['symbol','side','type','quantity','reduceOnly','newClientOrderId'])
    : kind==='orderStatus'
      ? new Set(['symbol','orderId'])
      : new Set(['symbol']);
  if(Object.keys(params).some(k=>!allowed.has(k)))
    throw new Error('DEMO_PARAM_NOT_ALLOWED');
  if(kind==='orderStatus' &&
     (!/^[A-Z0-9]+USDT$/.test(params.symbol||'') ||
      !/^[0-9]+$/.test(String(params.orderId||''))))
    throw new Error('DEMO_ORDER_STATUS_INVALID');
  if(kind==='openAlgoOrders' && params.symbol!==undefined &&
     !/^[A-Z0-9]+USDT$/.test(params.symbol))
    throw new Error('DEMO_SYMBOL_INVALID');
  const query=new URLSearchParams();
  for(const [k,v] of Object.entries(params)){
    if(!/^[a-zA-Z][a-zA-Z0-9]*$/.test(k)||v===undefined||v===null)throw new Error('DEMO_PARAM_INVALID');
    query.set(k,String(v));
  }
  if(kind==='marketOrder'){
    if(params.type!=='MARKET'||!['BUY','SELL'].includes(params.side)||
       !/^[A-Z0-9]+USDT$/.test(params.symbol||'')||
       !(Number(params.quantity)>0)||
       !Number.isFinite(Number(params.quantity)) ||
       (params.reduceOnly!==undefined && params.reduceOnly!==true && params.reduceOnly!=='true') ||
       (params.newClientOrderId!==undefined && !/^[A-Za-z0-9_-]{1,36}$/.test(params.newClientOrderId)))
      throw new Error('DEMO_MARKET_ORDER_INVALID');
  }
  if(kind==='protectiveAlgoOrder'){
    if(params.algoType!=='CONDITIONAL' || params.type!=='STOP_MARKET' ||
       !/^[A-Z0-9]+USDT$/.test(params.symbol||'') ||
       !['BUY','SELL'].includes(params.side) ||
       !(Number(params.triggerPrice)>0) ||
       !Number.isFinite(Number(params.triggerPrice)) ||
       params.workingType!=='MARK_PRICE' ||
       (params.closePosition!==true && params.closePosition!=='true') ||
       (params.positionSide!==undefined && !['BOTH','LONG','SHORT'].includes(params.positionSide)) ||
       (params.clientAlgoId!==undefined && !/^[A-Za-z0-9_-]{1,36}$/.test(params.clientAlgoId)))
      throw new Error('DEMO_PROTECTIVE_ALGO_INVALID');
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
