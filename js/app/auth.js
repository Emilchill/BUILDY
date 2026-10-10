/* Sesión: botón "Iniciar sesión (beta)", registro, navegación según el rol. */
import {h,$,modal,toast} from './ui.js';
import {api} from './api.js';
import {refresh} from './router.js';

export const auth={user:null,meta:{categories:[],sizes:[],platforms:[]}};
export const can=p=>!!auth.user&&auth.user.can.includes(p);

export async function initAuth(){
  const s=await api.get('/api/session');auth.user=s.user;auth.meta=s;renderAuth();
}
export function renderAuth(){
  const nav=$('nav'),box=$('auth');
  nav.replaceChildren(h('a',{href:'#/'},'Catálogo'),
    can('build:create')&&h('a',{href:'#/subir'},'Subir construcción'),
    can('build:edit')&&h('a',{href:'#/mias'},'Mis construcciones'),
    can('textures:update')&&h('a',{href:'#/admin'},'Texturas globales'));
  if(!auth.user){box.replaceChildren(h('button',{class:'btn',id:'login-btn',onclick:()=>openAuth('login')},'Iniciar sesión ',h('span',{class:'beta'},'beta')));return}
  box.replaceChildren(h('span',{class:'who'},auth.user.name,' ',h('span',{class:'role '+auth.user.role},auth.user.roleLabel)),
    h('button',{class:'btn sec',id:'logout-btn',onclick:async()=>{await api.post('/api/logout');auth.user=null;renderAuth();toast('Sesión cerrada');if(location.hash!='#/')location.hash='#/';else refresh()}},'Salir'));
}
export function openAuth(tab='login'){
  const body=h('div',{class:'form'}),m=modal(tab=='login'?'Iniciar sesión (beta)':'Crear cuenta',body);
  const draw=t=>{
    const name=h('input',{id:'f-name',placeholder:'Usuario',autocomplete:'username',maxlength:24}),
      pw=h('input',{id:'f-pass',type:'password',placeholder:'Contraseña (mínimo 8)',autocomplete:t=='login'?'current-password':'new-password',maxlength:72}),
      err=h('p',{class:'error',id:'f-err'});
    const go=async e=>{
      e&&e.preventDefault();err.textContent='';
      try{
        const r=await api.post(t=='login'?'/api/login':'/api/register',{name:name.value.trim(),password:pw.value});
        auth.user=r.user;renderAuth();m.close();toast(`Hola, ${r.user.name}`,'ok');refresh();
      }catch(ex){err.textContent=ex.message}
    };
    body.replaceChildren(
      h('p',{class:'muted'},t=='login'?'Función en beta. Cualquiera puede ver el catálogo; para publicar necesitas una cuenta.':'Las cuentas nuevas son de tipo Usuario: pueden subir archivos e imágenes.'),
      name,pw,err,
      h('button',{class:'btn',id:'f-submit',onclick:go},t=='login'?'Entrar':'Crear cuenta'),
      h('button',{class:'link',id:'f-switch',onclick:()=>draw(t=='login'?'register':'login')},t=='login'?'¿No tienes cuenta? Crear una':'Ya tengo cuenta'));
    pw.addEventListener('keydown',e=>{if(e.key=='Enter')go()});name.focus();
  };
  draw(tab);return m;
}
