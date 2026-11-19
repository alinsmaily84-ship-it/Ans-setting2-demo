// Read-only Binance Futures Demo candles for the original Setting2 scanner.
// Data transport only: does not derive LONG/SHORT or place orders.
const DEMO='https://demo-fapi.binance.com';
const INTERVALS=new Set(['1m','3m','5m','15m','30m','1h','4h','1d']);
export async function fetchDemoCandles(symbol,interval,{limit=100,fetchImpl=fetch}={}){
 if(typeof symbol!=='string'||!/^[A-Z0-9]{3,24}$/.test(symbol))throw Error('INVALID_SYMBOL');
 if(!INTERVALS.has(interval))throw Error('INVALID_INTERVAL');
 if(!Number.isInteger(limit)||limit<2||limit>1500)throw Error('INVALID_LIMIT');
 const url=DEMO+'/fapi/v1/klines?symbol='+encodeURIComponent(symbol)+'&interval='+interval+'&limit='+limit;
 const response=await fetchImpl(url,{signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Error('DEMO_KLINES_HTTP_'+response.status);
 const rows=await response.json();
 if(!Array.isArray(rows))throw Error('INVALID_KLINES');
 const candles=rows.map(row=>{
  if(!Array.isArray(row)||row.length<7)throw Error('INVALID_KLINE_ROW');
  const [openTime,open,high,low,close,volume,closeTime]=row;
  const item={openTime:Number(openTime),open:Number(open),high:Number(high),low:Number(low),close:Number(close),volume:Number(volume),closeTime:Number(closeTime)};
  if(!Object.values(item).every(Number.isFinite)||item.open<=0||item.high<=0||item.low<=0||item.close<=0||item.volume<0||item.high<item.low)throw Error('INVALID_KLINE_VALUES');
  return item;
 });
 return {symbol,interval,candles,observedAt:Date.now(),source:'BINANCE_FUTURES_DEMO',mode:'READ_ONLY'};
}
