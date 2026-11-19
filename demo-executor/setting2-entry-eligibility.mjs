// Faithful extraction of autoEntryEligible and hybridExecutionConfirmed
// from original Setting2 app/src/routes/index.tsx. No trading side effects.
export function autoEntryEligible(s,threshold,tpMode,globalTp,globalSl,useGlobalRisk,strategyMode='STANDARD'){
 const atrStopPct=Math.abs(s.stop/s.price-1)*100;
 const stopPct=Math.max(atrStopPct,useGlobalRisk?globalSl:0);
 const targetPct=tpMode==='MANUAL'?Math.max(0.1,globalTp):Math.max(globalTp,stopPct*2,atrStopPct*2.5);
 const rr=targetPct/Math.max(stopPct,0.0001);
 const common=s.side!=='WAIT'&&s.price>0&&Number.isFinite(s.price);
 if(strategyMode==='HYBRID')return common;
 if(strategyMode==='MOMENTUM')return common;
 if(strategyMode==='ADAPTIVE'){
  const costPct=(s.executionCostPct??0.08)*2+0.10;
  return common&&s.opportunityScore>=threshold&&s.forecastProbability>=Math.max(65,threshold-8)&&s.forecastConfidence>=58&&s.adx>=15&&s.volumeRatio>=0.65&&Math.abs(s.forecastChange)>=costPct&&rr>=1.5&&(s.microSpreadPct??0.2)<=0.12&&(s.executionCostPct??0.2)<=0.10;
 }
 if(strategyMode==='SCALPER'){
  return common&&s.forecastProbability>=threshold&&s.forecastConfidence>=Math.max(48,threshold-6)&&s.speedScore>=0.01&&(s.microImpulsePct??0)>=0.01&&(s.microImpulsePct??0)<=0.35&&(s.microEfficiency??0)>=0.22&&(s.microLastStepPct??0)*(s.side==='LONG'?1:-1)>0&&(s.microAligned5m===true||s.microAligned1h===true)&&(s.microSpreadPct??1)<=0.10&&(s.executionCostPct??1)<=0.10&&(s.microAdx5m??0)>=8&&(s.microVolume5m??0)>=0.35;
 }
 return common&&s.forecastProbability>=threshold&&s.forecastConfidence>=52&&s.opportunityScore>=threshold&&s.adx>=12&&s.volumeRatio>=0.55&&Math.abs(s.forecastChange)>=0.03&&rr>=1.35;
}
export function hybridExecutionConfirmed(s,quoteAgeMs){
 const sign=s.side==='LONG'?1:s.side==='SHORT'?-1:0;
 if(!sign||quoteAgeMs<0||quoteAgeMs>45000)return false;
 return Number.isFinite(s.price)&&s.price>0;
}
