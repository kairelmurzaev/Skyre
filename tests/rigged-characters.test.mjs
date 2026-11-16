import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSkyreServer} from '../server/http.js';

const filepath=new URL('../assets/characters/skyre-villager.glb',import.meta.url);
const bytes=await readFile(filepath);
function parseGlb(buffer){
  assert.equal(buffer.toString('utf8',0,4),'glTF');
  assert.equal(buffer.readUInt32LE(4),2);
  assert.equal(buffer.readUInt32LE(8),buffer.length);
  let off=12,json=null,bin=null;
  while(off<buffer.length){
    const n=buffer.readUInt32LE(off),kind=buffer.toString('utf8',off+4,off+8);off+=8;
    assert.ok(n>0&&off+n<=buffer.length,'Valid glTF chunk boundaries');
    if(kind==='JSON')json=JSON.parse(buffer.toString('utf8',off,off+n));
    if(kind==='BIN\u0000')bin=buffer.subarray(off,off+n);
    off+=n;
  }
  assert.ok(json&&bin,'embedded JSON and binary');
  assert.equal(json.buffers[0].byteLength<=bin.length,true);
  return {json,bin};
}
const {json,bin}=parseGlb(bytes);
function readAccessor(id){
  const a=json.accessors[id],v=json.bufferViews[a.bufferView];
  const sizes={5126:4,5125:4,5123:2,5121:1,5120:1};const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
  const width=components[a.type],size=sizes[a.componentType];assert.ok(width&&size);
  const stride=v.byteStride||width*size,base=v.byteOffset+(a.byteOffset||0);
  assert.ok(base>=0&&base+(a.count-1)*stride+width*size<=bin.length);
  return Array.from({length:a.count},(_,i)=>Array.from({length:width},(_,j)=>{
    const p=base+i*stride+j*size;
    const raw=a.componentType===5126?bin.readFloatLE(p):a.componentType===5125?bin.readUInt32LE(p):a.componentType===5123?bin.readUInt16LE(p):a.componentType===5120?bin.readInt8(p):bin.readUInt8(p);
    if(!a.normalized)return raw;
    return a.componentType===5121?raw/255:a.componentType===5120?Math.max(raw/127,-1):raw/65535;
  }));
}
test('portable glTF has a hierarchy of real joint bones and weighted skinned meshes',()=>{
  const skin=json.skins[0];
  assert.ok(skin.joints.length>=15);
  assert.equal(readAccessor(skin.inverseBindMatrices).length,skin.joints.length);
  const names=new Set(skin.joints.map(i=>json.nodes[i].name));
  for(const required of ['Hips','Spine','Chest','Neck','Head','Arm_L','Elbow_L','Hand_L','Arm_R','Elbow_R','Hand_R','Thigh_L','Knee_L','Foot_L','Thigh_R','Knee_R','Foot_R'])assert.ok(names.has(required),required);
  const skinnedNodes=json.nodes.filter(n=>n.skin===0&&Number.isInteger(n.mesh));
  assert.ok(skinnedNodes.length>=20);
  let totalVertices=0;
  for(const node of skinnedNodes){
    const p=json.meshes[node.mesh].primitives[0];
    for(const attr of ['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0'])assert.ok(Number.isInteger(p.attributes[attr]),attr);
    assert.ok(p.indices>=0);
    const joints=readAccessor(p.attributes.JOINTS_0),weights=readAccessor(p.attributes.WEIGHTS_0);
    assert.equal(joints.length,weights.length);
    totalVertices+=joints.length;
    for(let i=0;i<weights.length;i++){
      assert.ok(Math.abs(weights[i].reduce((a,b)=>a+b,0)-1)<.0001,'normalized vertex weights');
      assert.ok(joints[i].every(k=>k<skin.joints.length),'valid joint index');
    }
  }
  assert.ok(totalVertices>=12000,'detailed mesh, not placeholder boxes');
});
test('five baked animation clips drive bone rotations and loop seamlessly',()=>{
  assert.deepEqual(new Set(json.animations.map(a=>a.name)),new Set(['Idle','Walk','Carry','Work','Wave']));
  for(const clip of json.animations){
    assert.ok(clip.channels.length>=3);
    for(const channel of clip.channels){
      assert.equal(channel.target.path,'rotation');
      const sampler=clip.samplers[channel.sampler],time=readAccessor(sampler.input),quat=readAccessor(sampler.output);
      assert.equal(quat.length,time.length);
      assert.ok(time.at(-1)[0]>=.8&&time.at(-1)[0]<=2.5);
      assert.ok(time.every((t,i)=>i===0||t[0]>time[i-1][0]));
      assert.ok(quat.every(q=>Math.abs(Math.hypot(...q)-1)<.001));
      quat[0].forEach((v,i)=>assert.ok(Math.abs(v-quat.at(-1)[i])<.001,'seamless loop'));
    }
  }
});
test('asset contains job costumes, distinct hair meshes, and original embedded painted textures',()=>{
  const meshNames=json.nodes.filter(n=>Number.isInteger(n.mesh)).map(n=>n.name);
  for(const name of ['Hair_braids','Hair_curly','Hair_bob','Hat_chef','Hat_straw','Hat_cap','Apron','CargoBasket'])
    assert.ok(meshNames.some(n=>n.startsWith(name+'__')),name);
  assert.ok(json.images.length>=4);
  for(const image of json.images){
    assert.equal(image.mimeType,'image/png');
    const v=json.bufferViews[image.bufferView];
    assert.equal(bin.subarray(v.byteOffset,v.byteOffset+8).toString('hex'),'89504e470d0a1a0a');
  }
  assert.ok(bytes.length<3_000_000,'download should remain reasonable on phones');
});
test('backend serves the exact model and loader without exposing source tools',async t=>{
  const server=createSkyreServer({store:{},botToken:'unused',publicDir:new URL('..',import.meta.url).pathname});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const [model,loader,tool]=await Promise.all([
    fetch(base+'/assets/characters/skyre-villager.glb'),fetch(base+'/rigged-characters.js'),fetch(base+'/tools/build_villager.py')
  ]);
  assert.equal(model.status,200);
  assert.match(model.headers.get('content-type'),/model\/gltf-binary/);
  assert.equal((await model.arrayBuffer()).byteLength,bytes.length);
  assert.equal(loader.status,200);
  assert.equal(tool.status,404);
});
