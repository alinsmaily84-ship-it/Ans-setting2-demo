import test from 'node:test';
import assert from 'node:assert/strict';
import {movementSpeed15m,rankBySpeed15m,demoStrategy} from './demo-strategy-contract.mjs';
import {selectDemoCandidates} from './demo-analyzer-adapter.mjs';
import {prepareDemoMarketOrder,prepareDemoProbe} from './demo-order-preparation.mjs';
import {recordConfirmedProbe,planProbeReview} from './demo-stage-planner.mjs';
import {planStopAfterFill,profitFloorFromPeak} from './demo-protection-planner.mjs';
import {auditDemoPositionProtection,auditDemoExposure} from './demo-exchange-audit.mjs';
import {signDemoReadOnlyQuery,fetchDemoAccountSnapshot} from './demo-account-reader.mjs';
import {inspectDemoProtection} from './demo-protection-inspector.mjs';
import {runDemoInspection} from './demo-inspection-runner.mjs';

const sym={symbol:'XRPUSDT',status:'TRADING',contractType:'PERPETUAL',quoteAsset:'USDT',filters:[
 {filterType:'MARKET_LOT_SIZE',stepSize:'0.1',minQty:'0.1',maxQty:'100000'},
 {filterType:'MIN_NOTIONAL',notional:'5'}
]};
test('15-minute speed drives ordering',()=>{
 assert.equal(movementSpeed15m(110,100),10/15);
 assert.equal(rankBySpeed15m([{symbol:'A',closeNow:101,close15mAgo:100},{symbol:'B',closeNow:110,close15mAgo:100}])[0].symbol,'B');
});
test('analyzer adapter checks fresh results and ignores duplicate symbols',()=>{
 const now=Date.parse('2026-11-19T12:00:00Z');
 const item={symbol:'XRPUSDT',side:'LONG',price:2,m1:1,m5:2,m15:3,m60:4,speed15m:0.2};
 const result=selectDemoCandidates({updatedAt:new Date(now).toISOString(),ranked:[item,item]},{nowMs:now});
 assert.equal(result.candidates.length,1);
 assert.equal(result.executionEnabled,false);
 assert.throws(()=>selectDemoCandidates({updatedAt:new Date(now-100000).toISOString(),ranked:[item]},{nowMs:now}),/STALE/);
});
test('quantity rounded down and min notional checked',()=>{
 const p=prepareDemoProbe({symbol:'XRPUSDT',side:'BUY',price:2.03,exchangeSymbol:sym});
 assert.equal(p.quantity,'3.4');
 assert.equal(p.valid,true);
 const small=prepareDemoMarketOrder({symbol:'XRPUSDT',side:'BUY',desiredNotionalUsdt:1,price:2.03,exchangeSymbol:sym});
 assert.equal(small.valid,false);
 assert.ok(small.reasons.includes('BELOW_MIN_NOTIONAL'));
});
test('confirmed probe produces 30-second review and 60-second close proposal',()=>{
 const p=recordConfirmedProbe({symbol:'XRPUSDT',side:'LONG',filledNotionalUsdt:7,filledAtMs:100000,orderId:'123'});
 const base={positionSide:'LONG',marketDirection:'SHORT',currentNotionalUsdt:7,targetNotionalUsdt:2000,directionObservedAtMs:130000,addEligible:true};
 assert.equal(planProbeReview(p,{...base,nowMs:129000}).action,'NOT_DUE');
 const rev=planProbeReview(p,{...base,nowMs:130000});
 assert.equal(rev.action,'REVERSE_THEN_ADD_PROPOSAL');
 assert.equal(rev.remainingNotionalUsdt,1993);
 const recheck=planProbeReview(p,{...base,nowMs:130000,addEligible:false});
 assert.equal(recheck.action,'RECHECK_PENDING');
 assert.equal(planProbeReview(recheck.nextState,{...base,nowMs:160000,directionObservedAtMs:160000,addEligible:false}).action,'CLOSE_PROBE_PROPOSAL');
});
test('post-fill protection is planning only',()=>{
 const p=planStopAfterFill({symbol:'XRPUSDT',positionQty:100,entryPrice:2,markPrice:2,tickSize:0.001});
 assert.equal(p.triggerPrice,1.98);
 assert.equal(p.executionEnabled,false);
 assert.equal(profitFloorFromPeak(0.09).armed,false);
 assert.equal(profitFloorFromPeak(0.10).armed,true);
 assert.equal(demoStrategy.liveEnabled,false);
});

test('malformed exchange lot filters are rejected',()=>{
 const broken={...sym,filters:[{filterType:'MARKET_LOT_SIZE',stepSize:'0.1',minQty:'not-a-number',maxQty:'100000'}]};
 assert.throws(()=>prepareDemoProbe({symbol:'XRPUSDT',side:'BUY',price:2,exchangeSymbol:broken}),/EXCHANGE_FILTER_INVALID/);
});

test('Demo protection audit distinguishes proposed from confirmed exchange stops',()=>{
 const position={symbol:'XRPUSDT',positionAmt:'100'};
 const args={symbol:'XRPUSDT',position,expectedStopSide:'SELL',expectedStopTrigger:1.95};
 assert.equal(auditDemoPositionProtection({...args,algoOrders:[]}).protected,false);
 const algoOrders=[{symbol:'XRPUSDT',side:'SELL',algoStatus:'NEW',orderType:'STOP_MARKET',workingType:'MARK_PRICE',closePosition:true,triggerPrice:'1.95',algoId:42}];
 const result=auditDemoPositionProtection({...args,algoOrders});
 assert.equal(result.protected,true);
 assert.equal(result.stopOrderId,'42');
 assert.equal(auditDemoExposure({positions:[position],maxConcurrentPositions:5}).openPositionCount,1);
});

test('Demo signed reader is GET-only and fixed to Demo host',async()=>{
 const calls=[];
 const fakeFetch=async (url,opts)=>{
  calls.push({url,method:opts.method});
  return {ok:true,json:async()=>[]};
 };
 const result=await fetchDemoAccountSnapshot({apiKey:'demo-key',apiSecret:'demo-secret',fetchImpl:fakeFetch,nowMs:1700000000000});
 assert.equal(result.readOnly,true);
 assert.equal(calls.length,2);
 assert.ok(calls.every(x=>x.method==='GET'&&x.url.startsWith('https://demo-fapi.binance.com/')));
 assert.throws(()=>signDemoReadOnlyQuery('/fapi/v1/order',{apiKey:'x',apiSecret:'y'}),/NOT_ALLOWLISTED/);
});

test('Demo inspector verifies a real snapshot shape, not an assumed protection state',async()=>{
 const fetchImpl=async url=>({
  ok:true,
  json:async()=>url.includes('positionRisk')
   ?[{symbol:'XRPUSDT',positionAmt:'100',entryPrice:'2'}]
   :[{symbol:'XRPUSDT',side:'SELL',algoStatus:'NEW',orderType:'STOP_MARKET',workingType:'MARK_PRICE',closePosition:true,triggerPrice:'1.98',algoId:42}]
 });
 const args={apiKey:'demo-key',apiSecret:'demo-secret',fetchImpl,nowMs:1700000000000,
  marketBySymbol:{XRPUSDT:{markPrice:2,tickSize:0.001}}};
 const result=await inspectDemoProtection(args);
 assert.equal(result.exposure.openPositionCount,1);
 assert.equal(result.allOpenPositionsProtected,true);
 const missing=await inspectDemoProtection({...args,marketBySymbol:{}});
 assert.equal(missing.allOpenPositionsProtected,false);
 assert.equal(missing.reports[0].reason,'MARKET_REFERENCE_MISSING');
 const empty=await inspectDemoProtection({...args,fetchImpl:async()=>({ok:true,json:async()=>[]})});
 assert.equal(empty.allOpenPositionsProtected,false);
});

test('one-shot Demo runner reads public market data and private positions without sending orders',async()=>{
 const calls=[];
 const fakeFetch=async (url,opts)=>{
   calls.push({url,method:opts.method});
   const data=url.includes('exchangeInfo')?{symbols:[{symbol:'XRPUSDT',filters:[{filterType:'PRICE_FILTER',tickSize:'0.001'}]}]}:
     url.includes('premiumIndex')?[{symbol:'XRPUSDT',markPrice:'2'}]:
     url.includes('positionRisk')?[{symbol:'XRPUSDT',positionAmt:'100',entryPrice:'2'}]:
     [{symbol:'XRPUSDT',side:'SELL',algoStatus:'NEW',orderType:'STOP_MARKET',workingType:'MARK_PRICE',closePosition:true,triggerPrice:'1.98',algoId:42}];
   return {ok:true,json:async()=>data};
 };
 const report=await runDemoInspection({apiKey:'demo-key',apiSecret:'demo-secret',fetchImpl:fakeFetch,nowMs:1700000000000});
 assert.equal(report.openPositionCount,1);
 assert.equal(report.allOpenPositionsProtected,true);
 assert.equal(report.ordersPlaced,0);
 assert.equal(calls.length,4);
 assert.ok(calls.every(x=>x.method==='GET'&&x.url.startsWith('https://demo-fapi.binance.com/')));
});

test('hedge-mode stop cannot protect the opposite position leg',()=>{
 const position={symbol:'XRPUSDT',positionAmt:'100',positionSide:'LONG'};
 const stop={symbol:'XRPUSDT',side:'SELL',positionSide:'SHORT',algoStatus:'NEW',orderType:'STOP_MARKET',workingType:'MARK_PRICE',closePosition:true,triggerPrice:'1.95'};
 const result=auditDemoPositionProtection({symbol:'XRPUSDT',position,algoOrders:[stop],expectedStopSide:'SELL',expectedStopTrigger:1.95});
 assert.equal(result.protected,false);
 assert.equal(result.reason,'ACTIVE_STOP_NOT_CONFIRMED');
 assert.throws(()=>auditDemoExposure({positions:[{symbol:'XRPUSDT',positionAmt:'invalid'}]}),/POSITION_QTY_INVALID/);
});

test('contract-price stop does not falsely confirm mark-price protection',()=>{
 const position={symbol:'XRPUSDT',positionAmt:'100'};
 const order={symbol:'XRPUSDT',side:'SELL',algoStatus:'NEW',orderType:'STOP_MARKET',workingType:'CONTRACT_PRICE',closePosition:true,triggerPrice:'1.95'};
 const result=auditDemoPositionProtection({symbol:'XRPUSDT',position,algoOrders:[order],expectedStopSide:'SELL',expectedStopTrigger:1.95});
 assert.equal(result.protected,false);
});

test('malformed position entry does not hide the rest of the Demo audit',async()=>{
 const fakeFetch=async url=>({
  ok:true,
  json:async()=>url.includes('positionRisk')
   ?[{symbol:'XRPUSDT',positionAmt:'100',entryPrice:'invalid'},{symbol:'BTCUSDT',positionAmt:'1',entryPrice:'100'}]
   :[]
 });
 const report=await inspectDemoProtection({
  apiKey:'demo-key',apiSecret:'demo-secret',fetchImpl:fakeFetch,nowMs:1700000000000,
  marketBySymbol:{XRPUSDT:{markPrice:2,tickSize:0.001},BTCUSDT:{markPrice:100,tickSize:0.1}}
 });
 assert.equal(report.exposure.openPositionCount,2);
 assert.equal(report.reports.length,2);
 assert.equal(report.reports[0].reason,'STOP_INPUT_INVALID');
 assert.equal(report.allOpenPositionsProtected,false);
});

test('stop price rounding does not increase planned loss beyond primary two USDT',()=>{
 const long=planStopAfterFill({symbol:'XRPUSDT',positionQty:100,entryPrice:2,markPrice:2,tickSize:0.03});
 assert.equal(long.valid,true);
 assert.ok((2-long.triggerPrice)*100<=demoStrategy.stopLossPrimaryUsdt+1e-7);
 const short=planStopAfterFill({symbol:'XRPUSDT',positionQty:-100,entryPrice:2,markPrice:2,tickSize:0.03});
 assert.equal(short.valid,true);
 assert.ok((short.triggerPrice-2)*100<=demoStrategy.stopLossPrimaryUsdt+1e-7);
});

test('hedge-mode position cannot be certified by an unverified close-all stop',async()=>{
 const fetchImpl=async url=>({ok:true,json:async()=>url.includes('positionRisk')
   ?[{symbol:'XRPUSDT',positionAmt:'100',positionSide:'LONG',entryPrice:'2'}]
   :[{symbol:'XRPUSDT',side:'SELL',positionSide:'LONG',algoStatus:'NEW',orderType:'STOP_MARKET',workingType:'MARK_PRICE',closePosition:true,triggerPrice:'1.98'}]});
 const report=await inspectDemoProtection({apiKey:'demo-key',apiSecret:'demo-secret',fetchImpl,nowMs:1700000000000,marketBySymbol:{XRPUSDT:{markPrice:2,tickSize:0.001}}});
 assert.equal(report.allOpenPositionsProtected,false);
 assert.equal(report.reports[0].reason,'HEDGE_MODE_STOP_REQUIRES_VERIFIED_EXCHANGE_SUPPORT');
});

test('exchange audit accepts stricter stops but never looser ones',()=>{
 const position={symbol:'XRPUSDT',positionAmt:'100'};
 const base={symbol:'XRPUSDT',side:'SELL',algoStatus:'NEW',orderType:'STOP_MARKET',workingType:'MARK_PRICE',closePosition:true};
 const args={symbol:'XRPUSDT',position,expectedStopSide:'SELL',expectedStopTrigger:1.95};
 assert.equal(auditDemoPositionProtection({...args,algoOrders:[{...base,triggerPrice:'1.97'}]}).protected,true);
 assert.equal(auditDemoPositionProtection({...args,algoOrders:[{...base,triggerPrice:'1.90'}]}).protected,false);
 const shortPosition={symbol:'XRPUSDT',positionAmt:'-100'};
 const shortBase={...base,side:'BUY'};
 const shortArgs={symbol:'XRPUSDT',position:shortPosition,expectedStopSide:'BUY',expectedStopTrigger:2.05};
 assert.equal(auditDemoPositionProtection({...shortArgs,algoOrders:[{...shortBase,triggerPrice:'2.03'}]}).protected,true);
 assert.equal(auditDemoPositionProtection({...shortArgs,algoOrders:[{...shortBase,triggerPrice:'2.10'}]}).protected,false);
});
