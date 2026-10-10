/* Guarda los packs de texturas procesados en el navegador (IndexedDB). No se sube nada a ningún servidor. */
const open=()=>new Promise((res,rej)=>{const r=indexedDB.open('mc-structure-viewer',1);r.onupgradeneeded=()=>r.result.createObjectStore('packs');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const run=async(mode,fn)=>{try{const db=await open();return await new Promise((res,rej)=>{const t=db.transaction('packs',mode),q=fn(t.objectStore('packs'));t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error)})}catch(e){return null}};
export const savePack=(key,val)=>run('readwrite',s=>s.put(val,key));
export const loadPack=key=>run('readonly',s=>s.get(key));
export const clearPack=key=>run('readwrite',s=>s.delete(key));
