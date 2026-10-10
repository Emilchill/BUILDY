/* Construye la geometría (posiciones, colores, UV, índices) a partir de un modelo. Sin dependencias de three.js. */
import {colorOf,tintRGB} from '../blocks/colors.js';
import {shapeOf,needsNb} from '../blocks/shapes.js';
import {rotp} from './math.js';

const FACES=[
 {d:[1,0,0],v:[[1,0,1],[1,0,0],[1,1,0],[1,1,1]],s:.8},{d:[-1,0,0],v:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]],s:.8},
 {d:[0,1,0],v:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]],s:1},{d:[0,-1,0],v:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],s:.5},
 {d:[0,0,1],v:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]],s:.9},{d:[0,0,-1],v:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]],s:.9}];
const UV=[[0,0],[1,0],[1,1],[0,1]];

const FULL=[0,0,0,16,16,16],UVQ=[[0,0],[1,0],[1,1],[0,1]];

/* tex: fuente de texturas (tilesFor/faceTiles/cols/rows) o null para colores lisos. */
export function buildGeometry(M,{hidden=new Set(),maxY=M.H-1,tex=null}={}){
  const {W,H,L,grid,names,states}=M,pos=[],col=[],uv=[],idx=[];
  const cols=names.map(colorOf),tint=names.map(tintRGB),bs=states.map(q=>q.b);
  if(!M.shp)M.shp=states.map(q=>shapeOf(names[q.b],q.p));
  const shp=M.shp,needs=states.map(q=>needsNb(names[q.b],q.p)),nbo=[];
  const kind=states.map((q,i)=>shp[i]?2:/glass|leaves|ice$|^water$|^lava$/.test(names[q.b])?1:0);
  const nb=(x,y,z)=>{if(x<0||y<0||z<0||x>=W||y>=H||z>=L)return null;const v=grid[(y*L+z)*W+x];if(!v)return null;return nbo[v-1]||(nbo[v-1]={n:names[bs[v-1]],p:states[v-1].p,k:kind[v-1]})};
  const hid=new Uint8Array(names.length);hidden.forEach(i=>hid[i]=1);
  const tsc=[],ftc=[];
  const nm=s=>{const n=names[bs[s]],p=states[s].p;return /^redstone(_wall)?_torch$/.test(n)&&p.lit=='false'?'redstone_torch_off':n=='redstone_lamp'&&p.lit=='true'?'redstone_lamp_on':n};
  const TS=s=>tsc[s]||(tsc[s]=tex.tilesFor(nm(s),states[s].p.half)),FT=s=>ftc[s]!==undefined?ftc[s]:(ftc[s]=tex.faceTiles(names[bs[s]],states[s].p));
  const ncols=tex?tex.cols:1,nrows=tex?tex.rows:1,cw=1/ncols,rh=1/nrows,e=.002;let n=0;
  const vis=(x,y,z,s)=>{if(x<0||y<0||z<0||x>=W||y>maxY||z>=L)return false;const v=grid[(y*L+z)*W+x];if(!v||hid[bs[v-1]])return false;const k=kind[v-1];return k==0||(k==1&&bs[v-1]==bs[s])};
  const style=(s,fi,j,flat,tx)=>{
    if(flat)return [0,flat[0],flat[1],flat[2]];
    if(tx){if(tex){const ti=tex.tilesFor(tx)[fi==2?1:fi==3?2:0];if(ti>=0)return [ti,1,1,1]}const c=colorOf(tx);return [0,c[0]*j,c[1]*j,c[2]*j]}
    const b=bs[s];
    if(tex){const ft=FT(s),ti=ft?ft[fi]:TS(s)[fi==2?1:fi==3?2:0];if(ti>=0){const tn=tint[b];return tn&&(names[b]!='grass_block'||fi==2)?[ti,tn[0],tn[1],tn[2]]:[ti,1,1,1]}}
    const c=cols[b];return [0,c[0]*j,c[1]*j,c[2]*j];
  };
  const quad=(P,U,t,r,g,b)=>{
    const c0=t%ncols,r0=Math.floor(t/ncols);
    for(let i=0;i<4;i++){pos.push(P[i][0],P[i][1],P[i][2]);col.push(r,g,b);uv.push((c0+e+(1-2*e)*U[i][0])*cw,1-(r0+e+(1-2*e)*(1-U[i][1]))*rh)}
    idx.push(n,n+1,n+2,n,n+2,n+3);n+=4;
  };
  const box=(bb,x,y,z,s,j,flat)=>{
    const [x0,y0,z0,x1,y1,z1]=bb,rot=bb.rot,tx=bb.tx,dy=bb.dy||0;
    for(let fi=0;fi<6;fi++){
      const f=FACES[fi];
      if(!rot&&((f.d[0]>0&&x1>=16)||(f.d[0]<0&&x0<=0)||(f.d[1]>0&&y1>=16)||(f.d[1]<0&&y0<=0)||(f.d[2]>0&&z1>=16)||(f.d[2]<0&&z0<=0))&&vis(x+f.d[0],y+f.d[1],z+f.d[2],s))continue;
      const [t,cr,cg,cb]=style(s,fi,j,flat,(bb.tf&&bb.tf[fi])||tx),k=f.s,P=[],U=[];
      for(const v of f.v){
        const px=v[0]?x1:x0,py=v[1]?y1:y0,pz=v[2]?z1:z0;
        let q=[px,py,pz];if(rot)for(const r of rot)q=rotp(q,r);
        P.push([x+q[0]/16,y+q[1]/16,z+q[2]/16]);const uy=(py+dy)/16;
        U.push(fi==0?[1-pz/16,uy]:fi==1?[pz/16,uy]:fi==2?[px/16,1-pz/16]:fi==3?[px/16,pz/16]:fi==4?[px/16,uy]:[1-px/16,uy]);
      }
      quad(P,U,t,cr*k,cg*k,cb*k);
    }
  };
  for(let y=0;y<=maxY&&y<H;y++)for(let z=0;z<L;z++)for(let x=0;x<W;x++){
    const v=grid[(y*L+z)*W+x];if(!v)continue;const s=v-1;if(hid[bs[s]])continue;
    const sh=needs[s]?shapeOf(names[bs[s]],states[s].p,(dx,dy,dz)=>nb(x+dx,y+dy,z+dz)):shp[s];
    const r=Math.sin(x*12.9898+y*78.233+z*37.719)*43758.5453,j=tex?1:.94+.12*(r-Math.floor(r));
    if(!sh)box(FULL,x,y,z,s,j);
    else if(sh.cross){
      const [t,cr,cg,cb]=style(s,0,1);
      quad([[x,y,z],[x+1,y,z+1],[x+1,y+1,z+1],[x,y+1,z]],UVQ,t,cr*.9,cg*.9,cb*.9);
      quad([[x+1,y,z],[x,y,z+1],[x,y+1,z+1],[x+1,y+1,z]],UVQ,t,cr*.9,cg*.9,cb*.9);
    }else if(sh.quads){
      for(const q of sh.quads){
        const [t,cr,cg,cb]=style(s,2,j,null,q.tx),P=q.P.map(pt=>{const r=rotp(pt,['y',q.ry||0,8,0,8]);return [x+r[0]/16,y+r[1]/16,z+r[2]/16]});
        quad(P,UVQ,t,cr*.95,cg*.95,cb*.95);
      }
    }else for(const bb of sh.boxes)box(bb,x,y,z,s,j,sh.flat);
  }
  return {pos:new Float32Array(pos),col:new Float32Array(col),uv:new Float32Array(uv),idx:n>65000?new Uint32Array(idx):new Uint16Array(idx),quads:n/4};
}
