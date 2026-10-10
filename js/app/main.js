/* Punto de entrada del sitio. */
import {setAliases} from '../blocks/bedrock.js';
import {initAuth} from './auth.js';
import {route,start} from './router.js';
import {catalogPage} from './pages/catalog.js';
import {buildPage} from './pages/build.js';
import {uploadPage} from './pages/upload.js';
import {adminPage} from './pages/admin.js';
import {minePage} from './pages/mine.js';
import {editPage} from './pages/edit.js';

route(/^\/$/,catalogPage);
route(/^\/build\/([a-f0-9]+)$/,buildPage);
route(/^\/subir$/,uploadPage);
route(/^\/admin$/,adminPage);
route(/^\/mias$/,minePage);
route(/^\/editar\/([a-f0-9]+)$/,editPage);
(async()=>{
  try{setAliases(await (await fetch('/data/aliases.json')).json())}catch(e){console.warn('Sin aliases',e)}
  await initAuth();await start();
})();
