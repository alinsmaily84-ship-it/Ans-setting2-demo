// Binance Futures Demo public market-data feed. No account orders.
const DEMO='https://demo-fapi.binance.com';
export async function fetchDemoPrice(symbol,{fetchImpl=fetch}={}) {
 if(typeof symbol!=='string'||!/^[A-Z0-9]{3,24}$/.test(symbol))throw Error('INVALID_SYMBOL');
 const url=DEMO+'/fapi/v1/ticker/price?symbol='+encodeURIComponent(symbol);
 const response=await fetchImpl(url,{signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Error('DEMO_PRICE_HTTP_'+response.status);
 const data=await response.json();
 const price=Number(data.price);
 if(data.symbol!==symbol||!Number.isFinite(price)||price<=0)throw Error('INVALID_DEMO_PRICE');
 return {symbol,price,observedAt:Date.now(),source:'BINANCE_FUTURES_DEMO'};
}
export function createPriceHistory({limit=120}={}) {
 if(!Number.isInteger(limit)||limit<2)throw Error('INVALID_HISTORY_LIMIT');
 const histories=new Map();
 return {push(tick) {
   if(!tick||!Number.isFinite(tick.price)||tick.price<=0||typeof tick.symbol!=='string')throw Error('INVALID_TICK');
   const history=histories.get(tick.symbol)||[];
   history.push({price:tick.price,observedAt:tick.observedAt});
   if(history.length>limit)history.splice(0,history.length-limit);
   histories.set(tick.symbol,history);
   return history.map(x=>x.price);
 },get(symbol){return (histories.get(symbol)||[]).map(x=>({...x}))}};
}
