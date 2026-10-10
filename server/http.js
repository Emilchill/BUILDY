/* Utilidades HTTP sin framework: respuestas (con gzip), lectura de cuerpos, cookies, streams. */
import zlib from 'node:zlib';
import {promisify} from 'node:util';
import {httpError} from './errors.js';
const gzip=promisify(zlib.gzip);
export const SEC={'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY'};

export async function send(req,res,code,body,headers={}){
  const isJson=!(Buffer.isBuffer(body)||typeof body=='string');
  let buf=Buffer.from(isJson?JSON.stringify(body):body);
  const h={'Content-Type':isJson?'application/json; charset=utf-8':'text/plain; charset=utf-8',...SEC,...headers};
  if(buf.length>1024&&/\bgzip\b/.test(req.headers['accept-encoding']||'')){buf=await gzip(buf,{level:4});h['Content-Encoding']='gzip';h.Vary='Accept-Encoding'}
  h['Content-Length']=buf.length;res.writeHead(code,h);res.end(req.method=='HEAD'?undefined:buf);
}
export function readBody(req,limit){
  return new Promise((ok,bad)=>{
    const ch=[];let n=0,over=false;
    req.on('data',c=>{n+=c.length;if(over)return;if(n>limit){over=true;return}ch.push(c)});
    req.on('end',()=>over?bad(httpError(413,'Archivo demasiado grande')):ok(Buffer.concat(ch)));req.on('error',bad);
  });
}
export async function readJson(req,limit){
  const b=await readBody(req,limit);
  try{return JSON.parse(b.toString('utf8')||'{}')}catch{throw httpError(400,'JSON inválido')}
}
export const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(s=>s.trim().split('=')).filter(a=>a[0]).map(([k,...v])=>[k,decodeURIComponent(v.join('='))]));
/* Envía un stream de archivo con cabeceras; un fallo de lectura no tumba el proceso */
export function pipeStream(res,code,headers,stream){
  res.writeHead(code,{...SEC,...headers});stream.on('error',()=>res.destroy());stream.pipe(res);
}
