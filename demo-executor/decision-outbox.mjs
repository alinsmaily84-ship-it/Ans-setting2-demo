// Safe in-process decision transport; this does not execute orders.
import {createHash} from 'node:crypto';
export function stableDecisionId({sessionId,cycleId,action,symbol,positionId}) {
  if (![sessionId,cycleId,action,symbol].every(x=>typeof x==='string' && x.length>0)) throw new Error('Missing decision identity');
  return createHash('sha256').update(JSON.stringify([sessionId,cycleId,action,symbol,positionId??''])).digest('hex').slice(0,32);
}
export class DecisionOutbox {
  constructor(){this.queue=new Map();}
  enqueue(decision){
    if (!decision?.id || typeof decision.id!=='string') throw new Error('Decision ID required');
    if (this.queue.has(decision.id)) return {accepted:false,reason:'DUPLICATE',record:this.queue.get(decision.id)};
    const record={decision:{...decision},state:'QUEUED'};
    this.queue.set(decision.id,record);
    return {accepted:true,record};
  }
  listPending(){return [...this.queue.values()].filter(x=>x.state==='QUEUED').map(x=>({...x,decision:{...x.decision}}));}
  markHandled(id){const r=this.queue.get(id);if(!r||r.state!=='QUEUED')throw new Error('Invalid transition');r.state='HANDLED';return {...r};}
}
