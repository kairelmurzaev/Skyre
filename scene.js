import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {received, growth, findAt, BUILD, canAfford, orchardReady} from './core.js';
import {LAND_STAGES,LANDSCAPE,MAX_COORD,islandStage,withinWorld,walkableTile,buildableTile,decorAt} from './terrain.js';
import {buildingStock} from './logistics.js';
import {planWorkerRoute} from './routing.js';
import {createRiggedCharacterFactory} from './rigged-characters.js';
import {createWorldArt} from './world-art.js';
import {createDeskArt} from './desk-art.js';

// Skyre World Remaster: authored stylized buildings, painterly textures and instanced foliage.
// Gameplay rules are unchanged; art objects are local scene decorations.
export function createScene(mount, callbacks){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#c9d9d9');scene.fog=new THREE.FogExp2('#c9d9d9',.013);
  const camera=new THREE.PerspectiveCamera(43,1,.1,100);camera.position.set(9.8,9.2,14.8);
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.34;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  mount.append(renderer.domElement);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
  controls.target.set(0,.15,0);controls.minDistance=3;controls.maxDistance=36;controls.maxPolarAngle=1.49;
  // Two-finger touch pan lets players explore the whole physical desk.
  controls.enablePan=true;controls.minDistance=1.35;
  const hemi=new THREE.HemisphereLight('#fff1d6','#70887e',2.05);scene.add(hemi);
  const sun=new THREE.DirectionalLight('#fff0c8',2.55);sun.position.set(-6,12,8);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-11;sun.shadow.camera.right=11;sun.shadow.camera.top=11;sun.shadow.camera.bottom=-11;scene.add(sun);
  const material=(color,rough=.8,metal=0)=>new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});
  const box=(parent,size,pos,color,rough=.8)=>mesh(parent,new THREE.BoxGeometry(...size),material(color,rough),pos);
  function mesh(parent,geom,mat,pos=[0,0,0],rot=[0,0,0]){
    const m=new THREE.Mesh(geom,mat);m.position.set(...pos);m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  const cyl=(p,r1,r2,h,pos,color,n=12)=>mesh(p,new THREE.CylinderGeometry(r1,r2,h,n),material(color),pos);
  const cone=(p,r,h,pos,color,n=8)=>mesh(p,new THREE.ConeGeometry(r,h,n),material(color),pos);
  const ball=(p,r,pos,color)=>mesh(p,new THREE.SphereGeometry(r,12,9),material(color),pos);
  const art=createWorldArt();
  const table=box(scene,[23,.5,18],[0,-1.28,0],'#57444b');
  table.material=art.M.wood;table.receiveShadow=true;
  // Gently beveled desk framing and visible inset joinery ground the diorama.
  for(const z of [-8.82,8.82])art.box(scene,[22.95,.12,.18],[0,-1.02,z],art.M.darkWood);
  for(const x of [-11.38,11.38])art.box(scene,[.18,.12,17.6],[x,-1.02,0],art.M.darkWood);
  const earthBase=cyl(scene,5.58,5.78,.48,[0,-.86,0],'#b9a077',64);
  const oceanBase=cyl(scene,5.36,5.49,.72,[0,-.34,0],'#4b8190',64);
  const meadowBase=cyl(scene,5.21,5.29,.22,[0,.06,0],'#86ac90',64);
  // World-space ground, shoreline foam, sand, and painterly water overlay.
  earthBase.material=art.M.stone;
  oceanBase.material=art.M.water;
  meadowBase.material=art.M.grass;
  const coast=art.shoreline(scene,meadowBase,oceanBase);
  const meadowDetail=art.meadowDetails(scene);
  const rim=mesh(scene,new THREE.TorusGeometry(5.55,.105,10,70),material('#bda57e',.3,.66),[0,-.67,0],[Math.PI/2,0,0]);rim.castShadow=false;
  // Glass is decoration only and does not intercept clicks.
  const glass=mesh(scene,new THREE.SphereGeometry(6.25,44,30),new THREE.MeshPhysicalMaterial({color:'#ccefff',metalness:0,roughness:.06,transparent:true,opacity:.035,depthWrite:false,side:THREE.FrontSide,clearcoat:1}),[0,1.3,0]);
  glass.raycast=()=>{};glass.castShadow=false;glass.receiveShadow=false;
  const glassLine=mesh(scene,new THREE.TorusGeometry(6.0,.018,7,64),new THREE.MeshBasicMaterial({color:'#bce7ff',transparent:true,opacity:.25,depthWrite:false}),[0,1.3,0],[.12,0,.25]);glassLine.raycast=()=>{};glassLine.castShadow=false;
  const grid=new THREE.Group();scene.add(grid);
  const tiles=[];
  for(let x=-MAX_COORD;x<=MAX_COORD;x++)for(let z=-MAX_COORD;z<=MAX_COORD;z++){
    if(x*x+z*z>LAND_STAGES.at(-1).radiusSq)continue;
    const t=mesh(grid,new THREE.PlaneGeometry(.94,.94),new THREE.MeshBasicMaterial({color:'#e7d49d',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}),[x,.185,z],[-Math.PI/2,0,0]);
    t.castShadow=false;t.receiveShadow=false;t.userData.hit={kind:'tile',x,z};tiles.push(t);
  }
  const hover=mesh(scene,new THREE.PlaneGeometry(.94,.94),new THREE.MeshBasicMaterial({color:'#b4e7b0',transparent:true,opacity:.25,depthWrite:false,side:THREE.DoubleSide}),[0,.19,0],[-Math.PI/2,0,0]);hover.visible=false;hover.raycast=()=>{};
  const models=new THREE.Group();scene.add(models);
  const landscapeModels=new THREE.Group();scene.add(landscapeModels);
  const residents=new THREE.Group();scene.add(residents);
  const characters=createRiggedCharacterFactory({previewMaster:new URLSearchParams(location.search).get('hero')==='1'}),residentCache=new Map();
  let sceneDisposed=false;
  characters.ready.then(loaded=>{
    if(sceneDisposed||!loaded||!currentGame)return;
    // Use the latest approved v2 model for every resident (with an independent
    // skeleton and animation mixer). Worker jobs, positions and saves are unchanged.
    for(const rig of residentCache.values())characters.release(rig);
    residentCache.clear();
    rebuildVillagers(currentGame[currentId],currentGame,currentId);
  });
  const crops=[],turbines=[],chimneys=[],orchards=[],walkers=[];
  const routeOverlay=new THREE.Group();scene.add(routeOverlay);
  let highlightedWorker=null;
  let currentGame=null,currentId='a',currentOptions={mode:'explore',buildType:'plot',rotation:0,selectedMove:null},hoverHit=null;
  const preview=new THREE.Group();scene.add(preview);
  const previewMaterial=new THREE.MeshBasicMaterial({color:'#b4e7b0',transparent:true,opacity:.43,depthWrite:false});
  const previewBase=box(preview,[.9,.08,.9],[0,.04,0],'#b7dca7');
  previewBase.material=previewMaterial;previewBase.castShadow=false;
  const previewBody=mesh(preview,new THREE.BoxGeometry(.61,.55,.61),previewMaterial,[0,.34,0]);
  const previewRoof=mesh(preview,new THREE.ConeGeometry(.52,.35,4),previewMaterial,[0,.8,0]);previewRoof.rotation.y=Math.PI/4;
  preview.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;o.raycast=()=>{}}});preview.visible=false;
  const selection=mesh(scene,new THREE.TorusGeometry(.62,.038,7,32),new THREE.MeshBasicMaterial({color:'#f4d598',depthTest:false}),[0,.28,0],[Math.PI/2,0,0]);selection.raycast=()=>{};selection.castShadow=false;selection.visible=false;
  function updatePreview(){
    const mode=currentOptions.mode;
    selection.visible=mode==='move'&&!!currentOptions.selectedMove;
    if(selection.visible){selection.position.set(currentOptions.selectedMove.x,.24,currentOptions.selectedMove.z)}
    const show=hoverHit?.kind==='tile'&&(mode==='build'||mode==='landscape'||(mode==='move'&&currentOptions.selectedMove));
    preview.visible=!!show;
    if(!show||!currentGame)return;
    const {x,z}=hoverHit,world=currentGame[currentId];
    const existing=decorAt(world,x,z);
    const good=mode==='landscape' ? (currentOptions.landscapeKind==='clear' ? !!existing : !existing&&!findAt(world,x,z)&&canAfford(world,LANDSCAPE[currentOptions.landscapeKind]?.cost||{})) : buildableTile(world,x,z)&&!findAt(world,x,z)&&(mode==='move'||canAfford(world,BUILD[currentOptions.buildType]?.cost||{}));
    preview.position.set(x,.20,z);
    preview.rotation.y=mode==='build'?(currentOptions.rotation||0)*Math.PI/2:0;
    previewMaterial.color.set(good?'#b8e8ba':'#ee9e93');
    const isPath=(mode==='build'&&currentOptions.buildType==='path')||mode==='landscape';
    const isWell=mode==='build'&&currentOptions.buildType==='well';
    previewBody.visible=!isPath;
    previewRoof.visible=!isPath&&!isWell;
    previewBody.scale.y=isWell ? .62 : 1;
  }

  const grove=new THREE.Group();scene.add(grove);
  function tree(p,x,z,s=1,pink=false){
    return art.makeTree(p,x,z,s,pink);
  }
  [[-4.85,-1.25,.75],[-4.8,1.3,.8],[4.85,1.2,.75],[4.75,-1.3,.68],[.45,4.78,.76],[-2.4,-4.45,.66]].forEach(([x,z,s],i)=>{
    const g=tree(grove,x,z,s,i%3===0);
    g.traverse(o=>{if(o.isMesh)o.userData.hit={kind:'gather',type:'wood'}});
  });
  [[3.95,2.75],[-4.0,-2.6],[-1.4,4.7]].forEach(([x,z])=>{
    const g=new THREE.Group();g.position.set(x,.13,z);grove.add(g);
    for(let i=0;i<3;i++){
      const rock=mesh(g,new THREE.DodecahedronGeometry(.30+(i%2)*.14,0),material(i%2?'#91a1a6':'#a7b4b3'),[(i-1)*.3,.17,i*.13]);
      rock.userData.hit={kind:'gather',type:'stone'};
    }
  });
  // Desk controls are meaningful: lamp and mirror affect the OTHER world.
  const lamp=new THREE.Group();lamp.position.set(-9.45,-.63,-.35);scene.add(lamp);
  cyl(lamp,.50,.57,.15,[0,0,0],'#ae906b',32);
  cyl(lamp,.07,.07,1.85,[0,.95,0],'#d0ae7c');
  const arm=cyl(lamp,.07,.07,1.1,[.28,2.01,0],'#d0ae7c');arm.rotation.z=-.68;
  const shade=cone(lamp,.58,.75,[.73,2.32,0],'#c4a27b',24);shade.rotation.z=Math.PI;
  const lampBulb=ball(lamp,.17,[.74,1.93,0],'#fff2bd');
  lamp.traverse(o=>{if(o.isMesh)o.userData.hit={kind:'lamp'}});
  const lampLight=new THREE.PointLight('#ffc987',0,8);lampLight.position.set(-8.72,1.26,-.35);scene.add(lampLight);
  const mirror=new THREE.Group();mirror.position.set(9.4,-.55,-.4);scene.add(mirror);
  cyl(mirror,.45,.47,.12,[0,0,0],'#c2a77b',28);cyl(mirror,.07,.07,1.5,[0,.72,0],'#bba278');
  const mirrorFace=new THREE.Group();mirrorFace.position.y=1.6;mirror.add(mirrorFace);
  cyl(mirrorFace,.56,.56,.10,[0,0,0],'#c8ad80',36).rotation.x=Math.PI/2;
  cyl(mirrorFace,.50,.50,.112,[0,0,.03],'#a6dce6',36).rotation.x=Math.PI/2;
  mirror.traverse(o=>{if(o.isMesh)o.userData.hit={kind:'mirror'}});
  const deskArt=createDeskArt(scene);
  function mark(g,hit){g.traverse(o=>{if(o.isMesh)o.userData.hit=hit});}
  function smoke(g,x,y,z){
    const bubbles=[];
    for(let i=0;i<3;i++){
      const m=mesh(g,new THREE.SphereGeometry(.08+i*.015,8,6),new THREE.MeshBasicMaterial({color:'#f9e9cf',transparent:true,opacity:.32,depthWrite:false}),[x,y+i*.2,z]);
      m.raycast=()=>{};m.castShadow=false;m.receiveShadow=false;bubbles.push(m);
    }
    chimneys.push({bubbles,x,y,z,phase:Math.random()*5});
  }
  function drawBuilding(b,game,id,now){
    const g=new THREE.Group();g.position.set(b.x,.18,b.z);g.rotation.y=(b.rotation||0)*Math.PI/2;models.add(g);
    if(b.type!=='path')art.box(g,[.96,.060,.96],[0,.038,0],b.type==='plot'?art.M.wood:art.M.grass);
    if(b.type==='plot'){
      art.plot(g);
      if(b.crop){
        for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){
          const plant=new THREE.Group();plant.position.set(i*.21,.18,j*.24);g.add(plant);
          cyl(plant,.024,.032,.42,[0,.21,0],b.crop.kind==='moonflower'?'#79b6a4':'#71ad79',6);
          if(b.crop.kind==='wheat'){
            cone(plant,.072,.25,[0,.49,0],'#efce80',6);
            for(const side of [-1,1]){
              const leaf=cone(plant,.055,.25,[side*.12,.25,0],'#a4bc69',5);
              leaf.rotation.z=side*.55;
            }
          }else if(b.crop.kind==='carrot'){
            cone(plant,.12,.18,[0,.48,0],'#eaa06e',6);
            ball(plant,.07,[0,.56,0],'#93ba78');
          }else{
            ball(plant,.11,[0,.53,0],'#dfbde9');
            for(let k=0;k<4;k++){
              const petal=ball(plant,.065,[Math.cos(k*Math.PI/2)*.12,.53,Math.sin(k*Math.PI/2)*.12],'#c19add');
              petal.castShadow=false;
            }
          }
          crops.push({plant,b,worldId:id,offset:i*1.7+j*.9});
        }
      }
    } else if(b.type==='cottage'){
      art.cottage(g,smoke,b.level||1);
    } else if(b.type==='windmill'){
      art.windmill(g,turbines);
    } else if(b.type==='bakery'){
      art.bakery(g,smoke);
    } else if(b.type==='well'){
      art.well(g);
    } else if(b.type==='path'){
      art.path(g,Math.round(b.x*97+b.z*31));
    } else if(b.type==='warehouse'){
      art.warehouse(g);
    } else if(b.type==='orchard'){
      const fruits=[];art.orchard(g,fruits);orchards.push({b,fruits});
    }
    if((b.level||1)>=2){
      // Golden detailing makes upgraded buildings instantly recognizable.
      const crown=mesh(g,new THREE.TorusGeometry(.33,.035,6,30),material('#f4d48a',.25,.65),[0,b.type==='cottage'?1.23:b.type==='windmill'?1.58:1.3,0],[Math.PI/2,0,0]);crown.raycast=()=>{};
      for(const sx of [-.34,.34])ball(g,.075,[sx,.32,.37],'#ffdf9a');
    }
    // Small parcels are a readable signal that a workplace has undelivered stock.
    const stored=['wheat','flour','food'].reduce((sum,k)=>sum+buildingStock(b,k),0);
    const crates=Math.min(3,Math.ceil(stored/4));
    for(let i=0;i<crates;i++){
      const crate=box(g,[.18,.17,.18],[-.35+i*.24,.22,-.40],i%2?'#dabf8c':'#b78f68');
      box(crate,[.16,.02,.02],[0,.1,0],'#efe0b5');
    }
    mark(g,{kind:'tile',x:b.x,z:b.z});
  }
  function renderLandscape(world){
    while(landscapeModels.children.length){const object=landscapeModels.children[0];landscapeModels.remove(object);object.traverse(o=>{if(o.isMesh){if(!o.geometry.userData.sharedArt)o.geometry.dispose();if(!o.material.userData.sharedArt)o.material.dispose()}})}
    for(const [key,kind] of Object.entries(world.terrain||{})){
      const [x,z]=key.split(',').map(Number);
      if(!withinWorld(world,x,z))continue;
      const g=new THREE.Group();g.position.set(x,.19,z);landscapeModels.add(g);
      if(kind==='pond')art.pond(g);
      else if(kind==='flowers')art.garden(g);
      mark(g,{kind:'tile',x,z});
    }
  }
  function rebuildVillagers(world,game,id){
    // Reuse character rigs across every UI refresh instead of recreating hundreds
    // of mesh objects each time a crop grows or inventory updates.
    residents.clear();
    walkers.length=0;
    const living=new Set([...game.a.workers||[],...game.b.workers||[]].map(w=>w.id));
    for(const [key,rig] of residentCache)if(!living.has(key)){
      characters.release(rig);residentCache.delete(key);
    }
    const roster=(world.workers||[]).slice(0,18);
    for(let i=0;i<roster.length;i++){
      const worker=roster[i];
      const home=world.buildings.find(b=>b.id===worker.homeId&&b.type==='cottage');
      if(!home)continue;
      const plan=planWorkerRoute(game,id,worker,Date.now());
      const saved=worker.trip?.points;
      const validSaved=Array.isArray(saved)&&saved.length>1&&saved.every((p,j)=>walkableTile(world,p.x,p.z)&&(j===0||j===saved.length-1||!findAt(world,p.x,p.z)||['path','cottage','warehouse'].includes(findAt(world,p.x,p.z).type)||[worker.trip?.delivery?.sourceId,worker.trip?.delivery?.destId].includes(findAt(world,p.x,p.z).id)));
      const path=validSaved?saved:(plan?.route.points||[{x:home.x,z:home.z}]);
      let rig=residentCache.get(worker.id);
      if(!rig||rig.job!==worker.job){
        if(rig)characters.release(rig);
        rig=characters.create(worker);residentCache.set(worker.id,rig);
      }
      rig.root.position.set(home.x,.19,home.z);residents.add(rig.root);
      walkers.push({v:rig.root,rig,worker,path,home,phase:i*1.8+Math.PI*.2,job:worker.job});
    }
    drawHighlightedRoute();
  }
  function drawHighlightedRoute(){
    while(routeOverlay.children.length){const old=routeOverlay.children[0];routeOverlay.remove(old);old.geometry?.dispose();old.material?.dispose();}
    const walker=walkers.find(w=>w.worker.id===highlightedWorker);
    if(!walker||walker.path.length<2)return;
    const points=walker.path.map(p=>new THREE.Vector3(p.x,.28,p.z));
    const geometry=new THREE.BufferGeometry().setFromPoints(points);
    const material=new THREE.LineDashedMaterial({color:'#ffe2a5',dashSize:.19,gapSize:.12,opacity:.96,transparent:true,depthTest:false});
    const line=new THREE.Line(geometry,material);line.computeLineDistances();line.renderOrder=4;routeOverlay.add(line);
    for(const point of [points[0],points[points.length-1]]){
      const ring=new THREE.Mesh(new THREE.RingGeometry(.25,.32,24),new THREE.MeshBasicMaterial({color:'#ffe2a5',side:THREE.DoubleSide,transparent:true,opacity:.8,depthTest:false}));
      ring.rotation.x=-Math.PI/2;ring.position.set(point.x,.28,point.z);ring.renderOrder=4;routeOverlay.add(ring);
    }
  }
  /** Visual position follows the same grid route used to calculate job travel time. */
  function followRoute(path,progress){
    if(path.length<2)return {x:path[0]?.x??0,z:path[0]?.z??0};
    const step=Math.min(path.length-1,Math.max(0,progress)*(path.length-1));
    const i=Math.min(path.length-2,Math.floor(step)),f=step-i;
    return {x:path[i].x+(path[i+1].x-path[i].x)*f,z:path[i].z+(path[i+1].z-path[i].z)*f};
  }

  const raycaster=new THREE.Raycaster();const mouse=new THREE.Vector2();let start=null;
  function hit(e){const b=renderer.domElement.getBoundingClientRect();mouse.x=(e.clientX-b.left)/b.width*2-1;mouse.y=-(e.clientY-b.top)/b.height*2+1;raycaster.setFromCamera(mouse,camera);
    for(const match of raycaster.intersectObjects([deskArt.group,models,landscapeModels,grove,lamp,mirror,grid],true)){
      if(match.object.userData.hit)return match.object.userData.hit;
    }
    return null;
  }
  renderer.domElement.addEventListener('pointerdown',e=>start={x:e.clientX,y:e.clientY});
  renderer.domElement.addEventListener('pointerup',e=>{
    if(!start)return;const d=Math.hypot(e.clientX-start.x,e.clientY-start.y);start=null;if(d>8)return;
    const h=hit(e);if(h)callbacks.onHit(h);
  });
  renderer.domElement.addEventListener('pointermove',e=>{
    if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>8){hover.visible=false;preview.visible=false;return;}
    hoverHit=hit(e);if(hoverHit?.kind==='tile'){hover.visible=true;hover.position.set(hoverHit.x,.22,hoverHit.z);}else hover.visible=false;
    updatePreview();
  });
  renderer.domElement.addEventListener('pointerleave',()=>{hover.visible=false;preview.visible=false;hoverHit=null;start=null});
  function refresh(game,id,options={}){
    currentGame=game;currentId=id;currentOptions={mode:'explore',buildType:'plot',rotation:0,selectedMove:null,...options};
    crops.length=0;turbines.length=0;chimneys.length=0;orchards.length=0;
    while(models.children.length){const g=models.children[0];models.remove(g);g.traverse(o=>{if(o.isMesh){if(!o.geometry.userData.sharedArt)o.geometry.dispose();if(!o.material.userData.sharedArt)o.material.dispose()}})}
    const world=game[id];const step=islandStage(world),scale=[1,1.18,1.42][step];
    for(const body of [earthBase,oceanBase,meadowBase])body.scale.set(scale,1,scale);
    rim.scale.setScalar(scale);
    coast.scale(step);meadowDetail.scale.set(scale,1,scale);
    glass.scale.setScalar([1,1.16,1.35][step]);glassLine.scale.setScalar([1,1.16,1.35][step]);
    for(const b of world.buildings)drawBuilding(b,game,id,Date.now());
    renderLandscape(world);
    deskArt.refresh(world,currentOptions.mode==='desk-build');
    rebuildVillagers(game[id],game,id);
    const incoming=received(game,id);hemi.intensity=incoming.sun?2.3:1.95;sun.intensity=incoming.sun?3.1:2.05;
    sun.color.set(incoming.sun?'#ffe5ae':'#dbe4e7');
    lampLight.intensity=game[id].lamp?6:0;lampBulb.material.emissive.set(game[id].lamp?'#ffbd65':'#000000');
    mirrorFace.rotation.y=(game[id].mirror-1)*.40;
    tiles.forEach(tile=>{
      const {x,z}=tile.userData.hit,occupied=!!findAt(game[id],x,z);
      tile.visible=withinWorld(world,x,z);
      const mode=currentOptions.mode;
      if(mode==='build'){
        const affordable=canAfford(game[id],BUILD[currentOptions.buildType]?.cost||{});
        tile.material.color.set(!occupied&&buildableTile(world,x,z)&&affordable?'#a8e0b0':'#e9a19b');tile.material.opacity=.105;
      }else if(mode==='move'&&currentOptions.selectedMove){tile.material.color.set(occupied||!buildableTile(world,x,z)?'#e4a69c':'#a8e0b0');tile.material.opacity=.105;}
      else if(mode==='landscape'){const existing=decorAt(world,x,z),kind=currentOptions.landscapeKind;
        const good=kind==='clear'?!!existing:!occupied&&!existing&&canAfford(world,LANDSCAPE[kind]?.cost||{});
        tile.material.color.set(good?'#c4e4b3':'#e9a19b');tile.material.opacity=.12;
      }else if(mode==='upgrade'){const b=findAt(world,x,z);tile.material.color.set(b&&['cottage','warehouse','windmill'].includes(b.type)&&(b.level||1)<2?'#ffe1a3':'#e9a19b');tile.material.opacity=.075;}
      else if(mode==='demolish'){tile.material.color.set('#f3cba4');tile.material.opacity=.05;}
      else tile.material.opacity=0;
    });
    updatePreview();
  }
  function setCamera(close){camera.position.set(...(close?[6,7.5,10]:[9.8,9.2,14.8]));controls.target.set(0,.15,0);controls.update()}
  function focusDesk(which='all'){
    const target=which==='all'?{x:0,z:0}:deskArt.objects[which]||{x:6.0,z:-3.3};
    controls.target.set(target.x,-.1,target.z);
    camera.position.set(target.x+(which==='all'?12:5.0),which==='all'?13:7.3,target.z+(which==='all'?18:8.8));
    controls.update();
  }
  function focusVillager(workerId){
    const selected=(workerId?walkers.find(w=>w.worker.id===workerId):null)||walkers[0];
    if(!selected)return false;
    const pos=selected.v.position;
    controls.target.set(pos.x,pos.y+.61,pos.z);
    camera.position.set(pos.x+1.15,pos.y+1.65,pos.z+1.65);
    controls.update();
    return true;
  }
  function resize(){const w=mount.clientWidth,h=mount.clientHeight;if(w<1||h<1)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
  const ro=new ResizeObserver(resize);ro.observe(mount);resize();
  const clock=new THREE.Clock();
  let frameId=0;function tick(){
    frameId=requestAnimationFrame(tick);
    const t=clock.getElapsedTime();
    const now=Date.now();
    coast.animate(t);
    deskArt.animate(t);
    for(const p of crops){
      const stage=growth(currentGame,p.worldId,p.b,now);
      p.plant.scale.set(.35+stage*.65,Math.max(.12,stage),.35+stage*.65);
      p.plant.rotation.z=Math.sin(t*1.6+p.offset)*.035*(.25+stage);
    }
    for(const hub of turbines)hub.rotation.z=t*.7;
    for(const c of chimneys){
      c.bubbles.forEach((b,i)=>{const progress=(t*.30+c.phase+i/3)%1;
        b.position.set(c.x+Math.sin(t*.65+i)*progress*.15,c.y+progress*.8,c.z+progress*.06);
        b.scale.setScalar(.65+progress*1.8);
        b.material.opacity=(1-progress)*.22;
      });
    }
    for(const o of orchards){
      const ready=orchardReady(o.b,now,received(currentGame,currentId).breeze);
      o.fruits.forEach((f,i)=>{f.visible=ready;f.scale.setScalar(ready?1+.08*Math.sin(t*2.5+i):1)});
    }
    for(const walker of walkers){
      const {worker,path}=walker;
      const now=Date.now();
      let returning=false,carrying=false,walking=false,working=false;
      if(worker.job==='idle'||path.length<2){
        working=worker.job!=='idle';
        walker.v.position.set(walker.home.x+Math.sin(t*.32+walker.phase)*.25,.19,walker.home.z+Math.cos(t*.4+walker.phase)*.25);
        carrying=false;
      }else{
        const trip=worker.trip;
        // Old save files lack trips: keep residents moving gently until their next scheduled job.
        const from=Number.isFinite(trip?.startedAt)?trip.startedAt:worker.nextAt-16000;
        const until=Number.isFinite(trip?.endsAt)?trip.endsAt:worker.nextAt;
        const phase=Math.max(0,Math.min(1,(now-from)/Math.max(1000,until-from)));
        returning=phase>=.5;
        const u=worker.job==='hauler'?phase:(returning?(1-phase)*2:phase*2);
        walking=true;
        const pos=followRoute(path,u);
        const upcoming=followRoute(path,Math.max(0,Math.min(1,u+(returning?-.015:.015))));
        walker.v.position.set(pos.x,.19+Math.abs(Math.sin(t*5+walker.phase))*.035,pos.z);
        const deltaX=upcoming.x-pos.x,deltaZ=upcoming.z-pos.z;
        if(Math.hypot(deltaX,deltaZ)>.0001)walker.v.rotation.y=Math.atan2(deltaX,deltaZ);
        carrying=worker.job==='hauler'?(phase>.20&&phase<.8):returning;
        if(worker.job!=='hauler'&&phase>.46&&phase<.55){walking=false;working=true;carrying=false;}
      }
      // A chosen resident briefly leaves the island and walks to the book stack.
      // The actual reward is awarded exactly once by desk.js, not by animation.
      const outing=currentGame?.[currentId]?.desk?.expedition;
      if(outing?.workerId===worker.id){
        const u=Math.max(0,Math.min(1,(now-outing.startedAt)/(outing.endsAt-outing.startedAt)));
        const outbound=u<.43?u/.43:u<.58?1:(1-u)/.42;
        const v=Math.max(0,Math.min(1,outbound));
        const route=[
          new THREE.Vector3(walker.home.x,.19,walker.home.z),
          new THREE.Vector3(3.9,.19,-1.9),
          new THREE.Vector3(4.5,.24,-2.1),
          new THREE.Vector3(6.45,-.94,-3.75),
          new THREE.Vector3(8.1,-.91,-4.65)
        ];
        const measure=(amount)=>{
          const phase=amount*(route.length-1),i=Math.min(route.length-2,Math.floor(phase));
          return route[i].clone().lerp(route[i+1],phase-i);
        };
        const pos=measure(v),next=measure(Math.min(1,v+.018));
        walker.v.position.copy(pos);
        const dx=next.x-pos.x,dz=next.z-pos.z;
        if(Math.hypot(dx,dz)>.001)walker.v.rotation.y=Math.atan2(dx,dz)+(u>.58?Math.PI:0);
        walking=u<.43||u>.58;working=!walking;carrying=false;
      }
      characters.animate(walker.rig,t,walker.phase,{walking,carrying,working});
    }
    controls.update();renderer.render(scene,camera);
  }tick();
  return {refresh,setCamera,focusDesk,focusVillager,highlightRoute(workerId){highlightedWorker=workerId;drawHighlightedRoute();},dispose(){sceneDisposed=true;cancelAnimationFrame(frameId);ro.disconnect();controls.dispose();
    for(const rig of residentCache.values())characters.release(rig);
    residentCache.clear();characters.dispose();deskArt.dispose();renderer.dispose();renderer.domElement.remove()}};
}
