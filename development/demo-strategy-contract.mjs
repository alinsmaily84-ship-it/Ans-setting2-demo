// ANS V2 Demo strategy contract — isolated development module.
// No orders, network access, timers, or Live endpoints. Not wired into deployment.
// Do not import the archived Guardian as an execution authority.
export const demoStrategy = Object.freeze({
  venue: "BINANCE_FUTURES_DEMO",
  capitalReferenceUsdt: 500,
  probeNotionalUsdt: 7,
  targetNotionalUsdt: 2000,
  targetLeverage: 20,
  concurrentPositions: 5,
  firstDecisionSeconds: 30,
  staleProbeReviewSeconds: 60,
  rankingWindowMinutes: 15,
  profitProtectionArmUsdt: 0.10,
  stopLossPrimaryUsdt: 5,
  stopLossBackupUsdt: 10,
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

// Strategy direction is decided from current observations, not remembered direction.
// This is a decision preview, not an order or a position reversal implementation.
export function currentDirection({m1, m5, m15, m60}) {
  if (![m1,m5,m15,m60].every(Number.isFinite)) throw new Error("INVALID_MOMENTUM");
  const vote = m1 * 0.5 + m5 * 0.25 + m15 * 0.15 + m60 * 0.10;
  return { side: vote > 0 ? "LONG" : vote < 0 ? "SHORT" : null, vote };
}
