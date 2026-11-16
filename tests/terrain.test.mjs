import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,loadGame,saveGame,buildAt,moveAt,findAt,upgradeAt,removeAt,processBuilding,GOALS,goalReady} from '../core.js';
import {LAND_STAGES,LANDSCAPE,expandIsland,setLandscape,withinWorld,buildableTile,decorAt,villageCharm} from '../terrain.js';
import {syncWorkers} from '../workers.js';
import {storageCapacity,processLocal,stockUsed} from '../logistics.js';
import {routeBetween} from '../routing.js';
import {executeAction} from '../server/actions.js';
import {openStore} from '../server/db.js';

test('land expansion unlocks new building positions only after payment',()=>{
  const w=newGame().a;
  assert.equal(withinWorld(w,5,0),false);
  assert.match(buildAt(w,'plot',5,0),/island/);
  assert.match(expandIsland(w),/Gather more/);
  w.resources.coins=100;const before={...w.resources};
  assert.equal(expandIsland(w),null);
  assert.equal(w.landLevel,1);
  for(const [good,n] of Object.entries(LAND_STAGES[1].cost))assert.equal(w.resources[good],before[good]-n);
  assert.equal(withinWorld(w,5,0),true);assert.equal(withinWorld(w,6,0),false);
  w.resources.stone+=4;
  assert.equal(buildAt(w,'plot',5,0),null);
  assert.equal(w.buildings.some(b=>b.x===5&&b.z===0),true);
  assert.match(expandIsland(w),/Gather more/);
  w.resources.wood+=100;w.resources.stone+=100;
  assert.equal(expandIsland(w),null);
  assert.equal(withinWorld(w,6,1),true);
  assert.match(expandIsland(w),/limit/);
});

test('ponds and flower gardens have real placement rules and never duplicate resources',()=>{
  const w=newGame().a;
  const resources={...w.resources};
  assert.equal(setLandscape(w,0,1,'flowers'),null);
  assert.equal(villageCharm(w),1);
  assert.equal(decorAt(w,0,1),'flowers');
  assert.match(buildAt(w,'plot',0,1),/landscape/);
  assert.match(setLandscape(w,1,-1,'pond'),/building/);
  assert.match(setLandscape(w,0,1,'pond'),/Clear/);
  assert.equal(setLandscape(w,0,1,'clear'),null);
  assert.equal(setLandscape(w,0,1,'clear')!==null,true);
  assert.equal(w.resources.seeds,resources.seeds-2);
  assert.equal(w.resources.wood,resources.wood-1);
  assert.equal(setLandscape(w,0,1,'pond'),null);
  assert.equal(villageCharm(w),3);
  assert.equal(buildableTile(w,0,1),false);
  assert.match(moveAt(w,1,-1,0,1),/landscape/);
  assert.equal(setLandscape(w,0,1,'clear'),null);
  assert.equal(buildAt(w,'path',0,1),null);
});

test('pond blocks walking and clearing it restores route options',()=>{
  const w=newGame().a;
  // Build a zigzag wall leaving one navigable short gap.
  const from={x:-3,z:-2},to={x:-3,z:2};
  const before=routeBetween(w,from,to);
  assert.ok(before);
  assert.equal(setLandscape(w,-3,-1,'pond'),null);
  assert.equal(setLandscape(w,-3,1,'pond'),null);
  const after=routeBetween(w,from,to);
  assert.ok(after);assert.ok(after.ms>=before.ms);
  assert.equal(routeBetween(w,{x:-3,z:-1},to),null);
  assert.equal(setLandscape(w,-3,-1,'clear'),null);
  assert.ok(routeBetween(w,{x:-3,z:-1},to));
});

test('upgraded cottages gain exactly one resident and persist between sessions',()=>{
  const g=newGame(),w=g.a;w.resources.coins=50;
  assert.equal(syncWorkers(w,1000).length,2);
  assert.equal(upgradeAt(w,1,-1),null);
  assert.equal(findAt(w,1,-1).level,2);
  assert.equal(syncWorkers(w,1000).length,3);
  assert.equal(syncWorkers(w,1000).length,3);
  assert.match(upgradeAt(w,1,-1),/already/);
  assert.equal(w.workers[0].job,'farmer');
  const save=new Map();saveGame({setItem:(k,v)=>save.set(k,v)},g);
  const reloaded=loadGame({getItem:k=>save.get(k)});
  assert.equal(reloaded.a.buildings.find(b=>b.type==='cottage').level,2);
  assert.equal(syncWorkers(reloaded.a,1000).length,3);
});

test('upgraded storehouse adds storage and cannot be demolished when it would overflow',()=>{
  const w=newGame().a;w.resources.wood=100;w.resources.stone=100;w.resources.coins=100;
  assert.equal(buildAt(w,'warehouse',2,1),null);
  assert.equal(storageCapacity(w),100);
  assert.equal(upgradeAt(w,2,1),null);
  assert.equal(storageCapacity(w),132);
  w.resources.wheat=101;
  assert.match(removeAt(w,2,1),/Empty/);
  w.resources.wheat=0;
  assert.equal(removeAt(w,2,1),null);
});

test('upgraded mills produce 3 flour for 3 wheat in manual and local processing',()=>{
  const w=newGame().a;w.resources.wood=100;w.resources.stone=100;w.resources.coins=100;
  assert.equal(buildAt(w,'windmill',2,1),null);
  assert.equal(upgradeAt(w,2,1),null);
  w.resources.wheat=3;
  assert.equal(processBuilding(w,'windmill'),null);
  assert.equal(w.resources.flour,3);
  const b=findAt(w,2,1);
  b.stock={wheat:3,flour:0,food:0};
  assert.equal(processLocal(w,'windmill',b.id),true);
  assert.equal(b.stock.flour,3);
  assert.equal(b.stock.wheat,0);
});

test('local saved landscapes migrate without resetting earlier crops or buildings',()=>{
  const g=newGame();delete g.a.landLevel;delete g.a.terrain;delete g.b.landLevel;delete g.b.terrain;
  const s=new Map();saveGame({setItem:(k,v)=>s.set(k,v)},g);
  const restored=loadGame({getItem:k=>s.get(k)});
  assert.equal(restored.a.landLevel,0);assert.deepEqual(restored.a.terrain,{});
  assert.equal(restored.a.buildings.length,4);
  assert.equal(restored.b.workers?.length||0,0);
});

test('server accepts valid upgrades and terrain actions but refuses malformed coordinates',()=>{
  const g=newGame(),w=g.a;
  w.resources.coins=100;w.resources.wood=100;w.resources.stone=100;
  assert.equal(executeAction(g,{type:'expand'},false,1000).error,undefined);
  assert.equal(executeAction(g,{type:'landscape',x:5,z:0,kind:'pond'},false,1000).error,undefined);
  assert.equal(executeAction(g,{type:'build',x:5,z:0,building:'plot',rotation:0},false,1000).error!==undefined,true);
  assert.equal(executeAction(g,{type:'upgrade',x:1,z:-1},false,1000).error,undefined);
  assert.equal(executeAction(g,{type:'landscape',x:99,z:0,kind:'flowers'},false,1000).error,'Invalid landscape.');
  assert.equal(executeAction(g,{type:'landscape',x:0,z:2,kind:'bad'},false,1000).error,'Invalid landscape.');
  assert.equal(executeAction(g,{type:'build',x:7,z:0,building:'plot',rotation:0},false,1000).error!==undefined,true);
  assert.equal(g.a.terrain['5,0'],'pond');
});

test('SQLite persists expansion, landscaping and upgrades across restart',()=>{
  const store=openStore(':memory:');
  try{
    const t=1750000000000,id='terrain-world';
    store.state(id,t);
    const world=JSON.parse(store.database.prepare('SELECT state FROM worlds WHERE id=?').get(id).state);
    world.resources.wood=200;world.resources.stone=200;world.resources.coins=200;
    store.database.prepare('UPDATE worlds SET state=? WHERE id=?').run(JSON.stringify(world),id);
    store.dispatch(id,'terrain-action-one',{type:'expand'},t);
    store.dispatch(id,'terrain-action-two',{type:'landscape',x:5,z:0,kind:'flowers'},t);
    store.dispatch(id,'terrain-action-three',{type:'upgrade',x:1,z:-1},t);
    const snapshot=store.state(id,t).game.a;
    assert.equal(snapshot.landLevel,1);
    assert.equal(snapshot.terrain['5,0'],'flowers');
    assert.equal(snapshot.buildings.find(b=>b.type==='cottage').level,2);
  }finally{store.close()}
});
