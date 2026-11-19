// ANS V2 Demo-only handoff from a confirmed 30s decision to exchange-compliant order sizing.
// This module never submits orders or changes an existing position.
// The executor must separately reconcile fills, reversals and accepted protective stops.
import {planProbeReview} from './demo-stage-planner.mjs';
import {prepareDemoMarketOrder} from './demo-order-preparation.mjs';

export function prepareDemoDecisionHandoff({probe,review,exchangeSymbol,price}) {
  const decision=planProbeReview(probe,review);
  if (!['ADD_PROPOSAL','REVERSE_THEN_ADD_PROPOSAL'].includes(decision.action))
    return {action:decision.action,decision,executionEnabled:false,ordersPlaced:0};
  // A reversal is not an ordinary add: it needs confirmed closure, position accounting,
  // and replacement of protective orders. Never hand it off as a one-sided market add.
  if (decision.reversalNeeded)
    return {action:'REVERSAL_REQUIRES_EXCHANGE_RECONCILIATION',decision,executionEnabled:false,ordersPlaced:0};
  const order=prepareDemoMarketOrder({
    symbol:probe.symbol,side:decision.desiredSide==='LONG'?'BUY':'SELL',
    desiredNotionalUsdt:decision.remainingNotionalUsdt,price,exchangeSymbol
  });
  return {action:order.valid?'ADD_ORDER_PREPARED':'ADD_ORDER_INVALID',
    decision,order,executionEnabled:false,ordersPlaced:0,
    note:'Sizing only. No exchange order, fill, or stop has been confirmed.'};
}

import {planStopAfterFill} from './demo-protection-planner.mjs';

// Prepare protection only from a confirmed exchange position, never from an unfilled order.
// A proposed stop is not considered protection until Binance accepts and reports it.
export function prepareConfirmedFillProtection({symbol,positionQty,entryPrice,markPrice,tickSize}) {
  const primary=planStopAfterFill({symbol,positionQty,entryPrice,markPrice,tickSize,maxLossUsdt:5});
  const backup=planStopAfterFill({symbol,positionQty,entryPrice,markPrice,tickSize,maxLossUsdt:10});
  return {
    symbol,primary,backup,
    readyForSubmission:primary.valid===true,
    exchangeProtectionConfirmed:false,
    executionEnabled:false,ordersPlaced:0,
    note:'An executor must submit and verify the protective order before claiming protection.'
  };
}
