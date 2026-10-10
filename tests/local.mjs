/* Modo local (sitio estático, p. ej. GitHub Pages): la interfaz completa SIN servidor, con jsdom.  node tests/local.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mcstructure,PNG1} from './fixtures.mjs';
import {memoryBackend} from '../js/app/local/store.js';

let JSDOM;try{({JSDOM}=await import('jsdom'))}catch{console.log('jsdom no instalado: se omite');process.exit(0)}
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8').replace(/<script[^>]*><\/script>/g,'');
const dom=new JSDOM(html,{url:'https://emilchill.github.io/BUILDY/',pretendToBeVisual:true});const w=dom.window;
Object.assign(globalThis,{window:w,document:w.document,location:w.location,history:w.history,addEventListener:w.addEventListener.bind(w),Event:w.Event});
w.scrollTo=()=>{};let n=0;URL.createObjectURL=()=>'blob:local-'+(n++);w.HTMLCanvasElement.prototype.getContext=()=>null;
globalThis.__MC_LOCAL_BACKEND=memoryBackend();
const real=globalThis.fetch;                                  // GitHub Pages: no hay /api -> 404 (aquí: fallo de red) y sí hay archivos estáticos
globalThis.fetch=async u=>{if(String(u).startsWith('data/aliases.json'))return new Response(fs.readFileSync(path.join(ROOT,'data/aliases.json')),{headers:{'content-type':'application/json'}});
  return new Response('<html>404</html>',{status:404,headers:{'content-type':'text/html'}})};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const until=async(fn,what)=>{for(let i=0;i<200;i++){try{const v=fn();if(v)return v}catch{}await new Promise(r=>setTimeout(r,25))}throw new Error('tiempo agotado: '+what)};
const click=el=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
let ok=0;const t=async(nm,fn)=>{await fn();ok++;console.log('  ✓',nm)};

await import('../js/app/main.js');
const {api,isLocal}=await import('../js/app/api.js');

console.log('Modo local (sin servidor)');
await t('sin /api: aparece el botón de login y el aviso de modo local',async()=>{
  await until(()=>$('#login-btn'),'botón login');assert.equal(isLocal(),true);assert.ok($('#local-banner').textContent.includes('Modo local'));
});
await t('login admin hardcode con un clic ("Entrar como admin"): modo admin y Moderación',async()=>{
  click($('#login-btn'));await until(()=>$('#dev-fill'),'pista admin');click($('#dev-fill'));
  await until(()=>$('#admin-flag'),'modo admin');
  assert.deepEqual($$('#nav a').map(a=>a.textContent),['Catálogo','Moderación','Texturas globales']);
});
await t('contraseña incorrecta del admin se rechaza',async()=>{
  click($('#logout-btn'));await until(()=>$('#login-btn'),'logout');click($('#login-btn'));await until(()=>$('#f-name'),'modal');
  $('#f-name').value='admin';$('#f-pass').value='mala-clave-1';click($('#f-submit'));await until(()=>$('#f-err').textContent.includes('incorrectos'),'error');
  click($('.dlg-head .icon'));
});
await t('registro de usuario, subida (archivo + imagen) y publicación en el catálogo',async()=>{
  click($('#login-btn'));await until(()=>$('#f-switch'),'modal');click($('#f-switch'));
  await until(()=>$('#f-submit').textContent=='Crear cuenta','registro');$('#f-name').value='luis';$('#f-pass').value='secret123';click($('#f-submit'));
  await until(()=>$('#logout-btn'),'sesión usuario');
  const {id}=await api.post('/api/builds',{title:'Casa local',category:'casa',description:'hecha en el navegador',tags:['uno']});
  const a=await api.put(`/api/builds/${id}/file?name=casa.mcstructure`,new Uint8Array(mcstructure()));assert.equal(a.platform,'bedrock');assert.equal(a.total>0,true);
  await api.put(`/api/builds/${id}/images/1`,new Uint8Array(PNG1),'image/png');await api.post(`/api/builds/${id}/publish`);
  location.hash='#/';await until(()=>$('.card')&&$('.card').textContent.includes('Casa local'),'tarjeta');
  assert.ok($('.card img').getAttribute('src').startsWith('blob:'));
  globalThis.__id=id;
});
await t('el usuario edita su obra y ve el cambio; el archivo se descarga del navegador',async()=>{
  location.hash='#/mias';await until(()=>$('.m-edit'),'mis construcciones');click($('.m-edit'));await until(()=>$('#e-save'),'edición');
  $('#e-title').value='Casa local v2';click($('#e-save'));await until(()=>$('#toast').textContent.includes('Cambios guardados'),'guardado');
  const bl=await api.blob(`/api/builds/${globalThis.__id}/file`);assert.ok(bl.size>0);
});
await t('persistencia: al "recargar" (nuevo servidor local sobre el mismo almacén) los datos siguen',async()=>{
  const {createLocalServer}=await import('../js/app/local/server.js');const s2=await createLocalServer({backend:globalThis.__MC_LOCAL_BACKEND});
  const r=await s2.handle('GET','/api/builds');assert.equal(r.total,1);assert.equal(r.items[0].title,'Casa local v2');
});
await t('el admin modera: ve la obra de luis, la edita y la elimina',async()=>{
  click($('#logout-btn'));await until(()=>$('#login-btn'),'logout');click($('#login-btn'));await until(()=>$('#dev-fill'),'modal');click($('#dev-fill'));await until(()=>$('#admin-flag'),'admin');
  location.hash='#/moderar';const row=await until(()=>$('#mod-list .mine-row'),'moderación');assert.ok(row.textContent.includes('Autor: luis'));
  click($('.m-del'));await until(()=>$('.dialog'),'confirmación');
  click($$('.dialog button').find(b=>/eliminar|aceptar|sí|confirmar/i.test(b.textContent))||$$('.dialog button').pop());
  await until(()=>$('#mod-empty'),'obra eliminada');assert.equal((await api.get('/api/builds')).total,0);
});
await t('un usuario normal no entra a /api/admin/builds (403)',async()=>{
  click($('#logout-btn'));await until(()=>$('#login-btn'),'logout');
  await assert.rejects(()=>api.get('/api/admin/builds'),e=>e.status==401);
});
console.log(`\n${ok} pruebas del modo local OK`);process.exit(0);
