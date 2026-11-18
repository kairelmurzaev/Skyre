import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DESK_CAMERA_BOUNDS,boundedDeskTarget,clampOrbitToDesk} from '../camera-bounds.js';

const fov=43*Math.PI/180;
test('unbounded pans are clamped to the tabletop, preserving access to its corners',()=>{
 const b=DESK_CAMERA_BOUNDS;
 const samples=[
  [{x:200,y:55,z:400},45,1.2],
  [{x:-150,y:-25,z:-260},15,.8],
  [{x:40,y:999,z:-40},1.35,1.49],
  [{x:0,y:0,z:0},36,.5]
 ];
 for(const [target,distance,polar] of samples){
  const c=boundedDeskTarget(target,distance,polar,fov);
  assert.ok(c.x>=b.minX&&c.x<=b.maxX,'x focus must remain over wood');
  assert.ok(c.z>=b.minZ&&c.z<=b.maxZ,'z focus must remain over wood');
  assert.ok(c.y>=b.minY&&c.y<=b.maxY,'vertical panning stays near the desk');
 }
 assert.equal(boundedDeskTarget({x:-100,y:0,z:0},15,1.2,fov).x,b.minX);
 assert.equal(boundedDeskTarget({x:100,y:0,z:0},15,1.2,fov).x,b.maxX);
 assert.equal(boundedDeskTarget({x:0,y:0,z:-100},15,1.2,fov).z,b.minZ);
 assert.equal(boundedDeskTarget({x:0,y:0,z:100},15,1.2,fov).z,b.maxZ);
});
test('close, shallow-angle zoom cannot move the wooden desk below the camera view',()=>{
 const distance=1.35,polar=1.49;
 const focus=boundedDeskTarget({x:0,y:50,z:0},distance,polar,fov);
 assert.ok(focus.y<-0.30,'camera should look down toward wood at very low angles');
 // At a point directly below the focus, desk top is within 86% of
 // the vertical half-FOV of the camera.
 const alpha=Math.PI/2-polar;
 const h=distance*Math.sin(polar),v=distance*Math.cos(polar)+focus.y-DESK_CAMERA_BOUNDS.deskY;
 const downward=Math.atan2(v,h);
 assert.ok(downward-alpha<=fov*.5*.86+1e-8);
 const wide=boundedDeskTarget({x:0,y:.90,z:0},38,.50,fov);
 assert.equal(wide.y,.90,'overhead viewing should still allow inspecting tall props');
});
test('constraining an OrbitControls camera translates eye and target together',()=>{
 const target={x:120,y:13,z:-90,set(x,y,z){this.x=x;this.y=y;this.z=z}};
 const position={x:136,y:25,z:-67};
 const before={x:position.x-target.x,y:position.y-target.y,z:position.z-target.z};
 const controls={target,getDistance:()=>35,getPolarAngle:()=>1.10};
 const camera={position,fov:43};
 assert.equal(clampOrbitToDesk(camera,controls),true);
 const after={x:position.x-target.x,y:position.y-target.y,z:position.z-target.z};
 for(const key of ['x','y','z'])assert.ok(Math.abs(after[key]-before[key])<1e-9,'camera orbit offset must stay unchanged: '+key);
 assert.equal(target.x,DESK_CAMERA_BOUNDS.maxX);
 assert.equal(target.z,DESK_CAMERA_BOUNDS.minZ);
 assert.equal(clampOrbitToDesk(camera,controls),false,'already bounded camera should not jitter');
});
test('camera presets and touch gestures are constrained every frame',async()=>{
 const scene=await readFile(new URL('../scene.js',import.meta.url),'utf8');
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 const server=await readFile(new URL('../server/http.js',import.meta.url),'utf8');
 const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
 assert.match(scene,/function focusDesk/);
 assert.match(scene,/function focusVillager/);
 assert.match(scene,/function setCamera/);
 assert.match(scene,/updateDeskCamera\(\);renderer\.render/);
 assert.match(scene,/clampOrbitToDesk\(camera,controls\)/);
 assert.match(scene,/controls\.enablePan=true/);
 assert.match(scene,/controls\.maxPolarAngle=1\.49/);
 assert.match(app,/window\.__skyreCameraState/);
 assert.match(server,/'camera-bounds\.js'/);
 assert.match(sw,/'\.\/camera-bounds\.js'/);
});


test('Node backend serves the camera rules module for embedded Telegram games',async()=>{
 const {createSkyreServer}=await import('../server/http.js');
 const {once}=await import('node:events');
 const server=createSkyreServer({store:null,botToken:'unused',publicDir:new URL('..',import.meta.url).pathname});
 server.listen(0,'127.0.0.1');
 await once(server,'listening');
 try{
   const response=await fetch('http://127.0.0.1:'+server.address().port+'/camera-bounds.js');
   assert.equal(response.status,200);
   assert.match(response.headers.get('content-type'),/javascript/);
   assert.match(await response.text(),/clampOrbitToDesk/);
 }finally{await new Promise(resolve=>server.close(resolve))}
});

