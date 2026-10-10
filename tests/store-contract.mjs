/* Contrato que debe cumplir CUALQUIER almacenamiento (archivos hoy; Postgres/S3 mañana).
   runContract(nombre, open) -> open({dir?}) devuelve un almacén nuevo; reopen(store) devuelve uno nuevo sobre los mismos datos. */
import assert from 'node:assert/strict';
import {StoreError} from '../server/errors.js';

export async function runContract(label,{open,reopen}){
  let ok=0;const t=async(n,fn)=>{await fn();ok++;console.log('  ✓',n)};
  const store=await open();
  const mk=(i,o={})=>({id:store.id(),ownerId:'u'+(i%3),ownerName:'dueno'+(i%3),title:'Obra '+i,description:'desc '+i,category:i%2?'casa':'castillo',tags:['t'+(i%3)],
    status:'published',createdAt:1000+i,publishedAt:1000+i,updatedAt:1000+i,rev:1,images:[{n:1,ext:'.png'}],file:{name:'a.nbt',ext:'.nbt',size:10},
    platform:i%2?'java':'bedrock',format:'nbt',dims:{w:i+1,h:2,l:3},size:i<5?'small':'medium',total:i*10,types:3,...o});
  console.log(`Contrato de almacenamiento: ${label}`);

  await t('usuarios: crear, buscar sin distinguir mayúsculas, único, contar por rol',async()=>{
    const u={id:store.id(),name:'Alba',role:'user',sv:1,created:1,salt:'s',hash:'h'};
    await store.createUser(u);
    assert.equal((await store.getUserByName('ALBA')).id,u.id);assert.equal((await store.getUserById(u.id)).name,'Alba');
    await assert.rejects(()=>store.createUser({...u,id:store.id(),name:'alba'}),e=>e instanceof StoreError&&e.code=='EXISTS');
    assert.equal(await store.getUserByName('nadie'),null);assert.equal(await store.countUsersByRole('user'),1);assert.equal(await store.countUsersByRole('admin'),0);
  });
  await t('usuarios: dos altas simultáneas con el mismo nombre -> solo una',async()=>{
    const r=await Promise.allSettled([1,2,3].map(()=>store.createUser({id:store.id(),name:'Carrera',role:'user',sv:1,created:1,salt:'s',hash:'h'})));
    assert.equal(r.filter(x=>x.status=='fulfilled').length,1);
  });

  const all=[];
  await t('obras: crear/leer (con descripción) y materiales aparte',async()=>{
    for(let i=0;i<12;i++){const b=mk(i);all.push(b);await store.createBuild(b)}
    const g=await store.getBuild(all[3].id);assert.equal(g.description,'desc 3');assert.equal(g.title,'Obra 3');
    assert.equal(await store.getBuild('ffffffffffff'),null);assert.deepEqual(await store.getMaterials(all[3].id),[]);
    const lite=await store.getBuildLite(all[3].id);assert.equal(lite.title,'Obra 3');assert.equal(lite.description,undefined);
  });
  await t('obras: update incrementa rev, guarda materiales y respeta expectRev',async()=>{
    const id=all[0].id,n=await store.updateBuild(id,{title:'Nueva',materials:[['stone',5]]},{expectRev:1});
    assert.equal(n.rev,2);assert.equal(n.title,'Nueva');assert.deepEqual(await store.getMaterials(id),[['stone',5]]);assert.equal((await store.getBuild(id)).materials,undefined);
    await assert.rejects(()=>store.updateBuild(id,{title:'x'},{expectRev:1}),e=>e.code=='CONFLICT');
    await assert.rejects(()=>store.updateBuild('ffffffffffff',{title:'x'}),e=>e.code=='NOT_FOUND');
    assert.equal((await store.updateBuild(id,{title:'Sin rev'})).rev,3);       // sin expectRev: siempre aplica
  });
  await t('concurrencia: 10 updates con la misma rev -> exactamente 1 gana',async()=>{
    const id=all[1].id,rev=(await store.getBuild(id)).rev;
    const r=await Promise.allSettled(Array.from({length:10},(_,i)=>store.updateBuild(id,{title:'C'+i},{expectRev:rev})));
    assert.equal(r.filter(x=>x.status=='fulfilled').length,1);assert.equal(r.filter(x=>x.status=='rejected'&&x.reason.code=='CONFLICT').length,9);
    assert.equal((await store.getBuild(id)).rev,rev+1);
  });
  await t('listado: filtros, texto, orden y paginación con total',async()=>{
    const L=o=>store.listBuilds({status:'published',...o});
    assert.equal((await L({})).total,12);
    assert.equal((await L({platform:'java'})).total,6);assert.equal((await L({category:'castillo'})).total,6);assert.equal((await L({size:'small'})).total,5);
    assert.equal((await L({q:'dueno1'})).total,4);assert.equal((await L({q:'sin rev'})).total,1);assert.equal((await L({platform:'java',category:'casa'})).total,6);
    const p=await L({page:2,per:5});assert.equal(p.items.length,5);assert.equal(p.total,12);
    const bl=await L({sort:'blocks',per:3});assert.deepEqual(bl.items.map(b=>b.total),[110,100,90]);
    assert.equal((await L({sort:'name',per:2})).items[0].title<= (await L({sort:'name',per:2})).items[1].title,true);
    const rec=await L({sort:'recent',per:2});assert.ok(rec.items[0].createdAt>=rec.items[1].createdAt);
    assert.equal((await L({})).items[0].description,undefined);
  });
  await t('listado por dueño incluye borradores; countBuilds',async()=>{
    await store.createBuild(mk(50,{ownerId:'u0',status:'draft'}));
    assert.equal((await store.listBuilds({ownerId:'u0'})).total,5);assert.equal((await store.listBuilds({status:'published',ownerId:'u0'})).total,4);
    assert.equal(await store.countBuilds({ownerId:'u0',status:'draft'}),1);assert.equal(await store.countBuilds({}),13);
  });
  await t('version() cambia con cada escritura (ETag del listado)',async()=>{const v=store.version();await store.updateBuild(all[2].id,{title:'v'});assert.ok(store.version()>v)});
  await t('archivos: put, open, read, rename, delete',async()=>{
    const id=all[4].id;await store.putBlob(id,'file.nbt',Buffer.from('hola'));
    const o=await store.openBlob(id,'file.nbt');assert.equal(o.size,4);
    const chunks=[];for await(const c of o.stream())chunks.push(c);assert.equal(Buffer.concat(chunks).toString(),'hola');
    assert.equal((await store.readBlob(id,'file.nbt')).toString(),'hola');
    await store.renameBlob(id,'file.nbt','otro.nbt');assert.equal(await store.openBlob(id,'file.nbt'),null);assert.ok(await store.openBlob(id,'otro.nbt'));
    await store.deleteBlob(id,'otro.nbt');assert.equal(await store.openBlob(id,'otro.nbt'),null);
  });
  await t('texturas globales: guardar y leer',async()=>{
    assert.equal(await store.getTexIndex('bedrock'),null);
    await store.putTexture('bedrock',Buffer.from('png'),{version:7,names:[['a',1]],cols:1,rows:1});
    assert.equal((await store.getTexIndex('bedrock')).version,7);assert.equal((await store.openTexPng('bedrock')).size,3);assert.equal(await store.openTexPng('java'),null);
  });
  await t('borrar una obra elimina su registro y sus archivos',async()=>{
    const id=all[5].id;await store.putBlob(id,'img-1.png',Buffer.from('x'));
    assert.equal(await store.deleteBuild(id),true);assert.equal(await store.getBuild(id),null);assert.equal(await store.getBuildLite(id),null);assert.equal(await store.openBlob(id,'img-1.png'),null);
    assert.equal((await store.listBuilds({status:'published'})).total,11);
  });
  await t('purgeDrafts borra solo borradores antiguos',async()=>{
    await store.createBuild(mk(60,{ownerId:'u9',status:'draft',createdAt:10}));await store.createBuild(mk(61,{ownerId:'u9',status:'draft',createdAt:99999999999999}));
    assert.equal(await store.purgeDrafts(500),1);assert.equal(await store.countBuilds({ownerId:'u9'}),1);assert.equal(await store.countBuilds({ownerId:'u0',status:'draft'}),1);
  });
  await t('persistencia: tras reabrir siguen usuarios, obras, materiales y texturas',async()=>{
    const s2=await reopen(store),n=await s2.stats();
    assert.equal(n.users,2);assert.equal((await s2.getBuild(all[0].id)).title,'Sin rev');assert.deepEqual(await s2.getMaterials(all[0].id),[['stone',5]]);
    assert.equal((await s2.getTexIndex('bedrock')).version,7);assert.equal((await s2.listBuilds({status:'published'})).total,11);assert.equal(s2.secret(),store.secret());
    await s2.close();
  });
  await store.close();
  console.log(`  ${ok} pruebas de contrato OK`);
}
