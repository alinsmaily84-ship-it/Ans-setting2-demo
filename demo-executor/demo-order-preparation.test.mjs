import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareDemoProbe} from './demo-order-preparation.mjs';
function symbol({step='0.001',minQty='0.001',maxQty='100000',notional='5',type='MIN_NOTIONAL'}={}){
 return {symbol:'TESTUSDT',status:'TRADING',contractType:'PERPETUAL',quoteAsset:'USDT',filters:[{filterType:'MARKET_LOT_SIZE',stepSize:step,minQty,maxQty},{filterType:type,...(type==='NOTIONAL'?{minNotional:notional}:{notional})}]};
}
function plan(price,exchangeSymbol){return prepareDemoProbe({symbol:'TESTUSDT',side:'BUY',price,exchangeSymbol});}
test('minimum exactly 5 USDT with 0.001 step',()=>{
 const p=plan(1,symbol());assert.equal(p.valid,true);assert.equal(p.quantity,'5.000');assert.equal(p.actualNotionalUsdt,5);
});
test('NOTIONAL minNotional filter supported',()=>{
 const p=plan(2,symbol({step:'0.01',minQty:'0.01',notional:'5.01',type:'NOTIONAL'}));assert.equal(p.valid,true);assert.equal(p.quantity,'2.51');
});
test('minQty dominates minimum notional',()=>{
 const p=plan(1,symbol({step:'0.1',minQty:'6.2',notional:'5'}));assert.equal(p.valid,true);assert.equal(p.quantity,'6.2');
});
test('reject invalid exchange minimum metadata',()=>{
 assert.throws(()=>plan(1,symbol({step:'0'})),/DEMO_MINIMUM_METADATA_INVALID/);
});
test('reject quantity above exchange max',()=>{
 const p=plan(1,symbol({maxQty:'4'}));assert.equal(p.valid,false);assert.ok(p.reasons.includes('ABOVE_MAX_QTY'));
});
