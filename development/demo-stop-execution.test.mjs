import test from 'node:test';
import assert from 'node:assert/strict';
import {submitAndVerifyDemoPrimaryStop} from './demo-stop-execution.mjs';

const position={symbol:'XRPUSDT',positionAmt:'100',entryPrice:'2',positionSide:'BOTH'};
const handoff={
 action:'PRIMARY_STOP_PROPOSAL_READY',exchangeProtectionConfirmed:false,
 fill:{symbol:'XRPUSDT',positionQty:100,positionEntryPrice:2},
 protection:{primary:{valid:true,symbol:'XRPUSDT',side:'SELL',orderType:'STOP_MARKET',
  workingType:'MARK_PRICE',closePosition:true,triggerPrice:1.98}}
};
function fakeExchange({existing=[],after=[],changed=false}={}){
 const calls=[];
 const fetchImpl=async(url,opts)=>{
  calls.push({url,method:opts.method});
  const data=url.includes('/positionRisk')?[changed?{...position,entryPrice:'2.01'}:position]:
   url.includes('/openAlgoOrders')?(calls.some(c=>c.method==='POST')?after:existing):
   url.includes('/algoOrder')?{algoId:101}:null;
  return {ok:true,json:async()=>url.includes('/positionRisk')?[data]:data};
 };
 return {calls,fetchImpl};
}
test('no Demo stop submission without explicit authorization',async()=>{
 const x=fakeExchange();
 const r=await submitAndVerifyDemoPrimaryStop({handoff,position,apiKey:'k',apiSecret:'s',fetchImpl:x.fetchImpl});
 assert.equal(r.submitted,false);assert.equal(x.calls.length,0);
});
test('reject changed exchange entry before sending stop',async()=>{
 const x=fakeExchange({changed:true});
 const r=await submitAndVerifyDemoPrimaryStop({handoff,position,apiKey:'k',apiSecret:'s',fetchImpl:x.fetchImpl,explicitDemoAuthorization:true});
 assert.equal(r.reason,'PRE_SUBMISSION_POSITION_CHANGED');
 assert.equal(x.calls.filter(c=>c.method==='POST').length,0);
});
test('existing active stop blocks duplicate POST',async()=>{
 const x=fakeExchange({existing:[{symbol:'XRPUSDT',side:'SELL',positionSide:'BOTH',
  orderType:'STOP_MARKET',closePosition:true,algoStatus:'NEW'}]});
 const r=await submitAndVerifyDemoPrimaryStop({handoff,position,apiKey:'k',apiSecret:'s',fetchImpl:x.fetchImpl,explicitDemoAuthorization:true});
 assert.equal(r.reason,'EXISTING_ACTIVE_STOP_REQUIRES_RECONCILIATION');
 assert.equal(x.calls.filter(c=>c.method==='POST').length,0);
});
test('only submitted Algo ID can certify exchange stop',async()=>{
 const x=fakeExchange({after:[{symbol:'XRPUSDT',side:'SELL',positionSide:'BOTH',
  orderType:'STOP_MARKET',closePosition:true,workingType:'MARK_PRICE',
  triggerPrice:'1.98',algoStatus:'NEW',algoId:99}]});
 const r=await submitAndVerifyDemoPrimaryStop({handoff,position,apiKey:'k',apiSecret:'s',fetchImpl:x.fetchImpl,explicitDemoAuthorization:true});
 assert.equal(r.protected,false);
 assert.equal(r.reason,'SUBMITTED_ALGO_NOT_ACTIVE');
 assert.equal(x.calls.filter(c=>c.method==='POST').length,1);
});
test('fresh matching active Algo ID confirms primary stop',async()=>{
 const x=fakeExchange({after:[{symbol:'XRPUSDT',side:'SELL',positionSide:'BOTH',
  orderType:'STOP_MARKET',closePosition:true,workingType:'MARK_PRICE',
  triggerPrice:'1.98',algoStatus:'NEW',algoId:101}]});
 const r=await submitAndVerifyDemoPrimaryStop({handoff,position,apiKey:'k',apiSecret:'s',fetchImpl:x.fetchImpl,explicitDemoAuthorization:true});
 assert.equal(r.protected,true);
 assert.equal(r.exchangeProtectionConfirmed,true);
 assert.equal(x.calls.filter(c=>c.method==='POST').length,1);
 assert.ok(x.calls.every(c=>c.url.startsWith('https://demo-fapi.binance.com/')));
});
