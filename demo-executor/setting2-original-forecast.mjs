// Direct port of original Setting2 applyForecast. Read-only, no exchange orders.
export function applySetting2Forecast(base, hourly, fourHour, price, scalper = false) {
  const tfDir = (v) => v.side,
    dirs = [base.side, hourly.side, fourHour.side],
    bull = dirs.filter((d) => d === "LONG").length,
    bear = dirs.filter((d) => d === "SHORT").length;
  const hRet3 = hourly.closes.length > 3 ? hourly.closes .at(-1) / hourly.closes .at(-4) - 1 : 0,
    hRet12 = hourly.closes.length > 12 ? hourly.closes .at(-1) / hourly.closes .at(-13) - 1 : 0,
    hTrend = hourly.ema9 / hourly.ema21 - 1,
    hMacd = hourly.histogram / Math.max(price, 1e-12),
    hVol = hourly.volumeRatio;
  const fTrend = fourHour.ema9 / fourHour.ema21 - 1;
  const raw = hTrend * 0.3 + hRet3 * 0.18 + hRet12 * 0.17 + hMacd * 0.15 + fTrend * 0.2;
  const forecastChange = Math.max(-0.04, Math.min(0.04, raw)),
    direction = forecastChange >= 0 ? "LONG" : "SHORT",
    alignment = direction === "LONG" ? bull : bear,
    conflict = direction === "LONG" ? bear : bull;
  const momentumScore = Math.min(1, Math.abs(forecastChange) / 0.01),
    forecastProbability = Math.round(
      Math.min(
        94,
        50 +
          momentumScore * 22 +
          alignment * 6 -
          conflict * 3 +
          (hVol > 1.2 ? 3 : 0) +
          (hourly.adx > 25 ? 3 : 0),
      ),
    );
  const forecastConfidence = Math.round(
    Math.min(
      94,
      52 + alignment * 10 - conflict * 4 + (hourly.adx > 25 ? 7 : 0) + (hVol > 1.15 ? 4 : 0),
    ),
  );
  const side = forecastProbability >= (scalper ? 50 : 62) && alignment >= (scalper ? 1 : 2) ? direction : "WAIT";
  const atr = Math.max(hourly.atr, price * 0.0018),
    stopDistance = Math.max(atr * 2.0, price * 0.004),
    rewardDistance = Math.max(stopDistance * 2.0, Math.abs(forecastChange * price) * 1.25);
  let takeProfit =
    side === "LONG" ? price + rewardDistance : side === "SHORT" ? price - rewardDistance : price;
  const resistance = fourHour.high,
    support = fourHour.low;
  if (side === "LONG" && resistance > price + stopDistance * 1.5 && resistance < takeProfit)
    takeProfit = resistance * 0.998;
  if (side === "SHORT" && support < price - stopDistance * 1.5 && support > takeProfit)
    takeProfit = support * 1.002;
  const stop =
      side === "LONG" ? price - stopDistance : side === "SHORT" ? price + stopDistance : price,
    target1 =
      side === "LONG"
        ? price + stopDistance * 1.5
        : side === "SHORT"
          ? price - stopDistance * 1.5
          : price,
    takeProfitPct = side === "WAIT" ? 0 : Math.abs(takeProfit / price - 1) * 100,
    rr = side === "WAIT" ? 0 : takeProfitPct / ((stopDistance / price) * 100),
    quality =
      side === "WAIT"
        ? 0
        : Math.min(
            100,
            forecastProbability * 0.55 +
              forecastConfidence * 0.2 +
              Math.min(100, (rr / 2) * 100) * 0.15 +
              (alignment / 3) * 10,
          );
  return {
    ...base,
    side,
    forecastPrice: price * (1 + forecastChange),
    forecastChange: forecastChange * 100,
    forecastProbability,
    forecastConfidence,
    takeProfit,
    takeProfitPct,
    opportunityScore: Math.round(quality),
    probability: forecastProbability,
    score: Math.round(quality),
    stop,
    target1,
    target2: takeProfit,
  };
}
