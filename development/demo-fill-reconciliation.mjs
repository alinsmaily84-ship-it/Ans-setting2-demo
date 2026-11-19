// Read-only interpretation of a Binance Futures Demo market order response.
// Never place an order or infer a fill from an HTTP 200 alone.
export function reconcileDemoMarketFill({symbol,side,requestedQuantity,submitted,orderStatus,positions}) {
  if(!/^[A-Z0-9]+USDT$/.test(symbol||'') || !['BUY','SELL'].includes(side) ||
     !(Number(requestedQuantity)>0) || !Number.isFinite(Number(requestedQuantity)) ||
     !submitted || !orderStatus || !Array.isArray(positions))
    throw new Error('DEMO_FILL_INPUT_INVALID');
  const orderId=String(submitted.orderId||'');
  if(!/^[0-9]+$/.test(orderId) || String(orderStatus.orderId)!==orderId ||
     submitted.symbol!==symbol || orderStatus.symbol!==symbol || orderStatus.side!==side)
    return {confirmed:false,reason:'ORDER_IDENTITY_MISMATCH',ordersPlaced:0};
  const executed=Number(orderStatus.executedQty);
  const avgPrice=Number(orderStatus.avgPrice);
  if(orderStatus.status!=='FILLED' || !(executed>0) || !(avgPrice>0) ||
     !Number.isFinite(executed) || !Number.isFinite(avgPrice))
    return {confirmed:false,reason:'FILL_NOT_CONFIRMED',ordersPlaced:0};
  const matching=positions.filter(p=>p.symbol===symbol &&
    (!p.positionSide || p.positionSide==='BOTH') &&
    Number.isFinite(Number(p.positionAmt)) && Number(p.positionAmt)!==0);
  if(matching.length!==1)
    return {confirmed:false,reason:'POSITION_NOT_UNIQUELY_CONFIRMED',ordersPlaced:0};
  const position=matching[0],qty=Number(position.positionAmt);
  if((side==='BUY' && qty<=0)||(side==='SELL' && qty>=0))
    return {confirmed:false,reason:'POSITION_DIRECTION_MISMATCH',ordersPlaced:0};
  const entryPrice=Number(position.entryPrice);
  if(!Number.isFinite(entryPrice) || entryPrice<=0)
    return {confirmed:false,reason:'POSITION_ENTRY_PRICE_INVALID',ordersPlaced:0};
  // Position snapshots can include existing exposure; never assume this fill
  // was the sole contributor without separate before/after reconciliation.
  return {confirmed:true,reason:'FILL_AND_DIRECTION_OBSERVED',
    symbol,orderId,executedQty:executed,avgPrice,
    positionQty:qty,positionEntryPrice:entryPrice,
    requiresPositionDeltaReconciliation:true,
    exchangeProtectionConfirmed:false,ordersPlaced:0};
}


// Verify that the observed position change agrees with the exchange-confirmed fill.
// This is mandatory before treating a fill as a new protected exposure.
export function reconcileDemoPositionDelta({symbol,side,executedQty,beforePositions,afterPositions,stepSize}) {
  if(!/^[A-Z0-9]+USDT$/.test(symbol||'') || !['BUY','SELL'].includes(side) ||
     !Number.isFinite(Number(executedQty)) || !(Number(executedQty)>0) ||
     !Number.isFinite(Number(stepSize)) || !(Number(stepSize)>0) ||
     !Array.isArray(beforePositions) || !Array.isArray(afterPositions))
    throw new Error('DEMO_POSITION_DELTA_INPUT_INVALID');
  const quantity=(positions)=>{
    const matching=positions.filter(p=>p?.symbol===symbol &&
      (!p.positionSide || p.positionSide==='BOTH'));
    if(matching.length>1)return null;
    if(matching.length===0)return 0;
    const value=Number(matching[0].positionAmt);
    return Number.isFinite(value)?value:null;
  };
  const before=quantity(beforePositions),after=quantity(afterPositions);
  if(before===null || after===null)
    return {confirmed:false,reason:'POSITION_SNAPSHOT_AMBIGUOUS'};
  const expected=(side==='BUY'?1:-1)*Number(executedQty);
  const observed=after-before;
  // Account for Binance quantity precision without accepting a materially
  // different change caused by another order or stale snapshot.
  const tolerance=Math.max(Number(stepSize)*0.51,Math.abs(expected)*1e-8);
  if(Math.abs(observed-expected)>tolerance)
    return {confirmed:false,reason:'POSITION_DELTA_MISMATCH',expectedDelta:expected,observedDelta:observed};
  return {confirmed:true,reason:'POSITION_DELTA_CONFIRMED',
    beforeQty:before,afterQty:after,observedDelta:observed,
    exchangeProtectionConfirmed:false};
}
