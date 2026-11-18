import * as THREE from 'three';
import {DESK_SITES,DESK_BUILDS,deskAt} from './desk.js';

// Geometry-based desk landmarks, prop markers and tiny user-built structures.
// Small and self-contained so Skyre remains practical on mobile WebGL.
export function createDeskArt(scene){
  const all=new THREE.Group();all.name='Explorable Desk';scene.add(all);
  const fixtures=new THREE.Group();all.add(fixtures);
  const constructions=new THREE.Group();all.add(constructions);
  const M=Object.fromEntries(Object.entries({
    wood:'#b58b60',woodDark:'#5f3d30',woodLight:'#e4c7a0',paper:'#fff0c6',
    coffee:'#573427',mug:'#eadad1',mugRim:'#fff9ec',bookRed:'#ac5b62',
    bookBlue:'#527f87',bookGreen:'#718a65',leaf:'#618d59',leafLight:'#99bb77',
    soil:'#534234',pot:'#b66d4f',gold:'#f3c977',stone:'#a8a49a',
    pink:'#e2a2a1',satin:'#6b8790',cloth:'#e6c69b'
  }).map(([k,v])=>[k,new THREE.MeshStandardMaterial({color:v,roughness:.72,metalness:k==='gold'?.25:0})]));
  const glow=new THREE.MeshStandardMaterial({color:'#f2cf80',emissive:'#ffc267',emissiveIntensity:.9,roughness:.4});
  const padMat=new THREE.MeshBasicMaterial({color:'#edd29a',transparent:true,opacity:.10,depthWrite:false,side:THREE.DoubleSide});
  const padRingMat=new THREE.MeshBasicMaterial({color:'#e3d197',transparent:true,opacity:.72,depthWrite:false});
  const activeRingMat=new THREE.MeshBasicMaterial({color:'#9dddab',transparent:true,opacity:.92,depthWrite:false});
  function part(parent,geometry,material,position=[0,0,0],rotation){
    const o=new THREE.Mesh(geometry,material);o.position.set(...position);if(rotation)o.rotation.set(...rotation);
    o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
  }
  const box=(g,w,h,d,p,m,rot)=>part(g,new THREE.BoxGeometry(w,h,d),m,p,rot);
  const cylinder=(g,top,bottom,h,p,m,segments=16)=>part(g,new THREE.CylinderGeometry(top,bottom,h,segments),m,p);
  const sphere=(g,r,p,m,detail=1)=>part(g,new THREE.IcosahedronGeometry(r,detail),m,p);
  function ring(g,r,t,p,mat,flat=true){
    const result=part(g,new THREE.TorusGeometry(r,t,7,36),mat,p);
    if(flat)result.rotation.x=Math.PI/2;
    result.castShadow=false;return result;
  }
  function hitGroup(g,hit){
    g.traverse(o=>{if(o.isMesh)o.userData.hit=hit;});
  }
  function addMug(){
    const g=new THREE.Group();g.position.set(-8.15,-1.02,-4.70);fixtures.add(g);
    cylinder(g,.93,.93,.055,[0,.08,0],M.paper,40);
    cylinder(g,.75,.67,1.12,[0,.64,0],M.mug,36);
    cylinder(g,.68,.68,.012,[0,1.205,0],M.coffee,40);
    ring(g,.705,.052,[0,1.20,0],M.mugRim);
    ring(g,.40,.125,[.74,.66,0],M.mug,false).rotation.y=.02;
    box(g,.14,.22,.29,[.69,.72,0],M.mug);
    const saucer=ring(g,.92,.033,[0,.11,0],M.mugRim);saucer.raycast=()=>{};
    const steam=[];
    for(let i=0;i<3;i++){
      const puff=sphere(g,.10+i*.02,[.18*(i-1),1.42+i*.14,0],M.paper,1);
      puff.castShadow=false;puff.raycast=()=>{};steam.push(puff);
    }
    hitGroup(g,{kind:'desk-object',id:'mug'});
    steam.forEach(o=>o.raycast=()=>{});
    return steam;
  }
  function addBooks(){
    const g=new THREE.Group();g.position.set(8.2,-1.01,-5.25);fixtures.add(g);
    const covers=[M.bookBlue,M.bookRed,M.bookGreen,M.bookBlue];
    const h=[.25,.29,.26,.23],rot=[-.10,.075,-.05,.13];let y=.15;
    for(let i=0;i<4;i++){
      const layer=new THREE.Group();layer.position.set((i%2-.5)*.17,y,0);layer.rotation.y=rot[i];g.add(layer);
      box(layer,2.45,h[i],1.55,[0,0,0],M.paper);
      box(layer,2.55,.08,1.65,[0,h[i]*.53,0],covers[i]);
      box(layer,2.55,.08,1.65,[0,-h[i]*.53,0],covers[i]);
      box(layer,.1,h[i]+.1,1.65,[-1.27,0,0],covers[i]);
      y+=h[i]+.09;
    }
    box(g,.08,.1,.75,[.83,y-.04,.32],M.gold);
    hitGroup(g,{kind:'desk-object',id:'books'});
  }
  function addPlant(){
    const g=new THREE.Group();g.position.set(-8.4,-1.01,4.75);fixtures.add(g);
    cylinder(g,.69,.55,.80,[0,.41,0],M.pot,24);
    cylinder(g,.66,.66,.04,[0,.83,0],M.soil,24);
    ring(g,.70,.052,[0,.81,0],M.pot);
    for(let i=0;i<9;i++){
      const a=i*Math.PI*2/9;
      const len=1.0+(i%3)*.26;
      const dx=Math.cos(a)*.55,dz=Math.sin(a)*.55;
      const stem=cylinder(g,.035,.045,len,[dx*.50,1.02+len*.38,dz*.5],M.leaf,7);
      stem.rotation.z=Math.cos(a)*.33;stem.rotation.x=-Math.sin(a)*.32;
      const leaf=sphere(g,.30+(i%3)*.048,[dx,1.48+len*.36,dz],i%2?M.leaf:M.leafLight);
      leaf.scale.set(.68,1.52,.85);leaf.rotation.z=Math.cos(a)*.40;leaf.rotation.x=-Math.sin(a)*.26;
    }
    hitGroup(g,{kind:'desk-object',id:'plant'});
  }
  function addPapers(){
    const g=new THREE.Group();g.position.set(6.80,-1.005,5.75);fixtures.add(g);
    box(g,2.9,.025,2.05,[0,.01,0],M.paper,[0,.2,0]);
    for(let i=0;i<5;i++)box(g,1.6,.004,.023,[-.31,.03,-.72+i*.23],M.satin,[0,.2,0]);
    const envelope=new THREE.Group();envelope.position.set(-.62,.045,-.48);envelope.rotation.y=.14;g.add(envelope);
    box(envelope,1.06,.016,.68,[0,0,0],M.pink);
    part(envelope,new THREE.ConeGeometry(.52,.48,3),M.paper,[0,.027,.04],[-Math.PI/2,0,Math.PI/6]).castShadow=false;
    // Papers are atmospheric in this release; the three primary landmarks are interactable.
    g.traverse(o=>{if(o.isMesh)o.raycast=()=>{}});
  }
  const steam=addMug();addBooks();addPlant();addPapers();
  const spots=new Map();
  function label(text){
    const c=document.createElement('canvas');c.width=256;c.height=72;
    const ctx=c.getContext('2d');ctx.fillStyle='#173c3be8';ctx.beginPath();ctx.roundRect(3,4,250,60,18);ctx.fill();
    ctx.strokeStyle='#eed79a';ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle='#ffebbd';ctx.font='bold 27px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,128,35);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));
    sp.scale.set(1.9,.54,1);sp.renderOrder=4;
    return sp;
  }
  for(const spot of DESK_SITES){
    const g=new THREE.Group();g.position.set(spot.x,-.98,spot.z);fixtures.add(g);
    const disk=part(g,new THREE.CircleGeometry(.67,32),padMat,[0,.012,0],[-Math.PI/2,0,0]);
    const circle=ring(g,.67,.026,[0,.02,0],padRingMat);
    const plaque=label(spot.name.toUpperCase());plaque.position.set(0,.52,0);g.add(plaque);
    disk.userData.hit={kind:'desk-site',id:spot.id};
    circle.userData.hit={kind:'desk-site',id:spot.id};
    plaque.userData.hit={kind:'desk-site',id:spot.id};
    spots.set(spot.id,{g,disk,circle,plaque});
  }
  function beamBetween(g,a,b,r,m){
    const v1=new THREE.Vector3(...a),v2=new THREE.Vector3(...b);
    const diff=v2.clone().sub(v1),mid=v1.clone().add(v2).multiplyScalar(.5);
    const obj=cylinder(g,r,r,diff.length(),mid.toArray(),m,7);
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),diff.normalize());return obj;
  }
  function makeBridge(g){
    // An actual tilted bridge from the island rim to the book landing on the desk.
    const p1=new THREE.Vector3(4.5,.24,-2.1),p2=new THREE.Vector3(6.45,-.94,-3.75);
    const delta=p2.clone().sub(p1),horizontal=new THREE.Vector3(delta.x,0,delta.z).normalize();
    const side=new THREE.Vector3(-horizontal.z,0,horizontal.x);
    for(const direction of [-1,1]){
      const a=p1.clone().addScaledVector(side,direction*.37),b=p2.clone().addScaledVector(side,direction*.37);
      beamBetween(g,a.toArray(),b.toArray(),.060,M.woodDark);
    }
    for(let i=0;i<=11;i++){
      const t=i/11,center=p1.clone().lerp(p2,t);
      const board=box(g,.82,.063,.24,center.toArray(),i%2?M.wood:M.woodLight);
      board.rotation.y=Math.atan2(horizontal.x,horizontal.z);
      board.rotation.x=-Math.atan2(delta.y,Math.hypot(delta.x,delta.z));
    }
  }
  function makeStall(g){
    box(g,1.35,.13,.85,[0,.65,0],M.wood);
    for(const x of [-.55,.55])for(const z of [-.31,.31])box(g,.095,.96,.095,[x,.35,z],M.woodDark);
    for(const x of [-.59,.59])box(g,.07,.83,.07,[x,1.14,-.31],M.wood);
    const roof=box(g,1.62,.08,1.1,[0,1.56,0],M.bookRed);
    for(let i=0;i<5;i++)box(g,.22,.012,1.1,[-.61+i*.30,1.605,0],i%2?M.paper:M.bookRed);
    for(let i=0;i<3;i++)sphere(g,.14,[-.36+i*.34,.80,.1],M.gold);
  }
  function makeCamp(g){
    box(g,1.5,.075,1.22,[0,.08,0],M.woodLight);
    part(g,new THREE.ConeGeometry(.83,1.18,4),M.leaf,[0,.73,0],[0,Math.PI/4,0]);
    box(g,.45,.62,.025,[0,.39,.60],M.woodDark);
    for(let i=0;i<4;i++){
      const log=box(g,.50,.105,.14,[1.0,.12,(i-1.5)*.15],M.wood);
      log.rotation.y=(i%2?.2:-.3);
    }
    sphere(g,.17,[1,.27,0],glow);
  }
  function makeWorkbench(g){
    box(g,1.5,.11,.8,[0,.70,0],M.wood);
    for(const x of [-.58,.58])for(const z of [-.30,.30])box(g,.10,.68,.10,[x,.33,z],M.woodDark);
    box(g,.70,.03,.48,[-.28,.80,.06],M.paper);
    const pencil=cylinder(g,.036,.036,.80,[.43,.85,-.04],M.gold,6);pencil.rotation.z=Math.PI/2;
    box(g,.37,.18,.30,[.45,.82,.23],M.bookBlue);
  }
  function makeLantern(g){
    cylinder(g,.23,.27,.15,[0,.07,0],M.woodDark);
    cylinder(g,.07,.08,.95,[0,.59,0],M.wood);
    box(g,.45,.55,.44,[0,1.22,0],M.woodDark);
    box(g,.30,.40,.29,[0,1.22,0],glow);
    part(g,new THREE.ConeGeometry(.36,.22,4),M.gold,[0,1.64,0],[0,Math.PI/4,0]);
  }
  let signature='';
  function refresh(world,buildMode=false){
    const next=JSON.stringify(world.desk?.builds||[]);
    if(signature!==next){
      for(const old of [...constructions.children]){
        constructions.remove(old);
        old.traverse(o=>{if(o.isMesh)o.geometry.dispose()});
      }
      for(const b of (world.desk?.builds||[])){
        const site=DESK_SITES.find(s=>s.id===b.site);
        if(!site||!DESK_BUILDS[b.type])continue;
        const group=new THREE.Group();group.position.set(site.x,-.96,site.z);constructions.add(group);
        if(b.type==='bridge')makeBridge(group);
        if(b.type==='stall')makeStall(group);
        if(b.type==='camp')makeCamp(group);
        if(b.type==='workbench')makeWorkbench(group);
        if(b.type==='lantern')makeLantern(group);
        // The bridge spans the island: its geometry is already world-positioned.
        if(b.type==='bridge')group.position.set(0,0,0);
        hitGroup(group,{kind:'desk-site',id:site.id});
      }
      signature=next;
    }
    for(const s of DESK_SITES){
      const spot=spots.get(s.id),occupied=!!deskAt(world,s.id);
      spot.disk.visible=!occupied&&buildMode;
      spot.circle.visible=!occupied;
      spot.plaque.visible=!occupied;
      spot.circle.material=buildMode?activeRingMat:padRingMat;
    }
  }
  function animate(t){
    for(let i=0;i<steam.length;i++){
      const p=steam[i],wave=(t*.30+i/3)%1;
      p.position.set((i-1)*.18+Math.sin(t+i)*.075,1.36+wave*.86,Math.sin(t*.7+i)*.09);
      p.scale.setScalar(.53+wave*.83);
      p.visible=true;
    }
  }
  function dispose(){
    for(const g of [fixtures,constructions])g.traverse(o=>{
      if(o.isMesh)o.geometry.dispose();
      if(o.isSprite){o.material.map?.dispose();o.material.dispose();}
    });
    for(const m of Object.values(M))m.dispose();
    for(const m of [glow,padMat,padRingMat,activeRingMat])m.dispose();
    scene.remove(all);
  }
  return {group:all,refresh,animate,dispose,objects:{mug:{x:-8.15,z:-4.7},plant:{x:-8.4,z:4.75},books:{x:8.2,z:-5.25}}};
}

