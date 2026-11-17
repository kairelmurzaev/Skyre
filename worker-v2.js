import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// This is the last approved Skyre General Worker v2 study, not a new design.
// The real 23-joint, textured model is committed as gzip-compressed base64
// pieces so it can travel in the existing static/Netlify deployment. Future
// Blender GLBs can replace this loader without changing village save data.
export const WORKER_V2_PARTS=Object.freeze(Array.from(
  {length:10},(_,i)=>'./assets/characters/worker-v2/part-'+String(i).padStart(2,'0')+'.b64'
));
export const WORKER_V2_COMPRESSED_BYTES=455725;
export const WORKER_V2_GL_BYTES=854596;
export const WORKER_V2_ANIMATIONS=Object.freeze(['Idle','Walk','Work','PickUp','UseItem']);

export function decodeWorkerV2Parts(parts,decode=atob){
  if(!Array.isArray(parts)||parts.length!==WORKER_V2_PARTS.length)
    throw new Error('Skyre Worker v2 is missing asset parts.');
  const text=parts.map((part,i)=>{
    const p=part.trim();
    if(!/^[A-Za-z0-9+/]+={0,2}$/.test(p))throw new Error('Invalid worker-v2 part '+i);
    if(i<parts.length-1&&p.includes('='))throw new Error('Unexpected padding in worker-v2 part '+i);
    return p;
  }).join('');
  const binary=decode(text),bytes=new Uint8Array(binary.length);
  for(let i=0;i<bytes.length;i++)bytes[i]=binary.charCodeAt(i);
  if(bytes.length!==WORKER_V2_COMPRESSED_BYTES||bytes[0]!==31||bytes[1]!==139)
    throw new Error('Skyre Worker v2 model archive failed integrity checks.');
  return bytes;
}
export async function loadWorkerV2(){
  if(typeof DecompressionStream!=='function')
    throw new Error('This browser cannot unzip the Skyre Worker v2 model.');
  const parts=await Promise.all(WORKER_V2_PARTS.map(async path=>{
    const response=await fetch(path,{cache:'force-cache'});
    if(!response.ok)throw new Error('Missing worker-v2 model part '+path);
    return response.text();
  }));
  const compressed=decodeWorkerV2Parts(parts);
  const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  const bytes=await new Response(stream).arrayBuffer();
  if(bytes.byteLength!==WORKER_V2_GL_BYTES)throw new Error('Unexpected worker-v2 GLB length.');
  const sig=new Uint8Array(bytes,0,4);
  if(sig[0]!==103||sig[1]!==108||sig[2]!==84||sig[3]!==70)
    throw new Error('Skyre Worker v2 is not a GLB.');
  const asset=await new Promise((resolve,reject)=>new GLTFLoader().parse(bytes,'',resolve,reject));
  let skins=0,bones=0;
  asset.scene.traverse(obj=>{if(obj.isSkinnedMesh)skins++;if(obj.isBone)bones++;});
  const clips=new Set(asset.animations.map(a=>a.name));
  if(skins<5||bones<23||!WORKER_V2_ANIMATIONS.every(name=>clips.has(name)))
    throw new Error('Skyre Worker v2 is missing its humanoid rig or animation clips.');
  return asset;
}

// Role variants preserve the user's approved mesh and rigs. Only the colored
// knitted scarf is changed for non-general-worker jobs; actual replacement
// bodies, outfits and face sculpts will be authored later in Blender.
export const WORKER_V2_SCARF_COLORS=Object.freeze({
  idle:null, farmer:null, forager:'#8c9977',hauler:'#b19a69',
  miller:'#d5be94',baker:'#a65e67'
});

