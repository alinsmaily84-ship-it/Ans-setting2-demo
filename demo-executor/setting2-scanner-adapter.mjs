// Convert Demo Futures candle objects to the exact K tuple shape consumed by
// original Setting2 calc(rows, tf) in app/src/routes/index.tsx.
// No signal substitution, no orders, no changes to SL.
export function setting2KlineRows(marketInputs,interval){
 if(!marketInputs||!marketInputs.frames||!Array.isArray(marketInputs.frames[interval]))throw Error('MISSING_SETTING2_FRAME');
 return marketInputs.frames[interval].map(c=>{
  const nums=[c.openTime,c.open,c.high,c.low,c.close,c.volume,c.closeTime];
  if(nums.some(n=>!Number.isFinite(n))||c.close<=0||c.openTime>=c.closeTime)throw Error('INVALID_SETTING2_CANDLE');
  return [c.openTime,String(c.open),String(c.high),String(c.low),String(c.close),String(c.volume),c.closeTime];
 });
}
export function setting2ScannerFrames(marketInputs){
 const frames={};
 for(const tf of ['1m','5m','15m','1h','4h'])frames[tf]=setting2KlineRows(marketInputs,tf);
 return {symbol:marketInputs.symbol,frames,mode:'ORIGINAL_CALC_INPUT_ONLY',tradingEnabled:false};
}
