// Pure Binance Futures Demo reconciliation: read-only snapshots only.
// This does not call Binance, submit orders, or authorize trading.
// Binance conditional orders may appear in the Algo Order API, not regular openOrders.
export function auditDemoPositionProtection({symbol, position, algoOrders, expectedStopSide, expectedStopTrigger}) {
  if (!/^[A-Z0-9]+USDT$/.test(symbol || "") || !position ||
      !Array.isArray(algoOrders) || !['BUY','SELL'].includes(expectedStopSide) ||
      !Number.isFinite(expectedStopTrigger) || expectedStopTrigger<=0)
    throw new Error('PROTECTION_AUDIT_INPUT_INVALID');
  const qty=Number(position.positionAmt);
  if (!Number.isFinite(qty)) throw new Error('POSITION_QTY_INVALID');
  if (qty===0) return {symbol,positionOpen:false,protected:null,reason:'NO_OPEN_POSITION'};
  const expectedSide=qty>0?'SELL':'BUY';
  if (expectedStopSide!==expectedSide)
    return {symbol,positionOpen:true,protected:false,reason:'STOP_SIDE_MISMATCH'};
  const active=algoOrders.filter(o=>
    o.symbol===symbol &&
    o.side===expectedSide &&
    ['NEW','WORKING','PENDING'].includes(String(o.algoStatus||o.status||'').toUpperCase()) &&
    (o.orderType||o.type)==='STOP_MARKET' &&
    (o.closePosition===true||o.closePosition==='true') &&
    Number.isFinite(Number(o.triggerPrice||o.stopPrice)) &&
    Number(o.triggerPrice||o.stopPrice)>0
  );
  const matched=active.find(o=>Math.abs(Number(o.triggerPrice||o.stopPrice)-expectedStopTrigger)<=Math.max(1e-8,expectedStopTrigger*1e-8));
  return {
    symbol,positionOpen:true,protected:Boolean(matched),
    reason:matched?'CONFIRMED_ACTIVE_STOP':'ACTIVE_STOP_NOT_CONFIRMED',
    stopOrderId:matched?String(matched.algoId||matched.orderId||''):null,
    activeStopCount:active.length,
    requiresManualReview:!matched
  };
}

export function auditDemoExposure({positions, maxConcurrentPositions=5}) {
  if (!Array.isArray(positions) || !Number.isSafeInteger(maxConcurrentPositions) || maxConcurrentPositions<1)
    throw new Error('EXPOSURE_AUDIT_INPUT_INVALID');
  const open=positions.filter(p=>Number.isFinite(Number(p.positionAmt)) && Number(p.positionAmt)!==0);
  return {openPositionCount:open.length,withinLimit:open.length<=maxConcurrentPositions,
    openSymbols:[...new Set(open.map(p=>p.symbol))],executionEnabled:false};
}
