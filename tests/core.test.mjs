import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,buildAt,findAt,removeAt,plant,harvest,growth,gather,processBuilding,sendSeed,received,saveGame,loadGame,moveAt,rotateAt,GOALS,goalReady,claimGoal,harvestOrchard,orchardReady,ORCHARD_MS} from '../core.js';

test('initial villages are independent with gardens and resources',()=>{
  const g=newGame();assert.equal(g.a.buildings.filter(b=>b.type==='plot').length,3);
  assert.equal(g.b.resources.seeds,9);assert.equal(received(g,'b').sun,false);
});
test('building uses resources, respects occupied cells, and returns half on removal',()=>{
  const w=newGame().a;
  assert.equal(buildAt(w,'plot',3,0),null);assert.equal(w.resources.wood,32);
  assert.match(buildAt(w,'plot',3,0),/occupied/);assert.match(buildAt(w,'plot',9,9),/island/);
  assert.equal(removeAt(w,3,0),null);assert.equal(w.resources.wood,33);
});
test('plant and harvest use timestamps, yield resources and refuse premature harvest',()=>{
  const g=newGame(),now=Date.now();
  assert.equal(plant(g,'a',-2,0,'wheat',now),null);assert.equal(g.a.resources.seeds,8);
  assert.match(plant(g,'a',-2,0,'wheat',now),/already/);
  assert.match(harvest(g,'a',-2,0,now+1000),/growing/);
  assert.equal(growth(g,'a',findAt(g.a,-2,0),now+31000),1);
  assert.equal(harvest(g,'a',-2,0,now+31000),null);
  assert.equal(g.a.resources.wheat,4);assert.equal(g.a.resources.seeds,9);
});
test('sunlight speeds crops without being required, moonlight adds coins',()=>{
  const g=newGame(),now=Date.now();plant(g,'a',-2,0,'moonflower',now);
  assert.ok(growth(g,'a',findAt(g.a,-2,0),now+53000)<1);
  g.b.lamp=true;g.b.mirror=2;
  assert.equal(growth(g,'a',findAt(g.a,-2,0),now+53000),1);
  assert.equal(harvest(g,'a',-2,0,now+53000),null);assert.equal(g.a.resources.coins,11);
});
test('resource gathering has a cooldown',()=>{
  const w=newGame().a,now=Date.now();assert.equal(gather(w,'wood',now),null);
  assert.match(gather(w,'wood',now+10),/regrowing/);
  assert.equal(gather(w,'wood',now+12001),null);assert.equal(w.resources.wood,45);
});
test('production chain and shared seeds',()=>{
  const g=newGame(),w=g.a;
  assert.equal(buildAt(w,'windmill',0,2),null);
  assert.equal(buildAt(w,'bakery',1,2),null);
  w.resources.wheat=3;assert.equal(processBuilding(w,'windmill'),null);
  assert.equal(w.resources.flour,2);
  assert.equal(processBuilding(w,'bakery'),null);
  assert.equal(w.resources.food,10);assert.equal(w.resources.coins,4);
  const before=g.b.resources.seeds;assert.equal(sendSeed(g,'a'),null);
  assert.equal(g.b.resources.seeds,before+2);
});
test('save and load retains two village states',()=>{
  const m=new Map(),storage={getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v)};
  const g=newGame();g.a.lamp=true;saveGame(storage,g);
  const r=loadGame(storage);assert.equal(r.a.lamp,true);assert.equal(r.b.lamp,false);
});


test('relocating an existing building preserves crops and inventory',()=>{
  const g=newGame(),w=g.a,now=180000000;
  const before={...w.resources};
  assert.equal(plant(g,'a',-2,0,'wheat',now),null);
  const planted=findAt(w,-2,0).crop;
  assert.equal(moveAt(w,-2,0,0,3),null);
  assert.equal(findAt(w,0,3).crop,planted);
  assert.equal(findAt(w,-2,0),undefined);
  assert.equal(w.resources.wood,before.wood);
  assert.match(moveAt(w,0,3,1,-1),/occupied/);
  assert.match(moveAt(w,0,3,9,9),/island/);
  assert.match(moveAt(w,0,3,0,3),/different/);
});
test('rotating buildings is persisted and wraps correctly',()=>{
  const w=newGame().a,b=findAt(w,1,-1);
  for(let i=0;i<4;i++)assert.equal(rotateAt(w,1,-1),null);
  assert.equal(b.rotation,0);
  assert.match(rotateAt(w,4,4),/existing/);
});
test('Dream Orchard produces food and seeds only when mature',()=>{
  const w=newGame().a;
  assert.equal(buildAt(w,'orchard',2,1),null);
  const orchard=findAt(w,2,1),now=10000000;
  orchard.placedAt=now;
  assert.equal(orchardReady(orchard,now+ORCHARD_MS-1),false);
  assert.match(harvestOrchard(w,2,1,now+ORCHARD_MS-1),/more time/);
  const food=w.resources.food,seeds=w.resources.seeds;
  assert.equal(harvestOrchard(w,2,1,now+ORCHARD_MS),null);
  assert.equal(w.resources.food,food+4);
  assert.equal(w.resources.seeds,seeds+1);
  assert.match(harvestOrchard(w,2,1,now+ORCHARD_MS+100),/more time/);
});
test('goal rewards can be claimed only once after actual progress',()=>{
  const g=newGame(),w=g.a,now=180000000;
  assert.equal(goalReady(w,'harvest'),false);
  assert.match(claimGoal(w,'harvest'),/not finished/);
  plant(g,'a',-2,0,'wheat',now);
  assert.equal(harvest(g,'a',-2,0,now+31000),null);
  assert.equal(goalReady(w,'harvest'),true);
  const wood=w.resources.wood;
  assert.equal(claimGoal(w,'harvest'),null);
  assert.equal(w.resources.wood,wood+8);
  assert.match(claimGoal(w,'harvest'),/already/);
  assert.equal(sendSeed(g,'a'),null);
  assert.equal(goalReady(w,'neighbors'),true);
  assert.equal(claimGoal(w,'neighbors'),null);
  assert.equal(w.progress.claimed.length,2);
});
test('loading milestone-1 saves migrates village progress without erasing crops',()=>{
  const g=newGame();delete g.a.progress;delete g.b.progress;
  const now=2000000;plant(g,'a',-2,0,'carrot',now);
  const m=new Map([['skyre-village-v1',JSON.stringify(g)]]);
  const w=loadGame({getItem:k=>m.get(k)});
  assert.equal(w.a.progress.harvests,0);
  assert.deepEqual(w.b.progress.claimed,[]);
  assert.equal(findAt(w.a,-2,0).crop.kind,'carrot');
});