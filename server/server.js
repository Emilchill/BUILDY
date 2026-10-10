/* Arranque del servidor. Sin dependencias (solo Node >= 18).
   ADMIN_PASSWORD=... node server/server.js     (PORT, STORAGE_DIR, STORAGE, SECURE_COOKIES, TRUST_PROXY, ACCESS_LOG opcionales) */
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import {loadConfig,ROOT} from './config.js';
import {createStore} from './storage/index.js';
import {createApp} from './app.js';
import {hashPassword} from './auth.js';
import {setAliases} from '../js/blocks/bedrock.js';

export async function startServer(opts={}){
  const config=loadConfig(opts);config.trustProxy=process.env.TRUST_PROXY=='1';
  setAliases(JSON.parse(fs.readFileSync(path.join(ROOT,'data/aliases.json'),'utf8')));
  const store=await createStore(config);
  if(await store.countUsersByRole('admin')==0){
    const pw=config.adminPassword||crypto.randomBytes(9).toString('base64url');
    await store.createUser({id:store.id(),name:'admin',role:'admin',sv:1,created:Date.now(),...await hashPassword(pw)});
    config.log(`Cuenta admin creada: usuario "admin"${config.adminPassword?'':' · contraseña: '+pw+'  (guárdala, no se vuelve a mostrar)'}`);
  }
  const purge=()=>store.purgeDrafts(Date.now()-config.limits.draftTtlMs).catch(e=>config.log('purge',e));
  await purge();const timer=setInterval(purge,3600e3);timer.unref();
  const {handle,app}=createApp({store,config});
  const server=http.createServer(handle);
  server.requestTimeout=120e3;server.headersTimeout=20e3;
  await new Promise(ok=>server.listen(config.port,ok));
  const port=server.address().port;config.log(`Catálogo en http://localhost:${port}  (almacenamiento: ${config.storage})`);
  const close=async()=>{clearInterval(timer);await new Promise(r=>server.close(r));await store.close()};
  return {server,store,port,app,close};
}
if(process.argv[1]&&path.resolve(process.argv[1])==fileURLToPath(import.meta.url)){
  const s=await startServer();
  for(const sig of ['SIGTERM','SIGINT'])process.on(sig,async()=>{console.log('Cerrando…');await s.close();process.exit(0)});
}
