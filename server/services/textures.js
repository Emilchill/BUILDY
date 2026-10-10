/* Validación y guardado de texturas globales (rol con permiso textures:update). Sin dependencias de Node. */
import {httpError as E} from '../errors.js';
import {can} from '../roles.js';
import {sniffImage} from '../util.js';

const b64=s=>{const bin=atob(String(s||'')),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u};
export async function updateTextures(store,user,k,b){
  if(k!='bedrock'&&k!='java')throw E(404,'Ruta no encontrada');
  if(!user)throw E(401,'Inicia sesión para continuar');if(!can(user,'textures:update'))throw E(403,'Tu rol no tiene permiso para esto');
  let png;try{png=b64(b.png)}catch{throw E(400,'El atlas debe ser PNG')}
  if(sniffImage(png)!='.png')throw E(400,'El atlas debe ser PNG');
  const ok=Number.isInteger(b.cols)&&Number.isInteger(b.rows)&&b.cols>0&&b.rows>0&&b.cols<=256&&b.rows<=256;
  if(!ok||!Array.isArray(b.names)||b.names.length>40000||!b.names.every(x=>Array.isArray(x)&&typeof x[0]=='string'&&Number.isInteger(x[1])))throw E(400,'Índice de texturas inválido');
  if(k=='bedrock'&&(!b.meta||typeof b.meta!='object'||!b.meta.blocks||!b.meta.terrain))throw E(400,'Falta el índice de bloques de Bedrock');
  const index={version:Date.now(),updatedAt:Date.now(),updatedBy:user.name,cols:b.cols,rows:b.rows,names:b.names,meta:k=='bedrock'?b.meta:undefined};
  await store.putTexture(k,png,index);
  return {version:index.version,count:b.names.length};
}
