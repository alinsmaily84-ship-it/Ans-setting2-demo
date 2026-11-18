// Market-data-only internal price mirror. Never creates trading decisions or orders.
export class PriceIndicator {
  constructor({maxAgeMs=3000,clock=Date.now}={}) {this.maxAgeMs=maxAgeMs;this.clock=clock;this.latest=new Map();}
  ingest(message,receivedAt=this.clock()) {
    let event;
    try {event=typeof message==='string'?JSON.parse(message):message;} catch {return {ok:false,reason:'INVALID_JSON'};}
    const data=event?.data??event;
    const symbol=data?.s,price=Number(data?.p),eventTime=Number(data?.E);
    if(!/^[A-Z0-9]{3,24}$/.test(symbol||'')||!Number.isFinite(price)||price<=0||!Number.isSafeInteger(eventTime)||eventTime<=0) return {ok:false,reason:'INVALID_TRADE'};
    const previous=this.latest.get(symbol);
    if(previous && eventTime<previous.eventTime) return {ok:false,reason:'OUT_OF_ORDER'};
    const snapshot=Object.freeze({symbol,price,eventTime,receivedAt,latencyMs:receivedAt-eventTime});
    this.latest.set(symbol,snapshot);
    return {ok:true,snapshot};
  }
  read(symbol,now=this.clock()) {
    const snapshot=this.latest.get(symbol);
    if(!snapshot)return {ok:false,reason:'NO_PRICE'};
    if(now-snapshot.receivedAt>this.maxAgeMs)return {ok:false,reason:'STALE_PRICE',snapshot};
    return {ok:true,snapshot};
  }
}
