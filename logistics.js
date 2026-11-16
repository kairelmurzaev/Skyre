// Location-based inventory. Game rules and render code can both inspect this module.
// Production outputs stay at the building until transported or manually collected.
export const GOODS = ['wheat', 'flour', 'food'];
export const BASE_STORAGE = 36;
export const WAREHOUSE_STORAGE = 64;
export const HAUL_SIZE = 4;
export const STOCK_LIMITS = Object.freeze({
  plot: {wheat: 16, food: 16},
  orchard: {food: 20},
  windmill: {wheat: 18, flour: 18},
  bakery: {flour: 18, food: 24}
});
const amount = value => Number.isSafeInteger(value) && value > 0 ? value : 0;
export function ensureStocks(world){
  for(const b of world.buildings){
    if(!STOCK_LIMITS[b.type])continue;
    if(!b.stock||typeof b.stock!=='object'||Array.isArray(b.stock))b.stock={};
    for(const good of GOODS)b.stock[good]=amount(b.stock[good]);
  }
  return world;
}
export function buildingStock(b,good){return amount(b?.stock?.[good]);}
export function buildingFree(b,good){return Math.max(0,(STOCK_LIMITS[b?.type]?.[good]||0)-buildingStock(b,good));}
export function stockUsed(world){return GOODS.reduce((sum,g)=>sum+amount(world.resources[g]),0);}
export function storageCapacity(world){return BASE_STORAGE+world.buildings.filter(b=>b.type==='warehouse').length*WAREHOUSE_STORAGE;}
export function storageFree(world){return Math.max(0,storageCapacity(world)-stockUsed(world));}
export function depotBuildings(world){return world.buildings.filter(b=>b.type==='cottage'||b.type==='warehouse');}
export function stockedBuildings(world){return world.buildings.filter(b=>GOODS.some(g=>buildingStock(b,g)>0));}
export function inventoryTotals(world){
  const totals=Object.fromEntries(GOODS.map(g=>[g,amount(world.resources[g])]));
  for(const b of world.buildings)for(const g of GOODS)totals[g]+=buildingStock(b,g);
  return totals;
}
export function collectBuilding(world,buildingId){
  const b=world.buildings.find(b=>b.id===buildingId);
  if(!b||!STOCK_LIMITS[b.type])return 'This building has no goods to collect.';
  let free=storageFree(world),collected=0;
  for(const good of GOODS){
    const move=Math.min(free,buildingStock(b,good));
    if(!move)continue;
    b.stock[good]-=move;world.resources[good]=(world.resources[good]||0)+move;
    free-=move;collected+=move;
  }
  return collected?null:'No goods available, or your village storage is full.';
}
export function supplyBuilding(world,buildingId){
  const b=world.buildings.find(b=>b.id===buildingId);
  const good=b?.type==='windmill'?'wheat':b?.type==='bakery'?'flour':null;
  if(!good)return 'Choose a mill or bakery to supply.';
  const n=Math.min(HAUL_SIZE,amount(world.resources[good]),buildingFree(b,good));
  if(!n)return `No ${good} to transfer, or the workshop is full.`;
  world.resources[good]-=n;b.stock??={};b.stock[good]=buildingStock(b,good)+n;
  return null;
}
function sourceAmount(world,src,good){return src==='depot'?amount(world.resources[good]):buildingStock(src,good)}
function destFree(world,dest,good){return dest==='depot'?storageFree(world):buildingFree(dest,good)}
export function deliveryOptions(world){
  const b=world.buildings;
  const sources=(type,good)=>b.filter(x=>x.type===type && buildingStock(x,good)>0);
  const targets=(type,good)=>b.filter(x=>x.type===type && buildingFree(x,good)>0);
  const plans=[];
  function add(source,dest,good,priority){
    if(source===dest)return;
    const n=Math.min(HAUL_SIZE,sourceAmount(world,source,good),destFree(world,dest,good));
    if(n>0)plans.push({sourceId:source==='depot'?'depot':source.id,destId:dest==='depot'?'depot':dest.id,good,qty:n,priority});
  }
  // Immediate supply of workshops is preferred over selling to the communal storeroom.
  for(const s of sources('plot','wheat'))for(const d of targets('windmill','wheat'))add(s,d,'wheat',0);
  for(const s of sources('windmill','flour'))for(const d of targets('bakery','flour'))add(s,d,'flour',1);
  for(const s of sources('bakery','food'))add(s,'depot','food',2);
  for(const s of sources('orchard','food'))add(s,'depot','food',2);
  for(const s of sources('plot','food'))add(s,'depot','food',2);
  for(const d of targets('windmill','wheat'))add('depot',d,'wheat',3);
  for(const d of targets('bakery','flour'))add('depot',d,'flour',4);
  for(const s of sources('plot','wheat'))add(s,'depot','wheat',5);
  for(const s of sources('windmill','flour'))add(s,'depot','flour',6);
  return plans;
}
// Transactions are checked at execution time: a planned route never reserves goods,
// and two haulers cannot duplicate the same shipment.
export function completeDelivery(world,delivery){
  if(!delivery||!GOODS.includes(delivery.good))return 0;
  const src=delivery.sourceId==='depot'?'depot':world.buildings.find(b=>b.id===delivery.sourceId);
  const dst=delivery.destId==='depot'?'depot':world.buildings.find(b=>b.id===delivery.destId);
  if(!src||!dst||src===dst)return 0;
  const n=Math.min(HAUL_SIZE,amount(delivery.qty),sourceAmount(world,src,delivery.good),destFree(world,dst,delivery.good));
  if(n<1)return 0;
  if(src==='depot')world.resources[delivery.good]-=n;
  else src.stock[delivery.good]-=n;
  if(dst==='depot')world.resources[delivery.good]=(world.resources[delivery.good]||0)+n;
  else{dst.stock??={};dst.stock[delivery.good]=buildingStock(dst,delivery.good)+n;}
  return n;
}
export function processLocal(world,type,buildingId){
  const b=world.buildings.find(b=>b.id===buildingId && b.type===type);
  if(!b)return false;
  if(type==='windmill' && buildingStock(b,'wheat')>=3 && buildingFree(b,'flour')>=2){
    b.stock.wheat-=3;b.stock.flour+=2;return true;
  }
  if(type==='bakery' && buildingStock(b,'flour')>=2 && buildingFree(b,'food')>=6){
    b.stock.flour-=2;b.stock.food+=6;world.resources.coins=(world.resources.coins||0)+4;return true;
  }
  return false;
}
