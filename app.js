import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const KEY='skyre-demo-v1';
const defaults={a:{name:'Amber Hollow',lamp:false,mirror:0,seeds:1},b:{name:'Moon Garden',lamp:false,mirror:0,seeds:1},events:[]};
let store;try{store=JSON.parse(localStorage.getItem(KEY))||structuredClone(defaults)}catch{store=structuredClone(defaults)}
for(const id of ['a','b'])store[id]={...defaults[id],...store[id]};
store.events=Array.isArray(store.events)?store.events:[];
let group='a';
const other=()=>group==='a'?'b':'a';
const save=()=>localStorage.setItem(KEY,JSON.stringify(store));
const $=id=>document.getElementById(id);
const scene=new THREE.Scene();scene.background=new THREE.Color('#17243e');
const camera=new THREE.PerspectiveCamera(42,1,.1,100);camera.position.set(6,4.7,8.5);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;$('scene').append(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(0,.5,0);controls.minDistance=4;controls.maxDistance=16;controls.maxPolarAngle=Math.PI*.49;
scene.add(new THREE.HemisphereLight('#c8deff','#473340',2.1));
const mainLight=new THREE.DirectionalLight('#ffe3bd',2.8);mainLight.position.set(-4,8,5);mainLight.castShadow=true;scene.add(mainLight);
const mat=(color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const make=(parent,geo,material,pos=[0,0,0],rotation=[0,0,0])=>{let mesh=new THREE.Mesh(geo,material);mesh.position.set(...pos);mesh.rotation.set(...rotation);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh};
make(scene,new THREE.BoxGeometry(12,.45,8),mat('#513c44'),[0,-.95,0]);
make(scene,new THREE.BoxGeometry(12,.04,8),mat('#7e6165'),[0,-.7,0]);
const globe=new THREE.Group();globe.position.set(.2,.92,0);scene.add(globe);
const glass=make(globe,new THREE.SphereGeometry(1.62,48,32),new THREE.MeshPhysicalMaterial({color:'#aedaff',transparent:true,opacity:.15,roughness:.08,metalness:.05,side:THREE.FrontSide,depthWrite:false,clearcoat:1}));
make(globe,new THREE.CylinderGeometry(.9,1,.25,48),mat('#b49a75',.3,.7),[0,-1.76,0]);
make(globe,new THREE.CylinderGeometry(.85,.88,.17,48),mat('#353849',.4,.4),[0,-1.59,0]);
const island=new THREE.Group();island.position.y=-.52;globe.add(island);
const ocean=make(island,new THREE.CylinderGeometry(1.16,1.09,.2,64),mat('#2b6390',.35),[0,-.15,0]);
const land=make(island,new THREE.SphereGeometry(1.01,36,20),mat('#5e978b'),[0,.02,0]);land.scale.y=.35;
make(island,new THREE.ConeGeometry(.48,.63,6),mat('#91a8a0'),[-.32,.36,-.23]);
make(island,new THREE.ConeGeometry(.34,.48,5),mat('#b0b7a5'),[.38,.25,-.34]);
make(island,new THREE.BoxGeometry(.3,.3,.3),mat('#e6bca5'),[.28,.34,.35]);
make(island,new THREE.ConeGeometry(.27,.25,4),mat('#a57486'),[.28,.62,.35],[0,Math.PI/4,0]);
const trees=new THREE.Group();island.add(trees);
const positions=[[-.55,.2,.1],[.59,.18,.05],[-.18,.18,.58],[.28,.17,-.58],[-.7,.12,-.28],[.63,.13,.43],[0,.17,-.75],[.1,.2,.63],[0,.28,0]];
for(let i=0;i<9;i++){const t=new THREE.Group();t.position.set(...positions[i]);make(t,new THREE.CylinderGeometry(.035,.048,.28,7),mat('#866455'),[0,.13,0]);make(t,new THREE.IcosahedronGeometry(.19,1),mat(i%2?'#6ea991':'#9cc7a2'),[0,.35,0]);t.userData.index=i;trees.add(t)}
const glow=new THREE.PointLight('#ffc47d',0,5);glow.position.set(-2.5,1.3,0);scene.add(glow);
const lamp=new THREE.Group();lamp.position.set(-2.7,0,-.4);scene.add(lamp);
make(lamp,new THREE.CylinderGeometry(.45,.5,.14,24),mat('#c3a174',.4,.6),[0,-.58,0]);
make(lamp,new THREE.CylinderGeometry(.055,.055,1.6,14),mat('#c3a174',.3,.7),[0,.23,0]);
make(lamp,new THREE.CylinderGeometry(.06,.06,.9,14),mat('#c3a174',.3,.7),[.33,1.12,0],[0,0,-.85]);
make(lamp,new THREE.ConeGeometry(.52,.65,28),mat('#cfb289',.4,.5),[.69,1.35,0],[0,0,-.3]);
const bulb=make(lamp,new THREE.SphereGeometry(.15,16,16),mat('#fff2b6'),[.82,1.03,0]);
const mirror=new THREE.Group();mirror.position.set(2.6,.1,-.2);scene.add(mirror);
make(mirror,new THREE.CylinderGeometry(.43,.45,.1,26),mat('#c0a273',.35,.7),[0,-.7,0]);
make(mirror,new THREE.CylinderGeometry(.045,.05,.98,12),mat('#c0a273',.3,.7),[0,-.2,0]);
const mirrorFace=make(mirror,new THREE.CylinderGeometry(.53,.53,.07,40),mat('#c6e7fa',.1,.7),[0,.34,0],[Math.PI/2,0,0]);
const beam=make(globe,new THREE.OctahedronGeometry(.18),new THREE.MeshStandardMaterial({color:'#b5f4ff',emissive:'#65e5ff',emissiveIntensity:2}),[.1,.8,-.2]);
const sun=make(globe,new THREE.SphereGeometry(.12,16,16),new THREE.MeshStandardMaterial({color:'#fff0c6',emissive:'#e7a25f',emissiveIntensity:2}),[.78,1,.1]);
function renderState(){const w=store[group],inside=store[other()],daylight=w.lamp;glass.material.color.set(daylight?'#d4efff':'#77a8e5');ocean.material.color.set(daylight?'#4b9fc3':'#28527d');land.material.color.set(daylight?'#7cba96':'#4b7d84');glow.intensity=daylight?5:0;bulb.material.emissive=new THREE.Color(daylight?'#ffbb65':'#000000');beam.visible=w.mirror===2;sun.material.emissiveIntensity=daylight?4:1;mirrorFace.rotation.z=w.mirror*.45;trees.children.forEach((t,i)=>t.visible=i<Math.min(9,inside.seeds+1));$('otherName').textContent=inside.name;$('skyState').textContent=daylight?'Sunrise':'Night';$('groupA').classList.toggle('selected',group==='a');$('groupB').classList.toggle('selected',group==='b');$('log').replaceChildren();(store.events.length?store.events.slice(-5).reverse():[{text:'No one has stirred the universe yet.'}]).forEach(e=>{const p=document.createElement('div');p.className='event';p.textContent=e.text;$('log').append(p)})}
function act(type){const w=store[group],target=store[other()];let text='';if(type==='lamp'){w.lamp=!w.lamp;text=group.toUpperCase()+' turned '+target.name+"'s sky "+(w.lamp?'to sunrise.':'to night.')}if(type==='mirror'){w.mirror=(w.mirror+1)%3;text=group.toUpperCase()+' rotated the mirror'+(w.mirror===2?'; a moonbeam found '+target.name+'.':'.')}if(type==='seed'){target.seeds=Math.min(9,target.seeds+1);text='A seed from group '+group.toUpperCase()+' grew in '+target.name+'.'}store.events.push({text});store.events=store.events.slice(-30);save();renderState()}
for(const type of ['lamp','mirror','seed'])$(type).addEventListener('click',()=>act(type));
for(const g of ['a','b'])$('group'+g.toUpperCase()).addEventListener('click',()=>{group=g;renderState()});
function resize(){let el=$('scene');renderer.setSize(el.clientWidth,el.clientHeight);camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix()}
addEventListener('resize',resize);resize();renderState();let time=0;renderer.setAnimationLoop(()=>{time+=.008;globe.rotation.y=Math.sin(time*.25)*.045;sun.position.y=1+Math.sin(time)*.06;controls.update();renderer.render(scene,camera)});
try{window.Telegram?.WebApp?.ready();window.Telegram?.WebApp?.expand()}catch{}
