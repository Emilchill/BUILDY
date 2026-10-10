/* Pruebas sin navegador: node tests/run.mjs
   Variable opcional BEDROCK_SAMPLES=/ruta/a/bedrock-samples (carpeta descomprimida) para probar contra el pack real. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {parseNBT} from '../js/formats/nbt.js';
import {load,demo} from '../js/formats/loaders.js';
import {setAliases} from '../js/blocks/bedrock.js';
import {withNb,shapeOf,shapeOpts} from '../js/blocks/shapes.js';
import {buildGeometry} from '../js/render/mesh.js';
import {buildMeta,BedrockSource} from '../js/textures/bedrock.js';
import {decodeTGA} from '../js/textures/tga.js';
import {buildMaterials,toCSV,stacks} from '../js/materials.js';

const root=new URL('..',import.meta.url).pathname;
setAliases(JSON.parse(fs.readFileSync(path.join(root,'data/aliases.json'),'utf8')));
let ok=0;const t=(name,fn)=>{fn();ok++;console.log('  ✓',name)};

/* --- escritor mínimo de NBT little-endian (Bedrock) --- */
const S=s=>{const b=Buffer.from(s);const l=Buffer.alloc(2);l.writeUInt16LE(b.length);return Buffer.concat([l,b])};
const I=v=>{const b=Buffer.alloc(4);b.writeInt32LE(v);return b};
const tag=(ty,n,p)=>Buffer.concat([Buffer.from([ty]),S(n),p]);
const lst=(ty,a)=>Buffer.concat([Buffer.from([ty]),I(a.length),...a]);
const comp=(...k)=>Buffer.concat([...k,Buffer.from([0])]);
function mcstructure(){
  const X=3,Y=2,Z=3,idx=new Array(X*Y*Z).fill(-1),put=(x,y,z,v)=>idx[(x*Y+y)*Z+z]=v;
  for(let x=0;x<X;x++)for(let z=0;z<Z;z++)put(x,0,z,0);put(1,1,1,1);put(0,1,0,2);put(2,1,2,3);
  const ent=(n,st)=>comp(tag(8,'name',S(n)),tag(10,'states',comp(...Object.entries(st).map(([k,v])=>typeof v=='number'?tag(3,k,I(v)):tag(8,k,S(v))))),tag(3,'version',I(1)));
  const pal=[['minecraft:grass',{}],['minecraft:planks',{wood_type:'spruce'}],['minecraft:wool',{color:'silver'}],['minecraft:reeds',{}]];
  return Buffer.concat([Buffer.from([10]),S(''),comp(tag(3,'format_version',I(1)),tag(9,'size',lst(3,[I(X),I(Y),I(Z)])),
    tag(10,'structure',comp(tag(9,'block_indices',lst(9,[lst(3,idx.map(I)),lst(3,idx.map(()=>I(-1)))])),tag(9,'entities',lst(0,[])),
    tag(10,'palette',comp(tag(10,'default',comp(tag(9,'block_palette',lst(10,pal.map(([n,s])=>ent(n,s)))),tag(10,'block_position_data',comp()))))))))]);
}
console.log('Formatos');
t('.mcstructure (Bedrock, little-endian) -> nombres estilo Java',()=>{
  const m=load(parseNBT(new Uint8Array(mcstructure()),true));
  assert.deepEqual([m.W,m.H,m.L,m.total],[3,2,3,12]);
  assert.deepEqual([...m.names].sort(),['grass_block','light_gray_wool','spruce_planks','sugar_cane']);
});
t('demo: modelo válido',()=>{const m=demo();assert.ok(m.total>400);assert.ok(m.names.includes('lever')&&m.names.includes('rail'))});

console.log('Geometría');
t('malla sin NaN y con caras',()=>{
  const g=buildGeometry(demo());assert.ok(g.quads>500);assert.ok(![...g.pos].some(v=>!Number.isFinite(v)));
});
t('ocultar todo deja 0 caras; capa máxima recorta',()=>{
  const m=demo();assert.equal(buildGeometry(m,{hidden:new Set(m.names.map((_,i)=>i))}).quads,0);
  assert.ok(buildGeometry(m,{maxY:1}).quads<buildGeometry(m).quads);
});
t('palanca: base en la pared correcta (Java facing=north -> pared sur)',()=>{
  const sh=shapeOf('lever',{face:'wall',facing:'north',powered:'false'});assert.equal(sh.boxes[0].rot[0][1],-90);
  shapeOpts.levFlip=true;const f=shapeOf('lever',{face:'wall',facing:'north',powered:'false'});shapeOpts.levFlip=false;
  assert.notDeepEqual(f.boxes[0].rot[1],sh.boxes[0].rot[1]);
});

console.log('Conexiones (sin propiedades, estilo Bedrock)');
const grid=(list)=>{const mp=new Map(list.map(([x,y,z,n,p,k])=>[x+','+y+','+z,{n,p:p||{},k:k??2}]));return (x,y,z)=>(dx,dy,dz)=>mp.get((x+dx)+','+(y+dy)+','+(z+dz))||null};
t('valla se une a valla y a bloque sólido',()=>{
  const N=grid([[0,0,0,'stone',{},0],[1,0,0,'oak_fence'],[2,0,0,'oak_fence']])(1,0,0);
  const q=withNb('oak_fence',{},N);assert.deepEqual([q.east,q.west,q.north,q.south],['true','true','false','false']);
});
t('cable de redstone se une a repetidor alineado',()=>{
  const N=grid([[1,0,0,'redstone_wire'],[2,0,0,'repeater',{facing:'east'}]])(1,0,0);
  const q=withNb('redstone_wire',{},N);assert.equal(q.east,'side');assert.equal(q.north,'none');
});
t('escalera forma esquina exterior',()=>{
  const N=grid([[1,0,1,'oak_stairs',{facing:'north'}],[1,0,0,'oak_stairs',{facing:'east'}]])(1,0,1);
  assert.equal(withNb('oak_stairs',{facing:'north',half:'bottom'},N).shape,'outer_right');
});

console.log('Materiales');
t('lista, stacks y CSV',()=>{
  const m=demo(),rows=buildMaterials(m);assert.ok(rows.length>10);assert.deepEqual(stacks(130),{s:2,r:2});
  assert.ok(toCSV(rows).startsWith('Bloque,ID,Cantidad,Stacks,Resto'));
});

const BS=process.env.BEDROCK_SAMPLES;
if(BS){
  console.log('bedrock-samples real');
  const rp=path.join(BS,'resource_pack'),rd=p=>fs.readFileSync(path.join(rp,p),'utf8');
  const meta=buildMeta(rd('blocks.json'),rd('textures/terrain_texture.json'),rd('texts/es_ES.lang'),fs.readFileSync(path.join(BS,'metadata/vanilladata_modules/mojang-blocks.json'),'utf8'));
  const names=new Map(),walk=(d,pre='')=>{for(const f of fs.readdirSync(path.join(rp,'textures/blocks',d))){const p=path.join(d,f);
    if(fs.statSync(path.join(rp,'textures/blocks',p)).isDirectory())walk(p);else if(f.endsWith('.png')||(f.endsWith('.tga')&&!/_(mers|normal|heightmap)\.tga$/.test(f)&&!fs.existsSync(path.join(rp,'textures/blocks',p.replace(/\.tga$/,'.png')))))names.set(p.replace(/\.(png|tga)$/,''),names.size+1)}};walk('');
  const src=new BedrockSource({canvas:null,cols:40,rows:40,names},meta);
  t(`índice: ${Object.keys(meta.blocks).length} bloques, ${Object.keys(meta.names).length} nombres, ${names.size} texturas`,()=>{assert.ok(Object.keys(meta.blocks).length>1000)});
  const ids=Object.keys(meta.blocks);let withTile=0;for(const id of ids)if(src.tilesFor(id)[1]>=0)withTile++;
  t(`texturas resueltas: ${withTile}/${ids.length}`,()=>assert.ok(withTile/ids.length>.85));
  t('nombres en español',()=>{assert.equal(src.nameOf('hopper'),'Embudo');assert.equal(src.nameOf('lever'),'Palanca')});
  t('alias Java: grass_block -> pasto con 3 caras distintas',()=>{const f=src.tilesFor('grass_block');assert.ok(f[0]>=0&&f[1]>=0&&f[2]>=0&&f[1]!=f[2])});
  t('tronco con eje: caras de extremo distintas del lado',()=>{const f=src.faceTiles('oak_log',{axis:'x'});assert.ok(f&&f[0]===f[1]&&f[0]!==f[2])});
  t('observador orientado: frente != atrás',()=>{const f=src.faceTiles('observer',{facing:'north'});assert.ok(f&&f[5]!==f[4])});
  t('TGA real (cactus_side) se decodifica a 16x16 RGBA',()=>{
    const d=decodeTGA(new Uint8Array(fs.readFileSync(path.join(rp,'textures/blocks/cactus_side.tga'))));
    assert.equal(d.data.length,d.w*d.h*4);assert.ok(d.w>=16&&d.data.some(v=>v>0));
  });
  t('hojas, cactus y helecho ya tienen textura',()=>{for(const n of ['oak_leaves','cactus','fern','sugar_cane'])assert.ok(src.tilesFor(n)[1]>=0,n)});
  t('nombres heredados (alfombra/tablones)',()=>{assert.equal(src.nameOf('black_carpet'),'Alfombra negra');assert.equal(src.nameOf('acacia_planks'),'Tablones de acacia')});
  t('rieles lógicos resueltos',()=>assert.ok(src.tilesFor('rail')[0]>=0&&src.tilesFor('powered_rail_on')[0]>=0));
}
console.log(`\n${ok} pruebas OK`);
