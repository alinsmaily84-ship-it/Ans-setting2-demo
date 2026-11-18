// Read-only Binance Futures Demo trade stream -> internal price indicator.
// No orders, decisions, or stop modifications are made by this module.
import {PriceIndicator} from './price-indicator.mjs';
import {PriceMetrics} from './price-metrics.mjs';
export const DEMO_STREAM_HOST='stream.binancefuture.com';
export function demoTradeStreamUrl(symbols){
  if(!Array.isArray(symbols)||!symbols.length||symbols.length>100)throw new Error('Symbol list required (max 100)');
  const unique=[...new Set(symbols.map(s=>String(s).toUpperCase()))];
  if(unique.some(s=>!/^[A-Z0-9]{3,24}$/.test(s)))throw new Error('Invalid symbol');
  return `wss://${DEMO_STREAM_HOST}/stream?streams=${unique.map(s=>`${s.toLowerCase()}@trade`).join('/')}`;
}
export class DemoPriceStream {
  constructor({symbols,WebSocketImpl=globalThis.WebSocket,indicator=new PriceIndicator(),metrics=new PriceMetrics(),clock=Date.now}={}){
    this.url=demoTradeStreamUrl(symbols);this.WebSocketImpl=WebSocketImpl;this.indicator=indicator;this.metrics=metrics;this.clock=clock;this.socket=null;this.lastError=null;
  }
  connect(){
    if(!this.WebSocketImpl)throw new Error('WebSocket implementation unavailable');
    if(this.socket)throw new Error('Stream already started');
    const socket=new this.WebSocketImpl(this.url);this.socket=socket;
    socket.addEventListener('message',event=>{const result=this.indicator.ingest(event.data,this.clock());if(result.ok)this.metrics.record(result.snapshot);else this.lastError=result.reason});
    socket.addEventListener('error',()=>{this.lastError='STREAM_ERROR'});
    socket.addEventListener('close',()=>{this.socket=null});
    return socket;
  }
  read(symbol){return this.indicator.read(symbol,this.clock())}
  report(symbol){return this.metrics.report(symbol,this.clock())}
  disconnect(){this.socket?.close();this.socket=null}
}
