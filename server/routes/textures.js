/* Texturas globales: lectura pública, escritura solo del rol con permiso textures:update. */
import {httpError as E} from '../errors.js';
import {can} from '../roles.js';
import {pipeStream} from '../http.js';
import {sniffImage} from '../util.js';

export function textureRoutes(r,app){
  const {store,config}=app;
  const kind=c=>{if(c.params.kind!='bedrock'&&c.params.kind!='java')throw E(404,'Ruta no encontrada');return c.params.kind};
  r.get('/api/textures',async c=>{
    const o={};for(const k of ['bedrock','java']){const i=await store.getTexIndex(k);o[k]=i&&{version:i.version,count:i.names.length,updatedAt:i.updatedAt,updatedBy:i.updatedBy}}
    return c.json(200,o);
  });
  r.get('/api/textures/:kind/index.json',async c=>{
    const k=kind(c),i=await store.getTexIndex(k);if(!i)throw E(404,'Sin texturas');
    if(c.req.headers['if-none-match']=='"'+i.version+'"'){c.res.writeHead(304);return c.res.end()}
    return c.json(200,i,{ETag:'"'+i.version+'"','Cache-Control':'no-cache'});
  });
  r.get('/api/textures/:kind/atlas.png',async c=>{
    const k=kind(c),i=await store.getTexIndex(k),o=i&&await store.openTexPng(k);if(!o)throw E(404,'Sin texturas');
    if(c.req.headers['if-none-match']=='"'+i.version+'"'){c.res.writeHead(304);return c.res.end()}
    return pipeStream(c.res,200,{'Content-Type':'image/png','Content-Length':o.size,ETag:'"'+i.version+'"','Cache-Control':'no-cache'},o.stream());
  });
  r.post('/api/admin/textures/:kind',async c=>{
    const k=kind(c);
    if(!c.user)throw E(401,'Inicia sesión para continuar');if(!can(c.user,'textures:update'))throw E(403,'Tu rol no tiene permiso para esto');
    const b=await c.body(config.limits.textures),png=Buffer.from(String(b.png||''),'base64');
    if(sniffImage(png)!='.png')throw E(400,'El atlas debe ser PNG');
    const ok=Number.isInteger(b.cols)&&Number.isInteger(b.rows)&&b.cols>0&&b.rows>0&&b.cols<=256&&b.rows<=256;
    if(!ok||!Array.isArray(b.names)||b.names.length>40000||!b.names.every(x=>Array.isArray(x)&&typeof x[0]=='string'&&Number.isInteger(x[1])))throw E(400,'Índice de texturas inválido');
    if(k=='bedrock'&&(!b.meta||typeof b.meta!='object'||!b.meta.blocks||!b.meta.terrain))throw E(400,'Falta el índice de bloques de Bedrock');
    const index={version:Date.now(),updatedAt:Date.now(),updatedBy:c.user.name,cols:b.cols,rows:b.rows,names:b.names,meta:k=='bedrock'?b.meta:undefined};
    await store.putTexture(k,png,index);
    return c.json(200,{version:index.version,count:b.names.length});
  });
}
