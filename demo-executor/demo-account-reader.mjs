// Read-only Binance Futures Demo account snapshots.
// Never signs or sends POST/PUT/DELETE. Never accepts a caller-supplied base URL.
// Requires Demo-only API credentials; does not log secrets or expose snapshots via HTTP.
import {createHmac} from 'node:crypto';

const DEMO_ORIGIN='https://demo-fapi.binance.com';
const ALLOWED_PATHS=new Set(['/fapi/v3/positionRisk','/fapi/v1/openAlgoOrders']);

export function signDemoReadOnlyQuery(path,{apiKey,apiSecret,timestamp=Date.now(),recvWindow=5000}={}) {
  if (!ALLOWED_PATHS.has(path)) throw new Error('SIGNED_PATH_NOT_ALLOWLISTED');
  if (typeof apiKey!=='string'||!apiKey.trim()||typeof apiSecret!=='string'||!apiSecret.trim())
    throw new Error('DEMO_CREDENTIALS_MISSING');
  if (!Number.isSafeInteger(timestamp)||!Number.isSafeInteger(recvWindow)||recvWindow<=0)
    throw new Error('SIGNED_QUERY_INVALID');
  const query=new URLSearchParams({timestamp:String(timestamp),recvWindow:String(recvWindow)}).toString();
  const signature=createHmac('sha256',apiSecret).update(query).digest('hex');
  return {url:DEMO_ORIGIN+path+'?'+query+'&signature='+signature,headers:{'X-MBX-APIKEY':apiKey}};
}

export async function fetchDemoAccountSnapshot({apiKey,apiSecret,fetchImpl=fetch,nowMs=Date.now()}={}) {
  if (typeof fetchImpl!=='function') throw new Error('FETCH_UNAVAILABLE');
  const get=async path=>{
    const {url,headers}=signDemoReadOnlyQuery(path,{apiKey,apiSecret,timestamp:nowMs});
    const response=await fetchImpl(url,{method:'GET',headers,signal:AbortSignal.timeout(10000),redirect:'error'});
    if (!response.ok) throw new Error('DEMO_ACCOUNT_READ_FAILED_'+response.status);
    const data=await response.json();
    if (!Array.isArray(data)) throw new Error('DEMO_ACCOUNT_RESPONSE_INVALID');
    return data;
  };
  const [positions,algoOrders]=await Promise.all([
    get('/fapi/v3/positionRisk'),
    get('/fapi/v1/openAlgoOrders')
  ]);
  return {venue:'BINANCE_FUTURES_DEMO',readOnly:true,observedAt:new Date(nowMs).toISOString(),positions,algoOrders};
}
