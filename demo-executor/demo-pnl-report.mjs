#!/usr/bin/env node
// Read-only PnL report from Binance Futures DEMO.
// Configure ANS_PNL_SINCE=YYYY-MM-DD to select an earlier reporting start.
// Binance may limit how far back income history is available; totals cover only returned records.
import { BinanceDemoClient } from './binance-demo-client.mjs';

const client = new BinanceDemoClient({
  apiKey:process.env.BINANCE_DEMO_API_KEY,
  apiSecret:process.env.BINANCE_DEMO_API_SECRET
});
const now=Date.now();
const sinceString=process.env.ANS_PNL_SINCE;
if (sinceString && !/^\d{4}-\d{2}-\d{2}$/.test(sinceString))
  throw new Error('ANS_PNL_SINCE must be YYYY-MM-DD');
const since=sinceString?Date.parse(sinceString+'T00:00:00Z'):now-7*86400000;
if (!Number.isFinite(since)||since>now||now-since>90*86400000)
  throw new Error('Reporting range must be within last 90 days');
const [positions,orders]=await Promise.all([client.positions(),client.openOrders()]);
if (!Array.isArray(positions)||!Array.isArray(orders)) throw new Error('Account snapshot unavailable');
const active=positions.filter(p=>Number(p.positionAmt)!==0);
const floating=active.reduce((n,p)=>n+Number(p.unRealizedProfit||0),0);
const records=[];
const windowMs=7*86400000;
for(let start=since;start<=now;start+=windowMs){
  const end=Math.min(now,start+windowMs-1);
  let cursor=start;
  let pages=0;
  while(cursor<=end){
    if(++pages>100) throw new Error('Income history exceeds safety page limit; report incomplete');
    const page=await client.incomeHistory({startTime:cursor,endTime:end,limit:1000});
    if(!Array.isArray(page)) throw new Error('Income history unavailable; report incomplete');
    records.push(...page);
    if(page.length<1000) break;
    const lastTime=Number(page.at(-1)?.time);
    if(!Number.isFinite(lastTime)||lastTime<cursor) throw new Error('Income pagination stalled');
    // Timestamp collisions at the 1000-record boundary cannot be safely paginated
    // using time alone. Refuse an inaccurate cumulative total.
    if(page.filter(x=>Number(x.time)===lastTime).length>1)
      throw new Error('Income page boundary has duplicate timestamps; cannot guarantee complete PnL');
    cursor=lastTime+1;
  }
}
const totals={REALIZED_PNL:0,COMMISSION:0,FUNDING_FEE:0,OTHER:0};
for(const record of records){
  const value=Number(record.income);
  if(!Number.isFinite(value)) throw new Error('Invalid income record');
  const type=record.incomeType;
  if(type in totals) totals[type]+=value;
  else totals.OTHER+=value;
}
const realizedNet=totals.REALIZED_PNL+totals.COMMISSION+totals.FUNDING_FEE;
console.log(JSON.stringify({
  environment:'BINANCE_FUTURES_DEMO',
  periodStart:new Date(since).toISOString(),
  periodEnd:new Date(now).toISOString(),
  incomeRecords:records.length,
  currencyNote:'Amounts are income asset units; USDT totals require USDT-only records',
  incomeAssets:[...new Set(records.map(x=>x.asset))],
  realizedTradingPnl:totals.REALIZED_PNL,
  commissions:totals.COMMISSION,
  funding:totals.FUNDING_FEE,
  otherIncomeExcluded:totals.OTHER,
  realizedNetBeforeOtherIncome:realizedNet,
  floatingPnl:floating,
  combinedTradingPnl:realizedNet+floating,
  activePositionCount:active.length,
  activePositions:active.map(p=>({symbol:p.symbol,side:p.positionSide,amount:p.positionAmt,unrealizedPnl:p.unRealizedProfit})),
  openOrderCount:orders.length,
  note:'Not an all-time account balance. Trading PnL excludes transfers and other income; floating PnL is a current snapshot.'
},null,2));
