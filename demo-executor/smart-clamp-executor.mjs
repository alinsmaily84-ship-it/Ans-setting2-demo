import {smartClampSignal} from './smart-clamp-signal.mjs';
// Demo clamp execution bridge. Caller supplies the original strategy's clamp price.
// closeMarket must submit a closing-only order; verifyClosed must query Binance positions.
// No stop-loss changes and no automatic opening of positions.
export function createClampExecutor({closeMarket,verifyClosed,record=()=>{}}) {
  if(typeof closeMarket!=='function'||typeof verifyClosed!=='function')throw new Error('MISSING_EXCHANGE_ADAPTER');
  const pending=new Set();
  return async function onPriceTick({positionId,symbol,side,price,clampPrice,previousPrice,previousClampPrice}) {
    if(!positionId||!symbol)throw new Error('MISSING_POSITION');
    const signal=smartClampSignal({side,price,clampPrice,previousPrice,previousClampPrice});
    if(!signal.shouldClose)return {status:'MONITORING',signal};
    if(pending.has(positionId))return {status:'CLOSE_IN_PROGRESS',signal};
    pending.add(positionId);
    const signaledAt=Date.now();
    try {
      // Check position first: a prior exchange close might already have filled.
      if(await verifyClosed({positionId,symbol,side}))return {status:'ALREADY_CLOSED',signal};
      const order=await closeMarket({positionId,symbol,side,closeOnly:true});
      const closed=await verifyClosed({positionId,symbol,side,order});
      const result={status:closed?'CLOSED_CONFIRMED':'CLOSE_UNCONFIRMED',signal,order,signaledAt,checkedAt:Date.now()};
      record(result);
      return result;
    } catch(error) {
      const result={status:'CLOSE_ERROR_UNCONFIRMED',signal,signaledAt,error:String(error?.message||error)};
      record(result);
      return result;
    } finally {pending.delete(positionId);}
  };
}
