// Pure Demo-only 30s/60s lifecycle decision planner. No order submission.
import {demoStrategy} from './demo-strategy-contract.mjs';
export function planDemoPositionReview({ageSeconds,positionNotionalUsdt,price,exchangeSymbol,symbol,side,confirmedDirection}={}){
 if(!Number.isFinite(ageSeconds)||ageSeconds<0||!Number.isFinite(positionNotionalUsdt)||positionNotionalUsdt<=0)
  throw Error('POSITION_REVIEW_INPUT_INVALID');
 if(!['BUY','SELL'].includes(side))throw Error('POSITION_SIDE_INVALID');
 if(ageSeconds<demoStrategy.firstDecisionSeconds)return Object.freeze({action:'HOLD_PROBE',ordersPlaced:0});
 if(confirmedDirection!==undefined&&confirmedDirection!==null&&!['BUY','SELL'].includes(confirmedDirection))
  throw Error('DIRECTION_INVALID');
 if(confirmedDirection===side){
  const remaining=Math.max(0,demoStrategy.targetNotionalUsdt-positionNotionalUsdt);
  if(remaining<=0)return Object.freeze({action:'TARGET_REACHED',ordersPlaced:0});
  if(!exchangeSymbol||!Number.isFinite(price)||price<=0)return Object.freeze({action:'RECHECK_MARKET_METADATA',ordersPlaced:0});
  // Planning only: no add until stop reconciliation and exchange leverage are confirmed.
  return Object.freeze({action:'ADD_REQUIRES_PROTECTED_EXECUTION',symbol,side,remainingNotionalUsdt:remaining,ordersPlaced:0});
 }
 if(ageSeconds>=demoStrategy.staleProbeReviewSeconds)
  return Object.freeze({action:'CLOSE_STALE_PROBE_REQUIRES_RECONCILIATION',symbol,ordersPlaced:0});
 return Object.freeze({action:'RECHECK_AT_60_SECONDS',ordersPlaced:0});
}
