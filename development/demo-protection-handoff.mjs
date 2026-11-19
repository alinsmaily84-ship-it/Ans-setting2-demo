// Read-only gate between a reconciled Binance Futures Demo fill and stop planning.
// A proposed stop is never treated as exchange-confirmed protection.
import {reconcileDemoMarketFill,reconcileDemoPositionDelta} from './demo-fill-reconciliation.mjs';
import {prepareConfirmedFillProtection} from './demo-execution-handoff.mjs';

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
