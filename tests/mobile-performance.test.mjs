import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const scene=await readFile(new URL('../scene.js',import.meta.url),'utf8');

test('phone scene preserves detail while capping high-refresh rendering',()=>{
  assert.match(scene,/matchMedia\?\.\('\(pointer: coarse\)'\)/);
  assert.match(scene,/setPixelRatio\(Math\.min\(window\.devicePixelRatio\|\|1,1\.5\)\)/);
  assert.match(scene,/sun\.shadow\.mapSize\.set\(1024,1024\)/);
  assert.match(scene,/renderer\.shadowMap\.type=THREE\.PCFSoftShadowMap/);
  assert.match(scene,/mobileGraphics\?1000\/60:0/);
});

test('render throttling does not stop simulation time or camera bounds',()=>{
  assert.match(scene,/function tick\(frameTime\)/);
  assert.match(scene,/frameTime-lastRenderAt<minFrameMs-1\)return/);
  assert.match(scene,/const t=clock\.getElapsedTime\(\)/);
  assert.match(scene,/updateDeskCamera\(\);renderer\.render\(scene,camera\)/);
});

test('background scenes stop and visibility resumes without creating duplicate loops',()=>{
  assert.match(scene,/if\(sceneDisposed\|\|document\.hidden\)return/);
  assert.match(scene,/cancelAnimationFrame\(frameId\);frameId=0/);
  assert.match(scene,/lastRenderAt=0;[\s\S]*?frameId=requestAnimationFrame\(tick\)/);
  assert.match(scene,/document\.addEventListener\('visibilitychange',onVisibilityChange\)/);
  assert.match(scene,/document\.removeEventListener\('visibilitychange',onVisibilityChange\)/);
});
