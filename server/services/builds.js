/* Lógica de negocio de las construcciones, independiente de HTTP y del almacenamiento (solo usa el contrato `store`). */
import path from 'node:path';
import {httpError as E,StoreError} from '../errors.js';
import {can,canManage} from '../roles.js';
import {CATEGORIES} from '../../js/catalog.js';
import {EXT_PLATFORM} from '../analyze.js';
import {isId,sniffImage} from '../util.js';

const byN=(a,b)=>a.n-b.n;
const imgName=i=>`img-${i.n}${i.ext}`;

export function createBuildService({store,analyze,config}){
  const L=config.limits;
  const url=(b,n)=>`/api/builds/${b.id}/images/${n}?v=${b.rev}`;           // ?v= permite cache inmutable en navegador/CDN
  const toItem=b=>({id:b.id,title:b.title,author:b.ownerName,platform:b.platform||null,format:b.format||null,category:b.category,size:b.size||null,
    dims:b.dims||null,total:b.total||0,types:b.types||0,tags:b.tags,status:b.status,rev:b.rev,createdAt:b.publishedAt||b.createdAt,
    cover:b.images.length?url(b,b.images[0].n):null});

  function fields(input,partial){
    const o={};
    if(!partial||input.title!==undefined){const t=String(input.title??'').trim();if(t.length<3||t.length>80)throw E(400,'El título debe tener entre 3 y 80 caracteres');o.title=t}
    if(!partial||input.category!==undefined){if(!CATEGORIES.some(c=>c[0]==input.category))throw E(400,'Elige un tipo de construcción');o.category=input.category}
    if(!partial||input.description!==undefined)o.description=String(input.description??'').trim().slice(0,2000);
    if(!partial||input.tags!==undefined)o.tags=(Array.isArray(input.tags)?input.tags:[]).map(t=>String(t).trim().toLowerCase().slice(0,20)).filter(Boolean).slice(0,5);
    return o;
  }
  /* carga la obra y comprueba permiso + dueño (o modo admin). ownerOnly: ni el admin puede (p. ej. publicar por otro) */
  async function own(user,id,perm,{ownerOnly=false}={}){
    if(!user)throw E(401,'Inicia sesión para continuar');
    if(!can(user,perm)&&!can(user,'build:moderate'))throw E(403,'Tu rol no tiene permiso para esto');
    const b=isId(id)?await store.getBuild(id):null;if(!b)throw E(404,'No existe');
    if(ownerOnly?!(can(user,perm)&&b.ownerId===user.id):!canManage(user,perm,b))throw E(403,'Solo puedes modificar tus publicaciones');
    if(b.ownerId!==user.id)config.log(`MODERACIÓN ${user.name} → ${perm} «${b.title}» (${b.id}) de ${b.ownerName}`);
    return b;
  }
  const sees=(b,v)=>b.status=='published'||!!(v&&(v.id==b.ownerId||can(v,'build:moderate')));
  const upd=async(id,patch,rev)=>{
    try{return await store.updateBuild(id,patch,{expectRev:rev})}
    catch(e){if(e instanceof StoreError){if(e.code=='CONFLICT')throw E(409,e.message);if(e.code=='NOT_FOUND')throw E(404,'No existe')}throw e}
  };

  return {
    toItem,
    async create(user,input){
      if(!user)throw E(401,'Inicia sesión para continuar');if(!can(user,'build:create'))throw E(403,'Tu rol no tiene permiso para esto');
      const f=fields(input,false);
      if(await store.countBuilds({ownerId:user.id,status:'draft'})>=L.draftsPerUser)throw E(429,'Tienes demasiados borradores sin publicar. Publica o elimina alguno.');
      if(await store.countBuilds({ownerId:user.id})>=L.buildsPerUser)throw E(429,'Alcanzaste el máximo de publicaciones');
      const now=Date.now(),b={id:store.id(),ownerId:user.id,ownerName:user.name,...f,status:'draft',createdAt:now,updatedAt:now,rev:1,images:[]};
      await store.createBuild(b);return {id:b.id,rev:b.rev};
    },
    async patch(user,id,input){
      const b=await own(user,id,'build:edit');
      const next=await upd(id,fields(input,true),Number.isInteger(input.rev)?input.rev:null);
      return {rev:next.rev};
    },
    async remove(user,id){await own(user,id,'build:delete');await store.deleteBuild(id);return {ok:true}},
    async putFile(user,id,name,buf){
      const b=await own(user,id,'build:edit'),ext=path.extname(name||'').toLowerCase();
      if(!EXT_PLATFORM[ext])throw E(400,'Formato no admitido. Usa .mcstructure, .nbt, .schem o .litematic');
      const a=await analyze(buf,name);
      await store.putBlob(id,'file'+ext,buf);
      if(b.file&&b.file.ext!==ext)await store.deleteBlob(id,'file'+b.file.ext);
      const next=await upd(id,{file:{name:path.basename(name).slice(0,100),ext,size:buf.length},platform:a.platform,format:a.format,dims:a.dims,size:a.size,total:a.total,types:a.types,materials:a.materials});
      return {platform:a.platform,dims:a.dims,size:a.size,total:a.total,types:a.types,rev:next.rev};
    },
    async putImage(user,id,n,buf){
      const b=await own(user,id,'build:edit');
      if(!Number.isInteger(n)||n<1||n>L.images)throw E(400,'Máximo '+L.images+' imágenes');
      const ext=sniffImage(buf);if(!ext)throw E(400,'La imagen debe ser PNG, JPG o WEBP');
      const old=b.images.find(i=>i.n==n);
      await store.putBlob(id,`img-${n}${ext}`,buf);
      if(old&&old.ext!==ext)await store.deleteBlob(id,imgName(old));
      const next=await upd(id,{images:[...b.images.filter(i=>i.n!=n),{n,ext}].sort(byN)});
      return {n,rev:next.rev};
    },
    async removeImage(user,id,n){
      const b=await own(user,id,'build:edit'),im=b.images.find(i=>i.n==n);
      if(!im)throw E(404,'No existe esa imagen');
      if(b.status=='published'&&b.images.length<=1)throw E(400,'Una publicación necesita al menos una imagen');
      await store.deleteBlob(id,imgName(im));
      const next=await upd(id,{images:b.images.filter(i=>i.n!=n)});return {rev:next.rev};
    },
    async setCover(user,id,n){
      const b=await own(user,id,'build:edit'),images=[...b.images].sort(byN),a=images[0],t=images.find(i=>i.n==n);
      if(!t)throw E(404,'No existe esa imagen');if(t===a)return {rev:b.rev};
      await store.renameBlob(id,imgName(a),`tmp-${imgName(a)}`);
      await store.renameBlob(id,imgName(t),`img-${a.n}${t.ext}`);
      await store.renameBlob(id,`tmp-${imgName(a)}`,`img-${t.n}${a.ext}`);
      const next=await upd(id,{images:images.map(i=>i===a?{n:t.n,ext:a.ext}:i===t?{n:a.n,ext:t.ext}:i).sort(byN)});
      return {rev:next.rev};
    },
    async publish(user,id){
      const b=await own(user,id,'build:edit',{ownerOnly:true});
      if(!b.file)throw E(400,'Falta el archivo de la estructura');
      if(!b.images.length)throw E(400,'Sube al menos una imagen');
      const next=await upd(id,{status:'published',publishedAt:b.publishedAt||Date.now()});return {id,rev:next.rev};
    },
    /* ---- lectura ---- */
    async get(id,viewer){
      const b=isId(id)?await store.getBuild(id):null,mine=!!(b&&viewer&&viewer.id==b.ownerId);
      if(!b||!sees(b,viewer))throw E(404,'No existe');
      return {...toItem(b),description:b.description,file:b.file||null,materials:await store.getMaterials(id),mine,canManage:canManage(viewer,'build:edit',b),images:b.images.map(i=>url(b,i.n))};
    },
    async list(q){
      const per=Math.min(L.pageMax,Math.max(1,+q.per||24)),page=Math.max(1,+q.page||1);
      const r=await store.listBuilds({status:'published',platform:q.platform,category:q.category,size:q.size,q:String(q.q||'').slice(0,80),sort:q.sort,page,per});
      return {total:r.total,page,pages:Math.max(1,Math.ceil(r.total/per)),items:r.items.map(toItem)};
    },
    async mine(user,q){
      if(!user)throw E(401,'Inicia sesión para continuar');
      const per=Math.min(L.pageMax,Math.max(1,+q.per||24)),page=Math.max(1,+q.page||1);
      const r=await store.listBuilds({ownerId:user.id,sort:'recent',page,per});
      return {total:r.total,page,pages:Math.max(1,Math.ceil(r.total/per)),items:r.items.map(toItem)};
    },
    /* moderación (modo admin): todas las obras, publicadas y borradores, paginadas y filtrables */
    async all(user,q){
      if(!user)throw E(401,'Inicia sesión para continuar');if(!can(user,'build:moderate'))throw E(403,'Tu rol no tiene permiso para esto');
      const per=Math.min(L.pageMax,Math.max(1,+q.per||24)),page=Math.max(1,+q.page||1),status=q.status=='draft'||q.status=='published'?q.status:undefined;
      const r=await store.listBuilds({status,q:String(q.q||'').slice(0,80),sort:'recent',page,per});
      return {total:r.total,page,pages:Math.max(1,Math.ceil(r.total/per)),items:r.items.map(toItem)};
    },
    /* descargas: públicas si está publicada; el dueño (y el admin) también ven los borradores */
    async blob(id,viewer,pick){
      const b=isId(id)?await store.getBuildLite(id):null;
      if(!b||!sees(b,viewer))throw E(404,'No existe');
      const info=pick(b);if(!info)throw E(404,'No existe');
      const o=await store.openBlob(id,info.name);if(!o)throw E(404,'No existe');return {...o,...info};
    },
  };
}
