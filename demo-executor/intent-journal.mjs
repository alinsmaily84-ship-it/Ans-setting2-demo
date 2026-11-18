// Explicitly gated, idempotent execution preparation. No network calls here.
import {prepareDemoIntent} from './intent-adapter.mjs';
export class DemoIntentJournal {
  constructor(){this.records=new Map();}
  prepare(decision, exchangeInfo){
    if (!decision?.id || typeof decision.id!=='string') return {ok:false,reason:'MISSING_DECISION_ID'};
    if (this.records.has(decision.id)) return {ok:false,reason:'DUPLICATE_DECISION',previous:this.records.get(decision.id)};
    const result=prepareDemoIntent(decision,exchangeInfo);
    if (!result.ok) return result;
    const record={id:decision.id,state:'PREPARED',action:result.action,order:result.order};
    this.records.set(decision.id,record);
    return {ok:true,record};
  }
  markSubmitted(id,submission){
    const record=this.records.get(id);
    if (!record || record.state!=='PREPARED') throw new Error('Invalid state transition');
    if (!submission?.orderId) throw new Error('Missing exchange order ID');
    record.state='SUBMITTED';record.orderId=submission.orderId;
    return {...record};
  }
  markReconciled(id,result){
    const record=this.records.get(id);
    if (!record || record.state!=='SUBMITTED') throw new Error('Invalid state transition');
    if (!result?.confirmed || String(result.orderId)!==String(record.orderId)) throw new Error('Exchange confirmation required');
    record.state='CONFIRMED';record.filled=result.filled;
    return {...record};
  }
}
