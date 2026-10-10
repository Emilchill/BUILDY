/* Miniatura de un bloque (cara superior de su textura o su color). */
import {colorOf,tintRGB} from '../blocks/colors.js';
export function swatch(tex,id){
  const c=document.createElement('canvas');c.width=c.height=16;c.className='sw';c.title=id;
  const g=c.getContext&&c.getContext('2d');if(!g)return c;
  let i=-1;if(tex){const t=tex.tilesFor(id);i=t[1]>=0?t[1]:t[0]}
  if(i>=0){tex.drawTile(g,i,16);const tn=tintRGB(id);if(tn){g.globalCompositeOperation='multiply';g.fillStyle=`rgb(${tn.map(v=>Math.round(v*255))})`;g.fillRect(0,0,16,16)}}
  else{g.fillStyle='#'+colorOf(id)[3];g.fillRect(0,0,16,16)}
  return c;
}
