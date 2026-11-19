// This module does not make decisions, place orders or invent fills.
export function reconcileOrder({intent, submission, exchangeOrder, positions}) {
  if (!intent?.symbol || !intent?.side || !intent?.quantity) throw new Error('Incomplete strategy intent');
  if (!submission?.orderId || !exchangeOrder || String(exchangeOrder.orderId)!==String(submission.orderId) || exchangeOrder.symbol!==intent.symbol) return {confirmed:false,reason:'ORDER_NOT_CONFIRMED'};
  const status=exchangeOrder.status;
  const filled=Number(exchangeOrder.executedQty);
  const requested=Number(intent.quantity);
  if (!Number.isFinite(filled) || filled<0 || !Number.isFinite(requested) || requested<=0) return {confirmed:false,reason:'INVALID_EXCHANGE_QUANTITY'};
  if (!['FILLED','PARTIALLY_FILLED'].includes(status) || filled===0) return {confirmed:false,reason:'NO_CONFIRMED_FILL',status};
  const position=positions?.find(p=>p.symbol===intent.symbol && (intent.positionSide ? p.positionSide===intent.positionSide : true));
  if (!position) return {confirmed:false,reason:'POSITION_RECONCILIATION_PENDING',status,filled};
  const positionAmt=Number(position.positionAmt);
  const entryPrice=Number(position.entryPrice);
  if (!Number.isFinite(positionAmt) || !Number.isFinite(entryPrice)) return {confirmed:false,reason:'INVALID_EXCHANGE_POSITION',status,filled};
  if (intent.action !== 'CLOSE' && ((intent.side === 'BUY' && positionAmt <= 0) || (intent.side === 'SELL' && positionAmt >= 0))) return {confirmed:false,reason:'POSITION_DIRECTION_MISMATCH',status,filled};
  return {confirmed:true,status,filled,requested,orderId:exchangeOrder.orderId,positionAmt,entryPrice};
}
