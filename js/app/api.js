/* Cliente de la API. La cabecera X-Requested-With protege las peticiones que modifican datos.
   Las URLs se piden RELATIVAS (sin "/" inicial) para que el sitio funcione también en subcarpetas (p. ej. GitHub Pages: /BUILDY/).
   Si no hay servidor (sitio estático), detect() activa el modo local: mismas rutas y reglas, datos en IndexedDB del navegador. */
let local=null;
const rel=u=>u.replace(/^\//,'');
export const isLocal=()=>!!local;
export async function detect(){
  const forced=new URLSearchParams(location.search).has('local');
  if(!forced){
    try{const r=await fetch('api/health',{headers:{'X-Requested-With':'fetch'}});if(r.ok&&(r.headers.get('content-type')||'').includes('json'))return}catch{}
  }
  local=await (await import('./local/server.js')).createLocalServer(globalThis.__MC_LOCAL_BACKEND?{backend:globalThis.__MC_LOCAL_BACKEND}:{});
  try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch{}
}
async function req(method,url,{json,raw,type}={}){
  if(local)return local.handle(method,url,{json,raw});
  const o={method,headers:{'X-Requested-With':'fetch'},credentials:'same-origin'};
  if(raw!==undefined){o.body=raw;o.headers['Content-Type']=type||'application/octet-stream'}
  else if(json!==undefined){o.body=JSON.stringify(json);o.headers['Content-Type']='application/json'}
  const r=await fetch(rel(url),o);let d=null;try{d=await r.json()}catch{}
  if(!r.ok)throw Object.assign(new Error((d&&d.error)||'Error '+r.status),{status:r.status});
  return d;
}
export const api={
  get:u=>req('GET',u),
  post:(u,json)=>req('POST',u,{json}),
  patch:(u,json)=>req('PATCH',u,{json}),
  del:u=>req('DELETE',u),
  put:(u,raw,type)=>req('PUT',u,{raw,type}),
  /* descarga binaria (estructura, atlas): Blob */
  async blob(u){
    if(local)return local.handle('GET',u,{});
    const r=await fetch(rel(u));if(!r.ok)throw Object.assign(new Error('Error '+r.status),{status:r.status});return r.blob();
  },
};
