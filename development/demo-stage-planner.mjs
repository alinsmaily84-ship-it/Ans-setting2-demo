// Demo-only two-stage lifecycle planner. No API calls or orders.
// Pure transitions: the caller must verify exchange fills, protective stops, and current market direction.
import { demoStrategy } from "./demo-strategy-contract.mjs";

const validSide = side => side === "LONG" || side === "SHORT";
const validPositive = n => Number.isFinite(n) && n > 0;
const finiteTime = n => Number.isFinite(n) && n >= 0;

export function recordConfirmedProbe({symbol, side, filledNotionalUsdt, filledAtMs, orderId}) {
  if (!/^[A-Z0-9]+USDT$/.test(symbol) || !validSide(side) ||
      !validPositive(filledNotionalUsdt) || !finiteTime(filledAtMs) ||
      !String(orderId || "").trim()) throw new Error("PROBE_CONFIRMATION_INVALID");
  return Object.freeze({
    symbol, initialSide:side, filledNotionalUsdt, filledAtMs, orderId:String(orderId),
    phase:"PROBE_CONFIRMED", nextReviewAtMs:filledAtMs + demoStrategy.firstDecisionSeconds * 1000
  });
}

// Only generates a proposed action. It never flips or adds a position itself.
// The direction and market data must be fresh and independently observed at review time.
export function planProbeReview(probe, {nowMs, currentSide, currentNotionalUsdt, targetNotionalUsdt, directionObservedAtMs, addEligible}) {
  if (!probe || !["PROBE_CONFIRMED","RECHECK_PENDING"].includes(probe.phase) ||
      !finiteTime(nowMs) || !validSide(currentSide) ||
      !validPositive(currentNotionalUsdt) || !validPositive(targetNotionalUsdt) ||
      !finiteTime(directionObservedAtMs) || typeof addEligible !== "boolean")
    throw new Error("REVIEW_INPUT_INVALID");
  if (nowMs < probe.nextReviewAtMs) return {action:"NOT_DUE", dueAtMs:probe.nextReviewAtMs};
  if (directionObservedAtMs > nowMs + 1000 || nowMs - directionObservedAtMs > 5000)
    return {action:"DIRECTION_STALE", executable:false};
  const elapsedSeconds=(nowMs-probe.filledAtMs)/1000;
  if (!addEligible) {
    if (elapsedSeconds >= demoStrategy.staleProbeReviewSeconds)
      return {action:"CLOSE_PROBE_PROPOSAL", executable:false, reason:"NO_ADD_AT_60_SECONDS"};
    return {
      action:"RECHECK_PENDING", executable:false,
      nextState:{...probe,phase:"RECHECK_PENDING",nextReviewAtMs:probe.filledAtMs+demoStrategy.staleProbeReviewSeconds*1000}
    };
  }
  const remainingUsdt=Math.max(0,targetNotionalUsdt-currentNotionalUsdt);
  if (remainingUsdt === 0) return {action:"TARGET_ALREADY_MET",executable:false};
  if (currentSide !== probe.initialSide)
    return {action:"POSITION_SIDE_CHANGED",executable:false};
  if (currentSide !== (probe.initialSide === "LONG" ? "LONG" : "SHORT"))
    return {action:"POSITION_MISMATCH",executable:false};
  return {
    action:currentSide===probe.initialSide?"ADD_OR_REVERSE_PROPOSAL":"REVIEW_POSITION",
    executable:false,
    desiredSide:currentSide,
    remainingNotionalUsdt:remainingUsdt,
    // Direction reversal requires explicit position accounting and protective order replacement.
    reversalNeeded:false,
    note:"Planner only; live direction and reversal execution must be resolved by the approved engine."
  };
}
