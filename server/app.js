/* Compone la aplicación: contexto de petición, sesión, CSRF, rutas y errores. */
import {Router} from './router.js';
import {send,readBody,readJson,cookies} from './http.js';
import {readToken,limiter} from './auth.js';
import {httpError as E,HttpError} from './errors.js';
import {ROLES} from './roles.js';
import {analyze} from './analyze.js';
import {createBuildService} from './services/builds.js';
import {authRoutes} from './routes/auth.js';
import {buildRoutes} from './routes/builds.js';
import {textureRoutes} from './routes/textures.js';
import {serveStatic} from './routes/static.js';

export function createApp({store,config}){
  const L=config.limits,router=new Router();
  const app={store,config,router,builds:createBuildService({store,analyze,config}),
    limit:{login:limiter(L.loginPerIp,L.loginWindowMs),loginName:limiter(L.loginPerName,L.loginWindowMs),reg:limiter(L.registerPerIp,L.registerWindowMs),write:limiter(L.writes,L.writeWindowMs)},
    secure:req=>config.secureCookies||req.headers['x-forwarded-proto']=='https',
    pub:u=>u&&{id:u.id,name:u.name,role:u.role,roleLabel:ROLES[u.role].label,can:ROLES[u.role].can}};
  authRoutes(router,app);buildRoutes(router,app);textureRoutes(router,app);
  router.get('/api/health',async c=>c.json(200,{ok:true,storage:config.storage,...await store.stats()}));

  const userOf=async req=>{
    const t=readToken(store.secret(),cookies(req).sid);if(!t)return null;
    const u=await store.getUserById(t.id);return u&&(u.sv||1)==t.sv?u:null;
  };
  const ipOf=req=>config.trustProxy&&req.headers['x-forwarded-for']?String(req.headers['x-forwarded-for']).split(',')[0].trim():(req.socket.remoteAddress||'?');

  async function handle(req,res){
    const t0=Date.now();
    try{
      const url=new URL(req.url,'http://x');let p;
      try{p=decodeURIComponent(url.pathname)}catch{throw E(400,'URL inválida')}
      if(p.startsWith('/api/')){
        const c={req,res,url,params:{},ip:ipOf(req),user:await userOf(req),
          json:(code,body,h)=>send(req,res,code,body,h),body:(limit=L.json)=>readJson(req,limit),raw:limit=>readBody(req,limit)};
        if(req.method!='GET'&&req.method!='HEAD'&&req.headers['x-requested-with']!='fetch')throw E(403,'Petición no permitida');
        const m=router.match(req.method,p);if(!m)throw E(404,'Ruta no encontrada');
        c.params=m.params;await m.handler(c);return;
      }
      if(req.method!='GET'&&req.method!='HEAD')throw E(405,'Método no permitido');
      await serveStatic(req,res,p);
    }catch(e){
      if(!(e instanceof HttpError))config.log('ERROR',e&&e.stack||e);
      if(res.headersSent){res.end();return}
      await send(req,res,e.status||500,{error:e.status?e.message:'Error interno'});
    }finally{
      if(config.accessLog)config.log(JSON.stringify({m:req.method,u:req.url.split('?')[0],s:res.statusCode,ms:Date.now()-t0}));
    }
  }
  return {handle,app};
}
