// Demo-only handoff: convert a reconciled primary stop proposal into Binance
// conditional Algo API parameters. No network calls and no automatic execution.
import {prepareSignedDemoRequest} from './demo-order-transport.mjs';

export function prepareDemoPrimaryStopSubmission({handoff,position,apiKey,apiSecret,timestamp}) {
  if(handoff?.action!=='PRIMARY_STOP_PROPOSAL_READY' ||
     handoff.exchangeProtectionConfirmed!==false ||
     handoff.protection?.primary?.valid!==true)
    return {ready:false,reason:'PRIMARY_STOP_HANDOFF_INVALID',ordersPlaced:0};
  const stop=handoff.protection.primary;
  const qty=Number(position?.positionAmt);
  if(position?.symbol!==stop.symbol || !Number.isFinite(qty) || qty===0 ||
     qty!==handoff.fill.positionQty ||
     stop.side!==(qty>0?'SELL':'BUY'))
    return {ready:false,reason:'POSITION_RECONCILIATION_REQUIRED',ordersPlaced:0};
  const positionSide=position.positionSide||'BOTH';
  if(!['BOTH','LONG','SHORT'].includes(positionSide) ||
     (positionSide==='LONG'&&qty<0) ||
     (positionSide==='SHORT'&&qty>0))
    return {ready:false,reason:'POSITION_LEG_INVALID',ordersPlaced:0};
  const params={
    algoType:'CONDITIONAL',symbol:stop.symbol,side:stop.side,
    type:'STOP_MARKET',triggerPrice:String(stop.triggerPrice),
    workingType:'MARK_PRICE',closePosition:'true',positionSide
  };
  // Validates exact Demo host, API fields, signature and stop-only order shape.
  const request=prepareSignedDemoRequest({
    kind:'protectiveAlgoOrder',apiKey,apiSecret,params,timestamp
  });
  return {ready:true,kind:'protectiveAlgoOrder',params,request,
    ordersPlaced:0,exchangeProtectionConfirmed:false,
    note:'Prepared only. Submission, exchange acceptance, and active-stop readback remain required.'};
}
