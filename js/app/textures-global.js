/* Texturas globales de la web (las publica el administrador). Se descargan una vez y se reutilizan. */
import {api} from './api.js';
import {recordToAtlas} from '../textures/atlas.js';
import {BedrockSource} from '../textures/bedrock.js';
import {JavaSource} from '../textures/java.js';

let cache=null;
export const resetGlobalSources=()=>{cache=null};
export function globalSources(){
  return cache||(cache=(async()=>{
    const st=await api.get('/api/textures'),out={};
    for(const k of ['bedrock','java']){
      if(!st[k])continue;
      try{
        const [ix,blob]=await Promise.all([fetch(`/api/textures/${k}/index.json`).then(r=>r.json()),fetch(`/api/textures/${k}/atlas.png`).then(r=>r.blob())]);
        const atlas=await recordToAtlas({blob,cols:ix.cols,rows:ix.rows,names:ix.names});
        out[k]=k=='bedrock'?new BedrockSource(atlas,ix.meta):new JavaSource(atlas);
      }catch(e){console.warn('Texturas',k,e)}
    }
    return out;
  })());
}
/* La plataforma de la obra decide qué set usar; si falta, el otro (los nombres se traducen con data/aliases.json) */
export const pickSource=(src,platform)=>platform=='java'?(src.java||src.bedrock||null):(src.bedrock||src.java||null);
export const nameFn=src=>id=>(src.bedrock&&src.bedrock.nameOf(id))||null;
