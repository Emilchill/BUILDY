/* Catálogo: filtros por plataforma, tipo de construcción y tamaño; búsqueda y orden. */
import {h,fmt} from '../ui.js';
import {api} from '../api.js';
import {auth,can,openAuth} from '../auth.js';
import {labelOf,PLATFORMS} from '../../catalog.js';

export function card(b,cats,sizes){
  return h('a',{class:'card',href:'#/build/'+b.id,'data-id':b.id},
    h('div',{class:'thumb'},b.cover?h('img',{src:b.cover,alt:b.title,loading:'lazy'}):h('div',{class:'noimg'},'Sin imagen'),
      h('span',{class:'badge '+b.platform},labelOf(PLATFORMS,b.platform))),
    h('div',{class:'card-body'},h('h3',{},b.title),
      h('div',{class:'chips'},h('span',{class:'chip'},labelOf(cats,b.category)),h('span',{class:'chip'},labelOf(sizes,b.size))),
      h('p',{class:'muted small'},`${b.dims.w}×${b.dims.h}×${b.dims.l} · ${fmt(b.total)} bloques`),
      h('p',{class:'muted small'},'por '+b.author)));
}

export async function catalogPage(m,qs,app){
  const {categories:cats,sizes}=auth.meta;
  const st={platform:qs.get('platform')||'',category:qs.get('category')||'',size:qs.get('size')||'',sort:qs.get('sort')||'recent',q:qs.get('q')||'',page:1};
  const seg=h('div',{class:'seg',id:'f-platform'}),grid=h('div',{class:'grid',id:'grid'}),count=h('p',{class:'muted',id:'count'}),more=h('button',{class:'btn sec',id:'more'},'Cargar más');
  const sel=(id,label,opts,key)=>{const s=h('select',{id,'aria-label':label},h('option',{value:''},label),opts.map(o=>h('option',{value:o[0]},o[1]+(o[2]?` (${o[2]})`:''))));s.value=st[key];
    s.addEventListener('change',()=>{st[key]=s.value;load(true)});return s};
  const search=h('input',{type:'search',id:'f-q',placeholder:'Buscar por título, etiqueta o autor…',value:st.q});
  let timer;search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{st.q=search.value.trim();load(true)},300)});
  const drawSeg=()=>seg.replaceChildren(...[['','Todos'],...PLATFORMS].map(([v,l])=>h('button',{class:st.platform==v?'on':'','data-v':v,onclick:()=>{st.platform=v;drawSeg();load(true)}},l)));
  drawSeg();
  const sort=h('select',{id:'f-sort','aria-label':'Ordenar'},[['recent','Más recientes'],['blocks','Más bloques'],['size','Más grandes'],['name','A–Z']].map(o=>h('option',{value:o[0]},o[1])));
  sort.value=st.sort;sort.addEventListener('change',()=>{st.sort=sort.value;load(true)});

  app.append(
    h('section',{class:'hero'},h('h1',{},'Construcciones de Minecraft'),h('p',{class:'muted'},'Explora estructuras de Bedrock y Java, mira sus fotos, revisa la lista de materiales y ábrelas en 3D.')),
    h('div',{class:'filters'},seg,sel('f-cat','Tipo de construcción',cats,'category'),sel('f-size','Tamaño',sizes,'size'),sort,search),
    count,grid,h('div',{class:'center'},more));

  async function load(reset){
    if(reset){st.page=1;grid.replaceChildren()}
    const p=new URLSearchParams({platform:st.platform,category:st.category,size:st.size,q:st.q,sort:st.sort,page:st.page});
    for(const [k,v] of [...p])if(!v||(k=='page'))p.delete(k);
    history.replaceState(null,'','#/'+(p.toString()?'?'+p:''));
    const q=new URLSearchParams({platform:st.platform,category:st.category,size:st.size,q:st.q,sort:st.sort,page:st.page});
    const r=await api.get('/api/builds?'+q);
    r.items.forEach(b=>grid.append(card(b,cats,sizes)));
    count.textContent=r.total?`${fmt(r.total)} ${r.total==1?'construcción':'construcciones'}`:'';
    more.style.display=st.page<r.pages?'':'none';
    if(!r.total)grid.replaceChildren(h('div',{class:'empty',id:'empty'},'Aún no hay construcciones con esos filtros. ',
      can('build:create')?h('a',{href:'#/subir'},'Sube la primera'):!auth.user?h('button',{class:'link',onclick:()=>openAuth('register')},'Crea una cuenta para publicar'):null));
  }
  more.addEventListener('click',()=>{st.page++;load(false)});
  await load(true);
}
