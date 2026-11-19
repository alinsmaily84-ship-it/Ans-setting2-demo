import { validateDemoOrder } from './exchange-filters.mjs';

// Accepts the strategy's existing decision as-is; never computes a new trade signal.
export function prepareDemoIntent(decision, exchangeInfo) {
  if (!decision || !['OPEN','ADD','CLOSE'].includes(decision.action)) return {ok:false,reason:'INVALID_ACTION'};
  if (!['LONG','SHORT'].includes(decision.side)) return {ok:false,reason:'INVALID_DIRECTION'};
  if (!/^[A-Z0-9]{3,24}$/.test(decision.symbol || '')) return {ok:false,reason:'INVALID_SYMBOL'};
  if (!Number.isFinite(Number(decision.price)) || Number(decision.price)<=0) return {ok:false,reason:'INVALID_PRICE'};
  const check=validateDemoOrder({symbol:decision.symbol,quantity:decision.quantity,price:decision.price,exchangeInfo});
  if (!check.ok) return check;
  const orderSide=decision.action==='CLOSE' ? (decision.side==='LONG'?'SELL':'BUY') : (decision.side==='LONG'?'BUY':'SELL');
  return {ok:true,order:{symbol:decision.symbol,side:orderSide,type:'MARKET',quantity:check.quantity},sourceDecisionId:decision.id ?? null,action:decision.action};
}
