import { validateDemoOrder } from './exchange-filters.mjs';
import { reconcileOrder } from './order-reconciliation.mjs';

// Execution adapter only: consumes an already-made Setting2 decision.
// Disabled by default. Does not invent or modify trading signals.
export class DemoOrderAdapter {
  constructor({client, enabled = false, exchangeInfo}) {
    if (!client) throw new Error('Demo client required');
    this.client = client;
    this.enabled = enabled === true;
    this.exchangeInfo = exchangeInfo;
    this.inFlight = new Set();
  }
  async executeEntry({decisionId, symbol, side, quantity, price}) {
    if (!this.enabled) return {ok:false,reason:'EXECUTION_DISABLED',decisionId};
    if (!/^[a-zA-Z0-9_-]{1,36}$/.test(decisionId || '')) return {ok:false,reason:'INVALID_DECISION_ID'};
    if (!['LONG','SHORT'].includes(side)) return {ok:false,reason:'INVALID_SIDE'};
    const check = validateDemoOrder({symbol,quantity,price,exchangeInfo:this.exchangeInfo});
    if (!check.ok) return {ok:false,reason:check.reason,decisionId};
    if (this.inFlight.has(decisionId)) return {ok:false,reason:'DECISION_IN_FLIGHT',decisionId};
    this.inFlight.add(decisionId);
    try {
    const existing = await this.client.positions();
    if (!Array.isArray(existing)) throw new Error('Position reconciliation unavailable');
    if (existing.some(p=>p.symbol===symbol && Number(p.positionAmt)!==0)) return {ok:false,reason:'EXISTING_EXCHANGE_POSITION',decisionId};
    const order = await this.client.submitOrder({symbol,side:side==='LONG'?'BUY':'SELL',type:'MARKET',quantity:check.quantity,newClientOrderId:`s2_${decisionId}`});
    if (!order?.orderId) throw new Error('Exchange did not acknowledge order ID');
    const status = await this.client.orderStatus(symbol,order.orderId);
    if (status?.status !== 'FILLED') return {ok:false,decisionId,orderId:order.orderId,status:status?.status||'UNKNOWN',executedQty:status?.executedQty??'0'};
    const positions = await this.client.positions();
    const result = reconcileOrder({intent:{symbol,side:side==='LONG'?'BUY':'SELL',quantity:check.quantity,action:'OPEN'},submission:order,exchangeOrder:status,positions});
    return {ok:result.confirmed,reason:result.reason??null,decisionId,orderId:order.orderId,status:status.status,executedQty:status.executedQty??'0',avgPrice:status.avgPrice??'0',positionAmt:result.positionAmt??null};
    } finally { this.inFlight.delete(decisionId); }
  }
}
