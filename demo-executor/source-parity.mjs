import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=resolve(root,'app/src/routes/index.tsx');
export function sourceFingerprint(){
 const text=readFileSync(source,'utf8');
 const cycleStart=text.indexOf('    const runCycle = () => {');
 const cycleEnd=text.indexOf('    runCycle();\n    const timer = window.setInterval(runCycle, 1000);',cycleStart);
 const entryStart=text.indexOf('  const openPaper = (s: S, assignedBudget?: number) => {');
 const entryEnd=text.indexOf('    close = (p: P,',entryStart);
 if ([cycleStart,cycleEnd,entryStart,entryEnd].some(n=>n<0)) throw new Error('Setting2 original entry/cycle source shape changed');
 const hash=t=>createHash('sha256').update(t).digest('hex');
 return {source:hash(text),decisionCycle:hash(text.slice(cycleStart,cycleEnd)),entry:hash(text.slice(entryStart,entryEnd)),cycleLines:text.slice(cycleStart,cycleEnd).split('\n').length};
}
