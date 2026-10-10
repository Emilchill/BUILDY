/* Editar una publicación propia: datos, imágenes (añadir, portada, quitar), archivo y eliminación. */
import {h,toast,confirmDialog,fmt} from '../ui.js';
import {api} from '../api.js';
import {auth,can} from '../auth.js';

const nOf=u=>+/\/images\/(\d)/.exec(u)[1];
export async function editPage(m,qs,app){
  if(!can('build:edit')&&!can('build:moderate')){app.append(h('div',{class:'empty'},'Inicia sesión para editar tus publicaciones.'));return}
  let b=await api.get('/api/builds/'+m[1]);
  if(!b.canManage){app.append(h('div',{class:'empty'},'Solo puedes editar tus propias publicaciones.'));return}
  const cats=auth.meta.categories,back=b.mine?'#/mias':'#/moderar',mod=!b.mine;
  const title=h('input',{id:'e-title',maxlength:80,value:b.title}),desc=h('textarea',{id:'e-desc',maxlength:2000,rows:4}),
    cat=h('select',{id:'e-cat'},cats.map(c=>h('option',{value:c[0]},c[1]))),tags=h('input',{id:'e-tags',value:b.tags.join(', ')}),
    err=h('p',{class:'error',id:'e-err'}),imgBox=h('div',{class:'edit-imgs',id:'e-imgs'}),fileBox=h('div',{id:'e-fileinfo',class:'muted'}),
    addImgs=h('input',{id:'e-addimg',type:'file',accept:'image/png,image/jpeg,image/webp',multiple:true}),
    fileIn=h('input',{id:'e-file',type:'file',accept:'.mcstructure,.nbt,.schem,.litematic'}),status=h('p',{class:'muted',id:'e-status'});
  desc.value=b.description||'';cat.value=b.category;
  const reload=async()=>{b=await api.get('/api/builds/'+b.id);drawImgs();drawFile()};
  const run=async(fn,okMsg)=>{err.textContent='';try{await fn();if(okMsg)toast(okMsg,'ok')}catch(e){err.textContent=e.status==409?'La publicación cambió en otra pestaña o sesión. Recarga para ver la última versión.':e.message}};

  function drawImgs(){
    const last=b.status=='published'&&b.images.length<=1;
    imgBox.replaceChildren(...b.images.map((u,i)=>h('figure',{class:'img-cell','data-n':nOf(u)},h('img',{src:u,alt:'Imagen '+(i+1)}),
      h('figcaption',{},i==0?h('span',{class:'chip'},'Portada'):h('button',{class:'link img-cover',onclick:()=>run(async()=>{await api.post(`/api/builds/${b.id}/images/${nOf(u)}/cover`);await reload()},'Portada cambiada')},'Hacer portada'),
        h('button',{class:'link danger-link img-del',disabled:last,title:last?'Una publicación necesita al menos una imagen':'',onclick:()=>run(async()=>{await api.del(`/api/builds/${b.id}/images/${nOf(u)}`);await reload()},'Imagen eliminada')},'Quitar')))));
  }
  function drawFile(){fileBox.textContent=b.file?`${b.file.name} · ${(b.file.size/1024).toFixed(0)} KB · ${b.platform=='bedrock'?'Bedrock':'Java'} · ${b.dims.w}×${b.dims.h}×${b.dims.l} · ${fmt(b.total)} bloques`:'Sin archivo'}
  drawImgs();drawFile();

  const save=h('button',{class:'btn',id:'e-save',onclick:()=>run(async()=>{
    const r=await api.patch('/api/builds/'+b.id,{title:title.value,description:desc.value,category:cat.value,tags:tags.value.split(','),rev:b.rev});b.rev=r.rev;await reload();
  },'Cambios guardados')},'Guardar cambios');
  addImgs.addEventListener('change',()=>run(async()=>{
    const used=new Set(b.images.map(nOf)),free=[1,2,3,4,5,6].filter(n=>!used.has(n));
    const files=[...addImgs.files];if(files.length>free.length)throw new Error(`Solo caben ${free.length} imágenes más (máximo 6)`);
    for(let i=0;i<files.length;i++){status.textContent=`Subiendo imagen ${i+1} de ${files.length}…`;await api.put(`/api/builds/${b.id}/images/${free[i]}`,files[i],files[i].type)}
    status.textContent='';addImgs.value='';await reload();
  },'Imágenes añadidas'));
  const replace=h('button',{class:'btn sec',id:'e-file-send',onclick:()=>run(async()=>{
    const f=fileIn.files[0];if(!f)throw new Error('Selecciona el nuevo archivo');
    status.textContent='Analizando el nuevo archivo…';await api.put(`/api/builds/${b.id}/file?name=${encodeURIComponent(f.name)}`,f);status.textContent='';fileIn.value='';await reload();
  },'Archivo reemplazado: se recalcularon tamaño, plataforma y materiales')},'Reemplazar archivo');
  const publish=b.mine&&b.status=='draft'&&h('button',{class:'btn',id:'e-publish',onclick:()=>run(async()=>{await api.post(`/api/builds/${b.id}/publish`);toast('Publicada','ok');location.hash='#/build/'+b.id})},'Publicar');
  const del=h('button',{class:'btn danger',id:'e-delete',onclick:async()=>{
    if(!await confirmDialog(`Se eliminará «${b.title}» con su archivo e imágenes. Esta acción no se puede deshacer.`))return;
    await run(async()=>{await api.del('/api/builds/'+b.id);toast('Publicación eliminada','ok');location.hash=back});}},'Eliminar publicación');
  const field=(l,c)=>h('label',{class:'field'},h('span',{},l),c);
  app.append(h('a',{class:'back-link',href:back},mod?'← Moderación':'← Mis construcciones'),mod&&h('div',{class:'notice',id:'e-mod'},h('b',{},'Modo admin: '),`estás editando la publicación de ${b.author}. Los cambios quedan registrados en el servidor.`),h('h1',{},'Editar publicación',h('span',{class:'chip status '+b.status,style:'margin-left:10px'},b.status=='published'?'Publicada':'Borrador')),
    h('div',{class:'card-box form'},h('h2',{},'Datos'),field('Título',title),field('Tipo de construcción',cat),field('Descripción',desc),field('Etiquetas (separadas por coma)',tags),err,h('div',{class:'actions'},save,publish)),
    h('div',{class:'card-box form'},h('h2',{},'Imágenes'),h('p',{class:'muted'},'La portada es la primera. Máximo 6.'),imgBox,field('Añadir imágenes',addImgs)),
    h('div',{class:'card-box form'},h('h2',{},'Archivo de la estructura'),fileBox,field('Reemplazar por otro archivo',fileIn),h('div',{class:'actions'},replace),status),
    h('div',{class:'card-box danger-zone'},h('h2',{},'Zona de peligro'),h('p',{class:'muted'},'Eliminar borra la publicación, el archivo y las imágenes para siempre.'),del));
}
