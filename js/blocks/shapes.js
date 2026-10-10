/* Formas no cúbicas (medidas en 1/16 de bloque) y lógica de conexión. Sin dependencias. */
export const shapeOpts={levInv:false,levFlip:false};
export const DIR={north:[0,-1],south:[0,1],east:[1,0],west:[-1,0]};
const CROSS=/^(short_grass|grass|tall_grass|fern|large_fern|dead_bush|seagrass|tall_seagrass|dandelion|poppy|blue_orchid|allium|azure_bluet|[a-z]+_tulip|oxeye_daisy|cornflower|lily_of_the_valley|wither_rose|torchflower|sunflower|lilac|rose_bush|peony|sweet_berry_bush|sugar_cane|brown_mushroom|red_mushroom|crimson_roots|warped_roots|hanging_roots|[a-z_]+_sapling|bush)$/;
/* Lógica de conexión de Minecraft cuando el archivo no guarda las conexiones (p. ej. Bedrock) */
const dd=o=>DIR[o.p.facing]||[0,-1];
export const needsNb=(n,p)=>(p.north===undefined&&(/_fence$|^iron_bars$|_pane$|[a-z]_wall$|^redstone_wire$/.test(n)))||(/_stairs$/.test(n)&&p.shape===undefined);
function conn(kind,n,o,d){
  if(!o)return false;const g=o.n;
  const full=o.k==0&&!/pumpkin|melon|barrier|shulker|^(tnt|cake)$/.test(g),gateOk=(dd(o)[1]!=0)==(d[0]!=0);
  if(kind=='fence'){
    if(/_fence$/.test(g))return /nether_brick/.test(g)==/nether_brick/.test(n);
    return /_fence_gate$/.test(g)?gateOk:full;
  }
  if(/[a-z]_wall$|_pane$|^iron_bars$/.test(g))return true;
  if(/_fence_gate$/.test(g))return kind=='wall'&&gateOk;
  if(kind=='pane'&&o.k==1&&/glass/.test(g))return true;
  return full;
}
function wireTo(o,d){
  const g=o.n;
  if(g=='redstone_wire'||g=='redstone_block'||g=='lever'||/_button$|_pressure_plate$|^target$|^daylight_detector$|^redstone_(wall_)?torch$/.test(g))return true;
  return /^(repeater|comparator|observer)$/.test(g)&&(dd(o)[0]!=0)==(d[0]!=0);
}
export function withNb(n,p,N){
  const q={...p},DS=[['north',[0,-1]],['south',[0,1]],['east',[1,0]],['west',[-1,0]]];
  if(/_stairs$/.test(n)){
    const fc=p.facing||'north',f=DIR[fc],ccw=[f[1],-f[0]],hf=p.half||'bottom';
    const same=o=>o&&/_stairs$/.test(o.n)&&(o.p.half||'bottom')==hf,ax=v=>v[0]!=0,eq=(a,b)=>a[0]==b[0]&&a[1]==b[1];
    const free=d=>{const o=N(d[0],0,d[1]);return !(same(o)&&(o.p.facing||'north')==fc)};
    let sh='straight';const o1=N(f[0],0,f[1]);
    if(same(o1)){const d2=DIR[o1.p.facing||'north'];if(ax(d2)!=ax(f)&&free([-d2[0],-d2[1]]))sh=eq(d2,ccw)?'outer_left':'outer_right'}
    if(sh=='straight'){const o2=N(-f[0],0,-f[1]);if(same(o2)){const d3=DIR[o2.p.facing||'north'];if(ax(d3)!=ax(f)&&free(d3))sh=eq(d3,ccw)?'inner_left':'inner_right'}}
    q.shape=sh;return q;
  }
  if(n=='redstone_wire'){
    const above=N(0,1,0);
    for(const [k,d] of DS){
      const o=N(d[0],0,d[1]),up=N(d[0],1,d[1]),dn=N(d[0],-1,d[1]);let v='none';
      if(o&&wireTo(o,d))v='side';
      else if(o&&o.k==0&&up&&up.n=='redstone_wire'&&!(above&&above.k==0))v='up';
      else if((!o||o.k!=0)&&dn&&dn.n=='redstone_wire')v='side';
      q[k]=v;
    }
    return q;
  }
  const kind=/_fence$/.test(n)?'fence':/_wall$/.test(n)?'wall':'pane';
  for(const [k,d] of DS){const c=conn(kind,n,N(d[0],0,d[1]),d);q[k]=kind=='wall'?(c?'low':'none'):String(c)}
  if(kind=='wall'){
    const a=q.north!='none',b=q.south!='none',e=q.east!='none',w=q.west!='none',up=N(0,1,0);
    q.up=((a&&b&&!e&&!w)||(e&&w&&!a&&!b))&&!(up&&up.k==0)?'false':'true';
    if(up&&/_wall$/.test(up.n))for(const [k] of DS)if(q[k]!='none')q[k]='tall';
  }
  return q;
}
function plate(side,t,lo=0,hi=16,y0=0,y1=16){ // placa pegada a un lado de la celda
  const [sx,sz]=side;
  return sx? [sx<0?0:16-t,y0,lo,sx<0?t:16,y1,hi] : [lo,y0,sz<0?0:16-t,hi,y1,sz<0?t:16];
}
export function shapeOf(n,p,N){
  if(N&&needsNb(n,p))p=withNb(n,p,N);
  const f=DIR[p.facing]||[0,-1],l=[f[1],-f[0]],bk=[-f[0],-f[1]],T=v=>v==='true',B=[];
  const AY={north:0,east:90,south:180,west:270},Yr=['y',AY[p.facing]||0,8,8,8],mk=(a,rot,tx,dy,tf)=>Object.assign(a,{rot,tx,dy,tf}),Yo=['y',((AY[p.facing]||0)+180)%360,8,8,8];
  if(CROSS.test(n))return {cross:1};
  if(n=='lever'){
    const fc=p.face||'wall',on=T(p.powered)!==shapeOpts.levInv,ay=((AY[p.facing]||0)+(shapeOpts.levFlip?180:0))%360,el=['x',on?-45:45,8,1,8];
    const base=fc=='floor'?[['y',ay,8,8,8]]:fc=='wall'?[['x',-90,8,8,8],['y',ay,8,8,8]]:[['x',180,8,8,8],['y',(ay+180)%360,8,8,8]];
    return {boxes:[mk([5,0,4,11,3,12],base,'cobblestone'),mk([7,1,7,9,11,9],[el,...base],'lever')]};
  }
  if(n=='hopper'){
    const o='hopper_outside',fd=p.facing&&p.facing!='down';
    return {boxes:[mk([0,10,0,16,11,16],0,'hopper_inside'),mk([0,11,0,2,16,16],0,o),mk([14,11,0,16,16,16],0,o),mk([2,11,0,14,16,2],0,o),mk([2,11,14,14,16,16],0,o),
      mk([4,4,4,12,10,12],0,o),fd?mk([6,4,0,10,8,4],[Yr],o):mk([6,0,6,10,4,10],0,o)]};
  }
  if(n=='repeater'){
    const on=T(p.powered),d=Math.min(4,Math.max(1,+p.delay||1)),tt=on?'redstone_torch':'redstone_torch_off',z0=6+2*(d-1);
    return {boxes:[mk([0,0,0,16,2,16],[Yo],on?'repeater_on':'repeater'),mk([7,2,2,9,7,4],[Yo],tt,5),mk([7,2,z0,9,7,z0+2],[Yo],tt,5)]};
  }
  if(n=='comparator'){
    const on=T(p.powered),sub=p.mode=='subtract',tt=on?'redstone_torch':'redstone_torch_off';
    return {boxes:[mk([0,0,0,16,2,16],[Yo],on?'comparator_on':'comparator'),mk([7,2,2,9,sub?7:5,4],[Yo],sub?'redstone_torch':'redstone_torch_off',5),
      mk([4,2,11,6,7,13],[Yo],tt,5),mk([10,2,11,12,7,13],[Yo],tt,5)]};
  }
  if(/^(rail|powered_rail|detector_rail|activator_rail)$/.test(n)){
    const sh=p.shape||'north_south',pw=T(p.powered),corner=/^(north|south)_(east|west)$/.test(sh);
    const tx=n=='rail'?(corner?'rail_corner':'rail'):pw?n+'_on':n;
    const ry={east_west:90,ascending_east:90,ascending_west:90,south_west:90,north_west:180,north_east:270}[sh]||0;
    const asc=/^ascending/.test(sh),sw=sh=='ascending_south'||sh=='ascending_west',yN=asc&&!sw?17:1,yS=asc&&sw?17:1;
    return {quads:[{P:[[0,yS,16],[16,yS,16],[16,yN,0],[0,yN,0]],tx,ry}]};
  }
  if(n=='piston_head'||((n=='piston'||n=='sticky_piston')&&T(p.extended))){
    const Rf=p.facing=='up'?['x',90,8,8,8]:p.facing=='down'?['x',-90,8,8,8]:Yr;
    if(n=='piston_head')return {boxes:[mk([0,0,0,16,16,4],[Rf],'piston_side',0,{5:p.type=='sticky'?'piston_top_sticky':'piston_top',4:'piston_bottom'}),mk([6,6,4,10,10,16],[Rf],'piston_side')]};
    return {boxes:[mk([0,0,4,16,16,16],[Rf],'piston_side',0,{5:'piston_inner',4:'piston_bottom'})]};
  }
  if(/(^|_)chest$/.test(n)&&!/minecart/.test(n)){
    const t=p.type;
    return {boxes:[mk([t=='right'?0:1,0,1,t=='left'?16:15,14,15],[Yr]),mk([7,7,0,9,11,1],[Yr],'iron_block')]};
  }
  if(/_slab$/.test(n))return p.type=='double'?null:{boxes:[p.type=='top'?[0,8,0,16,16,16]:[0,0,0,16,8,16]]};
  if(/_stairs$/.test(n)){
    const top=p.half=='top',sh=p.shape||'straight',y0=top?0:8;
    B.push(top?[0,8,0,16,16,16]:[0,0,0,16,8,16]);
    for(let a=0;a<2;a++)for(let c=0;c<2;c++){
      const sx=a*2-1,sz=c*2-1,fs=sx*f[0]+sz*f[1]>0,dl=sx*l[0]+sz*l[1];
      const on=sh=='outer_left'?fs&&dl>0:sh=='outer_right'?fs&&dl<0:sh=='inner_left'?fs||dl>0:sh=='inner_right'?fs||dl<0:fs;
      if(on)B.push([a*8,y0,c*8,a*8+8,y0+8,c*8+8]);
    }
    return {boxes:B};
  }
  if(/wall_torch$/.test(n))return {boxes:[[7+bk[0]*5,3,7+bk[1]*5,9+bk[0]*5,13,9+bk[1]*5]]};
  if(/(^|_)torch$/.test(n))return {boxes:[[7,0,7,9,10,9]]};
  if(n=='redstone_wire'){
    const g=d=>p[d]=='side'||p[d]=='up',pw=(+p.power||0)/15,fl=[.3+.7*pw,.02,.02];
    let N=g('north'),S=g('south'),E=g('east'),Wd=g('west');
    if((N||S)&&!E&&!Wd)N=S=true;if((E||Wd)&&!N&&!S)E=Wd=true;
    B.push([5,0,5,11,.3,11]);
    if(N)B.push([5,0,0,11,.3,5]);if(S)B.push([5,0,11,11,.3,16]);if(Wd)B.push([0,0,5,5,.3,11]);if(E)B.push([11,0,5,16,.3,11]);
    if(p.north=='up')B.push([5,0,0,11,16,.3]);if(p.south=='up')B.push([5,0,15.7,11,16,16]);
    if(p.west=='up')B.push([0,0,5,.3,16,11]);if(p.east=='up')B.push([15.7,0,5,16,16,11]);
    return {boxes:B,flat:fl};
  }
  if(/_fence$/.test(n)){
    B.push([6,0,6,10,16,10]);
    if(T(p.north))B.push([7,6,0,9,9,6],[7,12,0,9,15,6]);if(T(p.south))B.push([7,6,10,9,9,16],[7,12,10,9,15,16]);
    if(T(p.east))B.push([10,6,7,16,9,9],[10,12,7,16,15,9]);if(T(p.west))B.push([0,6,7,6,9,9],[0,12,7,6,15,9]);
    return {boxes:B};
  }
  if(/_fence_gate$/.test(n)){
    const x=f[0]==0;
    if(x){B.push([0,5,6,2,16,10],[14,5,6,16,16,10]);if(!T(p.open))B.push([2,6,7,14,9,9],[2,12,7,14,15,9])}
    else{B.push([6,5,0,10,16,2],[6,5,14,10,16,16]);if(!T(p.open))B.push([7,6,2,9,9,14],[7,12,2,9,15,14])}
    return {boxes:B};
  }
  if(/[a-z]_wall$/.test(n)){
    if(p.up!='false')B.push([4,0,4,12,16,12]);
    const h=v=>v=='tall'?16:14;
    if(p.north&&p.north!='none')B.push([5,0,0,11,h(p.north),8]);if(p.south&&p.south!='none')B.push([5,0,8,11,h(p.south),16]);
    if(p.east&&p.east!='none')B.push([8,0,5,16,h(p.east),11]);if(p.west&&p.west!='none')B.push([0,0,5,8,h(p.west),11]);
    return {boxes:B};
  }
  if(/_pane$|^iron_bars$/.test(n)){
    B.push([7,0,7,9,16,9]);
    if(T(p.north))B.push([7,0,0,9,16,8]);if(T(p.south))B.push([7,0,8,9,16,16]);
    if(T(p.east))B.push([8,0,7,16,16,9]);if(T(p.west))B.push([0,0,7,8,16,9]);
    return {boxes:B};
  }
  if(/_door$/.test(n)){
    let side=bk;if(T(p.open))side=p.hinge=='left'?[-l[0],-l[1]]:l;
    return {boxes:[plate(side,3)]};
  }
  if(/_trapdoor$/.test(n))return {boxes:[T(p.open)?plate(bk,3):p.half=='top'?[0,13,0,16,16,16]:[0,0,0,16,3,16]]};
  if(n=='ladder')return {boxes:[plate(bk,1)]};
  if(n=='vine'){for(const d in DIR)if(T(p[d]))B.push(plate(DIR[d],.8));if(T(p.up))B.push([0,15.2,0,16,16,16]);return {boxes:B.length?B:[[0,15.2,0,16,16,16]]}}
  if(/_button$/.test(n))return {boxes:[p.face=='floor'?[5,0,5,11,2,11]:p.face=='ceiling'?[5,14,5,11,16,11]:plate(bk,2,5,11,5,11)]};
  if(/_carpet$/.test(n))return {boxes:[[0,0,0,16,1,16]]};
  if(/_pressure_plate$/.test(n))return {boxes:[[1,0,1,15,1,15]]};
  if(n=='lily_pad')return {boxes:[[0,0,0,16,.5,16]]};
  if(n=='snow'&&p.layers!='8')return {boxes:[[0,0,0,16,2*(+p.layers||1),16]]};
  if(/^(repeater|comparator)$/.test(n))return {boxes:[[0,0,0,16,2,16]]};
  if(n=='daylight_detector')return {boxes:[[0,0,0,16,6,16]]};
  if(n=='enchanting_table')return {boxes:[[0,0,0,16,12,16]]};
  if(/_bed$/.test(n))return {boxes:[[0,3,0,16,9,16]]};
  if(/lantern$/.test(n)&&!/sea/.test(n))return {boxes:[[5,0,5,11,7,11]]};
  if(n=='end_rod')return {boxes:[[7,0,7,9,16,9]]};
  return null;
}
