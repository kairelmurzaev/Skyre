import {STOCK_LIMITS, buildingStock, storageFree, stockUsed, storageCapacity, ensureStocks} from './logistics.js';
import {ensureTerrain,buildableTile,withinWorld,villageCharm} from './terrain.js';
import {ensureDesk} from './desk.js';
// Someone Else's Sky — deterministic game rules. No browser or rendering dependencies.
export const SAVE_KEY = 'skyre-village-v1';
export const CROP = {
  wheat: {name:'Cloud Wheat', ms:30000, seed:1, yield:{wheat:4,seeds:1}, tint:0xe7ca79},
  carrot: {name:'Sunroot', ms:45000, seed:1, yield:{food:5,seeds:1}, tint:0xe79d65},
  moonflower: {name:'Moonflower', ms:65000, seed:2, yield:{coins:9,seeds:1}, tint:0xc3b2eb}
};
export const BUILD = {
  plot: {name:'Garden Plot',cost:{wood:3,stone:1},icon:'🌱',description:'Plant and harvest crops'},
  cottage: {name:'Cottage',cost:{wood:12,stone:6},icon:'🏠',description:'A cozy home for your village'},
  windmill: {name:'Windmill',cost:{wood:18,stone:10},icon:'🌾',description:'Grind wheat into flour'},
  bakery: {name:'Bakery',cost:{wood:15,stone:12},icon:'🥖',description:'Bake bread from flour'},
  well: {name:'Moonwell',cost:{wood:7,stone:9},icon:'💧',description:'A gentle light for your island'},
  path: {name:'Stone Path',cost:{stone:1},icon:'◻',description:'Shorten worker travel time between homes and workplaces'},
  orchard: {name:'Dream Orchard',cost:{wood:10,stone:6},icon:'🌳',description:'Grows fruit and magical seeds every 90 seconds'},
  warehouse: {name:'Storehouse',cost:{wood:16,stone:12},icon:'📦',description:'Adds 64 spaces for food, flour, and wheat'}
};
const names={a:'Amber Hollow',b:'Moon Garden'};
export const other=id=>id==='a'?'b':'a';
const initialWorld=(id)=>({
  name:names[id], resources:{wood:35,stone:25,seeds:9,wheat:0,flour:0,food:4,coins:0},
  buildings:[
    {id:id+'-home',type:'cottage',x:1,z:-1,rotation:0},
    {id:id+'-field1',type:'plot',x:-2,z:0,rotation:0,crop:null},
    {id:id+'-field2',type:'plot',x:-1,z:0,rotation:0,crop:null},
    {id:id+'-field3',type:'plot',x:-2,z:1,rotation:0,crop:null}
  ],
  lamp:false,mirror:0,harvestedAt:{wood:0,stone:0},nextId:1,progress:{harvests:0,gifts:0,claimed:[]},
  landLevel:0,terrain:{},desk:{builds:[],lastCollected:{},finds:0,expedition:null},workers:[],autoCrop:'wheat',workLog:[],workStats:{},simulatedAt:Date.now()
});
export const newGame=()=>({version:1,a:initialWorld('a'),b:initialWorld('b'),events:[]});
export function loadGame(storage){
  try {
    const saved=JSON.parse(storage.getItem(SAVE_KEY));
    if(saved && saved.version===1 && ['a','b'].every(id=>saved[id]&&Array.isArray(saved[id].buildings)&&saved[id].resources)){
      // Older milestone-1 saves remain valid when new progress fields are added.
      for(const id of ['a','b']){
        const world=saved[id];
        world.progress={harvests:0,gifts:0,claimed:[],...world.progress};
        if(!Array.isArray(world.progress.claimed))world.progress.claimed=[];
        if(!Number.isInteger(world.nextId))world.nextId=world.buildings.length+1;
        ensureStocks(world);ensureTerrain(world);ensureDesk(world);
      }
      if(!Array.isArray(saved.events))saved.events=[];
      return saved;
    }
  }catch{}
  return newGame();
}
export function saveGame(storage,game){storage.setItem(SAVE_KEY,JSON.stringify(game));}
export const within=(x,z)=>Number.isInteger(x)&&Number.isInteger(z)&&Math.abs(x)<=4&&Math.abs(z)<=4&&(x*x+z*z<=18);
export const findAt=(world,x,z)=>world.buildings.find(b=>b.x===x&&b.z===z);
export const canAfford=(world,cost)=>Object.entries(cost).every(([name,n])=>(world.resources[name]||0)>=n);
function spend(world,cost){if(!canAfford(world,cost))return false;for(const [name,n] of Object.entries(cost))world.resources[name]-=n;return true;}
export function buildAt(world,type,x,z,rotation=0){
  if(!BUILD[type])return 'Choose a building first.';
  if(!withinWorld(world,x,z))return 'Unlock more island land to build here.';
  if(!buildableTile(world,x,z))return 'Clear the landscape before building here.';
  if(findAt(world,x,z))return 'That tile is already occupied.';
  if(!spend(world,BUILD[type].cost))return 'You need more building materials.';
  world.buildings.push({id:'building-'+(world.nextId++),type,x,z,rotation:((rotation%4)+4)%4,crop:null,stock:STOCK_LIMITS[type]?{}:undefined,placedAt:Date.now()});
  return null;
}
export function moveAt(world,fromX,fromZ,toX,toZ){
  const building=findAt(world,fromX,fromZ);
  if(!building)return 'Choose a building to move first.';
  if(!withinWorld(world,toX,toZ))return 'Unlock more island land to move here.';
  if(!buildableTile(world,toX,toZ))return 'Clear the landscape before moving here.';
  if(fromX===toX&&fromZ===toZ)return 'Choose a different destination tile.';
  if(findAt(world,toX,toZ))return 'That tile is already occupied.';
  building.x=toX;building.z=toZ;
  return null;
}
export function rotateAt(world,x,z){
  const building=findAt(world,x,z);
  if(!building)return 'Choose an existing building.';
  building.rotation=((building.rotation||0)+1)%4;return null;
}
export function removeAt(world,x,z){
  const b=findAt(world,x,z);if(!b)return 'There is no building here.';
  if(Object.keys(STOCK_LIMITS[b.type]||{}).some(g=>buildingStock(b,g)>0))return 'Collect or deliver the goods before removing this building.';
  if(b.type==='warehouse' && stockUsed(world)>storageCapacity(world)-(64+((b.level||1)>=2?32:0)))return 'Empty enough village storage before removing this storehouse.';
  const cost=BUILD[b.type]?.cost||{};
  for(const [name,n] of Object.entries(cost))world.resources[name]=(world.resources[name]||0)+Math.floor(n/2);
  world.buildings=world.buildings.filter(v=>v!==b);return null;
}
export const UPGRADES={
  cottage:{name:'Bigger Cottage',cost:{wood:12,stone:9,coins:10},description:'Welcome one more villager'},
  warehouse:{name:'Expanded Storehouse',cost:{wood:15,stone:14,coins:12},description:'Add 32 more storage spaces'},
  windmill:{name:'Efficient Windmill',cost:{wood:18,stone:12,coins:16},description:'Grind 3 wheat into 3 flour'}
};
export function upgradeAt(world,x,z){
  const b=findAt(world,x,z);
  if(!b||!UPGRADES[b.type])return 'Choose an upgradeable building.';
  if((b.level||1)>=2)return 'This building is already fully upgraded.';
  const cost=UPGRADES[b.type].cost;
  if(!canAfford(world,cost))return 'Not enough materials to upgrade this building.';
  for(const [good,n] of Object.entries(cost))world.resources[good]-=n;
  b.level=2;
  return null;
}
export function received(game,id){const neighbor=game[other(id)];return {sun:!!neighbor.lamp,moonbeam:neighbor.mirror===2,breeze:neighbor.buildings.some(b=>b.type==='windmill')};}
export function growTime(game,id,crop){return CROP[crop].ms*(received(game,id).sun?.8:1);}
export function growth(game,id,building,now=Date.now()){
  if(!building?.crop||!CROP[building.crop.kind])return 0;
  return Math.min(1,Math.max(0,(now-building.crop.at)/growTime(game,id,building.crop.kind)));
}
export function plant(game,id,x,z,kind,now=Date.now()){
  const w=game[id],b=findAt(w,x,z),c=CROP[kind];
  if(!b||b.type!=='plot')return 'Choose a garden plot.';
  if(b.crop)return 'This plot already has a crop.';
  if(!c)return 'Choose a seed to plant.';
  if(!spend(w,{seeds:c.seed}))return 'You need more seeds.';
  b.crop={kind,at:now};return null;
}
export function harvest(game,id,x,z,now=Date.now()){
  const w=game[id],b=findAt(w,x,z);
  if(!b||b.type!=='plot'||!b.crop)return 'Nothing to harvest here.';
  if(growth(game,id,b,now)<1)return 'Your plants are still growing.';
  const yields=CROP[b.crop.kind].yield;
  const needed=(yields.wheat||0)+(yields.food||0);
  if(storageFree(w)<needed)return 'Your village storage is full. Build a storehouse.';
  for(const [key,n] of Object.entries(yields))w.resources[key]=(w.resources[key]||0)+n;
  // A correctly aligned neighbor mirror makes the harvest more valuable, never mandatory.
  if(received(game,id).moonbeam)w.resources.coins+=2;
  b.crop=null;w.progress??={harvests:0,gifts:0,claimed:[]};w.progress.harvests++;return null;
}
export function gather(world,kind,now=Date.now()){
  if(!['wood','stone'].includes(kind))return 'Unknown resource.';
  if(now-(world.harvestedAt[kind]||0)<12000)return 'This resource is regrowing. Try again soon.';
  world.harvestedAt[kind]=now;world.resources[kind]+=kind==='wood'?5:4;return null;
}
export function processBuilding(world,type){
  if(!world.buildings.some(b=>b.type===type))return 'Build the workshop first.';
  if(type==='windmill'){
    const amount=world.buildings.some(b=>b.type==='windmill'&&(b.level||1)>=2)?3:2;
    if(storageFree(world)<amount-3)return 'Your village storage is full. Build a storehouse.';
    if(!spend(world,{wheat:3}))return 'Your windmill needs 3 cloud wheat.';
    world.resources.flour+=amount;return null;
  }
  if(type==='bakery'){
    if(world.resources.flour<2)return 'Your bakery needs 2 flour.';
    if(storageFree(world)<4)return 'Your village storage is full. Build a storehouse.';
    if(!spend(world,{flour:2}))return 'Your bakery needs 2 flour.';
    world.resources.food+=6;world.resources.coins+=4;return null;
  }
  return 'This building has no recipe yet.';
}
export function sendSeed(game,id){
  if(!spend(game[id],{seeds:1}))return 'You need a seed to share.';
  game[other(id)].resources.seeds+=2;
  game[id].progress??={harvests:0,gifts:0,claimed:[]};game[id].progress.gifts++;
  return null;
}
export const ORCHARD_MS=90000;
export function orchardReady(building,now=Date.now(),breeze=false){
  return building?.type==='orchard'&&now-(building.harvestedAt??building.placedAt??now)>=ORCHARD_MS*(breeze?.8:1);
}
export function harvestOrchard(world,x,z,now=Date.now(),breeze=false){
  const b=findAt(world,x,z);
  if(!b||b.type!=='orchard')return 'Choose a Dream Orchard.';
  if(!orchardReady(b,now,breeze))return 'The orchard needs more time to grow fruit.';
  if(storageFree(world)<4)return 'Your village storage is full. Build a storehouse.';
  b.harvestedAt=now;
  world.resources.food+=4;world.resources.seeds+=1;
  return null;
}
export const GOALS=[
  {id:'harvest',name:'A gentle harvest',description:'Harvest your first crop',reward:{wood:8,seeds:3}},
  {id:'village',name:'A village takes shape',description:'Have at least 6 buildings',reward:{stone:12,coins:8}},
  {id:'bakery',name:'Bread for everyone',description:'Build a windmill and bakery',reward:{wood:12,coins:12}},
  {id:'neighbors',name:'Across the glass',description:'Send a seed to another world',reward:{seeds:6,coins:8}},
  {id:'working',name:'Helping hands',description:'Let villagers complete 10 useful jobs',reward:{wood:10,stone:10,coins:14}},
  {id:'pathways',name:'Little footsteps',description:'Build 4 Stone Paths around your village',reward:{stone:7,coins:10}},
  {id:'storage',name:'Room for tomorrow',description:'Build your first Storehouse',reward:{wood:10,seeds:4,coins:10}},
  {id:'expansion',name:'A wider horizon',description:'Expand your island once',reward:{wood:15,stone:12,coins:8}},
  {id:'gardens',name:'A beautiful little place',description:'Earn 6 charm from gardens and ponds',reward:{seeds:8,coins:10}}
];
export function goalReady(world,id){
  if(id==='harvest')return (world.progress?.harvests||0)>=1;
  if(id==='village')return world.buildings.length>=6;
  if(id==='bakery')return ['windmill','bakery'].every(t=>world.buildings.some(b=>b.type===t));
  if(id==='neighbors')return (world.progress?.gifts||0)>=1;
  if(id==='working')return Object.values(world.workStats||{}).reduce((sum,n)=>sum+(Number(n)||0),0)>=10;
  if(id==='pathways')return world.buildings.filter(b=>b.type==='path').length>=4;
  if(id==='storage')return world.buildings.some(b=>b.type==='warehouse');
  if(id==='expansion')return (world.landLevel||0)>=1;
  if(id==='gardens')return villageCharm(world)>=6;
  return false;
}
export function claimGoal(world,id){
  const goal=GOALS.find(g=>g.id===id);
  if(!goal)return 'Unknown village goal.';
  world.progress??={harvests:0,gifts:0,claimed:[]};
  if(world.progress.claimed.includes(id))return 'You already claimed this reward.';
  if(!goalReady(world,id))return 'This village goal is not finished yet.';
  for(const [name,n] of Object.entries(goal.reward))world.resources[name]=(world.resources[name]||0)+n;
  world.progress.claimed.push(id);return null;
}
export function record(game,message){game.events.unshift({id:Date.now()+'-'+Math.random().toString(36).slice(2),message,at:Date.now()});game.events=game.events.slice(0,20);}
