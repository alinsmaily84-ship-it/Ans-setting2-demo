// Direct port of original Setting2 ema() and calc() from app/src/routes/index.tsx.
// Read-only indicators. No orders or SL changes.
function ema(a, p) {
  const k = 2 / (p + 1);
  let v = a[0] || 0;
  for (let i = 1; i < a.length; i++) v = a[i] * k + v * (1 - k);
  return v;
}
export function calcSetting2Indicators(rows, tf) {
  const completed = rows.filter((r) => Number(r[6]) < Date.now());
  // Real, completed candles only; some fallback venues return fewer than requested.
  const candles = (completed.length >= 30 ? completed : rows)
    .filter(r=>Number.isFinite(+r[0]) && +r[4]>0)
    .sort((a,b)=>Number(a[0])-Number(b[0]))
    .filter((r,i,a)=>i===0 || +r[0]!==+a[i-1][0]);
  const c = candles.map((r) => +r[4]),
    h = candles.map((r) => +r[2]),
    l = candles.map((r) => +r[3]),
    vol = candles.map((r) => +r[5]);
  if (c.length < 30) return null;
  const dif = c.slice(1).map((v, i) => v - c[i]),
    g = dif.slice(-14).map((v) => Math.max(v, 0)),
    loss = dif.slice(-14).map((v) => Math.max(-v, 0)),
    ag = g.reduce((a, b) => a + b, 0) / 14,
    al = loss.reduce((a, b) => a + b, 0) / 14,
    rsi = al === 0 ? 100 : 100 - 100 / (1 + ag / al),
    tr = h
      .slice(1)
      .map((v, i) =>
        Math.max(h[i + 1] - l[i + 1], Math.abs(h[i + 1] - c[i]), Math.abs(l[i + 1] - c[i])),
      ),
    atr = tr.slice(-14).reduce((a, b) => a + b, 0) / 14,
    fast = ema(c.slice(-50), 9),
    mid = ema(c.slice(-50), 21),
    slow = ema(c.slice(-70), 50),
    macdLine = ema(c.slice(-35), 12) - ema(c.slice(-35), 26),
    macdSeries = c
      .slice(-35)
      .map(
        (_, i) => ema(c.slice(0, c.length - 34 + i), 12) - ema(c.slice(0, c.length - 34 + i), 26),
      ),
    sig = ema(macdSeries.slice(-9), 9),
    hist = macdLine - sig,
    mean = c.slice(-20).reduce((a, b) => a + b, 0) / 20,
    sd = Math.sqrt(c.slice(-20).reduce((a, b) => a + (b - mean) ** 2, 0) / 20),
    last = c[c.length - 1],
    vAvg = vol.slice(-21, -1).reduce((a, b) => a + b, 0) / 20,
    vr = vAvg ? vol[vol.length - 1] / vAvg : 1,
    upper = mean + 2 * sd,
    lower = mean - 2 * sd,
    typ = h.map((v, i) => (v + l[i] + c[i]) / 3),
    tp = typ.slice(-20),
    tpMean = tp.reduce((a, b) => a + b, 0) / 20,
    md = tp.reduce((a, b) => a + Math.abs(b - tpMean), 0) / 20,
    cci = md ? (typ[typ.length - 1] - tpMean) / (0.015 * md) : 0,
    hh = Math.max(...h.slice(-14)),
    ll = Math.min(...l.slice(-14)),
    stoch = hh === ll ? 50 : ((last - ll) / (hh - ll)) * 100,
    // Wilder directional movement and smoothed true range (ADX 14).
    plus = h.slice(1).map((v, i) => {
      const up = v - h[i], down = l[i] - l[i + 1];
      return up > down && up > 0 ? up : 0;
    }),
    minus = l.slice(1).map((v, i) => {
      const up = h[i + 1] - h[i], down = v - l[i + 1];
      return down > up && down > 0 ? down : 0;
    }),
    smoothWilder = (arr) => {
      let sum = arr.slice(0, 14).reduce((a, b) => a + b, 0);
      const out = [sum];
      for (let i = 14; i < arr.length; i++) {
        sum = sum - sum / 14 + arr[i];
        out.push(sum);
      }
      return out;
    },
    trSmoothed = smoothWilder(tr),
    plusSmoothed = smoothWilder(plus),
    minusSmoothed = smoothWilder(minus),
    dx = trSmoothed.map((range, i) => {
      const pdi = range > 0 ? 100 * plusSmoothed[i] / range : 0;
      const mdi = range > 0 ? 100 * minusSmoothed[i] / range : 0;
      return pdi + mdi > 0 ? 100 * Math.abs(pdi - mdi) / (pdi + mdi) : 0;
    }),
    adx = dx.length >= 14 ? (() => {
      let value = dx.slice(0, 14).reduce((a, b) => a + b, 0) / 14;
      for (let i = 14; i < dx.length; i++) value = (value * 13 + dx[i]) / 14;
      return value;
    })() : 0,
    typVol = typ.map((v, i) => v * vol[i]),
    vwap =
      typVol.slice(-20).reduce((a, b) => a + b, 0) /
      Math.max(
        1,
        vol.slice(-20).reduce((a, b) => a + b, 0),
      ),
    obv = vol.slice(1).reduce((a, v, i) =>
      a + (c[i + 1] > c[i] ? v : c[i + 1] < c[i] ? -v : 0), 0),
    momentum = last / c[c.length - 5] - 1,
    trendUp = fast > mid && mid > slow,
    trendDown = fast < mid && mid < slow;
  let long = 0,
    short = 0;
  long += trendUp ? 18 : 0;
  short += trendDown ? 18 : 0;
  long += last > slow ? 9 : 0;
  short += last < slow ? 9 : 0;
  long += rsi > 52 && rsi < 70 ? 10 : rsi >= 70 ? 2 : 0;
  short += rsi < 48 && rsi > 30 ? 10 : rsi <= 30 ? 2 : 0;
  long += hist > 0 ? 10 : 0;
  short += hist < 0 ? 10 : 0;
  long += last > vwap ? 7 : 0;
  short += last < vwap ? 7 : 0;
  long += cci > 0 ? 6 : 0;
  short += cci < 0 ? 6 : 0;
  long += stoch > 55 && stoch < 85 ? 5 : 0;
  short += stoch < 45 && stoch > 15 ? 5 : 0;
  long += momentum > 0 ? 8 : 0;
  short += momentum < 0 ? 8 : 0;
  long += obv > 0 ? 5 : 0;
  short += obv < 0 ? 5 : 0;
  long += vr > 1.15 && last > c[c.length - 2] ? 7 : 0;
  short += vr > 1.15 && last < c[c.length - 2] ? 7 : 0;
  long += last > mean && last < upper ? 5 : 0;
  short += last < mean && last > lower ? 5 : 0;
  long += adx > 20 && trendUp ? 5 : 0;
  short += adx > 20 && trendDown ? 5 : 0;
  const side = long >= short + 8 ? "LONG" : short >= long + 8 ? "SHORT" : "WAIT",
    score = Math.max(long, short),
    probability = Math.round(
      Math.min(
        95,
        Math.max(50, 50 + Math.abs(long - short) * 0.55 + (adx > 25 ? 4 : 0) + (vr > 1.2 ? 2 : 0)),
      ),
    );
  return {
    symbol: "",
    side,
    price: last,
    stop: last,
    target1: last,
    target2: last,
    rsi,
    funding: 0,
    change: 0,
    score,
    probability,
    longScore: Math.min(100, long),
    shortScore: Math.min(100, short),
    // Preserve a full hour of completed 1m candles for the hourly momentum
    // scanner; 35 closes made its 61-candle requirement impossible.
    closes: c.slice(-100),
    ema9: fast,
    ema21: mid,
    ema50: slow,
    atr,
    macd: macdLine,
    signalLine: sig,
    histogram: hist,
    upper,
    lower,
    volumeRatio: vr,
    high: Math.max(...h.slice(-20)),
    low: Math.min(...l.slice(-20)),
    timeframe: tf,
    adx,
    stoch,
    cci,
    vwap,
    obvTrend: obv,
    longShortRatio: 1,
    takerRatio: 1,
    openInterestChange: 0,
    bookImbalance: 0,
    forecastPrice: last,
    forecastChange: 0,
    forecastProbability: probability,
    forecastConfidence: 50,
    takeProfit: last,
    takeProfitPct: 0,
    opportunityScore: score,
    speedScore: Math.abs(momentum) * 100,
  };
}
