import {buildingStock,buildingFree,ensureStocks,processLocal,completeDelivery} from './logistics.js';
// Villager automation, independent of the renderer and browser storage.
// Workers only change their own world; their actions never require another group online.
import {CROP, plant, received} from './core.js';
import {planWorkerRoute, workInterval} from './routing.js';

export const JOBS = {
  idle:   {name:'Rest', icon:'☕', detail:'Wanders and enjoys the village', ms:30000},
  farmer: {name:'Farmer', icon:'🌱', detail:'Plants and harvests your selected crop', ms:12000},
  miller: {name:'Miller', icon:'🌾', detail:'Turns 3 wheat into 2 flour at a windmill', ms:20000},
  baker:  {name:'Baker', icon:'🥖', detail:'Turns 2 flour into bread and coins', ms:24000},
  forager:{name:'Forager', icon:'🪵', detail:'Gathers wood and stone for building', ms:28000},
  hauler: {name:'Hauler', icon:'📦', detail:'Delivers wheat, flour and food along walking routes', ms:6000}
};
export const MAX_OFFLINE_MS=4*60*60*1000; // Prevent runaway inflation and excessive processing.
const FIRST_NAMES=['Mira','Pip','Sol','Lumi','Nori','Fern','Ari','Cleo','Briar','Rin','Taro','Wren'];
const STATS=()=>({planted:0,harvested:0,foraged:0,milled:0,baked:0,orchards:0,delivered:0});

export function syncWorkers(world,now=Date.now()){
  ensureStocks(world);
  if(!Number.isFinite(world.simulatedAt)||world.simulatedAt<0)world.simulatedAt=now;
  if(!Array.isArray(world.workers))world.workers=[];
  if(!Array.isArray(world.workLog))world.workLog=[];
  world.workStats={...STATS(),...(world.workStats||{})};
  if(!CROP[world.autoCrop])world.autoCrop='wheat';
  const existing=new Map(world.workers.filter(w=>w && typeof w.id==='string').map(w=>[w.id,w]));
  const roster=[];
  const homes=world.buildings.filter(b=>b.type==='cottage');
  homes.forEach((home,index)=>{
    for(let n=0;n<2;n++){
      const id=`${home.id}-resident-${n+1}`;
      const old=existing.get(id);
      const i=index*2+n;
      const job=old&&JOBS[old.job]?old.job:(i===0?'farmer':i===1?'forager':'idle');
      const nextAt=old&&Number.isFinite(old.nextAt)?old.nextAt:now+JOBS[job].ms;
      roster.push({id,name:old?.name||FIRST_NAMES[i%FIRST_NAMES.length],homeId:home.id,job,nextAt,trip:old?.job===job?old?.trip:null});
    }
  });
  world.workers=roster;
  return roster;
}

export function assignWorker(world,workerId,job,now=Date.now()){
  syncWorkers(world,now);
  if(!JOBS[job])return 'Choose a valid villager job.';
  const worker=world.workers.find(w=>w.id===workerId);
  if(!worker)return 'That villager no longer lives here.';
  if(worker.job===job)return null;
  worker.job=job;
  worker.nextAt=now+JOBS[job].ms;
  worker.trip=null;
  return null;
}

export function setAutoCrop(world,crop){
  if(!CROP[crop])return 'Choose a crop to grow.';
  world.autoCrop=crop;return null;
}

function addLog(world,worker,action,at){
  const messages={
    planted:'planted a fresh crop',harvested:'harvested a ripe field',foraged:'gathered wood and stone',
    milled:'milled wheat into flour',baked:'baked fresh bread',orchards:'collected fruit from the Dream Orchard',
    delivered:`delivered ${worker.lastDelivery?.qty||0} ${worker.lastDelivery?.good||'goods'} to the next stop`
  };
  world.workStats[action]=(world.workStats[action]||0)+1;
  world.workLog.unshift({id:`${worker.id}-${at}`,at,text:`${JOBS[worker.job].icon} ${worker.name} ${messages[action]}.`});
  world.workLog=world.workLog.slice(0,8);
}

// Workers put harvests in their workplace inventory. Goods move only by explicit
// hauler transactions or player collection; seeds and coins remain village-wide.
function harvestToPlot(game,id,building,at){
  const world=game[id],crop=building.crop;
  if(!crop||!CROP[crop.kind])return false;
  const yields=CROP[crop.kind].yield;
  for(const good of ['wheat','food'])if((yields[good]||0)>buildingFree(building,good))return false;
  for(const [good,n] of Object.entries(yields)){
    if(good==='wheat'||good==='food')building.stock[good]=buildingStock(building,good)+n;
    else world.resources[good]=(world.resources[good]||0)+n;
  }
  if(received(game,id).moonbeam)world.resources.coins+=2;
  building.crop=null;world.progress.harvests++;
  return true;
}
function harvestOrchardToLocal(game,id,building,at){
  const world=game[id];
  if(buildingFree(building,'food')<4)return false;
  // This call keeps the orchard's readiness rules and harvest timer in the core model.
  // Do not call the shared-pantry harvestOrchard function; it would double-count food.
  const bonus=received(game,id).breeze;
  if(at-(building.harvestedAt??building.placedAt??at)<90000*(bonus?.8:1))return false;
  building.harvestedAt=at;building.stock.food=buildingStock(building,'food')+4;
  world.resources.seeds+=1;return true;
}
function doWork(game,id,worker,at){
  const world=game[id];
  const plan=worker.job==='hauler'&&worker.trip?.delivery
    ?{delivery:worker.trip.delivery,task:'deliver'}:planWorkerRoute(game,id,worker,at);
  if(!plan)return null;
  const {x,z}=plan.target||{};
  if(worker.job==='hauler'){
    const qty=completeDelivery(world,plan.delivery);
    if(qty){worker.lastDelivery={good:plan.delivery.good,qty};return 'delivered';}
    return null;
  }
  const building=world.buildings.find(b=>b.x===x&&b.z===z);
  if(worker.job==='farmer'){
    if(plan.task==='harvest'&&building&&harvestToPlot(game,id,building,at))return 'harvested';
    if(plan.task==='orchard'&&building&&harvestOrchardToLocal(game,id,building,at))return 'orchards';
    if(plan.task==='plant' && !plant(game,id,x,z,world.autoCrop,at))return 'planted';
  }
  if(worker.job==='miller'&&building&&processLocal(world,'windmill',building.id))return 'milled';
  if(worker.job==='baker'&&building&&processLocal(world,'bakery',building.id))return 'baked';
  if(worker.job==='forager'){
    if(world.resources.wood>=250&&world.resources.stone>=250)return null;
    world.resources.wood=Math.min(250,world.resources.wood+3);
    world.resources.stone=Math.min(250,world.resources.stone+2);
    return 'foraged';
  }
  return null;
}

function scheduleNext(game,id,worker,at){
  const plan=planWorkerRoute(game,id,worker,at);
  const duration=workInterval(game[id],worker,JOBS[worker.job].ms,plan);
  worker.trip=plan ? {points:plan.route.points,startedAt:at,endsAt:at+duration,task:plan.task,roadSteps:plan.route.roadSteps,delivery:plan.delivery||null} : null;
  worker.nextAt=at+duration;
}

/** Advance all villages chronologically, including offline progress. Returns successful work counts.
 * Simulation is intentionally capped to 4 elapsed hours; once caught up it cannot be replayed.
 * Sunlight and breeze reflect the current connected-world state for this offline interval.
 */
export function advanceGame(game,now=Date.now()){
  const counts={a:STATS(),b:STATS()};
  for(const id of ['a','b']){
    const world=game[id];syncWorkers(world,now);
    if(now<=world.simulatedAt){world.simulatedAt=now;continue;}
    const from=Math.max(world.simulatedAt,now-MAX_OFFLINE_MS);
    // If a player was away longer than the cap, skip events older than the cap.
    for(const worker of world.workers){
      if(worker.nextAt<from)worker.nextAt=from+JOBS[worker.job].ms;
    }
    let safety=0;
    while(safety++<12000){
      let ready=null;
      for(const worker of world.workers){
        if(worker.nextAt<=now && (!ready || worker.nextAt<ready.nextAt || (worker.nextAt===ready.nextAt&&worker.id<ready.id)))ready=worker;
      }
      if(!ready)break;
      const at=ready.nextAt;
      const action=doWork(game,id,ready,at);
      if(action){counts[id][action]++;addLog(world,ready,action,at);}
      scheduleNext(game,id,ready,at);
    }
    // If the safety budget was exhausted, discard remaining past-due cycles.
    // Otherwise players with huge villages could receive the same offline backlog repeatedly.
    if(safety>12000){
      for(const worker of world.workers){
        if(worker.nextAt<=now)scheduleNext(game,id,worker,now);
      }
    }
    world.simulatedAt=now;
  }
  return counts;
}
