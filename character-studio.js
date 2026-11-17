import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createRiggedCharacterFactory} from './rigged-characters.js';
import {LOOKS,villagerDesign} from './character-design.js';

const $=id=>document.getElementById(id);
const stage=$('stage');
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#294957');
const camera=new THREE.PerspectiveCamera(36,1,.05,50);camera.position.set(1.35,1.50,2.25);
const controls=new OrbitControls(camera,renderer.domElement);
controls.target.set(0,.63,0);controls.enableDamping=true;controls.minDistance=1.3;controls.maxDistance=7;
controls.maxPolarAngle=Math.PI/2-.03;
scene.add(new THREE.HemisphereLight('#dbf1ff','#56706e',2.3));
const key=new THREE.DirectionalLight('#ffdfb7',3.1);key.position.set(-3,7,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);
const fill=new THREE.DirectionalLight('#bcdbee',1.0);fill.position.set(3,3,-4);scene.add(fill);
const floor=new THREE.Mesh(new THREE.CylinderGeometry(1.27,1.36,.18,64),new THREE.MeshStandardMaterial({color:'#8daf91',roughness:1}));
floor.position.y=-.16;floor.receiveShadow=true;scene.add(floor);
const masterSelected=new URLSearchParams(location.search).get('hero')==='1';
const toggle=$('hero-link');
toggle.textContent=masterSelected?'Return to Worker v2':'Compare older Blender character prototype';
toggle.href=masterSelected?'./character-studio.html':'?hero=1';
const factory=createRiggedCharacterFactory({previewMaster:masterSelected});let rig=null;
const looks=Array.from({length:LOOKS.length},(_,i)=>{
  for(let n=0;n<500;n++){
    const id='preview-villager-'+n;
    if(villagerDesign({id,job:'idle'}).index===i)return id;
  }
  return 'preview-villager-'+i;
});
for(let i=0;i<LOOKS.length;i++){
  const option=document.createElement('option');option.value=String(i);
  option.textContent=`${i+1} · ${LOOKS[i].hairStyle} hair`; $('look').append(option);
}
async function refreshCharacter(){
  if(!factory.assetLoaded)return;
  if(rig){scene.remove(rig.root);factory.release(rig);}
  const worker={id:looks[Number($('look').value)||0],job:$('job').value};
  rig=factory.create(worker);scene.add(rig.root);
  $('status').textContent=`${villagerDesign(worker).outfit.name} · ${$('animation').value} · ${rig.root.userData.characterStyle==='skyre-worker-v2'?'General Worker v2 (temporary)':rig.root.userData.characterStyle==='master-worker-preview'?'Older Blender prototype':'Original villager fallback'}`;
}
for(const id of ['look','job'])$(id).addEventListener('change',refreshCharacter);
$('animation').addEventListener('change',()=>{$('status').textContent=$('animation').value+' animation';});
$('fullscreen').addEventListener('click',()=>{
  if(document.fullscreenElement)document.exitFullscreen();
  else stage.requestFullscreen?.().catch(()=>{});
});
factory.ready.then(ok=>{
  if(ok)refreshCharacter();
  else $('status').textContent='Could not load the 3D character asset. Check your network.';
});
let last=performance.now();
const resize=()=>{const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
const ro=new ResizeObserver(resize);ro.observe(stage);resize();
function tick(t){
  requestAnimationFrame(tick);
  const dt=Math.min(.075,(t-last)/1000);last=t;
  if(rig){const animation=$('animation').value;factory.animate(rig,t/1000,.2,{animation});}
  controls.update();renderer.render(scene,camera);
}requestAnimationFrame(tick);
