// Explicit Binance Futures Demo fill -> primary protective stop flow.
// Does not open positions, schedule trading, or enable Live.
import {prepareReconciledDemoProtection} from './demo-protection-handoff.mjs';
import {submitAndVerifyDemoPrimaryStop} from './demo-stop-execution.mjs';

export async function protectConfirmedDemoFill({
  symbol,side,requestedQuantity,submitted,orderStatus,
  beforePositions,afterPositions,stepSize,markPrice,tickSize,
  apiKey,apiSecret,fetchImpl,explicitDemoAuthorization=false
}) {
  // The first step is purely local; no order may be sent on an unverified fill.
  const handoff=prepareReconciledDemoProtection({
    symbol,side,requestedQuantity,submitted,orderStatus,
    beforePositions,afterPositions,stepSize,markPrice,tickSize
  });
  if(handoff.action!=='PRIMARY_STOP_PROPOSAL_READY')
    return {action:'STOP_NOT_SUBMITTED',reason:handoff.reason||handoff.action,
      protected:false,exchangeProtectionConfirmed:false,ordersPlaced:0};
  const matching=afterPositions.filter(p=>
    p.symbol===symbol &&
    Number(p.positionAmt)===handoff.fill.positionQty
  );
  if(matching.length!==1)
    return {action:'STOP_NOT_SUBMITTED',reason:'FILLED_POSITION_NOT_UNIQUE',
      protected:false,exchangeProtectionConfirmed:false,ordersPlaced:0};
  const result=await submitAndVerifyDemoPrimaryStop({
    handoff,position:matching[0],apiKey,apiSecret,fetchImpl,
    explicitDemoAuthorization
  });
  return {action:result.protected===true?'PRIMARY_STOP_CONFIRMED':'PRIMARY_STOP_UNCONFIRMED',
    ...result,exchangeProtectionConfirmed:result.protected===true};
}
