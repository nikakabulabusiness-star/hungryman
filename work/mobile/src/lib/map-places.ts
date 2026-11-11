import {useEffect,useState} from 'react';
import * as ImagePicker from 'expo-image-picker';
import {ImageManipulator,SaveFormat} from 'expo-image-manipulator';
import {api,uploadPlacePhoto} from './api';
export type MapPlace={id:string;name:string;latitude:number;longitude:number;url:string|null;photo_id:string|null;updated:number};
export type PlaceForm={id?:string;name:string;url:string;point:{latitude:number;longitude:number}|null;photoId:string|null;photoUri:string|null};
export const blankPlace=():PlaceForm=>({name:'',url:'',point:null,photoId:null,photoUri:null});
export function usePlacePhotos(places:MapPlace[]){
 const [images,setImages]=useState<Record<string,string>>({});
 const ids=places.map(p=>p.photo_id).filter(Boolean).sort().join(',');
 useEffect(()=>{
  let cancelled=false;const controller=new AbortController();
  const run=async()=>{const entries=await Promise.all(ids.split(',').filter(Boolean).map(async id=>{try{const {uri}=await api<{uri:string}>('/api/workspace/places/photo?id='+encodeURIComponent(id)+'&data=1',{signal:controller.signal});return [id,uri] as const}catch{return null}}));if(!cancelled)setImages(Object.fromEntries(entries.filter((e):e is readonly[string,string]=>e!==null)))};
  void run();return()=>{cancelled=true;controller.abort()};
 },[ids]);
 return images;
}
export async function pickPlacePhoto(){
 const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:1});
 if(result.canceled)return null;
 const source=result.assets[0],context=ImageManipulator.manipulate(source.uri);context.resize(source.width>=source.height?{width:256}:{height:256});
 const image=await context.renderAsync();
 const output=await image.saveAsync({format:SaveFormat.JPEG,compress:0.72});
 const id=await uploadPlacePhoto(output.uri);
 return {id,uri:output.uri};
}
