import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';
import {uploadChatPhoto} from './api';
export async function pickChatPhoto(camera=false){
 if(camera&&!(await ImagePicker.requestCameraPermissionsAsync()).granted)throw new Error('პარამეტრებში დაუშვი კამერაზე წვდომა.');
 const result=await(camera?ImagePicker.launchCameraAsync({mediaTypes:['images'],quality:1}):ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:1}));
 if(result.canceled)return null;
 const source=result.assets[0],max=1400,actions=source.width>max||source.height>max?[{resize:source.width>=source.height?{width:max}:{height:max}}]:[];
 const photo=await ImageManipulator.manipulateAsync(source.uri,actions,{compress:0.78,format:ImageManipulator.SaveFormat.JPEG});
 return {uri:photo.uri,id:Crypto.randomUUID()};
}
export const sendChatPhoto=(photo:{uri:string;id:string},conversationId:string)=>uploadChatPhoto(photo.uri,conversationId,photo.id);
