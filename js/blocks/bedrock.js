/* Normaliza bloques de Bedrock (nombre + estados) a nombres/propiedades estilo Java. */
let J2B={},B2J={};
/* a = contenido de data/aliases.json */
export function setAliases(a){
  J2B=a.java_to_bedrock||{};B2J={...(a.bedrock_extra||{})};
  for(const [j,b] of Object.entries(J2B))if(!(b in B2J)&&b!=j&&b!='air')B2J[b]=j;
}
export const javaToBedrock=n=>J2B[n]||n;
export const bedrockToJava=n=>B2J[n]||n;
export function bedrockName(e){
  let n=e.name.replace(/^minecraft:/,''),t=e.states||{};
  const col=()=>{const c=t.color||'white';return c=='silver'?'light_gray':c};
  if(n=='lever'){
    const d=t.lever_direction||'north',m={down_east_west:{face:'ceiling',facing:'east'},down_north_south:{face:'ceiling',facing:'north'},up_east_west:{face:'floor',facing:'east'},up_north_south:{face:'floor',facing:'north'}}[d]||{face:'wall',facing:d};
    return [n,{...m,powered:String(!!t.open_bit)}];
  }
  const td=t.torch_facing_direction;
  if(/torch$/.test(n)&&td&&td!='top'&&td!='unknown')return [bedrockToJava(n).replace(/torch$/,'wall_torch'),{facing:td}];
  const M={planks:()=>(t.wood_type||'oak')+'_planks',log:()=>(t.old_log_type||t.new_log_type||'oak')+'_log',grass:()=>'grass_block',
    stained_glass:()=>col()+'_stained_glass',wool:()=>col()+'_wool',concrete:()=>col()+'_concrete',stained_hardened_clay:()=>col()+'_terracotta',
    leaves:()=>(t.old_leaf_type||'oak')+'_leaves',stonebrick:()=>'stone_bricks',brick_block:()=>'bricks',grass_path:()=>'dirt_path',
    snow_layer:()=>'snow',double_stone_slab:()=>'stone',flowing_water:()=>'water',flowing_lava:()=>'lava'};
  n=M[n]?M[n]():n;let p={};
  if(/_stairs$/.test(n))p={facing:['east','west','south','north'][t.weirdo_direction|0],half:t.upside_down_bit?'top':'bottom',shape:'straight'};
  else if(/_slab$/.test(n))p={type:t.top_slot_bit?'top':'bottom'};
  else if(n=='redstone_wire')p={power:String(t.redstone_signal|0)};
  else if(/(^|_)rail$/.test(n)){
    if(n=='golden_rail')n='powered_rail';
    p={shape:['north_south','east_west','ascending_east','ascending_west','ascending_north','ascending_south','south_east','south_west','north_west','north_east'][t.rail_direction|0]||'north_south',powered:String(!!t.rail_data_bit)};
  }
  else if(t.facing_direction!=null&&/^(hopper|observer|dispenser|dropper|piston|sticky_piston)$/.test(n))p={facing:['down','up','north','south','west','east'][t.facing_direction|0],powered:String(!!(t.powered_bit||t.toggle_bit))};
  return [bedrockToJava(n),p];
}
