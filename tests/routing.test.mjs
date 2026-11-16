import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame, buildAt, moveAt, findAt, saveGame, loadGame, goalReady, claimGoal} from '../core.js';
import {syncWorkers,assignWorker,advanceGame,JOBS} from '../workers.js';
import {routeBetween,planWorkerRoute,workInterval,roadSummary,GRASS_STEP_MS,ROAD_STEP_MS} from '../routing.js';

const tile=(type,x,z)=>({id:`${type}-${x}-${z}`,type,x,z});

test('routes move only through valid cardinal grid tiles without crossing buildings',()=>{
  const world={buildings:[tile('cottage',-2,0),tile('bakery',2,0),tile('windmill',0,0)]};
  const route=routeBetween(world,{x:-2,z:0},{x:2,z:0});
  assert.ok(route);assert.deepEqual(route.points[0],{x:-2,z:0});
  assert.deepEqual(route.points.at(-1),{x:2,z:0});
  assert.ok(route.points.every(p=>p.x!==0||p.z!==0));
  for(let i=1;i<route.points.length;i++){
    const a=route.points[i-1],b=route.points[i];assert.equal(Math.abs(a.x-b.x)+Math.abs(a.z-b.z),1);
  }
});

test('stone paths give a genuine travel-time advantage without making grass unusable',()=>{
  const world={buildings:[tile('cottage',-2,0),tile('bakery',2,0)]};
  const from={x:-2,z:0},to={x:2,z:0};
  const grass=routeBetween(world,from,to);
  assert.ok(grass.ms>ROAD_STEP_MS*3);
  for(const x of [-1,0,1])world.buildings.push(tile('path',x,0));
  const paved=routeBetween(world,from,to);
  assert.equal(paved.roadSteps,3);
  assert.equal(paved.ms,ROAD_STEP_MS*3+900);
  assert.ok(paved.ms<grass.ms);
  assert.equal(paved.points.length,5);
  assert.equal(paved.grassSteps,0);
  assert.equal(GRASS_STEP_MS,1350);
});

test('route cache invalidates as structures are built, moved and removed',()=>{
  const game=newGame(),world=game.a;
  const first=routeBetween(world,{x:1,z:-1},{x:-1,z:0});
  assert.ok(first);
  assert.equal(buildAt(world,'path',0,-1),null);
  const second=routeBetween(world,{x:1,z:-1},{x:-1,z:0});
  assert.ok(second.ms<first.ms);
  assert.equal(moveAt(world,0,-1,0,-2),null);
  const third=routeBetween(world,{x:1,z:-1},{x:-1,z:0});
  assert.ok(third.ms>second.ms);
});

test('isolated buildings cannot create phantom deliveries',()=>{
  const world={buildings:[tile('cottage',0,0),tile('bakery',3,0),tile('well',1,0),tile('well',-1,0),tile('well',0,1),tile('well',0,-1)]};
  assert.equal(routeBetween(world,{x:0,z:0},{x:3,z:0}),null);
});

test('routing chooses the nearest reachable workstation and surfaces useful route stats',()=>{
  const game=newGame(),world=game.a;const now=1700000000000;
  syncWorkers(world,now);
  const farmer=world.workers[0],plan=planWorkerRoute(game,'a',farmer,now);
  assert.equal(plan.task,'plant');assert.deepEqual(plan.home,{x:1,z:-1});
  assert.equal(plan.route.points.length>1,true);
  assert.equal(roadSummary(game,'a').working,2);
  assert.equal(roadSummary(game,'a').reachable,2);
  assert.equal(buildAt(world,'path',0,-1),null);
  assert.equal(roadSummary(game,'a').roads,1);
  assert.equal(roadSummary(game,'a').roadUsers>=1,true);
});

test('road-assisted worker jobs get shorter cycles than grass-only routes',()=>{
  const game=newGame();const now=1000000;
  for(const id of ['a','b']){game[id].simulatedAt=now;syncWorkers(game[id],now)}
  const worker=game.a.workers[0];
  const before=planWorkerRoute(game,'a',worker,now);
  const originalInterval=workInterval(game.a,worker,JOBS.farmer.ms,before);
  assert.equal(buildAt(game.a,'path',0,-1),null);
  const paved=planWorkerRoute(game,'a',worker,now);
  const fasterInterval=workInterval(game.a,worker,JOBS.farmer.ms,paved);
  assert.ok(fasterInterval<originalInterval);
  advanceGame(game,now+JOBS.farmer.ms);
  const live=game.a.workers.find(w=>w.id===worker.id);
  assert.equal(live.trip.startedAt,now+JOBS.farmer.ms);
  const nextPlan=planWorkerRoute(game,'a',live,now+JOBS.farmer.ms);
  assert.equal(live.trip.endsAt-live.trip.startedAt,workInterval(game.a,live,JOBS.farmer.ms,nextPlan));
  assert.equal(live.nextAt,live.trip.endsAt);
});

test('trip timing survives save and restore; offline production is still idempotent',()=>{
  const game=newGame(),now=1700000000000;
  for(const id of ['a','b']){game[id].simulatedAt=now;syncWorkers(game[id],now)}
  advanceGame(game,now+42000);
  const before=JSON.stringify(game.a.workers.map(w=>w.trip));
  const storage=new Map(),handle={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
  saveGame(handle,game);
  const reloaded=loadGame(handle);
  syncWorkers(reloaded.a,now+42000);
  assert.equal(JSON.stringify(reloaded.a.workers.map(w=>w.trip)),before);
  const snap=JSON.stringify(reloaded.a.resources);
  advanceGame(reloaded,now+42000);
  assert.equal(JSON.stringify(reloaded.a.resources),snap);
});

test('no assigned workplace means no production and a clear null route',()=>{
  const game=newGame(),now=1700000000000;
  for(const id of ['a','b']){game[id].simulatedAt=now;syncWorkers(game[id],now)}
  const worker=game.a.workers[0];
  assert.equal(assignWorker(game.a,worker.id,'miller',now),null);
  assert.equal(planWorkerRoute(game,'a',game.a.workers[0],now),null);
  const oldWheat=game.a.resources.wheat;
  advanceGame(game,now+180000);
  assert.equal(game.a.resources.wheat,oldWheat);
  assert.equal(game.a.workStats.milled,0);
});


test('the little footsteps goal rewards roads once, without charging twice',()=>{
  const w=newGame().a;const start=w.resources.coins;
  assert.equal(goalReady(w,'pathways'),false);
  for(const pos of [[0,-1],[-1,-1],[0,0],[1,0]])assert.equal(buildAt(w,'path',...pos),null);
  assert.equal(goalReady(w,'pathways'),true);
  assert.equal(claimGoal(w,'pathways'),null);
  assert.equal(w.resources.coins,start+10);
  assert.match(claimGoal(w,'pathways'),/already/);
});
