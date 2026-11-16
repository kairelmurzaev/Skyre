import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {validateTelegramInitData} from '../server/auth.js';

const token='123456:TEST_TOKEN_DO_NOT_USE';
const now=1763300000000;
const sign=(instance='12345',type='group',userId=23,ts=Math.floor(now/1000),extra={})=>{
  const p=new URLSearchParams({auth_date:String(ts),chat_instance:instance,chat_type:type,user:JSON.stringify({id:userId,first_name:'Test'}),...extra});
  const sorted=[...p].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join('\n');
  const secret=createHmac('sha256','WebAppData').update(token).digest();
  p.set('hash',createHmac('sha256',secret).update(sorted).digest('hex'));
  return p.toString();
};
test('validates group signatures and derives stable world ID for all members',()=>{
  const a=validateTelegramInitData(sign('456','group',25),token,now);
  const b=validateTelegramInitData(sign('456','group',26),token,now);
  assert.equal(a.worldId,b.worldId);assert.notEqual(a.userId,b.userId);
  assert.notEqual(a.worldId,validateTelegramInitData(sign('457'),token,now).worldId);
});
test('rejects tampering, duplicate keys, old data and missing user',()=>{
  const signed=sign();
  assert.throws(()=>validateTelegramInitData(signed.replace('12345','54321'),token,now));
  assert.throws(()=>validateTelegramInitData(signed+'&hash=abc',token,now));
  assert.throws(()=>validateTelegramInitData(sign('222','group',23,Math.floor(now/1000)-90000),token,now));
  assert.throws(()=>validateTelegramInitData(sign('222','group',23,Math.floor(now/1000)+120),token,now));
  assert.throws(()=>validateTelegramInitData('',token,now));
  assert.throws(()=>validateTelegramInitData(sign('222','group',23,Math.floor(now/1000),{user:'null'}),token,now));
});
test('requires a direct-link group, not a private chat or arbitrary group identifier',()=>{
  for(const type of ['private','sender','channel'])assert.throws(()=>validateTelegramInitData(sign('123',type),token,now));
  assert.throws(()=>validateTelegramInitData(sign('bad group id'),token,now));
});
test('includes Telegram third-party signature field in bot-token HMAC',()=>{
  const signed=sign('123','group',23,Math.floor(now/1000),{signature:'test-ed25519-signature'});
  assert.ok(validateTelegramInitData(signed,token,now).worldId);
});
export {sign,token,now};
