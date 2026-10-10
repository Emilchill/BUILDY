/* Archivos estáticos del sitio (lista blanca: nada de server/, storage/ ni package.json). */
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from '../config.js';
import {httpError as E} from '../errors.js';
import {pipeStream} from '../http.js';
import {MIME} from '../util.js';

const ok=p=>p=='/'||p=='/index.html'||p=='/viewer.html'||p=='/data/aliases.json'||/^\/(css|js)\/[\w./-]+$/.test(p);
const CSP="default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
export async function serveStatic(req,res,p){
  if(!ok(p)||p.includes('..'))throw E(404,'No encontrado');
  const f=path.join(ROOT,p=='/'?'index.html':p.slice(1));
  let st;try{st=await fs.promises.stat(f)}catch{throw E(404,'No encontrado')}
  if(!f.startsWith(ROOT)||!st.isFile())throw E(404,'No encontrado');
  const ext=path.extname(f),h={'Content-Type':MIME[ext]||'application/octet-stream','Content-Length':st.size,'Cache-Control':'no-cache'};
  if(ext=='.html')h['Content-Security-Policy']=CSP;
  return pipeStream(res,200,h,fs.createReadStream(f));
}
