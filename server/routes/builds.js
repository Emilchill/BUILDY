/* Rutas del catálogo. Todo el comportamiento vive en services/builds.js. */
import crypto from 'node:crypto';
import {httpError as E} from '../errors.js';
import {pipeStream} from '../http.js';
import {MIME} from '../util.js';

export function buildRoutes(r,app){
  const {builds,store,limit}=app;
  const write=c=>{if(!limit.write(c.user?c.user.id:c.ip))throw E(429,'Demasiadas operaciones seguidas, espera un momento')};
  const q=c=>Object.fromEntries(c.url.searchParams);

  r.get('/api/builds',async c=>{
    /* ETag = versión del almacén + consulta: los clientes reciben 304 mientras nada cambie */
    const tag=`W/"${store.version()}-${crypto.createHash('md5').update(c.url.search).digest('hex').slice(0,10)}"`;
    if(c.req.headers['if-none-match']==tag){c.res.writeHead(304,{ETag:tag});return c.res.end()}
    return c.json(200,await builds.list(q(c)),{ETag:tag,'Cache-Control':'no-cache'});
  });
  r.get('/api/me/builds',async c=>c.json(200,await builds.mine(c.user,q(c)),{'Cache-Control':'no-store'}));
  r.get('/api/builds/:id',async c=>c.json(200,await builds.get(c.params.id,c.user),{'Cache-Control':'no-store'}));
  r.get('/api/builds/:id/file',async c=>{
    const o=await builds.blob(c.params.id,c.user,b=>b.file&&{name:'file'+b.file.ext,download:b.file.name});
    return pipeStream(c.res,200,{'Content-Type':'application/octet-stream','Content-Length':o.size,'Cache-Control':'public, max-age=3600',
      'Content-Disposition':`attachment; filename="${o.download.replace(/[^\w.-]/g,'_')}"`},o.stream());
  });
  r.get('/api/builds/:id/images/:n',async c=>{
    const o=await builds.blob(c.params.id,c.user,b=>{const i=b.images.find(x=>x.n==+c.params.n);return i&&{name:`img-${i.n}${i.ext}`,ext:i.ext}});
    return pipeStream(c.res,200,{'Content-Type':MIME[o.ext],'Content-Length':o.size,'Cache-Control':c.url.searchParams.has('v')?'public, max-age=31536000, immutable':'public, max-age=300'},o.stream());
  });

  r.post('/api/builds',async c=>{write(c);return c.json(200,await builds.create(c.user,await c.body()))});
  r.patch('/api/builds/:id',async c=>{write(c);return c.json(200,await builds.patch(c.user,c.params.id,await c.body()))});
  r.delete('/api/builds/:id',async c=>{write(c);return c.json(200,await builds.remove(c.user,c.params.id))});
  r.put('/api/builds/:id/file',async c=>{
    write(c);return c.json(200,await builds.putFile(c.user,c.params.id,c.url.searchParams.get('name')||'',await c.raw(app.config.limits.file)));
  });
  r.put('/api/builds/:id/images/:n',async c=>{
    write(c);return c.json(200,await builds.putImage(c.user,c.params.id,+c.params.n,await c.raw(app.config.limits.image)));
  });
  r.delete('/api/builds/:id/images/:n',async c=>{write(c);return c.json(200,await builds.removeImage(c.user,c.params.id,+c.params.n))});
  r.post('/api/builds/:id/images/:n/cover',async c=>{write(c);return c.json(200,await builds.setCover(c.user,c.params.id,+c.params.n))});
  r.post('/api/builds/:id/publish',async c=>{write(c);return c.json(200,await builds.publish(c.user,c.params.id))});
}
