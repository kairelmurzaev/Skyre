import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../server/db.js';
import {createSkyreServer} from '../server/http.js';
import {sign,token,now} from './auth.test.mjs';

let k=0;
const req=(type,more={})=>({type,...more});
const id=()=>`testrequest${String(++k).padStart(10,'0')}`;
test('world isolation, opt-in pairing, server-authoritative commands, idempotency and persistent restart',()=>{
  const dir=mkdtempSync(join(tmpdir(),'skyre-db-')),file=join(dir,'db.sqlite');
  let store=openStore(file);
  try{
    let a=store.state('world-A',now),b=store.state('world-B',now);
    assert.equal(a.linked,false);assert.equal(a.game.a.resources.seeds,9);
    assert.notEqual(a.game.a.name,b.game.a.name);
    let first=store.dispatch('world-A',id(),req('connect'),now);
    assert.equal(first.linked,false);assert.equal(first.looking,true);
    let joined=store.dispatch('world-B',id(),req('connect'),now);
    assert.equal(joined.linked,true);
    a=store.state('world-A',now);assert.equal(a.linked,true);
    const beforeB=store.state('world-B',now).game.a.resources.seeds;
    const seedId=id();
    let sent=store.dispatch('world-A',seedId,req('seed'),now);
    assert.equal(sent.error,undefined);
    assert.equal(store.state('world-B',now).game.a.resources.seeds,beforeB+2);
    assert.equal(store.dispatch('world-A',seedId,req('seed'),now).duplicate,true);
    assert.equal(store.state('world-B',now).game.a.resources.seeds,beforeB+2);
    // Spoofing world IDs in a command cannot write another group's buildings.
    const x=store.dispatch('world-A',id(),req('build',{building:'plot',x:2,z:2,rotation:0,group:'b'}),now);
    assert.equal(x.error,undefined);
    assert.ok(store.state('world-A',now).game.a.buildings.some(b=>b.x===2&&b.z===2));
    assert.equal(store.state('world-B',now).game.a.buildings.some(b=>b.x===2&&b.z===2),false);
    const before=store.state('world-A',now).game.a.resources.wood;
    const invalid=store.dispatch('world-A',id(),req('build',{building:'plot',x:200,z:0,rotation:0}),now);
    assert.match(invalid.error,/Invalid/);
    assert.equal(store.state('world-A',now).game.a.resources.wood,before);
    store.dispatch('world-A',id(),req('lamp'),now);
    assert.equal(store.state('world-B',now).game.game,undefined);
    assert.equal(store.state('world-B',now).game.b.lamp,true);
    store.close();store=openStore(file);
    assert.equal(store.state('world-A',now).game.a.buildings.some(b=>b.x===2&&b.z===2),true);
    assert.equal(store.state('world-B',now).game.a.resources.seeds,beforeB+2);
  }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('HTTP refuses unsigned requests and accepts validated Telegram requests',async()=>{
  const store=openStore(':memory:');
  const server=createSkyreServer({store,botToken:token,publicDir:join(import.meta.dirname,'..'),now:()=>now});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    assert.equal((await fetch(base+'/api/health')).status,200);
    assert.equal((await fetch(base+'/api/world')).status,401);
    assert.equal((await fetch(base+'/api/world',{headers:{'x-telegram-init-data':sign('111','private')}})).status,403);
    const headers={'x-telegram-init-data':sign('111')};
    let r=await fetch(base+'/api/world',{headers});assert.equal(r.status,200);
    assert.equal((await r.json()).linked,false);
    r=await fetch(base+'/api/action',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({requestId:id(),command:{type:'gather',kind:'wood'}})});
    assert.equal(r.status,200);
    assert.equal((await r.json()).game.a.resources.wood,40);
    const origin=await fetch(base+'/api/world',{headers:{...headers,Origin:'https://evil.example'}});
    assert.equal(origin.status,403);
    const evil=await fetch(base+'/api/action',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({requestId:id(),command:{type:'build',x:2,z:2,building:'plot',rotation:0}})});
    assert.equal(evil.status,200);
    const stale=await fetch(base+'/api/world',{headers});assert.equal((await stale.json()).game.a.resources.wood,37);
    const massive=await fetch(base+'/api/action',{method:'POST',headers:{...headers,'content-type':'application/json'},body:'{'+ 'x'.repeat(5000)});
    assert.equal(massive.status,413);
    assert.equal((await fetch(base+'/core.js')).status,200);
    assert.equal((await fetch(base+'/terrain.js')).status,200);
    // Telegram Web can host a Mini App in a cross-site iframe.
    assert.equal((await fetch(base+'/')).headers.get('x-frame-options'),null);
    assert.equal((await fetch(base+'/.env')).status,404);
  }finally{await new Promise(resolve=>server.close(resolve));store.close();}
});
test('multiple signed group members share one world, and separate groups affect each other only after pairing',async()=>{
  const store=openStore(':memory:');
  const server=createSkyreServer({store,botToken:token,publicDir:join(import.meta.dirname,'..'),now:()=>now});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const h=(inst,member=45)=>({'x-telegram-init-data':sign(inst,'group',member)});
  const get=async(inst,member)=>{const r=await fetch(base+'/api/world',{headers:h(inst,member)});assert.equal(r.status,200);return r.json()};
  const action=async(inst,command,member=45)=>{const r=await fetch(base+'/api/action',{method:'POST',headers:{...h(inst,member),'content-type':'application/json'},body:JSON.stringify({requestId:id(),command})});return r.json()};
  try{
    await get('4444',10);
    await action('4444',{type:'lamp'},10);
    assert.equal((await get('4444',11)).game.a.lamp,true);
    const b=await get('5555',12);assert.equal(b.game.a.lamp,false);assert.equal(b.linked,false);
    await action('4444',{type:'connect'},10);
    assert.equal((await get('4444',11)).linked,false);
    await action('5555',{type:'connect'},12);
    const joined=await get('5555',12);
    assert.equal(joined.linked,true);assert.equal(joined.game.b.lamp,true);
    const sent=await action('5555',{type:'seed'},12);
    assert.equal(sent.error,undefined);
    assert.equal((await get('4444',11)).game.a.resources.seeds,11);
    const privateChat=await fetch(base+'/api/world',{headers:{'x-telegram-init-data':sign('6666','private',33)}});
    assert.equal(privateChat.status,403);
  }finally{await new Promise(resolve=>server.close(resolve));store.close();}
});
