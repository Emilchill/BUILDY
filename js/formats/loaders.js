/* Lectura de estructuras: .mcstructure (Bedrock), .nbt (Java), .schem (Sponge), .litematic. */
import {parseNBT,inflate} from './nbt.js';
import {Builder} from './model.js';
import {bedrockName} from '../blocks/bedrock.js';

export function load(root){
  const b=new Builder();
  if(root.Regions){ // Litematica
    for(const r of Object.values(root.Regions)){
      const s=r.Size,p=r.Position,sx=Math.abs(s.x),sy=Math.abs(s.y),sz=Math.abs(s.z);
      const ox=p.x+(s.x<0?s.x+1:0),oy=p.y+(s.y<0?s.y+1:0),oz=p.z+(s.z<0?s.z+1:0);
      const pal=r.BlockStatePalette.map(e=>b.id(e.Name,e.Properties)),bits=Math.max(2,Math.ceil(Math.log2(pal.length))),mask=(1<<bits)-1,w=r.BlockStates;
      for(let y=0;y<sy;y++)for(let z=0;z<sz;z++)for(let x=0;x<sx;x++){
        const pos=((y*sz+z)*sx+x)*bits,k=pos>>5,o=pos&31;
        let v=w[k]>>>o;if(o+bits>32)v|=w[k+1]<<(32-o);
        b.put(ox+x,oy+y,oz+z,pal[v&mask]);
      }
    }
  }else if(root.structure&&root.size){ // Bedrock .mcstructure
    const [X,Y,Z]=root.size,st=root.structure,ix=st.block_indices[0],pe=st.palette.default.block_palette;
    const pal=pe.map(e=>b.id(...bedrockName(e)));
    for(let x=0;x<X;x++)for(let y=0;y<Y;y++)for(let z=0;z<Z;z++){
      const v=ix[(x*Y+y)*Z+z];if(v>=0)b.put(x,y,z,pal[v]);
    }
  }else if(root.size&&root.blocks){ // estructura vanilla .nbt
    const pl=(root.palette||root.palettes[0]).map(e=>b.id(e.Name,e.Properties));
    for(const k of root.blocks)b.put(k.pos[0],k.pos[1],k.pos[2],pl[k.state]);
  }else{ // Sponge .schem v2 / v3
    const s=root.Schematic||root,W=s.Width,H=s.Height,L=s.Length,P=s.Blocks?s.Blocks.Palette:s.Palette,D=s.Blocks?s.Blocks.Data:s.BlockData;
    if(!P||!D||!W)throw new Error('Formato no reconocido (los .schematic antiguos no están soportados; conviértelo a .schem).');
    const pal=[];for(const [n,i] of Object.entries(P))pal[i]=b.id(n);
    let q=0;
    for(let i=0;i<W*H*L;i++){
      let v=0,sh=0,by;do{by=D[q++];v|=(by&127)<<sh;sh+=7}while(by&128);
      const y=Math.floor(i/(W*L)),r=i%(W*L);b.put(r%W,y,Math.floor(r/W),pal[v]);
    }
  }
  return b.finish();
}

/* bytes (posiblemente comprimidos) + nombre de archivo -> modelo */
export async function readStructure(buf,name=''){
  let u8=await inflate(buf);
  if(u8[0]!=10&&u8[4]==10)u8=u8.subarray(8);
  let m,first;
  for(const le of /\.mcstructure$/i.test(name)?[true,false]:[false,true]){
    try{m=load(parseNBT(u8,le));break}catch(err){first=first||err}
  }
  if(!m){const hex=[...u8.subarray(0,12)].map(b=>b.toString(16).padStart(2,'0')).join(' ');throw new Error(first.message+' (primeros bytes: '+hex+')')}
  return m;
}

export function demo(){
  const b=new Builder(),P=(x,y,z,n)=>b.put(x,y,z,b.id(n));
  for(let x=0;x<13;x++)for(let z=0;z<11;z++)P(x,0,z,'grass_block');
  for(let x=0;x<=10;x++)for(let z=0;z<=8;z++)for(let y=1;y<=4;y++){
    const X=x+1,Z=z+1,e=x==0||x==10||z==0||z==8;
    if(y==1){P(X,y,Z,'cobblestone');continue}
    if(!e)continue;
    if((x==0||x==10)&&(z==0||z==8))P(X,y,Z,'oak_log');
    else if(z==0&&x==5&&y<=3){if(y==2)P(X,y,Z,'oak_door[facing=south,half=lower,hinge=left,open=false]');if(y==3)P(X,y,Z,'oak_door[facing=south,half=upper,hinge=left,open=false]')}
    else if(y==3&&(((z==0||z==8)&&x%3==2)||((x==0||x==10)&&z==4)))P(X,y,Z,'glass_pane[north=true,south=true,east=true,west=true]');
    else P(X,y,Z,'oak_planks');
  }
  for(let k=0;k<5;k++)for(let x=k;x<=10-k;x++)for(let z=k;z<=8-k;z++)P(x+1,5+k,z+1,'spruce_planks');
  for(let y=5;y<=9;y++)P(9,y,3,'bricks');
  P(5,1,0,'torch');P(7,1,0,'torch');P(6,1,0,'oak_stairs[facing=north,half=bottom,shape=straight]');
  P(2,1,0,'oak_fence');P(3,1,0,'oak_fence');P(4,1,0,'oak_fence');
  P(10,1,0,'poppy');P(11,1,0,'dandelion');P(12,1,1,'short_grass');P(1,1,0,'oak_slab[type=bottom]');
  for(let z=3;z<=5;z++)P(4,2,z,'redstone_wire[power='+(18-z*2-3)+']');
  P(4,2,2,'redstone_torch');P(4,2,6,'redstone_lamp');P(10,2,8,'chest');P(2,2,8,'oak_stairs[facing=east,half=bottom,shape=straight]');
  P(3,2,8,'oak_slab[type=top]');
  P(6,2,3,'lever[face=floor,facing=north,powered=false]');P(8,3,2,'lever[face=wall,facing=south,powered=true]');
  P(6,2,6,'hopper[facing=down]');P(7,2,4,'observer[facing=north,powered=false]');P(8,2,6,'dispenser[facing=west]');
  P(8,2,4,'piston[facing=up,extended=false]');P(5,2,4,'repeater[facing=east,delay=3,powered=true,locked=false]');
  for(let z=2;z<=7;z++)P(12,1,z,z==5?'powered_rail[powered=true,shape=north_south]':'rail[shape=north_south]');
  P(12,1,1,'rail[shape=south_east]');P(13,1,1,'rail[shape=east_west]');P(12,1,8,'rail[shape=ascending_south]');P(12,1,9,'cobblestone');P(12,2,9,'rail[shape=north_south]');
  P(10,2,3,'oak_log[axis=x]');P(10,2,4,'oak_log[axis=z]');P(10,2,5,'oak_log[axis=y]');
  return b.finish();
}
