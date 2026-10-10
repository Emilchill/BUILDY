export const isId=s=>/^[a-f0-9]{12}$/.test(String(s));
export function sniffImage(b){
  if(b.length>12&&b[0]==0x89&&b[1]==0x50&&b[2]==0x4e&&b[3]==0x47)return '.png';
  if(b.length>3&&b[0]==0xff&&b[1]==0xd8&&b[2]==0xff)return '.jpg';
  if(b.length>12&&String.fromCharCode(b[0],b[1],b[2],b[3])=='RIFF'&&String.fromCharCode(b[8],b[9],b[10],b[11])=='WEBP')return '.webp';
  return null;
}
export const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
