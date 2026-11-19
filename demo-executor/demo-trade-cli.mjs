#!/usr/bin/env node
// Manual Binance Futures DEMO order CLI. No automated strategy and no stop-loss.
// Credentials belong in private environment variables, never in this file.
import { BinanceDemoClient } from './binance-demo-client.mjs';
import { validateDemoOrder } from './exchange-filters.mjs';

const usage = 'Usage: node demo-trade-cli.mjs open SYMBOL LONG|SHORT QUANTITY | close SYMBOL';
const [action, symbol, direction, rawQty] = process.argv.slice(2);
if (!['open','close'].includes(action) || !/^[A-Z0-9]{3,24}$/.test(symbol || '') ||
  (action === 'open' && (!['LONG','SHORT'].includes(direction) || !(Number(rawQty)>0))) ||
  (action === 'close' && (direction !== undefined || rawQty !== undefined))) {
  console.error(usage); process.exit(2);
}
if (process.env.ANS_DEMO_MANUAL_TRADING !== 'YES') {
  console.error('Disabled: set ANS_DEMO_MANUAL_TRADING=YES to enable manual DEMO orders'); process.exit(2);
}
const client = new BinanceDemoClient({
  apiKey:process.env.BINANCE_DEMO_API_KEY,
  apiSecret:process.env.BINANCE_DEMO_API_SECRET
});
const positions = await client.positions();
if (!Array.isArray(positions)) throw new Error('Could not reconcile positions');
const current = positions.find(p=>p.symbol===symbol && Number(p.positionAmt)!==0);
if (current?.positionSide && current.positionSide !== 'BOTH')
  throw new Error('Hedge mode not supported by this CLI');
let side, quantity, orderParams = {};
if (action === 'open') {
  if (current) throw new Error('Existing position: refuse to increase or reverse it');
  const info = await client.exchangeInfo();
  const market = info.symbols?.find(s=>s.symbol===symbol);
  const mark = Number(market?.filters?.find(f=>f.filterType==='PRICE_FILTER')?.minPrice);
  // Fetch a current exchange quote, not a tick-size proxy.
  const quoteResponse = await fetch('https://demo-fapi.binance.com/fapi/v1/ticker/price?symbol='+encodeURIComponent(symbol),{signal:AbortSignal.timeout(10000)});
  if (!quoteResponse.ok) throw new Error('Demo quote unavailable');
  const quote = await quoteResponse.json();
  const price = Number(quote.price);
  if (!(price>0)) throw new Error('Invalid Demo quote');
  const check = validateDemoOrder({symbol,quantity:rawQty,price,exchangeInfo:info});
  if (!check.ok) throw new Error(check.reason);
  quantity = check.quantity;
  side = direction==='LONG'?'BUY':'SELL';
} else {
  if (!current) throw new Error('No open exchange position for symbol');
  quantity = String(Math.abs(Number(current.positionAmt)));
  side = Number(current.positionAmt)>0?'SELL':'BUY';
  orderParams.reduceOnly='true';
}
const clientOrderId='s2m_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
const submitted = await client.submitOrder({symbol,side,type:'MARKET',quantity,...orderParams,newClientOrderId:clientOrderId});
if (!submitted?.orderId) throw new Error('Exchange did not return an order ID');
const status = await client.orderStatus(symbol,submitted.orderId);
const after = await client.positions();
const finalPosition = after.find(p=>p.symbol===symbol && (!p.positionSide || p.positionSide==='BOTH'));
const finalAmt = Number(finalPosition?.positionAmt??0);
const filled = status?.status==='FILLED';
const positionConfirmed = action==='open'
  ? (direction==='LONG'?finalAmt>0:finalAmt<0)
  : Math.abs(finalAmt)<Math.abs(Number(current.positionAmt));
console.log(JSON.stringify({
  environment:'BINANCE_FUTURES_DEMO',action,symbol,side,quantity,
  orderId:submitted.orderId,clientOrderId,status:status?.status??'UNKNOWN',
  executedQty:status?.executedQty??'0',avgPrice:status?.avgPrice??'0',
  positionAmt:finalAmt,confirmed:filled&&positionConfirmed,
  warning:'NO AUTOMATIC STOP LOSS'
},null,2));
if (!filled || !positionConfirmed) process.exitCode=1;
