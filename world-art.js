import * as THREE from 'three';
import {createWorldMaterials,hash01} from './world-materials.js';

// Geometry-first storybook assets. All visual decisions are separate from
// placement, world saves, crop logic, upgrades, and pathfinding.
export function createWorldArt(){
  const M=createWorldMaterials();
  for(const value of Object.values(M)){
    for(const mat of Array.isArray(value)?value:[value])if(mat?.isMaterial)mat.userData.sharedArt=true;
  }
  const box=(p,dim,pos,mat)=>part(p,new THREE.BoxGeometry(...dim),mat,pos);
  const ball=(p,size,pos,mat,detail=1)=>part(p,new THREE.IcosahedronGeometry(size,detail),mat,pos);
  const cyl=(p,rTop,rBottom,h,pos,mat,n=10)=>part(p,new THREE.CylinderGeometry(rTop,rBottom,h,n),mat,pos);
  const cone=(p,r,h,pos,mat,n=9)=>part(p,new THREE.ConeGeometry(r,h,n),mat,pos);
  function part(p,g,m,pos=[0,0,0],rot){
    const obj=new THREE.Mesh(g,m);obj.position.set(...pos);
    if(rot)obj.rotation.set(...rot);
    obj.castShadow=true;obj.receiveShadow=true;p.add(obj);return obj;
  }
  function cylinderBetween(p,a,b,r,mat,sides=8){
    const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),d=new THREE.Vector3().subVectors(vb,va);
    const m=cyl(p,r*.86,r,d.length(),va.clone().add(vb).multiplyScalar(.5).toArray(),mat,sides);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;
  }
  function step(p,y=.11){
    box(p,[.54,.075,.28],[0,y,.62],M.stoneLight);
    box(p,[.40,.065,.19],[0,y+.052,.48],M.stone);
  }
  function foundation(p,w=.88,d=.8){
    box(p,[w+.05,.17,d+.07],[0,.145,0],M.stone);
    for(const s of [-1,1])for(let j=-1;j<=1;j++){
      box(p,[.11,.105,.20],[s*(w/2),.12,j*d*.24],M.stoneLight);
    }
    for(let j=0;j<6;j++){
      box(p,[.13,.09,.13],[-w*.4+j*w*.16,.115,-d*.51],j%3?M.stone:M.stoneLight);
    }
  }
  function beam(p,a,b,width=.035,mat=M.darkWood){
    const v1=new THREE.Vector3(...a),v2=new THREE.Vector3(...b);
    const v=v2.clone().sub(v1),m=box(p,[width,v.length(),width],v1.add(v2).multiplyScalar(.5).toArray(),mat);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return m;
  }
  function gableRoof(p,{w=1.1,d=1,eave=1.02,peak=1.43,material=M.roof}={}){
    const run=w/2,len=Math.hypot(run,peak-eave);
    for(const side of [-1,1]){
      const panel=box(p,[len,.065,d],[side*run*.5,(eave+peak)*.5,0],material);
      panel.rotation.z=side===-1?Math.atan2(peak-eave,run):-Math.atan2(peak-eave,run);
      beam(p,[side*run,eave+.02,-d*.5],[side*run,eave+.02,d*.5],.052,M.darkWood);
      beam(p,[side*run,eave+.04,d*.5],[0,peak+.04,d*.5],.034,M.darkWood);
      beam(p,[side*run,eave+.04,-d*.5],[0,peak+.04,-d*.5],.034,M.darkWood);
    }
    beam(p,[0,peak+.035,-d*.52],[0,peak+.035,d*.52],.05,M.roofDark);
    // Rendered plaster triangle under the roofline, so roofs have real gables.
    const vs=[-w/2,eave,.002, w/2,eave,.002, 0,peak,.002];
    for(const s of [-1,1]){
      const geo=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(
        vs.map((v,i)=>i%3===2?s*d*.46:v),3));
      geo.setIndex(s>0?[0,1,2]:[2,1,0]);geo.computeVertexNormals();
      const gable=part(p,geo,M.plaster);gable.castShadow=false;
    }
  }
  function window(p,x,y,z,side='front'){
    const g=new THREE.Group();g.position.set(x,y,z);
    if(side==='right')g.rotation.y=Math.PI/2;
    p.add(g);
    box(g,[.235,.25,.05],[0,0,.014],M.darkWood);
    box(g,[.19,.206,.018],[0,.004,.051],M.pane);
    box(g,[.027,.235,.025],[0,0,.063],M.wood);
    box(g,[.215,.025,.025],[0,.012,.064],M.wood);
    box(g,[.27,.038,.075],[0,-.145,.058],M.stoneLight);
    // Side shutters have visible, individually planked wooden surfaces.
    for(const s of [-1,1]){
      box(g,[.065,.241,.031],[s*.153,0,.041],M.wood);
      for(let q=0;q<3;q++)box(g,[.047,.007,.043],[s*.153,-.075+q*.071,.059],M.darkWood);
    }
    const glint=box(g,[.045,.13,.002],[-.062,.007,.068],M.white);
    glint.material=M.pane;glint.castShadow=false;
  }
  function door(p,{z=.433,w=.24,y=.395,h=.46,mat=M.wood}={}){
    const g=new THREE.Group();g.position.set(0,y,z);p.add(g);
    box(g,[w+.055,h+.07,.045],[0,.009,0],M.darkWood);
    box(g,[w,h,.048],[0,0,.030],mat);
    for(let s=-1;s<=1;s++)box(g,[.017,h*.93,.013],[s*w*.27,0,.061],M.darkWood);
    box(g,[w*.79,.018,.035],[0,h*.40,.058],M.darkWood);
    ball(g,.023,[w*.34,-.03,.067],M.brass||M.metal);
    // Door porch stoop and stone stairs.
    step(p,.11);
  }
  function timberFrames(p,w=.78,h=.84,d=.75){
    for(const s of [-1,1]){
      box(p,[.055,h,.055],[s*w/2,.62,d/2+.018],M.wood);
      box(p,[.05,h,.05],[s*w/2,.62,-d/2-.018],M.wood);
      beam(p,[s*w/2,.30,d/2+.018],[s*.09,.70,d/2+.023],.033,M.wood);
      box(p,[.065,.84,.048],[s*w/2,.62,0],M.wood);
    }
    box(p,[w+.10,.058,d+.10],[0,1.04,0],M.wood);
    box(p,[w+.10,.054,d+.10],[0,.51,0],M.wood);
  }
  function chimney(p,smoke,x=.29,z=-.16){
    box(p,[.17,.43,.15],[x,1.34,z],M.stone);
    box(p,[.215,.060,.19],[x,1.56,z],M.darkWood);
    for(let i=0;i<5;i++){
      box(p,[.17,.018,.155],[x,1.18+i*.07,z],M.stoneLight);
    }
    smoke(p,x,1.62,z);
  }
  function flower(p,x,y,z,col){
    const g=new THREE.Group();g.position.set(x,y,z);p.add(g);
    cylinderBetween(g,[0,0,0],[.007,.15,0],.009,M.flowerStem,5);
    for(let i=0;i<5;i++){
      const a=i*Math.PI*2/5;
      const petal=ball(g,.039,[Math.cos(a)*.043,.158,Math.sin(a)*.043],col,0);
      petal.scale.set(.72,.58,.72);petal.castShadow=false;
    }
    ball(g,.020,[0,.165,0],M.brass||M.metal,0).castShadow=false;
  }
  function planter(p,x,z){
    box(p,[.23,.12,.12],[x,.29,z],M.wood);
    box(p,[.21,.034,.10],[x,.36,z],M.soil);
    for(let i=0;i<3;i++)flower(p,x+(i-1)*.065,.35,z,M.blossom[i%M.blossom.length]);
  }
  const signMaterials=new Map();
  function sign(p,text,pos=[0,1.28,.49],width=.43){
    if(!signMaterials.has(text)){
    const c=document.createElement('canvas');c.width=512;c.height=180;
    const ctx=c.getContext('2d');
    ctx.fillStyle='#69513d';ctx.fillRect(0,0,c.width,c.height);
    ctx.fillStyle='#ddc39d';ctx.font='bold 60px Georgia,serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(text.toUpperCase(),256,92,460);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
    const mat=new THREE.MeshBasicMaterial({map:t});mat.userData.sharedArt=true;
    signMaterials.set(text,mat);
    }
    const g=new THREE.Group();g.position.set(...pos);p.add(g);
    box(g,[width+.06,.21,.055],[0,0,0],M.wood);
    const face=part(g,new THREE.PlaneGeometry(width,.16),signMaterials.get(text),[0,0,.033]);
    face.castShadow=false;
    for(const s of [-1,1])beam(g,[s*(width*.43),.12,-.01],[s*(width*.43),.25,-.01],.021,M.metal);
  }
  function cottage(p,smoke,level=1){
    foundation(p,.82,.78);
    box(p,[.80,.83,.75],[0,.65,0],M.plaster);
    timberFrames(p,.8,.84,.75);
    gableRoof(p,{w:1.12,d:1.08,eave:1.065,peak:1.44});
    // Chimney, framed windows and arched front door have depth and silhouettes.
    chimney(p,smoke,.30,-.19);
    door(p,{z:.405,w:.245,y:.42,h:.43});
    window(p,-.262,.73,.40);
    window(p,.267,.73,.40);
    window(p,.425,.74,-.16,'right');
    planter(p,-.35,.48);planter(p,.35,.48);
    if(level>=2){
      // Upgraded cottages get an attic dormer and larger flower boxes.
      box(p,[.31,.22,.29],[0,1.23,.37],M.plaster);
      gableRoof(p,{w:.42,d:.36,eave:1.36,peak:1.55,material:M.roofDark});
      window(p,0,1.27,.525);
      sign(p,'HOME',[0,1.01,.51],.32);
    }
  }
  function bakery(p,smoke){
    foundation(p,.86,.84);
    box(p,[.83,.83,.79],[0,.63,0],M.whitePlaster);
    timberFrames(p,.83,.83,.79);
    gableRoof(p,{w:1.18,d:1.16,eave:1.055,peak:1.42});
    door(p,{z:.43,w:.26,y:.415,h:.43,mat:M.darkWood});
    window(p,-.27,.75,.428);
    window(p,.28,.75,.428);
    // Cream canvas awning with individual terracotta stripes and supports.
    for(let i=0;i<7;i++){
      const seg=box(p,[.16,.018,.29],[-.48+i*.16,.993,.59],i%2?M.white:M.roofDark);
      seg.rotation.x=-.19;
    }
    for(const x of [-.49,.49])cylinderBetween(p,[x,.80,.69],[x,1.06,.48],.018,M.wood);
    chimney(p,smoke,.34,-.19);
    sign(p,'BAKERY',[0,1.13,.625],.48);
    box(p,[.21,.14,.20],[.38,.22,.56],M.wood);
    for(let i=0;i<3;i++){
      const loaf=ball(p,.068,[.32+i*.068,.32,.58],M.roofDark,1);
      loaf.scale.set(1,.54,.66);
      box(p,[.008,.009,.09],[.31+i*.068,.35,.58],M.white);
    }
  }
  function warehouse(p){
    foundation(p,.88,.86);
    box(p,[.88,.86,.86],[0,.64,0],M.wood);
    for(const s of [-1,1])for(let i=0;i<3;i++){
      box(p,[.054,.88,.053],[s*.45,.64,-.35+i*.35],M.darkWood);
    }
    gableRoof(p,{w:1.24,d:1.15,eave:1.10,peak:1.56,material:M.roofDark});
    // Full-height framed double barn doors with X-bracing.
    for(const s of [-1,1]){
      box(p,[.31,.64,.038],[s*.164,.57,.445],M.wood);
      beam(p,[s*.02,.30,.472],[s*.31,.84,.472],.028,M.darkWood);
      beam(p,[s*.32,.30,.473],[s*.01,.84,.473],.028,M.darkWood);
      ball(p,.016,[s*.07,.57,.48],M.metal,0);
    }
    box(p,[.76,.06,.06],[0,.93,.48],M.stoneLight);
    sign(p,'STORE',[0,1.26,.57],.43);
    for(let i=0;i<3;i++){
      box(p,[.24,.20,.25],[-.34+i*.29,.25,-.57],M.wood);
      for(const s of [-1,1])box(p,[.025,.20,.02],[-.34+i*.29+s*.09,.25,-.435],M.darkWood);
    }
    for(const x of [-.40,.40]){
      const barrel=cyl(p,.11,.125,.27,[x,.24,.53],M.wood,12);
      for(const y of [.15,.32])cyl(p,.124,.124,.016,[x,y,.53],M.metal,12);
    }
  }
  function windmill(p,turbines){
    foundation(p,.89,.85);
    const tower=cyl(p,.30,.43,1.27,[0,.71,0],M.stone,9);
    for(let i=0;i<10;i++){
      const a=i*Math.PI*2/10;
      box(p,[.06,.80,.04],[Math.cos(a)*.352,.70,Math.sin(a)*.352],M.stoneLight).rotation.y=-a;
    }
    cone(p,.47,.55,[0,1.64,0],M.roofDark,10);
    cyl(p,.095,.10,.14,[0,1.88,0],M.wood);
    door(p,{z:.415,w:.24,y:.38,h:.45});
    window(p,0,.93,.379);
    // Four timber spars, proper broad fabric sails, hub on outward-facing wall.
    const hub=new THREE.Group();hub.position.set(0,1.21,.45);p.add(hub);turbines.push(hub);
    cyl(hub,.105,.105,.13,[0,0,.08],M.darkWood,16).rotation.x=Math.PI/2;
    for(let i=0;i<4;i++){
      const blade=new THREE.Group();blade.rotation.z=i*Math.PI/2;hub.add(blade);
      box(blade,[.035,.90,.035],[0,.48,.04],M.wood);
      // sails are translucent pale linen with visible cross battens
      const sailMat=new THREE.MeshStandardMaterial({color:i%2?'#f1e5c5':'#e3dac0',roughness:1,side:THREE.DoubleSide});
      part(blade,new THREE.PlaneGeometry(.29,.67),sailMat,[.16,.51,.06]);
      for(let k=0;k<5;k++)box(blade,[.30,.012,.014],[.16,.22+k*.13,.07],M.wood);
      box(blade,[.042,.08,.06],[0,.92,.04],M.metal);
    }
    box(p,[.32,.08,.43],[0,.12,.52],M.stoneLight);
    sign(p,'MILL',[0,.78,.454],.28);
  }
  function well(p){
    for(let i=0;i<14;i++){
      const a=i*Math.PI*2/14;
      const stone=box(p,[.235,.21,.13],[Math.cos(a)*.355,.34,Math.sin(a)*.355],i%3?M.stone:M.stoneLight);
      stone.rotation.y=-a;
    }
    const interior=cyl(p,.30,.30,.045,[0,.30,0],M.water,22);interior.castShadow=false;
    for(const x of [-.39,.39]){
      box(p,[.09,1.13,.10],[x,.79,0],M.wood);
      box(p,[.12,.14,.16],[x,.33,0],M.stone);
    }
    gableRoof(p,{w:1.08,d:.76,eave:1.39,peak:1.79,material:M.roof});
    cylinderBetween(p,[-.43,1.08,0],[.43,1.08,0],.034,M.wood);
    cyl(p,.10,.10,.21,[0,.79,0],M.wood,12).rotation.z=Math.PI/2;
    cylinderBetween(p,[0,.82,0],[0,.48,0],.012,M.metal);
    ball(p,.15,[0,.47,0],M.wood,0);
  }
  function path(p,seed=0){
    // Six irregular flagstones rather than perfectly squared road tiles.
    for(let i=0;i<6;i++){
      const x=-.29+(i%3)*.30+(hash01(seed,i,2)-.5)*.045;
      const z=-.22+Math.floor(i/3)*.43+(hash01(seed,i,4)-.5)*.05;
      const rock=part(p,new THREE.DodecahedronGeometry(.22+(i%2)*.025,0),
        i%3?M.stone:M.stoneLight,[x,.065,z]);
      rock.scale.set(1.17,.22,.88);rock.rotation.y=hash01(seed,i,9)*.6;
    }
    for(let i=0;i<4;i++){
      const x=(hash01(seed,i,12)-.5)*.80,z=(hash01(seed,i,24)-.5)*.80;
      ball(p,.028,[x,.099,z],M.foliage[1],0).castShadow=false;
    }
  }
  function plot(p){
    box(p,[.92,.10,.90],[0,.10,0],M.wood);
    box(p,[.85,.075,.81],[0,.17,0],M.soil);
    for(let i=-1;i<=1;i++){
      const ridge=box(p,[.10,.028,.73],[i*.23,.22,0],M.soilStone);
      ridge.castShadow=false;
    }
    for(const s of [-1,1]){
      box(p,[.045,.12,.90],[s*.45,.135,0],M.wood);
      box(p,[.92,.12,.045],[0,.135,s*.447],M.wood);
    }
  }
  const leafGeometry=(()=>{
    // Slightly folded, leaf-shaped four-triangle mesh. Reused for all foliage.
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute([
      0,0,0, -.07,.075,0, 0,.145,.026, .07,.075,0,
      0,0,0, 0,.145,.026,
    ],3));
    g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();g.userData.sharedArt=true;
    return g;
  })();
  function makeTree(parent,x=0,z=0,scale=1,pink=false,kind='oak'){
    const t=new THREE.Group();t.position.set(x,.16,z);t.scale.setScalar(scale);parent.add(t);
    const seed=Math.round((x+30)*31+(z+30)*101)+(pink?1001:37);
    // Trunk and genuine crooked branches.
    cylinderBetween(t,[0,.03,0],[.018,.85,0],.105,M.bark,9);
    const branches=[
      [[0,.59,0],[-.35,1.08,.03]],[[0,.69,0],[.32,1.16,-.09]],
      [[0,.76,0],[-.14,1.38,-.24]],[[.01,.72,0],[.16,1.48,.24]],
      [[.01,.81,0],[.02,1.56,-.05]]
    ];
    for(const [a,b] of branches)cylinderBetween(t,a,b,.04,M.bark,7);
    const clusters=[
      [-.30,1.14,.01,.35],[.28,1.19,-.04,.36],
      [-.06,1.45,-.22,.38],[.15,1.52,.20,.37],
      [-.24,1.50,.12,.29],[.06,1.73,-.03,.28],[.32,1.47,.05,.28]
    ];
    clusters.forEach(([cx,cy,cz,r],i)=>{
      const m=ball(t,r,[cx,cy,cz],pink?M.blossom[i%M.blossom.length]:M.foliage[i%M.foliage.length],1);
      m.scale.set(1.09,.77,1.04);m.rotation.y=hash01(seed,i)*Math.PI;
    });
    const n=kind==='orchard'?120:190;
    const foliage=new THREE.InstancedMesh(leafGeometry,
      new THREE.MeshStandardMaterial({color:pink?'#f6d5dd':'#ffffff',roughness:1,side:THREE.DoubleSide}),n);
    foliage.castShadow=true;foliage.receiveShadow=false;foliage.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const dummy=new THREE.Object3D();
    const pal=pink?['#d995ac','#e7b2c7','#f3ccda','#f2e3b5']:
      ['#477f4e','#568e50','#6a9c59','#91b36b','#a3bf82'];
    for(let i=0;i<n;i++){
      const index=Math.floor(hash01(i,seed,8)*clusters.length);
      const [cx,cy,cz,r]=clusters[index];
      const u=hash01(i,seed,21),v=hash01(i,seed,33),w=hash01(i,seed,44);
      const ang=u*Math.PI*2,vertical=(v-.5)*Math.PI;
      const rad=r*(.70+w*.48);
      dummy.position.set(cx+Math.cos(ang)*Math.cos(vertical)*rad,
        cy+Math.sin(vertical)*rad*.71,cz+Math.sin(ang)*Math.cos(vertical)*rad);
      dummy.rotation.set(Math.sin(i*3)*.50,ang,Math.cos(i*2)*.58);
      dummy.scale.setScalar(.58+hash01(i,seed,98)*.58);dummy.updateMatrix();
      foliage.setMatrixAt(i,dummy.matrix);foliage.setColorAt(i,new THREE.Color(pal[Math.floor(hash01(i,seed,77)*pal.length)]));
    }
    foliage.instanceMatrix.needsUpdate=true;foliage.instanceColor.needsUpdate=true;t.add(foliage);
    return t;
  }
  function orchard(p,fruits){
    makeTree(p,0,0,.78,false,'orchard');
    for(let i=0;i<7;i++){
      const a=i*2*Math.PI/7;
      const f=ball(p,.055,[Math.cos(a)*.30,.99+Math.sin(i*2.3)*.21,Math.sin(a)*.30],
        i%3?M.blossom[0]:M.roofDark,1);
      f.scale.set(.86,1.02,.80);fruits.push(f);
    }
    box(p,[.32,.12,.22],[.37,.15,.43],M.wood);
    for(let i=0;i<5;i++)ball(p,.050,[.27+i*.045,.25,.43],M.blossom[0],0);
  }
  function garden(p){
    const ring=cyl(p,.45,.48,.09,[0,.075,0],M.wood,20);
    const soil=cyl(p,.42,.42,.015,[0,.128,0],M.soil,20);
    for(let i=0;i<9;i++){
      const a=i*Math.PI*2/9;
      const r=i%3===0?.12:.32;
      flower(p,Math.cos(a)*r,.15,Math.sin(a)*r,M.blossom[i%M.blossom.length]);
    }
    for(let i=0;i<4;i++)ball(p,.12,[(i-1.5)*.18,.10,i%2?.35:-.35],M.foliage[i%4],1);
  }
  function pond(p){
    cyl(p,.46,.47,.065,[0,.045,0],M.stone,24);
    const water=cyl(p,.409,.409,.021,[0,.089,0],M.water,32);water.castShadow=false;
    for(let i=0;i<16;i++){
      const a=i*Math.PI*2/16;
      const stone=ball(p,.080,[Math.sin(a)*.444,.086,Math.cos(a)*.444],i%3===0?M.stoneLight:M.stone,0);
      stone.scale.set(1.4,.50,.92);stone.rotation.y=a;
    }
    for(let i=0;i<4;i++){
      const a=i*Math.PI*2/4;
      const pad=part(p,new THREE.CircleGeometry(.094,18),M.foliage[i%4],
        [Math.cos(a)*.24,.110,Math.sin(a)*.23],[-Math.PI/2,0,0]);
      pad.castShadow=false;
      if(i===1)flower(p,Math.cos(a)*.24,.109,Math.sin(a)*.23,M.blossom[0]);
    }
  }
  function shoreline(scene,meadowBase,waterBase){
    const coast=new THREE.Group();scene.add(coast);
    const sand=part(coast,new THREE.RingGeometry(5.09,5.29,100),M.sand,[0,.105,0],[-Math.PI/2,0,0]);sand.castShadow=false;
    const surf=part(coast,new THREE.RingGeometry(5.20,5.37,100),M.water,[0,.024,0],[-Math.PI/2,0,0]);surf.castShadow=false;
    const foamMat=new THREE.MeshBasicMaterial({color:'#e8f6dd',transparent:true,opacity:.32,depthWrite:false,side:THREE.DoubleSide});
    const foam=part(coast,new THREE.RingGeometry(5.25,5.275,100),foamMat,[0,.039,0],[-Math.PI/2,0,0]);foam.castShadow=false;
    const grass=part(scene,new THREE.CircleGeometry(5.205,100),M.grass,[0,.177,0],[-Math.PI/2,0,0]);grass.castShadow=false;grass.receiveShadow=true;
    const stones=new THREE.Group();coast.add(stones);
    for(let i=0;i<75;i++){
      const a=hash01(i,201,1)*Math.PI*2,r=5.09+hash01(i,203,2)*.17;
      const pebble=ball(stones,.033+hash01(i,204)*.04,[Math.sin(a)*r,.114,Math.cos(a)*r],
        i%3===0?M.stoneLight:M.stone,0);
      pebble.scale.set(1.3,.45,.8);pebble.castShadow=false;
    }
    return {grass,coast,water:surf,foam,foamMat,animate(t){
      M.water.map.offset.x=t*.006;M.water.map.offset.y=t*.004;
      foamMat.opacity=.21+Math.sin(t*1.2)*.09;
    },scale(level){
      const s=[1,1.18,1.42][level];
      grass.scale.set(s,1,s);coast.scale.set(s,1,s);
    }};
  }
  function meadowDetails(parent){
    const g=new THREE.Group();parent.add(g);
    // Lightweight meadow edge: one instanced grass clump batch rather than
    // hundreds of draw calls. Decorative only; never touches the world rules.
    const shape=new THREE.BufferGeometry();
    shape.setAttribute('position',new THREE.Float32BufferAttribute([
      -.032,0,0,0,.16,0,.029,0,0,
      0,0,-.03,0,.13,0,0,0,.03
    ],3));shape.setIndex([0,1,2,3,4,5]);shape.computeVertexNormals();
    const mat=new THREE.MeshStandardMaterial({color:'#9bb66e',roughness:1,side:THREE.DoubleSide});
    const grass=new THREE.InstancedMesh(shape,mat,560),obj=new THREE.Object3D();
    for(let i=0;i<560;i++){
      const a=hash01(i,10)*Math.PI*2,r=4.25+hash01(i,11)*.81;
      obj.position.set(Math.sin(a)*r,.18,Math.cos(a)*r);
      obj.scale.setScalar(.65+hash01(i,13)*.85);obj.rotation.y=a;obj.updateMatrix();
      grass.setMatrixAt(i,obj.matrix);
      grass.setColorAt(i,new THREE.Color(i%4?'#79a466':'#b4c47e'));
    }
    grass.instanceMatrix.needsUpdate=true;grass.instanceColor.needsUpdate=true;grass.castShadow=false;
    g.add(grass);
    for(let i=0;i<24;i++){
      const a=hash01(i,134)*Math.PI*2,r=4.45+hash01(i,155)*.48;
      const p=new THREE.Group();p.position.set(Math.sin(a)*r,.178,Math.cos(a)*r);g.add(p);
      for(let j=0;j<3;j++)ball(p,.10,[Math.sin(j*2.09)*.08,.08,Math.cos(j*2.09)*.07],
        M.foliage[(i+j)%4],0).castShadow=false;
      if(i%4===0)flower(p,.06,.04,.07,M.blossom[i%3]);
    }
    return g;
  }
  return {M,part,box,ball,cyl,cone,beam,foundation,cottage,bakery,warehouse,windmill,well,
    makeTree,orchard,path,plot,garden,pond,shoreline,meadowDetails};
}

