/* Texturas globales: lectura pública, escritura solo del rol con permiso textures:update. */
import {httpError as E} from '../errors.js';
import {can} from '../roles.js';
import {pipeStream} from '../http.js';
import {updateTextures} from '../services/textures.js';

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
    return c.json(200,await updateTextures(store,c.user,k,await c.body(config.limits.textures)));
  });
}
