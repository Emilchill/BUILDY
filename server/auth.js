/* Contraseñas (scrypt) y sesiones firmadas (cookie HttpOnly). */
import crypto from 'node:crypto';
import {promisify} from 'node:util';
const b64=b=>Buffer.from(b).toString('base64url');
const scrypt=promisify(crypto.scrypt);
/* scrypt asíncrono (corre en el pool de hilos): login/registro no bloquean a los demás usuarios */
export async function hashPassword(pw,salt=crypto.randomBytes(16).toString('hex')){
  return {salt,hash:(await scrypt(pw,salt,64)).toString('hex')};
}
export async function verifyPassword(pw,u){
  const a=Buffer.from((await scrypt(pw,u.salt,64)).toString('hex')),b=Buffer.from(u.hash);
  return a.length==b.length&&crypto.timingSafeEqual(a,b);
}
/* Token = id.sv.expira.firma. `sv` es la versión de sesión del usuario: subirla invalida todos sus tokens. */
export function makeToken(secret,userId,sv=1,days=14){
  const p=`${userId}.${sv}.${Date.now()+days*864e5}`;
  return p+'.'+b64(crypto.createHmac('sha256',secret).update(p).digest());
}
export function readToken(secret,tok){
  const m=/^([a-f0-9]+)\.(\d+)\.(\d+)\.([\w-]+)$/.exec(tok||'');if(!m)return null;
  const p=`${m[1]}.${m[2]}.${m[3]}`,sig=b64(crypto.createHmac('sha256',secret).update(p).digest());
  const x=Buffer.from(sig),y=Buffer.from(m[4]);
  if(x.length!=y.length||!crypto.timingSafeEqual(x,y)||Date.now()>+m[3])return null;
  return {id:m[1],sv:+m[2]};
}
/* Limitador por clave (IP/usuario): máx n eventos en ms. En memoria; con varias instancias se cambia por Redis (misma firma). */
export function limiter(n,ms){
  const hits=new Map();
  return key=>{const now=Date.now(),a=(hits.get(key)||[]).filter(t=>now-t<ms);a.push(now);hits.set(key,a);return a.length<=n};
}
