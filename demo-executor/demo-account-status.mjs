#!/usr/bin/env node
// Read-only operator inspection for the isolated Setting2 Binance Futures Demo executor.
// Does not send, cancel, or modify any orders.
import { BinanceDemoClient } from './binance-demo-client.mjs';

const client = new BinanceDemoClient({
  apiKey:process.env.BINANCE_DEMO_API_KEY,
  apiSecret:process.env.BINANCE_DEMO_API_SECRET
});
const [positions, orders] = await Promise.all([client.positions(),client.openOrders()]);
if (!Array.isArray(positions) || !Array.isArray(orders)) throw new Error('Unexpected Demo account response');
const active = positions.filter(p=>Number(p.positionAmt)!==0).map(p=>({
  symbol:p.symbol,positionSide:p.positionSide??'BOTH',
  positionAmt:p.positionAmt,entryPrice:p.entryPrice,
  markPrice:p.markPrice,unRealizedProfit:p.unRealizedProfit,
  leverage:p.leverage
}));
console.log(JSON.stringify({
  environment:'BINANCE_FUTURES_DEMO',
  tradingEnabled:process.env.ANS_DEMO_MANUAL_TRADING==='YES',
  activePositionCount:active.length,activePositions:active,
  openOrderCount:orders.length,
  openOrders:orders.map(o=>({symbol:o.symbol,orderId:o.orderId,type:o.type,side:o.side,status:o.status,reduceOnly:o.reduceOnly}))
},null,2));
