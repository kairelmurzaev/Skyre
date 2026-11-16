// Deterministic, grid-based walking routes. Model only; no Three.js dependency.
// Grass is always traversable; a constructed Stone Path is faster, not mandatory.
import {within, findAt, growth, orchardReady, received} from './core.js';

export const GRASS_STEP_MS = 1350;
export const ROAD_STEP_MS = 400;
export const DOOR_STEP_MS = 900;
const DIRS = [[-1,0],[0,-1],[0,1],[1,0]];
const key = (x,z) => `${x},${z}`;
const routeCache=new WeakMap();
function routingState(world){
  const signature=world.buildings.map(b=>`${b.type}:${b.x},${b.z}`).join('|');
  let state=routeCache.get(world);
  if(!state||state.signature!==signature){
    state={signature,occupied:new Map(world.buildings.map(b=>[key(b.x,b.z),b.type])),routes:new Map()};
    routeCache.set(world,state);
  }
  return state;
}

/** Dijkstra over the playable island. Paths can start/end at buildings but cannot pass through other structures.
 * Stable tie-breaking makes offline and online simulations deterministic.
 */
export function routeBetween(world, from, to) {
  if (!from || !to || !within(from.x,from.z) || !within(to.x,to.z)) return null;
  const source=key(from.x,from.z),goal=key(to.x,to.z);
  const state=routingState(world),routeKey=`${source}>${goal}`;
  if(state.routes.has(routeKey))return state.routes.get(routeKey);
  if(source===goal)return {points:[{x:from.x,z:from.z}],ms:0,roadSteps:0,grassSteps:0};
  const dist=new Map([[source,0]]), prev=new Map(), visited=new Set();
  while(true){
    let current=null,score=Infinity;
    for(const [tile,d] of dist){
      if(visited.has(tile))continue;
      if(d<score||(d===score&&tile<current)){current=tile;score=d}
    }
    if(current===null)break;
    if(current===goal)break;
    visited.add(current);
    const [x,z]=current.split(',').map(Number);
    for(const [dx,dz] of DIRS){
      const nx=x+dx,nz=z+dz,nk=key(nx,nz);
      if(!within(nx,nz)||visited.has(nk))continue;
      const at=state.occupied.get(nk);
      if(at && at!=='path' && nk!==goal)continue;
      const step=nk===goal ? DOOR_STEP_MS : at==='path' ? ROAD_STEP_MS : GRASS_STEP_MS;
      const next=score+step;
      if(next<(dist.get(nk)??Infinity)){
        dist.set(nk,next);prev.set(nk,current);
      }
    }
  }
  if(!dist.has(goal)){state.routes.set(routeKey,null);return null;}
  const reversed=[];let cursor=goal;
  while(cursor){const [x,z]=cursor.split(',').map(Number);reversed.push({x,z});if(cursor===source)break;cursor=prev.get(cursor)}
  if(cursor!==source)return null;
  const points=reversed.reverse();
  let roadSteps=0,grassSteps=0;
  for(let i=1;i<points.length-1;i++){
    if(state.occupied.get(key(points[i].x,points[i].z))==='path')roadSteps++;
    else grassSteps++;
  }
  const result={points,ms:dist.get(goal),roadSteps,grassSteps};
  state.routes.set(routeKey,result);
  return result;
}

const gatheringSpots=[{x:-3,z:2},{x:3,z:2},{x:-3,z:-2},{x:3,z:-2}];

/** Get the route to an actual workplace. Farmer priority: ripe crops, ripe orchards, empty plots,
 * then unripe plots; routes choose the fastest reachable candidate in that tier.
 */
export function planWorkerRoute(game,id,worker,at=Date.now()){
  const world=game[id], home=world?.buildings.find(b=>b.id===worker?.homeId&&b.type==='cottage');
  if(!home||!worker||worker.job==='idle')return null;
  let tiers=[];
  if(worker.job==='farmer'){
    const plots=world.buildings.filter(b=>b.type==='plot');
    const ripe=plots.filter(b=>b.crop&&growth(game,id,b,at)>=1);
    const orchard=world.buildings.filter(b=>b.type==='orchard'&&orchardReady(b,at,received(game,id).breeze));
    const empty=plots.filter(b=>!b.crop);
    const pending=plots.filter(b=>b.crop);
    tiers=[['harvest',ripe],['orchard',orchard],['plant',empty],['tend',pending],['tend',world.buildings.filter(b=>b.type==='orchard')]];
  }else if(worker.job==='miller')tiers=[['mill',world.buildings.filter(b=>b.type==='windmill')]];
  else if(worker.job==='baker')tiers=[['bake',world.buildings.filter(b=>b.type==='bakery')]];
  else if(worker.job==='forager')tiers=[['forage',gatheringSpots]];
  for(const [task,candidates] of tiers){
    let best=null;
    for(const dest of candidates){
      const route=routeBetween(world,home,dest);
      if(!route)continue;
      const result={home:{x:home.x,z:home.z},target:{x:dest.x,z:dest.z},route,task};
      if(!best || route.ms<best.route.ms || (route.ms===best.route.ms && key(dest.x,dest.z)<key(best.target.x,best.target.z)))best=result;
    }
    if(best)return best;
  }
  return null;
}

/** Roads affect actual job throughput. Includes a return trip; keeps a minimum to preserve cozy pacing. */
export function workInterval(world,worker,jobMs,plan){
  if(!plan)return jobMs;
  return jobMs+plan.route.ms*2;
}

export function roadSummary(game,id,at=Date.now()){
  const world=game[id];
  const roads=world.buildings.filter(b=>b.type==='path').length;
  const working=(world.workers||[]).filter(w=>w.job!=='idle');
  const routes=working.map(w=>planWorkerRoute(game,id,w,at));
  const reachable=routes.filter(Boolean).length;
  const roadUsers=routes.filter(r=>r?.route.roadSteps>0).length;
  return {roads,working:working.length,reachable,roadUsers};
}
