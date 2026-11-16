// Validate the raw Telegram.WebApp.initData on every request; never trust initDataUnsafe.
import {createHmac, timingSafeEqual, createHash} from 'node:crypto';

export class AuthError extends Error {constructor(message='Unauthorized', status=401){super(message);this.status=status;}}
const hmac=(key,data)=>createHmac('sha256',key).update(data).digest();
export function validateTelegramInitData(raw,botToken,now=Date.now()){
  if(typeof raw!=='string'||!raw||raw.length>8192||!botToken)throw new AuthError();
  const params=new URLSearchParams(raw);
  const seen=new Set();
  for(const [key] of params){if(seen.has(key))throw new AuthError('Duplicate initialization field');seen.add(key);}
  const hash=params.get('hash');
  if(!hash||!/^[a-f0-9]{64}$/i.test(hash))throw new AuthError();
  // Telegram's bot-token HMAC includes signature, if present (only hash is excluded).
  const check=[...params].filter(([key])=>key!=='hash').sort(([a],[b])=>a<b?-1:a>b?1:0)
    .map(([key,value])=>`${key}=${value}`).join('\n');
  const secret=hmac('WebAppData',botToken);
  const actual=hmac(secret,check);
  if(!timingSafeEqual(Buffer.from(hash,'hex'),actual))throw new AuthError();
  const ts=Number(params.get('auth_date'));
  const current=Math.floor(now/1000);
  if(!Number.isSafeInteger(ts)||ts>current+60||current-ts>24*60*60)throw new AuthError('Telegram session expired. Reopen the game.');
  if(!['group','supergroup'].includes(params.get('chat_type')))throw new AuthError('Open this Mini App from a Telegram group.',403);
  const instance=params.get('chat_instance');
  if(!instance||!/^[0-9-]{1,64}$/.test(instance))throw new AuthError('Missing signed group context.',403);
  let user;
  try{user=JSON.parse(params.get('user')||'null')}catch{throw new AuthError()}
  if(!user||!Number.isSafeInteger(user.id)||user.id<=0)throw new AuthError('Missing signed Telegram user.',403);
  // Never expose raw chat_instance or user ID to the client.
  return {worldId:createHash('sha256').update(`skyre-group:${instance}`).digest('hex'),userId:String(user.id)};
}
