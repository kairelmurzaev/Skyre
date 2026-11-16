import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {newGame} from '../core.js';
import {advanceGame,syncWorkers} from '../workers.js';
import {executeAction} from './actions.js';

const gameVersion=1;
const createWorld=(id,now)=>{
  const w=newGame().a;
  w.name=`Sky ${createHash('sha256').update(id).digest('hex').slice(0,6).toUpperCase()}`;
  w.simulatedAt=now;
  syncWorkers(w,now);
  return w;
};
export function openStore(filename){
  if(filename!==':memory:')mkdirSync(dirname(filename),{recursive:true});
  const db=new DatabaseSync(filename,{timeout:5000});
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS worlds (
      id TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      partner_id TEXT,
      looking INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS actions (
      world_id TEXT NOT NULL,
      request_id TEXT NOT NULL,
      at INTEGER NOT NULL,
      PRIMARY KEY(world_id,request_id)
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      world_id TEXT NOT NULL,
      message TEXT NOT NULL,
      at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_open_worlds ON worlds(looking,created_at);
    CREATE INDEX IF NOT EXISTS idx_events ON events(world_id,id);
  `);
  const get=db.prepare('SELECT * FROM worlds WHERE id=?');
  const insert=db.prepare('INSERT INTO worlds(id,state,created_at) VALUES(?,?,?)');
  const put=db.prepare('UPDATE worlds SET state=?,revision=revision+1 WHERE id=?');
  const getEvent=db.prepare('SELECT id,message,at FROM events WHERE world_id=? ORDER BY id DESC LIMIT 10');
  const putEvent=db.prepare('INSERT INTO events(world_id,message,at) VALUES(?,?,?)');
  const seen=db.prepare('SELECT 1 FROM actions WHERE world_id=? AND request_id=?');
  const saveAction=db.prepare('INSERT INTO actions(world_id,request_id,at) VALUES(?,?,?)');
  function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result}catch(error){db.exec('ROLLBACK');throw error}}
  function createIfMissing(id,now){let row=get.get(id);if(!row){insert.run(id,JSON.stringify(createWorld(id,now)),now);row=get.get(id);}return row;}
  function getPair(worldId,now){
    const own=createIfMissing(worldId,now),partner=own.partner_id?get.get(own.partner_id):null;
    if(own.partner_id&&!partner)throw new Error('World pairing database inconsistency');
    const g={version:gameVersion,a:JSON.parse(own.state),b:partner?JSON.parse(partner.state):createWorld('awaiting',now),events:[]};
    if(!partner){g.b.name='Awaiting another sky';g.b.buildings=[];g.b.workers=[];}
    advanceGame(g,now);
    put.run(JSON.stringify(g.a),own.id);
    if(partner)put.run(JSON.stringify(g.b),partner.id);
    return {game:g,ownId:own.id,partnerId:partner?.id||null,looking:!!own.looking};
  }
  function snapshot(pair){
    const ev=getEvent.all(pair.ownId).concat(pair.partnerId?getEvent.all(pair.partnerId):[])
      .sort((a,b)=>b.id-a.id).slice(0,15).map(e=>({id:String(e.id),message:e.message,at:e.at}));
    pair.game.events=ev;
    return {game:pair.game,linked:!!pair.partnerId,looking:pair.looking,serverTime:Date.now()};
  }
  function state(id,now=Date.now()){return transaction(()=>snapshot(getPair(id,now)));}
  function dispatch(id,requestId,command,now=Date.now()){
    return transaction(()=>{
      let pair=getPair(id,now);
      if(seen.get(id,requestId))return {...snapshot(pair),duplicate:true};
      if(command?.type==='connect'){
        if(pair.partnerId){return {...snapshot(pair),message:'Already connected.'};}
        db.prepare('UPDATE worlds SET looking=1 WHERE id=?').run(id);
        const candidate=db.prepare('SELECT id FROM worlds WHERE looking=1 AND partner_id IS NULL AND id<>? ORDER BY created_at,id LIMIT 1').get(id);
        if(candidate){
          db.prepare('UPDATE worlds SET partner_id=?,looking=0,revision=revision+1 WHERE id=?').run(candidate.id,id);
          db.prepare('UPDATE worlds SET partner_id=?,looking=0,revision=revision+1 WHERE id=?').run(id,candidate.id);
          putEvent.run(id,'A new sky has appeared across the glass.',now);
          putEvent.run(candidate.id,'A new sky has appeared across the glass.',now);
        }
        saveAction.run(id,requestId,now);
        pair=getPair(id,now);
        return {...snapshot(pair),message:pair.partnerId?'Connected to another group!':'Looking for another group…'};
      }
      const outcome=executeAction(pair.game,command,!!pair.partnerId,now);
      if(outcome.error)return {...snapshot(pair),error:outcome.error};
      put.run(JSON.stringify(pair.game.a),pair.ownId);
      if(pair.partnerId)put.run(JSON.stringify(pair.game.b),pair.partnerId);
      putEvent.run(pair.ownId,outcome.message,now);
      saveAction.run(id,requestId,now);
      // Keep command history bounded; replay defense lasts 48 hours.
      db.prepare('DELETE FROM actions WHERE world_id=? AND at<?').run(id,now-48*60*60*1000);
      return {...snapshot(pair),message:outcome.message};
    });
  }
  return {state,dispatch,close:()=>db.close(),database:db};
}
