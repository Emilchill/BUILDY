/* Configuración central (variables de entorno + límites). Todo valor ajustable vive aquí. */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function loadConfig(over={}){
  const e=process.env;
  return {
    port:+(over.port??e.PORT??8000),
    storage:over.storage||e.STORAGE||'file',            // 'file' hoy; 'postgres' | 's3' ... mañana (ver docs/ESCALABILIDAD.md)
    dir:over.dir||e.STORAGE_DIR||path.join(ROOT,'storage'),
    adminPassword:over.adminPassword??e.ADMIN_PASSWORD,
    secureCookies:e.SECURE_COOKIES=='1',
    accessLog:e.ACCESS_LOG=='1',
    log:over.log||console.log,
    limits:{
      file:64<<20,image:5<<20,textures:40<<20,json:1<<20,images:6,pageMax:48,
      draftsPerUser:5,buildsPerUser:500,draftTtlMs:864e5,
      writes:120,writeWindowMs:10*60e3,                 // escrituras por usuario/IP
      loginPerIp:10,loginPerName:8,loginWindowMs:10*60e3,registerPerIp:5,registerWindowMs:3600e3,
      ...over.limits},
  };
}
