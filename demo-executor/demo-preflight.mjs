#!/usr/bin/env node
// Read-only readiness check for manual Binance Futures Demo execution.
// Never submits or cancels orders and never prints API credentials.
import { BinanceDemoClient } from './binance-demo-client.mjs';

const required=['BINANCE_DEMO_API_KEY','BINANCE_DEMO_API_SECRET'];
const missing=required.filter(k=>!process.env[k]);
if(missing.length){
  console.log(JSON.stringify({ready:false,environment:'BINANCE_FUTURES_DEMO',
    missingVariableNames:missing,reason:'DEMO_CREDENTIALS_MISSING'},null,2));
  process.exitCode=1;
} else {
  try {
    const client=new BinanceDemoClient({
      apiKey:process.env.BINANCE_DEMO_API_KEY,
      apiSecret:process.env.BINANCE_DEMO_API_SECRET
    });
    const [exchange,positions,orders]=await Promise.all([
      client.exchangeInfo(),client.positions(),client.openOrders()
    ]);
    if(!Array.isArray(exchange?.symbols)||!Array.isArray(positions)||!Array.isArray(orders))
      throw new Error('Unexpected exchange response');
    const hedgePositions=positions.filter(p=>Number(p.positionAmt)!==0 && p.positionSide && p.positionSide!=='BOTH');
    const active=positions.filter(p=>Number(p.positionAmt)!==0);
    const manualEnabled=process.env.ANS_DEMO_MANUAL_TRADING==='YES';
    const ready=manualEnabled && hedgePositions.length===0;
    console.log(JSON.stringify({
      environment:'BINANCE_FUTURES_DEMO',ready,
      demoAuthenticated:true,tradableSymbols:exchange.symbols.filter(s=>s.status==='TRADING').length,
      openPositionCount:active.length,openOrderCount:orders.length,
      manualTradingEnabled:manualEnabled,
      unsupportedHedgePositionCount:hedgePositions.length,
      reason:!manualEnabled?'MANUAL_TRADING_DISABLED':hedgePositions.length?'HEDGE_MODE_POSITION_PRESENT':null,
      note:'Read-only checks do not prove order permissions or execution success.'
    },null,2));
    if(!ready) process.exitCode=1;
  } catch(e) {
    console.error(JSON.stringify({environment:'BINANCE_FUTURES_DEMO',ready:false,
      reason:'DEMO_READINESS_FAILED',detail:String(e.message).slice(0,300)},null,2));
    process.exitCode=1;
  }
}
