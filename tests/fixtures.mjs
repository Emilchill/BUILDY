/* Datos de prueba: escritor mínimo de NBT little-endian (Bedrock). */
const S=s=>{const b=Buffer.from(s);const l=Buffer.alloc(2);l.writeUInt16LE(b.length);return Buffer.concat([l,b])};
const I=v=>{const b=Buffer.alloc(4);b.writeInt32LE(v);return b};
const tag=(ty,n,p)=>Buffer.concat([Buffer.from([ty]),S(n),p]);
const lst=(ty,a)=>Buffer.concat([Buffer.from([ty]),I(a.length),...a]);
const comp=(...k)=>Buffer.concat([...k,Buffer.from([0])]);
export function mcstructure(){
  const X=3,Y=2,Z=3,idx=new Array(X*Y*Z).fill(-1),put=(x,y,z,v)=>idx[(x*Y+y)*Z+z]=v;
  for(let x=0;x<X;x++)for(let z=0;z<Z;z++)put(x,0,z,0);put(1,1,1,1);put(0,1,0,2);put(2,1,2,3);
  const ent=(n,st)=>comp(tag(8,'name',S(n)),tag(10,'states',comp(...Object.entries(st).map(([k,v])=>typeof v=='number'?tag(3,k,I(v)):tag(8,k,S(v))))),tag(3,'version',I(1)));
  const pal=[['minecraft:grass',{}],['minecraft:planks',{wood_type:'spruce'}],['minecraft:wool',{color:'silver'}],['minecraft:reeds',{}]];
  return Buffer.concat([Buffer.from([10]),S(''),comp(tag(3,'format_version',I(1)),tag(9,'size',lst(3,[I(X),I(Y),I(Z)])),
    tag(10,'structure',comp(tag(9,'block_indices',lst(9,[lst(3,idx.map(I)),lst(3,idx.map(()=>I(-1)))])),tag(9,'entities',lst(0,[])),
    tag(10,'palette',comp(tag(10,'default',comp(tag(9,'block_palette',lst(10,pal.map(([n,s])=>ent(n,s)))),tag(10,'block_position_data',comp()))))))))]);
}
/* PNG mínimo válido de 1x1 */
export const PNG1=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');

/* .nbt de Java (big-endian, sin comprimir): 2x1x2 con 3 de piedra y 1 de tablones de roble */
const bS=s=>{const b=Buffer.from(s);const l=Buffer.alloc(2);l.writeUInt16BE(b.length);return Buffer.concat([l,b])};
const bI=v=>{const b=Buffer.alloc(4);b.writeInt32BE(v);return b};
const btag=(ty,n,p)=>Buffer.concat([Buffer.from([ty]),bS(n),p]);
const blst=(ty,a)=>Buffer.concat([Buffer.from([ty]),bI(a.length),...a]);
const bcomp=(...k)=>Buffer.concat([...k,Buffer.from([0])]);
export function javaNbt(){
  const blk=(x,y,z,s)=>bcomp(btag(9,'pos',blst(3,[bI(x),bI(y),bI(z)])),btag(3,'state',bI(s)));
  return Buffer.concat([Buffer.from([10]),bS(''),bcomp(btag(9,'size',blst(3,[bI(2),bI(1),bI(2)])),
    btag(9,'palette',blst(10,[bcomp(btag(8,'Name',bS('minecraft:stone'))),bcomp(btag(8,'Name',bS('minecraft:oak_planks')))])),
    btag(9,'blocks',blst(10,[blk(0,0,0,0),blk(1,0,0,0),blk(0,0,1,0),blk(1,0,1,1)])))]);
}
/* "JPEG" mínimo (solo la firma, suficiente para el sniffing) */
export const JPG1=Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe0]),Buffer.alloc(32,1)]);
