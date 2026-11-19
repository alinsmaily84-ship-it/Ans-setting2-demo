// Read-only live 1m candle input required by original Setting2 momentum15m.
// The source explicitly uses the OPEN of the forming minute, not a completed close.
import {fetchDemoCandles} from './demo-candle-feed.mjs';
import {fetchDemoPrice} from './demo-price-feed.mjs';
export async function fetchSetting2LiveMinute(symbol,{fetchCandles=fetchDemoCandles,fetchPrice=fetchDemoPrice,now=Date.now}={}){
 const [candles,tick]=await Promise.all([fetchCandles(symbol,'1m',{limit:100}),fetchPrice(symbol)]);
 const stamp=now();
 if(!Number.isFinite(tick.price)||tick.price<=0||stamp-tick.observedAt>10000||tick.observedAt>stamp)throw Error('STALE_OR_INVALID_QUOTE');
 const forming=candles.candles.findLast(c=>c.openTime<=tick.observedAt&&c.closeTime>=tick.observedAt);
 if(!forming||!Number.isFinite(forming.open)||forming.open<=0)throw Error('LIVE_MINUTE_CANDLE_UNAVAILABLE');
 return {symbol,price:tick.price,quoteObservedAt:tick.observedAt,liveCandleOpen:forming.open,
   liveCandleOpenTime:forming.openTime,liveCandleCloseTime:forming.closeTime,
   liveCandleMovePct:(tick.price/forming.open-1)*100,
   mode:'READ_ONLY',automatedTrading:false};
}
