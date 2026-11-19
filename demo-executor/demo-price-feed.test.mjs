import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchDemoPrice,createPriceHistory} from './demo-price-feed.mjs';
test('accepts Demo quote',async()=>{const x=await fetchDemoPrice('SOLUSDT',{fetchImpl:async()=>({ok:true,json:async()=>({symbol:'SOLUSDT',price:'123.45'})})});assert.equal(x.price,123.45);assert.equal(x.source,'BINANCE_FUTURES_DEMO')});
test('rejects wrong symbol',async()=>await assert.rejects(fetchDemoPrice('SOLUSDT',{fetchImpl:async()=>({ok:true,json:async()=>({symbol:'BTCUSDT',price:'123'})})})));
test('rejects bad quote',async()=>await assert.rejects(fetchDemoPrice('SOLUSDT',{fetchImpl:async()=>({ok:true,json:async()=>({symbol:'SOLUSDT',price:'0'})})})));
test('history retains most recent prices',()=>{const h=createPriceHistory({limit:3});for(let i=1;i<=4;i++)h.push({symbol:'SOLUSDT',price:i,observedAt:i});assert.deepEqual(h.get('SOLUSDT').map(x=>x.price),[2,3,4])});
