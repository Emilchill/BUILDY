/* Lista de materiales: SIEMPRE en pilas; opcionalmente en cajas de shulker cuando la obra es grande. */
import {h,fmt} from './ui.js';
import {prettify,stackSize,stackText,packShulkers,sortRows,toCSV,SHULKER_SLOTS} from '../materials.js';
import {swatch} from './swatch.js';

export function materialsView({materials,nameOf=()=>null,tex=null,filename='materiales'}){
  const rows=materials.map(([id,count])=>({id,name:nameOf(id)||prettify(id),count}));
  const total=rows.reduce((a,r)=>a+r.count,0),stacksTotal=rows.reduce((a,r)=>a+Math.ceil(r.count/stackSize(r.id)),0);
  const pack=packShulkers(rows);
  let mode='stacks',q='',by='count';
  const body=h('div',{class:'mat-body'}),tabs=h('div',{class:'seg',id:'mat-tabs'}),search=h('input',{type:'search',id:'mat-q',placeholder:'Buscar bloque…'});
  const sortSel=h('select',{id:'mat-sort'},h('option',{value:'count'},'Más cantidad'),h('option',{value:'name'},'A–Z'));

  const stacksList=()=>{
    const list=sortRows(rows,by).filter(r=>!q||r.name.toLowerCase().includes(q)||r.id.includes(q));
    return h('table',{class:'mat'},h('thead',{},h('tr',{},h('th',{},''),h('th',{},'Bloque'),h('th',{class:'num'},'Cantidad'),h('th',{},'En pilas'))),
      h('tbody',{},list.map(r=>h('tr',{},h('td',{},swatch(tex,r.id)),h('td',{title:r.id},r.name),h('td',{class:'num'},fmt(r.count)),
        h('td',{class:'stack'},stackText(r.count,stackSize(r.id)),stackSize(r.id)!=64&&h('span',{class:'muted'},` (pila de ${stackSize(r.id)})`))))));
  };
  const shulkers=()=>h('div',{},
    h('p',{class:'muted'},`${fmt(pack.slots)} huecos ocupados → ${pack.shulkers} ${pack.shulkers==1?'shulker':'shulkers'} de ${SHULKER_SLOTS} huecos (ordenados de más a menos cantidad).`),
    h('div',{class:'shulkers'},pack.boxes.map((box,i)=>h('section',{class:'shulker'},
      h('h4',{},`Shulker ${i+1} de ${pack.shulkers}`,h('span',{class:'muted'},` · ${box.length}/${SHULKER_SLOTS}`)),
      h('div',{class:'slots'},Array.from({length:SHULKER_SLOTS},(_,k)=>{const s=box[k];
        return h('div',{class:'slot'+(s?'':' empty'),title:s?`${s.name}: ${s.n}`:''},s&&swatch(tex,s.id),s&&h('span',{class:'n'},s.n))}))))));

  const draw=()=>{
    tabs.replaceChildren(h('button',{class:mode=='stacks'?'on':'',id:'tab-stacks',onclick:()=>{mode='stacks';draw()}},'En pilas'),
      pack.big?h('button',{class:mode=='shulkers'?'on':'',id:'tab-shulkers',onclick:()=>{mode='shulkers';draw()}},`En shulkers (${pack.shulkers})`)
        :h('span',{class:'muted',id:'small-note'},`Cabe en 1 shulker (${pack.slots}/${SHULKER_SLOTS} huecos)`));
    search.style.display=sortSel.style.display=mode=='stacks'?'':'none';
    body.replaceChildren(mode=='stacks'?stacksList():shulkers());
  };
  search.addEventListener('input',()=>{q=search.value.trim().toLowerCase();draw()});
  sortSel.addEventListener('change',()=>{by=sortSel.value;draw()});
  const csv=h('button',{class:'btn sec',id:'mat-csv',onclick:()=>{
    const a=h('a',{href:URL.createObjectURL(new Blob(['\uFEFF'+toCSV(sortRows(rows,'count'))],{type:'text/csv'})),download:filename+'.csv'});a.click();
  }},'Descargar CSV');
  draw();
  return h('section',{class:'card-box',id:'materials'},
    h('div',{class:'mat-head'},h('div',{},h('h2',{},'Lista de materiales'),
      h('p',{class:'muted'},`${fmt(total)} bloques · ${rows.length} tipos · ${fmt(stacksTotal)} pilas`)),csv),
    h('div',{class:'tools'},tabs,search,sortSel),body);
}
