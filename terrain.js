// Island terrain and decoration rules. Pure, deterministic and shared by the
// browser and the server. All prices are verified on the authoritative state.
export const LAND_STAGES = Object.freeze([
  {radiusSq:18, label:'The First Isle', cost:null},
  {radiusSq:29, label:'The Green Shore', cost:{wood:30, stone:25, coins:12}},
  {radiusSq:43, label:'The Far Meadow', cost:{wood:55, stone:45, coins:30}}
]);
export const LANDSCAPE = Object.freeze({
  flowers:{name:'Flower Garden',icon:'🌼',cost:{seeds:2,wood:1},charm:1},
  pond:{name:'Lily Pond',icon:'🪷',cost:{stone:5,wood:2},charm:3}
});
export const MAX_COORD=7;
const key=(x,z)=>`${x},${z}`;
const valid=(x,z)=>Number.isSafeInteger(x)&&Number.isSafeInteger(z)&&Math.abs(x)<=MAX_COORD&&Math.abs(z)<=MAX_COORD;
const available=(world,cost)=>Object.entries(cost).every(([k,n])=>Number.isSafeInteger(world.resources?.[k])&&world.resources[k]>=n);
export const islandStage=world=>Number.isInteger(world?.landLevel)&&world.landLevel>0?Math.min(world.landLevel,2):0;
export const withinWorld=(world,x,z)=>valid(x,z)&&(x*x+z*z<=LAND_STAGES[islandStage(world)].radiusSq);
export const decorAt=(world,x,z)=>world?.terrain?.[key(x,z)]||null;
export const walkableTile=(world,x,z)=>withinWorld(world,x,z)&&decorAt(world,x,z)!=='pond';
export const buildableTile=(world,x,z)=>walkableTile(world,x,z)&&!decorAt(world,x,z);
export function ensureTerrain(world){
  world.landLevel=islandStage(world);
  if(!world.terrain||typeof world.terrain!=='object'||Array.isArray(world.terrain))world.terrain={};
  // Old saves without landscaping remain intact. Ignore malformed legacy tiles.
  for(const [position,type] of Object.entries(world.terrain)){
    const parts=position.split(',').map(Number);
    if(parts.length!==2||!withinWorld(world,...parts)||!LANDSCAPE[type]||parts.some(v=>!Number.isInteger(v)))delete world.terrain[position];
  }
  return world;
}
export function expandIsland(world){
  ensureTerrain(world);
  const next=world.landLevel+1;
  if(next>=LAND_STAGES.length)return 'Your island has reached its current limit.';
  const cost=LAND_STAGES[next].cost;
  if(!available(world,cost))return 'Gather more wood, stone and coins to expand your island.';
  for(const [good,amount] of Object.entries(cost))world.resources[good]-=amount;
  world.landLevel=next;
  return null;
}
export function setLandscape(world,x,z,type){
  ensureTerrain(world);
  if(!withinWorld(world,x,z))return 'Unlock this part of the island first.';
  const location=key(x,z),existing=world.terrain[location];
  if(type==='clear'){
    if(!existing)return 'There is no garden or pond here.';
    delete world.terrain[location];
    // Clearing is free, but no refund: prevents harvesting decorations for profit.
    return null;
  }
  if(!LANDSCAPE[type])return 'Choose a valid landscape decoration.';
  if(world.buildings.some(b=>b.x===x&&b.z===z))return 'Move the building before landscaping here.';
  if(existing)return 'Clear the existing landscape first.';
  if(!available(world,LANDSCAPE[type].cost))return 'Not enough materials for this landscape.';
  for(const [good,amount] of Object.entries(LANDSCAPE[type].cost))world.resources[good]-=amount;
  world.terrain[location]=type;
  return null;
}
export function villageCharm(world){return Object.values(world.terrain||{}).reduce((sum,type)=>sum+(LANDSCAPE[type]?.charm||0),0);}
