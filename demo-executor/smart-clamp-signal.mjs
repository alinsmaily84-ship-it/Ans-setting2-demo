// ANS Smart Clamp: signal logic only. No Binance orders are issued here.
// Price thresholds are supplied by the existing strategy; this module never invents them.
export function smartClampSignal({side, price, clampPrice, previousPrice, previousClampPrice}) {
  if (!['LONG','SHORT'].includes(side)) throw new Error('INVALID_SIDE');
  for (const n of [price,clampPrice,previousPrice,previousClampPrice])
    if (!Number.isFinite(n) || n <= 0) throw new Error('INVALID_PRICE');
  // One-way ratchet: LONG floor never falls; SHORT ceiling never rises.
  const nextClamp = side === 'LONG'
    ? Math.max(previousClampPrice, clampPrice)
    : Math.min(previousClampPrice, clampPrice);
  const reversing = side === 'LONG' ? price < previousPrice : price > previousPrice;
  const touched = side === 'LONG' ? price <= nextClamp : price >= nextClamp;
  return {clampPrice:nextClamp, reversing, touched, shouldClose:reversing && touched,
    reason:reversing && touched?'SMART_CLAMP_REVERSAL':null};
}
