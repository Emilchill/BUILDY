/* Moderación (modo admin): todas las publicaciones, con búsqueda, filtro de estado, edición y borrado. Paginado en servidor. */
import {h,fmt,toast,confirmDialog} from '../ui.js';
import {api} from '../api.js';
import {auth,can} from '../auth.js';
import {labelOf,PLATFORMS} from '../../catalog.js';

export async function moderatePage(m,qs,app){
  if(!can('build:moderate')){app.append(h('div',{class:'empty'},'Esta sección es solo para administradores.'));return}
  const cats=auth.meta.categories,list=h('div',{class:'mine',id:'mod-list'}),more=h('button',{class:'btn sec',id:'mod-more'},'Cargar más'),count=h('p',{class:'muted',id:'mod-count'}),
    q=h('input',{id:'mod-q',type:'search',placeholder:'Buscar por título, etiqueta o autor…'}),
    st=h('select',{id:'mod-status'},h('option',{value:''},'Todas'),h('option',{value:'published'},'Publicadas'),h('option',{value:'draft'},'Borradores'));
  let page=1,timer;
  const row=b=>{
    const el=h('div',{class:'mine-row','data-id':b.id},
      h('div',{class:'mthumb'},b.cover?h('img',{src:b.cover,alt:b.title,loading:'lazy'}):h('div',{class:'noimg'},'Sin imagen')),
      h('div',{class:'minfo'},h('h3',{},b.title),
        h('div',{class:'chips'},h('span',{class:'chip status '+b.status},b.status=='published'?'Publicada':'Borrador'),h('span',{class:'chip'},'Autor: '+b.author),
          b.platform&&h('span',{class:'badge static '+b.platform},labelOf(PLATFORMS,b.platform)),h('span',{class:'chip'},labelOf(cats,b.category))),
        b.dims&&h('p',{class:'muted small'},`${b.dims.w}×${b.dims.h}×${b.dims.l} · ${fmt(b.total)} bloques`)),
      h('div',{class:'mactions'},
        h('a',{class:'btn sec m-view',href:'#/build/'+b.id},'Ver'),
        h('a',{class:'btn m-edit',href:'#/editar/'+b.id},'Editar'),
        h('button',{class:'btn danger m-del',onclick:async()=>{
          if(!await confirmDialog(`Modo admin: se eliminará «${b.title}» de ${b.author}, con su archivo e imágenes. No se puede deshacer.`))return;
          try{await api.del('/api/builds/'+b.id);el.remove();toast('Publicación eliminada','ok');if(!list.children.length)load(true)}catch(e){toast(e.message,'err')}}},'Eliminar')));
    return el;
  };
  async function load(reset){
    if(reset){page=1;list.replaceChildren()}
    const r=await api.get(`/api/admin/builds?page=${page}&status=${st.value}&q=${encodeURIComponent(q.value.trim())}`);
    r.items.forEach(b=>list.append(row(b)));count.textContent=`${r.total} ${r.total==1?'publicación':'publicaciones'}`;
    more.style.display=page<r.pages?'':'none';
    if(!r.total)list.replaceChildren(h('div',{class:'empty',id:'mod-empty'},'No hay publicaciones con ese filtro.'));
  }
  q.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>load(true),250)});st.addEventListener('change',()=>load(true));
  more.addEventListener('click',()=>{page++;load(false)});
  app.append(h('div',{class:'page-head'},h('h1',{},'Moderación'),h('span',{class:'admin-flag'},'MODO ADMIN')),
    h('p',{class:'muted'},'Puedes editar y eliminar cualquier publicación. Cada acción sobre contenido ajeno queda en el registro del servidor.'),
    h('div',{class:'mod-filters'},q,st),count,list,h('div',{class:'center'},more));
  await load(true);
}
