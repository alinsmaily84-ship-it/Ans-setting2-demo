// Demo-only fail-safe: flatten a newly opened, unprotected one-way position.
// Never send a close if an active algo stop exists or position mode is ambiguous.
import {fetchDemoAccountSnapshot} from './demo-account-reader.mjs';
import {sendExplicitDemoRequest} from './demo-order-transport.mjs';
export async function flattenUnprotectedDemoProbe({symbol,side,apiKey,apiSecret,fetchImpl,beforePositions,explicitDemoAuthorization=false}={}){
 if(!explicitDemoAuthorization)return {action:'NO_ACTION',reason:'AUTHORIZATION_REQUIRED'};
 if(!/^[A-Z0-9]+USDT$/.test(symbol||'')||!['BUY','SELL'].includes(side))throw Error('INVALID_PROBE');
 // Never flatten a position unless a pre-entry snapshot proves it was absent.
 if(!Array.isArray(beforePositions)||!beforePositions.some(p=>p.symbol===symbol&&Number.isFinite(Number(p.positionAmt))&&Number(p.positionAmt)===0)||beforePositions.some(p=>p.symbol===symbol&&(!Number.isFinite(Number(p.positionAmt))||Number(p.positionAmt)!==0)))
  return {action:'MANUAL_RECONCILIATION_REQUIRED',reason:'CLEAN_PRE_ENTRY_SNAPSHOT_REQUIRED'};
 let snapshot;
 try{snapshot=await fetchDemoAccountSnapshot({apiKey,apiSecret,fetchImpl});}
 catch{return {action:'MANUAL_RECONCILIATION_REQUIRED',reason:'ACCOUNT_READ_FAILED'};}
 const active=snapshot.positions.filter(p=>p.symbol===symbol&&Number(p.positionAmt)!==0);
 if(active.length!==1)return {action:'MANUAL_RECONCILIATION_REQUIRED',reason:'POSITION_NOT_UNIQUE'};
 const p=active[0],qty=Number(p.positionAmt);
 if((p.positionSide||'BOTH')!=='BOTH'||!Number.isFinite(qty)||qty===0||
   (side==='BUY'&&qty<=0)||(side==='SELL'&&qty>=0))
   return {action:'MANUAL_RECONCILIATION_REQUIRED',reason:'POSITION_MODE_OR_DIRECTION_MISMATCH'};
 const protective=snapshot.algoOrders.some(o=>o.symbol===symbol&&
   ['NEW','WORKING','PENDING'].includes(String(o.algoStatus||o.status||'').toUpperCase())&&
   (o.closePosition===true||o.closePosition==='true'));
 if(protective)return {action:'MANUAL_RECONCILIATION_REQUIRED',reason:'ACTIVE_PROTECTION_EXISTS'};
 try{
  const result=await sendExplicitDemoRequest({kind:'marketOrder',apiKey,apiSecret,fetchImpl,
    params:{symbol,side:qty>0?'SELL':'BUY',type:'MARKET',quantity:String(Math.abs(qty)),reduceOnly:true}});
  const after=await fetchDemoAccountSnapshot({apiKey,apiSecret,fetchImpl});
  const remaining=after.positions.filter(x=>x.symbol===symbol&&Number(x.positionAmt)!==0);
  return remaining.length===0?{action:'FLATTENED_AND_VERIFIED',orderId:String(result.orderId||'')}:
    {action:'MANUAL_RECONCILIATION_REQUIRED',reason:'POSITION_STILL_OPEN'};
 }catch{return {action:'MANUAL_RECONCILIATION_REQUIRED',reason:'FLATTEN_OUTCOME_UNKNOWN'};}
}
