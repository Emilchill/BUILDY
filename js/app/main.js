/* Punto de entrada del sitio. */
import {setAliases} from '../blocks/bedrock.js';
import {initAuth} from './auth.js';
import {detect,isLocal} from './api.js';
import {route,start} from './router.js';
import {catalogPage} from './pages/catalog.js';
import {buildPage} from './pages/build.js';
import {uploadPage} from './pages/upload.js';
import {adminPage} from './pages/admin.js';
import {minePage} from './pages/mine.js';
import {editPage} from './pages/edit.js';
import {moderatePage} from './pages/moderate.js';

route(/^\/$/,catalogPage);
route(/^\/build\/([a-f0-9]+)$/,buildPage);
route(/^\/subir$/,uploadPage);
route(/^\/admin$/,adminPage);
route(/^\/mias$/,minePage);
route(/^\/moderar$/,moderatePage);
route(/^\/editar\/([a-f0-9]+)$/,editPage);
(async()=>{
  try{setAliases(await (await fetch('data/aliases.json')).json())}catch(e){console.warn('Sin aliases',e)}
  await detect();await initAuth();
  if(isLocal()){const b=document.createElement('div');b.id='local-banner';b.className='local-banner';
    b.textContent='Modo local (sitio sin servidor): lo que publiques se guarda solo en este navegador. Admin de prueba: admin / admin12345.';
    document.querySelector('main').before(b)}
  await start();
})();
