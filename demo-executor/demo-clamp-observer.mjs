#!/usr/bin/env node
// Read-only demo observation. Original Setting2 decision must be supplied by its strategy engine.
// This does not submit orders, synthesize the original decision, or alter stop-loss.
import {fetchDemoPrice,createPriceHistory} from './demo-price-feed.mjs';
import {compareClampDirection} from './clamp-direction-shadow.mjs';
export async function observeDemo({symbol,originalSide,observations=12,lookback=8,fetchPrice=fetchDemoPrice,sleep=ms=>new Promise(r=>setTimeout(r,ms)),emit=console.log}) {
 if(!['LONG','SHORT','WAIT'].includes(originalSide))throw Error('ORIGINAL_DECISION_REQUIRED');
 if(!Number.isInteger(observations)||observations<lookback+1||observations>300)throw Error('INVALID_OBSERVATION_COUNT');
 const history=createPriceHistory({limit:observations});
 const results=[];
 for(let i=0;i<observations;i++) {
   const tick=await fetchPrice(symbol);
   const prices=history.push(tick);
   if(prices.length>lookback) {
     const comparison=compareClampDirection({originalSide,prices,lookback});
     const row={time:tick.observedAt,symbol,price:tick.price,...comparison};
     results.push(row);emit(JSON.stringify(row));
   }
   if(i<observations-1)await sleep(1000);
 }
 return results;
}
if(import.meta.url===new URL('file://'+process.argv[1]).href) {
 const [symbol,originalSide,rawCount]=process.argv.slice(2);
 await observeDemo({symbol,originalSide,observations:rawCount?Number(rawCount):12});
}
