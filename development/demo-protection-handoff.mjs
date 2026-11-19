// Read-only gate between a reconciled Binance Futures Demo fill and stop planning.
// A proposed stop is never treated as exchange-confirmed protection.
import {reconcileDemoMarketFill,reconcileDemoPositionDelta} from './demo-fill-reconciliation.mjs';
import {prepareConfirmedFillProtection} from './demo-execution-handoff.mjs';
import {auditDemoPositionProtection} from './demo-exchange-audit.mjs';

export function prepareReconciledDemoProtection({
  symbol,side,requestedQuantity,submitted,orderStatus,
  beforePositions,afterPositions,stepSize,markPrice,tickSize
}) {
  const fill=reconcileDemoMarketFill({
    symbol,side,requestedQuantity,submitted,orderStatus,positions:afterPositions
  });
  if(!fill.confirmed)
    return {action:'PROTECTION_BLOCKED',reason:fill.reason,exchangeProtectionConfirmed:false,ordersPlaced:0};
  const delta=reconcileDemoPositionDelta({
    symbol,side,executedQty:fill.executedQty,beforePositions,afterPositions,stepSize
  });
  if(!delta.confirmed)
    return {action:'PROTECTION_REQUIRES_RECONCILIATION',reason:delta.reason,
      exchangeProtectionConfirmed:false,ordersPlaced:0};
  const protection=prepareConfirmedFillProtection({
    symbol,positionQty:fill.positionQty,entryPrice:fill.positionEntryPrice,
    markPrice,tickSize
  });
  if(!protection.proposedFirstStop)
    return {action:'PROTECTION_REQUIRES_RISK_REVIEW',reason:'PRIMARY_STOP_NOT_VALID',
      exchangeProtectionConfirmed:false,ordersPlaced:0};
  return {action:'PRIMARY_STOP_PROPOSAL_READY',fill,delta,protection,
    exchangeProtectionConfirmed:false,executionEnabled:false,ordersPlaced:0,
    note:'Exchange stop submission and acceptance still required. Never report protected until verified.'};
}


// Read back Binance's active Algo orders after stop submission.
// A successful POST alone is not evidence of an armed stop.
export function confirmReconciledDemoProtection({handoff,position,algoOrders}) {
  if(!handoff || handoff.action!=='PRIMARY_STOP_PROPOSAL_READY' ||
     !handoff.protection?.primary?.valid)
    return {protected:false,reason:'PROTECTION_HANDOFF_NOT_READY'};
  if(!position || position.symbol!==handoff.fill.symbol ||
     Number(position.positionAmt)!==handoff.fill.positionQty)
    return {protected:false,reason:'POSITION_CHANGED_SINCE_STOP_PLAN'};
  const primary=handoff.protection.primary;
  const expectedStopTrigger=Number(primary.order?.stopPrice ?? primary.order?.triggerPrice);
  if(!Number.isFinite(expectedStopTrigger) || expectedStopTrigger<=0)
    return {protected:false,reason:'STOP_TRIGGER_INVALID'};
  const expectedStopSide=handoff.fill.positionQty>0?'SELL':'BUY';
  const audit=auditDemoPositionProtection({
    symbol:handoff.fill.symbol,position,algoOrders,
    expectedStopSide,expectedStopTrigger
  });
  return {protected:audit.protected===true,reason:audit.reason,
    stopOrderId:audit.stopOrderId||null,
    exchangeProtectionConfirmed:audit.protected===true};
}
