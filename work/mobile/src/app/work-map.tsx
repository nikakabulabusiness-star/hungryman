import {useState} from 'react';
import {useLiveLocation} from '../lib/use-live-location';
import {Linking,Pressable,Text,View} from 'react-native';
import {useResource} from '../lib/use-resource';
import {api} from '../lib/api';
import {usePlacePhotos,type MapPlace} from '../lib/map-places';
import {MapPlaces} from '../ui/map-place-manager';
import {WorkMap,type MapPin} from '../ui/work-map';
import type {Office} from '../lib/location';
import {Button,Icon,Screen,State,C,S} from '../ui/components';
type Shoot={id:string;title:string;shoot_date:string;start_time:string;location_name:string;location_url:string|null;latitude:number|null;longitude:number|null};
type MapData={office:Office|null;shoots:Shoot[];history:Shoot[];historyCursor:{date:string;id:string}|null;places:MapPlace[];canManagePlaces:boolean};
export default function MapScreen(){
 const live=useLiveLocation(),r=useResource<MapData>('/api/workspace/map',30000),photos=usePlacePhotos(r.data?.places||[]);
 const [showPast,setShowPast]=useState(true),[more,setMore]=useState<Shoot[]>([]),[cursor,setCursor]=useState<MapData['historyCursor']|undefined>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const history=[...new Map([...(r.data?.history||[]),...more].map(s=>[s.id,s])).values()];
 const pins:MapPin[]=[...(r.data?.places||[]).map(p=>({title:p.name,latitude:p.latitude,longitude:p.longitude,place:true,url:p.url||undefined,photo:p.photo_id?photos[p.photo_id]:undefined})),...(r.data?.office?[{...r.data.office,title:r.data.office.name,office:true}]:[]),...[...(r.data?.shoots||[]).map(s=>({...s,past:false})),...(showPast?history.map(s=>({...s,past:true})):[])].filter(s=>s.latitude!==null&&s.longitude!==null).map(s=>({title:s.title,latitude:s.latitude!,longitude:s.longitude!,url:s.location_url||undefined,date:s.shoot_date,time:s.start_time,past:s.past,description:s.location_name}))];
 const next=cursor===undefined?r.data?.historyCursor:cursor;
 async function loadMore(){if(!next||busy)return;setBusy(true);setError('');try{const page=await api<MapData>(`/api/workspace/map?beforeDate=${encodeURIComponent(next.date)}&beforeId=${encodeURIComponent(next.id)}`);setMore(old=>[...old,...page.history]);setCursor(page.historyCursor)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const open=(s:Shoot)=>void Linking.openURL(s.location_url||`https://www.google.com/maps/search/?api=1&query=${s.latitude!==null&&s.longitude!==null?`${s.latitude},${s.longitude}`:encodeURIComponent(s.location_name)}`);
 return <Screen title="გუნდის რუკა" back refresh={()=>{setMore([]);setCursor(undefined);r.refresh()}}>{r.loading&&!r.data?<State loading/>:r.error?<State error={r.error} retry={r.refresh}/>:<>
  <WorkMap pins={pins} userLocation={live.position}/>
  {live.error?<><Text style={S.muted}>{live.error}</Text><Button title="პარამეტრების გახსნა" secondary onPress={()=>void Linking.openSettings()}/></>:<Text style={[S.muted,{fontSize:12}]}>{live.position?'ლურჯი წერტილი — შენი მიმდინარე მდებარეობა':'მიმდინარე მდებარეობის მოძებნა…'}</Text>}
  {!r.data?.office&&<Text style={S.muted}>ოფისის ლოკაციას HR ან Developer მართვის პანელიდან მონიშნავს.</Text>}
  {r.data?.office&&<View style={S.card}><Text style={S.subtitle}>{r.data.office.name}</Text><Button title="Google Maps-ში გახსნა" secondary onPress={()=>void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${r.data!.office!.latitude},${r.data!.office!.longitude}`)}/></View>}
  <MapPlaces places={r.data?.places||[]} photos={photos} canManage={!!r.data?.canManagePlaces} refresh={r.refresh}/>
  <Text style={S.subtitle}>დაგეგმილი გადაღებები</Text>
  {r.data?.shoots.length===0&&<Text style={S.muted}>გადაღება ჯერ არ არის დაგეგმილი.</Text>}
  {r.data?.shoots.map(s=><View key={s.id} style={S.card}><Text style={S.subtitle}>{s.title}</Text><View style={S.row}><Icon name="location-outline"/><Text style={S.muted}>{s.shoot_date} · {s.start_time} · {s.location_name}</Text></View><Button secondary title="Google Maps-ში გახსნა" onPress={()=>open(s)}/>{s.latitude===null&&<Text style={S.muted}>ამ გადაღების რუკაზე პინი ჯერ არ მონიშნულა.</Text>}</View>)}
  <View style={S.between}><Text style={S.subtitle}>წინა გადაღებები</Text><Pressable accessibilityRole="switch" accessibilityState={{checked:showPast}} onPress={()=>setShowPast(v=>!v)} style={S.icon}><Icon name={showPast?'eye-outline':'eye-off-outline'} color={showPast?C.blue:C.muted}/></Pressable></View>
  <Text style={[S.muted,{fontSize:12}]}>ქარვისფერი პინები — ადრე ჩანიშნული გადაღებები. შეეხე პინს თარიღისა და ადგილის სანახავად.</Text>
  {history.length===0&&<Text style={S.muted}>გადაღებების ისტორია ჯერ ცარიელია.</Text>}
  {history.map(s=><View key={s.id} style={S.card}><Text style={S.subtitle}>{s.title}</Text><Text style={S.muted}>აქ გადაღება ჩანიშნული იყო {s.shoot_date} · {s.start_time}</Text><Text style={S.muted}>{s.location_name}</Text><Button title="Google Maps-ში გახსნა" secondary onPress={()=>open(s)}/>{s.latitude===null&&<Text style={S.muted}>ამ ჩანაწერს რუკის პინი არ აქვს.</Text>}</View>)}
  {!!error&&<Text style={{color:C.red}}>{error}</Text>}{next&&<Button title="მეტი ისტორია" secondary busy={busy} onPress={()=>void loadMore()}/>}
 </>}</Screen>;
}
