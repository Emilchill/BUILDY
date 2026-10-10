/* Valores compartidos por el servidor Node y por el modo local del navegador (sin dependencias de Node). */
export const DEFAULT_ADMIN={name:'admin',password:'admin12345'};
export const LIMITS={
  file:64<<20,image:5<<20,textures:40<<20,json:1<<20,images:6,pageMax:48,
  draftsPerUser:5,buildsPerUser:500,draftTtlMs:864e5,
  writes:120,writeWindowMs:10*60e3,
  loginPerIp:10,loginPerName:8,loginWindowMs:10*60e3,registerPerIp:5,registerWindowMs:3600e3,
};
