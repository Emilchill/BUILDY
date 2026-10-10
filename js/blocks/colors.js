/* Colores de respaldo (sin texturas) y tintes de bioma. Sin dependencias. */
export const C={rail:0x8a7a6a,rail_corner:0x8a7a6a,powered_rail:0xb8a038,powered_rail_on:0xe0c040,detector_rail:0x8a4a4a,detector_rail_on:0xb05a5a,activator_rail:0x9a3a3a,activator_rail_on:0xc04a4a,piston_side:0x9a7a4a,piston_top:0xb09a5a,piston_top_sticky:0x6aa84f,piston_inner:0x5a4a2a,piston_bottom:0x8a8a8a,iron_block:0xdcdcdc,ender_chest:0x1a3a3a,trapped_chest:0x8a3a22,lever:0x7a5a34,hopper_outside:0x4a4a4a,hopper_inside:0x2a2a2a,repeater:0x9a9a9a,repeater_on:0xb09a9a,comparator:0x9a9a9a,comparator_on:0xb09a9a,redstone_torch:0xd02020,redstone_torch_off:0x5a1a1a,observer:0x6a6a6a,dispenser:0x7a7a7a,dropper:0x7a7a7a,piston:0x9a7a4a,sticky_piston:0x9a8a4a,barrel:0x7a5a34,hopper:0x4a4a4a,redstone_lamp:0x7a4a2a,redstone_wire:0xaa0000,stone:0x7d7d7d,cobblestone:0x7a7a7a,dirt:0x866043,grass_block:0x5d9e3a,sand:0xdddba0,gravel:0x857f7e,glass:0xa8d4e6,glass_pane:0xa8d4e6,water:0x3355ff,lava:0xe8641a,bricks:0x96584b,stone_bricks:0x777777,obsidian:0x15101f,bedrock:0x333333,iron_block:0xdcdcdc,gold_block:0xf6d03c,diamond_block:0x5decf5,emerald_block:0x2fc65a,lapis_block:0x2a4fa8,redstone_block:0xb01010,coal_block:0x151515,netherrack:0x6f3535,glowstone:0xffcf70,sea_lantern:0xcfe8e0,sandstone:0xd8cb8b,snow_block:0xf4fbfb,snow:0xf4fbfb,ice:0x9dc4f5,crafting_table:0x9a6b3a,furnace:0x888888,torch:0xffd24a,lantern:0xe0a030,grass:0x6aa84f,short_grass:0x6aa84f,tall_grass:0x6aa84f,bookshelf:0x7a5a34,hay_block:0xc9a227,pumpkin:0xd9801a,tnt:0xd23c2a,andesite:0x888888,diorite:0xc8c8c8,granite:0x9a6a5a,clay:0xa0a6b4,podzol:0x5a4326,mud:0x3d352f,quartz_block:0xe8e4dc,smooth_stone:0x9a9a9a,end_stone:0xdbdea0,copper_block:0xc0704a,prismarine:0x5a9a8a,chest:0x9a6a22,ladder:0x8a6a3a,iron_bars:0x8a8f93,deepslate:0x4a4a50,cobbled_deepslate:0x4a4a50,mossy_cobblestone:0x5f7a5a,magma_block:0xa03a10};
export const DYE={white:0xf0f0f0,orange:0xf07613,magenta:0xbd44b3,light_blue:0x3aafd9,yellow:0xf8c527,lime:0x70b919,pink:0xed8dac,gray:0x3e4447,light_gray:0x8e8e86,cyan:0x158991,purple:0x792aac,blue:0x35399d,brown:0x724728,green:0x546d1b,red:0xa12722,black:0x141519};
export const WOOD={oak:[0xb8945f,0x6b5430],spruce:[0x7a5a34,0x3b2a17],birch:[0xc8b77a,0xd8d5c9],jungle:[0xb88764,0x554419],acacia:[0xa95d32,0x676157],dark_oak:[0x4a2f16,0x3c2e18],mangrove:[0x764036,0x5b3b2e],cherry:[0xe2b2ac,0x3b2128]};

const hex2=h=>[(h>>16&255)/255,(h>>8&255)/255,(h&255)/255];
const toHex=c=>c.map(v=>Math.round(Math.min(1,Math.max(0,v))*255).toString(16).padStart(2,'0')).join('');
function hsl(h,s,l){const a=s*Math.min(l,1-l),f=n=>{const k=(n+h*12)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1))};return [f(0),f(8),f(4)]}
const cc={};
export function colorOf(n){
  if(cc[n])return cc[n];let hex=null,adj=null;const m=n.replace(/^stripped_/,'');
  if(C[n]!=null)hex=C[n];
  else{
    const d=Object.keys(DYE).sort((a,b)=>b.length-a.length).find(k=>n.startsWith(k+'_'));
    if(d){hex=DYE[d];if(/terracotta/.test(n))adj=c=>c.map(v=>v*.75);if(/glass/.test(n))adj=c=>c.map(v=>v+(1-v)*.45)}
    else{
      const w=Object.keys(WOOD).sort((a,b)=>b.length-a.length).find(k=>m.startsWith(k+'_'));
      if(w){hex=/leaves/.test(m)?0x3f7a22:/(log|wood|stem)$/.test(m)?WOOD[w][1]:WOOD[w][0]}
      else if(/leaves/.test(n))hex=0x3f7a22;
      else if(/deepslate/.test(n))hex=0x4a4a50;
      else if(/brick/.test(n))hex=0x96584b;
      else if(/sand/.test(n))hex=0xd8cb8b;
      else if(/glass/.test(n))hex=0xa8d4e6;
      else if(/stone|ore|slate/.test(n))hex=0x7d7d7d;
    }
  }
  let c;
  if(hex!=null)c=hex2(hex);else{let h=0;for(const ch of n)h=(h*31+ch.charCodeAt(0))|0;c=hsl((Math.abs(h)%360)/360,.45,.5)}
  if(adj)c=adj(c);
  return cc[n]=[c[0],c[1],c[2],toHex(c)];
}
/* Tinte de bioma (pasto, hojas, agua...) o null */
export function tintRGB(n){
  if(n=='grass_block'||/^(short_|tall_)?grass$|^(large_)?fern$|^sugar_cane$/.test(n))return hex2(0x79c05a);
  if(/leaves/.test(n)&&!/cherry|azalea/.test(n))return hex2(/spruce/.test(n)?0x619961:/birch/.test(n)?0x80a755:0x59ae30);
  if(n=='water')return hex2(0x3f76e4);
  if(/^(vine|lily_pad)$/.test(n))return hex2(0x59ae30);
  return null;
}
