/* Prueba de interfaz con jsdom contra el servidor real: node tests/ui.mjs (requiere: npm i -D jsdom) */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {startServer} from '../server/server.js';
import {mcstructure,PNG1} from './fixtures.mjs';

let JSDOM;try{({JSDOM}=await import('jsdom'))}catch{console.log('jsdom no instalado: se omiten las pruebas de interfaz (npm i -D jsdom)');process.exit(0)}
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mcv-ui-'));
const {server,port}=await startServer({port:0,dir,adminPassword:'admin-pass-1',log:()=>{}});
const base=`http://localhost:${port}`;

/* sembrar una obra por la API */
const jar={};const real=globalThis.fetch;
const f=async(url,o={})=>{
  const headers={'X-Requested-With':'fetch',...(o.headers||{})};const c=Object.entries(jar).map(([k,v])=>k+'='+v).join('; ');if(c)headers.Cookie=c;
  const r=await real(url.startsWith('http')?url:base+url,{...o,headers});
  const sc=r.headers.get('set-cookie');if(sc){const [kv]=sc.split(';'),[k,...v]=kv.split('=');if(v.join('='))jar[k]=v.join('=');else delete jar[k]}
  return r;
};
const J=(url,body)=>f(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
await J('/api/register',{name:'alba',password:'secret123'});
const {id}=await (await J('/api/builds',{title:'Casa de prueba UI',description:'desc',category:'casa',tags:['uno']})).json();
await f(`/api/builds/${id}/file?name=casa.mcstructure`,{method:'PUT',body:mcstructure()});
await f(`/api/builds/${id}/images/1`,{method:'PUT',body:PNG1,headers:{'Content-Type':'image/png'}});
await J(`/api/builds/${id}/publish`);
await J('/api/logout');

/* entorno de navegador */
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8').replace(/<script[^>]*><\/script>/g,'');
const dom=new JSDOM(html,{url:base+'/',pretendToBeVisual:true});const w=dom.window;
Object.assign(globalThis,{window:w,document:w.document,location:w.location,history:w.history,addEventListener:w.addEventListener.bind(w),Event:w.Event});
w.scrollTo=()=>{};URL.createObjectURL=()=>'blob:x';w.HTMLCanvasElement.prototype.getContext=()=>null;
globalThis.fetch=f;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const until=async(fn,what)=>{for(let i=0;i<200;i++){try{const v=fn();if(v)return v}catch{}await new Promise(r=>setTimeout(r,25))}throw new Error('tiempo agotado: '+what)};
let ok=0;const t=async(n,fn)=>{await fn();ok++;console.log('  ✓',n)};
const click=el=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const type=(el,v)=>{el.value=v;el.dispatchEvent(new w.Event('input',{bubbles:true}));el.dispatchEvent(new w.Event('change',{bubbles:true}))};

await import('../js/app/main.js');

console.log('Catálogo');
await t('botón "Iniciar sesión (beta)" arriba a la derecha y navegación pública',async()=>{
  await until(()=>$('#login-btn'),'botón login');
  assert.ok($('#login-btn').textContent.includes('Iniciar sesión')&&$('#login-btn').textContent.toLowerCase().includes('beta'));
  assert.deepEqual($$('#nav a').map(a=>a.textContent),['Catálogo']);
});
await t('muestra la tarjeta con plataforma, tamaño y datos',async()=>{
  const c=await until(()=>$('.card'),'tarjeta');
  assert.ok(c.textContent.includes('Casa de prueba UI')&&c.textContent.includes('Bedrock')&&c.textContent.includes('Pequeña')&&c.textContent.includes('3×2×3'));
});
await t('filtros: plataforma, tipo y tamaño',async()=>{
  click($('#f-platform [data-v="java"]'));await until(()=>$('#empty'),'vacío Java');
  click($('#f-platform [data-v="bedrock"]'));await until(()=>$('.card'),'Bedrock');
  type($('#f-cat'),'castillo');await until(()=>$('#empty'),'vacío castillo');
  type($('#f-cat'),'casa');type($('#f-size'),'small');await until(()=>$('.card'),'casa pequeña');
  type($('#f-size'),'huge');await until(()=>$('#empty'),'vacío enorme');type($('#f-size'),'');await until(()=>$('.card'),'sin filtro');
});

console.log('Ficha');
await t('ficha con imagen, 3D opcional, descarga y materiales en pilas',async()=>{
  click($('.card'));await until(()=>$('#b-title'),'ficha');
  assert.equal($('#b-title').textContent,'Casa de prueba UI');assert.ok($('#main-img').src.includes('/images/1'));
  assert.ok($('#open-3d'));assert.ok($('#download').getAttribute('href').endsWith('/file'));
  const rows=$$('table.mat tbody tr');assert.equal(rows.length,4);assert.ok($('table.mat').textContent.includes('Grass block'));
  assert.ok($('table.mat th:last-child').textContent.includes('pilas'));assert.ok($('#small-note'));assert.equal($('#tab-shulkers'),null);
});
await t('lista grande: aparece la opción de shulkers y se reparte en cajas',async()=>{
  const {materialsView}=await import('../js/app/materials-view.js');
  const big=materialsView({materials:[['stone',64*40],['oak_planks',64*10],['oak_sign',33]]});document.body.append(big);
  assert.ok(big.querySelector('#tab-shulkers')&&!big.querySelector('#small-note'));
  click(big.querySelector('#tab-shulkers'));
  assert.equal(big.querySelectorAll('.shulker').length,2);assert.equal(big.querySelectorAll('.slot').length,54);assert.ok(big.textContent.includes('2 shulkers'));
  click(big.querySelector('#tab-stacks'));assert.ok(big.querySelector('table.mat').textContent.includes('40 × 64'));big.remove();
});

console.log('Sesión y roles');
await t('admin: ve "Texturas globales"; no puede subir construcciones',async()=>{
  click($('#login-btn'));await until(()=>$('#f-name'),'modal');
  $('#f-name').value='admin';$('#f-pass').value='admin-pass-1';click($('#f-submit'));
  await until(()=>$('#logout-btn'),'sesión admin');
  assert.ok($('.who').textContent.includes('Administrador'));
  assert.deepEqual($$('#nav a').map(a=>a.textContent),['Catálogo','Moderación','Texturas globales']);assert.ok($('#admin-flag'));
  location.hash='#/subir';await until(()=>$('.empty')&&$('.empty').textContent.includes('no puede subir'),'sin permiso subir');
  location.hash='#/admin';await until(()=>$('#a-file'),'panel de texturas');
  assert.ok($('.notice').textContent.includes('EULA'));assert.ok($('#a-cur-bedrock').textContent.includes('Sin texturas'));
});
await t('admin (modo admin): modera publicaciones ajenas — ver, editar y eliminar',async()=>{
  location.hash='#/moderar';const row=await until(()=>$('#mod-list .mine-row'),'lista de moderación');
  assert.ok(row.textContent.includes('Casa de prueba UI')&&row.textContent.includes('Autor: alba'));
  location.hash='#/build/'+id;await until(()=>$('#b-edit')&&$('#b-del'),'admin ve Editar y Eliminar en la ficha');
  click($('#b-edit'));await until(()=>$('#e-mod'),'edición en modo admin');assert.ok($('#e-mod').textContent.includes('alba'));
  $('#e-title').value='Casa moderada';click($('#e-save'));await until(()=>$('#toast').textContent.includes('Cambios guardados'),'guardado por el admin');
  assert.equal((await (await f('/api/builds/'+id)).json()).title,'Casa moderada');
  location.hash='#/moderar';await until(()=>$('#mod-list .mine-row h3')&&$('#mod-list .mine-row h3').textContent=='Casa moderada','lista actualizada');
  const cur=await (await f('/api/builds/'+id)).json();      // restaurar el título para las pruebas siguientes
  await f('/api/builds/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Casa de prueba UI',rev:cur.rev})});
});
await t('usuario: ve "Subir construcción"; no ve el panel de texturas',async()=>{
  click($('#logout-btn'));await until(()=>$('#login-btn'),'logout');
  click($('#login-btn'));await until(()=>$('#f-name'),'modal');
  $('#f-name').value='alba';$('#f-pass').value='secret123';click($('#f-submit'));await until(()=>$('#logout-btn'),'sesión usuario');
  assert.ok($('.who').textContent.includes('Usuario'));assert.deepEqual($$('#nav a').map(a=>a.textContent),['Catálogo','Subir construcción','Mis construcciones']);
  location.hash='#/subir';await until(()=>$('#u-send'),'formulario');
  assert.ok($('#u-cat').options.length>10);assert.ok($('#u-file').accept.includes('.mcstructure'));assert.ok($('#u-imgs').multiple);
  location.hash='#/admin';await until(()=>$('.empty')&&$('.empty').textContent.includes('solo para administradores'),'bloqueado');
});
await t('mis construcciones: listar, editar (título/tipo/etiquetas) y ver el cambio',async()=>{
  location.hash='#/mias';const row=await until(()=>$('.mine-row'),'mis construcciones');
  assert.ok(row.textContent.includes('Casa de prueba UI')&&row.textContent.includes('Publicada'));
  click($('.m-edit'));await until(()=>$('#e-save'),'página de edición');
  assert.equal($('#e-title').value,'Casa de prueba UI');assert.equal($$('.img-cell').length,1);
  assert.equal($('.img-del').disabled,true);                       // la última imagen de una obra publicada no se puede quitar
  type($('#e-title'),'Casa editada desde la UI');type($('#e-cat'),'torre');type($('#e-tags'),'moderna, grande');click($('#e-save'));
  await until(()=>$('#toast').textContent.includes('Cambios guardados'),'guardado');
  location.hash='#/';await until(()=>$('.card'),'catálogo');assert.ok($('.card').textContent.includes('Casa editada desde la UI')&&$('.card').textContent.includes('Torre'));
  type($('#f-q'),'moderna');await until(()=>$('.card'),'búsqueda por etiqueta nueva');
});
await t('detalle del dueño muestra Editar y Eliminar',async()=>{
  click($('.card'));await until(()=>$('#b-title'),'ficha');assert.ok($('#b-edit')&&$('#b-del'));
});
await t('eliminar con confirmación: cancelar no borra; confirmar sí',async()=>{
  click($('#b-del'));await until(()=>$('#c-no'),'confirmación');click($('#c-no'));await until(()=>!$('#c-no'),'cerrada');assert.ok($('#b-title'));
  click($('#b-del'));await until(()=>$('#c-yes'),'confirmación');click($('#c-yes'));
  await until(()=>$('#empty'),'catálogo vacío tras borrar');
  const r=await (await fetch('/api/builds')).json();assert.equal(r.total,0);
  location.hash='#/mias';await until(()=>$('#empty'),'mis construcciones vacío');
});
await t('registro desde la interfaz crea rol Usuario; error con contraseña corta',async()=>{
  click($('#logout-btn'));await until(()=>$('#login-btn'),'logout');
  click($('#login-btn'));await until(()=>$('#f-switch'),'modal');click($('#f-switch'));await until(()=>$('#f-submit').textContent=='Crear cuenta','pestaña registro');
  $('#f-name').value='carla';$('#f-pass').value='corta';click($('#f-submit'));await until(()=>$('#f-err').textContent.includes('8 y 72'),'error');
  $('#f-pass').value='contraseña-larga';click($('#f-submit'));await until(()=>$('#logout-btn'),'registrada');assert.ok($('.who').textContent.includes('Usuario'));
});
console.log(`\n${ok} pruebas de interfaz OK`);
server.close();fs.rmSync(dir,{recursive:true,force:true});process.exit(0);
