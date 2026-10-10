/* Cuentas: registro, login, logout, sesión. */
import {hashPassword,verifyPassword,makeToken} from '../auth.js';
import {httpError as E,StoreError} from '../errors.js';
import {CATEGORIES,PLATFORMS,SIZES} from '../../js/catalog.js';

export function authRoutes(r,app){
  const {store,limit}=app;
  const setSession=(c,u)=>c.res.setHeader('Set-Cookie',`sid=${u?makeToken(store.secret(),u.id,u.sv):''}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${u?14*86400:0}${app.secure(c.req)?'; Secure':''}`);

  r.get('/api/session',c=>c.json(200,{user:app.pub(c.user),categories:CATEGORIES,sizes:SIZES,platforms:PLATFORMS}));
  r.post('/api/register',async c=>{
    if(!limit.reg(c.ip))throw E(429,'Demasiados registros, intenta más tarde');
    const b=await c.body();
    if(!/^[A-Za-z0-9_.-]{3,24}$/.test(b.name||''))throw E(400,'Usuario: 3-24 caracteres (letras, números, _ . -)');
    if(typeof b.password!='string'||b.password.length<8||b.password.length>72)throw E(400,'La contraseña debe tener entre 8 y 72 caracteres');
    const u={id:store.id(),name:b.name,role:'user',sv:1,created:Date.now(),...await hashPassword(b.password)};
    try{await store.createUser(u)}catch(e){if(e instanceof StoreError&&e.code=='EXISTS')throw E(409,'Ese usuario ya existe');throw e}
    setSession(c,u);return c.json(200,{user:app.pub(u)});
  });
  r.post('/api/login',async c=>{
    const b=await c.body(),name=String(b.name||'').toLowerCase();
    if(!limit.login(c.ip)||!limit.loginName(name))throw E(429,'Demasiados intentos, espera unos minutos');
    const u=await store.getUserByName(name);
    if(!u||typeof b.password!='string'||b.password.length>72||!(await verifyPassword(b.password,u)))throw E(401,'Usuario o contraseña incorrectos');
    setSession(c,u);return c.json(200,{user:app.pub(u)});
  });
  r.post('/api/logout',c=>{setSession(c,null);return c.json(200,{ok:true})});
}
