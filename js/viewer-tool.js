/* Punto de entrada: conecta archivos, packs de texturas, visor y lista de materiales. */
import {Viewer} from './render/scene.js';
import {buildGeometry} from './render/mesh.js';
import {readStructure,demo} from './formats/loaders.js';
import {shapeOpts} from './blocks/shapes.js';
import {setAliases} from './blocks/bedrock.js';
import {colorOf,tintRGB} from './blocks/colors.js';
import {buildAtlas,atlasToRecord,recordToAtlas} from './textures/atlas.js';
import {savePack,loadPack,clearPack} from './textures/store.js';
import {JavaSource,isJavaPack,javaEntries} from './textures/java.js';
import {BedrockSource,isBedrockPack,loadBedrockZip} from './textures/bedrock.js';
import {buildMaterials,sortRows,toCSV,stacks} from './materials.js';

const $=id=>document.getElementById(id);
const st={model:null,hidden:new Set(),maxY:0,use:'colors',src:{}};
const view=new Viewer($('cv'),$('view'));
const msg=t=>{$('msg').textContent=t};

/* ---------- texturas ---------- */
function activate(kind,source,label){
  st.src[kind]=source;
  if(![...$('texsrc').options].some(o=>o.value==kind))$('texsrc').add(new Option(label,kind));
  $('texsrc').value=st.use=kind;refresh();renderMaterials();
}
async function installBedrock(zip){
  msg('Leyendo bedrock-samples (blocks.json, terrain_texture.json, texturas y nombres)…');
  const {atlas,meta}=await loadBedrockZip(zip);
  await savePack('bedrock',{...await atlasToRecord(atlas),meta});
  activate('bedrock',new BedrockSource(atlas,meta),'Bedrock (bedrock-samples)');
  msg(`Bedrock listo: ${atlas.names.size} texturas, ${Object.keys(meta.names).length} nombres. Guardado en este navegador.`);
}
async function installJava(zip){
  msg('Leyendo texturas de Java…');
  const atlas=await buildAtlas(javaEntries(zip));
  await savePack('java',await atlasToRecord(atlas));
  activate('java',new JavaSource(atlas),'Java (resource pack)');
  msg(`Java listo: ${atlas.names.size} texturas. Guardado en este navegador.`);
}
async function restore(){
  for(const k of ['java','bedrock']){
    const rec=await loadPack(k);if(!rec)continue;
    const atlas=await recordToAtlas(rec);
    activate(k,k=='bedrock'?new BedrockSource(atlas,rec.meta):new JavaSource(atlas),k=='bedrock'?'Bedrock (bedrock-samples)':'Java (resource pack)');
  }
}

/* ---------- modelo ---------- */
const nameOf=n=>(st.src.bedrock&&st.src.bedrock.nameOf(n))||null;
function show(m){
  st.model=m;st.hidden=new Set();st.maxY=m.H-1;
  $('s-dim').textContent=`${m.W} × ${m.H} × ${m.L}`;$('s-cnt').textContent=m.total.toLocaleString('es');$('s-typ').textContent=m.names.filter((_,i)=>m.counts[i]>0).length;
  const ly=$('layer');ly.max=m.H-1;ly.value=m.H-1;$('lay').textContent=m.H-1;
  view.fit(m);refresh();renderMaterials();
}
function refresh(){
  if(!st.model)return;const tex=st.src[st.use]||null;
  view.setMesh(buildGeometry(st.model,{hidden:st.hidden,maxY:st.maxY,tex}),tex?tex.canvas:null);
}
function swatch(n){
  const c=document.createElement('canvas');c.width=c.height=16;const g=c.getContext('2d'),tex=st.src[st.use];let i=-1;
  if(tex){const t=tex.tilesFor(n);i=t[1]>=0?t[1]:t[0]}
  if(i>=0){tex.drawTile(g,i,16);const tn=tintRGB(n);if(tn){g.globalCompositeOperation='multiply';g.fillStyle=`rgb(${tn.map(v=>Math.round(v*255))})`;g.fillRect(0,0,16,16)}}
  else{g.fillStyle='#'+colorOf(n)[3];g.fillRect(0,0,16,16)}
  return c;
}
let rows=[];
function renderMaterials(){
  if(!st.model)return;
  const q=$('q').value.trim().toLowerCase();
  rows=sortRows(buildMaterials(st.model,nameOf),$('sort').value).filter(r=>!q||r.name.toLowerCase().includes(q)||r.id.includes(q));
  const list=$('list');list.innerHTML='';
  for(const r of rows){
    const el=document.createElement('div');el.className='row'+(st.hidden.has(r.i)?' off':'');el.title=r.id;
    const k=stacks(r.count);
    el.append(swatch(r.id));
    const nm=document.createElement('span');nm.className='nm';nm.textContent=r.name;
    const ct=document.createElement('span');ct.className='ct';ct.textContent=r.count.toLocaleString('es')+(r.count>=64?` (${k.s}×64${k.r?`+${k.r}`:''})`:'');
    el.append(nm,ct);
    el.onclick=()=>{st.hidden.has(r.i)?st.hidden.delete(r.i):st.hidden.add(r.i);el.classList.toggle('off');refresh()};
    list.append(el);
  }
}
$('q').addEventListener('input',renderMaterials);$('sort').addEventListener('change',renderMaterials);
$('csv').onclick=()=>{
  const blob=new Blob(['\uFEFF'+toCSV(sortRows(buildMaterials(st.model,nameOf),'count'))],{type:'text/csv'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='materiales.csv';a.click();
};

/* ---------- archivos ---------- */
async function loadModel(buf,name){
  const m=await readStructure(buf,name);show(m);msg(`${name} — ${m.total.toLocaleString('es')} bloques`);
}
async function handle(f){
  msg('Procesando '+f.name+'…');
  try{
    const head=new Uint8Array(await f.slice(0,4).arrayBuffer());
    if(head[0]==0x50&&head[1]==0x4b){
      const z=await JSZip.loadAsync(f);
      if(isBedrockPack(z))return await installBedrock(z);
      if(isJavaPack(z))return await installJava(z);
      const e=Object.values(z.files).find(x=>!x.dir&&/\.(mcstructure|nbt|schem|litematic)$/i.test(x.name));
      if(!e)throw new Error('El .zip no contiene estructuras ni texturas reconocibles.');
      return await loadModel(await e.async('uint8array'),e.name);
    }
    await loadModel(new Uint8Array(await f.arrayBuffer()),f.name);
  }catch(err){console.error(err);msg('Error: '+err.message)}
}
for(const id of ['file','file2'])$(id).addEventListener('change',e=>{if(e.target.files[0])handle(e.target.files[0]);e.target.value=''});
$('demo').onclick=()=>{show(demo());msg('Estructura de ejemplo')};
const dz=$('drop');
['dragenter','dragover'].forEach(t=>$('view').addEventListener(t,e=>{e.preventDefault();dz.style.display='flex'}));
['dragleave','drop'].forEach(t=>$('view').addEventListener(t,e=>{e.preventDefault();dz.style.display='none'}));
$('view').addEventListener('drop',e=>{if(e.dataTransfer.files[0])handle(e.dataTransfer.files[0])});

/* ---------- controles ---------- */
$('layer').addEventListener('input',e=>{st.maxY=+e.target.value;$('lay').textContent=st.maxY;refresh()});
$('rot').addEventListener('change',e=>view.auto=e.target.checked);
$('texsrc').addEventListener('change',e=>{st.use=e.target.value;refresh();renderMaterials()});
for(const [id,key] of [['levinv','levInv'],['levflip','levFlip']])
  $(id).addEventListener('change',e=>{shapeOpts[key]=e.target.checked;if(st.model){st.model.shp=null;refresh()}});
$('clear').onclick=async()=>{await Promise.all([clearPack('java'),clearPack('bedrock')]);st.src={};st.use='colors';
  [...$('texsrc').options].forEach(o=>{if(o.value!='colors')o.remove()});$('texsrc').value='colors';refresh();renderMaterials();msg('Texturas guardadas borradas.')};

/* ---------- arranque ---------- */
(async()=>{
  try{setAliases(await (await fetch('data/aliases.json')).json())}catch(e){console.warn('Sin data/aliases.json (¿abriste el archivo sin servidor?)',e)}
  show(demo());
  try{await restore()}catch(e){console.warn(e)}
})();
