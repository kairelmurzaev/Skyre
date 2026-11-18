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
  // New optional props field is introduced additively, without changing legacy
  // desk sites, resource inventories, or saved expedition progress.
  if(!Array.isArray(d.props))d.props=[];
  const usedIds=new Set();
  d.props=d.props.filter(p=>{
    if(!p||typeof p.id!=='string'||p.id.length>48||usedIds.has(p.id)||
      !FREE_DESK_TYPES.includes(p.type)||!isGrid(p.x)||!isGrid(p.z)||
      !Number.isInteger(p.rotation)||p.rotation<0||p.rotation>3)return false;
    usedIds.add(p.id);return true;
  }).slice(0,MAX_DESK_PROPS);
  const largest=Math.max(0,...d.props.map(p=>Number(p.id.match(/^desk-prop-(\d+)$/)?.[1])||0));
  d.nextPropId=Math.max(1,Number.isSafeInteger(d.nextPropId)?d.nextPropId:1,largest+1);
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
  // Existing fixed-site builds must not overlap newly placed movable furniture.
  const fixedRadius=type==='bridge'?1.15:DESK_FOOTPRINT[type];
  if(desk.props.some(prop=>intersects(site.x,site.z,fixedRadius,
      {x:prop.x,z:prop.z,r:DESK_FOOTPRINT[prop.type]})))
    return 'A movable desk decoration is blocking this build site.';
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


// Free-placement desk props use half-unit snapping so tapping works on phones.
// The original fixed desk spots remain intact for older saves and the footbridge.
export const FREE_DESK_TYPES=Object.freeze(['stall','camp','workbench','lantern']);
export const DESK_SNAP=0.5;
export const MAX_DESK_PROPS=40;
export const DESK_FOOTPRINT=Object.freeze({
  stall:.92,camp:.92,workbench:.88,lantern:.38
});
const DESK_LANDMARKS=Object.freeze([
  {x:-8.15,z:-4.70,r:1.50}, // giant coffee mug and saucer
  {x:8.2,z:-5.25,r:1.78}, // book tower
  {x:-8.4,z:4.75,r:1.42}, // potted plant
  {x:-9.45,z:-.35,r:.85}, // existing shared lamp
  {x:9.4,z:-.4,r:.82}, // existing shared mirror
  {x:6.8,z:5.75,r:1.85} // letter and papers
]);
export const snapDesk=(n)=>Math.round(n/DESK_SNAP)*DESK_SNAP;
export const deskProp=(world,id)=>ensureDesk(world).props.find(p=>p.id===id)||null;
const isGrid=(n)=>Number.isFinite(n)&&Number.isInteger(n/DESK_SNAP);
const intersects=(x,z,r,object)=>Math.hypot(x-object.x,z-object.z)<r+object.r;
export function deskPlacementError(world,type,x,z,rotation=0,ignoreId=null,ignoreSite=null){
  if(!FREE_DESK_TYPES.includes(type))return 'Choose a movable desk structure.';
  if(!isGrid(x)||!isGrid(z)||!Number.isInteger(rotation)||rotation<0||rotation>3)
    return 'Choose a snapped desk position and a valid rotation.';
  const radius=DESK_FOOTPRINT[type];
  if(Math.abs(x)+radius>11.25||Math.abs(z)+radius>8.35)
    return 'That position is beyond the edge of the desk.';
  const level=Math.max(0,Math.min(2,world.landLevel||0));
  const islandRadius=5.75*[1,1.18,1.42][level];
  if(Math.hypot(x,z)<islandRadius+radius+.20)
    return 'Leave enough space between the desk object and the island.';
  for(const landmark of DESK_LANDMARKS)
    if(intersects(x,z,radius+.08,landmark))return 'This spot is occupied by a giant desk object.';
  const d=ensureDesk(world);
  for(const old of d.props){
    if(old.id===ignoreId)continue;
    if(intersects(x,z,radius+.13,{x:old.x,z:old.z,r:DESK_FOOTPRINT[old.type]}))
      return 'Move the structure away from the other desk decorations.';
  }
  for(const old of d.builds){
    if(old.site===ignoreSite)continue;
    const site=DESK_SITES.find(s=>s.id===old.site);
    if(!site)continue;
    if(old.type==='bridge'){
      // Protect the walkway to the book tower and its landing.
      if(intersects(x,z,radius+.14,{x:5.45,z:-2.65,r:1.25}))return 'Keep the footbridge clear.';
      continue;
    }
    if(intersects(x,z,radius+.16,{x:site.x,z:site.z,r:DESK_FOOTPRINT[old.type]}))
      return 'A desk structure already occupies that area.';
  }
  return null;
}
export function buildFreeDesk(world,type,x,z,rotation=0){
  const d=ensureDesk(world);
  if(d.props.length>=MAX_DESK_PROPS)return 'The desk is full. Store something before building more.';
  const error=deskPlacementError(world,type,x,z,rotation);
  if(error)return error;
  const cost=DESK_BUILDS[type].cost;
  if(Object.entries(cost).some(([good,n])=>(world.resources?.[good]||0)<n))
    return 'Gather more wood and stone for this construction.';
  for(const [good,n] of Object.entries(cost))world.resources[good]-=n;
  d.props.push({id:'desk-prop-'+d.nextPropId++,type,x,z,rotation});
  return null;
}
export function moveFreeDesk(world,id,x,z,rotation){
  const prop=deskProp(world,id);
  if(!prop)return 'That desk object could not be found.';
  const error=deskPlacementError(world,prop.type,x,z,rotation,prop.id);
  if(error)return error;
  prop.x=x;prop.z=z;prop.rotation=rotation;
  return null;
}
export function rotateFreeDesk(world,id){
  const p=deskProp(world,id);
  if(!p)return 'That desk object could not be found.';
  const rotation=(p.rotation+1)%4;
  const error=deskPlacementError(world,p.type,p.x,p.z,rotation,p.id);
  if(error)return error;
  p.rotation=rotation;return null;
}
export function storeFreeDesk(world,id){
  const d=ensureDesk(world),p=deskProp(world,id);
  if(!p)return 'That desk object could not be found.';
  for(const [good,n] of Object.entries(DESK_BUILDS[p.type].cost))
    world.resources[good]=(world.resources[good]||0)+Math.floor(n/2);
  d.props=d.props.filter(prop=>prop.id!==id);
  return null;
}
export function relocateDeskSite(world,siteId,x,z,rotation=0){
  const d=ensureDesk(world);
  const legacy=d.builds.find(b=>b.site===siteId);
  if(!legacy||legacy.type==='bridge')return 'Only smaller desk structures can be relocated.';
  if(d.props.length>=MAX_DESK_PROPS)return 'The desk is full.';
  const error=deskPlacementError(world,legacy.type,x,z,rotation,null,siteId);
  if(error)return error;
  d.builds=d.builds.filter(b=>b!==legacy);
  d.props.push({id:'desk-prop-'+d.nextPropId++,type:legacy.type,x,z,rotation});
  return null;
}

