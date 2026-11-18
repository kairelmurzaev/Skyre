import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,loadGame,SAVE_KEY} from '../core.js';
import {executeAction} from '../server/actions.js';
import {openStore} from '../server/db.js';
import {DESK_BUILDS,DESK_SNAP,DESK_FOOTPRINT,MAX_DESK_PROPS,ensureDesk,deskProp,deskPlacementError,
 buildFreeDesk,moveFreeDesk,rotateFreeDesk,storeFreeDesk,relocateDeskSite,buildOnDesk,deskAt} from '../desk.js';

test('free placement is half-tile snapped and respects physical desk and island boundaries',()=>{
 const w=newGame().a;
 assert.equal(DESK_SNAP,.5);
 assert.equal(deskPlacementError(w,'lantern',-9.5,7,0),null);
 assert.equal(deskPlacementError(w,'camp',9.5,7,3),null);
 assert.equal(deskPlacementError(w,'workbench',-9.5,-7,0),null);
 assert.match(deskPlacementError(w,'camp',0,0,0),/island/i);
 assert.match(deskPlacementError(w,'camp',11,7,0),/edge/i);
 assert.match(deskPlacementError(w,'camp',-8,-5,0),/giant desk/i);
 assert.match(deskPlacementError(w,'camp',9.4,7,0),/snapped/i);
 assert.match(deskPlacementError(w,'bridge',9.5,7,0),/movable/i);
 assert.match(deskPlacementError(w,'camp',9.5,7,4),/valid rotation/i);
 w.landLevel=2;
 assert.match(deskPlacementError(w,'camp',-7.5,1.5,0),/island/i);
 assert.equal(deskPlacementError(w,'camp',9.5,7,0),null);
});
test('building furniture costs materials and never overlaps existing props',()=>{
 const w=newGame().a;
 const prior={...w.resources};
 assert.equal(buildFreeDesk(w,'lantern',-9.5,7,1),null);
 assert.equal(w.desk.props.length,1);
 assert.deepEqual(w.desk.props[0],{id:'desk-prop-1',type:'lantern',x:-9.5,z:7,rotation:1});
 assert.equal(w.resources.wood,prior.wood-DESK_BUILDS.lantern.cost.wood);
 assert.equal(w.resources.stone,prior.stone-DESK_BUILDS.lantern.cost.stone);
 assert.match(buildFreeDesk(w,'camp',-9.5,7,0),/other desk/i);
 assert.equal(w.desk.props.length,1);
 assert.equal(w.resources.wood,prior.wood-4);
 assert.equal(buildFreeDesk(w,'camp',9.5,7,2),null);
 assert.equal(w.desk.props.length,2);
 assert.notEqual(w.desk.props[0].id,w.desk.props[1].id);
});
test('move, rotate, and store are reversible and protect nearby furniture',()=>{
 const w=newGame().a;
 assert.equal(buildFreeDesk(w,'lantern',-9.5,7,0),null);
 assert.equal(buildFreeDesk(w,'camp',9.5,7,0),null);
 const id=w.desk.props[0].id,oldWood=w.resources.wood;
 assert.match(moveFreeDesk(w,id,9.5,7,0),/other desk/i);
 assert.equal(deskProp(w,id).x,-9.5);
 assert.equal(moveFreeDesk(w,id,-9.5,-7,3),null);
 assert.equal(deskProp(w,id).rotation,3);
 assert.equal(rotateFreeDesk(w,id),null);
 assert.equal(deskProp(w,id).rotation,0);
 assert.equal(storeFreeDesk(w,id),null);
 assert.equal(deskProp(w,id),null);
 assert.equal(w.resources.wood,oldWood+2);
 assert.match(storeFreeDesk(w,'nonexistent'),/not be found/i);
});
test('legacy desk props can be moved without disappearing or paying twice',()=>{
 const w=newGame().a;
 assert.equal(buildOnDesk(w,'mug-nook','stall'),null);
 const wood=w.resources.wood;
 assert.equal(relocateDeskSite(w,'mug-nook',-7.5,1.5,2),null);
 assert.equal(deskAt(w,'plant-nook'),null);
 assert.equal(w.desk.props.length,1);
 assert.equal(w.desk.props[0].rotation,2);
 assert.equal(w.resources.wood,wood);
 assert.match(relocateDeskSite(w,'crossing',9.5,7,0),/Only smaller/i);
 assert.match(relocateDeskSite(w,'invalid',9.5,7,0),/Only smaller/i);
});
test('occupied free construction blocks legacy sites to avoid overlapping geometry',()=>{
 const w=newGame().a;
 assert.equal(buildFreeDesk(w,'lantern',-7.5,6.5,0),null);
 assert.match(buildOnDesk(w,'plant-nook','camp'),/blocking/i);
 assert.equal(deskAt(w,'plant-nook'),null);
});
test('save migration preserves existing fixed sites, expedition and new placement IDs',()=>{
 const old=newGame();
 assert.equal(buildOnDesk(old.a,'crossing','bridge'),null);
 old.a.desk.props=[{id:'desk-prop-8',type:'camp',x:9.5,z:7,rotation:2}];
 delete old.a.desk.nextPropId;
 const storage={getItem:k=>k===SAVE_KEY?JSON.stringify(old):null};
 const loaded=loadGame(storage);
 assert.equal(deskAt(loaded.a,'crossing').type,'bridge');
 assert.equal(ensureDesk(loaded.a).props.length,1);
 assert.equal(ensureDesk(loaded.a).nextPropId,9);
 assert.equal(buildFreeDesk(loaded.a,'lantern',-9.5,7,0),null);
 assert.equal(loaded.a.desk.props[1].id,'desk-prop-9');
 assert.ok(Array.isArray(loaded.b.desk.props));
});
test('server rejects malformed placement, validates resource costs and stores valid commands',()=>{
 const g=newGame(),w=g.a;
 assert.match(executeAction(g,{type:'deskPropBuild',building:'camp',x:0,z:0,rotation:0},false).error,/island/i);
 assert.match(executeAction(g,{type:'deskPropBuild',building:'camp',x:9.5,z:7,rotation:12},false).error,/rotation/i);
 assert.match(executeAction(g,{type:'deskPropBuild',building:'camp',x:9.7,z:7,rotation:0},false).error,/snapped/i);
 assert.equal(executeAction(g,{type:'deskPropBuild',building:'camp',x:9.5,z:7,rotation:0},false).error,undefined);
 const id=w.desk.props[0].id;
 assert.equal(executeAction(g,{type:'deskPropMove',id,x:10,z:7,rotation:1},false).error,undefined);
 assert.equal(executeAction(g,{type:'deskPropRotate',id},false).error,undefined);
 assert.equal(executeAction(g,{type:'deskPropStore',id},false).error,undefined);
 assert.equal(w.desk.props.length,0);
 w.resources.wood=0;
 assert.match(executeAction(g,{type:'deskPropBuild',building:'camp',x:9.5,z:7,rotation:0},false).error,/Gather/i);
});
test('SQLite persists free desk placement and later moves across independent requests',()=>{
 const store=openStore(':memory:');
 try{
  const worldId='desk-placement-qa';
  const a=store.dispatch(worldId,'req-prop-build',{type:'deskPropBuild',building:'lantern',x:-9.5,z:7,rotation:1},1760000000000);
  assert.equal(a.error,undefined);
  assert.equal(a.game.a.desk.props.length,1);
  const id=a.game.a.desk.props[0].id;
  const b=store.dispatch(worldId,'req-prop-move',{type:'deskPropMove',id,x:-9.5,z:-7,rotation:2},1760000001000);
  assert.equal(b.error,undefined);
  const current=store.state(worldId,1760000002000);
  assert.deepEqual(current.game.a.desk.props[0],{id,type:'lantern',x:-9.5,z:-7,rotation:2});
 }finally{store.close();}
});

import {readFile} from 'node:fs/promises';

test('free placement UI exposes touch preview and contextual actions without hiding the world',async()=>{
 const read=path=>readFile(new URL(path,import.meta.url),'utf8');
 const [app,scene,art,html,shell,style,sw]=await Promise.all([
   '../app.js','../scene.js','../desk-art.js','../index.html',
   '../game-shell.js','../game-shell.css','../sw.js'].map(read));
 for(const id of ['skyre-desk-edit','skyre-desk-rotate','skyre-desk-cancel',
   'skyre-desk-confirm','desk-props','desk-selected'])
   assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(app,/function beginDeskEdit/);
 assert.match(app,/function confirmDeskEdit/);
 assert.match(app,/run\(\{type:'deskPropBuild'/);
 assert.match(app,/run\(\{type:'deskPropMove'/);
 assert.match(app,/run\(\{type:'deskPropRotate'/);
 assert.match(app,/run\(\{type:'deskPropStore'/);
 assert.match(scene,/heldPointers.size>1/);
 assert.match(scene,/controls.enableRotate=!editDesk/);
 assert.match(scene,/controls.enablePan=true/);
 assert.match(scene,/showDeskGhost/);
 assert.match(art,/placementPreview/);
 assert.match(art,/kind:'desk-prop'/);
 assert.match(shell,/skyre:cancel-desk-edit/);
 assert.match(style,/skyre-desk-placing/);
 assert.match(sw,/skyre-mobile-v1\.[567]\.0-(?:editor|camera|mobile-power)/);
});

