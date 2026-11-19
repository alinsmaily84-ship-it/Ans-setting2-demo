import {BinanceDemoClient} from './binance-demo-client.mjs';
import {createClampExecutor} from './smart-clamp-executor.mjs';
// Demo-only adapter. Does not open positions or change original SL orders.
// The caller must supply protection levels from the verified Setting2 strategy.
export function createBinanceDemoClamp({client,record}) {
  if(!(client instanceof BinanceDemoClient))throw new Error('DEMO_CLIENT_REQUIRED');
  const readPosition=async(symbol)=>{
    const positions=await client.positions();
    if(!Array.isArray(positions))throw new Error('POSITIONS_UNAVAILABLE');
    const matching=positions.filter(p=>p.symbol===symbol && Number(p.positionAmt)!==0);
    if(matching.some(p=>p.positionSide&&p.positionSide!=='BOTH'))throw new Error('HEDGE_MODE_UNSUPPORTED');
    if(matching.length>1)throw new Error('AMBIGUOUS_POSITION');
    return matching[0]||null;
  };
  const verifyClosed=async({symbol,side})=>{
    const p=await readPosition(symbol);
    if(!p)return true;
    const amt=Number(p.positionAmt);
    if(side==='LONG'&&amt<0||side==='SHORT'&&amt>0)throw new Error('POSITION_DIRECTION_CHANGED');
    return false;
  };
  const closeMarket=async({symbol,side,closeOnly})=>{
    if(closeOnly!==true)throw new Error('CLOSE_ONLY_REQUIRED');
    const p=await readPosition(symbol);
    if(!p)throw new Error('POSITION_ALREADY_CLOSED');
    const amt=Number(p.positionAmt);
    if((side==='LONG'&&amt<=0)||(side==='SHORT'&&amt>=0))throw new Error('POSITION_DIRECTION_MISMATCH');
    const quantity=String(Math.abs(amt));
    // Reduce-only prevents the exit from creating a reverse position in one-way mode.
    const order=await client.submitOrder({symbol,side:amt>0?'SELL':'BUY',type:'MARKET',quantity,reduceOnly:'true',newClientOrderId:'s2c_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)});
    if(!order?.orderId)throw new Error('ORDER_ID_MISSING');
    const status=await client.orderStatus(symbol,order.orderId);
    return {orderId:order.orderId,status:status?.status,avgPrice:status?.avgPrice,executedQty:status?.executedQty};
  };
  return createClampExecutor({closeMarket,verifyClosed,record});
}
