// Villager automation, independent of the renderer and browser storage.
// Workers only change their own world; their actions never require another group online.
import {CROP, findAt, growth, plant, harvest, processBuilding, orchardReady, harvestOrchard, received} from './core.js';

export const JOBS = {
  idle:   {name:'Rest', icon:'☕', detail:'Wanders and enjoys the village', ms:30000},
  farmer: {name:'Farmer', icon:'🌱', detail:'Plants and harvests your selected crop', ms:12000},
  miller: {name:'Miller', icon:'🌾', detail:'Turns 3 wheat into 2 flour at a windmill', ms:20000},
  baker:  {name:'Baker', icon:'🥖', detail:'Turns 2 flour into bread and coins', ms:24000},
  forager:{name:'Forager', icon:'🪵', detail:'Gathers wood and stone for building', ms:28000}
};
export const MAX_OFFLINE_MS=4*60*60*1000; // Prevent runaway inflation and excessive processing.
const FIRST_NAMES=['Mira','Pip','Sol','Lumi','Nori','Fern','Ari','Cleo','Briar','Rin','Taro','Wren'];
const STATS=()=>({planted:0,harvested:0,foraged:0,milled:0,baked:0,orchards:0});

export function syncWorkers(world,now=Date.now()){
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
      roster.push({id,name:old?.name||FIRST_NAMES[i%FIRST_NAMES.length],homeId:home.id,job,nextAt});
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
  return null;
}

export function setAutoCrop(world,crop){
  if(!CROP[crop])return 'Choose a crop to grow.';
  world.autoCrop=crop;return null;
}

function addLog(world,worker,action,at){
  const messages={
    planted:'planted a fresh crop',harvested:'harvested a ripe field',foraged:'gathered wood and stone',
    milled:'milled wheat into flour',baked:'baked fresh bread',orchards:'collected fruit from the Dream Orchard'
  };
  world.workStats[action]=(world.workStats[action]||0)+1;
  world.workLog.unshift({id:`${worker.id}-${at}`,at,text:`${JOBS[worker.job].icon} ${worker.name} ${messages[action]}.`});
  world.workLog=world.workLog.slice(0,8);
}

function doWork(game,id,worker,at){
  const world=game[id];
  if(worker.job==='farmer'){
    const ripe=world.buildings.find(b=>b.type==='plot'&&b.crop&&growth(game,id,b,at)>=1);
    if(ripe && !harvest(game,id,ripe.x,ripe.z,at))return 'harvested';
    const orchard=world.buildings.find(b=>b.type==='orchard'&&orchardReady(b,at,received(game,id).breeze));
    if(orchard && !harvestOrchard(world,orchard.x,orchard.z,at,received(game,id).breeze))return 'orchards';
    const empty=world.buildings.find(b=>b.type==='plot'&&!b.crop);
    if(empty && !plant(game,id,empty.x,empty.z,world.autoCrop,at))return 'planted';
  }
  if(worker.job==='miller' && !processBuilding(world,'windmill'))return 'milled';
  if(worker.job==='baker' && !processBuilding(world,'bakery'))return 'baked';
  if(worker.job==='forager'){
    if(world.resources.wood>=250 && world.resources.stone>=250)return null;
    world.resources.wood=Math.max(world.resources.wood,Math.min(250,world.resources.wood+3));
    world.resources.stone=Math.max(world.resources.stone,Math.min(250,world.resources.stone+2));
    return 'foraged';
  }
  return null;
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
      ready.nextAt=at+JOBS[ready.job].ms;
      const action=doWork(game,id,ready,at);
      if(action){counts[id][action]++;addLog(world,ready,action,at);}
    }
    world.simulatedAt=now;
  }
  return counts;
}
