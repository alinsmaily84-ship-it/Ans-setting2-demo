// One-shot Demo entry -> fill -> primary stop. No scheduler, no Live.
import {randomUUID} from 'node:crypto';
import {demoStrategy} from './demo-strategy-contract.mjs';
import {fetchDemoAccountSnapshot} from './demo-account-reader.mjs';
import {prepareDemoProbe} from './demo-order-preparation.mjs';
import {sendExplicitDemoRequest} from './demo-order-transport.mjs';
import {protectConfirmedDemoFill} from './demo-confirmed-fill-stop-flow.mjs';
import {flattenUnprotectedDemoProbe} from './demo-unprotected-failsafe.mjs';

export async function executeOneDemoProtectedProbe({
 symbol,side,price,exchangeSymbol,markPrice,tickSize,stepSize,
 apiKey,apiSecret,fetchImpl,explicitDemoAuthorization=false
}={}){
 if(explicitDemoAuthorization!==true)
  return {action:'NOT_SUBMITTED',reason:'EXPLICIT_DEMO_AUTHORIZATION_REQUIRED',ordersPlaced:0};
 if(!['BUY','SELL'].includes(side))throw Error('ENTRY_SIDE_INVALID');
 const planned=prepareDemoProbe({symbol,side,price,exchangeSymbol});
 if(!planned.valid)return {action:'NOT_SUBMITTED',reason:'EXCHANGE_FILTER_REJECTED',details:planned.reasons,ordersPlaced:0};
 if(![markPrice,tickSize,stepSize].every(x=>Number.isFinite(x)&&x>0))
  return {action:'NOT_SUBMITTED',reason:'MARKET_REFERENCE_MISSING',ordersPlaced:0};
 const before=await fetchDemoAccountSnapshot({apiKey,apiSecret,fetchImpl});
 const exposure=before.positions.filter(p=>Number(p.positionAmt)!==0);
 if(before.positions.some(p=>p.positionAmt===null || p.positionAmt===undefined || !Number.isFinite(Number(p.positionAmt))))
  return {action:'NOT_SUBMITTED',reason:'POSITION_SNAPSHOT_INVALID',ordersPlaced:0};
 if(exposure.length>=demoStrategy.concurrentPositions || exposure.some(p=>p.symbol===symbol))
  return {action:'NOT_SUBMITTED',reason:'EXPOSURE_REQUIRES_RECONCILIATION',ordersPlaced:0};
 // Stable client identifier allows a timed-out submission to be traced on Binance.
 // Never resubmit a market order merely because the HTTP response was lost.
 const clientOrderId='ansdemo_'+randomUUID().replaceAll('-','').slice(0,26);
 let submitted;
 try{
  submitted=await sendExplicitDemoRequest({kind:'marketOrder',apiKey,apiSecret,fetchImpl,
   params:{symbol,side,type:'MARKET',quantity:planned.quantity,newClientOrderId:clientOrderId}});
 }catch{
  // An HTTP timeout does not imply rejection. Resolve by the unique client ID
  // before deciding whether an exposed position needs an immediate guarded exit.
  try {
   const status=await sendExplicitDemoRequest({kind:'orderStatus',apiKey,apiSecret,fetchImpl,
    params:{symbol,origClientOrderId:clientOrderId}});
   if(status?.orderId)submitted=status;
  }catch{
   // A timed-out entry can already be open. Attempt a guarded exchange-side
   // flatten; never blindly resubmit the entry after an ambiguous response.
   let failsafe;
   try{
    failsafe=await flattenUnprotectedDemoProbe({symbol,side,apiKey,apiSecret,fetchImpl,beforePositions:before.positions,explicitDemoAuthorization:true});
   }catch(error){
    failsafe={action:'RECONCILIATION_FAILED',reason:String(error?.message||error).slice(0,100)};
   }
   return {action:failsafe.action==='FLATTENED_AND_VERIFIED'?'DEMO_PROBE_SAFELY_FLATTENED':'ENTRY_OUTCOME_UNKNOWN',
    reason:'RECONCILE_EXCHANGE_BEFORE_RETRY',clientOrderId,ordersPlaced:'unknown',
    exchangeProtectionConfirmed:false,failsafe,riskReviewRequired:failsafe.action!=='FLATTENED_AND_VERIFIED'};
  }
 }
 if(!submitted?.orderId){
  // The exchange may have accepted the order despite an incomplete response.
  // Reconcile first; never issue a second entry as a recovery attempt.
  let confirmed=null;
  try{
   confirmed=await sendExplicitDemoRequest({kind:'orderStatus',apiKey,apiSecret,fetchImpl,
    params:{symbol,origClientOrderId:clientOrderId}});
  }catch{}
  if(confirmed?.orderId)submitted=confirmed;
  else return {action:'ENTRY_ACCEPTANCE_UNCONFIRMED',clientOrderId,ordersPlaced:'unknown',
   exchangeProtectionConfirmed:false,riskReviewRequired:true,
   reason:'EXCHANGE_ORDER_RECONCILIATION_REQUIRED'};
 }
 let orderStatus,after;
 try{
  orderStatus=await sendExplicitDemoRequest({kind:'orderStatus',apiKey,apiSecret,fetchImpl,
   params:{symbol,orderId:String(submitted.orderId)}});
  after=await fetchDemoAccountSnapshot({apiKey,apiSecret,fetchImpl});
 }catch{
  // The entry may already be filled: attempt exchange reconciliation and
  // a guarded reduce-only exit rather than leaving a known unprotected probe.
  const failsafe=await flattenUnprotectedDemoProbe({symbol,side,apiKey,apiSecret,fetchImpl,beforePositions:before.positions,explicitDemoAuthorization:true});
  return {action:failsafe.action==='FLATTENED_AND_VERIFIED'?'DEMO_PROBE_SAFELY_FLATTENED':'ENTRY_FILL_RECONCILIATION_REQUIRED',
    clientOrderId,ordersPlaced:1,exchangeProtectionConfirmed:false,failsafe,riskReviewRequired:failsafe.action!=='FLATTENED_AND_VERIFIED'};
 }
 try{
  const protection=await protectConfirmedDemoFill({
   symbol,side,requestedQuantity:planned.quantity,submitted,orderStatus,
   beforePositions:before.positions,afterPositions:after.positions,
   stepSize,markPrice,tickSize,apiKey,apiSecret,fetchImpl,explicitDemoAuthorization:true
  });
  const failsafe=protection.exchangeProtectionConfirmed===true?null:await flattenUnprotectedDemoProbe({symbol,side,apiKey,apiSecret,fetchImpl,beforePositions:before.positions,explicitDemoAuthorization:true});
  return {...protection,failsafe,
   action:protection.exchangeProtectionConfirmed===true?'DEMO_PROBE_PROTECTED':failsafe?.action==='FLATTENED_AND_VERIFIED'?'DEMO_PROBE_SAFELY_FLATTENED':'DEMO_PROBE_NEEDS_PROTECTION',
   entryOrderId:String(submitted.orderId),clientOrderId,ordersPlaced:1,
   exchangeProtectionConfirmed:protection.exchangeProtectionConfirmed===true};
 }catch{
  const failsafe=await flattenUnprotectedDemoProbe({symbol,side,apiKey,apiSecret,fetchImpl,beforePositions:before.positions,explicitDemoAuthorization:true});
  return {action:failsafe.action==='FLATTENED_AND_VERIFIED'?'DEMO_PROBE_SAFELY_FLATTENED':'DEMO_PROBE_NEEDS_PROTECTION',failsafe,entryOrderId:String(submitted.orderId),clientOrderId,
   ordersPlaced:1,reason:'PROTECTION_FLOW_FAILED_RECONCILE_IMMEDIATELY',
   exchangeProtectionConfirmed:false,riskReviewRequired:true};
 }
}
