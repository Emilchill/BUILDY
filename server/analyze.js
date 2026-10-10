/* Analiza una estructura subida: valida el formato y extrae plataforma, tamaño y materiales. */
import path from 'node:path';
import zlib from 'node:zlib';
import {readStructure} from '../js/formats/loaders.js';
import {Builder} from '../js/formats/model.js';
import {sizeClass} from '../js/catalog.js';

export const EXT_PLATFORM={'.mcstructure':'bedrock','.nbt':'java','.schem':'java','.litematic':'java'};
const MAX_UNZIPPED=400*1024*1024;
Builder.maxCells=8e7;   // ~160 MB de rejilla como máximo

export async function analyze(buf,filename){
  const ext=path.extname(filename||'').toLowerCase(),platform=EXT_PLATFORM[ext];
  if(!platform)throw Object.assign(new Error('Formato no admitido. Usa .mcstructure (Bedrock) o .nbt / .schem / .litematic (Java).'),{status:400});
  let raw=buf;
  try{
    if(buf[0]==0x1f&&buf[1]==0x8b)raw=zlib.gunzipSync(buf,{maxOutputLength:MAX_UNZIPPED});
    else if(buf[0]==0x78)raw=zlib.inflateSync(buf,{maxOutputLength:MAX_UNZIPPED});
  }catch{throw Object.assign(new Error('Archivo comprimido inválido o demasiado grande.'),{status:400})}
  let m;
  try{m=await readStructure(new Uint8Array(raw),filename)}
  catch(e){throw Object.assign(new Error('No se pudo leer la estructura: '+e.message),{status:400})}
  const materials=m.names.map((id,i)=>[id,m.counts[i]]).filter(r=>r[1]>0).sort((a,b)=>b[1]-a[1]);
  const dims={w:m.W,h:m.H,l:m.L};
  return {platform,format:ext.slice(1),dims,size:sizeClass(dims),total:m.total,types:materials.length,materials};
}
