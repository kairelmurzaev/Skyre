import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {once} from 'node:events';
import {createSkyreServer} from '../server/http.js';

const root=new URL('../',import.meta.url);
const load=async path=>readFile(new URL(path,root),'utf8');
test('mobile shell is the first game screen and exposes real game action panels',async()=>{
  const html=await load('index.html');
  const shell=await load('game-shell.js');
  const css=await load('game-shell.css');
  assert.match(html,/<body class="skyre-app">/);
  assert.match(html,/id="skyre-launch"/);
  assert.match(html,/id="launch-enter"/);
  assert.match(html,/id="skyre-hud"/);
  assert.match(html,/id="skyre-drawer-head"/);
  assert.match(html,/game-shell\.js/);
  assert.ok(html.indexOf('src="./game-shell.js"')<html.indexOf('src="./app.js"'),'shell must listen for readiness before game initializes');
  for(const mode of ['build','farm','landscape','people','land','inventory','production','move','goals'])
    assert.match(shell,new RegExp("'"+mode+"':\\s*\\{"),'mode '+mode+' must be routed');
  assert.match(shell,/document\.querySelector\('\.tabs \[data-mode/);
  assert.match(shell,/button\.click\(\); \/\/ Existing game handler confirms/);
  assert.match(css,/height:100dvh/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.match(css,/\.skyre-open-panel/);
  assert.match(css,/skyre-loading\.avif/);
});
test('splash art, home-screen icons, and manifest are valid, accessible app assets',async()=>{
 const manifest=JSON.parse(await load('manifest.webmanifest'));
 assert.equal(manifest.short_name,'Skyre');
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.start_url,'./index.html');
 assert.ok(manifest.icons.some(x=>x.sizes==='192x192'));
 assert.ok(manifest.icons.some(x=>x.sizes==='512x512'));
 for(const file of ['assets/ui/skyre-loading.avif','assets/ui/skyre-loading.webp','assets/ui/skyre-loading-portrait.avif',
  'assets/ui/skyre-icon-180.png','assets/ui/skyre-icon-192.png','assets/ui/skyre-icon-512.png']){
  const s=await stat(new URL(file,root));
  assert.ok(s.size>5000,file+' must be an actual nonempty asset');
 }
});
test('main app sends a ready signal but does not change save keys or workers',async()=>{
 const app=await load('app.js');
 const core=await load('core.js');
 const rig=await load('rigged-characters.js');
 assert.match(app,/dispatchEvent\(new CustomEvent\('skyre:ready'/);
 assert.match(core,/skyre-village-v1/);
 assert.match(rig,/workerV2Asset/);
 assert.match(app,/saveGame\(localStorage,game\)/);
});
test('optional Node server serves the shell, approved splash and manifest',async()=>{
 const srv=createSkyreServer({store:null,botToken:'test-not-active',publicDir:new URL('..',import.meta.url).pathname});
 srv.listen(0,'127.0.0.1');await once(srv,'listening');
 try{
  const origin='http://127.0.0.1:'+srv.address().port;
  for(const [path,type] of [
   ['/','text/html'],['/game-shell.css','text/css'],['/game-shell.js','text/javascript'],
   ['/sw.js','text/javascript'],['/manifest.webmanifest','application/manifest+json'],
   ['/assets/ui/skyre-loading.avif','image/avif'],['/assets/ui/skyre-loading-portrait.avif','image/avif'],
   ['/assets/ui/skyre-loading.webp','image/webp'],
   ['/assets/ui/skyre-icon-192.png','image/png']
  ]){
   const res=await fetch(origin+path);
   assert.equal(res.status,200,path+' must load');
   assert.ok(res.headers.get('content-type').includes(type),path+' must have correct MIME');
   assert.ok((await res.arrayBuffer()).byteLength>100);
  }
  const bad=await fetch(origin+'/.pwa-icons.py');assert.equal(bad.status,404);
 }finally{await new Promise(resolve=>srv.close(resolve));}
});

