import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createWorldArt} from './world-art.js';

const el=document.getElementById('showcase');
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.28;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
el.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#cad7d5');
scene.fog=new THREE.Fog('#cad7d5',18,30);
const camera=new THREE.PerspectiveCamera(42,1,.1,70);
camera.position.set(5.7,5.2,9.8);
const orbit=new OrbitControls(camera,renderer.domElement);
orbit.target.set(0,.60,.5);orbit.enableDamping=true;orbit.maxPolarAngle=1.48;
orbit.maxDistance=20;orbit.minDistance=3;orbit.enablePan=false;orbit.update();
scene.add(new THREE.HemisphereLight('#fff3d6','#819b8b',2.1));
const sun=new THREE.DirectionalLight('#ffeac4',3.0);sun.position.set(-4,9,7);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-9;sun.shadow.camera.right=9;sun.shadow.camera.top=9;sun.shadow.camera.bottom=-9;
scene.add(sun);
const art=createWorldArt();
const platform=art.box(scene,[8.0,.5,6.3],[0,-.34,.70],art.M.stone);
platform.castShadow=true;
const lawn=art.box(scene,[7.8,.1,6.1],[0,-.05,.70],art.M.grass);
lawn.castShadow=false;lawn.receiveShadow=true;
const positions=[
 ['COTTAGE',-2.15,.04,-1.08,(g)=>art.cottage(g,()=>{},2)],
 ['BAKERY',0,.04,-1.08,(g)=>art.bakery(g,()=>{})],
 ['STOREHOUSE',2.15,.04,-1.08,(g)=>art.warehouse(g)],
 ['WINDMILL',-2.15,.04,2.0,(g)=>art.windmill(g,[])],
 ['WELL',0,.04,2.0,(g)=>art.well(g)],
 ['ORCHARD',2.15,.04,2.0,(g)=>art.orchard(g,[])]
];
for(const [name,x,y,z,draw] of positions){
 const g=new THREE.Group();g.position.set(x,y,z);scene.add(g);draw(g);
 const info=document.createElement('div');info.className='asset-label';
 info.textContent=name;document.querySelector('.asset-names').append(info);
}
art.makeTree(scene,-3.25,-2.28,.88,false);
art.makeTree(scene,3.1,-2.26,.76,true);
art.makeTree(scene,3.35,2.78,.88,false);
for(let i=0;i<6;i++){
 const p=new THREE.Group();p.position.set((i%3-1)*1.1,.025,-.05+Math.floor(i/3)*.63);
 scene.add(p);art.path(p,i*29);
}
const flowers=new THREE.Group();flowers.position.set(-.95,.024,2.00);scene.add(flowers);art.garden(flowers);
const pond=new THREE.Group();pond.position.set(.95,.024,2.00);scene.add(pond);art.pond(pond);
// Small textured prop stills give each building a readable environment.
const resize=()=>{
 const w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight);
 renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
};
new ResizeObserver(resize).observe(el);resize();
const clock=new THREE.Clock();
let running=true;
const loop=()=>{
 if(!running)return;
 const t=clock.getElapsedTime();art.M.water.map.offset.set(t*.004,t*.003);
 orbit.update();renderer.render(scene,camera);requestAnimationFrame(loop);
};
loop();
window.__skyreShowcase={scene,camera,renderer,ready:true};

