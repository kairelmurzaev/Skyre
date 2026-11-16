import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {within, received, growth, findAt, BUILD, canAfford, orchardReady} from './core.js';

// Tiny procedural diorama: all models are built from geometry, no asset downloads.
export function createScene(mount, callbacks){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#14263c');scene.fog=new THREE.FogExp2('#14263c',.019);
  const camera=new THREE.PerspectiveCamera(43,1,.1,100);camera.position.set(10,9.5,15);
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  mount.append(renderer.domElement);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
  controls.target.set(0,.15,0);controls.minDistance=5;controls.maxDistance=28;controls.maxPolarAngle=1.49;
  controls.enablePan=false;
  const hemi=new THREE.HemisphereLight('#c6eaff','#394657',2.2);scene.add(hemi);
  const sun=new THREE.DirectionalLight('#ffe4b6',2.3);sun.position.set(-6,12,8);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-11;sun.shadow.camera.right=11;sun.shadow.camera.top=11;sun.shadow.camera.bottom=-11;scene.add(sun);
  const material=(color,rough=.8,metal=0)=>new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});
  const box=(parent,size,pos,color,rough=.8)=>mesh(parent,new THREE.BoxGeometry(...size),material(color,rough),pos);
  function mesh(parent,geom,mat,pos=[0,0,0],rot=[0,0,0]){
    const m=new THREE.Mesh(geom,mat);m.position.set(...pos);m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  const cyl=(p,r1,r2,h,pos,color,n=12)=>mesh(p,new THREE.CylinderGeometry(r1,r2,h,n),material(color),pos);
  const cone=(p,r,h,pos,color,n=8)=>mesh(p,new THREE.ConeGeometry(r,h,n),material(color),pos);
  const ball=(p,r,pos,color)=>mesh(p,new THREE.SphereGeometry(r,12,9),material(color),pos);
  const table=box(scene,[19,.5,15],[0,-1.28,0],'#57444b');table.receiveShadow=true;
  cyl(scene,5.58,5.78,.48,[0,-.86,0],'#b9a077',64);
  cyl(scene,5.36,5.49,.72,[0,-.34,0],'#4b8190',64);
  cyl(scene,5.21,5.29,.22,[0,.06,0],'#86ac90',64);
  const rim=mesh(scene,new THREE.TorusGeometry(5.55,.105,10,70),material('#bda57e',.3,.66),[0,-.67,0],[Math.PI/2,0,0]);rim.castShadow=false;
  // Glass is decoration only and does not intercept clicks.
  const glass=mesh(scene,new THREE.SphereGeometry(6.25,44,30),new THREE.MeshPhysicalMaterial({color:'#ccefff',metalness:0,roughness:.06,transparent:true,opacity:.055,depthWrite:false,side:THREE.FrontSide,clearcoat:1}),[0,1.3,0]);
  glass.raycast=()=>{};glass.castShadow=false;glass.receiveShadow=false;
  const glassLine=mesh(scene,new THREE.TorusGeometry(6.0,.018,7,64),new THREE.MeshBasicMaterial({color:'#bce7ff',transparent:true,opacity:.25,depthWrite:false}),[0,1.3,0],[.12,0,.25]);glassLine.raycast=()=>{};glassLine.castShadow=false;
  const grid=new THREE.Group();scene.add(grid);
  const tiles=[];
  for(let x=-4;x<=4;x++)for(let z=-4;z<=4;z++){
    if(!within(x,z))continue;
    const t=mesh(grid,new THREE.PlaneGeometry(.94,.94),new THREE.MeshBasicMaterial({color:'#e7d49d',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}),[x,.185,z],[-Math.PI/2,0,0]);
    t.castShadow=false;t.receiveShadow=false;t.userData.hit={kind:'tile',x,z};tiles.push(t);
  }
  const hover=mesh(scene,new THREE.PlaneGeometry(.94,.94),new THREE.MeshBasicMaterial({color:'#b4e7b0',transparent:true,opacity:.25,depthWrite:false,side:THREE.DoubleSide}),[0,.19,0],[-Math.PI/2,0,0]);hover.visible=false;hover.raycast=()=>{};
  const models=new THREE.Group();scene.add(models);
  const residents=new THREE.Group();scene.add(residents);
  const crops=[],turbines=[],chimneys=[],orchards=[],walkers=[];
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
    const show=hoverHit?.kind==='tile'&&(mode==='build'||(mode==='move'&&currentOptions.selectedMove));
    preview.visible=!!show;
    if(!show||!currentGame)return;
    const {x,z}=hoverHit,world=currentGame[currentId];
    const good=!findAt(world,x,z)&&(mode==='move'||canAfford(world,BUILD[currentOptions.buildType]?.cost||{}));
    preview.position.set(x,.20,z);
    preview.rotation.y=mode==='build'?(currentOptions.rotation||0)*Math.PI/2:0;
    previewMaterial.color.set(good?'#b8e8ba':'#ee9e93');
    const isPath=mode==='build'&&currentOptions.buildType==='path';
    const isWell=mode==='build'&&currentOptions.buildType==='well';
    previewBody.visible=!isPath;
    previewRoof.visible=!isPath&&!isWell;
    previewBody.scale.y=isWell ? .62 : 1;
  }

  const grove=new THREE.Group();scene.add(grove);
  function tree(p,x,z,s=1,pink=false){
    const g=new THREE.Group();g.position.set(x,.16,z);g.scale.setScalar(s);p.add(g);
    cyl(g,.09,.14,.62,[0,.30,0],'#806a50',8);
    cone(g,.54,.94,[0,.86,0],pink?'#d4a4ba':'#5b9987',7);
    cone(g,.42,.75,[0,1.26,0],pink?'#f1c3d4':'#79b69c',7);
    cone(g,.28,.54,[0,1.61,0],pink?'#f5d2df':'#a0cba7',7);
    return g;
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
  const lamp=new THREE.Group();lamp.position.set(-7.2,-.63,-.35);scene.add(lamp);
  cyl(lamp,.50,.57,.15,[0,0,0],'#ae906b',32);
  cyl(lamp,.07,.07,1.85,[0,.95,0],'#d0ae7c');
  const arm=cyl(lamp,.07,.07,1.1,[.28,2.01,0],'#d0ae7c');arm.rotation.z=-.68;
  const shade=cone(lamp,.58,.75,[.73,2.32,0],'#c4a27b',24);shade.rotation.z=Math.PI;
  const lampBulb=ball(lamp,.17,[.74,1.93,0],'#fff2bd');
  lamp.traverse(o=>{if(o.isMesh)o.userData.hit={kind:'lamp'}});
  const lampLight=new THREE.PointLight('#ffc987',0,8);lampLight.position.set(-6.47,1.26,-.35);scene.add(lampLight);
  const mirror=new THREE.Group();mirror.position.set(7.0,-.55,-.4);scene.add(mirror);
  cyl(mirror,.45,.47,.12,[0,0,0],'#c2a77b',28);cyl(mirror,.07,.07,1.5,[0,.72,0],'#bba278');
  const mirrorFace=new THREE.Group();mirrorFace.position.y=1.6;mirror.add(mirrorFace);
  cyl(mirrorFace,.56,.56,.10,[0,0,0],'#c8ad80',36).rotation.x=Math.PI/2;
  cyl(mirrorFace,.50,.50,.112,[0,0,.03],'#a6dce6',36).rotation.x=Math.PI/2;
  mirror.traverse(o=>{if(o.isMesh)o.userData.hit={kind:'mirror'}});
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
    const tint=b.type==='plot'?'#8a6949':'#86aa86';
    if(b.type!=='path')box(g,[.94,.07,.94],[0,.05,0],tint);
    if(b.type==='plot'){
      box(g,[.86,.09,.82],[0,.10,0],'#6d5038');
      for(let i=-1;i<=1;i++)box(g,[.10,.03,.7],[i*.23,.16,0],'#ad7d4f');
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
      box(g,[.76,.73,.66],[0,.43,0],'#e9c8a4');
      const roof=cone(g,.66,.72,[0,1.15,0],'#aa7180',4);roof.rotation.y=Math.PI/4;
      box(g,[.2,.37,.04],[0,.27,.36],'#785d56');
      box(g,[.18,.17,.03],[-.26,.63,.35],'#ffe7ad');
      cyl(g,.05,.05,.28,[.25,1.38,-.1],'#9a7f74',6);
      smoke(g,.25,1.52,-.1);
    } else if(b.type==='windmill'){
      cyl(g,.32,.46,1.24,[0,.68,0],'#e8d5b9',7);
      cone(g,.48,.50,[0,1.56,0],'#b67d79',7);
      const hub=new THREE.Group();hub.position.set(0,1.08,.38);g.add(hub);turbines.push(hub);
      ball(hub,.1,[0,0,0],'#725b54');
      for(let i=0;i<4;i++){const vane=box(hub,[.12,.70,.04],[0,.40,0],'#eadcc0');vane.rotation.z=i*Math.PI/2;vane.position.set(Math.sin(i*Math.PI/2)*.4,Math.cos(i*Math.PI/2)*.4,0)}
    } else if(b.type==='bakery'){
      box(g,[.82,.67,.78],[0,.42,0],'#d5bba4');
      const roof=cone(g,.67,.53,[0,1.03,0],'#a36c6d',4);roof.rotation.y=Math.PI/4;
      box(g,[.27,.33,.1],[0,.34,.42],'#d18e5e');
      cyl(g,.12,.12,.65,[.27,1.27,-.2],'#a18c7a');
      smoke(g,.27,1.62,-.2);
    } else if(b.type==='well'){
      cyl(g,.43,.43,.38,[0,.28,0],'#a4b8b6',16);
      cyl(g,.33,.33,.35,[0,.48,0],'#407d96',16);
      for(const x of [-.32,.32])cyl(g,.045,.05,.85,[x,.75,0],'#b39a76');
      const roof=cone(g,.6,.38,[0,1.30,0],'#9b7d91',4);roof.rotation.y=Math.PI/4;
    } else if(b.type==='path'){
      for(let i=0;i<4;i++)box(g,[.36,.035,.38],[(i%2-.5)*.44,.03,(Math.floor(i/2)-.5)*.45],i%2?'#baa997':'#a4aaa2');
    } else if(b.type==='orchard'){
      cyl(g,.095,.14,.72,[0,.43,0],'#8d7160',8);
      for(const [ox,oy,oz,s] of [[0,1.06,0,.44],[-.24,.87,.09,.29],[.23,.92,-.11,.29]])ball(g,s,[ox,oy,oz],'#b8cfab');
      const fruits=[];
      for(let i=0;i<6;i++){
        const a=i*Math.PI*2/6;
        const f=ball(g,.07,[Math.cos(a)*.31,.87+Math.sin(i*2)*.12,Math.sin(a)*.28],'#f1c4aa');
        fruits.push(f);
      }
      orchards.push({b,fruits});
    }
    mark(g,{kind:'tile',x:b.x,z:b.z});
  }
  function rebuildVillagers(world){
    while(residents.children.length){const old=residents.children[0];residents.remove(old);old.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose()}})}
    walkers.length=0;
    const workers=(world.workers||[]).slice(0,16);
    for(let i=0;i<workers.length;i++){
      const worker=workers[i];
      const home=world.buildings.find(b=>b.id===worker.homeId&&b.type==='cottage');
      if(!home)continue;
      const available=types=>world.buildings.filter(b=>types.includes(b.type));
      const targets=worker.job==='farmer'?available(['plot','orchard']):
        worker.job==='miller'?available(['windmill']):
        worker.job==='baker'?available(['bakery']):
        worker.job==='forager'?[{x:-3.2,z:2.1},{x:3.1,z:2.1}]:[home];
      const dest=targets.length?targets[i%targets.length]:home;
      const v=new THREE.Group();v.position.set(home.x,.22,home.z);residents.add(v);
      const colors={farmer:'#a1bea0',miller:'#d6c49e',baker:'#e2a7a8',forager:'#95bccc',idle:'#c4b5d4'};
      const hats={farmer:'#779d66',miller:'#b2a17a',baker:'#f4ece0',forager:'#7095a1',idle:'#a56d8e'};
      cyl(v,.11,.095,.31,[0,.31,0],colors[worker.job]||colors.idle,9);
      ball(v,.105,[0,.58,0],i%2?'#9d785e':'#d9ae86');
      const hat=cone(v,worker.job==='baker'?.19:.155,worker.job==='baker'?.19:.12,[0,.75,0],hats[worker.job]||hats.idle,8);
      if(worker.job==='farmer'){
        const brim=cyl(v,.18,.18,.025,[0,.69,0],'#d3c091');brim.castShadow=false;
      }
      if(worker.job==='forager')box(v,[.18,.24,.14],[.17,.31,-.10],'#8f694c');
      if(worker.job==='miller')ball(v,.10,[.16,.28,0],'#e8d69d');
      for(const side of [-1,1])ball(v,.011,[side*.045,.59,.093],'#373d48');
      const leg1=cyl(v,.034,.04,.18,[-.065,.08,0],'#695c6b',6);
      const leg2=cyl(v,.034,.04,.18,[.065,.08,0],'#695c6b',6);
      v.traverse(o=>{if(o.isMesh)o.castShadow=false});
      walkers.push({v,leg1,leg2,home,dest,phase:i*1.8+Math.PI*.2,speed:.22+(i%3)*.07,job:worker.job});
    }
  }
  const raycaster=new THREE.Raycaster();const mouse=new THREE.Vector2();let start=null;
  function hit(e){const b=renderer.domElement.getBoundingClientRect();mouse.x=(e.clientX-b.left)/b.width*2-1;mouse.y=-(e.clientY-b.top)/b.height*2+1;raycaster.setFromCamera(mouse,camera);
    for(const match of raycaster.intersectObjects([models,grove,lamp,mirror,grid],true)){
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
    while(models.children.length){const g=models.children[0];models.remove(g);g.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose()}})}
    for(const b of game[id].buildings)drawBuilding(b,game,id,Date.now());
    rebuildVillagers(game[id]);
    const incoming=received(game,id);hemi.intensity=incoming.sun?2.9:2.2;sun.intensity=incoming.sun?3:1.7;
    sun.color.set(incoming.sun?'#ffe0a1':'#c1d4fb');
    lampLight.intensity=game[id].lamp?6:0;lampBulb.material.emissive.set(game[id].lamp?'#ffbd65':'#000000');
    mirrorFace.rotation.y=(game[id].mirror-1)*.40;
    tiles.forEach(tile=>{
      const {x,z}=tile.userData.hit,occupied=!!findAt(game[id],x,z);
      const mode=currentOptions.mode;
      if(mode==='build'){
        const affordable=canAfford(game[id],BUILD[currentOptions.buildType]?.cost||{});
        tile.material.color.set(!occupied&&affordable?'#a8e0b0':'#e9a19b');tile.material.opacity=.105;
      }else if(mode==='move'&&currentOptions.selectedMove){tile.material.color.set(occupied?'#e4a69c':'#a8e0b0');tile.material.opacity=.105;}
      else if(mode==='demolish'){tile.material.color.set('#f3cba4');tile.material.opacity=.05;}
      else tile.material.opacity=0;
    });
    updatePreview();
  }
  function setCamera(close){camera.position.set(...(close?[5.5,7.1,8.5]:[10,9.5,15]));controls.target.set(0,.15,0);controls.update()}
  function resize(){const w=mount.clientWidth,h=mount.clientHeight;if(w<1||h<1)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
  const ro=new ResizeObserver(resize);ro.observe(mount);resize();
  const clock=new THREE.Clock();
  let frameId=0;function tick(){
    frameId=requestAnimationFrame(tick);
    const t=clock.getElapsedTime();
    const now=Date.now();
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
      const a=walker.home,b=walker.dest,phase=t*walker.speed+walker.phase;
      const x=(Math.sin(phase)+1)/2;
      const eased=x*x*(3-2*x);
      walker.v.position.set(a.x+(b.x-a.x)*eased,.19+Math.abs(Math.sin(t*5+walker.phase))*.035,a.z+(b.z-a.z)*eased);
      walker.v.rotation.y=Math.atan2((b.x-a.x)*Math.cos(phase),(b.z-a.z)*Math.cos(phase));
      walker.leg1.rotation.x=Math.sin(t*6+walker.phase)*.45;
      walker.leg2.rotation.x=-Math.sin(t*6+walker.phase)*.45;
    }
    controls.update();renderer.render(scene,camera);
  }tick();
  return {refresh,setCamera,dispose(){cancelAnimationFrame(frameId);ro.disconnect();controls.dispose();renderer.dispose();renderer.domElement.remove()}};
}
