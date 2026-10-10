/* Mis construcciones: borradores y publicadas, con acciones de editar y eliminar. */
import {h,fmt,toast,confirmDialog} from '../ui.js';
import {api} from '../api.js';
import {auth,can,openAuth} from '../auth.js';
import {labelOf,PLATFORMS} from '../../catalog.js';

export async function minePage(m,qs,app){
  if(!can('build:edit')){app.append(h('div',{class:'empty'},auth.user?'Tu rol no tiene publicaciones propias.':['Inicia sesión para ver tus construcciones. ',h('button',{class:'link',onclick:()=>openAuth('login')},'Iniciar sesión')]));return}
  const {categories:cats}=auth.meta,list=h('div',{class:'mine',id:'mine'}),more=h('button',{class:'btn sec',id:'more'},'Cargar más'),count=h('p',{class:'muted',id:'count'});
  let page=1;
  const row=b=>{
    const el=h('div',{class:'mine-row','data-id':b.id},
      h('div',{class:'mthumb'},b.cover?h('img',{src:b.cover,alt:b.title,loading:'lazy'}):h('div',{class:'noimg'},'Sin imagen')),
      h('div',{class:'minfo'},h('h3',{},b.title),
        h('div',{class:'chips'},h('span',{class:'chip status '+b.status},b.status=='published'?'Publicada':'Borrador'),
          b.platform&&h('span',{class:'badge static '+b.platform},labelOf(PLATFORMS,b.platform)),h('span',{class:'chip'},labelOf(cats,b.category))),
        b.dims&&h('p',{class:'muted small'},`${b.dims.w}×${b.dims.h}×${b.dims.l} · ${fmt(b.total)} bloques`)),
      h('div',{class:'mactions'},
        b.status=='published'&&h('a',{class:'btn sec m-view',href:'#/build/'+b.id},'Ver'),
        h('a',{class:'btn m-edit',href:'#/editar/'+b.id},'Editar'),
        h('button',{class:'btn danger m-del',onclick:async()=>{
          if(!await confirmDialog(`Se eliminará «${b.title}» con su archivo e imágenes. Esta acción no se puede deshacer.`))return;
          try{await api.del('/api/builds/'+b.id);el.remove();toast('Publicación eliminada','ok');if(!list.children.length)load(true)}catch(e){toast(e.message,'err')}}},'Eliminar')));
    return el;
  };
  async function load(reset){
    if(reset){page=1;list.replaceChildren()}
    const r=await api.get('/api/me/builds?page='+page);
    r.items.forEach(b=>list.append(row(b)));count.textContent=r.total?`${r.total} ${r.total==1?'construcción':'construcciones'}`:'';
    more.style.display=page<r.pages?'':'none';
    if(!r.total)list.replaceChildren(h('div',{class:'empty',id:'empty'},'Todavía no has subido nada. ',h('a',{href:'#/subir'},'Sube tu primera construcción')));
  }
  more.addEventListener('click',()=>{page++;load(false)});
  app.append(h('div',{class:'page-head'},h('h1',{},'Mis construcciones'),h('a',{class:'btn',href:'#/subir'},'Subir nueva')),count,list,h('div',{class:'center'},more));
  await load(true);
}
