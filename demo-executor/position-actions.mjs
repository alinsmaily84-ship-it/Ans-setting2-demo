import { prepareDemoIntent } from './intent-adapter.mjs';

// Isolated execution primitive for already-approved Setting2 decisions.
// No signal generation, no automatic activation, and no Live endpoint.
export class DemoPositionActions {
  constructor({client, exchangeInfo, enabled = false}) {
    if (!client || !exchangeInfo) throw new Error('Demo client and exchange info required');
    this.client = client;
    this.exchangeInfo = exchangeInfo;
    this.enabled = enabled === true;
    this.inFlight = new Set();
  }

  async execute(decision) {
    if (!this.enabled) return {ok:false, reason:'EXECUTION_DISABLED'};
    if (!decision || !['ADD','CLOSE'].includes(decision.action))
      return {ok:false, reason:'INVALID_ACTION'};
    const id = decision.id;
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,32}$/.test(id))
      return {ok:false, reason:'INVALID_DECISION_ID'};
    if (this.inFlight.has(id)) return {ok:false, reason:'DECISION_IN_FLIGHT'};
    this.inFlight.add(id);
    try {
      const prepared = prepareDemoIntent(decision, this.exchangeInfo);
      if (!prepared.ok) return prepared;
      const positions = await this.client.positions();
      if (!Array.isArray(positions)) throw new Error('Position reconciliation unavailable');
      const p = positions.find(p => p.symbol === decision.symbol && Number(p.positionAmt) !== 0);
      if (!p) return {ok:false,reason:'NO_EXCHANGE_POSITION'};
      const amt = Number(p.positionAmt);
      if ((decision.side === 'LONG' && amt <= 0) || (decision.side === 'SHORT' && amt >= 0))
        return {ok:false,reason:'POSITION_DIRECTION_MISMATCH'};
      const qty = Number(prepared.order.quantity);
      if (decision.action === 'CLOSE' && qty > Math.abs(amt) + 1e-10)
        return {ok:false,reason:'CLOSE_EXCEEDS_POSITION'};
      // This path deliberately supports one-way mode only; hedge mode needs explicit positionSide.
      if (p.positionSide && p.positionSide !== 'BOTH')
        return {ok:false,reason:'HEDGE_MODE_NOT_SUPPORTED'};
      const order = await this.client.submitOrder({
        ...prepared.order,
        ...(decision.action === 'CLOSE' ? {reduceOnly:'true'} : {}),
        newClientOrderId:`s2_${id}`
      });
      if (!order?.orderId) throw new Error('No exchange order ID');
      const status = await this.client.orderStatus(decision.symbol, order.orderId);
      const after = await this.client.positions();
      const post = Array.isArray(after) ? after.find(x=>x.symbol===decision.symbol && (!x.positionSide || x.positionSide==='BOTH')) : null;
      const postAmt = Number(post?.positionAmt ?? 0);
      const confirmed = status?.status === 'FILLED' &&
        (decision.action === 'CLOSE' ? Math.abs(postAmt) < Math.abs(amt) : Math.abs(postAmt) > Math.abs(amt));
      return {ok:confirmed,reason:confirmed?null:'FILL_OR_POSITION_UNCONFIRMED',
        decisionId:id,orderId:order.orderId,status:status?.status??'UNKNOWN',
        beforePositionAmt:amt,afterPositionAmt:postAmt};
    } finally {
      this.inFlight.delete(id);
    }
  }
}
