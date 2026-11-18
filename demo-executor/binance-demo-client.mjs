import { createHmac } from 'node:crypto';

// Transport only. No strategy decisions or automatic order placement.
const DEFAULT_BASE = 'https://demo-fapi.binance.com';
export class BinanceDemoClient {
  constructor({ apiKey, apiSecret, baseUrl = DEFAULT_BASE, fetchImpl = fetch }) {
    if (!apiKey || !apiSecret) throw new Error('Binance Demo credentials required');
    const base = new URL(baseUrl);
    if (base.protocol !== 'https:' || base.hostname !== 'demo-fapi.binance.com' || base.port || base.username || base.password || base.pathname !== '/') throw new Error('Demo host only');
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = base.origin;
    this.fetchImpl = fetchImpl;
  }
  async request(method, path, params = {}, signed = true) {
    if (!['GET', 'POST', 'DELETE'].includes(method)) throw new Error('Unsupported method');
    if (!/^\/fapi\/v1\/[A-Za-z]+$/.test(path)) throw new Error('Unsupported path');
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null) query.set(key, String(value));
    if (signed) {
      query.set('timestamp', String(Date.now()));
      query.set('recvWindow', '5000');
      query.set('signature', createHmac('sha256', this.apiSecret).update(query.toString()).digest('hex'));
    }
    const url = `${this.baseUrl}${path}?${query}`;
    const response = await this.fetchImpl(url, { method, headers: { 'X-MBX-APIKEY': this.apiKey }, signal: AbortSignal.timeout(10000) });
    const body = await response.json();
    if (!response.ok) throw new Error(`Binance Demo HTTP ${response.status}: ${JSON.stringify(body).slice(0,300)}`);
    return body;
  }
  exchangeInfo() { return this.request('GET','/fapi/v1/exchangeInfo',{},false); }
  positions() { return this.request('GET','/fapi/v1/positionRisk'); }
  incomeHistory(params = {}) { return this.request('GET','/fapi/v1/income',params); }
  openOrders(symbol) { return this.request('GET','/fapi/v1/openOrders',symbol ? {symbol} : {}); }
  orderStatus(symbol, orderId) { return this.request('GET','/fapi/v1/order',{symbol,orderId}); }
  submitOrder(params) { return this.request('POST','/fapi/v1/order',params); }
  cancelOrder(symbol, orderId) { return this.request('DELETE','/fapi/v1/order',{symbol,orderId}); }
}
