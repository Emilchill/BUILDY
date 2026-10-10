/* Configuración central (variables de entorno + límites). Todo valor ajustable vive aquí. */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEFAULT_ADMIN,LIMITS} from './defaults.js';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
/* Cuenta admin "hardcode" para la beta: usuario y contraseña por defecto. Se sobrescriben con ADMIN_USER / ADMIN_PASSWORD.
   En producción (NODE_ENV=production o SECURE_COOKIES=1) el servidor se niega a arrancar con la contraseña por defecto. */
export {DEFAULT_ADMIN};
export function loadConfig(over={}){
  const e=process.env,adminPassword=over.adminPassword??e.ADMIN_PASSWORD??DEFAULT_ADMIN.password;
  return {
    adminUser:over.adminUser??e.ADMIN_USER??DEFAULT_ADMIN.name,
    adminIsDefault:adminPassword===DEFAULT_ADMIN.password,
    port:+(over.port??e.PORT??8000),
    storage:over.storage||e.STORAGE||'file',            // 'file' hoy; 'postgres' | 's3' ... mañana (ver docs/ESCALABILIDAD.md)
    dir:over.dir||e.STORAGE_DIR||path.join(ROOT,'storage'),
    adminPassword,
    secureCookies:e.SECURE_COOKIES=='1',
    accessLog:e.ACCESS_LOG=='1',
    log:over.log||console.log,
    limits:{...LIMITS,...over.limits},
  };
}
