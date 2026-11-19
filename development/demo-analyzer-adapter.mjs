// Read-only adapter between the recovered Demo analyzer /rank response and a future Demo engine.
// Does not fetch, place orders, open positions, or authorize execution.
import { demoStrategy } from "./demo-strategy-contract.mjs";

export function selectDemoCandidates(payload, { nowMs = Date.now(), maxAgeMs = 90_000 } = {}) {
  if (!payload || !Array.isArray(payload.ranked)) throw new Error("ANALYZER_PAYLOAD_INVALID");
  const observedAt = Date.parse(payload.updatedAt);
  if (!Number.isFinite(observedAt) || !Number.isFinite(nowMs) || nowMs - observedAt > maxAgeMs || observedAt > nowMs + 5000 || payload.stale === true)
    throw new Error("ANALYZER_DATA_STALE");
  if (payload.errors > 0 && payload.ranked.length === 0) throw new Error("ANALYZER_NO_VALID_RESULTS");
  const seen = new Set();
  const ranked = [];
  for (const item of payload.ranked) {
    if (!item || !/^[A-Z0-9]{5,25}USDT$/.test(item.symbol || "") || seen.has(item.symbol)) continue;
    if (!["LONG","SHORT"].includes(item.side)) continue;
    if (![item.price,item.m1,item.m5,item.m15,item.m60,item.speed15m].every(Number.isFinite) || item.price <= 0 || item.speed15m < 0) continue;
    const calculatedSpeed = Math.abs(item.m15) / demoStrategy.rankingWindowMinutes;
    if (Math.abs(item.speed15m - calculatedSpeed) > 1e-5) continue;
    seen.add(item.symbol);
    ranked.push({
      symbol: item.symbol,
      sidePreview: item.side, // archived analyzer's existing momentary vote; not an execution instruction
      speed15m: calculatedSpeed,
      momentum: { m1: item.m1, m5: item.m5, m15: item.m15, m60: item.m60 },
      observedAt: payload.updatedAt
    });
  }
  ranked.sort((a,b) => b.speed15m - a.speed15m || a.symbol.localeCompare(b.symbol));
  return { venue: demoStrategy.venue, executionEnabled: false, candidates: ranked, observedAt: payload.updatedAt };
}
