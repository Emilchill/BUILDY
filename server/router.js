/* Router mínimo: r.get('/api/builds/:id', handler). Los parámetros son segmentos sin "/". */
export class Router{
  constructor(){this.routes=[]}
  add(method,pattern,handler){
    const keys=[],re=new RegExp('^'+pattern.replace(/:(\w+)/g,(_,k)=>{keys.push(k);return '([^/]+)'})+'$');
    this.routes.push({method,re,keys,handler});return this;
  }
  get(p,h){return this.add('GET',p,h)}post(p,h){return this.add('POST',p,h)}put(p,h){return this.add('PUT',p,h)}
  patch(p,h){return this.add('PATCH',p,h)}delete(p,h){return this.add('DELETE',p,h)}
  match(method,path){
    const m2=method=='HEAD'?'GET':method;
    for(const r of this.routes){
      if(r.method!=m2)continue;const m=r.re.exec(path);
      if(m)return {handler:r.handler,params:Object.fromEntries(r.keys.map((k,i)=>[k,m[i+1]]))};
    }
    return null;
  }
}
