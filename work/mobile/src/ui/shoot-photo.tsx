import {useState} from 'react';
import {Image,Modal,Pressable,ScrollView,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {shootPhotoSource} from '../lib/api';
import {Icon,C} from './components';
export function ShootPhoto({id,uri,height=190}:{id?:string|null;uri?:string;height?:number}){
 const [open,setOpen]=useState(false);if(!id&&!uri)return null;const source=uri?{uri}:shootPhotoSource(id!);
 return <><Pressable accessibilityLabel="გადაღების ფოტოს გადიდება" onPress={()=>setOpen(true)}><Image source={source} style={{width:'100%',height,borderRadius:18}} resizeMode="cover"/><View style={{position:'absolute',right:10,bottom:10,padding:6,borderRadius:10,backgroundColor:'#061827bb'}}><Icon name="expand-outline" size={18}/></View></Pressable><Modal visible={open} animationType="fade" onRequestClose={()=>setOpen(false)}><SafeAreaView style={{flex:1,backgroundColor:C.bg}}><Pressable accessibilityLabel="ფოტოს დახურვა" onPress={()=>setOpen(false)} style={{alignSelf:'flex-end',padding:18}}><Icon name="close" size={28}/></Pressable><ScrollView contentContainerStyle={{flexGrow:1}} maximumZoomScale={4} minimumZoomScale={1} centerContent><Image source={source} style={{flex:1,width:'100%',minHeight:450}} resizeMode="contain"/></ScrollView></SafeAreaView></Modal></>;
}
