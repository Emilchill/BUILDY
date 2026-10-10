/* Ficha de una construcción: fotos, datos, visor 3D opcional y lista de materiales en pilas. */
import {h,fmt,fmtDate,toast,confirmDialog} from '../ui.js';
import {api} from '../api.js';
import {auth} from '../auth.js';
import {labelOf,PLATFORMS} from '../../catalog.js';
import {materialsView} from '../materials-view.js';
import {globalSources,pickSource,nameFn} from '../textures-global.js';
import {openViewer} from '../viewer-panel.js';

export async function buildPage(m,qs,app){
  const b=await api.get('/api/builds/'+m[1]),src=await globalSources().catch(()=>({})),tex=pickSource(src,b.platform);
  const {categories:cats,sizes}=auth.meta;
  const main=h('img',{class:'main-img',id:'main-img',src:b.images[0],alt:b.title});
  const thumbs=h('div',{class:'thumbs'},b.images.map((u,i)=>h('img',{src:u,alt:`Imagen ${i+1}`,loading:'lazy',onclick:()=>{main.src=u}})));
  const row=(k,v)=>[h('dt',{},k),h('dd',{},v)];
  app.append(
    h('a',{class:'back-link',href:'#/'},'← Volver al catálogo'),
    h('div',{class:'detail'},
      h('div',{class:'gallery'},main,b.images.length>1&&thumbs),
      h('div',{class:'info'},
        h('h1',{id:'b-title'},b.title),
        h('div',{class:'chips'},h('span',{class:'badge static '+b.platform},labelOf(PLATFORMS,b.platform)),h('span',{class:'chip'},labelOf(cats,b.category)),h('span',{class:'chip'},'Tamaño '+labelOf(sizes,b.size).toLowerCase()),
          b.tags.map(t=>h('span',{class:'chip tag'},'#'+t))),
        b.description&&h('p',{class:'desc'},b.description),
        h('dl',{class:'facts'},row('Autor',b.author),row('Publicado',fmtDate(b.createdAt)),row('Dimensiones',`${b.dims.w} × ${b.dims.h} × ${b.dims.l}`),
          row('Bloques',fmt(b.total)),row('Tipos de bloque',b.types),row('Archivo',`${b.file.name} (${(b.file.size/1024).toFixed(0)} KB)`)),
        h('div',{class:'actions'},
          h('button',{class:'btn',id:'open-3d',onclick:()=>openViewer(b)},'Ver en 3D'),
          h('a',{class:'btn sec',id:'download',href:`/api/builds/${b.id}/file`,download:b.file.name},'Descargar archivo'),
          b.mine&&h('a',{class:'btn sec',id:'b-edit',href:'#/editar/'+b.id},'Editar'),
          b.mine&&h('button',{class:'btn danger',id:'b-del',onclick:async()=>{
            if(!await confirmDialog(`Se eliminará «${b.title}» con su archivo e imágenes. Esta acción no se puede deshacer.`))return;
            try{await api.del('/api/builds/'+b.id);toast('Publicación eliminada','ok');location.hash='#/'}catch(e){toast(e.message,'err')}}},'Eliminar')))),
    materialsView({materials:b.materials,nameOf:nameFn(src),tex,filename:'materiales-'+b.id}));
}
