/* Subir una construcción (rol Usuario): archivo de estructura + imágenes. */
import {h,toast} from '../ui.js';
import {api} from '../api.js';
import {auth,can,openAuth} from '../auth.js';

const PLAT={'.mcstructure':'Bedrock','.nbt':'Java','.schem':'Java','.litematic':'Java'};
async function prepImage(file){
  if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw new Error(`${file.name}: solo PNG, JPG o WEBP`);
  if(file.size<1.2*1048576)return file;                         // se reduce si pesa mucho
  const bm=await createImageBitmap(file),k=Math.min(1,1600/Math.max(bm.width,bm.height)),c=document.createElement('canvas');
  c.width=Math.round(bm.width*k);c.height=Math.round(bm.height*k);c.getContext('2d').drawImage(bm,0,0,c.width,c.height);
  return new Promise(r=>c.toBlob(r,'image/jpeg',.88));
}
export async function uploadPage(m,qs,app){
  if(!can('build:create')){
    app.append(h('div',{class:'empty'},auth.user?'Tu rol no puede subir construcciones.':['Inicia sesión para subir construcciones. ',h('button',{class:'link',onclick:()=>openAuth('login')},'Iniciar sesión')]));return;
  }
  const {categories:cats}=auth.meta;
  const title=h('input',{id:'u-title',maxlength:80,placeholder:'Ej.: Casa moderna con piscina'}),
    desc=h('textarea',{id:'u-desc',maxlength:2000,rows:4,placeholder:'Descripción, cómo usarla, versión del juego…'}),
    cat=h('select',{id:'u-cat'},h('option',{value:''},'Elige un tipo…'),cats.map(c=>h('option',{value:c[0]},c[1]))),
    tags=h('input',{id:'u-tags',placeholder:'Etiquetas separadas por coma (máx. 5)'}),
    file=h('input',{id:'u-file',type:'file',accept:'.mcstructure,.nbt,.schem,.litematic'}),
    imgs=h('input',{id:'u-imgs',type:'file',accept:'image/png,image/jpeg,image/webp',multiple:true}),
    kind=h('p',{class:'muted',id:'u-kind'},'Formatos: .mcstructure (Bedrock) · .nbt, .schem, .litematic (Java)'),
    previews=h('div',{class:'thumbs',id:'u-prev'}),status=h('p',{class:'muted',id:'u-status'}),err=h('p',{class:'error',id:'u-err'}),
    send=h('button',{class:'btn',id:'u-send'},'Publicar');
  let files=[];
  file.addEventListener('change',()=>{const f=file.files[0],x=f&&f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
    kind.textContent=f?(PLAT[x]?`Se clasificará como ${PLAT[x]} · ${(f.size/1024).toFixed(0)} KB`:'Formato no admitido'):'Formatos: .mcstructure (Bedrock) · .nbt, .schem, .litematic (Java)'});
  imgs.addEventListener('change',()=>{
    files=[...imgs.files].slice(0,6);previews.replaceChildren(...files.map(f=>h('img',{src:URL.createObjectURL(f),alt:f.name})));
    if(imgs.files.length>6)toast('Máximo 6 imágenes: se usarán las primeras 6');
  });
  send.addEventListener('click',async()=>{
    err.textContent='';
    try{
      const f=file.files[0];
      if(!f)throw new Error('Selecciona el archivo de la estructura');
      if(!files.length)throw new Error('Sube al menos una imagen');
      send.disabled=true;
      status.textContent='Creando publicación…';
      const {id}=await api.post('/api/builds',{title:title.value,description:desc.value,category:cat.value,tags:tags.value.split(',')});
      status.textContent='Subiendo y analizando la estructura…';
      const a=await api.put(`/api/builds/${id}/file?name=${encodeURIComponent(f.name)}`,f);
      status.textContent=`Detectada: ${a.platform=='bedrock'?'Bedrock':'Java'} · ${a.dims.w}×${a.dims.h}×${a.dims.l} · ${a.total} bloques. Subiendo imágenes…`;
      for(let i=0;i<files.length;i++){const im=await prepImage(files[i]);await api.put(`/api/builds/${id}/images/${i+1}`,im,im.type)}
      await api.post(`/api/builds/${id}/publish`);
      toast('Construcción publicada','ok');location.hash='#/build/'+id;
    }catch(e){err.textContent=e.message;status.textContent='';send.disabled=false}
  });
  const field=(l,c)=>h('label',{class:'field'},h('span',{},l),c);
  app.append(h('h1',{},'Subir construcción'),
    h('p',{class:'muted'},'Tu archivo se guarda en el sitio y cualquiera podrá verlo en 3D y descargarlo. La lista de materiales se calcula sola.'),
    h('div',{class:'form card-box'},field('Título',title),field('Tipo de construcción',cat),field('Descripción',desc),field('Etiquetas',tags),
      field('Archivo de la estructura',file),kind,field('Imágenes (1 a 6, la primera es la portada)',imgs),previews,err,status,send));
}
