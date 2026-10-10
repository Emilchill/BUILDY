/* Almacén del navegador (modo local, sin servidor): cumple el MISMO contrato que FileStore (ver docs/ESCALABILIDAD.md),
   así que los servicios y las reglas son exactamente los del servidor. Persistencia intercambiable (`backend`):
   IndexedDB en el navegador, memoria en las pruebas. Los datos viven SOLO en el navegador de cada visitante. */
import {StoreError} from '../../../server/errors.js';

const SORTS={
  recent:(a,b)=>(b.publishedAt||b.createdAt)-(a.publishedAt||a.createdAt),
  blocks:(a,b)=>b.total-a.total,
  size:(a,b)=>Math.max(...Object.values(b.dims||{w:0}))-Math.max(...Object.values(a.dims||{w:0})),
  name:(a,b)=>a.title.localeCompare(b.title,'es'),
};
const clone=o=>JSON.parse(JSON.stringify(o));
const lite=b=>{const {description,...r}=b;r._s=`${b.title} ${b.ownerName} ${(b.tags||[]).join(' ')}`.toLowerCase();return r};
const strip=r=>{const {_s,...o}=r;return clone(o)};
const rid=()=>{const a=new Uint8Array(6);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,'0')).join('')};
const enc=new TextEncoder(),dec=new TextDecoder();

export function memoryBackend(){
  const kv=new Map();let meta=null;
  return {loadMeta:async()=>meta&&JSON.parse(meta),saveMeta:async m=>{meta=JSON.stringify(m)},
    getBlob:async k=>kv.get(k)||null,putBlob:async(k,v)=>{kv.set(k,v)},delBlob:async k=>{kv.delete(k)},
    delPrefix:async p=>{for(const k of [...kv.keys()])if(k.startsWith(p))kv.delete(k)}};
}
export function idbBackend(){
  let dbp;const db=()=>dbp||(dbp=new Promise((ok,bad)=>{const r=indexedDB.open('mcv-catalog',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error)}));
  const tx=async(mode,fn)=>{const d=await db();return new Promise((ok,bad)=>{const t=d.transaction('kv',mode),r=fn(t.objectStore('kv'));t.oncomplete=()=>ok(r&&r.result);t.onerror=t.onabort=()=>bad(t.error)})};
  return {
    async loadMeta(){const v=await tx('readonly',s=>s.get('#meta'));return v?JSON.parse(v):null},
    saveMeta:m=>tx('readwrite',s=>s.put(JSON.stringify(m),'#meta')),
    async getBlob(k){const v=await tx('readonly',s=>s.get('b:'+k));return v?new Uint8Array(v):null},
    putBlob:(k,u8)=>tx('readwrite',s=>s.put(new Uint8Array(u8).buffer,'b:'+k)),
    delBlob:k=>tx('readwrite',s=>s.delete('b:'+k)),
    delPrefix:p=>tx('readwrite',s=>s.delete(IDBKeyRange.bound('b:'+p,'b:'+p+'\uffff'))),
  };
}

export class LocalStore{
  static async open(be){const s=new LocalStore(be);await s._load();return s}
  constructor(be){this.be=be;this.usersById=new Map();this.usersByName=new Map();this.full=new Map();this.index=new Map();this.tex={};this.locks=new Map();this._ver=1;this._sorted={}}
  async _load(){
    const m=(await this.be.loadMeta())||{users:[],builds:[],tex:{}};
    for(const u of m.users){this.usersById.set(u.id,u);this.usersByName.set(u.name.toLowerCase(),u.id)}
    for(const b of m.builds){this.full.set(b.id,b);this.index.set(b.id,lite(b))}
    this.tex=m.tex||{};
  }
  _save(){return this.be.saveMeta({users:[...this.usersById.values()],builds:[...this.full.values()],tex:this.tex})}
  id(){return rid()}
  secret(){return ''}
  version(){return this._ver}
  _bump(){this._ver++;this._sorted={}}
  async close(){}
  async stats(){return {users:this.usersById.size,builds:this.index.size}}
  _lock(id,fn){
    const prev=this.locks.get(id)||Promise.resolve(),run=prev.then(fn,fn);
    const tail=run.catch(()=>{});this.locks.set(id,tail);tail.then(()=>{if(this.locks.get(id)===tail)this.locks.delete(id)});return run;
  }
  /* usuarios */
  async createUser(u){
    const key=u.name.toLowerCase();if(this.usersByName.has(key))throw new StoreError('EXISTS','Ese usuario ya existe');
    this.usersByName.set(key,u.id);this.usersById.set(u.id,u);await this._save();return u;
  }
  async getUserById(id){return this.usersById.get(id)||null}
  async getUserByName(n){const id=this.usersByName.get(String(n).toLowerCase());return id?this.usersById.get(id):null}
  async countUsersByRole(role){let n=0;for(const u of this.usersById.values())if(u.role==role)n++;return n}
  /* obras */
  async createBuild(b){this.full.set(b.id,clone(b));this.index.set(b.id,lite(b));this._bump();await this._save();return b}
  async getBuildLite(id){const r=this.index.get(id);return r?strip(r):null}
  async getBuild(id){const b=this.full.get(id);return b?clone(b):null}
  updateBuild(id,patch,{expectRev}={}){
    return this._lock(id,async()=>{
      const cur=this.full.get(id);if(!cur)throw new StoreError('NOT_FOUND');
      if(expectRev!=null&&cur.rev!==expectRev)throw new StoreError('CONFLICT','La publicación cambió mientras la editabas');
      const {materials,...rest}=patch,next={...cur,...clone(rest),rev:cur.rev+1,updatedAt:Date.now()};
      if(materials)await this.be.putBlob(id+'/materials.json',enc.encode(JSON.stringify(materials)));
      this.full.set(id,next);this.index.set(id,lite(next));this._bump();await this._save();return clone(next);
    });
  }
  async getMaterials(id){const u=await this.be.getBlob(id+'/materials.json');return u?JSON.parse(dec.decode(u)):[]}
  deleteBuild(id){
    return this._lock(id,async()=>{
      await this.be.delPrefix(id+'/');const had=this.full.delete(id);this.index.delete(id);this._bump();await this._save();return had;
    });
  }
  /* listado */
  _sortedList(sort){const k=SORTS[sort]?sort:'recent';return this._sorted[k]||(this._sorted[k]=[...this.index.values()].sort(SORTS[k]))}
  async listBuilds({status,ownerId,platform,category,size,q,sort='recent',page=1,per=24}={}){
    const text=q?String(q).toLowerCase():'';
    const all=this._sortedList(sort).filter(b=>(!status||b.status==status)&&(!ownerId||b.ownerId==ownerId)&&(!platform||b.platform==platform)
      &&(!category||b.category==category)&&(!size||b.size==size)&&(!text||b._s.includes(text)));
    return {total:all.length,items:all.slice((page-1)*per,page*per).map(strip)};
  }
  async countBuilds({ownerId,status}={}){let n=0;for(const b of this.index.values())if((!ownerId||b.ownerId==ownerId)&&(!status||b.status==status))n++;return n}
  async purgeDrafts(beforeTs){let n=0;for(const b of [...this.index.values()])if(b.status=='draft'&&b.createdAt<beforeTs){await this.deleteBuild(b.id);n++}return n}
  /* archivos */
  async putBlob(id,name,buf){await this.be.putBlob(`${id}/${name}`,buf)}
  async openBlob(id,name){
    const u=await this.be.getBlob(`${id}/${name}`);if(!u)return null;
    return {size:u.length,read:()=>u,stream:()=>(async function*(){yield u})()};
  }
  async readBlob(id,name){return this.be.getBlob(`${id}/${name}`)}
  async deleteBlob(id,name){await this.be.delBlob(`${id}/${name}`)}
  async renameBlob(id,from,to){const u=await this.be.getBlob(`${id}/${from}`);if(!u)throw new StoreError('NOT_FOUND');await this.be.putBlob(`${id}/${to}`,u);await this.be.delBlob(`${id}/${from}`)}
  /* texturas globales */
  async getTexIndex(kind){return this.tex[kind]||null}
  async putTexture(kind,png,index){await this.be.putBlob(`tex/${kind}/atlas.png`,png);this.tex[kind]=index;await this._save()}
  async openTexPng(kind){return this.openBlob('tex',`${kind}/atlas.png`)}
}
