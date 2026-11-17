import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createSkyreServer} from '../server/http.js';

// The optional Node/Telegram deployment explicitly allowlists static files.
// A missing art module would break the game even when Netlify mode works.
test('World Remaster JS, HTML and materials are served by the optional backend',async()=>{
  const server=createSkyreServer({
    publicDir:new URL('..',import.meta.url).pathname,
    store:null,
    botToken:'test-not-live',
  });
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  try{
    const port=server.address().port,base='http://127.0.0.1:'+port;
    for(const [file,type] of [
      ['/world-materials.js','text/javascript'],
      ['/world-art.js','text/javascript'],
      ['/world-showcase.js','text/javascript'],
      ['/world-showcase.html','text/html'],
      ['/scene.js','text/javascript']
    ]){
      const r=await fetch(base+file);
      assert.equal(r.status,200,file+' must resolve');
      assert.ok(r.headers.get('content-type').includes(type));
      assert.ok((await r.text()).length>150,file+' must have content');
    }
    for(const file of ['/.env','/docs/WORLD-REMASTER.md','/.git/config']){
      const r=await fetch(base+file);
      assert.equal(r.status,404,file+' should not be exposed');
    }
  }finally{
    await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
  }
});

