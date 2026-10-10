/* Fuente de texturas y nombres: carpeta resource_pack de bedrock-samples (blocks.json + terrain_texture.json + .lang). */
import {TexSource,buildAtlas} from './atlas.js';
import {decodeTGA} from './tga.js';
import {faceTiles} from '../blocks/orientation.js';
import {javaToBedrock} from '../blocks/bedrock.js';

const stripJsonc=s=>s.replace(/^\uFEFF/,'').replace(/^\s*\/\/.*$/gm,'');
/* Textos JSON/.lang -> índice compacto {blocks, terrain, tint, names}. Función pura (se prueba en Node). */
export function buildMeta(blocksTxt,terrainTxt,langTxt,mojangTxt=''){
  const blocksJ=JSON.parse(stripJsonc(blocksTxt)),td=JSON.parse(stripJsonc(terrainTxt)).texture_data;
  const rel=p=>p.replace(/^textures\/blocks\//,''),terrain={},tint={},blocks={},names={},L={};
  for(const [k,v] of Object.entries(td)){
    const arr=[].concat(v.textures||[]);
    terrain[k]=arr.map(t=>rel(typeof t=='string'?t:t.path));
    if(arr[0]&&arr[0].overlay_color)tint[k]=arr[0].overlay_color;
  }
  for(const [id,b] of Object.entries(blocksJ))if(b&&b.textures!==undefined)blocks[id]=b.textures;
  for(const line of langTxt.split(/\r?\n/)){const m=line.match(/^((?:tile|item)\.[^=]+)\.name=([^\t#]*)/);if(m)L[m[1]]=m[2].trim()}
  /* nombre = tile.<id> | clave heredada (serialization_id de mojang-blocks.json) | item.<id> */
  const ser={};
  if(mojangTxt)for(const d of JSON.parse(mojangTxt).data_items)ser[d.name.replace(/^minecraft:/,'')]=d.serialization_id;
  const WOOD={dark_oak:'big_oak'};
  for(const id of new Set([...Object.keys(blocks),...Object.keys(ser)])){
    let n=L['tile.'+id]||(ser[id]&&L[ser[id]])||L['item.'+id];
    if(!n){const m=id.match(/^(acacia|birch|dark_oak|jungle|spruce|oak)_(planks|fence)$/);if(m)n=L[`tile.${m[2]}.${WOOD[m[1]]||m[1]}`]}
    if(n)names[id]=n;
  }
  return {blocks,terrain,tint,names};
}
export const isBedrockPack=zip=>Object.keys(zip.files).some(p=>/resource_pack\/blocks\.json$/.test(p));
export async function loadBedrockZip(zip,lang='es_ES'){
  const files=Object.keys(zip.files),base=files.find(p=>/resource_pack\/blocks\.json$/.test(p)).replace(/blocks\.json$/,'');
  const txt=async p=>zip.file(base+p)?zip.file(base+p).async('string'):'';
  const root=base.replace(/resource_pack\/$/,''),mj=zip.file(root+'metadata/vanilladata_modules/mojang-blocks.json');
  const meta=buildMeta(await txt('blocks.json'),await txt('textures/terrain_texture.json'),(await txt(`texts/${lang}.lang`))||(await txt('texts/en_US.lang')),mj?await mj.async('string'):'');
  const pre=base+'textures/blocks/',entries=[],png=new Set();
  zip.forEach((p,e)=>{if(!e.dir&&p.startsWith(pre)&&/\.png$/.test(p)){const k=p.slice(pre.length).replace(/\.png$/,'');png.add(k);entries.push([k,()=>e.async('blob')])}});
  /* texturas que solo existen como .tga (cactus, helechos, hojas, lado del pasto...) */
  zip.forEach((p,e)=>{if(e.dir||!p.startsWith(pre)||!/\.tga$/.test(p)||/_(mers|normal|heightmap)\.tga$/.test(p))return;
    const k=p.slice(pre.length).replace(/\.tga$/,'');
    if(!png.has(k))entries.push([k,async()=>{const d=decodeTGA(await e.async('uint8array'));return new ImageData(d.data,d.w,d.h)}])});
  return {atlas:await buildAtlas(entries),meta};
}
/* Rutas lógicas usadas por las formas 3D -> archivo de textura de Bedrock */
const LOGICAL={lever:'lever',hopper_outside:'hopper_outside',hopper_inside:'hopper_inside',redstone_torch:'redstone_torch_on',redstone_torch_off:'redstone_torch_off',
  repeater:'repeater_off',repeater_on:'repeater_on',comparator:'comparator_off',comparator_on:'comparator_on',piston_side:'piston_side',piston_top:'piston_top_normal',
  piston_top_sticky:'piston_top_sticky',piston_inner:'piston_inner',piston_bottom:'piston_bottom',rail:'rail_normal',rail_corner:'rail_normal_turned',
  powered_rail:'rail_golden',powered_rail_on:'rail_golden_powered',detector_rail:'rail_detector',detector_rail_on:'rail_detector_powered',
  activator_rail:'rail_activator',activator_rail_on:'rail_activator_powered',torch:'torch_on',redstone_lamp_on:'redstone_lamp_on'};
const GENERIC=new Set(['block','stairs','slab','door','double','wall','fence','trapdoor','pressure','plate','button']);
export class BedrockSource extends TexSource{
  constructor(atlas,meta){super(atlas);this.meta=meta}
  get kind(){return 'bedrock'}
  nameOf(n){const id=javaToBedrock(n);return this.meta.names[id]||this.meta.names[n]||null}
  hasBlock(n){return this.meta.blocks[javaToBedrock(n)]!==undefined}
  tile(key,tokens){
    const files=this.meta.terrain[key];if(!files||!files.length)return -1;
    let f=files[0];
    if(files.length>1){let best=-1;for(const c of files){const sc=tokens.filter(t=>c.includes(t)).length;if(sc>best){best=sc;f=c}}}
    return this.t(f);
  }
  spec(n){
    let id=javaToBedrock(n);if(this.meta.blocks[id]!==undefined)return [this.meta.blocks[id],id];
    const b=n.replace(/_(stairs|slab|wall|fence_gate|fence|button|pressure_plate|trapdoor|door|carpet|pane)$/,'');
    for(const c of [b,b+'s',b+'_planks',b+'_block',b+'_wool']){id=javaToBedrock(c);if(this.meta.blocks[id]!==undefined)return [this.meta.blocks[id],id]}
    return [undefined,n];
  }
  tilesFor(n,h){
    const key=n+'/'+(h||'');if(this.cache[key])return this.cache[key];
    if(LOGICAL[n]){const i=this.t(LOGICAL[n]);return this.cache[key]=[i,i,i]}
    const [sp,id]=this.spec(n);if(sp===undefined)return this.cache[key]=[-1,-1,-1];
    const tokens=id.split('_').filter(t=>t.length>2&&!GENERIC.has(t)),k=typeof sp=='string'?{all:sp}:sp;
    let side=k.north||k.side||k.south||k.east||k.all,top=k.up||k.all||side,bot=k.down||k.all||side;
    if(h&&k.down&&k.side&&/_door$/.test(n))side=top=bot=h=='upper'?k.side:k.down;
    const s=this.tile(side,tokens),t=this.tile(top,tokens),b=this.tile(bot,tokens);
    return this.cache[key]=[s<0?t:s,t<0?s:t,b<0?(t<0?s:t):b];
  }
  faceTiles(n,p){return faceTiles(n,p,'bedrock',k=>this.t(k),m=>this.tilesFor(m))}
}
