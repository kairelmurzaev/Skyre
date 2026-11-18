import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,loadGame,saveGame,SAVE_KEY} from '../core.js';
import {syncWorkers,advanceGame} from '../workers.js';
import {executeAction} from '../server/actions.js';
import {openStore} from '../server/db.js';
import {
 DESK_SITES,DESK_BUILDS,DESK_OBJECTS,DESK_TRIP_MS,ensureDesk,deskAt,
 buildOnDesk,removeFromDesk,collectDeskObject,startDeskExpedition,advanceDesk
} from '../desk.js';
import {readFile} from 'node:fs/promises';

test('old saves migrate desk state without removing existing progress',()=>{
 const game=newGame();delete game.a.desk;delete game.b.desk;
 game.a.resources.wood=101;game.a.landLevel=1;
 const backing=new Map([[SAVE_KEY,JSON.stringify(game)]]);
 const storage={getItem:k=>backing.get(k),setItem:(k,v)=>backing.set(k,v)};
 const loaded=loadGame(storage);
 assert.equal(loaded.a.resources.wood,101);
 assert.equal(loaded.a.landLevel,1);
 assert.deepEqual(loaded.a.desk.builds,[]);
 assert.deepEqual(loaded.b.desk.builds,[]);
 assert.equal(loaded.a.desk.finds,0);
 saveGame(storage,loaded);
 assert.equal(JSON.parse(backing.get(SAVE_KEY)).a.resources.wood,101);
});
test('desk sites are valid, buildable only once, and have visible prices',()=>{
 const world=newGame().a;
 assert.equal(DESK_SITES.length,4);
 assert.ok(Object.keys(DESK_BUILDS).length>=5);
 const oldWood=world.resources.wood,oldStone=world.resources.stone;
 assert.equal(buildOnDesk(world,'crossing','bridge'),null);
 assert.equal(world.resources.wood,oldWood-10);
 assert.equal(world.resources.stone,oldStone-3);
 assert.equal(deskAt(world,'crossing').type,'bridge');
 assert.match(buildOnDesk(world,'crossing','bridge'),/already/i);
 assert.match(buildOnDesk(world,'crossing','camp'),/cannot/i);
 assert.match(buildOnDesk(world,'anything','bridge'),/cannot/i);
 assert.equal(removeFromDesk(world,'crossing'),null);
 assert.equal(world.resources.wood,oldWood-10+5);
 assert.equal(world.resources.stone,oldStone-3+1);
 assert.equal(deskAt(world,'crossing'),null);
});
test('desk object collection is rate-limited and awards exact resources',()=>{
 const world=newGame().a;
 const start=100000;
 assert.equal(collectDeskObject(world,'mug',start),null);
 assert.equal(world.resources.seeds,11);
 assert.equal(world.resources.coins,1);
 assert.match(collectDeskObject(world,'mug',start+2),/time/i);
 assert.equal(collectDeskObject(world,'plant',start+10),null);
 assert.equal(world.resources.seeds,14);
 assert.match(collectDeskObject(world,'books',start),/Choose/i);
 assert.equal(collectDeskObject(world,'mug',start+DESK_OBJECTS.mug.cooldown),null);
 assert.equal(world.resources.seeds,16);
});
test('expeditions need an actual bridge and living villager',()=>{
 const world=newGame().a;syncWorkers(world,100000);
 assert.match(startDeskExpedition(world,100000),/Footbridge/i);
 assert.equal(buildOnDesk(world,'crossing','bridge'),null);
 assert.equal(startDeskExpedition(world,100000),null);
 assert.ok(world.workers.some(w=>w.id===world.desk.expedition.workerId));
 assert.match(startDeskExpedition(world,100001),/already/i);
 assert.match(removeFromDesk(world,'crossing'),/explorer/i);
 assert.equal(advanceDesk(world,100000+DESK_TRIP_MS-1),0);
 assert.equal(world.desk.finds,0);
 assert.equal(advanceDesk(world,100000+DESK_TRIP_MS),1);
 assert.equal(world.desk.finds,1);
 assert.equal(world.resources.coins,6);
 assert.equal(world.resources.seeds,10);
 assert.equal(advanceDesk(world,100000+DESK_TRIP_MS+1000),0);
 assert.equal(world.resources.coins,6);
 assert.equal(world.desk.expedition,null);
});
test('worker simulation completes an expedition only once after offline catch-up',()=>{
 const game=newGame();syncWorkers(game.a,150000);
 assert.equal(buildOnDesk(game.a,'crossing','bridge'),null);
 assert.equal(startDeskExpedition(game.a,150000),null);
 game.a.simulatedAt=150000;
 assert.equal(advanceGame(game,150000+DESK_TRIP_MS+1).a.desk,1);
 const coins=game.a.resources.coins;
 advanceGame(game,150000+DESK_TRIP_MS+1000);
 assert.equal(game.a.resources.coins,coins);
 assert.equal(game.a.desk.finds,1);
});
test('remote commands use the same desk rules and reject invalid actions',()=>{
 const game=newGame(),w=game.a;
 syncWorkers(w,200000);
 assert.match(executeAction(game,{type:'deskExplore'},false,200000).error,/Footbridge/);
 assert.equal(executeAction(game,{type:'deskBuild',site:'crossing',building:'bridge'},false,200000).error,undefined);
 assert.equal(executeAction(game,{type:'deskExplore'},false,200000).error,undefined);
 assert.match(executeAction(game,{type:'deskRemove',site:'crossing'},false,200000).error,/Wait for/);
 assert.match(executeAction(game,{type:'deskBuild',site:'../../etc',building:'bridge'},false,200000).error,/cannot/);
 assert.equal(executeAction(game,{type:'deskCollect',object:'mug'},false,200000).error,undefined);
 assert.match(executeAction(game,{type:'deskCollect',object:'mug'},false,200001).error,/time/);
 assert.match(executeAction(game,{type:'deskCollect',object:'unknown'},false,200001).error,/Choose/);
});
test('SQLite stores new desk structures and a running expedition across requests',()=>{
 const store=openStore(':memory:');
 try{
  const id='desk-world-qa',t=1760000000000;
  store.state(id,t);
  const b=store.dispatch(id,'unique-desk-build-one',{type:'deskBuild',site:'crossing',building:'bridge'},t);
  assert.equal(b.error,undefined);
  const launch=store.dispatch(id,'unique-desk-explore',{type:'deskExplore'},t);
  assert.equal(launch.error,undefined);
  assert.ok(launch.game.a.desk.expedition);
  const done=store.state(id,t+DESK_TRIP_MS+1);
  assert.equal(done.game.a.desk.finds,1);
  assert.equal(done.game.a.desk.expedition,null);
  assert.equal(store.state(id,t+DESK_TRIP_MS+2000).game.a.desk.finds,1);
 }finally{store.close();}
});
test('browser shell and optional server expose interactive desk mode',async()=>{
 const read=async path=>readFile(new URL(path,import.meta.url),'utf8');
 const app=await read('../app.js'),scene=await read('../scene.js');
 const art=await read('../desk-art.js'),shell=await read('../game-shell.js');
 const html=await read('../index.html'),http=await read('../server/http.js');
 assert.match(html,/id="skyre-desk-button"/);
 assert.match(html,/id="desk-landmarks"/);
 assert.match(html,/data-more-open="desk"/);
 assert.match(shell,/'desk':\{panel:'\.desk-section'/);
 assert.match(app,/renderDesk\(\)/);
 assert.match(app,/startDeskExpedition/);
 assert.match(scene,/deskArt\.refresh/);
 assert.match(scene,/deskArt\.animate/);
 assert.match(art,/kind:'desk-object'/);
 assert.match(http,/'desk\.js','desk-art\.js'/);
});

