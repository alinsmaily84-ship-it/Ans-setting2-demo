// Speed-first candidate for rapid-trade research only.
// No entry, exit, SL or profit-clamp authority. Original Setting2 strategy remains unchanged.
export function previewSpeedFirstDecision({prices,observedAt,now=Date.now(),forecastSide}) {
  if(!Array.isArray(prices)||prices.length<9)return {candidateSide:'WAIT',reason:'INSUFFICIENT_TICKS',mode:'SHADOW_ONLY'};
  if(!Number.isFinite(observedAt)||now-observedAt>10000||now<observedAt)return {candidateSide:'WAIT',reason:'STALE_TICKS',mode:'SHADOW_ONLY'};
  const recent=prices.slice(-9);
  if(recent.some(p=>!Number.isFinite(p)||p<=0))return {candidateSide:'WAIT',reason:'INVALID_PRICE',mode:'SHADOW_ONLY'};
  const deltas=recent.slice(1).map((p,i)=>p-recent[i]);
  const ups=deltas.filter(d=>d>0).length,downs=deltas.filter(d=>d<0).length;
  const movePct=(recent.at(-1)/recent[0]-1)*100;
  const speedSide=movePct>0&&ups>downs?'LONG':movePct<0&&downs>ups?'SHORT':'WAIT';
  const conflict=['LONG','SHORT'].includes(forecastSide)&&speedSide!=='WAIT'&&speedSide!==forecastSide;
  return {candidateSide:speedSide,speedSide,forecastSide,conflict,movePct,ups,downs,
    reason:speedSide==='WAIT'?'NO_CLEAR_TICK_DIRECTION':conflict?'FAST_FORECAST_CONFLICT':'SPEED_DIRECTION_OBSERVED',
    // Informational only: no threshold, waiting period or trade filter added to the original engine.
    mode:'SHADOW_ONLY',tradeAuthorized:false,exitAuthorized:false};
}
