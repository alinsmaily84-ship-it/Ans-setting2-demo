// One-shot Demo entry -> fill -> primary stop. No scheduler, no Live.
import {fetchDemoAccountSnapshot} from './demo-account-reader.mjs';
import {prepareDemoProbe} from './demo-order-preparation.mjs';
import {sendExplicitDemoRequest} from './demo-order-transport.mjs';
import {protectConfirmedDemoFill} from './demo-confirmed-fill-stop-flow.mjs';

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
 if(exposure.some(p=>!Number.isFinite(Number(p.positionAmt))))
  return {action:'NOT_SUBMITTED',reason:'POSITION_SNAPSHOT_INVALID',ordersPlaced:0};
 if(exposure.length>=5 || exposure.some(p=>p.symbol===symbol))
  return {action:'NOT_SUBMITTED',reason:'EXPOSURE_REQUIRES_RECONCILIATION',ordersPlaced:0};
 let submitted;
 try{
  submitted=await sendExplicitDemoRequest({kind:'marketOrder',apiKey,apiSecret,fetchImpl,
   params:{symbol,side,type:'MARKET',quantity:planned.quantity}});
 }catch{
  return {action:'ENTRY_OUTCOME_UNKNOWN',reason:'RECONCILE_EXCHANGE_BEFORE_RETRY',ordersPlaced:'unknown'};
 }
 if(!submitted?.orderId)
  return {action:'ENTRY_ACCEPTANCE_UNCONFIRMED',ordersPlaced:1,exchangeProtectionConfirmed:false};
 let orderStatus,after;
 try{
  orderStatus=await sendExplicitDemoRequest({kind:'orderStatus',apiKey,apiSecret,fetchImpl,
   params:{symbol,orderId:String(submitted.orderId)}});
  after=await fetchDemoAccountSnapshot({apiKey,apiSecret,fetchImpl});
 }catch{
  return {action:'ENTRY_FILL_RECONCILIATION_REQUIRED',ordersPlaced:1,exchangeProtectionConfirmed:false};
 }
 try{
  const protection=await protectConfirmedDemoFill({
   symbol,side,requestedQuantity:planned.quantity,submitted,orderStatus,
   beforePositions:before.positions,afterPositions:after.positions,
   stepSize,markPrice,tickSize,apiKey,apiSecret,fetchImpl,explicitDemoAuthorization:true
  });
  return {...protection,
   action:protection.exchangeProtectionConfirmed===true?'DEMO_PROBE_PROTECTED':'DEMO_PROBE_NEEDS_PROTECTION',
   entryOrderId:String(submitted.orderId),ordersPlaced:1,
   exchangeProtectionConfirmed:protection.exchangeProtectionConfirmed===true};
 }catch{
  return {action:'DEMO_PROBE_NEEDS_PROTECTION',entryOrderId:String(submitted.orderId),
   ordersPlaced:1,reason:'PROTECTION_FLOW_FAILED_RECONCILE_IMMEDIATELY',exchangeProtectionConfirmed:false};
 }
}
