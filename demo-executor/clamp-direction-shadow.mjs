// Shadow-only direction comparison for ANS Setting2.
// Does NOT change the original strategy's orders, thresholds or stop-loss.
// Feed chronologically ordered price observations and the original decision.
export function compareClampDirection({originalSide, prices, lookback=8}) {
  if(!['LONG','SHORT','WAIT'].includes(originalSide))throw new Error('INVALID_ORIGINAL_SIDE');
  if(!Array.isArray(prices)||prices.length<lookback+1||!Number.isInteger(lookback)||lookback<2)throw new Error('INSUFFICIENT_PRICE_HISTORY');
  const window=prices.slice(-lookback-1);
  if(window.some(x=>!Number.isFinite(x)||x<=0))throw new Error('INVALID_PRICE');
  const changes=window.slice(1).map((p,i)=>p-window[i]);
  const up=changes.filter(x=>x>0).length,down=changes.filter(x=>x<0).length;
  const net=window.at(-1)-window[0];
  const clampSide=net>0&&up>down?'LONG':net<0&&down>up?'SHORT':'WAIT';
  const agrees=clampSide!=='WAIT'&&clampSide===originalSide;
  return {originalSide,clampSide,agrees,upTicks:up,downTicks:down,netMove:net,
    // Candidate only, never applied to live decisions until user approves a rule.
    candidateSide:originalSide,mode:'SHADOW_ONLY'};
}
