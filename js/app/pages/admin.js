/* Texturas globales (rol Administrador): procesa un pack en el navegador y publica el atlas para toda la web. */
import {h,toast,loadScript,JSZIP_URL,fmtDate} from '../ui.js';
import {api} from '../api.js';
import {auth,can} from '../auth.js';
import {buildAtlas} from '../../textures/atlas.js';
import {isBedrockPack,loadBedrockZip} from '../../textures/bedrock.js';
import {isJavaPack,javaEntries} from '../../textures/java.js';
import {resetGlobalSources} from '../textures-global.js';

const toB64=blob=>new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result.split(',')[1]);fr.readAsDataURL(blob)});

export async function adminPage(m,qs,app){
  if(!can('textures:update')){app.append(h('div',{class:'empty'},'Esta sección es solo para administradores.'));return}
  const status=await api.get('/api/textures');
  const cur=k=>status[k]?`${status[k].count} texturas · ${fmtDate(status[k].updatedAt)} · por ${status[k].updatedBy}`:'Sin texturas';
  const file=h('input',{id:'a-file',type:'file',accept:'.zip,.jar,.mcpack'}),log=h('p',{class:'muted',id:'a-log'}),err=h('p',{class:'error',id:'a-err'}),
    prev=h('div',{id:'a-prev'}),send=h('button',{class:'btn',id:'a-send',disabled:true},'Publicar para toda la web');
  let ready=null;
  file.addEventListener('change',async()=>{
    err.textContent='';ready=null;send.disabled=true;prev.replaceChildren();
    const f=file.files[0];if(!f)return;
    try{
      log.textContent='Leyendo el pack…';await loadScript(JSZIP_URL);
      const z=await JSZip.loadAsync(f);let kind,atlas,meta;
      if(isBedrockPack(z)){kind='bedrock';({atlas,meta}=await loadBedrockZip(z))}
      else if(isJavaPack(z)){kind='java';atlas=await buildAtlas(javaEntries(z))}
      else throw new Error('No reconozco el pack: usa el .zip de bedrock-samples o un resource pack de Java.');
      ready={kind,atlas,meta};atlas.canvas.className='atlas-prev';prev.replaceChildren(atlas.canvas);
      log.textContent=`Pack ${kind=='bedrock'?'Bedrock':'Java'} listo: ${atlas.names.size} texturas`+(meta?` y ${Object.keys(meta.names).length} nombres`:'')+'. Revisa la vista previa y publica.';
      send.disabled=false;
    }catch(e){err.textContent=e.message;log.textContent=''}
  });
  send.addEventListener('click',async()=>{
    if(!ready)return;send.disabled=true;err.textContent='';log.textContent='Publicando…';
    try{
      const {kind,atlas,meta}=ready,blob=await new Promise(r=>atlas.canvas.toBlob(r));
      await api.post('/api/admin/textures/'+kind,{cols:atlas.cols,rows:atlas.rows,names:[...atlas.names],png:await toB64(blob),meta});
      resetGlobalSources();toast('Texturas globales actualizadas','ok');log.textContent='Listo: ya las ve toda la web.';
      document.getElementById('a-cur-'+kind).textContent=cur(kind).replace(/^.*$/,`${atlas.names.size} texturas · recién actualizado`);
    }catch(e){err.textContent=e.message;send.disabled=false;log.textContent=''}
  });
  app.append(h('h1',{},'Texturas globales'),
    h('p',{class:'muted'},`Sesión de ${auth.user.name}. Aquí actualizas las texturas que ve toda la web. Para editar o eliminar publicaciones de otros usa Moderación.`),
    h('div',{class:'card-box'},h('h2',{},'Estado actual'),
      h('p',{},h('b',{},'Bedrock: '),h('span',{id:'a-cur-bedrock'},cur('bedrock'))),h('p',{},h('b',{},'Java: '),h('span',{id:'a-cur-java'},cur('java')))),
    h('div',{class:'card-box form'},h('h2',{},'Actualizar'),
      h('p',{class:'muted'},'Sube el .zip de bedrock-samples (actualiza el set Bedrock, nombres incluidos) o un resource pack de Java (actualiza el set Java). Se procesa en tu navegador y solo se envía el atlas.'),
      file,log,prev,err,send),
    h('div',{class:'notice'},h('b',{},'Aviso: '),'las texturas de Minecraft son de Mojang/Microsoft (EULA). Al publicarlas las servirás a todos los visitantes; usa solo un pack que tengas derecho a distribuir, o mantén el sitio en privado.'));
}
