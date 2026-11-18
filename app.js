import {LAND_STAGES,LANDSCAPE,expandIsland,setLandscape,islandStage,villageCharm,decorAt,buildableTile} from './terrain.js';
import {GOODS,HAUL_SIZE,STOCK_LIMITS,buildingStock,storageCapacity,stockUsed,stockedBuildings,inventoryTotals,collectBuilding,supplyBuilding,buildingFree} from './logistics.js';
import {newGame,SAVE_KEY,CROP,BUILD,other,loadGame,saveGame,findAt,buildAt,removeAt,moveAt,rotateAt,received,growth,plant,harvest,harvestOrchard,orchardReady,gather,processBuilding,sendSeed,record,canAfford,GOALS,goalReady,claimGoal,UPGRADES,upgradeAt} from './core.js';
import {createScene} from './scene.js';
import {JOBS,syncWorkers,assignWorker,setAutoCrop,advanceGame,MAX_OFFLINE_MS} from './workers.js';
import {planWorkerRoute,roadSummary,workInterval} from './routing.js';
import {DESK_SITES,DESK_BUILDS,DESK_OBJECTS,ensureDesk,deskAt,buildOnDesk,removeFromDesk,collectDeskObject,startDeskExpedition,
  FREE_DESK_TYPES,deskProp,deskPlacementError,buildFreeDesk,moveFreeDesk,rotateFreeDesk,storeFreeDesk,relocateDeskSite,snapDesk} from './desk.js';

const $=id=>document.getElementById(id);
const initData=window.Telegram?.WebApp?.initData||'';
const isLive=initData.length>0;
let game=isLive?newGame():loadGame(localStorage);
const initialWork=isLive?{a:{},b:{}}:advanceGame(game,Date.now());
if(!isLive)saveGame(localStorage,game);
let liveReady=!isLive, linked=!isLive,looking=false,requestGeneration=0,pendingAction=false;

function installRemote(result){
  if(!result?.game?.a||!result.game.b)throw Error('Invalid server response.');
  game=result.game;linked=!!result.linked;looking=!!result.looking;liveReady=true;
  render();
}
async function fetchRemote(){
  if(!isLive||pendingAction||document.visibilityState==='hidden')return;
  const generation=++requestGeneration;
  try{
    const r=await fetch('/api/world',{headers:{'x-telegram-init-data':initData},cache:'no-store'});
    const data=await r.json();if(!r.ok)throw Error(data.error||'Unable to load village.');
    if(generation===requestGeneration&&!pendingAction)installRemote(data);
    $('network-status').textContent=linked?'● Connected worlds · Live':looking?'◌ Waiting for another group · Live':'● Telegram group village · Live';
  }catch(e){if(generation===requestGeneration){$('network-status').textContent='⚠ '+e.message;liveReady=false;}}
}
async function run(command,localAction,message,after){
  if(pendingAction)return showToast('Finishing the previous action…');
  if(isLive){
    if(!liveReady)return showToast('Unable to connect. Reopen the game from its Telegram group link.');
    pendingAction=true;requestGeneration++;
    try{
      const requestId=crypto.randomUUID();
      const r=await fetch('/api/action',{method:'POST',headers:{'content-type':'application/json','x-telegram-init-data':initData},body:JSON.stringify({requestId,command})});
      const data=await r.json();
      if(data.game)installRemote(data);
      if(!r.ok)throw Error(data.error||'Action failed.');
      if(after)after();
      if(message)showToast(data.message||message);
    }catch(e){showToast(e.message);}
    finally{pendingAction=false;}
  }else{
    advanceGame(game,Date.now());
    const error=localAction();if(error)return showToast(error);
    if(after)after();
    record(game,`${game[group].name}: ${message}`);
    commit(message);
  }
}

let group='a',mode='explore',chosenBuild='plot',chosenCrop='wheat',chosenLandscape='flowers',rotation=0,zoomed=false,toastTimer,selectedMove=null,selectedRoute=null,chosenDeskBuild='bridge',selectedDeskObject='books',selectedDeskPropId=null,selectedDeskSiteId=null,deskEdit=null,deskCandidate=null,deskRotation=0;
const entries=[['wood','🪵','Wood'],['stone','◈','Stone'],['seeds','✧','Seeds'],['wheat','🌾','Wheat'],['flour','◌','Flour'],['food','🍞','Food'],['coins','✦','Coins']];
const showToast=text=>{const el=$('toast');el.textContent=text;el.classList.add('shown');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('shown'),3200)};
const costLabel=cost=>Object.entries(cost).map(([k,v])=>`${v} ${k}`).join(' · ');
const tileInfo=(x,z)=>{
  const b=findAt(game[group],x,z);
  const decor=decorAt(game[group],x,z);if(decor)return `${LANDSCAPE[decor]?.name||decor}. Choose Landscape → Clear to change this tile.`;
  if(!b)return 'Empty tile. Choose Build to create something here.';
  if(b.type==='plot'&&!b.crop&&buildingStock(b,'wheat')+buildingStock(b,'food')>0)return 'Farm inventory: '+buildingStock(b,'wheat')+' wheat, '+buildingStock(b,'food')+' food awaiting collection or hauling.';
  if(b.type==='plot'&&b.crop){const pct=Math.round(growth(game,group,b)*100);return pct===100?`${CROP[b.crop.kind].name} is ready! Choose Farm and tap to harvest.`:`${CROP[b.crop.kind].name} growing (${pct}%).`}
  if(b.type==='windmill')return 'Windmill: flour '+buildingStock(b,'flour')+' · wheat '+buildingStock(b,'wheat')+'. Supply it with wheat and assign a miller.';
  if(b.type==='bakery')return 'Bakery: food '+buildingStock(b,'food')+' · flour '+buildingStock(b,'flour')+'. Supply it and assign a baker.';
  if(b.type==='warehouse')return 'Storehouse: expands village storage by 64 goods. Haulers make deliveries here.';
  if(b.type==='orchard')return orchardReady(b,Date.now(),received(game,group).breeze)?'Dream Orchard: ripe magical fruit! Tap to collect.':'Dream Orchard: fruit is growing. Return later to collect food and seeds.';
  return `${BUILD[b.type]?.name||b.type}. Choose Remove to reclaim half its building materials.`;
};
let view;
function onDeskHover(point){
  if(!deskEdit)return;
  deskCandidate={x:snapDesk(point.x),z:snapDesk(point.z)};
  const w=game[group];
  const error=deskPlacementError(w,deskEdit.type,deskCandidate.x,deskCandidate.z,deskRotation,
    deskEdit.kind==='prop'?deskEdit.id:null,deskEdit.kind==='site'?deskEdit.site:null);
  const cost=DESK_BUILDS[deskEdit.type].cost;
  const lack=deskEdit.kind==='new'&&!canAfford(w,cost);
  const valid=!error&&!lack;
  $('skyre-desk-edit-status').textContent=error|| (lack?'Not enough wood or stone.':
    '✓ Valid position · '+deskCandidate.x+', '+deskCandidate.z+' · '+(deskRotation*90)+'°');
  $('skyre-desk-confirm').disabled=!valid;
  view?.showDeskGhost({type:deskEdit.type,...deskCandidate,rotation:deskRotation,valid});
}
function beginDeskEdit(source){
  if(isLive&&!liveReady)return showToast('Connect to your village first.');
  deskEdit=source;deskRotation=source.rotation||0;deskCandidate=null;
  selectedDeskPropId=source.kind==='prop'?source.id:null;
  mode=source.kind==='new'?'desk-place':'desk-move';
  $('skyre-desk-edit-title').textContent=
    (source.kind==='new'?'Place ':'Move ')+DESK_BUILDS[source.type].name;
  $('skyre-desk-edit-status').textContent='Tap or drag on the desk (two fingers to pan). '+(source.kind==='new'?costLabel(DESK_BUILDS[source.type].cost)+' · ':'')+'Green = valid; red = blocked.';
  $('skyre-desk-edit').hidden=false;
  document.body.classList.add('skyre-desk-placing');
  $('skyre-desk-confirm').disabled=true;
  $('skyre-desk-confirm').textContent=source.kind==='new'?'✓ Build':'✓ Move';
  window.dispatchEvent(new Event('skyre:close-panel'));
  view?.focusDesk('all');
  render();
}
function finishDeskEdit(reopen=false){
  deskEdit=null;deskCandidate=null;deskRotation=0;
  mode='explore';
  $('skyre-desk-edit').hidden=true;
  document.body.classList.remove('skyre-desk-placing');
  view?.showDeskGhost(null);
  render();
  if(reopen)window.dispatchEvent(new Event('skyre:open-desk'));
}
function confirmDeskEdit(){
  if(!deskEdit||!deskCandidate||$('skyre-desk-confirm').disabled)return;
  const action={...deskEdit},point={...deskCandidate},rotation=deskRotation;
  const w=game[group];
  if(action.kind==='new'){
    run({type:'deskPropBuild',building:action.type,...point,rotation},
      ()=>buildFreeDesk(w,action.type,point.x,point.z,rotation),
      'Built '+DESK_BUILDS[action.type].name+' on your desk.',()=>{
        selectedDeskPropId=ensureDesk(game[group]).props.at(-1)?.id||null;finishDeskEdit(true);
      });
  }else if(action.kind==='prop'){
    run({type:'deskPropMove',id:action.id,...point,rotation},
      ()=>moveFreeDesk(w,action.id,point.x,point.z,rotation),
      'Moved your desk structure.',()=>{
        selectedDeskPropId=action.id;finishDeskEdit(true);
      });
  }else if(action.kind==='site'){
    run({type:'deskSiteRelocate',site:action.site,...point,rotation},
      ()=>relocateDeskSite(w,action.site,point.x,point.z,rotation),
      'Relocated a desk structure.',()=>{
        selectedDeskPropId=ensureDesk(game[group]).props.at(-1)?.id||null;selectedDeskSiteId=null;finishDeskEdit(true);
      });
  }
}
$('skyre-desk-rotate').addEventListener('click',()=>{
  if(!deskEdit)return;
  deskRotation=(deskRotation+1)%4;
  if(deskCandidate)onDeskHover(deskCandidate);
  else $('skyre-desk-edit-status').textContent='Rotation '+(deskRotation*90)+'° · Tap the desk to select a spot.';
});
$('skyre-desk-cancel').addEventListener('click',()=>finishDeskEdit(true));
window.addEventListener('skyre:cancel-desk-edit',()=>{if(deskEdit)finishDeskEdit(false);});
$('skyre-desk-confirm').addEventListener('click',confirmDeskEdit);
function onHit(hit){
  if(hit.kind==='lamp')return toggleLamp();
  if(hit.kind==='mirror')return turnMirror();
  if(hit.kind==='gather')return gatherResource(hit.type);
  if(hit.kind==='desk-ground'){
    if(deskEdit)onDeskHover(hit);
    return;
  }
  if(hit.kind==='desk-prop'){
    selectedDeskPropId=hit.id;selectedDeskSiteId=null;
    render();window.dispatchEvent(new Event('skyre:open-desk'));
    return;
  }
  if(hit.kind==='desk-object'){
    selectedDeskObject=hit.id;renderDesk();
    window.dispatchEvent(new Event('skyre:open-desk'));
    return;
  }
  if(hit.kind==='desk-site'){
    selectedDeskSiteId=hit.id;selectedDeskPropId=null;
    if(mode==='desk-build')
      return run({type:'deskBuild',site:hit.id,building:chosenDeskBuild},()=>buildOnDesk(game[group],hit.id,chosenDeskBuild),'Built a miniature structure on the desk.');
    renderDesk();window.dispatchEvent(new Event('skyre:open-desk'));
    return;
  }
  if(hit.kind!=='tile')return;
  if(isLive&&!liveReady)return showToast('Connect to your group village first.');
  const {x,z}=hit,w=game[group],found=findAt(w,x,z);
  if(mode==='move'){
    if(!selectedMove){if(!found)return showToast('Select a building to move.');selectedMove={x,z};render();showToast('Choose an empty tile for the building.');return;}
    if(found){selectedMove={x,z};render();showToast('Selected another building.');return;}
    const from={...selectedMove};
    return run({type:'move',fromX:from.x,fromZ:from.z,x,z},()=>moveAt(w,from.x,from.z,x,z),'Moved a building.',()=>{selectedMove=null});
  }
  if(mode==='landscape')return run({type:'landscape',x,z,kind:chosenLandscape},()=>setLandscape(w,x,z,chosenLandscape),chosenLandscape==='clear'?'Cleared landscape.':`Created ${LANDSCAPE[chosenLandscape]?.name}.`);
  if(mode==='upgrade')return run({type:'upgrade',x,z},()=>upgradeAt(w,x,z),'Upgraded a village building.');
  if(mode==='build')return run({type:'build',building:chosenBuild,x,z,rotation},()=>buildAt(w,chosenBuild,x,z,rotation),`Built ${BUILD[chosenBuild].name}.`);
  if(mode==='demolish')return run({type:'remove',x,z},()=>removeAt(w,x,z),'Removed a building.');
  if(mode==='farm'){
    if(found?.type==='plot'&&found.crop)return run({type:'harvest',x,z},()=>harvest(game,group,x,z),`Harvested ${CROP[found.crop.kind].name}.`);
    return run({type:'plant',x,z,crop:chosenCrop},()=>plant(game,group,x,z,chosenCrop),`Planted ${CROP[chosenCrop].name}.`);
  }
  if(found?.type==='orchard')return run({type:'orchard',x,z},()=>harvestOrchard(w,x,z,Date.now(),received(game,group).breeze),'Collected magical fruit.');
  showToast(tileInfo(x,z));
}
try{view=createScene($('scene'),{onHit,onDeskHover,getMode:()=>mode})}catch(err){
  $('scene').insertAdjacentHTML('afterbegin','<p style="padding:30px;color:#ffdfb7">Your browser could not start 3D graphics. Try a browser with WebGL enabled.</p>');
  console.error('Skyre WebGL:',err);
}
function commit(message){syncWorkers(game[group]);if(!isLive)saveGame(localStorage,game);render();if(message)showToast(message)}
function toggleLamp(){run({type:'lamp'},()=>{game[group].lamp=!game[group].lamp;return null},'Toggled the desk lamp.');}
function turnMirror(){run({type:'mirror'},()=>{game[group].mirror=(game[group].mirror+1)%3;return null},'Turned the moon mirror.');}
function giftSeed(){run({type:'seed'},()=>linked?sendSeed(game,group):'Connect with another group before gifting seeds.','Sent seeds to another sky.');}
function gatherResource(kind){run({type:'gather',kind},()=>gather(game[group],kind),`Gathered ${kind}.`);}
function setMode(next){
  if(deskEdit){
    deskEdit=null;deskCandidate=null;$('skyre-desk-edit').hidden=true;
    document.body.classList.remove('skyre-desk-placing');view?.showDeskGhost(null);
  }
  mode=next;selectedMove=null;render();
}
function renderCatalog(){const el=$('catalog');el.replaceChildren();let items=[];
  if(mode==='build')items=Object.entries(BUILD).map(([id,v])=>({id,icon:v.icon,title:v.name,sub:costLabel(v.cost),active:id===chosenBuild}));
  if(mode==='landscape')items=[...Object.entries(LANDSCAPE).map(([id,v])=>({id,icon:v.icon,title:v.name,sub:costLabel(v.cost)+' · +'+v.charm+' charm',active:id===chosenLandscape})),{id:'clear',icon:'✕',title:'Clear landscape',sub:'Remove an existing garden or pond',active:chosenLandscape==='clear'}];
  if(mode==='upgrade')items=Object.entries(UPGRADES).map(([id,v])=>({id,icon:BUILD[id].icon,title:v.name,sub:v.description+' · '+costLabel(v.cost)}));
  if(mode==='farm')items=Object.entries(CROP).map(([id,v])=>({id,icon:id==='moonflower'?'🌙':id==='wheat'?'🌾':'🥕',title:v.name,sub:`${v.seed} seed${v.seed>1?'s':''} · ${Math.round(v.ms/1000)}s`,active:id===chosenCrop}));
  if(mode==='move')items=[{id:'move',icon:'↔',title:'Relocate any building',sub:selectedMove?'Choose an empty destination':'Tap a building to select it'}];
  if(mode==='explore')items=[{id:'wood',icon:'🌲',title:'Gather wood',sub:'5 wood · 12s regrowth'},{id:'stone',icon:'🪨',title:'Mine stone',sub:'4 stone · 12s regrowth'}];
  if(mode==='demolish')items=[{id:'remove',icon:'♻',title:'Remove buildings',sub:'Tap a placed building · recover half its materials'}];
  if(mode==='desk-build')items=[{id:'desk',icon:'☕',title:'Build on your desk',sub:'Choose a project in Desk Adventures'}];
  for(const item of items){const btn=document.createElement('button');btn.className='item'+(item.active?' selected':'');btn.type='button';
    const emoji=document.createElement('span');emoji.className='emoji';emoji.textContent=item.icon;
    const body=document.createElement('span'),title=document.createElement('strong'),sub=document.createElement('small');title.textContent=item.title;sub.textContent=item.sub;body.append(title,sub);btn.append(emoji,body);
    btn.addEventListener('click',()=>{
      if(mode==='build'){chosenBuild=item.id;render()}else if(mode==='landscape'){chosenLandscape=item.id;render()}else if(mode==='farm'){chosenCrop=item.id;render()}
      else if(mode==='explore')gatherResource(item.id);
    });el.append(btn);
  }
  $('rotate-hint').textContent=mode==='build'?`Rotation ${rotation*90}° · R to rotate`:mode==='move'?'Rearrange your village freely':mode==='farm'?'Crops grow while offline':mode==='landscape'?'Gardens brighten your island':mode==='upgrade'?'Tap an eligible building':'Drag to orbit';
  const copy={explore:'Tap <b>trees or rocks</b> in the 3D world to collect materials. Tap buildings to inspect them.',farm:'Choose a crop, then <b>tap an empty garden plot</b>. Return to harvest when it has grown. Sunlight from the other group speeds growth.',build:'Choose a building, then <b>tap a green highlighted tile</b> to place it. Red means occupied or too expensive. Rotate the preview with <b>R</b>.',move:'Tap an existing building, then <b>tap an empty tile</b> to move it for free. Select a building and use <b>R</b> to rotate it.',demolish:'Tap a building to <b>remove it</b>. You recover half the original wood and stone.',landscape:'Choose a flower garden, lily pond, or Clear. <b>Tap an empty unlocked tile</b>. Ponds block building and walking until removed.',upgrade:'Tap a Cottage, Storehouse or Windmill to upgrade it. Upgrades add villagers, storage or milling output.', 'desk-build':'Use Desk Adventures to choose a mini structure, then tap a glowing desk building spot.',
    'desk-place':'Tap or drag on the desk to position your structure, then confirm or cancel.',
    'desk-move':'Reposition the selected structure, then confirm or cancel.'};
  $('tool-help').innerHTML=copy[mode]+(mode==='build'||mode==='move'?' <button type="button" id="rotate-button" class="reset">↻ Rotate</button>':'');
  $('rotate-button')?.addEventListener('click',()=>{
    if(mode==='build'){rotation=(rotation+1)%4;render();return}
    if(!selectedMove)return showToast('Select a building to rotate first.');
    run({type:'rotate',x:selectedMove.x,z:selectedMove.z},()=>rotateAt(game[group],selectedMove.x,selectedMove.z),'Rotated the selected building.');
  });
  $('scene-hint').textContent={explore:'Explore: tap a tree or rock to gather',farm:'Farm: tap a plot to plant or harvest',build:'Build: tap a green tile to place',move:selectedMove?'Move: choose an empty destination':'Move: tap any building',demolish:'Remove: tap a building to recycle',landscape:'Landscape: tap a free tile',upgrade:'Upgrade: tap a cottage, storehouse or windmill','desk-build':'Desk: tap a glowing desk building spot','desk-place':'Desk: choose a free position','desk-move':'Desk: choose a new position'}[mode];
}
function renderProduction(){const el=$('production');el.replaceChildren();const w=game[group];const recipes=[{type:'windmill',title:'🌾 Grind cloud wheat',desc:'3 wheat → 2 flour',needs:{wheat:3}},{type:'bakery',title:'🥖 Bake fresh bread',desc:'2 flour → 6 food + 4 coins',needs:{flour:2}}];
  for(const r of recipes){const btn=document.createElement('button');btn.className='recipe';const built=w.buildings.some(b=>b.type===r.type);const affordable=canAfford(w,r.needs);btn.disabled=!built||!affordable;
    const b=document.createElement('b'),sm=document.createElement('small');b.textContent=r.title;sm.textContent=built?r.desc:'Build a '+BUILD[r.type].name+' to unlock';btn.append(b,sm);
    btn.onclick=()=>run({type:'craft',building:r.type},()=>processBuilding(w,r.type),r.type==='windmill'?'Milled flour.':'Baked bread.');
    el.append(btn);
  }
}
function workerStatus(world,worker){
  if(worker.job==='idle')return 'Off duty';
  if(!planWorkerRoute(game,group,worker))return 'No reachable workplace · check nearby buildings';
  if(worker.job==='farmer')return world.buildings.some(b=>b.type==='plot'||b.type==='orchard')?'Growing and storing harvests':'Needs a plot or orchard';
  if(worker.job==='miller')return !world.buildings.some(b=>b.type==='windmill')?'Needs a windmill':world.buildings.some(b=>b.type==='windmill'&&buildingStock(b,'wheat')>=3&&buildingFree(b,'flour')>=2)?'Milling':'Waiting for a wheat delivery';
  if(worker.job==='baker')return !world.buildings.some(b=>b.type==='bakery')?'Needs a bakery':world.buildings.some(b=>b.type==='bakery'&&buildingStock(b,'flour')>=2&&buildingFree(b,'food')>=6)?'Baking':'Waiting for a flour delivery';
  if(worker.job==='hauler')return planWorkerRoute(game,group,worker)?'Carrying baskets between workplaces':'Waiting for something to deliver';
  if(worker.job==='forager')return world.resources.wood>=250&&world.resources.stone>=250?'Materials full':'Gathering supplies';
  return 'Working';
}
function renderWorkers(){
  const world=game[group],list=$('workers');list.replaceChildren();
  const picker=$('autocrop');picker.value=world.autoCrop;
  $('worker-summary').textContent=`${world.workers.length} residents · ${world.workers.filter(w=>w.job==='hauler').length} haulers · ${world.workStats?.delivered||0} deliveries · up to ${Math.round(MAX_OFFLINE_MS/3600000)}h offline`;
  $('workers-empty').hidden=world.workers.length>0;
  if(selectedRoute&&!world.workers.some(w=>w.id===selectedRoute))selectedRoute=null;
  for(const worker of world.workers){
    const card=document.createElement('div');card.className='worker-card';
    const portrait=document.createElement('span');portrait.className='worker-portrait';portrait.textContent=JOBS[worker.job].icon;
    const name=document.createElement('div');name.className='worker-name';
    const title=document.createElement('strong');title.textContent=worker.name;
    const status=document.createElement('small');status.textContent=workerStatus(world,worker);
    name.append(title,status);
    const select=document.createElement('select');select.className='job-select';select.setAttribute('aria-label',`Choose a job for ${worker.name}`);
    for(const [id,job] of Object.entries(JOBS)){const option=document.createElement('option');option.value=id;option.textContent=job.icon+' '+job.name;select.append(option)}
    select.value=worker.job;
    select.addEventListener('change',()=>run({type:'job',workerId:worker.id,job:select.value},()=>assignWorker(game[group],worker.id,select.value,Date.now()),`Updated ${worker.name}'s job.`));
    card.append(portrait,name,select);
    const plan=planWorkerRoute(game,group,worker);
    if(plan){
      const btn=document.createElement('button');btn.className='route-button'+(selectedRoute===worker.id?' selected':'');
      btn.type='button';btn.setAttribute('aria-pressed',String(selectedRoute===worker.id));
      const ms=workInterval(world,worker,JOBS[worker.job].ms,plan);
      btn.textContent=`${selectedRoute===worker.id?'✦ ':'↗ '}Show walking route · ${(ms/1000).toFixed(0)}s cycle`;
      btn.onclick=()=>{selectedRoute=selectedRoute===worker.id?null:worker.id;render()};
      card.append(btn);
    }
    list.append(card);
  }
  const journal=$('worker-journal');journal.replaceChildren();
  for(const activity of (world.workLog.length?world.workLog.slice(0,4):[{text:'Your villagers are settling in. Assign them a job to get started.'}])){
    const row=document.createElement('div');row.className='worker-event';row.textContent=activity.text;journal.append(row);
  }
}
function renderInventory(){
  const w=game[group],used=stockUsed(w),capacity=storageCapacity(w),totals=inventoryTotals(w);
  $('store-used').textContent=`${used} / ${capacity}`;
  $('store-fill').style.width=`${Math.min(100,Math.round(used/capacity*100))}%`;
  const overview=$('inventory-overview');overview.replaceChildren();
  for(const good of GOODS){
    const c=document.createElement('div');c.className='inventory-total';
    const n=document.createElement('strong'),label=document.createElement('small');
    n.textContent=totals[good];label.textContent=good+' total · '+(totals[good]-(w.resources[good]||0))+' waiting';
    c.append(n,label);overview.append(c);
  }
  const list=$('inventory-buildings');list.replaceChildren();
  const stocked=w.buildings.filter(b=>STOCK_LIMITS[b.type]);
  if(!stocked.length){const note=document.createElement('p');note.className='inventory-empty';note.textContent='Build a garden, orchard or workshop to see its stored goods here.';list.append(note);return;}
  for(const b of stocked){
    const row=document.createElement('div');row.className='inventory-building';
    const info=document.createElement('div');info.className='inventory-building-info';
    const name=document.createElement('strong');name.textContent=BUILD[b.type].icon+' '+BUILD[b.type].name+' · '+b.x+','+b.z;
    const stock=document.createElement('small');stock.textContent=Object.keys(STOCK_LIMITS[b.type]).map(g=>`${g} ${buildingStock(b,g)}/${STOCK_LIMITS[b.type][g]}`).join(' · ');
    info.append(name,stock);row.append(info);
    const buttons=document.createElement('div');buttons.className='inventory-actions';
    const hasGoods=GOODS.some(g=>buildingStock(b,g)>0);
    const collect=document.createElement('button');collect.type='button';collect.textContent='Collect';collect.disabled=!hasGoods||used>=capacity;
    collect.setAttribute('aria-label','Collect goods from '+BUILD[b.type].name+' at '+b.x+','+b.z);
    collect.onclick=()=>run({type:'collect',buildingId:b.id},()=>collectBuilding(game[group],b.id),'Collected goods from a building.');buttons.append(collect);
    if(b.type==='windmill'||b.type==='bakery'){
      const supply=document.createElement('button');supply.type='button';supply.textContent='Supply';
      const g=b.type==='windmill'?'wheat':'flour';supply.disabled=!w.resources[g]||buildingFree(b,g)===0;
      supply.setAttribute('aria-label','Supply '+BUILD[b.type].name+' with '+g);
      supply.onclick=()=>run({type:'supply',buildingId:b.id},()=>supplyBuilding(game[group],b.id),'Supplied a workshop.');buttons.append(supply);
    }
    row.append(buttons);list.append(row);
  }
}
function renderGoals(){
  const el=$('goals');el.replaceChildren();
  const w=game[group];
  for(const goal of GOALS){
    const claimed=w.progress?.claimed?.includes(goal.id);
    const ready=goalReady(w,goal.id);
    const card=document.createElement('div');card.className='goal'+(claimed?' done':ready?' ready':'');
    const copy=document.createElement('div'),title=document.createElement('strong'),desc=document.createElement('small');
    title.textContent=(claimed?'✓ ':ready?'✦ ':'◌ ')+goal.name;
    desc.textContent=goal.description+' · '+costLabel(goal.reward);
    copy.append(title,desc);card.append(copy);
    const button=document.createElement('button');button.textContent=claimed?'Done':ready?'Claim':'Growing';button.disabled=claimed||!ready;
    button.onclick=()=>{
      run({type:'goal',goal:goal.id},()=>claimGoal(w,goal.id),'Claimed the '+goal.name+' reward.');
    };
    card.append(button);el.append(card);
  }
}
function renderDesk(){
  const w=game[group],d=ensureDesk(w),now=Date.now(),landmarks=$('desk-landmarks');
  $('desk-overview').textContent=d.expedition
    ? '📚 A villager is exploring the books · '+Math.max(0,Math.ceil((d.expedition.endsAt-now)/1000))+'s until they return'
    : '✦ '+d.finds+' discoveries · '+(d.builds.length+d.props.length)+' desk structures built';
  landmarks.replaceChildren();
  for(const [id,object] of Object.entries(DESK_OBJECTS)){
    const card=document.createElement('div');card.className='desk-card';
    const title=document.createElement('strong');title.textContent=object.icon+' '+object.name;
    const info=document.createElement('small');info.textContent=object.description;
    const actions=document.createElement('div');actions.className='desk-card-actions';
    const see=document.createElement('button');see.type='button';see.textContent='Look closer';
    see.onclick=()=>{selectedDeskObject=id;view?.focusDesk(id);};
    actions.append(see);
    const act=document.createElement('button');act.type='button';
    if(id==='books'){
      act.textContent=d.expedition?'Exploring…':'Send explorer';
      act.disabled=!!d.expedition||!deskAt(w,'crossing')||!(w.workers||[]).length;
      act.title=!deskAt(w,'crossing')?'Build the Pencil Footbridge first':'';
      act.onclick=()=>run({type:'deskExplore'},()=>startDeskExpedition(w),'A villager has set off to explore the giant books.');
    }else{
      const cool=Math.max(0,(d.lastCollected[id]||0)+object.cooldown-now);
      act.textContent=cool&&d.lastCollected[id]>0?'Ready in '+Math.ceil(cool/1000)+'s':'Collect';
      act.disabled=cool>0&&d.lastCollected[id]>0;
      act.onclick=()=>run({type:'deskCollect',object:id},()=>collectDeskObject(w,id),'Collected tiny supplies from the '+object.name+'.');
    }
    actions.append(act);card.append(title,info,actions);landmarks.append(card);
  }
  $('desk-status').textContent=chosenDeskBuild==='bridge'?'The Pencil Footbridge must connect at Book Crossing.':'Choose a structure and place it freely on the wood. Existing marked spots still work.';
  const catalog=$('desk-build-catalog');catalog.replaceChildren();
  for(const [id,build] of Object.entries(DESK_BUILDS)){
    const button=document.createElement('button');button.className='desk-project'+(id===chosenDeskBuild?' chosen':'');
    button.type='button';button.setAttribute('aria-pressed',String(id===chosenDeskBuild));
    const label=document.createElement('strong');label.textContent=build.icon+' '+build.name;
    const hint=document.createElement('small');hint.textContent=build.description+' · '+costLabel(build.cost)+(id==='bridge'?' · Fixed crossing':' · Place freely');
    button.append(label,hint);
    button.onclick=()=>{
      chosenDeskBuild=id;
      if(FREE_DESK_TYPES.includes(id)){beginDeskEdit({kind:'new',type:id});return;}
      mode='desk-build';render();view?.focusDesk('all');
      showToast('Tap Book Crossing to build the Pencil Footbridge.');
    };
    catalog.append(button);
  }
  const sites=$('desk-sites');sites.replaceChildren();
  for(const site of DESK_SITES){
    const existing=deskAt(w,site.id),row=document.createElement('div');row.className='desk-site';
    const info=document.createElement('div');
    const title=document.createElement('strong');title.textContent=site.name;
    const caption=document.createElement('small');
    caption.textContent=existing?'Built: '+DESK_BUILDS[existing.type].name:site.description+' · '+site.allowed.map(t=>DESK_BUILDS[t].name).join(' / ');
    info.append(title,caption);
    const actions=document.createElement('div');actions.className='desk-card-actions';
    const btn=document.createElement('button');btn.type='button';
    if(existing){
      if(existing.type!=='bridge'){
        const move=document.createElement('button');move.type='button';move.textContent='Move';
        move.onclick=()=>beginDeskEdit({kind:'site',site:site.id,type:existing.type,rotation:0});
        actions.append(move);
      }
      btn.textContent='Store';btn.onclick=()=>{
        if(!confirm('Store the '+DESK_BUILDS[existing.type].name+'? You will recover half its materials.'))return;
        run({type:'deskRemove',site:site.id},()=>removeFromDesk(w,site.id),'Stored a desk building.');
      };
    }else{
      const desired=site.allowed.includes(chosenDeskBuild)?chosenDeskBuild:site.allowed[0];
      btn.textContent='Build '+DESK_BUILDS[desired].name;
      btn.disabled=!canAfford(w,DESK_BUILDS[desired].cost);
      btn.onclick=()=>{chosenDeskBuild=desired;mode='desk-build';run({type:'deskBuild',site:site.id,building:desired},()=>buildOnDesk(w,site.id,desired),'Built '+DESK_BUILDS[desired].name+' on the desk.');};
    }
    actions.append(btn);row.append(info,actions);sites.append(row);
  }
  // Contextual actions, similar to object selection in village building games.
  const selected=selectedDeskPropId?deskProp(w,selectedDeskPropId):null;
  const inspector=$('desk-selected');inspector.replaceChildren();inspector.hidden=!selected;
  if(selected){
    const name=document.createElement('strong');name.textContent=DESK_BUILDS[selected.type].icon+' '+DESK_BUILDS[selected.type].name;
    const position=document.createElement('small');
    position.textContent='Placed at '+selected.x+', '+selected.z+' · '+(selected.rotation*90)+'° · Tap objects directly on the desk to select.';
    const actions=document.createElement('div');actions.className='desk-inspector-actions';
    function add(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;actions.append(b);}
    add('↔ Move',()=>beginDeskEdit({kind:'prop',id:selected.id,type:selected.type,rotation:selected.rotation}));
    add('↻ Rotate',()=>run({type:'deskPropRotate',id:selected.id},()=>rotateFreeDesk(w,selected.id),'Rotated desk structure.'));
    add('▣ Store',()=>{
      if(!confirm('Store this '+DESK_BUILDS[selected.type].name+' and recover half its materials?'))return;
      run({type:'deskPropStore',id:selected.id},()=>storeFreeDesk(w,selected.id),'Stored desk structure.',()=>{selectedDeskPropId=null;});
    });
    inspector.append(name,position,actions);
  }
  const propsList=$('desk-props');propsList.replaceChildren();
  if(!d.props.length){
    const empty=document.createElement('p');empty.className='section-description';
    empty.textContent='Nothing placed freely yet. Choose a project above to build wherever it fits.';
    propsList.append(empty);
  }
  for(const prop of d.props){
    const row=document.createElement('div');row.className='desk-site'+(selectedDeskPropId===prop.id?' selected':'');
    const info=document.createElement('div'),name=document.createElement('strong'),where=document.createElement('small');
    name.textContent=DESK_BUILDS[prop.type].icon+' '+DESK_BUILDS[prop.type].name;
    where.textContent='Position '+prop.x+', '+prop.z+' · '+prop.rotation*90+'°';
    info.append(name,where);
    const actions=document.createElement('div');actions.className='desk-card-actions';
    const select=document.createElement('button');select.type='button';select.textContent='Select';
    select.onclick=()=>{selectedDeskPropId=prop.id;render();};
    actions.append(select);row.append(info,actions);propsList.append(row);
  }
}
function renderIsland(){
  const world=game[group],level=islandStage(world),next=LAND_STAGES[level+1],current=LAND_STAGES[level];
  $('island-level').textContent=current.label+` · Tier ${level+1} of ${LAND_STAGES.length}`;
  $('island-charm').textContent=String(villageCharm(world));
  $('island-tiles').textContent=String(world.buildings.length)+' buildings · '+Object.keys(world.terrain||{}).length+' landscaped tiles';
  const button=$('expand-island');button.disabled=!next||!canAfford(world,next.cost);
  button.textContent=next?'Expand to '+next.label+' · '+costLabel(next.cost):'The island is fully expanded';
  $('island-next').textContent=next?`Unlock a new ring of land for farms, homes and gardens.`:'Every corner of the island can now be developed.';
}
function renderLogistics(){
  const w=game[group],summary=roadSummary(game,group);
  $('road-total').textContent=String(summary.roads);
  $('road-users').textContent=`${summary.roadUsers} / ${summary.working}`;
  $('route-total').textContent=`${summary.reachable} / ${summary.working}`;
  $('logistics-hint').textContent=summary.roads
    ? 'Roads lower travel time for villagers who use them. Open a worker route to find a useful place for the next path tile.'
    : 'Start by placing Stone Paths between your cottage and gardens. Roads are optional, but they speed up automated work.';
}
function render(){const w=game[group],n=game[other(group)],effects=received(game,group);
  $('world-name').textContent=w.name;$('neighbor-name').textContent=n.name;
  $('sky-badge').textContent=effects.sun?'☼ Borrowed sunshine':'☾ Gentle twilight';
  $('villager-count').textContent=w.workers.length+' villagers · '+w.workers.filter(worker=>worker.job!=='idle').length+' working · '+w.buildings.length+' buildings';
  $('neighbor-details').textContent=isLive&&!linked?'Another group must join to unlock shared weather and seed gifts.':`${n.buildings.length} buildings · ${n.resources.food} food`;
  $('connection-status').hidden=!isLive;
  $('connection-text').textContent=linked?'Two Telegram groups are connected!':looking?'Waiting for another Telegram group to find a sky…':'Your village is private until you choose to find a neighbor.';
  $('find-neighbor').hidden=linked||looking;
  $('send-seed').disabled=isLive&&!linked;
  $('effect-note').textContent=[effects.sun?'☀ Borrowed sunshine makes crops grow 20% faster.':null,effects.moonbeam?'☾ Their mirror blesses harvests with coins.':null,effects.breeze?'🌬 Their windmill speeds up your Dream Orchards by 20%.':null].filter(Boolean).join(' ')||'✧ Another group can send sunshine, breeze, moonlight, and seeds to your village.';
  $('resources').replaceChildren();for(const [id,icon,label] of entries){const cell=document.createElement('div');cell.className='resource';const num=document.createElement('span'),cap=document.createElement('span');num.className='number';cap.className='caption';num.textContent=icon+' '+(w.resources[id]||0);cap.textContent=label;cell.append(num,cap);$('resources').append(cell)}
  document.querySelectorAll('[data-group]').forEach(btn=>btn.classList.toggle('active',btn.dataset.group===group));
  document.querySelectorAll('[data-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.mode===mode));
  $('toggle-lamp').querySelector('small').textContent=w.lamp?'Turn off their sunlight':'Give them sunlight';
  $('turn-mirror').querySelector('small').textContent=w.mirror===2?'Moonbeam is aligned':'Angle '+(w.mirror+1)+'/3 · redirect moonlight';
  $('events').replaceChildren();const recent=game.events.length?game.events.slice(0,5):[{message:'Nothing has stirred the universe yet. Be the first.'}];
  for(const e of recent){const div=document.createElement('div');div.className='event';div.textContent=e.message;if(e.at){const time=document.createElement('time');time.textContent=new Date(e.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});div.append(time)}$('events').append(div)}
  renderCatalog();renderProduction();renderInventory();renderWorkers();renderLogistics();renderGoals();renderIsland();renderDesk();
  const deskGhost=deskEdit&&deskCandidate?{type:deskEdit.type,...deskCandidate,rotation:deskRotation,
    valid:!deskPlacementError(w,deskEdit.type,deskCandidate.x,deskCandidate.z,deskRotation,
      deskEdit.kind==='prop'?deskEdit.id:null,deskEdit.kind==='site'?deskEdit.site:null)}:null;
  view?.refresh(game,group,{mode,buildType:chosenBuild,landscapeKind:chosenLandscape,rotation,selectedMove,
    selectedDeskProp:selectedDeskPropId,deskGhost});view?.highlightRoute(selectedRoute);
}
$('desk-camera').onclick=()=>view?.focusDesk('all');
$('desk-back').onclick=()=>{setMode('explore');view?.setCamera(false);};
window.addEventListener('skyre:focus-desk',()=>view?.focusDesk('all'));
for(const button of document.querySelectorAll('[data-group]'))button.addEventListener('click',()=>{if(isLive)return;group=button.dataset.group;selectedMove=null;selectedRoute=null;zoomed=false;view?.setCamera(false);render();showToast(`You entered ${game[group].name}.`)});
for(const button of document.querySelectorAll('[data-mode]'))button.addEventListener('click',()=>setMode(button.dataset.mode));
$('expand-island').onclick=()=>run({type:'expand'},()=>expandIsland(game[group]),'Your island has gained a new shoreline.');
$('autocrop').onchange=()=>run({type:'autoCrop',crop:$('autocrop').value},()=>setAutoCrop(game[group],$('autocrop').value),'Updated farming crop.');
$('toggle-lamp').onclick=toggleLamp;$('turn-mirror').onclick=turnMirror;$('send-seed').onclick=giftSeed;
$('find-neighbor').onclick=()=>run({type:'connect'},()=>null,'Looking for another group.');
$('camera-btn').onclick=()=>{zoomed=!zoomed;view?.setCamera(zoomed);$('camera-btn').textContent=zoomed?'⌕ Zoom out':'⌕ Zoom in'};
$('character-camera-btn').onclick=()=>{
  if(!view?.focusVillager())return showToast('Build a Cottage to welcome villagers.');
  zoomed=false;$('camera-btn').textContent='⌕ Zoom in';
  showToast('Meet your villagers! Drag to see their outfits and faces.');
};
// Fullscreen API on Android, CSS immersive fallback on browsers that disallow it
// (including some iPhone versions). Either path keeps the 3D scene responsive.
const viewport=$('scene'),fullscreenButton=$('fullscreen-btn');
function toggleImmersive(active){
  document.body.classList.toggle('immersive-game',active);
  fullscreenButton.textContent=active?'↙ Exit full screen':'⛶ Full screen';
  fullscreenButton.setAttribute('aria-label',active?'Exit expanded game view':'Expand game view');
  if(active){
    if(viewport.requestFullscreen && !document.fullscreenElement){
      Promise.resolve(viewport.requestFullscreen()).catch(()=>{});
    }
  }else if(document.fullscreenElement){
    Promise.resolve(document.exitFullscreen()).catch(()=>{});
  }
}
fullscreenButton.onclick=()=>toggleImmersive(!document.body.classList.contains('immersive-game'));
document.addEventListener('fullscreenchange',()=>{
  if(!document.fullscreenElement&&document.body.classList.contains('immersive-game')){
    document.body.classList.remove('immersive-game');
    fullscreenButton.textContent='⛶ Full screen';
    fullscreenButton.setAttribute('aria-label','Expand game view');
  }
});

$('reset').onclick=()=>{if(isLive)return;if(!confirm('Reset both demo villages and remove all saved progress in this browser?'))return;localStorage.removeItem(SAVE_KEY);location.reload()};
document.addEventListener('keydown',event=>{
  if(document.activeElement?.matches('input,textarea,select'))return;
  if(event.key.toLowerCase()==='r'&&!event.repeat){
  if(deskEdit){$('skyre-desk-rotate').click();return;}
  if(mode==='build'){rotation=(rotation+1)%4;render()}
  else if(mode==='move'&&selectedMove){run({type:'rotate',x:selectedMove.x,z:selectedMove.z},()=>rotateAt(game[group],selectedMove.x,selectedMove.z),'Rotated the selected building.');}
}if(event.key==='Escape'){if(deskEdit)finishDeskEdit(true);else setMode('explore')}});
// Crops and workers advance while playing. Offline catch-up happens exactly once on load.
const offlineActions=Object.values(initialWork).reduce((sum,c)=>sum+Object.values(c).reduce((a,b)=>a+b,0),0);
if(offlineActions>0)showToast(`Welcome back! Your villagers completed ${offlineActions} jobs while you were away.`);
window.setInterval(()=>{
  if(isLive){fetchRemote();return;}
  const counts=advanceGame(game,Date.now());
  saveGame(localStorage,game);
  if(Object.values(counts).some(c=>Object.values(c).some(n=>n>0)))render();
},isLive?4000:2000);
$('group-picker').hidden=isLive;
$('reset').hidden=isLive;
$('network-status').textContent=isLive?'Connecting to Telegram group…':'LOCAL DEMO · Saves in this browser only';
render();
window.dispatchEvent(new CustomEvent('skyre:ready',{detail:{ok:!!view}}));
if(isLive)fetchRemote();
try{window.Telegram?.WebApp?.ready();window.Telegram?.WebApp?.expand()}catch{}
