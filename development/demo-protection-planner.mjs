// Demo-only protective-stop planning. No orders or network operations.
// Protective orders must be placed and verified at Binance after the position is filled.
import { demoStrategy } from "./demo-strategy-contract.mjs";

export function planStopAfterFill({symbol, positionQty, entryPrice, markPrice, tickSize, maxLossUsdt=demoStrategy.stopLossPrimaryUsdt}) {
  if (!/^[A-Z0-9]+USDT$/.test(symbol || "") ||
      ![positionQty,entryPrice,markPrice,tickSize,maxLossUsdt].every(Number.isFinite) ||
      positionQty===0 || entryPrice<=0 || markPrice<=0 || tickSize<=0 || maxLossUsdt<=0)
    throw new Error("STOP_INPUT_INVALID");
  const long=positionQty>0;
  const raw=entryPrice-(long?1:-1)*maxLossUsdt/Math.abs(positionQty);
  // Round toward entry to avoid increasing the planned loss beyond the budget.
  const ticks=long?Math.ceil(raw/tickSize - 1e-10):Math.floor(raw/tickSize + 1e-10);
  const triggerPrice=Number((ticks*tickSize).toPrecision(14));
  if (!(triggerPrice>0) || (long?triggerPrice>=markPrice:triggerPrice<=markPrice))
    return {valid:false,reason:"STOP_TRIGGER_ALREADY_CROSSED",requiresImmediateRiskReview:true,executionEnabled:false};
  return {
    venue:demoStrategy.venue,symbol,side:long?"SELL":"BUY",
    orderType:"STOP_MARKET",workingType:"MARK_PRICE",closePosition:true,
    triggerPrice,maxLossUsdt,valid:true,executionEnabled:false,
    verificationRequired:"Confirm accepted algo order exists on exchange for current position"
  };
}

export function profitFloorFromPeak(peakUsd, retainFraction=0.5) {
  if (![peakUsd,retainFraction].every(Number.isFinite) || retainFraction<0 || retainFraction>1)
    throw new Error("PROFIT_INPUT_INVALID");
  if (peakUsd < demoStrategy.profitProtectionArmUsdt)
    return {armed:false,floorUsd:null};
  return {armed:true,floorUsd:Math.max(0,peakUsd*retainFraction)};
}
