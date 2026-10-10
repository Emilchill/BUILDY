/* Fuente de texturas: resource pack de Java (assets/minecraft/textures/block/*.png) o el .jar del juego. */
import {TexSource} from './atlas.js';
import {faceTiles} from '../blocks/orientation.js';
export const isJavaPack=zip=>Object.keys(zip.files).some(p=>/assets\/minecraft\/textures\/block\/[^/]+\.png$/.test(p));
export function javaEntries(zip){
  const out=[];zip.forEach((p,e)=>{const m=p.match(/textures\/blocks?\/([a-z0-9_]+)\.png$/);if(m&&!e.dir)out.push([m[1],()=>e.async('blob')])});
  const seen=new Set();return out.filter(([n])=>!seen.has(n)&&seen.add(n));
}
export class JavaSource extends TexSource{
  get kind(){return 'java'}
  tilesFor(n,h){
    const key=n+'/'+(h||'');if(this.cache[key])return this.cache[key];
    n=n.replace(/^(.*)wall_torch$/,'$1torch').replace(/^(.*)_wood$/,'$1_log').replace(/^(.*)_hyphae$/,'$1_stem');
    const hs=h=='upper'?'_top':h=='lower'?'_bottom':null;
    if(hs&&this.names.has(n+hs)){const i=this.t(n+hs);return this.cache[key]=[i,i,i]}
    const A={water:'water_still',lava:'lava_still',flowing_water:'water_still',flowing_lava:'lava_still',snow_block:'snow',grass:'short_grass'};
    const bases=[A[n]||n],b=n.replace(/_(stairs|slab|wall|fence_gate|fence|button|pressure_plate|trapdoor|door|carpet|pane)$/,'');
    if(b!==n)bases.push(b,b+'s',b+'_planks',b+'_block',b+'_wool');
    const find=sf=>{for(const bs of bases)for(const x of sf){const i=this.t(bs+x);if(i>=0)return i}return -1};
    let side=find(['_side','_front','']),top=find(['_top','_end','']),bot=find(['_bottom','_top','']);
    if(/^(grass_block|podzol|mycelium)$/.test(n))bot=this.t('dirt');
    if(side<0)side=top;if(top<0)top=side;if(bot<0)bot=top;
    return this.cache[key]=[side,top,bot];
  }
  faceTiles(n,p){return faceTiles(n,p,'java',k=>this.t(k),m=>this.tilesFor(m))}
}
