import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';

const directory=resolve(import.meta.dirname,'../assets/characters/master-worker');
const paths=Array.from({length:6},(_,i)=>resolve(directory,'part-'+String(i).padStart(2,'0')+'.b64'));

test('experimental master worker remains opt-in with the original character fallback',async()=>{
  const source=await readFile(resolve(import.meta.dirname,'../rigged-characters.js'),'utf8');
  assert.match(source,/previewMaster=false/);
  assert.match(source,/villagerDesign\(worker\)\.job==='idle'/);
  assert.match(source,/makeRig\(worker\)/);
});

test('optional model archive restores a valid skinned glTF without studio geometry',async()=>{
  for(const p of paths)await access(p);
  const parts=await Promise.all(paths.map(p=>readFile(p,'utf8')));
  assert.ok(parts.slice(0,-1).every(p=>!p.includes('=')),'intermediate parts should be aligned for concatenation');
  const gzip=Buffer.from(parts.map(p=>p.trim()).join(''),'base64');
  assert.equal(gzip.length,425766);
  const glb=gunzipSync(gzip);
  assert.equal(glb.toString('ascii',0,4),'glTF');
  assert.equal(glb.readUInt32LE(8),glb.length);
  const jsonLength=glb.readUInt32LE(12);
  const json=JSON.parse(glb.toString('utf8',20,20+jsonLength));
  assert.ok(json.skins?.length>0,'missing skeleton');
  assert.ok(json.nodes.some(n=>n.name==='HERO_Armature'));
  assert.ok(json.meshes.length>20,'unexpected empty character');
  const roots=json.scenes[json.scene||0].nodes.map(i=>json.nodes[i].name);
  assert.deepEqual(roots,['HERO_Armature']);
});
