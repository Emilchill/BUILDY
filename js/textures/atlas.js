/* Atlas de texturas (rejilla de 16x16 px) común a todos los orígenes. El índice 0 es ruido neutro para colores lisos. */
export const TILE=16;
export function makeNoise(){
  const c=document.createElement('canvas');c.width=c.height=TILE;
  const g=c.getContext('2d'),im=g.createImageData(TILE,TILE);
  for(let i=0;i<TILE*TILE;i++){const v=225+Math.floor(Math.random()*30);im.data.set([v,v,v,255],i*4)}
  g.putImageData(im,0,0);return c;
}
/* entries: [[nombre, ()=>Promise<Blob>]] */
export async function buildAtlas(entries){
  const N=entries.length+1,cols=Math.ceil(Math.sqrt(N)),rows=Math.ceil(N/cols);
  const canvas=document.createElement('canvas');canvas.width=cols*TILE;canvas.height=rows*TILE;
  const g=canvas.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(makeNoise(),0,0);
  const names=new Map();
  await Promise.all(entries.map(async([n,get],i)=>{
    try{const bm=await createImageBitmap(await get()),sz=Math.min(bm.width,bm.height),t=i+1;
      g.drawImage(bm,0,0,sz,sz,(t%cols)*TILE,Math.floor(t/cols)*TILE,TILE,TILE);names.set(n,t)}catch(e){}
  }));
  return {canvas,cols,rows,names};
}
export async function atlasToRecord(a){const blob=await new Promise(r=>a.canvas.toBlob(r));return {blob,cols:a.cols,rows:a.rows,names:[...a.names]}}
export async function recordToAtlas(r){
  const bm=await createImageBitmap(r.blob),canvas=document.createElement('canvas');canvas.width=bm.width;canvas.height=bm.height;
  canvas.getContext('2d').drawImage(bm,0,0);return {canvas,cols:r.cols,rows:r.rows,names:new Map(r.names)};
}
/* Base de las fuentes de texturas */
export class TexSource{
  constructor(a){this.canvas=a.canvas;this.cols=a.cols;this.rows=a.rows;this.names=a.names;this.cache={}}
  t(name){const i=this.names.get(name);return i==null?-1:i}
  drawTile(ctx,i,size){const c=i%this.cols,r=Math.floor(i/this.cols);ctx.imageSmoothingEnabled=false;ctx.drawImage(this.canvas,c*TILE,r*TILE,TILE,TILE,0,0,size,size)}
  nameOf(){return null}
}
