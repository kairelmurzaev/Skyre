import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,buildAt,removeAt,findAt,received,orchardReady,saveGame,loadGame,plant} from '../core.js';
import {JOBS,MAX_OFFLINE_MS,syncWorkers,assignWorker,setAutoCrop,advanceGame} from '../workers.js';
import {buildingStock,inventoryTotals,storageCapacity} from '../logistics.js';

function setup(){
  const now=Date.now();const game=newGame();
  for(const id of ['a','b']){game[id].simulatedAt=now;syncWorkers(game[id],now);}
  return {game,now};
}
const count=result=>Object.values(result).reduce((s,v)=>s+v,0);

test('two residents per cottage, with default beginner jobs',()=>{
  const {game,now}=setup();
  assert.equal(game.a.workers.length,2);
  assert.deepEqual(game.a.workers.map(w=>w.job),['farmer','forager']);
  assert.equal(buildAt(game.a,'cottage',3,-1),null);syncWorkers(game.a,now);
  assert.equal(game.a.workers.length,4);
  assert.deepEqual(game.a.workers.slice(2).map(w=>w.job),['idle','idle']);
  assert.equal(removeAt(game.a,3,-1),null);syncWorkers(game.a,now);
  assert.equal(game.a.workers.length,2);
});

test('villagers plant, harvest, and forage without user input',()=>{
  const {game,now}=setup();
  const result=advanceGame(game,now+110000);
  assert.ok(result.a.planted>=3);
  assert.ok(result.a.harvested>=1);
  assert.ok(result.a.foraged>=2);
  assert.ok(game.a.buildings.some(b=>buildingStock(b,'wheat')>0), 'automated crops wait in farm inventory');
  assert.ok(game.a.resources.wood>35);
  assert.ok(game.a.progress.harvests>=1);
  assert.ok(game.a.workLog.length<=8);
});

test('farmers respect crop choice and will not spend seeds they do not have',()=>{
  const {game,now}=setup();
  assert.equal(setAutoCrop(game.a,'moonflower'),null);
  assert.match(setAutoCrop(game.a,'invalid'),/Choose/);
  advanceGame(game,now+26000);
  assert.ok(game.a.buildings.filter(b=>b.crop?.kind==='moonflower').length>=1);
  const {game:empty,now:t}=setup();empty.a.resources.seeds=0;
  advanceGame(empty,t+13000);
  assert.equal(empty.a.buildings.filter(b=>b.crop).length,0);
});

test('farmers, haulers, millers and bakers run an actual production chain',()=>{
  const {game,now}=setup();const w=game.a;
  w.resources.wood=250;w.resources.stone=250;w.resources.seeds=100;
  assert.equal(buildAt(w,'windmill',0,2),null);assert.equal(buildAt(w,'bakery',1,2),null);
  assert.equal(buildAt(w,'cottage',3,-1),null);
  syncWorkers(w,now);
  w.resources.wheat=15; // Goods from earlier manual harvests can enter the delivery chain.
  assert.equal(assignWorker(w,w.workers[0].id,'farmer',now),null);
  assert.equal(assignWorker(w,w.workers[1].id,'hauler',now),null);
  assert.equal(assignWorker(w,w.workers[2].id,'miller',now),null);
  assert.equal(assignWorker(w,w.workers[3].id,'baker',now),null);
  const result=advanceGame(game,now+600000);
  assert.ok(result.a.delivered>=3,'haulers complete physical transfers');
  assert.ok(result.a.milled>=1);
  assert.ok(result.a.baked>=1);
  assert.ok(w.resources.coins>=4);
  assert.ok(inventoryTotals(w).food>4);
  assert.equal(game.b.resources.coins,0);
});

test('idle and unavailable workshop workers do not invent resources',()=>{
  const {game,now}=setup();const w=game.a;
  assert.equal(assignWorker(w,w.workers[0].id,'miller',now),null);
  assert.equal(assignWorker(w,w.workers[1].id,'idle',now),null);
  const before={...w.resources};const result=advanceGame(game,now+130000);
  assert.equal(count(result.a),0);
  assert.deepEqual(w.resources,before);
});

test('worker assignments survive saving, reload does not double-pay work',()=>{
  const {game,now}=setup();
  assert.equal(assignWorker(game.a,game.a.workers[1].id,'miller',now),null);
  const first=advanceGame(game,now+90000);
  const snapshot=JSON.stringify(game.a.resources);
  assert.equal(count(advanceGame(game,now+90000).a),0);
  assert.equal(JSON.stringify(game.a.resources),snapshot);
  const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
  saveGame(storage,game);const loaded=loadGame(storage);
  syncWorkers(loaded.a,now+90000);
  assert.equal(loaded.a.workers[1].job,'miller');
  assert.equal(count(advanceGame(loaded,now+90000).a),0);
  assert.equal(loaded.a.workStats.foraged,first.a.foraged);
});

test('old saved villages migrate safely without losing planted crops',()=>{
  const {game,now}=setup();plant(game,'a',-2,0,'carrot',now);
  delete game.a.workers;delete game.a.workStats;delete game.a.autoCrop;
  delete game.a.simulatedAt;delete game.a.workLog;
  const m=new Map(),s={getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v)};
  saveGame(s,game);
  const loaded=loadGame(s);const result=advanceGame(loaded,now+100000);
  assert.equal(count(result.a),0);
  assert.equal(findAt(loaded.a,-2,0).crop.kind,'carrot');
  assert.equal(loaded.a.workers.length,2);
  assert.equal(loaded.a.autoCrop,'wheat');
});

test('neighbor windmill creates a breeze that speeds orchards',()=>{
  const {game,now}=setup();
  buildAt(game.a,'orchard',2,1);const orchard=findAt(game.a,2,1);orchard.placedAt=now;
  assert.equal(orchardReady(orchard,now+75000,false),false);
  buildAt(game.b,'windmill',0,2);
  assert.equal(received(game,'a').breeze,true);
  assert.equal(orchardReady(orchard,now+75000,received(game,'a').breeze),true);
});

test('offline catchup capped and never allows endless inventory inflation',()=>{
  const {game,now}=setup();
  const result=advanceGame(game,now+2*24*60*60*1000);
  assert.ok(count(result.a)>1);
  assert.ok(game.a.resources.wood<=250);
  assert.ok(game.a.resources.stone<=250);
  assert.ok(game.a.workLog.length<=8);
  assert.equal(game.a.simulatedAt,now+2*24*60*60*1000);
  assert.equal(count(advanceGame(game,now+2*24*60*60*1000).a),0);
  assert.equal(MAX_OFFLINE_MS,4*3600000);
});

test('invalid worker jobs and missing workers cannot be assigned',()=>{
  const {game,now}=setup();
  assert.match(assignWorker(game.a,'not-found','farmer',now),/no longer lives/);
  assert.match(assignWorker(game.a,game.a.workers[0].id,'wizard',now),/valid/);
  assert.equal(Object.keys(JOBS).length,6);
});


test('large villages do not replay missed cycles after safety limit',()=>{
  const {game,now}=setup();const w=game.a;w.resources.wood=1500;w.resources.stone=1500;
  const sites=[[2,1],[2,2],[-3,-1],[-3,1],[1,3],[3,1],[0,-3]];
  for(const [x,z] of sites)assert.equal(buildAt(w,'cottage',x,z),null);
  syncWorkers(w,now);assert.equal(w.workers.length,16);
  for(const worker of w.workers)assignWorker(w,worker.id,'farmer',now);
  advanceGame(game,now+MAX_OFFLINE_MS);
  assert.ok(w.workers.every(v=>v.nextAt>now+MAX_OFFLINE_MS));
  assert.equal(count(advanceGame(game,now+MAX_OFFLINE_MS+1000).a),0);
});
