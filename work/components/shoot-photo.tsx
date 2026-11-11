'use client';
import {useState} from 'react';
import {PhotoViewer} from './photo-viewer';
export function ShootPhoto({id,src}:{id?:string|null;src?:string}){
 const [open,setOpen]=useState(false);if(!id&&!src)return null;const url=src||'/api/shoots/photo?id='+encodeURIComponent(id!);
 return <><button type="button" aria-label="გადაღების ფოტოს გადიდება" onClick={()=>setOpen(true)} style={{display:'block',width:'100%',border:0,background:'transparent',padding:0}}><img src={url} alt="გადაღების ფოტო" loading="lazy" style={{width:'100%',maxHeight:280,objectFit:'cover',borderRadius:18}}/></button>{open&&<PhotoViewer src={url} alt="გადაღების ფოტო" onClose={()=>setOpen(false)}/>}</>;
}
export async function preparePhoto(file:File){
 if(file.size>30*1024*1024)throw new Error('აირჩიე 30 MB-მდე ფოტო.');const url=URL.createObjectURL(file);
 try{const image=new Image();image.src=url;await image.decode();const scale=Math.min(1,1400/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);const ctx=canvas.getContext('2d');if(!ctx)throw Error('ფოტო ვერ დამუშავდა.');ctx.drawImage(image,0,0,canvas.width,canvas.height);return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('ფოტო ვერ დამუშავდა.')),'image/jpeg',0.78))}finally{URL.revokeObjectURL(url)}
}
