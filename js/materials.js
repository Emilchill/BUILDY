/* Lista de materiales: filas con nombre, cantidad y stacks; exportación a CSV. */
export const prettify=id=>id.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
export function buildMaterials(M,nameOf=prettify){
  return M.names.map((id,i)=>({i,id,name:nameOf(id)||prettify(id),count:M.counts[i]})).filter(r=>r.count>0);
}
export const stacks=(c,size=64)=>({s:Math.floor(c/size),r:c%size});
export function sortRows(rows,by){
  const f={count:(a,b)=>b.count-a.count,name:(a,b)=>a.name.localeCompare(b.name,'es')}[by]||(()=>0);
  return [...rows].sort(f);
}
export function toCSV(rows){
  const q=v=>'"'+String(v).replace(/"/g,'""')+'"';
  return ['Bloque,ID,Cantidad,Stacks,Resto',...rows.map(r=>{const k=stacks(r.count,stackSize(r.id));return [q(r.name),q(r.id),r.count,k.s,k.r].join(',')})].join('\n');
}

/* ---------- Pilas y shulkers ---------- */
/* Tamaño de pila de un bloque: 64 casi siempre; 16 carteles y estandartes; 1 camas, shulkers y tartas. */
export function stackSize(id){
  if(/(^|_)bed$|shulker_box$|^cake$/.test(id))return 1;
  if(/_sign$|_hanging_sign$|_banner$/.test(id))return 16;
  return 64;
}
export const SHULKER_SLOTS=27;
/* Texto "3 × 64 + 12" para una cantidad */
export function stackText(count,size=64){
  const s=Math.floor(count/size),r=count%size;
  if(!s)return String(r);
  return `${s} × ${size}`+(r?` + ${r}`:'');
}
/* Reparte los materiales en cajas de shulker (27 huecos). rows: [{id,name,count}]. Cada hueco = {id,name,n} */
export function packShulkers(rows){
  const slots=[];
  for(const r of [...rows].sort((a,b)=>b.count-a.count)){
    const size=stackSize(r.id);let left=r.count;
    while(left>0){const n=Math.min(size,left);slots.push({id:r.id,name:r.name,n,size});left-=n}
  }
  const boxes=[];
  for(let i=0;i<slots.length;i+=SHULKER_SLOTS)boxes.push(slots.slice(i,i+SHULKER_SLOTS));
  return {boxes,slots:slots.length,shulkers:boxes.length,big:slots.length>SHULKER_SLOTS};
}
