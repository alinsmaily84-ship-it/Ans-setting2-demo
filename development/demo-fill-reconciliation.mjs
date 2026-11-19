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
