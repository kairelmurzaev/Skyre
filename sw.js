// Skyre v1.3 — offline-capable standalone web app.
// Fetch user worlds through the existing app; never intercept /api or Telegram.
const CACHE='skyre-mobile-v1.3.0';
const CORE=[
  './','./index.html','./style.css','./game-shell.css','./game-shell.js',
  './app.js','./manifest.webmanifest','./assets/ui/skyre-loading.avif','./assets/ui/skyre-loading.webp','./assets/ui/skyre-loading-portrait.avif',
  './assets/ui/skyre-icon-192.png','./assets/ui/skyre-icon-512.png',
  './world-art.js','./world-materials.js','./scene.js','./core.js',
  './workers.js','./routing.js','./terrain.js','./logistics.js',
  './characters.js','./character-design.js','./rigged-characters.js',
  './worker-v2.js','./master-worker.js'
];
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    // Continue installing if one optional resource fails. The game still
    // requires a successful network load on its first launch.
    await Promise.all(CORE.map(async url=>{try{await cache.add(url)}catch{}}));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(n=>n.startsWith('skyre-mobile-')&&n!==CACHE).map(n=>caches.delete(n)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin===self.location.origin){
    if(url.pathname.includes('/api/'))return;
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      try{
        const network=await fetch(req);
        if(network.ok&&url.pathname!==new URL('./sw.js',self.registration.scope).pathname)
          event.waitUntil(cache.put(req,network.clone()).catch(()=>{}));
        return network;
      }catch{
        const stored=await cache.match(req,{ignoreSearch:true});
        if(stored)return stored;
        if(req.mode==='navigate')return await cache.match('./index.html');
        return Response.error();
      }
    })());
  }else if(url.hostname==='cdn.jsdelivr.net'){
    // Pinned Three.js assets are safe to reuse for offline replay.
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      const hit=await cache.match(req);
      if(hit)return hit;
      const response=await fetch(req);
      if(response.ok)event.waitUntil(cache.put(req,response.clone()).catch(()=>{}));
      return response;
    })());
  }
});

