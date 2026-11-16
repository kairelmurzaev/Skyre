import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,join,extname} from 'node:path';
import {validateTelegramInitData,AuthError} from './auth.js';

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.glb':'model/gltf-binary'};
const staticFiles=new Set(['index.html','app.js','core.js','workers.js','routing.js','logistics.js','terrain.js','scene.js','characters.js','character-design.js','rigged-characters.js','assets/characters/skyre-villager.glb','character-studio.html','character-studio.js','style.css']);
const reply=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body));};
const error=(res,err)=>reply(res,err.status||500,{error:err.status?err.message:'Server error'});
async function body(req){let data='';for await(const buf of req){data+=buf;if(data.length>4096){const e=new Error('Request too large');e.status=413;throw e;}}try{return JSON.parse(data)}catch{const e=new Error('Invalid JSON');e.status=400;throw e;}}
export function createSkyreServer({store,botToken,publicDir=process.cwd(),now=Date.now}){
  const dir=resolve(publicDir);
  const buckets=new Map();
  return createServer(async(req,res)=>{
    try{
      const parsed=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
      if(parsed.pathname.startsWith('/api/')){
        if(req.method==='GET'&&parsed.pathname==='/api/health')return reply(res,200,{ok:true});
        if(!['GET','POST'].includes(req.method))return reply(res,405,{error:'Method not allowed'});
        // Cross-origin scripts must not be able to send authenticated commands.
        if(req.headers.origin){const host=req.headers.host;const origin=new URL(req.headers.origin);if(origin.host!==host){return reply(res,403,{error:'Forbidden origin'});}}
        const identity=validateTelegramInitData(req.headers['x-telegram-init-data'],botToken,now());
        const key=`${identity.worldId}:${identity.userId}`;const current=now();
        let limit=buckets.get(key);
        if(!limit||current-limit.start>=60000)limit={start:current,hits:0};
        limit.hits++;buckets.set(key,limit);
        if(limit.hits>180)return reply(res,429,{error:'Too many requests. Slow down.'});
        if(buckets.size>20000)for(const [k,v] of buckets){if(current-v.start>60000)buckets.delete(k)}
        if(req.method==='GET'&&parsed.pathname==='/api/world')return reply(res,200,store.state(identity.worldId,current));
        if(req.method==='POST'&&parsed.pathname==='/api/action'){
          if(req.headers['content-type']?.split(';')[0].trim()!=='application/json')return reply(res,415,{error:'Expected JSON'});
          const data=await body(req);
          if(!data||typeof data!=='object'||Array.isArray(data)||typeof data.requestId!=='string'||!/^[A-Za-z0-9_-]{12,80}$/.test(data.requestId))return reply(res,400,{error:'Invalid request ID'});
          const result=store.dispatch(identity.worldId,data.requestId,data.command,current);
          return reply(res,result.error?409:200,result);
        }
        return reply(res,404,{error:'Not found'});
      }
      if(req.method!=='GET'&&req.method!=='HEAD')return reply(res,405,{error:'Method not allowed'});
      const filename=parsed.pathname==='/'?'index.html':parsed.pathname.slice(1);
      if(!staticFiles.has(filename))return reply(res,404,{error:'Not found'});
      const file=join(dir,filename);
      await stat(file);
      const bytes=await readFile(file);
      res.writeHead(200,{'content-type':mime[extname(filename)]||'application/octet-stream','x-content-type-options':'nosniff','referrer-policy':'no-referrer','cache-control':'no-cache'});
      if(req.method==='HEAD')return res.end();
      res.end(bytes);
    }catch(err){error(res,err instanceof AuthError?err:err);}
  });
}
