// Focus the fast indicator on current positions and the ten strongest candidates.
// This is market-data-only; no orders, timers, or trading decisions.
export const FAST_WINDOW_MS=5000;
export const MAX_CANDIDATES=10;
export const MAX_OPEN_POSITIONS=5;
const valid=s=>typeof s==='string'&&/^[A-Z0-9]+USDT$/.test(s);
export function selectFastIndicatorSymbols({positions=[],rankedCandidates=[]}={}){
 if(!Array.isArray(positions)||!Array.isArray(rankedCandidates))throw Error('INVALID_INDICATOR_INPUT');
 const open=[];
 for(const p of positions){
  const symbol=typeof p==='string'?p:p?.symbol;
  const amount=typeof p==='string'?1:Number(p?.positionAmt);
  if(valid(symbol)&&Number.isFinite(amount)&&amount!==0&&!open.includes(symbol))open.push(symbol);
 }
 if(open.length>MAX_OPEN_POSITIONS)throw Error('OPEN_POSITION_LIMIT_EXCEEDED');
 const candidates=[];
 for(const c of rankedCandidates){
  const symbol=typeof c==='string'?c:c?.symbol;
  if(valid(symbol)&&!open.includes(symbol)&&!candidates.includes(symbol))candidates.push(symbol);
  if(candidates.length>=MAX_CANDIDATES)break;
 }
 return Object.freeze({priority:open,candidates,all:[...open,...candidates],windowMs:FAST_WINDOW_MS});
}
export class FastPriceWindow{
 constructor({windowMs=FAST_WINDOW_MS}={}){if(!Number.isInteger(windowMs)||windowMs<=0)throw Error('INVALID_WINDOW');this.windowMs=windowMs;this.points=new Map();}
 ingest({symbol,price,receivedAt=Date.now()}){
  if(!valid(symbol)||!Number.isFinite(price)||price<=0||!Number.isFinite(receivedAt))throw Error('INVALID_PRICE_POINT');
  const arr=this.points.get(symbol)||[];
  if(arr.length&&receivedAt<arr.at(-1).receivedAt)throw Error('OUT_OF_ORDER_PRICE_POINT');
  arr.push({price,receivedAt});
  while(arr.length&&arr[0].receivedAt<receivedAt-this.windowMs)arr.shift();
  this.points.set(symbol,arr);
  return this.read(symbol);
 }
 read(symbol,now=Date.now()){
  const arr=this.points.get(symbol)||[];
  while(arr.length&&arr[0].receivedAt<now-this.windowMs)arr.shift();
  return {symbol,windowMs:this.windowMs,count:arr.length,firstPrice:arr[0]?.price??null,lastPrice:arr.at(-1)?.price??null,
   changePct:arr.length>1?(arr.at(-1).price/arr[0].price-1)*100:null};
 }
}
