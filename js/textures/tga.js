/* Decodificador TGA mínimo (24/32 bits, sin comprimir o RLE). Bedrock guarda en TGA varias texturas de color. */
export function decodeTGA(u8){
  const idLen=u8[0],cm=u8[1],type=u8[2],w=u8[12]|u8[13]<<8,h=u8[14]|u8[15]<<8,bpp=u8[16],desc=u8[17];
  if(cm||(type!=2&&type!=10)||(bpp!=32&&bpp!=24))throw new Error('TGA no soportado');
  const by=bpp>>3,lin=new Uint8ClampedArray(w*h*4);let p=18+idLen,i=0;
  const px=(q)=>{lin[i++]=u8[q+2];lin[i++]=u8[q+1];lin[i++]=u8[q];lin[i++]=by==4?u8[q+3]:255};
  if(type==2){for(let n=0;n<w*h;n++,p+=by)px(p)}
  else while(i<w*h*4){
    const hd=u8[p++],cnt=(hd&127)+1;
    if(hd&128){const q=p;p+=by;for(let n=0;n<cnt;n++)px(q)}else for(let n=0;n<cnt;n++,p+=by)px(p);
  }
  if(desc&0x20)return {w,h,data:lin};            // origen arriba: ya está en orden
  const out=new Uint8ClampedArray(lin.length);    // origen abajo: voltear filas
  for(let y=0;y<h;y++)out.set(lin.subarray((h-1-y)*w*4,(h-y)*w*4),y*w*4);
  return {w,h,data:out};
}
