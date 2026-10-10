/* Medición de capacidad del almacén de archivos: node tests/bench.mjs [obras] [usuarios] */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {FileStore} from '../server/storage/file-store.js';
const N=+process.argv[2]||20000,U=+process.argv[3]||5000;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mcv-bench-'));
const ms=async(label,fn)=>{const t=performance.now();const r=await fn();console.log(`${label.padEnd(46)} ${(performance.now()-t).toFixed(1).padStart(9)} ms`);return r};
let s=await FileStore.open(dir);
await ms(`crear ${U} usuarios`,async()=>{for(let i=0;i<U;i+=50)await Promise.all(Array.from({length:50},(_,k)=>s.createUser({id:s.id(),name:'user'+(i+k),role:'user',sv:1,created:1,salt:'s',hash:'h'})))});
const ids=[];
await ms(`crear ${N} obras (disco)`,async()=>{for(let i=0;i<N;i+=100)await Promise.all(Array.from({length:100},(_,k)=>{const j=i+k,id=s.id();ids.push(id);
  return s.createBuild({id,ownerId:'u'+(j%U),ownerName:'user'+(j%U),title:'Obra '+j,description:'d'.repeat(300),category:['casa','castillo','redstone'][j%3],tags:['a','b'],status:'published',
  createdAt:j,publishedAt:j,updatedAt:j,rev:1,images:[{n:1,ext:'.jpg'}],file:{name:'a.nbt',ext:'.nbt',size:1},platform:j%2?'java':'bedrock',format:'nbt',dims:{w:j%200,h:10,l:20},size:'medium',total:j,types:5})}))});
await s.close();
s=await ms('reabrir (escanear índice)',()=>FileStore.open(dir));
await ms('listar página 1 (sin filtros, orden reciente)',()=>s.listBuilds({status:'published',page:1,per:24}));
await ms('listar con filtros (java + casa + texto)',()=>s.listBuilds({status:'published',platform:'java',category:'casa',q:'obra 1',per:24}));
await ms('listar orden por bloques (primera vez, ordena)',()=>s.listBuilds({status:'published',sort:'blocks',per:24}));
await ms('listar orden por bloques (en caché)',()=>s.listBuilds({status:'published',sort:'blocks',page:50,per:24}));
await ms('obras de un usuario',()=>s.listBuilds({ownerId:'u7',per:24}));
await ms('leer una obra (disco)',()=>s.getBuild(ids[N>>1]));
await ms('actualizar una obra (disco)',()=>s.updateBuild(ids[N>>1],{title:'Editada'},{expectRev:1}));
await ms('listar tras una escritura (reordena índice)',()=>s.listBuilds({status:'published',per:24}));
console.log('memoria aprox.:',(process.memoryUsage().heapUsed/1048576).toFixed(0),'MB');
fs.rmSync(dir,{recursive:true,force:true});
