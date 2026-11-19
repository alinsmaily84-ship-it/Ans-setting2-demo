import test from 'node:test';
import assert from 'node:assert/strict';
import { BinanceDemoClient } from './binance-demo-client.mjs';

test('Demo client rejects production Binance hostname',()=>{
  assert.throws(()=>new BinanceDemoClient({apiKey:'x',apiSecret:'y',baseUrl:'https://fapi.binance.com'}),/Demo host only/);
});
test('Demo client rejects insecure or alternate endpoint',()=>{
  for(const baseUrl of ['http://demo-fapi.binance.com','https://demo-fapi.binance.com.evil.test','https://demo-fapi.binance.com:8443'])
    assert.throws(()=>new BinanceDemoClient({apiKey:'x',apiSecret:'y',baseUrl}),/Demo host only/);
});
test('Read-only signed request uses Demo host and API key without placing secret in URL',async()=>{
  const calls=[];
  const client=new BinanceDemoClient({apiKey:'demo-key',apiSecret:'private-secret',fetchImpl:async(url,opts)=>{
    calls.push({url,opts});
    return {ok:true,json:async()=>[]};
  }});
  assert.deepEqual(await client.positions(),[]);
  assert.equal(calls.length,1);
  assert.equal(new URL(calls[0].url).hostname,'demo-fapi.binance.com');
  assert.equal(new URL(calls[0].url).pathname,'/fapi/v1/positionRisk');
  assert.equal(calls[0].opts.method,'GET');
  assert.equal(calls[0].opts.headers['X-MBX-APIKEY'],'demo-key');
  assert.ok(new URL(calls[0].url).searchParams.has('signature'));
  assert.ok(!calls[0].url.includes('private-secret'));
});
test('Income history remains read-only and signed',async()=>{
  let called;
  const client=new BinanceDemoClient({apiKey:'x',apiSecret:'y',fetchImpl:async(url,opts)=>{
    called={url,opts};return {ok:true,json:async()=>[]};
  }});
  await client.incomeHistory({startTime:123,endTime:456,limit:1000});
  assert.equal(new URL(called.url).pathname,'/fapi/v1/income');
  assert.equal(called.opts.method,'GET');
});
