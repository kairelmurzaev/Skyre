import * as THREE from 'three';
import {villagerDesign} from './character-design.js';

// Modular stylized figures based on the approved Skyre character concepts.
// Shared geometry/materials prevent the repeated 4-second scene refresh from
// allocating a new mesh resource for every face, sleeve and boot.
export function createCharacterFactory(){
  const geometry=new Map(),materials=new Map();
  const geometryFor=(type)=>{
    if(!geometry.has(type)){
      const g=type==='round' ? new THREE.SphereGeometry(1,12,9)
        : type==='block' ? new THREE.BoxGeometry(1,1,1)
        : type==='taper' ? new THREE.CylinderGeometry(.72,1,1,10)
        : type==='cone' ? new THREE.ConeGeometry(1,1,10)
        : type==='disc' ? new THREE.CylinderGeometry(1,1,1,12)
        : new THREE.CylinderGeometry(1,1,1,10);
      geometry.set(type,g);
    }
    return geometry.get(type);
  };
  const materialFor=(hex)=>{
    if(!materials.has(hex))materials.set(hex,new THREE.MeshStandardMaterial({color:hex,roughness:.89,metalness:0}));
    return materials.get(hex);
  };
  function part(parent,type,color,pos,scale,rotation){
    const m=new THREE.Mesh(geometryFor(type),materialFor(color));
    m.position.set(...pos);m.scale.set(...scale);
    if(rotation)m.rotation.set(...rotation);
    m.castShadow=false;m.receiveShadow=false;m.raycast=()=>{};
    parent.add(m);return m;
  }
  const sphere=(p,c,pos,size)=>part(p,'round',c,pos,size);
  const block=(p,c,pos,size)=>part(p,'block',c,pos,size);
  const disc=(p,c,pos,size)=>part(p,'disc',c,pos,size);
  function hat(head,outfit){
    const cloth=outfit.accent;
    if(outfit.hat==='straw'){
      disc(head,'#e5c688',[0,.321,0],[.24,.012,.24]);
      part(head,'taper','#d7b477',[0,.374,0],[.141,.095,.141]);
      disc(head,'#987953',[0,.337,0],[.15,.013,.15]);
    }else if(outfit.hat==='chef'){
      disc(head,'#f3e9d9',[0,.302,0],[.15,.042,.15]);
      for(const [x,z] of [[-.09,0],[.07,-.05],[.07,.065],[-.02,.05]])sphere(head,'#fff8ea',[x,.390,z],[.087,.085,.086]);
    }else if(outfit.hat==='cap'){
      sphere(head,cloth,[0,.306,-.01],[.167,.067,.17]);
      disc(head,cloth,[0,.273,.11],[.14,.012,.11]);
    }else if(outfit.hat==='kerchief'){
      sphere(head,'#b58378',[0,.297,-.012],[.159,.049,.153]);
      sphere(head,cloth,[0,.277,.127],[.11,.028,.03]);
      sphere(head,cloth,[.145,.18,-.052],[.034,.075,.038]);
    }
  }
  function hair(head,look){
    const shade=look.hair;
    sphere(head,shade,[0,.237,-.025],[.168,.075,.16]);
    sphere(head,shade,[-.134,.155,-.02],[.043,.10,.10]);
    sphere(head,shade,[.134,.15,-.02],[.045,.092,.098]);
    if(look.hairStyle==='braids'){
      for(const side of [-1,1]){
        sphere(head,shade,[side*.137,.028,-.035],[.053,.094,.06]);
        sphere(head,shade,[side*.14,-.047,-.03],[.041,.050,.04]);
      }
    }else if(look.hairStyle==='curly'){
      for(const [x,y,z] of [[-.12,.255,.05],[0,.27,.11],[.11,.25,.02],[-.16,.19,-.08],[.15,.20,-.07]])
        sphere(head,shade,[x,y,z],[.067,.063,.069]);
    }else if(look.hairStyle==='bob'){
      for(const x of [-.15,.15])sphere(head,shade,[x,.07,-.05],[.066,.14,.11]);
    }else if(look.hairStyle==='tousled'){
      for(const [x,z] of [[-.10,.04],[.01,.09],[.12,.01]])sphere(head,shade,[x,.29,z],[.076,.071,.071]);
    }else{
      sphere(head,shade,[.072,.274,.055],[.117,.056,.084]);
    }
  }
  function create(worker){
    const {look,outfit,index,job}=villagerDesign(worker);
    const root=new THREE.Group();root.userData.villagerId=worker.id;
    const skin=look.skin;
    // Boots, full separate legs, jacket, sleeves and hands are modeled as independent pieces.
    const legs=[];
    for(const side of [-1,1]){
      const pivot=new THREE.Group();pivot.position.set(side*.097,.31,0);root.add(pivot);
      disc(pivot,outfit.pants,[0,-.098,0],[.057,.123,.064]);
      sphere(pivot,'#674b3d',[0,-.25,.039],[.083,.064,.110]);
      block(pivot,'#9d7551',[0,-.208,.012],[.12,.025,.119]);
      legs.push(pivot);
    }
    const torso=new THREE.Group();torso.position.set(0,.35,0);root.add(torso);
    part(torso,'taper',outfit.shirt,[0,.137,0],[.177,.277,.142]);
    part(torso,'taper',outfit.vest,[0,.125,-.005],[.171,.236,.141]);
    if(look.clothing==='skirt')part(torso,'taper',outfit.pants,[0,-.064,0],[.206,.165,.195]);
    block(torso,'#7b5646',[0,-.009,.01],[.31,.032,.23]);
    block(torso,'#d8b67c',[0,-.009,.143],[.052,.039,.014]);
    // Shirt collar and tiny fastening buttons make the uniform readable up close.
    sphere(torso,outfit.shirt,[-.055,.25,.103],[.06,.032,.033]);
    sphere(torso,outfit.shirt,[.055,.25,.103],[.06,.032,.033]);
    if(outfit.apron){
      block(torso,outfit.accent,[0,.009,.152],[.215,.225,.026]);
      block(torso,outfit.accent,[0,.170,.149],[.146,.122,.028]);
      block(torso,'#dfc8a1',[0,.015,.176],[.095,.009,.005]);
    }else{
      for(let y of [.066,.141,.208])sphere(torso,'#e6d6b5',[0,y,.148],[.012,.012,.006]);
    }
    const arms=[];
    for(const side of [-1,1]){
      const pivot=new THREE.Group();pivot.position.set(side*.196,.249,0);torso.add(pivot);
      // Shoulder/sleeve, cuff and fingers are part of a real articulated arm.
      sphere(pivot,outfit.shirt,[side*.027,-.055,0],[.070,.111,.073]);
      disc(pivot,outfit.shirt,[side*.045,-.133,0],[.050,.051,.053]);
      sphere(pivot,skin,[side*.044,-.213,0],[.050,.063,.051]);
      arms.push(pivot);
    }
    const head=new THREE.Group();head.position.set(0,.297,0);torso.add(head);
    sphere(head,skin,[0,.105,0],[.171,.18,.161]);
    hair(head,look);
    for(const side of [-1,1]){
      sphere(head,skin,[side*.164,.107,-.004],[.035,.052,.041]);
      sphere(head,'#2c2c35',[side*.067,.12,.147],[.016,.023,.010]);
      sphere(head,'#fff9eb',[side*.061,.129,.155],[.005,.007,.005]);
      sphere(head,'#cf8f84',[side*.102,.066,.126],[.027,.012,.010]);
    }
    sphere(head,skin,[0,.068,.162],[.028,.029,.026]);
    sphere(head,'#9e6259',[0,.018,.144],[.033,.010,.006]);
    if(index===4){
      sphere(head,look.hair,[0,-.010,.10],[.090,.043,.086]);
    }
    hat(head,outfit);
    // A usable held prop: hidden until the villager is carrying a delivery.
    const parcel=new THREE.Group();root.add(parcel);
    parcel.position.set(.265,.33,.18);
    const cargo=job==='baker'?'#d99f74':job==='miller'?'#ddc99a':'#b48d68';
    block(parcel,cargo,[0,0,0],[.190,.155,.17]);
    block(parcel,'#f6dcaa',[0,.08,0],[.20,.019,.18]);
    const handle=part(parcel,'disc','#775941',[0,.143,0],[.092,.015,.082]);handle.rotation.z=.1;
    parcel.visible=false;
    // Every model uses the same neutral scale; outfits, not meshes, define jobs.
    root.scale.setScalar(1);
    return {root,legs,arms,head,torso,parcel,look,job};
  }
  function animate(rig,time,phase,{walking=false,carrying=false}={}){
    const gait=walking?1:.07;
    const step=Math.sin(time*7.2+phase)*gait;
    rig.legs[0].rotation.x=step*.62;
    rig.legs[1].rotation.x=-step*.62;
    rig.arms[0].rotation.x=-step*.38;
    rig.arms[1].rotation.x=carrying?-.36:step*.38;
    rig.torso.rotation.z=Math.sin(time*2.3+phase)*.021;
    rig.head.rotation.y=Math.sin(time*.79+phase)*.16;
    rig.head.rotation.z=Math.sin(time*.55+phase)*.035;
    rig.parcel.visible=carrying;
  }
  function dispose(){
    for(const g of geometry.values())g.dispose();
    for(const m of materials.values())m.dispose();
    geometry.clear();materials.clear();
  }
  return {create,animate,dispose};
}
