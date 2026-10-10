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
  return ['Bloque,ID,Cantidad,Stacks,Resto',...rows.map(r=>{const k=stacks(r.count);return [q(r.name),q(r.id),r.count,k.s,k.r].join(',')})].join('\n');
}
