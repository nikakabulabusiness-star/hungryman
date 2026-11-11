export type Coordinates = {latitude:number;longitude:number};
export const placeId = (value:unknown):value is string => typeof value==='string'&&/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value);
export function validCoordinates(value:unknown):value is Coordinates {
 if(!value||typeof value!=='object')return false;
 const p=value as Coordinates;
 return typeof p.latitude==='number'&&typeof p.longitude==='number'&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=85&&Math.abs(p.longitude)<=180;
}
// Every resolved hop must remain on a supported maps host and path. Never fetch an arbitrary pasted URL.
export function supportedMapUrl(value:unknown):URL|null {
 if(typeof value!=='string'||value.length>4096)return null;
 try {
  const u=new URL(value.trim());
  if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
  if(['www.google.com','google.com'].includes(u.hostname)&&!/^\/maps(?:\/|$)/.test(u.pathname))return null;
  if(u.hostname==='goo.gl'&&!u.pathname.startsWith('/maps/'))return null;
  if(!['www.google.com','google.com','maps.google.com','maps.app.goo.gl','goo.gl','maps.apple.com'].includes(u.hostname))return null;
  return u;
 }catch{return null}
}
export function mapCoordinates(value:string):Coordinates|null {
 const u=supportedMapUrl(value);if(!u)return null;
 let decoded:string;try{decoded=decodeURIComponent(u.href)}catch{return null}
 const pair=decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)||decoded.match(/[?&](?:query|q|ll|sll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?:[&#]|$)/)||decoded.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?:,|\/|[?&#]|$)/);
 if(!pair)return null;
 const coordinates={latitude:Number(pair[1]),longitude:Number(pair[2])};
 return validCoordinates(coordinates)?coordinates:null;
}
export async function resolveMapCoordinates(value:unknown,send:typeof fetch=fetch):Promise<Coordinates|null>{
 let url=supportedMapUrl(value);if(!url)return null;
 const direct=mapCoordinates(url.href);if(direct)return direct;
 // Only known map short links need a network request. Named places without coordinates use manual pin selection.
 if(url.hostname!=='maps.app.goo.gl'&&url.hostname!=='goo.gl')return null;
 const signal=AbortSignal.timeout(6000);
 try {
  for(let hop=0;hop<4;hop++){
   const response=await send(url.href,{method:'HEAD',redirect:'manual',signal});
   if(response.status<300||response.status>=400)return null;
   const location=response.headers.get('location');if(!location)return null;
   url=supportedMapUrl(new URL(location,url).href);if(!url)return null;
   const coordinates=mapCoordinates(url.href);if(coordinates)return coordinates;
  }
 }catch{return null}
 return null;
}
export const mapsLink = (p:Coordinates)=>`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`;
