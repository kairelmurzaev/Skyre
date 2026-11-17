import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {once} from 'node:events';
import {createSkyreServer} from '../server/http.js';

const root=new URL('..',import.meta.url);
const fragment=(i)=>new URL('./assets/characters/worker-v2/part-'+String(i).padStart(2,'0')+'.b64',root);

test('the shipped Worker v2 archive restores the actual textured, skinned model',async()=>{
 const parts=await Promise.all(Array.from({length:10},(_,i)=>readFile(fragment(i),'utf8')));
 for(const part of parts)assert.match(part,/^[A-Za-z0-9+/]+=*\s*$/);
 assert.ok(parts.slice(0,-1).every(s=>!s.includes('=')));
 const archive=Buffer.from(parts.map(x=>x.trim()).join(''),'base64');
 assert.equal(archive.length,455725,'expected Worker v2 archive must ship completely');
 const bytes=gunzipSync(archive);
 assert.equal(bytes.length,854596,'optimized GLB size should stay exact');
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 assert.equal(bytes.readUInt32LE(4),2);
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 const headerLength=bytes.readUInt32LE(12);
 const json=JSON.parse(bytes.toString('utf8',20,20+headerLength));
 assert.ok(json.skins?.some(s=>s.joints.length===23),'must include a real 23-joint humanoid skin');
 assert.deepEqual(new Set(json.animations.map(a=>a.name)),
   new Set(['Idle','Walk','Work','PickUp','UseItem']));
 const nodeMeshes=json.nodes.filter(n=>Number.isInteger(n.skin)&&Number.isInteger(n.mesh));
 assert.ok(nodeMeshes.length>=10,'actual skinned clothing/hair, not empty model');
 assert.ok(json.materials.length>=10,'multiple authored cloth/skin/hair materials');
 assert.ok(json.images?.length>=3,'embedded painted texture maps');
});
test('game and Character Studio both load Worker v2 by default with rigged fallback',async()=>{
 const source=await readFile(new URL('../rigged-characters.js',import.meta.url),'utf8');
 const studio=await readFile(new URL('../character-studio.js',import.meta.url),'utf8');
 const scene=await readFile(new URL('../scene.js',import.meta.url),'utf8');
 assert.match(source,/if\(workerV2Asset\)return makeWorkerV2Rig\(worker\)/);
 assert.match(source,/if\(!asset\)\{const rig=fallback\.create\(worker\)/);
 assert.match(source,/cloneSkeleton\(workerV2Asset\.scene\)/);
 assert.match(source,/assetRole:'worker-v2'/);
 assert.match(scene,/createRiggedCharacterFactory/);
 assert.match(studio,/General Worker v2 \(temporary\)/);
});
test('optional server serves all ten Worker v2 model pieces and loader',async()=>{
 const srv=createSkyreServer({store:null,botToken:'test-unused',publicDir:new URL('..',import.meta.url).pathname});
 srv.listen(0,'127.0.0.1');await once(srv,'listening');
 try{
  const base='http://127.0.0.1:'+srv.address().port;
  const [loader,first,last]=await Promise.all([fetch(base+'/worker-v2.js'),
   fetch(base+'/assets/characters/worker-v2/part-00.b64'),
   fetch(base+'/assets/characters/worker-v2/part-09.b64')]);
  for(const r of [loader,first,last])assert.equal(r.status,200);
  assert.ok((await first.text()).length>65000);
  assert.ok((await last.text()).length>10000);
 }finally{await new Promise(resolve=>srv.close(resolve));}
});

