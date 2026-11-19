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
import {demoStrategy} from './demo-strategy-contract.mjs';

// Prepare protection only from a confirmed exchange position, never from an unfilled order.
// A proposed stop is not considered protection until Binance accepts and reports it.
export function prepareConfirmedFillProtection({symbol,positionQty,entryPrice,markPrice,tickSize}) {
  const primary=planStopAfterFill({
    symbol,positionQty,entryPrice,markPrice,tickSize,
    maxLossUsdt:demoStrategy.stopLossPrimaryUsdt
  });
  const backup=planStopAfterFill({
    symbol,positionQty,entryPrice,markPrice,tickSize,
    maxLossUsdt:demoStrategy.stopLossBackupUsdt
  });
  const emergency=planStopAfterFill({
    symbol,positionQty,entryPrice,markPrice,tickSize,
    maxLossUsdt:demoStrategy.stopLossEmergencyUsdt
  });
  return {
    symbol,primary,backup,emergency,
    // The backup is a contingency, not an instruction to place both orders.
    proposedFirstStop:primary.valid?primary:null,
    requiresRiskReview:!primary.valid,
    exchangeProtectionConfirmed:false,
    executionEnabled:false,ordersPlaced:0,
    note:'Submit and verify the primary exchange stop first; SL2 and SL3 require separate failure handling.'
  };
}


// The 60-second stale-probe rule closes only the confirmed probe, not another position.
// A caller must re-read the Binance Demo position immediately before submitting this proposal.
export function prepareStaleProbeClose({probe,review,exchangePosition}) {
  const decision=planProbeReview(probe,review);
  if (decision.action!=='CLOSE_PROBE_PROPOSAL')
    return {action:decision.action,executionEnabled:false,ordersPlaced:0};
  const qty=Number(exchangePosition?.positionAmt);
  const side=qty>0?'SELL':'BUY';
  // Check actual exchange quantity against the probe fill, not a caller-provided
  // notional estimate: a stale estimate could otherwise close an expanded position.
  const entryPrice=Number(exchangePosition?.entryPrice);
  const observedNotional=Math.abs(qty)*entryPrice;
  const tolerance=Math.max(0.1,probe.filledNotionalUsdt*0.03);
  const matches=exchangePosition?.symbol===probe.symbol &&
    (!exchangePosition.positionSide || exchangePosition.positionSide==='BOTH') &&
    Number.isFinite(qty) && qty!==0 &&
    Number.isFinite(entryPrice) && entryPrice>0 &&
    (qty>0?'LONG':'SHORT')===probe.initialSide &&
    Number.isFinite(observedNotional) &&
    Math.abs(observedNotional-probe.filledNotionalUsdt)<=tolerance;
  if (!matches) return {action:'CLOSE_REQUIRES_POSITION_RECONCILIATION',
    executionEnabled:false,ordersPlaced:0};
  return {
    action:'CLOSE_PROBE_ORDER_PREPARED',venue:demoStrategy.venue,
    order:{symbol:probe.symbol,side,type:'MARKET',quantity:String(Math.abs(qty)),reduceOnly:true},
    executionEnabled:false,ordersPlaced:0,
    note:'Proposal only. Reconfirm exchange position and quantity before any actual order.'
  };
}
