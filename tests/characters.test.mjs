import test from 'node:test';
import assert from 'node:assert/strict';
import {LOOKS,OUTFITS,hashVillagerId,villagerDesign} from '../character-design.js';
import {JOBS} from '../workers.js';

test('every playable worker job has a distinctive valid uniform',()=>{
  assert.deepEqual(Object.keys(OUTFITS).sort(),Object.keys(JOBS).sort());
  for(const [job,outfit] of Object.entries(OUTFITS)){
    assert.ok(outfit.hat);
    for(const color of ['shirt','vest','pants','accent'])assert.match(outfit[color],/^#[0-9a-fA-F]{6}$/);
    assert.ok(outfit.name);
  }
});
test('villagers have a consistent face across game sessions and job reassignment',()=>{
  const id='a-home-resident-1';
  const farmer=villagerDesign({id,job:'farmer'});
  assert.deepEqual(villagerDesign({id,job:'farmer'}),farmer);
  const baker=villagerDesign({id,job:'baker'});
  assert.equal(farmer.index,baker.index);
  assert.strictEqual(farmer.look,baker.look);
  assert.notStrictEqual(farmer.outfit,baker.outfit);
});
test('the roster supports multiple appearances with clothing and skin tones',()=>{
  const variants=new Set(Array.from({length:32},(_,i)=>villagerDesign({id:`home-${i}-resident-1`,job:'idle'}).index));
  assert.ok(variants.size>=5);
  assert.equal(LOOKS.length,8);
  for(const look of LOOKS){assert.ok(['skirt','trousers'].includes(look.clothing));assert.match(look.skin,/^#[0-9a-fA-F]{6}$/);}
});
test('malformed or unknown worker job data falls back safely',()=>{
  assert.equal(villagerDesign({id:'any',job:'wizard'}).job,'idle');
  assert.equal(villagerDesign(null).job,'idle');
  assert.equal(villagerDesign({id:null,job:'farmer'}).job,'farmer');
  assert.ok(Number.isInteger(hashVillagerId('whatever')));
});

// The standalone Node server uses a strict static-file allowlist. If the new
// imports are missing there, local Netlify looks fine but Telegram fails.
test('the optional Node server serves both new character modules',async()=>{
  const {createSkyreServer}=await import('../server/http.js');
  const server=createSkyreServer({store:{},botToken:'test-token',publicDir:process.cwd()});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const origin=`http://127.0.0.1:${server.address().port}`;
    for(const filename of ['characters.js','character-design.js']){
      const result=await fetch(`${origin}/${filename}`);
      assert.equal(result.status,200);
      assert.match(result.headers.get('content-type'),/javascript/);
      assert.ok((await result.text()).length>300);
    }
    const privateFile=await fetch(`${origin}/tests/characters.test.mjs`);
    assert.equal(privateFile.status,404);
  }finally{
    await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
  }
});
