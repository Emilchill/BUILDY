/* Router por hash: #/  #/build/<id>  #/subir  #/admin */
const routes=[];
export const route=(re,fn)=>routes.push([re,fn]);
export const refresh=()=>go();
export async function go(){
  const [path,qs]=(location.hash.slice(1)||'/').split('?'),app=document.getElementById('app');
  for(const [re,fn] of routes){
    const m=re.exec(path);
    if(m){app.replaceChildren();window.scrollTo&&window.scrollTo(0,0);
      try{await fn(m,new URLSearchParams(qs||''),app)}catch(e){app.replaceChildren(Object.assign(document.createElement('p'),{className:'empty',textContent:e.message}))}
      return;
    }
  }
  location.hash='#/';
}
export const start=()=>{addEventListener('hashchange',go);return go()};
