/* Orientación de bloques con caras distintas (observador, dispensador, horno, pistón...) y ejes (troncos). */
const FD={east:0,west:1,up:2,down:3,south:4,north:5},OP=[1,0,3,2,5,4];
export const AXIS_RE=/(_log|_wood|_stem|_hyphae|bamboo_block|hay_block|basalt|bone_block|_pillar)$/;

/* Nombres de textura por rol (frente, atrás, lados, arriba, abajo) según el origen del pack. */
export function roles(n,p,kind){
  const bd=kind=='bedrock',fd=FD[p.facing],vert=fd==2||fd==3,on=p.lit=='true';
  if(n=='observer')return {fr:'observer_front',bk:p.powered=='true'?(bd?'observer_back_lit':'observer_back_on'):'observer_back',sd:'observer_side',tp:'observer_top',bt:'observer_top'};
  if(n=='dispenser'||n=='dropper')return {fr:n+(vert?'_front_vertical':bd?'_front_horizontal':'_front'),sd:'furnace_side',bk:vert?'furnace_top':'furnace_side',tp:'furnace_top',bt:'furnace_top'};
  if(/^(furnace|blast_furnace|smoker)$/.test(n))return {fr:n+(bd?(on?'_front_on':'_front_off'):(on?'_front_on':'_front')),sd:n+'_side',bk:n+'_side',tp:n+'_top',bt:n=='smoker'?'smoker_bottom':n+'_top'};
  if(n=='piston'||n=='sticky_piston')return {fr:n=='piston'?(bd?'piston_top_normal':'piston_top'):'piston_top_sticky',bk:'piston_bottom',sd:'piston_side',tp:'piston_side',bt:'piston_side'};
  if(n=='carved_pumpkin'||n=='jack_o_lantern')return {fr:bd?(n=='carved_pumpkin'?'pumpkin_face_off':'pumpkin_face_on'):n,sd:'pumpkin_side',bk:'pumpkin_side',tp:'pumpkin_top',bt:'pumpkin_top'};
  if(n=='barrel')return {fr:p.open=='true'?'barrel_top_open':'barrel_top',bk:'barrel_bottom',sd:'barrel_side',tp:'barrel_side',bt:'barrel_side'};
  return null;
}
/* Devuelve 6 índices de atlas [+X,-X,+Y,-Y,+Z,-Z] o null si el bloque usa la textura normal.
   get(nombre)->índice|-1, blockTiles(n)->[lado,arriba,abajo] */
export function faceTiles(n,p,kind,get,blockTiles){
  if(p.axis&&AXIS_RE.test(n)){
    const t=blockTiles(n),ax={x:0,y:2,z:4}[p.axis];
    return [0,1,2,3,4,5].map(i=>(i>>1)==(ax>>1)?t[1]:t[0]);
  }
  const fd=FD[p.facing];if(fd==null)return null;
  const r=roles(n,p,kind);if(!r)return null;
  const out=[];
  for(let i=0;i<6;i++){
    const k=i==fd?r.fr:i==OP[fd]?r.bk:i==2?r.tp:i==3?r.bt:r.sd;
    let t=get(k);if(t<0&&i==3)t=get(r.tp);if(t<0)return null;out.push(t);
  }
  return out;
}
