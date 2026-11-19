// Read-only measurement of price-stream delivery. No trade decisions or orders.
export class PriceMetrics {
  constructor({capacity=1000}={}){if(!Number.isInteger(capacity)||capacity<1)throw Error('Invalid capacity');this.capacity=capacity;this.samples=new Map();}
  record(snapshot){
    if(!snapshot?.symbol||!Number.isFinite(snapshot.latencyMs)||!Number.isFinite(snapshot.receivedAt))return false;
    const items=this.samples.get(snapshot.symbol)||[];
    items.push({latencyMs:snapshot.latencyMs,receivedAt:snapshot.receivedAt});
    if(items.length>this.capacity)items.shift();
    this.samples.set(snapshot.symbol,items);return true;
  }
  report(symbol,now=Date.now()){
    const items=this.samples.get(symbol)||[];
    if(!items.length)return {symbol,count:0,ageMs:null,p50Ms:null,p95Ms:null,maxMs:null};
    const sorted=items.map(x=>x.latencyMs).sort((a,b)=>a-b);
    return {symbol,count:items.length,ageMs:Math.max(0,now-items.at(-1).receivedAt),p50Ms:sorted[Math.ceil(.5*sorted.length)-1],p95Ms:sorted[Math.ceil(.95*sorted.length)-1],maxMs:sorted.at(-1)};
  }
}
