// Exchange validation only: never alter a strategy's requested order silently.
function decimalPlaces(value) { const s = String(value).toLowerCase(); if (s.includes('e-')) return Number(s.split('e-')[1]); return (s.split('.')[1] || '').length; }
function scaled(value, places) { return BigInt(Math.round(Number(value) * 10 ** places)); }
export function validateDemoOrder({ symbol, quantity, price, notional, exchangeInfo, orderType = 'MARKET' }) {
  const market = exchangeInfo?.symbols?.find(s => s.symbol === symbol && s.status === 'TRADING');
  if (!market) return { ok:false, reason:'SYMBOL_NOT_TRADING' };
  const lot = market.filters.find(f => f.filterType === (orderType === 'MARKET' ? 'MARKET_LOT_SIZE' : 'LOT_SIZE')) || market.filters.find(f => f.filterType === 'LOT_SIZE');
  if (!lot) return {ok:false,reason:'MISSING_LOT_FILTER'};
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) return {ok:false,reason:'INVALID_QUANTITY'};
  const places = Math.max(decimalPlaces(lot.stepSize),decimalPlaces(lot.minQty),decimalPlaces(quantity));
  const q = scaled(quantity,places), step = scaled(lot.stepSize,places), min = scaled(lot.minQty,places), max = scaled(lot.maxQty,places);
  if (step <= 0n || q < min || q > max || q%step !== 0n) return {ok:false,reason:'LOT_SIZE_MISMATCH'};
  const minimum = market.filters.find(f => f.filterType === 'MIN_NOTIONAL')?.notional;
  const value = Number.isFinite(Number(notional)) ? Number(notional) : qty * Number(price);
  if (!Number.isFinite(value) || value <= 0) return {ok:false,reason:'INVALID_NOTIONAL'};
  if (minimum && value < Number(minimum)) return {ok:false,reason:'MIN_NOTIONAL_MISMATCH'};
  return {ok:true,quantity:String(quantity),notional:value};
}
