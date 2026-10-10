/* Cliente de la API. La cabecera X-Requested-With protege las peticiones que modifican datos. */
async function req(method,url,{json,raw,type}={}){
  const o={method,headers:{'X-Requested-With':'fetch'},credentials:'same-origin'};
  if(raw!==undefined){o.body=raw;o.headers['Content-Type']=type||'application/octet-stream'}
  else if(json!==undefined){o.body=JSON.stringify(json);o.headers['Content-Type']='application/json'}
  const r=await fetch(url,o);let d=null;try{d=await r.json()}catch{}
  if(!r.ok)throw Object.assign(new Error((d&&d.error)||'Error '+r.status),{status:r.status});
  return d;
}
export const api={
  get:u=>req('GET',u),
  post:(u,json)=>req('POST',u,{json}),
  patch:(u,json)=>req('PATCH',u,{json}),
  del:u=>req('DELETE',u),
  put:(u,raw,type)=>req('PUT',u,{raw,type}),
};
