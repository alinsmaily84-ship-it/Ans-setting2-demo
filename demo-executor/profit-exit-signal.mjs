// Experimental read-only profit exit signal. Does not place orders.
export class ProfitExitSignal {
  constructor({givebackPct=25,minProfitUsd=0.10}={}) {
    if(!(givebackPct>0&&givebackPct<100)||minProfitUsd<0) throw Error('Invalid exit parameters');
    this.givebackPct=givebackPct;
    this.minProfitUsd=minProfitUsd;
    this.highs=new Map();
  }
  observe({positionId,side,entryPrice,price,quantity,now=Date.now()}) {
    if(!positionId||!['LONG','SHORT'].includes(side)||![entryPrice,price,quantity].every(x=>Number.isFinite(x)&&x>0)) return {exit:false,reason:'INVALID_INPUT'};
    const pnl=(side==='LONG'?price-entryPrice:entryPrice-price)*quantity;
    const prev=this.highs.get(positionId);
    const peak=Math.max(pnl,prev?.peak??pnl);
    this.highs.set(positionId,{peak,now});
    const floor=Math.max(this.minProfitUsd,peak*(1-this.givebackPct/100));
    const armed=peak>=this.minProfitUsd;
    return {exit:armed&&pnl<floor,reason:!armed?'NOT_ARMED':pnl<floor?'PROFIT_GIVEBACK':'HOLD',pnlUsd:pnl,peakPnlUsd:peak,floorUsd:floor,observedAt:now};
  }
  reset(positionId){this.highs.delete(positionId)}
}
