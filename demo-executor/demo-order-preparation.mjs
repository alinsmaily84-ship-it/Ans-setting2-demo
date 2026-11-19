// Binance Futures DEMO order-preparation module.
// This module never submits orders. It prepares quantities and validates exchange filters.
// Explicitly refuses Live URLs and makes no network requests.
import { demoStrategy } from "./demo-strategy-contract.mjs";

function decimalPlaces(step) {
  const s = String(step);
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(s) || !(Number(s)>0)) throw new Error("INVALID_STEP_SIZE");
  return (s.split(".")[1] || "").length;
}

export function prepareDemoMarketOrder({symbol, side, desiredNotionalUsdt, price, exchangeSymbol}) {
  if (demoStrategy.venue !== "BINANCE_FUTURES_DEMO" || demoStrategy.executionEnabled)
    throw new Error("DEMO_PREVIEW_ONLY");
  if (!exchangeSymbol || exchangeSymbol.symbol !== symbol ||
      exchangeSymbol.status !== "TRADING" ||
      exchangeSymbol.contractType !== "PERPETUAL" ||
      exchangeSymbol.quoteAsset !== "USDT") throw new Error("SYMBOL_NOT_ELIGIBLE");
  if (!["BUY","SELL"].includes(side) || !Number.isFinite(desiredNotionalUsdt) ||
      desiredNotionalUsdt <= 0 || !Number.isFinite(price) || price <= 0)
    throw new Error("ORDER_INPUT_INVALID");
  const filters = Array.isArray(exchangeSymbol.filters) ? exchangeSymbol.filters : [];
  const lot = filters.find(x=>x.filterType==="MARKET_LOT_SIZE") || filters.find(x=>x.filterType==="LOT_SIZE");
  if (!lot) throw new Error("LOT_FILTER_MISSING");
  const step=Number(lot.stepSize), digits=decimalPlaces(lot.stepSize);
  const minQty=Number(lot.minQty),maxQty=Number(lot.maxQty);
  const notionalFilter=filters.find(x=>x.filterType==="MIN_NOTIONAL"||x.filterType==="NOTIONAL");
  const minNotional=Number(notionalFilter?.notional??notionalFilter?.minNotional??0);
  if (![step,minQty,maxQty,minNotional].every(Number.isFinite) ||
      step<=0 || minQty<0 || maxQty<=0 || minQty>maxQty || minNotional<0)
    throw new Error("EXCHANGE_FILTER_INVALID");
  const raw=desiredNotionalUsdt/price;
  // Exchange quantity must be rounded DOWN, never rounded up beyond the requested notional.
  const ratio=raw/step;
  const nearest=Math.round(ratio);
  // Floating-point multiplication/division must not erase a valid minimum step.
  const units=Math.abs(ratio-nearest)<1e-8 ? nearest : Math.floor(ratio);
  const quantity=Number((units*step).toFixed(digits));
  const actualNotionalUsdt=quantity*price;
  const reasons=[];
  if (!(quantity>0) || quantity<minQty) reasons.push("BELOW_MIN_QTY");
  if (quantity>maxQty) reasons.push("ABOVE_MAX_QTY");
  if (actualNotionalUsdt+1e-9<minNotional) reasons.push("BELOW_MIN_NOTIONAL");
  if (actualNotionalUsdt>desiredNotionalUsdt+1e-7) reasons.push("EXCEEDS_REQUESTED_NOTIONAL");
  return Object.freeze({
    venue:"BINANCE_FUTURES_DEMO",symbol,side,quantity:quantity.toFixed(digits),
    requestedNotionalUsdt:desiredNotionalUsdt,actualNotionalUsdt,
    valid:reasons.length===0,reasons,executionEnabled:false
  });
}

export function prepareDemoProbe(input) {
  const {exchangeSymbol,price}=input;
  const filters=exchangeSymbol?.filters||[];
  const lot=filters.find(x=>x.filterType==='MARKET_LOT_SIZE')||filters.find(x=>x.filterType==='LOT_SIZE');
  const step=Number(lot?.stepSize),minQty=Number(lot?.minQty);
  const notionalFilter=filters.find(x=>x.filterType==='MIN_NOTIONAL'||x.filterType==='NOTIONAL');
  const notional=Number(notionalFilter?.notional??notionalFilter?.minNotional??0);
  if(![step,minQty,notional,price].every(Number.isFinite)||step<=0||minQty<0||notional<0||price<=0)
    throw Error('DEMO_MINIMUM_METADATA_INVALID');
  const minUnits=Math.max(Math.ceil((notional/price)/step-1e-10),Math.ceil(minQty/step-1e-10),1);
  const desiredNotionalUsdt=minUnits*step*price;
  const planned=prepareDemoMarketOrder({...input,desiredNotionalUsdt});
  return Object.freeze({...planned,minimumBased:true});
}
