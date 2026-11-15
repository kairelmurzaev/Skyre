import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {within, received, growth} from './core.js';

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
  function drawBuilding(b,game,id,now){
    const g=new THREE.Group();g.position.set(b.x,.18,b.z);g.rotation.y=(b.rotation||0)*Math.PI/2;models.add(g);
    const tint=b.type==='plot'?'#8a6949':'#86aa86';
    if(b.type!=='path')box(g,[.94,.07,.94],[0,.05,0],tint);
    if(b.type==='plot'){
      box(g,[.86,.09,.82],[0,.10,0],'#6d5038');
      for(let i=-1;i<=1;i++)box(g,[.10,.03,.7],[i*.23,.16,0],'#ad7d4f');
      if(b.crop){
        const stage=growth(game,id,b,now),h=.12+.5*stage;
        for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){
          const stalk=cyl(g,.015,.025,h,[i*.21,.17+h/2,j*.24],b.crop.kind==='moonflower'?'#8bcbb3':'#71ad79',6);
          if(stage>.28)ball(g,.065+.045*stage,[i*.21,.17+h,j*.24],b.crop.kind==='moonflower'?'#d5b5ef':b.crop.kind==='carrot'?'#ed9861':'#e8d484');
        }
      }
    } else if(b.type==='cottage'){
      box(g,[.76,.73,.66],[0,.43,0],'#e9c8a4');
      const roof=cone(g,.66,.72,[0,1.15,0],'#aa7180',4);roof.rotation.y=Math.PI/4;
      box(g,[.2,.37,.04],[0,.27,.36],'#785d56');
      box(g,[.18,.17,.03],[-.26,.63,.35],'#ffe7ad');
      cyl(g,.05,.05,.28,[.25,1.38,-.1],'#9a7f74',6);
    } else if(b.type==='windmill'){
      cyl(g,.32,.46,1.24,[0,.68,0],'#e8d5b9',7);
      cone(g,.48,.50,[0,1.56,0],'#b67d79',7);
      const hub=new THREE.Group();hub.position.set(0,1.08,.38);hub.rotation.z=now*.00025;g.add(hub);
      ball(hub,.1,[0,0,0],'#725b54');
      for(let i=0;i<4;i++){const vane=box(hub,[.12,.70,.04],[0,.40,0],'#eadcc0');vane.rotation.z=i*Math.PI/2;vane.position.set(Math.sin(i*Math.PI/2)*.4,Math.cos(i*Math.PI/2)*.4,0)}
    } else if(b.type==='bakery'){
      box(g,[.82,.67,.78],[0,.42,0],'#d5bba4');
      const roof=cone(g,.67,.53,[0,1.03,0],'#a36c6d',4);roof.rotation.y=Math.PI/4;
      box(g,[.27,.33,.1],[0,.34,.42],'#d18e5e');
      cyl(g,.12,.12,.65,[.27,1.27,-.2],'#a18c7a');
    } else if(b.type==='well'){
      cyl(g,.43,.43,.38,[0,.28,0],'#a4b8b6',16);
      cyl(g,.33,.33,.35,[0,.48,0],'#407d96',16);
      for(const x of [-.32,.32])cyl(g,.045,.05,.85,[x,.75,0],'#b39a76');
      const roof=cone(g,.6,.38,[0,1.30,0],'#9b7d91',4);roof.rotation.y=Math.PI/4;
    } else if(b.type==='path'){
      for(let i=0;i<4;i++)box(g,[.36,.035,.38],[(i%2-.5)*.44,.03,(Math.floor(i/2)-.5)*.45],i%2?'#baa997':'#a4aaa2');
    }
    mark(g,{kind:'tile',x:b.x,z:b.z});
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
    if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>8){hover.visible=false;return;}
    const h=hit(e);if(h?.kind==='tile'){hover.visible=true;hover.position.set(h.x,.22,h.z);}else hover.visible=false;
  });
  renderer.domElement.addEventListener('pointerleave',()=>{hover.visible=false;start=null});
  function refresh(game,id){
    while(models.children.length){const g=models.children[0];models.remove(g);g.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose()}})}
    for(const b of game[id].buildings)drawBuilding(b,game,id,Date.now());
    const incoming=received(game,id);hemi.intensity=incoming.sun?2.9:2.2;sun.intensity=incoming.sun?3:1.7;
    sun.color.set(incoming.sun?'#ffe0a1':'#c1d4fb');
    lampLight.intensity=game[id].lamp?6:0;lampBulb.material.emissive=new THREE.Color(game[id].lamp?'#ffbd65':'#000000');
    mirrorFace.rotation.y=(game[id].mirror-1)*.40;
    tiles.forEach(t=>{t.material.opacity=callbacks.getMode()==='build'||callbacks.getMode()==='demolish'?.075:0});
  }
  function setCamera(close){camera.position.set(...(close?[5.5,7.1,8.5]:[10,9.5,15]));controls.target.set(0,.15,0);controls.update()}
  function resize(){const w=mount.clientWidth,h=mount.clientHeight;if(w<1||h<1)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
  const ro=new ResizeObserver(resize);ro.observe(mount);resize();
  let frameId=0;function tick(){frameId=requestAnimationFrame(tick);controls.update();renderer.render(scene,camera)}tick();
  return {refresh,setCamera,dispose(){cancelAnimationFrame(frameId);ro.disconnect();controls.dispose();renderer.dispose();renderer.domElement.remove()}};
}