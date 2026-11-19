// ANS V2 Demo strategy contract — isolated development module.
// No orders, network access, timers, or Live endpoints. Not wired into deployment.
// Do not import the archived Guardian as an execution authority.
export const demoStrategy = Object.freeze({
  venue: "BINANCE_FUTURES_DEMO",
  capitalReferenceUsdt: 500,
  probeNotionalUsdt: 7, // fallback; actual minimum must be computed per symbol from Binance filters
  targetNotionalUsdt: 1000,
  targetLeverage: 20,
  concurrentPositions: 10,
  firstDecisionSeconds: 30,
  staleProbeReviewSeconds: 60,
  rankingWindowMinutes: 15,
  profitProtectionArmUsdt: 0.10,
  stopLossPrimaryUsdt: 2,
  stopLossBackupUsdt: 5,
  stopLossEmergencyUsdt: 7,
  executionEnabled: false,
  liveEnabled: false
});

export function movementSpeed15m(closeNow, close15mAgo) {
  if (![closeNow, close15mAgo].every(Number.isFinite) || closeNow <= 0 || close15mAgo <= 0)
    throw new Error("INVALID_PRICE");
  return Math.abs((closeNow - close15mAgo) / close15mAgo * 100) / 15;
}

export function rankBySpeed15m(candidates) {
  return [...candidates].sort((a, b) => {
    const as = movementSpeed15m(a.closeNow, a.close15mAgo);
    const bs = movementSpeed15m(b.closeNow, b.close15mAgo);
    return bs - as || String(a.symbol).localeCompare(String(b.symbol));
  });
}

// Direction weights are deliberately unspecified pending parity with the approved Golden logic.
// Do not infer LONG/SHORT or reverse positions from this module.
