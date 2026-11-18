// Reads only source code and supplied browser settings; does not mutate them.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const source=readFileSync(resolve(import.meta.dirname,'../app/src/routes/index.tsx'),'utf8');
const marker='Object.assign(s, {intelligenceBoardEnabled:true';
const begin=source.indexOf(marker),end=source.indexOf('});',begin);
if(begin<0||end<0)throw new Error('Original Setting2 forced settings block not found');
export const forcedSettingsSource=source.slice(begin,end+3);
export function auditSettings(saved){
 if(!saved || typeof saved!=='object' || Array.isArray(saved)) throw new Error('Browser settings object required');
 const keys=['strategyMode','capital','risk','lev','maxPos','autoPaper','autoMode','adaptiveThreshold','momentumThreshold','autoThreshold','microProbabilityThreshold','globalTp','globalSl','tpMode','stopMode','useGlobalRisk','allocationMode','initialEntryPct','autoScale','recoveryEnabled','recoveryMode','recoveryTriggerUsd','recoveryMaxLossUsd','profitExperimentEnabled','profitArmUsd','profitFloorUsd','profitGivebackPct'];
 const present=Object.fromEntries(keys.filter(k=>Object.hasOwn(saved,k)).map(k=>[k,saved[k]]));
 const missing=keys.filter(k=>!Object.hasOwn(saved,k));
 return {present,missing,forcedSettingsSource,readyForParity:missing.length===0};
}
