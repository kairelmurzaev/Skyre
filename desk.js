// Skyre — Beyond the Island. Data-only desk sandbox rules.
// Shared by the local game and the authoritative Telegram server.
export const DESK_SITES=Object.freeze([
  {id:'crossing',name:'Book Crossing',x:6.45,z:-3.75,allowed:['bridge'],description:'A tiny ramp to the giant books'},
  {id:'mug-nook',name:'Mug Corner',x:-7.25,z:-6.3,allowed:['stall','lantern'],description:'A cozy place beside the coffee cup'},
  {id:'plant-nook',name:'Plant Corner',x:-7.65,z:6.25,allowed:['camp','lantern'],description:'A shelter among the leaves'},
  {id:'book-nook',name:'Study Nook',x:9.25,z:-1.7,allowed:['workbench','lantern'],description:'A workshop near the books'}
]);
export const DESK_BUILDS=Object.freeze({
  bridge:{name:'Pencil Footbridge',icon:'🪵',cost:{wood:10,stone:3},description:'Connect the island to desk expeditions'},
  stall:{name:'Crumb Stall',icon:'🏪',cost:{wood:9,stone:4},description:'A tiny stall beside the cup'},
  camp:{name:'Leaf Camp',icon:'⛺',cost:{wood:12,stone:4},description:'A place to rest beside the desk plant'},
  workbench:{name:'Paper Workshop',icon:'🔨',cost:{wood:11,stone:7},description:'A crafting station in the study corner'},
  lantern:{name:'Desk Lantern',icon:'🏮',cost:{wood:4,stone:2},description:'A warm glow for the wooden desk'}
});
export const DESK_OBJECTS=Object.freeze({
  mug:{name:'Giant Coffee Mug',icon:'☕',description:'Collect forgotten crumbs and seeds beside the enormous mug',cooldown:45000,reward:{seeds:2,coins:1}},
  plant:{name:'Desk Jungle',icon:'🪴',description:'Gather rare seeds among the enormous leaves',cooldown:60000,reward:{seeds:3}},
  books:{name:'Tower of Books',icon:'📚',description:'A mysterious stack of books. Send a villager to search for discoveries'}
});
export const DESK_TRIP_MS=32000;
export function ensureDesk(world){
  if(!world.desk||typeof world.desk!=='object'||Array.isArray(world.desk))world.desk={};
  const d=world.desk;
  if(!Array.isArray(d.builds))d.builds=[];
  const seen=new Set();
  d.builds=d.builds.filter(b=>{
    const s=DESK_SITES.find(site=>site.id===b?.site);
    if(!s||!s.allowed.includes(b.type)||seen.has(b.site))return false;
    seen.add(b.site);return true;
  });
  if(!d.lastCollected||typeof d.lastCollected!=='object'||Array.isArray(d.lastCollected))d.lastCollected={};
  for(const name of ['mug','plant'])
    if(!Number.isFinite(d.lastCollected[name])||d.lastCollected[name]<0)d.lastCollected[name]=0;
  if(!Number.isSafeInteger(d.finds)||d.finds<0)d.finds=0;
  if(!d.expedition||typeof d.expedition!=='object'||typeof d.expedition.workerId!=='string'||
      !Number.isFinite(d.expedition.startedAt)||!Number.isFinite(d.expedition.endsAt)||
      d.expedition.endsAt<=d.expedition.startedAt)d.expedition=null;
  return d;
}
export const deskAt=(world,site)=>ensureDesk(world).builds.find(b=>b.site===site)||null;
export function buildOnDesk(world,siteId,type){
  const site=DESK_SITES.find(s=>s.id===siteId);
  if(!site||!Object.hasOwn(DESK_BUILDS,type)||!site.allowed.includes(type))return 'That structure cannot be built here.';
  const desk=ensureDesk(world);
  if(desk.builds.some(b=>b.site===siteId))return 'This desk spot already has something built.';
  const cost=DESK_BUILDS[type].cost;
  if(Object.entries(cost).some(([good,qty])=>(world.resources?.[good]||0)<qty))return 'Gather more wood and stone for this desk project.';
  for(const [good,qty] of Object.entries(cost))world.resources[good]-=qty;
  desk.builds.push({site:siteId,type});
  return null;
}
export function removeFromDesk(world,siteId){
  const desk=ensureDesk(world);
  const b=desk.builds.find(b=>b.site===siteId);
  if(!b)return 'There is no desk structure here.';
  if(siteId==='crossing'&&desk.expedition)return 'Wait for the explorer to come home before removing the bridge.';
  for(const [good,qty] of Object.entries(DESK_BUILDS[b.type].cost))
    world.resources[good]=(world.resources[good]||0)+Math.floor(qty/2);
  desk.builds=desk.builds.filter(x=>x.site!==siteId);
  return null;
}
export function collectDeskObject(world,objectId,now=Date.now()){
  const object=DESK_OBJECTS[objectId];
  if(!object?.reward)return 'Choose the mug or desk plant to collect supplies.';
  const desk=ensureDesk(world);
  if(desk.lastCollected[objectId]>0&&now-desk.lastCollected[objectId]<object.cooldown)return 'The desk needs some time before more supplies appear.';
  for(const [good,qty] of Object.entries(object.reward))world.resources[good]=(world.resources[good]||0)+qty;
  desk.lastCollected[objectId]=now;
  return null;
}
export function startDeskExpedition(world,now=Date.now()){
  const desk=ensureDesk(world);
  if(!desk.builds.some(b=>b.site==='crossing'&&b.type==='bridge'))return 'Build the Pencil Footbridge at Book Crossing first.';
  if(desk.expedition)return 'A villager is already exploring the books.';
  const worker=world.workers?.find(w=>w.job==='idle')||world.workers?.[0];
  if(!worker)return 'Build a cottage to welcome a villager for the expedition.';
  desk.expedition={workerId:worker.id,startedAt:now,endsAt:now+DESK_TRIP_MS};
  return null;
}
export function advanceDesk(world,now=Date.now()){
  const desk=ensureDesk(world),trip=desk.expedition;
  if(!trip||now<trip.endsAt)return 0;
  desk.expedition=null;
  desk.finds++;
  // Deterministic, capped rewards; exactly once even after offline catch-up.
  const coins=4+(desk.finds%3)*2;
  world.resources.coins=(world.resources.coins||0)+coins;
  world.resources.seeds=(world.resources.seeds||0)+1;
  world.workLog??=[];
  const explorer=world.workers?.find(w=>w.id===trip.workerId);
  world.workLog.unshift({id:'desk-'+trip.startedAt,at:trip.endsAt,text:'📚 '+(explorer?.name||'An explorer')+' returned from the books with '+coins+' coins and a curious seed.'});
  world.workLog=world.workLog.slice(0,8);
  return 1;
}

