/* Utilidades de interfaz: creación de nodos, avisos, ventanas modales y carga diferida de scripts. */
export const h=(tag,attrs={},...kids)=>{
  const e=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(v==null||v===false)continue;
    if(k=='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(k=='html')e.innerHTML=v;else e.setAttribute(k,v===true?'':v);
  }
  for(const c of kids.flat())if(c!=null&&c!==false)e.append(c.nodeType?c:document.createTextNode(c));
  return e;
};
export const $=id=>document.getElementById(id);
export const fmt=n=>Number(n).toLocaleString('es');
export const fmtDate=t=>new Date(t).toLocaleDateString('es',{year:'numeric',month:'short',day:'numeric'});
export function toast(msg,kind=''){
  const t=$('toast');t.textContent=msg;t.className='show '+kind;clearTimeout(toast.t);toast.t=setTimeout(()=>t.className='',3500);
}
/* Ventana modal. Devuelve {el, close} */
export function modal(title,content,{wide=false,onclose}={}){
  const root=$('modal-root');
  const close=()=>{back.remove();document.removeEventListener('keydown',esc);onclose&&onclose()};
  const esc=e=>{if(e.key=='Escape')close()};
  const back=h('div',{class:'back',onclick:e=>{if(e.target==back)close()}},
    h('div',{class:'dialog'+(wide?' wide':''),role:'dialog','aria-label':title},
      h('div',{class:'dlg-head'},h('h2',{},title),h('button',{class:'icon',onclick:close,'aria-label':'Cerrar'},'✕')),content));
  document.addEventListener('keydown',esc);root.append(back);
  return {el:back,close};
}
const loaded={};
export const loadScript=src=>loaded[src]||(loaded[src]=new Promise((ok,bad)=>{const s=h('script',{src});s.onload=ok;s.onerror=()=>bad(new Error('No se pudo cargar '+src));document.head.append(s)}));
export const THREE_URL='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
export const JSZIP_URL='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

/* Confirmación (devuelve Promise<boolean>) */
export function confirmDialog(message,{ok='Eliminar',danger=true}={}){
  return new Promise(res=>{
    let done=false;const fin=v=>{if(done)return;done=true;m.close();res(v)};
    const body=h('div',{class:'form'},h('p',{},message),
      h('div',{class:'actions'},h('button',{class:'btn'+(danger?' danger':''),id:'c-yes',onclick:()=>fin(true)},ok),h('button',{class:'btn sec',id:'c-no',onclick:()=>fin(false)},'Cancelar')));
    const m=modal('¿Seguro?',body,{onclose:()=>{if(!done){done=true;res(false)}}});
  });
}
