/* "Servidor" dentro del navegador para cuando el sitio es estático (p. ej. GitHub Pages): mismas rutas, mismos servicios y mismas
   reglas/roles que server/, pero sobre LocalStore (IndexedDB). Los datos son de cada navegador: no se comparten entre visitantes.
   Para compartirlos hay que desplegar el servidor Node (o una base de datos, ver docs/ESCALABILIDAD.md). */
import {Router} from '../../../server/router.js';
import {createBuildService} from '../../../server/services/builds.js';
import {updateTextures} from '../../../server/services/textures.js';
import {ROLES} from '../../../server/roles.js';
import {httpError as E,HttpError,StoreError} from '../../../server/errors.js';
import {LIMITS,DEFAULT_ADMIN} from '../../../server/defaults.js';
import {readStructure} from '../../formats/loaders.js';
import {Builder} from '../../formats/model.js';
import {CATEGORIES,PLATFORMS,SIZES,sizeClass,EXT_PLATFORM,extOf} from '../../catalog.js';
import {LocalStore,idbBackend,memoryBackend} from './store.js';

const hex=u=>[...u].map(x=>x.toString(16).padStart(2,'0')).join('');
async function hashPassword(pw,salt=hex(crypto.getRandomValues(new Uint8Array(16)))){
  const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},k,512);
  return {salt,hash:hex(new Uint8Array(bits))};
}
async function verifyPassword(pw,u){return (await hashPassword(pw,u.salt)).hash===u.hash}

/* análisis de la estructura en el navegador (mismo resultado que server/analyze.js) */
Builder.maxCells=3e7;
async function analyze(buf,filename){
  const ext=extOf(filename),platform=EXT_PLATFORM[ext];
  if(!platform)throw E(400,'Formato no admitido. Usa .mcstructure (Bedrock) o .nbt / .schem / .litematic (Java).');
  let m;try{m=await readStructure(new Uint8Array(buf),filename)}catch(e){throw E(400,'No se pudo leer la estructura: '+e.message)}
  const materials=m.names.map((id,i)=>[id,m.counts[i]]).filter(r=>r[1]>0).sort((a,b)=>b[1]-a[1]);
  const dims={w:m.W,h:m.H,l:m.L};
  return {platform,format:ext.slice(1),dims,size:sizeClass(dims),total:m.total,types:materials.length,materials};
}

const MIMES={'.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
const IMG=/^\/api\/builds\/[a-f0-9]{12}\/images\/\d\?v=\d+$/;

export async function createLocalServer({backend}={}){
  let be=backend;
  if(!be){try{be=idbBackend();await be.loadMeta()}catch(e){console.warn('IndexedDB no disponible: los datos se perderán al cerrar',e);be=memoryBackend()}}
  const store=await LocalStore.open(be),config={limits:{...LIMITS},log:(...a)=>console.info(...a)};
  if(await store.countUsersByRole('admin')==0)
    await store.createUser({id:store.id(),name:DEFAULT_ADMIN.name,role:'admin',sv:1,created:Date.now(),...await hashPassword(DEFAULT_ADMIN.password)});
  await store.purgeDrafts(Date.now()-LIMITS.draftTtlMs).catch(()=>{});
  const builds=createBuildService({store,analyze,config}),router=new Router();
  const SK='mcv.session',memSession={};
  const ls=(()=>{try{return localStorage}catch{return null}})();
  const getS=()=>{try{return JSON.parse((ls?ls.getItem(SK):memSession.v)||'null')}catch{return null}};
  const setS=v=>{const s=v&&JSON.stringify(v);if(ls){s?ls.setItem(SK,s):ls.removeItem(SK)}else memSession.v=s};
  const pub=u=>u&&{id:u.id,name:u.name,role:u.role,roleLabel:ROLES[u.role].label,can:ROLES[u.role].can};
  const q=c=>Object.fromEntries(c.url.searchParams);
  const bin=async raw=>raw instanceof Uint8Array?raw:new Uint8Array(raw&&raw.arrayBuffer?await raw.arrayBuffer():raw||[]);
  const sized=(u,max)=>{if(u.length>max)throw E(413,'El archivo es demasiado grande');return u};
  const blobOf=(o,type)=>new Blob([o.read()],{type});

  {
    const r=router;
    r.get('/api/health',async()=>({ok:true,storage:'local',...await store.stats()}));
    r.get('/api/session',async c=>({user:pub(c.user),categories:CATEGORIES,sizes:SIZES,platforms:PLATFORMS,local:true,devAdmin:{name:DEFAULT_ADMIN.name,password:DEFAULT_ADMIN.password}}));
    r.post('/api/register',async c=>{
      const b=c.json||{};
      if(!/^[A-Za-z0-9_.-]{3,24}$/.test(b.name||''))throw E(400,'Usuario: 3-24 caracteres (letras, números, _ . -)');
      if(typeof b.password!='string'||b.password.length<8||b.password.length>72)throw E(400,'La contraseña debe tener entre 8 y 72 caracteres');
      const u={id:store.id(),name:b.name,role:'user',sv:1,created:Date.now(),...await hashPassword(b.password)};
      try{await store.createUser(u)}catch(e){if(e instanceof StoreError&&e.code=='EXISTS')throw E(409,'Ese usuario ya existe');throw e}
      setS({id:u.id,sv:u.sv});return {user:pub(u)};
    });
    r.post('/api/login',async c=>{
      const b=c.json||{},u=await store.getUserByName(String(b.name||''));
      if(!u||typeof b.password!='string'||b.password.length>72||!(await verifyPassword(b.password,u)))throw E(401,'Usuario o contraseña incorrectos');
      setS({id:u.id,sv:u.sv});return {user:pub(u)};
    });
    r.post('/api/logout',async()=>{setS(null);return {ok:true}});
    r.get('/api/admin/builds',async c=>builds.all(c.user,q(c)));
    r.get('/api/me/builds',async c=>builds.mine(c.user,q(c)));
    r.get('/api/builds',async c=>builds.list(q(c)));
    r.get('/api/builds/:id',async c=>builds.get(c.params.id,c.user));
    r.get('/api/builds/:id/file',async c=>{const o=await builds.blob(c.params.id,c.user,b=>b.file&&{name:'file'+b.file.ext,download:b.file.name});return blobOf(o,'application/octet-stream')});
    r.get('/api/builds/:id/images/:n',async c=>{
      const o=await builds.blob(c.params.id,c.user,b=>{const i=b.images.find(x=>x.n==+c.params.n);return i&&{name:`img-${i.n}${i.ext}`,ext:i.ext}});return blobOf(o,MIMES[o.ext]);
    });
    r.post('/api/builds',async c=>builds.create(c.user,c.json||{}));
    r.patch('/api/builds/:id',async c=>builds.patch(c.user,c.params.id,c.json||{}));
    r.delete('/api/builds/:id',async c=>builds.remove(c.user,c.params.id));
    r.put('/api/builds/:id/file',async c=>builds.putFile(c.user,c.params.id,c.url.searchParams.get('name')||'',sized(await bin(c.raw),LIMITS.file)));
    r.put('/api/builds/:id/images/:n',async c=>builds.putImage(c.user,c.params.id,+c.params.n,sized(await bin(c.raw),LIMITS.image)));
    r.delete('/api/builds/:id/images/:n',async c=>builds.removeImage(c.user,c.params.id,+c.params.n));
    r.post('/api/builds/:id/images/:n/cover',async c=>builds.setCover(c.user,c.params.id,+c.params.n));
    r.post('/api/builds/:id/publish',async c=>builds.publish(c.user,c.params.id));
    r.get('/api/textures',async()=>{const o={};for(const k of ['bedrock','java']){const i=await store.getTexIndex(k);o[k]=i&&{version:i.version,count:i.names.length,updatedAt:i.updatedAt,updatedBy:i.updatedBy}}return o});
    r.get('/api/textures/:kind/index.json',async c=>{const i=await store.getTexIndex(c.params.kind);if(!i)throw E(404,'Sin texturas');return i});
    r.get('/api/textures/:kind/atlas.png',async c=>{const o=await store.openTexPng(c.params.kind);if(!o)throw E(404,'Sin texturas');return blobOf(o,'image/png')});
    r.post('/api/admin/textures/:kind',async c=>updateTextures(store,c.user,c.params.kind,c.json||{}));
  }

  /* las imágenes llegan como /api/builds/ID/images/N?v=REV: en local se sustituyen por blob: URLs (la rev invalida la caché) */
  const urls=new Map();
  async function handle(method,url,{json,raw}={}){
    try{
      const u=new URL(url,'http://x'),m=router.match(method,u.pathname);if(!m)throw E(404,'Ruta no encontrada');
      const s=getS(),user=s?await store.getUserById(s.id):null;
      const c={user:user&&(user.sv||1)==s.sv?user:null,params:m.params,url:u,json,raw};
      const out=await m.handler(c);
      return out instanceof Blob?out:await resolveWith(out,c);       // las imágenes se piden con el usuario real (borradores del dueño/admin)
    }catch(e){
      if(e instanceof HttpError)throw Object.assign(new Error(e.message),{status:e.status});
      console.error(e);throw Object.assign(new Error(e&&e.name=='QuotaExceededError'?'No queda espacio en el navegador':'Error interno'),{status:500});
    }
  }
  async function resolveWith(out,c){
    const find=async x=>{
      if(typeof x=='string'&&IMG.test(x)){
        const key=x;if(urls.has(key))return urls.get(key);
        const [p]=x.split('?'),m=router.match('GET',p);
        try{const bl=await m.handler({params:m.params,user:c.user,url:new URL(x,'http://x')});/* el fragmento conserva /images/N (lo usa la edición); el navegador lo ignora */const o=URL.createObjectURL(bl)+'#'+p;urls.set(key,o);return o}catch{return x}
      }
      if(Array.isArray(x))return Promise.all(x.map(find));
      if(x&&typeof x=='object'){const o={};for(const k of Object.keys(x))o[k]=await find(x[k]);return o}
      return x;
    };
    return find(out);
  }
  return {handle,store,local:true};
}
