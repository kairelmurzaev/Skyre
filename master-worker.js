import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Optional Blender master-worker study. Existing v0.9 villagers stay the default.
// Six small base64 files hold one gzip-compressed, skinned glTF model.
export const MASTER_WORKER_PARTS=Object.freeze(Array.from({length:6},(_,i)=>'./assets/characters/master-worker/part-'+String(i).padStart(2,'0')+'.b64'));
export const MASTER_WORKER_GZIP_BYTES=425766;
export function decodeBase64Parts(parts,decode=atob){
  if(!Array.isArray(parts)||parts.length!==MASTER_WORKER_PARTS.length)throw Error('Missing master character asset part');
  const text=parts.map((s,i)=>{
    if(typeof s!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(s.trim()))throw Error('Corrupt master character part '+i);
    if(i<parts.length-1&&s.includes('='))throw Error('Master worker part ended too early');
    return s.trim();
  }).join('');
  const raw=decode(text),bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  if(bytes.length!==MASTER_WORKER_GZIP_BYTES||bytes[0]!==31||bytes[1]!==139)throw Error('Master worker archive did not pass its size/header check');
  return bytes;
}
export async function loadMasterWorker(){
  const parts=await Promise.all(MASTER_WORKER_PARTS.map(async path=>{
    const response=await fetch(path,{cache:'force-cache'});
    if(!response.ok)throw Error('Missing master character part '+path);
    return response.text();
  }));
  const zipped=decodeBase64Parts(parts);
  if(typeof DecompressionStream!=='function')throw Error('Optional character preview requires modern browser decompression support');
  const stream=new Blob([zipped]).stream().pipeThrough(new DecompressionStream('gzip'));
  const bytes=await new Response(stream).arrayBuffer();
  const head=new Uint8Array(bytes,0,4);
  if(head[0]!==103||head[1]!==108||head[2]!==84||head[3]!==70)throw Error('Invalid master-worker GLB file');
  const asset=await new Promise((resolve,reject)=>new GLTFLoader().parse(bytes,'',resolve,reject));
  let skinned=0,bones=0;
  asset.scene.traverse(o=>{if(o.isBone)bones++;if(o.isSkinnedMesh)skinned++;});
  if(bones<16||skinned<1)throw Error('The master worker skeleton is incomplete');
  return asset;
}
const times=[0,.25,.5,.75,1];
function motion(bone,name,t){
  const wave=Math.sin(t*Math.PI*2);
  let x=0,y=0,z=0;
  if(bone==='Spine')x=name==='Work'?.11+.045*wave:.016*wave;
  if(bone==='Head')z=.043*wave;
  const s=bone.endsWith('.L')?1:-1;
  if(bone.startsWith('Thigh.')&&(name==='Walk'||name==='Carry'))x=s*wave*(name==='Walk'?.36:.24);
  if(bone.startsWith('Shin.')&&(name==='Walk'||name==='Carry'))x=Math.max(0,-s*wave)*.5;
  if(bone.startsWith('UpperArm.')){
    if(name==='Walk')x=-s*wave*.22;
    if(name==='Carry')x=-.4;
    if(name==='Work'&&s===-1)x=-.45+.3*wave;
    if(name==='Wave'&&s===-1){x=-.28;y=-1.2;}
  }
  if(bone.startsWith('Forearm.')){
    if(name==='Carry')x=-.55;
    if(name==='Work'&&s===-1)x=-.75+.24*wave;
    if(name==='Wave'&&s===-1)z=-.65+.25*wave;
  }
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z)).toArray();
}
export function masterWorkerClips(){
  const bones=['Spine','Head','UpperArm.L','UpperArm.R','Forearm.L','Forearm.R','Thigh.L','Thigh.R','Shin.L','Shin.R'];
  return ['Idle','Walk','Carry','Work','Wave'].map(name=>{
    const tracks=bones.map(bone=>new THREE.QuaternionKeyframeTrack(bone+'.quaternion',times,times.flatMap(t=>motion(bone,name,t))));
    const clip=new THREE.AnimationClip(name,1,tracks);clip.optimize();return clip;
  });
}
