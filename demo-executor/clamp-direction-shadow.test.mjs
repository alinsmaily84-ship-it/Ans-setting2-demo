import test from 'node:test';
import assert from 'node:assert/strict';
import {compareClampDirection} from './clamp-direction-shadow.mjs';
test('rising price confirms original LONG',()=>{const r=compareClampDirection({originalSide:'LONG',prices:[100,101,102,103,104],lookback:4});assert.equal(r.clampSide,'LONG');assert.equal(r.agrees,true);assert.equal(r.candidateSide,'LONG')});
test('falling price disagrees with original LONG without changing it',()=>{const r=compareClampDirection({originalSide:'LONG',prices:[104,103,102,101,100],lookback:4});assert.equal(r.clampSide,'SHORT');assert.equal(r.candidateSide,'LONG')});
test('rising price disagrees with original SHORT',()=>assert.equal(compareClampDirection({originalSide:'SHORT',prices:[100,101,102,103,104],lookback:4}).agrees,false));
test('flat price stays neutral',()=>assert.equal(compareClampDirection({originalSide:'WAIT',prices:[100,100,100,100,100],lookback:4}).clampSide,'WAIT'));
test('reject missing history',()=>assert.throws(()=>compareClampDirection({originalSide:'LONG',prices:[100,101],lookback:4})));
