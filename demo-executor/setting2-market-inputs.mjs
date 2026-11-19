import {fetchDemoCandles} from './demo-candle-feed.mjs';
// Read-only multi-timeframe input for migrating the original Setting2 scanner.
// Do not derive a direction from raw candles: the original indicator logic
// must be ported separately, preserving its exact thresholds and lookbacks.
export async function fetchSetting2MarketInputs(symbol,{fetchCandles=fetchDemoCandles}={}){
 const intervals=['1m','5m','15m','1h','4h'];
 const batches=await Promise.all(intervals.map(interval=>fetchCandles(symbol,interval,{limit:100})));
 const frames={};
 for(let i=0;i<intervals.length;i++){
  const result=batches[i];
  if(result.symbol!==symbol||result.interval!==intervals[i]||!Array.isArray(result.candles)||result.candles.length===0)throw Error('INCOMPLETE_MARKET_FRAME');
  frames[intervals[i]]=result.candles;
 }
 return {symbol,frames,observedAt:Date.now(),mode:'READ_ONLY',originalSignalsComputed:false,automatedTrading:false};
}
