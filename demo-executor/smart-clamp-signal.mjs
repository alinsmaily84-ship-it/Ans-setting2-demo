// ANS Smart Clamp: price is the moving indicator; the strategy supplies the protection level.
// Signal only: order dispatch and exchange fill verification are separate.
// The existing stop-loss is not modified by this module.
export function smartClampSignal({side, price, clampPrice, previousPrice, previousClampPrice}) {
  if (!['LONG','SHORT'].includes(side)) throw new Error('INVALID_SIDE');
  for (const n of [price,clampPrice,previousPrice,previousClampPrice])
    if (!Number.isFinite(n) || n <= 0) throw new Error('INVALID_PRICE');
  const nextClamp = side === 'LONG'
    ? Math.max(previousClampPrice, clampPrice)
    : Math.min(previousClampPrice, clampPrice);
  // Crossing includes gaps: compare the previous price to the previously active level.
  // If already beyond the level, still signal closure rather than silently missing it.
  const touched = side === 'LONG' ? price <= nextClamp : price >= nextClamp;
  const crossed = side === 'LONG'
    ? previousPrice > previousClampPrice && touched
    : previousPrice < previousClampPrice && touched;
  return {indicatorPrice:price, clampPrice:nextClamp, touched, crossed,
    shouldClose:touched, reason:touched?'SMART_CLAMP_PRICE_TOUCH':null};
}
