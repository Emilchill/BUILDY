/* Modelo en memoria: rejilla de estados de bloque + paleta. */
export class Builder{
  constructor(){this.names=[];this.map=new Map();this.states=[];this.smap=new Map();this.xs=[];this.ys=[];this.zs=[];this.ids=[]}
  id(raw,props){
    const m=raw.match(/^([^\[]+)(?:\[(.*)\])?$/),n=m[1].replace(/^minecraft:/,'');
    if(/^(air|cave_air|void_air|structure_void)$/.test(n))return -1;
    if(m[2]){props={};for(const kv of m[2].split(',')){const i=kv.indexOf('=');props[kv.slice(0,i)]=kv.slice(i+1)}}
    props=props||{};
    const key=n+JSON.stringify(props);let st=this.smap.get(key);
    if(st==null){let bi=this.map.get(n);if(bi==null){bi=this.names.length;this.names.push(n);this.map.set(n,bi)}
      st=this.states.length;this.states.push({b:bi,p:props});this.smap.set(key,st)}
    return st;
  }
  put(x,y,z,i){if(i<0)return;this.xs.push(x);this.ys.push(y);this.zs.push(z);this.ids.push(i)}
  finish(){
    const {xs,ys,zs,ids}=this,N=xs.length;if(!N)throw new Error('La estructura no contiene bloques.');
    let a=[1e9,1e9,1e9],b=[-1e9,-1e9,-1e9];
    for(let i=0;i<N;i++){a[0]=Math.min(a[0],xs[i]);a[1]=Math.min(a[1],ys[i]);a[2]=Math.min(a[2],zs[i]);b[0]=Math.max(b[0],xs[i]);b[1]=Math.max(b[1],ys[i]);b[2]=Math.max(b[2],zs[i])}
    const W=b[0]-a[0]+1,H=b[1]-a[1]+1,L=b[2]-a[2]+1;
    if(W*H*L>Builder.maxCells)throw new Error('Estructura demasiado grande para mostrar.');
    const grid=new Uint16Array(W*H*L);
    for(let i=0;i<N;i++)grid[((ys[i]-a[1])*L+(zs[i]-a[2]))*W+(xs[i]-a[0])]=ids[i]+1;
    const counts=new Array(this.names.length).fill(0);let total=0;
    for(let i=0;i<grid.length;i++)if(grid[i]){counts[this.states[grid[i]-1].b]++;total++}
    return {W,H,L,grid,names:this.names,counts,total,states:this.states};
  }
}
Builder.maxCells=2.5e8; // el servidor lo reduce para proteger la memoria
