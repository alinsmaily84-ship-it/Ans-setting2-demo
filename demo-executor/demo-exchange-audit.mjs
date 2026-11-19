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
  // Hedge-mode legs require matching positionSide; a stop for the other leg is not protection.
  const leg=position.positionSide || 'BOTH';
  if (!['BOTH','LONG','SHORT'].includes(leg) ||
      (leg==='LONG' && qty<0) || (leg==='SHORT' && qty>0))
    return {symbol,positionOpen:true,protected:false,reason:'POSITION_LEG_INCONSISTENT'};
  const expectedSide=qty>0?'SELL':'BUY';
  if (expectedStopSide!==expectedSide)
    return {symbol,positionOpen:true,protected:false,reason:'STOP_SIDE_MISMATCH'};
  const active=algoOrders.filter(o=>
    o.symbol===symbol &&
    o.side===expectedSide &&
    (o.positionSide||'BOTH')===leg &&
    ['NEW','WORKING','PENDING'].includes(String(o.algoStatus||o.status||'').toUpperCase()) &&
    (o.orderType||o.type)==='STOP_MARKET' &&
    (o.closePosition===true||o.closePosition==='true') &&
    (o.workingType==='MARK_PRICE') &&
    Number.isFinite(Number(o.triggerPrice||o.stopPrice)) &&
    Number(o.triggerPrice||o.stopPrice)>0
  );
  // A more protective stop (higher for LONG, lower for SHORT) is acceptable.
  // Reject looser stops; tolerate only exchange floating-point representation noise.
  const tolerance=Math.max(1e-8,expectedStopTrigger*1e-8);
  const matched=active.find(o=>{
    const trigger=Number(o.triggerPrice||o.stopPrice);
    return expectedSide==='SELL' ? trigger>=expectedStopTrigger-tolerance : trigger<=expectedStopTrigger+tolerance;
  });
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
  const invalidPositions=positions.filter(p=>!Number.isFinite(Number(p.positionAmt)));
  if (invalidPositions.length) throw new Error('POSITION_QTY_INVALID');
  const open=positions.filter(p=>Number(p.positionAmt)!==0);
  return {openPositionCount:open.length,withinLimit:open.length<=maxConcurrentPositions,
    openSymbols:[...new Set(open.map(p=>p.symbol))],executionEnabled:false};
}
