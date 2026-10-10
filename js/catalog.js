/* Constantes y clasificación del catálogo (compartidas por el sitio y el servidor). */
export const PLATFORMS=[['bedrock','Bedrock'],['java','Java']];
export const CATEGORIES=[['casa','Casa'],['castillo','Castillo'],['torre','Torre'],['granja','Granja (cultivos)'],['granja_mobs','Granja de mobs'],
  ['redstone','Redstone'],['decoracion','Decoración / estatua'],['puente','Puente'],['barco','Barco / nave'],['ciudad','Ciudad / aldea'],
  ['paisaje','Paisaje / terreno'],['otro','Otro']];
export const SIZES=[['small','Pequeña','hasta 24 bloques'],['medium','Mediana','25 a 64'],['large','Grande','65 a 128'],['huge','Enorme','más de 128']];
/* Tamaño según la dimensión más larga */
export const sizeClass=({w,h,l})=>{const m=Math.max(w,h,l);return m<=24?'small':m<=64?'medium':m<=128?'large':'huge'};
export const labelOf=(list,key)=>(list.find(x=>x[0]==key)||[key,key])[1];
