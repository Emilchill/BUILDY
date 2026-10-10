/* Prueba de integración del servidor: node tests/server.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {startServer} from '../server/server.js';
import {mcstructure,javaNbt,PNG1,JPG1} from './fixtures.mjs';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mcv-'));
const srv=await startServer({port:0,dir,adminPassword:'admin-pass-1',log:()=>{}});const port=srv.port;
const base=`http://localhost:${port}`;
let ok=0;const t=async(name,fn)=>{await fn();ok++;console.log('  ✓',name)};

/* cliente con cookies */
const client=()=>{let cookie='';return async(method,url,{json,raw,type,csrf=true}={})=>{
  const h={};if(csrf)h['X-Requested-With']='fetch';if(cookie)h.Cookie=cookie;
  let body;if(json!==undefined){body=JSON.stringify(json);h['Content-Type']='application/json'}if(raw){body=raw;h['Content-Type']=type||'application/octet-stream'}
  const r=await fetch(base+url,{method,headers:h,body});
  const sc=r.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0].replace(/^sid=$/,'');
  const ct=r.headers.get('content-type')||'';const data=ct.includes('json')?await r.json():Buffer.from(await r.arrayBuffer());
  return {status:r.status,data,headers:r.headers};
}};
const anon=client(),alba=client(),otro=client(),admin=client();

console.log('Cuentas y roles');
await t('sesión anónima',async()=>{const r=await anon('GET','/api/session');assert.equal(r.data.user,null);assert.ok(r.data.categories.length>5)});
await t('registro valida usuario y contraseña; no duplica',async()=>{
  assert.equal((await alba('POST','/api/register',{json:{name:'a',password:'secret123'}})).status,400);
  assert.equal((await alba('POST','/api/register',{json:{name:'alba',password:'corta'}})).status,400);
  const r=await alba('POST','/api/register',{json:{name:'alba',password:'secret123'}});assert.equal(r.status,200);assert.equal(r.data.user.role,'user');
  assert.equal((await otro('POST','/api/register',{json:{name:'ALBA',password:'secret123'}})).status,409);
  assert.equal((await otro('POST','/api/register',{json:{name:'beto',password:'secret123'}})).status,200);
});
await t('login incorrecto y correcto del admin',async()=>{
  assert.equal((await admin('POST','/api/login',{json:{name:'admin',password:'mal'}})).status,401);
  const r=await admin('POST','/api/login',{json:{name:'admin',password:'admin-pass-1'}});assert.equal(r.data.user.role,'admin');
});
await t('petición sin cabecera anti-CSRF se rechaza',async()=>{assert.equal((await alba('POST','/api/logout',{csrf:false})).status,403)});

console.log('Subida de construcciones (rol usuario)');
let id;
await t('anónimo no puede crear; admin tampoco (solo texturas)',async()=>{
  assert.equal((await anon('POST','/api/builds',{json:{title:'Casa',category:'casa'}})).status,401);
  assert.equal((await admin('POST','/api/builds',{json:{title:'Casa',category:'casa'}})).status,403);
});
await t('crear borrador, validar categoría y título',async()=>{
  assert.equal((await alba('POST','/api/builds',{json:{title:'x',category:'casa'}})).status,400);
  assert.equal((await alba('POST','/api/builds',{json:{title:'Mi casa',category:'nada'}})).status,400);
  const r=await alba('POST','/api/builds',{json:{title:'Mi casa de prueba',description:'hola',category:'casa',tags:['Pequeña','Bedrock']}});assert.equal(r.status,200);id=r.data.id;
});
await t('no se puede publicar sin archivo ni imagen',async()=>{assert.equal((await alba('POST',`/api/builds/${id}/publish`)).status,400)});
await t('archivo inválido o con extensión no admitida se rechaza',async()=>{
  assert.equal((await alba('PUT',`/api/builds/${id}/file?name=x.nbt`,{raw:Buffer.from('basura que no es nbt')})).status,400);
  assert.equal((await alba('PUT',`/api/builds/${id}/file?name=x.exe`,{raw:mcstructure()})).status,400);
});
await t('otro usuario no puede tocar mi publicación',async()=>{assert.equal((await otro('PUT',`/api/builds/${id}/file?name=a.mcstructure`,{raw:mcstructure()})).status,403)});
await t('.mcstructure se analiza: Bedrock, 3x2x3, materiales',async()=>{
  const r=await alba('PUT',`/api/builds/${id}/file?name=casa.mcstructure`,{raw:mcstructure()});
  assert.equal(r.status,200);assert.equal(r.data.platform,'bedrock');assert.deepEqual(r.data.dims,{w:3,h:2,l:3});assert.equal(r.data.size,'small');assert.equal(r.data.total,12);
});
await t('imágenes: solo PNG/JPG/WEBP reales',async()=>{
  assert.equal((await alba('PUT',`/api/builds/${id}/images/1`,{raw:Buffer.from('<html>no soy imagen</html>'),type:'image/png'})).status,400);
  assert.equal((await alba('PUT',`/api/builds/${id}/images/1`,{raw:PNG1,type:'image/png'})).status,200);
  assert.equal((await alba('PUT',`/api/builds/${id}/images/9`,{raw:PNG1})).status,400);
});
await t('publicar',async()=>{assert.equal((await alba('POST',`/api/builds/${id}/publish`)).status,200)});

console.log('Catálogo: filtros y detalle');
await t('listado y filtros por plataforma, tipo, tamaño y texto',async()=>{
  const q=async s=>(await anon('GET','/api/builds?'+s)).data;
  assert.equal((await q('')).total,1);assert.equal((await q('platform=bedrock')).total,1);assert.equal((await q('platform=java')).total,0);
  assert.equal((await q('category=casa&size=small')).total,1);assert.equal((await q('category=castillo')).total,0);assert.equal((await q('size=huge')).total,0);
  assert.equal((await q('q=casa')).total,1);assert.equal((await q('q=alba')).total,1);assert.equal((await q('q=zzz')).total,0);
  assert.ok((await q('')).items[0].cover.includes('/images/1?v='));
});
await t('detalle con materiales; descarga idéntica; imagen servida',async()=>{
  const d=(await anon('GET',`/api/builds/${id}`)).data;
  const mats=Object.fromEntries(d.materials);assert.equal(mats.grass_block,9);assert.equal(mats.spruce_planks,1);assert.equal(d.file.ext,'.mcstructure');
  const f=await anon('GET',`/api/builds/${id}/file`);assert.ok(Buffer.compare(f.data,mcstructure())==0);
  const im=await anon('GET',`/api/builds/${id}/images/1`);assert.equal(im.headers.get('content-type'),'image/png');
});

console.log('Texturas globales (rol admin)');
const atlas={cols:2,rows:1,names:[['stone',1]],png:PNG1.toString('base64'),meta:{blocks:{stone:'stone'},terrain:{stone:['stone']},names:{stone:'Piedra'},tint:{}}};
await t('usuario no puede actualizar; anónimo tampoco',async()=>{
  assert.equal((await alba('POST','/api/admin/textures/bedrock',{json:atlas})).status,403);
  assert.equal((await anon('POST','/api/admin/textures/bedrock',{json:atlas})).status,401);
});
await t('validación del atlas',async()=>{
  assert.equal((await admin('POST','/api/admin/textures/bedrock',{json:{...atlas,png:Buffer.from('no png').toString('base64')}})).status,400);
  assert.equal((await admin('POST','/api/admin/textures/bedrock',{json:{...atlas,meta:undefined}})).status,400);
});
await t('admin publica; todos pueden leerlas (con ETag)',async()=>{
  assert.equal((await admin('POST','/api/admin/textures/bedrock',{json:atlas})).status,200);
  const s=(await anon('GET','/api/textures')).data;assert.equal(s.bedrock.count,1);assert.equal(s.java,null);assert.equal(s.bedrock.updatedBy,'admin');
  const ix=await anon('GET','/api/textures/bedrock/index.json');assert.equal(ix.data.meta.names.stone,'Piedra');
  const png=await anon('GET','/api/textures/bedrock/atlas.png');assert.equal(png.headers.get('content-type'),'image/png');
  const r2=await fetch(base+'/api/textures/bedrock/atlas.png',{headers:{'If-None-Match':png.headers.get('etag')}});assert.equal(r2.status,304);
});

console.log('Estáticos');
await t('sirve el sitio y no expone el servidor ni el almacenamiento',async()=>{
  assert.equal((await fetch(base+'/')).status,200);assert.equal((await fetch(base+'/data/aliases.json')).status,200);
  for(const p of ['/server/server.js','/storage/users.json','/storage/secret.key','/package.json','/../server/auth.js'])assert.equal((await fetch(base+p)).status,404,p);
});
await t('persistencia: al reiniciar siguen usuarios, obras y texturas',async()=>{
  await srv.close();const s2=await startServer({port:0,dir,log:()=>{}});
  const r=await fetch(`http://localhost:${s2.port}/api/builds`);assert.equal((await r.json()).total,1);
  const st=await s2.store.stats();assert.equal(st.users,3);assert.ok(await s2.store.getTexIndex('bedrock'));await s2.close();
});

/* ===== Edición y borrado (rol usuario, solo lo propio) ===== */
const srv2=await startServer({port:0,dir:fs.mkdtempSync(path.join(os.tmpdir(),'mcv2-')),adminPassword:'admin-pass-1',log:()=>{}});
const base2=`http://localhost:${srv2.port}`;
const cl=()=>{let cookie='';return async(method,url,{json,raw,type,hdr={}}={})=>{
  const h={'X-Requested-With':'fetch',...hdr};if(cookie)h.Cookie=cookie;let body;
  if(json!==undefined){body=JSON.stringify(json);h['Content-Type']='application/json'}if(raw){body=raw;h['Content-Type']=type||'application/octet-stream'}
  const r=await fetch(base2+url,{method,headers:h,body}),sc=r.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0].replace(/^sid=$/,'');
  const ct=r.headers.get('content-type')||'';return {status:r.status,headers:r.headers,data:ct.includes('json')?await r.json():Buffer.from(await r.arrayBuffer())};
}};
const A=cl(),B=cl(),AD=cl(),ANON=cl();
await A('POST','/api/register',{json:{name:'ana',password:'secret123'}});await B('POST','/api/register',{json:{name:'bruno',password:'secret123'}});
await AD('POST','/api/login',{json:{name:'admin',password:'admin-pass-1'}});
let bid,rev;
console.log('Edición y borrado');
await t('crear y publicar una obra con dos imágenes',async()=>{
  bid=(await A('POST','/api/builds',{json:{title:'Original',category:'casa',description:'v1',tags:['x']}})).data.id;
  assert.equal((await A('PUT',`/api/builds/${bid}/file?name=a.mcstructure`,{raw:mcstructure()})).status,200);
  assert.equal((await A('PUT',`/api/builds/${bid}/images/1`,{raw:PNG1,type:'image/png'})).status,200);
  assert.equal((await A('PUT',`/api/builds/${bid}/images/2`,{raw:JPG1,type:'image/jpeg'})).status,200);
  assert.equal((await A('POST',`/api/builds/${bid}/publish`)).status,200);
  const d=(await A('GET',`/api/builds/${bid}`)).data;rev=d.rev;assert.equal(d.mine,true);assert.equal(d.images.length,2);
  assert.equal((await B('GET',`/api/builds/${bid}`)).data.mine,false);
});
await t('PATCH: el dueño edita título, tipo, descripción y etiquetas; sube rev',async()=>{
  const r=await A('PATCH',`/api/builds/${bid}`,{json:{title:'Titulo nuevo',category:'castillo',description:'v2',tags:['a','b'],rev}});
  assert.equal(r.status,200);assert.equal(r.data.rev,rev+1);rev=r.data.rev;
  const d=(await ANON('GET',`/api/builds/${bid}`)).data;assert.deepEqual([d.title,d.category,d.description,d.tags],['Titulo nuevo','castillo','v2',['a','b']]);
  assert.equal((await ANON('GET','/api/builds?q=nuevo&category=castillo')).data.total,1);assert.equal((await ANON('GET','/api/builds?category=casa')).data.total,0);
});
await t('PATCH: validaciones y conflicto de versión (409)',async()=>{
  assert.equal((await A('PATCH',`/api/builds/${bid}`,{json:{title:'x'}})).status,400);
  assert.equal((await A('PATCH',`/api/builds/${bid}`,{json:{category:'nada'}})).status,400);
  assert.equal((await A('PATCH',`/api/builds/${bid}`,{json:{title:'Otra',rev:1}})).status,409);
  assert.equal((await A('PATCH','/api/builds/ffffffffffff',{json:{title:'Hola 123'}})).status,404);
});
await t('PATCH/DELETE: otro usuario, admin y anónimo NO pueden',async()=>{
  for(const [who,code] of [[B,403],[AD,403],[ANON,401]]){
    assert.equal((await who('PATCH',`/api/builds/${bid}`,{json:{title:'Hackeado'}})).status,code);
    assert.equal((await who('DELETE',`/api/builds/${bid}`)).status,code);
    assert.equal((await who('DELETE',`/api/builds/${bid}/images/1`)).status,code);
    assert.equal((await who('PUT',`/api/builds/${bid}/images/3`,{raw:PNG1,type:'image/png'})).status,code);
  }
  assert.equal((await ANON('GET',`/api/builds/${bid}`)).data.title,'Titulo nuevo');
});
await t('portada: se intercambia con otra imagen y la caché se invalida (?v=)',async()=>{
  const before=(await ANON('GET',`/api/builds/${bid}`)).data;assert.equal((await ANON('GET',before.images[0])).headers.get('content-type'),'image/png');
  const r=await A('POST',`/api/builds/${bid}/images/2/cover`);assert.equal(r.status,200);rev=r.data.rev;
  const d=(await ANON('GET',`/api/builds/${bid}`)).data;assert.notEqual(d.images[0],before.images[0]);
  assert.equal((await ANON('GET',d.images[0])).headers.get('content-type'),'image/jpeg');assert.equal((await ANON('GET',d.images[1])).headers.get('content-type'),'image/png');
  assert.ok((await ANON('GET',d.images[0])).headers.get('cache-control').includes('immutable'));
});
await t('imágenes: se puede borrar una; la última de una obra publicada no',async()=>{
  assert.equal((await A('DELETE',`/api/builds/${bid}/images/2`)).status,200);
  assert.equal((await ANON('GET',`/api/builds/${bid}`)).data.images.length,1);
  assert.equal((await A('DELETE',`/api/builds/${bid}/images/1`)).status,400);
  assert.equal((await A('DELETE',`/api/builds/${bid}/images/5`)).status,404);
});
await t('reemplazar el archivo: re-clasifica (Bedrock -> Java), recalcula materiales y borra el anterior',async()=>{
  const r=await A('PUT',`/api/builds/${bid}/file?name=nueva.nbt`,{raw:javaNbt()});
  assert.equal(r.status,200);assert.equal(r.data.platform,'java');assert.equal(r.data.total,4);
  const d=(await ANON('GET',`/api/builds/${bid}`)).data;assert.deepEqual(Object.fromEntries(d.materials),{stone:3,oak_planks:1});assert.equal(d.file.ext,'.nbt');
  assert.ok(Buffer.compare((await ANON('GET',`/api/builds/${bid}/file`)).data,javaNbt())==0);
  assert.equal((await ANON('GET','/api/builds?platform=java')).data.total,1);assert.equal((await ANON('GET','/api/builds?platform=bedrock')).data.total,0);
  assert.equal(await srv2.store.openBlob(bid,'file.mcstructure'),null);
});
await t('concurrencia HTTP: dos PATCH con la misma rev -> uno 200 y otro 409',async()=>{
  const rev0=(await A('GET',`/api/builds/${bid}`)).data.rev;
  const rs=await Promise.all([1,2].map(i=>A('PATCH',`/api/builds/${bid}`,{json:{title:'Carrera '+i,rev:rev0}})));
  assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);
});
await t('"Mis construcciones": incluye borradores y solo las propias',async()=>{
  const d2=(await A('POST','/api/builds',{json:{title:'Borrador mio',category:'torre'}})).data.id;
  const m=(await A('GET','/api/me/builds')).data;assert.equal(m.total,2);assert.ok(m.items.some(i=>i.id==d2&&i.status=='draft'));
  assert.equal((await B('GET','/api/me/builds')).data.total,0);assert.equal((await ANON('GET','/api/me/builds')).status,401);
  assert.equal((await ANON('GET',`/api/builds/${d2}`)).status,404);assert.equal((await A('GET',`/api/builds/${d2}`)).status,200);   // borrador: solo el dueño
});
await t('DELETE: el dueño borra; desaparece del catálogo, del detalle y del disco',async()=>{
  assert.equal((await A('DELETE',`/api/builds/${bid}`)).status,200);
  assert.equal((await ANON('GET',`/api/builds/${bid}`)).status,404);assert.equal((await ANON('GET','/api/builds')).data.total,0);
  assert.equal(await srv2.store.getBuild(bid),null);assert.equal(await srv2.store.openBlob(bid,'file.nbt'),null);
  assert.equal((await A('DELETE',`/api/builds/${bid}`)).status,404);
});

console.log('Escalabilidad y robustez');
await t('listado: ETag y 304; cabeceras de seguridad y CSP; health',async()=>{
  const r1=await fetch(base2+'/api/builds'),tag=r1.headers.get('etag');assert.ok(tag);
  assert.equal((await fetch(base2+'/api/builds',{headers:{'If-None-Match':tag}})).status,304);
  const home=await fetch(base2+'/');assert.ok(home.headers.get('content-security-policy').includes("script-src 'self' https://cdnjs.cloudflare.com"));
  assert.equal(home.headers.get('x-frame-options'),'DENY');
  const h=await (await fetch(base2+'/api/health')).json();assert.equal(h.ok,true);assert.ok(h.users>=3);
});
await t('respuestas grandes se comprimen con gzip',async()=>{
  for(let i=0;i<12;i++){const id=(await A('POST','/api/builds',{json:{title:'Obra de relleno '+i,category:'casa',description:'x'.repeat(10)}})).data.id;
    await A('PUT',`/api/builds/${id}/file?name=a.mcstructure`,{raw:mcstructure()});await A('PUT',`/api/builds/${id}/images/1`,{raw:PNG1,type:'image/png'});await A('POST',`/api/builds/${id}/publish`)}
  const r=await fetch(base2+'/api/builds?per=48',{headers:{'Accept-Encoding':'gzip'}});assert.equal(r.headers.get('content-encoding'),'gzip');assert.ok((await r.json()).total>=5);
});
await t('revocar sesiones: subir `sv` invalida la cookie existente',async()=>{
  const u=await srv2.store.getUserByName('bruno');assert.equal((await B('GET','/api/session')).data.user.name,'bruno');
  u.sv++;assert.equal((await B('GET','/api/session')).data.user,null);
});
await srv2.close();

/* límites configurables */
const srv3=await startServer({port:0,dir:fs.mkdtempSync(path.join(os.tmpdir(),'mcv3-')),adminPassword:'admin-pass-1',log:()=>{},limits:{draftsPerUser:2,writes:12,loginPerName:3}});
const C=(()=>{let ck='';return async(m,u,o={})=>{const h={'X-Requested-With':'fetch'};if(ck)h.Cookie=ck;let body;if(o.json){body=JSON.stringify(o.json);h['Content-Type']='application/json'}
  const r=await fetch(`http://localhost:${srv3.port}${u}`,{method:m,headers:h,body});const sc=r.headers.get('set-cookie');if(sc)ck=sc.split(';')[0];return {status:r.status,data:await r.json().catch(()=>null)}}})();
await t('cuota de borradores por usuario (429)',async()=>{
  await C('POST','/api/register',{json:{name:'cuota',password:'secret123'}});
  assert.equal((await C('POST','/api/builds',{json:{title:'Borrador 1',category:'casa'}})).status,200);assert.equal((await C('POST','/api/builds',{json:{title:'Borrador 2',category:'casa'}})).status,200);
  const r=await C('POST','/api/builds',{json:{title:'Borrador 3',category:'casa'}});assert.equal(r.status,429);assert.ok(r.data.error.includes('borradores'));
});
await t('límite de escrituras por usuario (429)',async()=>{
  let last=0;for(let i=0;i<20;i++)last=(await C('PATCH','/api/builds/ffffffffffff',{json:{title:'xxxx'}})).status;assert.equal(last,429);
});
await t('límite de intentos de login por usuario (429), aunque la IP sea la misma',async()=>{
  const x=[];for(let i=0;i<5;i++)x.push((await C('POST','/api/login',{json:{name:'cuota',password:'mala-clave'}})).status);
  assert.deepEqual(x,[401,401,401,429,429]);
});
await srv3.close();
console.log(`\n${ok} pruebas del servidor OK`);
fs.rmSync(dir,{recursive:true,force:true});process.exit(0);
