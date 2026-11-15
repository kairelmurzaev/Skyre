import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,buildAt,findAt,removeAt,plant,harvest,growth,gather,processBuilding,sendSeed,received,saveGame,loadGame} from '../core.js';

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