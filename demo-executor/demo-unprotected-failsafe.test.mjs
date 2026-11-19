import test from 'node:test';
import assert from 'node:assert/strict';
import {flattenUnprotectedDemoProbe} from './demo-unprotected-failsafe.mjs';
const p={symbol:'SOLUSDT',positionAmt:'0.5',positionSide:'BOTH'};
function fakeFetch({positions=[p],algoOrders=[],afterPositions=[]}={}){
 const calls=[];
 const fetchImpl=async(url,opts)=>{
  const path=new URL(url).pathname;
  calls.push({path,method:opts.method,body:opts.body});
  const body=path.includes('positionRisk')?(calls.filter(x=>x.path.includes('positionRisk')).length>1?afterPositions:positions):
   path.includes('openAlgoOrders')?algoOrders:{orderId:123};
  return {ok:true,json:async()=>body};
 };
 return {fetchImpl,calls};
}
test('never closes when explicit authorization missing',async()=>{
 const x=fakeFetch();
 const result=await flattenUnprotectedDemoProbe({symbol:'SOLUSDT',side:'BUY',apiKey:'k',apiSecret:'s',fetchImpl:x.fetchImpl});
 assert.equal(result.action,'NO_ACTION');assert.equal(x.calls.length,0);
});
test('never closes a position with active exchange protection',async()=>{
 const x=fakeFetch({algoOrders:[{symbol:'SOLUSDT',algoStatus:'NEW',closePosition:true}]});
 const result=await flattenUnprotectedDemoProbe({symbol:'SOLUSDT',side:'BUY',apiKey:'k',apiSecret:'s',fetchImpl:x.fetchImpl,beforePositions:[{symbol:'SOLUSDT',positionAmt:'0'}],explicitDemoAuthorization:true});
 assert.equal(result.reason,'ACTIVE_PROTECTION_EXISTS');
 assert.equal(x.calls.filter(c=>c.method==='POST').length,0);
});
test('never closes hedge mode or mismatched direction',async()=>{
 const x=fakeFetch({positions:[{...p,positionSide:'LONG'}]});
 const result=await flattenUnprotectedDemoProbe({symbol:'SOLUSDT',side:'BUY',apiKey:'k',apiSecret:'s',fetchImpl:x.fetchImpl,beforePositions:[{symbol:'SOLUSDT',positionAmt:'0'}],explicitDemoAuthorization:true});
 assert.equal(result.reason,'POSITION_MODE_OR_DIRECTION_MISMATCH');
 assert.equal(x.calls.filter(c=>c.method==='POST').length,0);
});
test('reduce-only opposite-side close is verified on exchange',async()=>{
 const x=fakeFetch();
 const result=await flattenUnprotectedDemoProbe({symbol:'SOLUSDT',side:'BUY',apiKey:'k',apiSecret:'s',fetchImpl:x.fetchImpl,beforePositions:[{symbol:'SOLUSDT',positionAmt:'0'}],explicitDemoAuthorization:true});
 assert.equal(result.action,'FLATTENED_AND_VERIFIED');
 const post=x.calls.find(c=>c.method==='POST');
 assert.equal(post.path,'/fapi/v1/order');
 assert.equal(new URLSearchParams(post.body).get('reduceOnly'),'true');
 assert.equal(new URLSearchParams(post.body).get('side'),'SELL');
});

test('never flattens pre-existing exposure without clean baseline',async()=>{
 const x=fakeFetch();
 const result=await flattenUnprotectedDemoProbe({symbol:'SOLUSDT',side:'BUY',apiKey:'k',apiSecret:'s',fetchImpl:x.fetchImpl,beforePositions:[p],explicitDemoAuthorization:true});
 assert.equal(result.reason,'CLEAN_PRE_ENTRY_SNAPSHOT_REQUIRED');
 assert.equal(x.calls.length,0);
});

test('missing symbol in baseline does not authorize a flatten',async()=>{
 const x=fakeFetch();
 const result=await flattenUnprotectedDemoProbe({symbol:'SOLUSDT',side:'BUY',apiKey:'k',apiSecret:'s',fetchImpl:x.fetchImpl,beforePositions:[{symbol:'BTCUSDT',positionAmt:'0'}],explicitDemoAuthorization:true});
 assert.equal(result.reason,'CLEAN_PRE_ENTRY_SNAPSHOT_REQUIRED');
 assert.equal(x.calls.length,0);
});
