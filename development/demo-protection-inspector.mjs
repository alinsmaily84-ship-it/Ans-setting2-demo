// Read-only account audit: fetch Demo positions and conditional orders, then reconcile.
// No trading, HTTP endpoint, or exposure of raw credentials.
import {fetchDemoAccountSnapshot} from './demo-account-reader.mjs';
import {auditDemoExposure,auditDemoPositionProtection} from './demo-exchange-audit.mjs';
import {planStopAfterFill} from './demo-protection-planner.mjs';
import {demoStrategy} from './demo-strategy-contract.mjs';

export async function inspectDemoProtection({apiKey,apiSecret,fetchImpl,nowMs,marketBySymbol={}}={}) {
  const snapshot=await fetchDemoAccountSnapshot({apiKey,apiSecret,fetchImpl,nowMs});
  const exposure=auditDemoExposure({positions:snapshot.positions,maxConcurrentPositions:demoStrategy.concurrentPositions});
  const reports=[];
  for(const position of snapshot.positions){
    const qty=Number(position.positionAmt);
    if(!Number.isFinite(qty)||qty===0) continue;
    const symbol=position.symbol;
    const market=marketBySymbol[symbol];
    if (position.positionSide && position.positionSide!=='BOTH') {
      reports.push({symbol,protected:false,reason:'HEDGE_MODE_STOP_REQUIRES_VERIFIED_EXCHANGE_SUPPORT'});
      continue;
    }
    if(!market || !Number.isFinite(market.markPrice) || !Number.isFinite(market.tickSize))
      {reports.push({symbol,protected:false,reason:'MARKET_REFERENCE_MISSING'});continue;}
    let proposed;
    try {
      proposed=planStopAfterFill({
        symbol,positionQty:qty,entryPrice:Number(position.entryPrice),
        markPrice:market.markPrice,tickSize:market.tickSize
      });
    } catch {
      reports.push({symbol,protected:false,reason:'STOP_INPUT_INVALID'});
      continue;
    }
    if(!proposed.valid)
      {reports.push({symbol,protected:false,reason:proposed.reason});continue;}
    reports.push(auditDemoPositionProtection({
      symbol,position,algoOrders:snapshot.algoOrders,
      expectedStopSide:proposed.side,expectedStopTrigger:proposed.triggerPrice
    }));
  }
  return {
    venue:'BINANCE_FUTURES_DEMO',readOnly:true,executionEnabled:false,
    observedAt:snapshot.observedAt,exposure,reports,
    allOpenPositionsProtected:exposure.openPositionCount>0 && reports.length===exposure.openPositionCount && reports.every(x=>x.protected===true),
    withinApprovedPositionCount:exposure.withinLimit,
    note:'A matching stop is a point-in-time observation, not a guarantee of execution or maximum loss.'
  };
}
