import {useCallback,useState} from 'react';
import {AppState} from 'react-native';
import {useFocusEffect} from 'expo-router';
import * as Location from 'expo-location';
import type {LiveLocation} from '../ui/work-map';
export function useLiveLocation(){
 const [position,setPosition]=useState<LiveLocation|null>(null),[error,setError]=useState('');
 useFocusEffect(useCallback(()=>{let closed=false,generation=0,watch:Location.LocationSubscription|undefined;
 const stop=()=>{generation++;watch?.remove();watch=undefined};
 async function start(){stop();const run=generation;try{const permission=await Location.getForegroundPermissionsAsync();if(closed||run!==generation)return;if(!permission.granted){setError('მდებარეობის სანახავად Settings-ში ჩართე ლოკაციაზე წვდომა.');return}if(!await Location.hasServicesEnabledAsync()){setError('ტელეფონში ლოკაციის სერვისი გამორთულია.');return}setError('');const subscription=await Location.watchPositionAsync({accuracy:Location.Accuracy.High,timeInterval:2000,distanceInterval:3},p=>{if(!closed&&run===generation){setPosition({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy||0});setError('')}},()=>{if(!closed)setError('მდებარეობის განახლება შეფერხდა. შეამოწმე GPS.')});if(closed||run!==generation)subscription.remove();else watch=subscription}catch{if(!closed)setError('მდებარეობა ვერ განახლდა.')}}
 void start();const listener=AppState.addEventListener('change',s=>{if(s==='active')void start();else{stop();setPosition(null)}});return()=>{closed=true;stop();listener.remove()}
 },[]));return {position,error};
}
