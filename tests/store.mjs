/* node tests/store.mjs : ejecuta el contrato contra FileStore */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {FileStore} from '../server/storage/file-store.js';
import {runContract} from './store-contract.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mcv-store-'));
await runContract('FileStore',{open:()=>FileStore.open(dir),reopen:()=>FileStore.open(dir)});
fs.rmSync(dir,{recursive:true,force:true});

/* mismo contrato contra el almacén del navegador (modo local) con persistencia en memoria */
import {LocalStore,memoryBackend} from '../js/app/local/store.js';
{const be=memoryBackend();await runContract('LocalStore (navegador)',{open:()=>LocalStore.open(be),reopen:()=>LocalStore.open(be)})}
