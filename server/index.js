import {resolve} from 'node:path';
import {openStore} from './db.js';
import {createSkyreServer} from './http.js';

const botToken=process.env.BOT_TOKEN;
if(!botToken){console.error('Set BOT_TOKEN in your hosting environment. Do not put it in the repository.');process.exit(1)}
const file=resolve(process.env.DATABASE_PATH||'.data/skyre.db');
const port=Number(process.env.PORT||3000);
const store=openStore(file);
const server=createSkyreServer({store,botToken,publicDir:resolve('.')});
server.listen(port,'0.0.0.0',()=>console.log(`Skyre listening on port ${port}. Persistent SQLite DB: ${file}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{store.close();process.exit(0)}));
