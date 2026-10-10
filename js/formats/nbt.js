/* Lector NBT (Java: big-endian, Bedrock: little-endian) y descompresión gzip/zlib. */
export function parseNBT(u8,le){
  const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength),td=new TextDecoder();let p=0;
  const str=()=>{const l=dv.getUint16(p,le);p+=2;const s=td.decode(u8.subarray(p,p+l));p+=l;return s};
  function rd(t){switch(t){
    case 1:return dv.getInt8(p++);
    case 2:{const v=dv.getInt16(p,le);p+=2;return v}
    case 3:{const v=dv.getInt32(p,le);p+=4;return v}
    case 4:{const v=Number(dv.getBigInt64(p,le));p+=8;return v}
    case 5:{const v=dv.getFloat32(p,le);p+=4;return v}
    case 6:{const v=dv.getFloat64(p,le);p+=8;return v}
    case 7:{const n=dv.getInt32(p,le);p+=4;const a=u8.subarray(p,p+n);p+=n;return a}
    case 8:return str();
    case 9:{const it=dv.getUint8(p++),n=dv.getInt32(p,le);p+=4;const a=new Array(n);for(let i=0;i<n;i++)a[i]=rd(it);return a}
    case 10:{const o={};for(;;){const tt=dv.getUint8(p++);if(!tt)break;const k=str();o[k]=rd(tt)}return o}
    case 11:{const n=dv.getInt32(p,le);p+=4;const a=new Int32Array(n);for(let i=0;i<n;i++){a[i]=dv.getInt32(p,le);p+=4}return a}
    case 12:{const n=dv.getInt32(p,le);p+=4;const w=new Uint32Array(n*2);for(let i=0;i<n;i++){w[2*i+1]=dv.getUint32(p+(le?4:0),le);w[2*i]=dv.getUint32(p+(le?0:4),le);p+=8}return w}
    default:throw new Error('Etiqueta NBT desconocida: '+t+' en el byte '+p)}}
  const t=dv.getUint8(p++);str();return rd(t);
}
export async function inflate(buf){
  const u8=new Uint8Array(buf);
  const fmt=(u8[0]===0x1f&&u8[1]===0x8b)?'gzip':(u8[0]===0x78?'deflate':null);
  if(!fmt)return u8;
  const ds=new DecompressionStream(fmt);
  return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer());
}
