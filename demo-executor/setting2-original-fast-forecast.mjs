// Direct port of original Setting2 applyFastForecast from app/src/routes/index.tsx.
// Read-only forecast; no orders.
export function applySetting2FastForecast(base, minute, five, hourly, price) {
  const m1 = minute.closes;
  const m5 = five.closes;
  const impulse = m1.length > 3 ? (m1.at(-1) / m1.at(-4) - 1) * 100 : 0;
  const fiveTrend = m5.length > 2 ? (m5.at(-1) / m5.at(-3) - 1) * 100 : 0;
  const change = Math.max(-1.5, Math.min(1.5, impulse * 0.65 + fiveTrend * 0.35));
  const side = change > 0.035 ? "LONG" : change < -0.035 ? "SHORT" : "WAIT";
  // Candle scores may be WAIT while the actual EMA/momentum agrees with the move.
  const minuteAligned = side === "LONG" ? minute.ema9 > minute.ema21 : side === "SHORT" ? minute.ema9 < minute.ema21 : false;
  const fiveAligned = side === "LONG" ? five.ema9 > five.ema21 : side === "SHORT" ? five.ema9 < five.ema21 : false;
  const aligned = side !== "WAIT" && minuteAligned && fiveAligned;
  const higherConflict = side !== "WAIT" && hourly.adx >= 30 &&
    (side === "LONG" ? hourly.ema9 < hourly.ema21 : hourly.ema9 > hourly.ema21);
  const costs = 2 * (base.executionCostPct ?? 0.08) + 0.10;
  const expected = Math.abs(change);
  const eligible = aligned && !higherConflict && expected >= costs * 1.5 && minute.volumeRatio >= 0.65 && five.adx >= 12;
  const stopDistance = Math.max(minute.atr * 1.4, price * 0.0015);
  const targetDistance = Math.max(stopDistance * 1.6, price * expected / 100);
  const quality = eligible ? Math.min(94, Math.round(58 + Math.min(18, expected * 25) + Math.min(10, five.adx / 4) + Math.min(8, minute.volumeRatio * 3))) : 0;
  const direction = eligible ? side : "WAIT";
  return { ...base, side: direction, timeframe: "1m + 5m + 1h", forecastChange: change,
    forecastPrice: price * (1 + change / 100), forecastProbability: quality,
    forecastConfidence: quality, opportunityScore: quality, score: quality,
    stop: direction === "LONG" ? price - stopDistance : direction === "SHORT" ? price + stopDistance : price,
    takeProfit: direction === "LONG" ? price + targetDistance : direction === "SHORT" ? price - targetDistance : price,
    target1: direction === "LONG" ? price + targetDistance : direction === "SHORT" ? price - targetDistance : price,
    target2: direction === "LONG" ? price + targetDistance : direction === "SHORT" ? price - targetDistance : price,
    takeProfitPct: direction === "WAIT" ? 0 : targetDistance / price * 100,
  };
}
