/* Fábrica de almacenamiento. Para pasar a base de datos: crea server/storage/postgres-store.js que cumpla el mismo
   contrato (ver docs/ESCALABILIDAD.md y tests/store-contract.mjs) y regístralo aquí. */
import {FileStore} from './file-store.js';
export async function createStore(config){
  switch(config.storage){
    case 'file':return FileStore.open(config.dir);
    default:throw new Error(`Almacenamiento "${config.storage}" no implementado. Disponibles: file. Ver docs/ESCALABILIDAD.md`);
  }
}
