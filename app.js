import {SAVE_KEY,CROP,BUILD,other,loadGame,saveGame,findAt,buildAt,removeAt,moveAt,rotateAt,received,growth,plant,harvest,harvestOrchard,orchardReady,gather,processBuilding,sendSeed,record,canAfford,GOALS,goalReady,claimGoal} from './core.js';
import {createScene} from './scene.js';

const $=id=>document.getElementById(id);
const game=loadGame(localStorage);
let group='a',mode='explore',chosenBuild='plot',chosenCrop='wheat',rotation=0,zoomed=false,toastTimer,selectedMove=null;
const entries=[['wood','🪵','Wood'],['stone','◈','Stone'],['seeds','✧','Seeds'],['wheat','🌾','Wheat'],['flour','◌','Flour'],['food','🍞','Food'],['coins','✦','Coins']];
const showToast=text=>{const el=$('toast');el.textContent=text;el.classList.add('shown');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('shown'),3200)};
const costLabel=cost=>Object.entries(cost).map(([k,v])=>`${v} ${k}`).join(' · ');
const tileInfo=(x,z)=>{
  const b=findAt(game[group],x,z);
  if(!b)return 'Empty tile. Choose Build to create something here.';
  if(b.type==='plot'&&b.crop){const pct=Math.round(growth(game,group,b)*100);return pct===100?`${CROP[b.crop.kind].name} is ready! Choose Farm and tap to harvest.`:`${CROP[b.crop.kind].name} growing (${pct}%).`}
  if(b.type==='windmill')return 'Windmill: turn harvested wheat into flour using Craft & Produce.';
  if(b.type==='bakery')return 'Bakery: transform flour into bread and coins below.';
  if(b.type==='orchard')return orchardReady(b)?'Dream Orchard: ripe magical fruit! Tap to collect.':'Dream Orchard: fruit is growing. Return later to collect food and seeds.';
  return `${BUILD[b.type]?.name||b.type}. Choose Remove to reclaim half its building materials.`;
};
let view;
function onHit(hit){
  if(hit.kind==='lamp'){toggleLamp();return}
  if(hit.kind==='mirror'){turnMirror();return}
  if(hit.kind==='gather'){gatherResource(hit.type);return}
  if(hit.kind!=='tile')return;
  const {x,z}=hit,w=game[group];let err=null,success='';
  if(mode==='move'){
    const found=findAt(w,x,z);
    if(!selectedMove){
      if(!found)return showToast('Choose a building first, then choose where it should move.');
      selectedMove={x,z};render();showToast(`Selected ${BUILD[found.type]?.name||'building'}. Tap an empty tile to relocate it.`);return;
    }
    if(found){
      selectedMove={x,z};render();showToast('Selected this building instead. Now choose an empty tile.');return;
    }
    err=moveAt(w,selectedMove.x,selectedMove.z,x,z);
    if(!err)selectedMove=null;
    success='Your building has a lovely new home!';
  }else if(mode==='build'){
    err=buildAt(w,chosenBuild,x,z,rotation);
    success=`Built ${BUILD[chosenBuild].name}. Your village is growing!`;
  }else if(mode==='demolish'){
    err=removeAt(w,x,z);success='Building removed. Some materials were recovered.';
  }else if(mode==='farm'){
    const b=findAt(w,x,z);
    if(b?.type==='plot'&&b.crop){err=harvest(game,group,x,z);success=`Harvested ${CROP[b.crop.kind].name}!`}
    else {err=plant(game,group,x,z,chosenCrop);success=`Planted ${CROP[chosenCrop].name}. Come back as it grows.`}
  }else{
    const b=findAt(w,x,z);
    if(b?.type==='orchard'){
      err=harvestOrchard(w,x,z);
      success='Collected 4 food and a magical seed from the orchard.';
    }else{showToast(tileInfo(x,z));return}
  }
  if(err){showToast(err);return}
  record(game,`${w.name}: ${success}`);commit(success);
}
try{view=createScene($('scene'),{onHit,getMode:()=>mode})}catch(err){
  $('scene').insertAdjacentHTML('afterbegin','<p style="padding:30px;color:#ffdfb7">Your browser could not start 3D graphics. Try a browser with WebGL enabled.</p>');
  console.error('Skyre WebGL:',err);
}
function commit(message){saveGame(localStorage,game);render();if(message)showToast(message)}
function toggleLamp(){game[group].lamp=!game[group].lamp;const text=game[group].lamp?`Your lamp brought sunrise to ${game[other(group)].name}.`:`Your lamp let night fall over ${game[other(group)].name}.`;record(game,text);commit(text)}
function turnMirror(){game[group].mirror=(game[group].mirror+1)%3;const text=game[group].mirror===2?`Your moonbeam reached ${game[other(group)].name}.`:'The mirror moved. Two turns may align the moonbeam.';record(game,text);commit(text)}
function giftSeed(){const err=sendSeed(game,group);if(err)return showToast(err);const text=`You gifted two seeds to ${game[other(group)].name}.`;record(game,text);commit(text)}
function gatherResource(kind){const err=gather(game[group],kind);if(err)return showToast(err);const text=kind==='wood'?'Gathered 5 wood from the grove.':'Collected 4 stone from the quarry.';record(game,`${game[group].name}: ${text}`);commit(text)}
function setMode(next){mode=next;selectedMove=null;render()}
function renderCatalog(){const el=$('catalog');el.replaceChildren();let items=[];
  if(mode==='build')items=Object.entries(BUILD).map(([id,v])=>({id,icon:v.icon,title:v.name,sub:costLabel(v.cost),active:id===chosenBuild}));
  if(mode==='farm')items=Object.entries(CROP).map(([id,v])=>({id,icon:id==='moonflower'?'🌙':id==='wheat'?'🌾':'🥕',title:v.name,sub:`${v.seed} seed${v.seed>1?'s':''} · ${Math.round(v.ms/1000)}s`,active:id===chosenCrop}));
  if(mode==='move')items=[{id:'move',icon:'↔',title:'Relocate any building',sub:selectedMove?'Choose an empty destination':'Tap a building to select it'}];
  if(mode==='explore')items=[{id:'wood',icon:'🌲',title:'Gather wood',sub:'5 wood · 12s regrowth'},{id:'stone',icon:'🪨',title:'Mine stone',sub:'4 stone · 12s regrowth'}];
  if(mode==='demolish')items=[{id:'remove',icon:'♻',title:'Remove buildings',sub:'Tap a placed building · recover half its materials'}];
  for(const item of items){const btn=document.createElement('button');btn.className='item'+(item.active?' selected':'');btn.type='button';
    const emoji=document.createElement('span');emoji.className='emoji';emoji.textContent=item.icon;
    const body=document.createElement('span'),title=document.createElement('strong'),sub=document.createElement('small');title.textContent=item.title;sub.textContent=item.sub;body.append(title,sub);btn.append(emoji,body);
    btn.addEventListener('click',()=>{
      if(mode==='build'){chosenBuild=item.id;render()}else if(mode==='farm'){chosenCrop=item.id;render()}
      else if(mode==='explore')gatherResource(item.id);
    });el.append(btn);
  }
  $('rotate-hint').textContent=mode==='build'?`Rotation ${rotation*90}° · R to rotate`:mode==='move'?'Rearrange your village freely':mode==='farm'?'Crops grow while offline':'Drag to orbit';
  const copy={explore:'Tap <b>trees or rocks</b> in the 3D world to collect materials. Tap buildings to inspect them.',farm:'Choose a crop, then <b>tap an empty garden plot</b>. Return to harvest when it has grown. Sunlight from the other group speeds growth.',build:'Choose a building, then <b>tap a green highlighted tile</b> to place it. Red means occupied or too expensive. Rotate the preview with <b>R</b>.',move:'Tap an existing building, then <b>tap an empty tile</b> to move it for free. Select a building and use <b>R</b> to rotate it.',demolish:'Tap a building to <b>remove it</b>. You recover half the original wood and stone.'};
  $('tool-help').innerHTML=copy[mode]+(mode==='build'||mode==='move'?' <button type="button" id="rotate-button" class="reset">↻ Rotate</button>':'');
  $('rotate-button')?.addEventListener('click',()=>{
    if(mode==='build'){rotation=(rotation+1)%4;render();return}
    if(!selectedMove)return showToast('Select a building to rotate first.');
    const err=rotateAt(game[group],selectedMove.x,selectedMove.z);
    if(err)return showToast(err);
    commit('Rotated the selected building.');
  });
  $('scene-hint').textContent={explore:'Explore: tap a tree or rock to gather',farm:'Farm: tap a plot to plant or harvest',build:'Build: tap a green tile to place',move:selectedMove?'Move: choose an empty destination':'Move: tap any building',demolish:'Remove: tap a building to recycle'}[mode];
}
function renderProduction(){const el=$('production');el.replaceChildren();const w=game[group];const recipes=[{type:'windmill',title:'🌾 Grind cloud wheat',desc:'3 wheat → 2 flour',needs:{wheat:3}},{type:'bakery',title:'🥖 Bake fresh bread',desc:'2 flour → 6 food + 4 coins',needs:{flour:2}}];
  for(const r of recipes){const btn=document.createElement('button');btn.className='recipe';const built=w.buildings.some(b=>b.type===r.type);const affordable=canAfford(w,r.needs);btn.disabled=!built||!affordable;
    const b=document.createElement('b'),sm=document.createElement('small');b.textContent=r.title;sm.textContent=built?r.desc:'Build a '+BUILD[r.type].name+' to unlock';btn.append(b,sm);
    btn.onclick=()=>{const err=processBuilding(w,r.type);if(err)return showToast(err);const text=r.type==='windmill'?'Your windmill made 2 flour.':'Your bakery made bread and earned 4 coins.';record(game,`${w.name}: ${text}`);commit(text)};
    el.append(btn);
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
      const err=claimGoal(w,goal.id);if(err)return showToast(err);
      record(game,`${w.name} achieved: ${goal.name}.`);commit('A lovely milestone! '+goal.name+' reward collected.');
    };
    card.append(button);el.append(card);
  }
}
function render(){const w=game[group],n=game[other(group)],effects=received(game,group);
  $('world-name').textContent=w.name;$('neighbor-name').textContent=n.name;
  $('sky-badge').textContent=effects.sun?'☼ Borrowed sunshine':'☾ Gentle twilight';
  $('villager-count').textContent=Math.min(6,Math.max(1,w.buildings.filter(b=>b.type==='cottage').length*2))+' villagers wandering · '+w.buildings.length+' buildings';
  $('neighbor-details').textContent=`${n.buildings.length} buildings · ${n.resources.food} food`;
  $('effect-note').textContent=effects.sun?'☀ The other group is lighting your farms: crops grow 20% faster.':effects.moonbeam?'☾ Their moonbeam blesses your harvests with extra coins.':'✧ Another group can send sunlight, moonlight, and seeds to your village.';
  $('resources').replaceChildren();for(const [id,icon,label] of entries){const cell=document.createElement('div');cell.className='resource';const num=document.createElement('span'),cap=document.createElement('span');num.className='number';cap.className='caption';num.textContent=icon+' '+(w.resources[id]||0);cap.textContent=label;cell.append(num,cap);$('resources').append(cell)}
  document.querySelectorAll('[data-group]').forEach(btn=>btn.classList.toggle('active',btn.dataset.group===group));
  document.querySelectorAll('[data-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.mode===mode));
  $('toggle-lamp').querySelector('small').textContent=w.lamp?'Turn off their sunlight':'Give them sunlight';
  $('turn-mirror').querySelector('small').textContent=w.mirror===2?'Moonbeam is aligned':'Angle '+(w.mirror+1)+'/3 · redirect moonlight';
  $('events').replaceChildren();const recent=game.events.length?game.events.slice(0,5):[{message:'Nothing has stirred the universe yet. Be the first.'}];
  for(const e of recent){const div=document.createElement('div');div.className='event';div.textContent=e.message;if(e.at){const time=document.createElement('time');time.textContent=new Date(e.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});div.append(time)}$('events').append(div)}
  renderCatalog();renderProduction();renderGoals();view?.refresh(game,group,{mode,buildType:chosenBuild,rotation,selectedMove});
}
for(const button of document.querySelectorAll('[data-group]'))button.addEventListener('click',()=>{group=button.dataset.group;selectedMove=null;zoomed=false;view?.setCamera(false);render();showToast(`You entered ${game[group].name}.`)});
for(const button of document.querySelectorAll('[data-mode]'))button.addEventListener('click',()=>setMode(button.dataset.mode));
$('toggle-lamp').onclick=toggleLamp;$('turn-mirror').onclick=turnMirror;$('send-seed').onclick=giftSeed;
$('camera-btn').onclick=()=>{zoomed=!zoomed;view?.setCamera(zoomed);$('camera-btn').textContent=zoomed?'⌕ Zoom out':'⌕ Zoom in'};
$('reset').onclick=()=>{if(!confirm('Reset both demo villages and remove all saved progress in this browser?'))return;localStorage.removeItem(SAVE_KEY);location.reload()};
document.addEventListener('keydown',event=>{if(event.key.toLowerCase()==='r'&&!event.repeat){
  if(mode==='build'){rotation=(rotation+1)%4;render()}
  else if(mode==='move'&&selectedMove){const err=rotateAt(game[group],selectedMove.x,selectedMove.z);if(!err)commit('Rotated the selected building.')}
}if(event.key==='Escape'){setMode('explore')}});
// Crop progress is animated by the 3D renderer using timestamps, with no scene rebuild timer.
render();
try{window.Telegram?.WebApp?.ready();window.Telegram?.WebApp?.expand()}catch{}