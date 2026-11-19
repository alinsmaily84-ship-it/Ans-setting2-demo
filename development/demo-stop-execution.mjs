// Explicit Demo-only primary stop submission and readback.
// Not connected to the running service or any scheduler.
import {sendExplicitDemoRequest} from './demo-order-transport.mjs';
import {confirmReconciledDemoProtection} from './demo-protection-handoff.mjs';

export async function submitAndVerifyDemoPrimaryStop({
  handoff,position,apiKey,apiSecret,fetchImpl,explicitDemoAuthorization=false
}) {
  if(explicitDemoAuthorization!==true)
    return {protected:false,submitted:false,reason:'EXPLICIT_DEMO_AUTHORIZATION_REQUIRED'};
  if(handoff?.action!=='PRIMARY_STOP_PROPOSAL_READY' ||
     handoff.protection?.primary?.valid!==true ||
     handoff.exchangeProtectionConfirmed!==false)
    return {protected:false,submitted:false,reason:'HANDOFF_NOT_READY'};
  const stop=handoff.protection.primary;
  const qty=Number(position?.positionAmt);
  const entry=Number(position?.entryPrice);
  if(position?.symbol!==stop.symbol || qty!==handoff.fill.positionQty ||
     !Number.isFinite(entry) || entry<=0 ||
     Math.abs(entry-handoff.fill.positionEntryPrice)>Math.max(1e-8,entry*1e-8))
    return {protected:false,submitted:false,reason:'POSITION_CHANGED'};
  const positionSide=position.positionSide||'BOTH';
  if(!['BOTH','LONG','SHORT'].includes(positionSide) ||
     (positionSide==='LONG'&&qty<=0) ||
     (positionSide==='SHORT'&&qty>=0))
    return {protected:false,submitted:false,reason:'POSITION_SIDE_INVALID'};
  const params={algoType:'CONDITIONAL',symbol:stop.symbol,
    side:qty>0?'SELL':'BUY',type:'STOP_MARKET',
    triggerPrice:String(stop.triggerPrice),workingType:'MARK_PRICE',
    closePosition:'true',positionSide};
  let accepted;
  try {
    accepted=await sendExplicitDemoRequest({
      kind:'protectiveAlgoOrder',apiKey,apiSecret,params,fetchImpl
    });
  } catch {
    return {protected:false,submitted:'unknown',reason:'SUBMISSION_OUTCOME_UNKNOWN_RECONCILE_BEFORE_RETRY'};
  }
  if(!accepted || !accepted.algoId)
    return {protected:false,submitted:true,reason:'ALGO_ACCEPTANCE_NOT_CONFIRMED'};
  let algoOrders;
  try {
    algoOrders=await sendExplicitDemoRequest({
      kind:'openAlgoOrders',apiKey,apiSecret,params:{symbol:stop.symbol},fetchImpl
    });
  } catch {
    return {protected:false,submitted:true,reason:'ACTIVE_STOP_READBACK_FAILED',algoId:String(accepted.algoId)};
  }
  // Only the just-accepted Algo ID can confirm this submission. A stale stop
  // for the same symbol must not be mistaken for the newly submitted stop.
  const acceptedId=String(accepted.algoId);
  if(!Array.isArray(algoOrders))
    return {protected:false,submitted:true,reason:'ALGO_READBACK_INVALID',algoId:acceptedId};
  const matchingOrders=algoOrders.filter(o=>String(o?.algoId)===acceptedId);
  if(matchingOrders.length!==1)
    return {protected:false,submitted:true,reason:'SUBMITTED_ALGO_NOT_ACTIVE',algoId:acceptedId};
  const verified=confirmReconciledDemoProtection({
    handoff,position,algoOrders:matchingOrders
  });
  return {protected:verified.protected===true,submitted:true,
    reason:verified.reason,algoId:acceptedId,
    exchangeProtectionConfirmed:verified.exchangeProtectionConfirmed===true};
}
