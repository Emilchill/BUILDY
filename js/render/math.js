/* Rotación de un punto (en 1/16 de bloque) sobre un eje con pivote. */
export const rotp=(q,r)=>{
  const [ax,deg,cx,cy,cz]=r,a=deg*Math.PI/180,c=Math.cos(a),sn=Math.sin(a);let x=q[0]-cx,y=q[1]-cy,z=q[2]-cz;
  if(ax=='x')[y,z]=[y*c-z*sn,y*sn+z*c];else if(ax=='y')[x,z]=[x*c-z*sn,x*sn+z*c];else [x,y]=[x*c-y*sn,x*sn+y*c];
  return [x+cx,y+cy,z+cz];
};
