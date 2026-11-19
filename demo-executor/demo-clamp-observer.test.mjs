import test from 'node:test';
import assert from 'node:assert/strict';
import {observeDemo} from './demo-clamp-observer.mjs';
test('compares only after sufficient ticks and never submits orders',async()=>{
 let i=0;const prices=[100,101,102,103,104];
 const rows=await observeDemo({symbol:'SOLUSDT',originalSide:'LONG',observations:5,lookback:3,fetchPrice:async()=>({symbol:'SOLUSDT',price:prices[i++],observedAt:i}),sleep:async()=>{},emit:()=>{}});
 assert.equal(rows.length,2);assert.equal(rows[0].clampSide,'LONG');assert.equal(rows[1].candidateSide,'LONG');
});
test('requires original strategy decision',async()=>await assert.rejects(observeDemo({symbol:'SOLUSDT',originalSide:'BUY',observations:9}),/ORIGINAL_DECISION_REQUIRED/));
