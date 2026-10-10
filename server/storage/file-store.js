/* Almacenamiento en archivos (la implementación "hardcode" de hoy).
   Implementa el contrato de docs/ESCALABILIDAD.md: todas las operaciones son async para que una base de datos
   (Postgres, etc.) y un almacén de objetos (S3) puedan reemplazarla sin tocar rutas ni servicios.
   Escala: índice ligero en memoria (sin materiales ni descripción) + archivos sharded por id. Probado hasta ~20 000 obras. */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {StoreError} from '../errors.js';

const rid=()=>crypto.randomBytes(6).toString('hex');
const writeAtomic=async(file,data)=>{const tmp=`${file}.${rid()}.tmp`;await fsp.writeFile(tmp,data);await fsp.rename(tmp,file)};
const readJson=async f=>{try{return JSON.parse(await fsp.readFile(f,'utf8'))}catch(e){if(e.code=='ENOENT')return null;throw e}};
const SORTS={
  recent:(a,b)=>(b.publishedAt||b.createdAt)-(a.publishedAt||a.createdAt),
  blocks:(a,b)=>b.total-a.total,
  size:(a,b)=>Math.max(...Object.values(b.dims||{w:0}))-Math.max(...Object.values(a.dims||{w:0})),
  name:(a,b)=>a.title.localeCompare(b.title,'es'),
};
const lite=b=>{const {description,...r}=b;r._s=`${b.title} ${b.ownerName} ${(b.tags||[]).join(' ')}`.toLowerCase();return r};
const strip=r=>{const {_s,...o}=r;return o};

export class FileStore{
  static async open(dir){return new FileStore(dir)}
  constructor(dir){
    this.dir=dir;for(const d of ['users','builds','textures'])fs.mkdirSync(path.join(dir,d),{recursive:true});
    this.usersById=new Map();this.usersByName=new Map();this.index=new Map();this.locks=new Map();this._ver=1;this._sorted={};this.tex=new Map();
    for(const f of fs.readdirSync(path.join(dir,'users')))if(f.endsWith('.json'))try{const u=JSON.parse(fs.readFileSync(path.join(dir,'users',f),'utf8'));this.usersById.set(u.id,u);this.usersByName.set(u.name.toLowerCase(),u.id)}catch{}
    for(const s of fs.readdirSync(path.join(dir,'builds')))for(const id of fs.readdirSync(path.join(dir,'builds',s)))
      try{this.index.set(id,lite(JSON.parse(fs.readFileSync(path.join(dir,'builds',s,id,'meta.json'),'utf8'))))}catch{}
    const kf=path.join(dir,'secret.key');
    if(!fs.existsSync(kf))fs.writeFileSync(kf,crypto.randomBytes(32).toString('hex'),{mode:0o600});
    this._secret=fs.readFileSync(kf,'utf8').trim();
  }
  id(){return rid()}
  secret(){return this._secret}
  version(){return this._ver}                       // sube con cada cambio en obras (sirve de ETag del listado)
  _bump(){this._ver++;this._sorted={}}
  async close(){}
  async stats(){return {users:this.usersById.size,builds:this.index.size}}
  _dir(id){return path.join(this.dir,'builds',id.slice(0,2),id)}
  _lock(id,fn){                                     // serializa escrituras de una misma obra
    const prev=this.locks.get(id)||Promise.resolve(),run=prev.then(fn,fn);
    const tail=run.catch(()=>{});this.locks.set(id,tail);tail.then(()=>{if(this.locks.get(id)===tail)this.locks.delete(id)});return run;
  }

  /* ---------- usuarios ---------- */
  async createUser(u){
    const key=u.name.toLowerCase();
    if(this.usersByName.has(key))throw new StoreError('EXISTS','Ese usuario ya existe');
    this.usersByName.set(key,u.id);this.usersById.set(u.id,u);             // reserva síncrona: evita duplicados concurrentes
    await writeAtomic(path.join(this.dir,'users',u.id+'.json'),JSON.stringify(u));return u;
  }
  async getUserById(id){return this.usersById.get(id)||null}
  async getUserByName(n){const id=this.usersByName.get(String(n).toLowerCase());return id?this.usersById.get(id):null}
  async countUsersByRole(role){let n=0;for(const u of this.usersById.values())if(u.role==role)n++;return n}

  /* ---------- obras ---------- */
  async createBuild(b){
    await fsp.mkdir(this._dir(b.id),{recursive:true});
    await writeAtomic(path.join(this._dir(b.id),'meta.json'),JSON.stringify(b));
    this.index.set(b.id,lite(b));this._bump();return b;
  }
  async getBuildLite(id){const r=this.index.get(id);return r?strip(r):null}   // sin disco: para rutas calientes
  async getBuild(id){return this.index.has(id)?readJson(path.join(this._dir(id),'meta.json')):null}
  /* patch puede traer `materials` (se guarda aparte). expectRev => control de concurrencia optimista. */
  updateBuild(id,patch,{expectRev}={}){
    return this._lock(id,async()=>{
      const cur=await this.getBuild(id);if(!cur)throw new StoreError('NOT_FOUND');
      if(expectRev!=null&&cur.rev!==expectRev)throw new StoreError('CONFLICT','La publicación cambió mientras la editabas');
      const {materials,...rest}=patch,next={...cur,...rest,rev:cur.rev+1,updatedAt:Date.now()};
      if(materials)await writeAtomic(path.join(this._dir(id),'materials.json'),JSON.stringify(materials));
      await writeAtomic(path.join(this._dir(id),'meta.json'),JSON.stringify(next));
      this.index.set(id,lite(next));this._bump();return next;
    });
  }
  async getMaterials(id){return (await readJson(path.join(this._dir(id),'materials.json')))||[]}
  deleteBuild(id){
    return this._lock(id,async()=>{await fsp.rm(this._dir(id),{recursive:true,force:true});const had=this.index.delete(id);this._bump();return had});
  }
  _sortedList(sort){
    const k=SORTS[sort]?sort:'recent';
    return this._sorted[k]||(this._sorted[k]=[...this.index.values()].sort(SORTS[k]));
  }
  async listBuilds({status,ownerId,platform,category,size,q,sort='recent',page=1,per=24}={}){
    const text=q?String(q).toLowerCase():'';
    const all=this._sortedList(sort).filter(b=>(!status||b.status==status)&&(!ownerId||b.ownerId==ownerId)&&(!platform||b.platform==platform)
      &&(!category||b.category==category)&&(!size||b.size==size)&&(!text||b._s.includes(text)));
    return {total:all.length,items:all.slice((page-1)*per,page*per).map(strip)};
  }
  async countBuilds({ownerId,status}={}){let n=0;for(const b of this.index.values())if((!ownerId||b.ownerId==ownerId)&&(!status||b.status==status))n++;return n}
  async purgeDrafts(beforeTs){let n=0;for(const b of [...this.index.values()])if(b.status=='draft'&&b.createdAt<beforeTs){await this.deleteBuild(b.id);n++}return n}

  /* ---------- archivos (estructuras e imágenes) ---------- */
  async putBlob(id,name,buf){await writeAtomic(path.join(this._dir(id),name),buf)}
  async openBlob(id,name){
    const f=path.join(this._dir(id),name);
    try{const st=await fsp.stat(f);return {size:st.size,stream:()=>fs.createReadStream(f)}}catch{return null}
  }
  async readBlob(id,name){try{return await fsp.readFile(path.join(this._dir(id),name))}catch{return null}}
  async deleteBlob(id,name){await fsp.rm(path.join(this._dir(id),name),{force:true})}
  async renameBlob(id,from,to){await fsp.rename(path.join(this._dir(id),from),path.join(this._dir(id),to))}

  /* ---------- texturas globales ---------- */
  _texDir(kind){const d=path.join(this.dir,'textures',kind);fs.mkdirSync(d,{recursive:true});return d}
  async getTexIndex(kind){
    if(this.tex.has(kind))return this.tex.get(kind);
    const i=await readJson(path.join(this._texDir(kind),'index.json'));this.tex.set(kind,i);return i;
  }
  async putTexture(kind,png,index){
    const d=this._texDir(kind);await writeAtomic(path.join(d,'atlas.png'),png);await writeAtomic(path.join(d,'index.json'),JSON.stringify(index));this.tex.set(kind,index);
  }
  async openTexPng(kind){
    const f=path.join(this._texDir(kind),'atlas.png');
    try{const st=await fsp.stat(f);return {size:st.size,stream:()=>fs.createReadStream(f)}}catch{return null}
  }
}
