// Diagnostic only: show how a speed-first candidate relates to Setting2's
// existing eligibility rules. Never routes orders or modifies protection.
import {autoEntryEligible,hybridExecutionConfirmed} from './setting2-entry-eligibility.mjs';
export function previewSetting2Entry({signal,speedPreview,strategyMode,threshold,tpMode,globalTp,globalSl,useGlobalRisk,quoteAgeMs}) {
 const modeKnown=['STANDARD','HYBRID','MOMENTUM','ADAPTIVE','SCALPER'].includes(strategyMode);
 const side=signal?.side;
 const candidate=speedPreview?.candidateSide??'WAIT';
 const conflict=['LONG','SHORT'].includes(side)&&['LONG','SHORT'].includes(candidate)&&side!==candidate;
 const result={originalSide:side??null,speedCandidateSide:candidate,speedConflict:conflict,
   originalStrategyMode:modeKnown?strategyMode:'UNVERIFIED',mode:'SHADOW_ONLY',
   speedHasEntryAuthority:false,orderSubmissionEnabled:false,protectionUnchanged:true};
 if(!modeKnown)return {...result,originalEligible:null,reason:'ORIGINAL_STRATEGY_MODE_NOT_VERIFIED'};
 if(!signal||!Number.isFinite(quoteAgeMs))return {...result,originalEligible:null,reason:'MISSING_ORIGINAL_INPUTS'};
 const eligible=autoEntryEligible(signal,threshold,tpMode,globalTp,globalSl,useGlobalRisk,strategyMode);
 const confirmed=strategyMode==='HYBRID'?hybridExecutionConfirmed(signal,quoteAgeMs):null;
 return {...result,originalEligible:eligible,hybridExecutionConfirmed:confirmed,
   reason:'DIAGNOSTIC_ONLY_NOT_AN_ORDER'};
}
