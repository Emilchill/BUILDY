/* Visor 3D como ventana opcional dentro de la ficha de una construcción (carga three.js solo si se abre). */
import {h,modal,loadScript,THREE_URL} from './ui.js';
import {readStructure} from '../formats/loaders.js';
import {buildGeometry} from '../render/mesh.js';
import {globalSources,pickSource} from './textures-global.js';
import {api} from './api.js';

export async function openViewer(build){
  const status=h('span',{class:'muted',id:'v-status'},'Cargando visor 3D…');
  const layer=h('input',{type:'range',id:'v-layer',min:0,max:0,value:0}),rot=h('input',{type:'checkbox',id:'v-rot'});
  const texSel=h('select',{id:'v-tex'},h('option',{value:'colors'},'Colores lisos'));
  const box=h('div',{class:'vbox',id:'v-box'},h('canvas',{id:'v-cv'}));
  let vw=null;
  const m=modal(`${build.title} · visor 3D`,h('div',{class:'viewer'},box,h('div',{class:'vbar'},h('label',{},'Capa ',layer),h('label',{},rot,' Rotar'),h('label',{},'Texturas ',texSel),status)),
    {wide:true,onclose:()=>vw&&vw.dispose()});
  try{
    await loadScript(THREE_URL);
    const {Viewer}=await import('../render/scene.js');
    const [buf,src]=await Promise.all([
      api.blob(`/api/builds/${build.id}/file`).then(b=>b.arrayBuffer()).catch(()=>{throw new Error('No se pudo descargar la estructura')}),
      globalSources().catch(()=>({}))]);
    const model=await readStructure(new Uint8Array(buf),build.file.name);
    vw=new Viewer(box.querySelector('canvas'),box);vw.fit(model);
    let maxY=model.H-1;layer.max=maxY;layer.value=maxY;
    const first=pickSource(src,build.platform);let use=first?first.kind:'colors';
    for(const k of Object.keys(src))texSel.add(new Option(k=='bedrock'?'Texturas Bedrock':'Texturas Java',k));
    texSel.value=use;
    const refresh=()=>{const tex=use=='colors'?null:src[use];vw.setMesh(buildGeometry(model,{maxY,tex}),tex?tex.canvas:null)};
    layer.addEventListener('input',()=>{maxY=+layer.value;refresh()});
    rot.addEventListener('change',()=>vw.auto=rot.checked);
    texSel.addEventListener('change',()=>{use=texSel.value;refresh()});
    refresh();
    status.textContent=Object.keys(src).length?`${model.W}×${model.H}×${model.L} · arrastra para girar, rueda para acercar`:'Sin texturas globales todavía: se muestran colores lisos';
  }catch(e){console.error(e);status.textContent='Error: '+e.message}
  return m;
}
