// Port of the initial stop-percentage selection in Setting2 index.tsx openPaper.
// Calculation only; never submits an order or substitutes for the original strategy.
// Source: openPaper selectedStopMode/slPct/stop in Setting2 browser strategy.
export function setting2InitialStop({strategyMode,side,price,signalStop,stopMode,microStopMode,manualStopPct,microManualStopPct,scalpFeePct,executionCostPct,scalpSlippagePct,useGlobalRisk,globalSl}) {
 if(!['LONG','SHORT'].includes(side)||!Number.isFinite(price)||price<=0||!Number.isFinite(signalStop)||signalStop<=0)throw Error('INVALID_STOP_INPUT');
 if(!['STANDARD','SCALPER','ADAPTIVE','MOMENTUM','HYBRID'].includes(strategyMode))throw Error('INVALID_STRATEGY_MODE');
 const selectedStopMode=['ADAPTIVE','MOMENTUM','HYBRID'].includes(strategyMode)?'AUTO':strategyMode==='SCALPER'?microStopMode:stopMode;
 const selectedManualStopPct=strategyMode==='SCALPER'?microManualStopPct:manualStopPct;
 const atrStopPct=Math.abs(signalStop/price-1)*100;
 const feeProtectionPct=strategyMode==='SCALPER'?Math.max(0.001,2*(scalpFeePct+(executionCostPct??scalpSlippagePct))):0.05;
 const slPct=strategyMode==='HYBRID'?Math.max(0.12,Math.min(0.24,atrStopPct)):
 strategyMode==='MOMENTUM'?1:
 selectedStopMode==='FEES_ONLY'?feeProtectionPct:
 selectedStopMode==='INSTANT'?0.05:
 selectedStopMode==='MANUAL'?selectedManualStopPct:
 Math.max(atrStopPct,strategyMode==='ADAPTIVE'?0.20:strategyMode==='SCALPER'?0:useGlobalRisk?globalSl:0);
 if(!Number.isFinite(slPct)||slPct<=0)throw Error('INVALID_STOP_PERCENT');
 return {stop:side==='LONG'?price*(1-slPct/100):price*(1+slPct/100),slPct,selectedStopMode,mode:'PARITY_CALCULATION_ONLY'};
}
