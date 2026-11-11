import {useState} from 'react';
import {Alert,Image,Linking,Pressable,Text,View} from 'react-native';
import {api} from '../lib/api';
import {blankPlace,pickPlacePhoto,type MapPlace,type PlaceForm} from '../lib/map-places';
import {Button,Field,Icon,Sheet,State,C,S} from './components';
import {WorkMap} from './work-map';
export function MapPlaces({places,photos,canManage,refresh}:{places:MapPlace[];photos:Record<string,string>;canManage:boolean;refresh:()=>Promise<void>}){
 const [form,setForm]=useState<PlaceForm|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 function open(place?:MapPlace){setError('');setForm(place?{id:place.id,name:place.name,url:place.url||'',point:{latitude:place.latitude,longitude:place.longitude},photoId:place.photo_id,photoUri:place.photo_id?photos[place.photo_id]||null:null}:blankPlace())}
 async function resolve(){if(!form||busy)return;setBusy(true);setError('');try{const point=await api<{latitude:number;longitude:number}>('/api/workspace/places',{method:'POST',body:{action:'resolve',url:form.url}});setForm(old=>old?{...old,point}:null)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function photo(){if(busy)return;setBusy(true);setError('');try{const p=await pickPlacePhoto();if(p)setForm(old=>old?{...old,photoId:p.id,photoUri:p.uri}:null)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function save(){if(!form||busy)return;setBusy(true);setError('');try{await api('/api/workspace/places',{method:'POST',body:{id:form.id,name:form.name,...form.point,url:form.url,photoId:form.photoId}});await refresh();setForm(null)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function remove(place:MapPlace){setBusy(true);setError('');try{await api('/api/workspace/places',{method:'DELETE',body:{id:place.id}});await refresh()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <>
  <View style={S.between}><Text style={S.subtitle}>მნიშვნელოვანი ადგილები</Text>{canManage&&<Pressable accessibilityLabel="ადგილის დამატება" disabled={busy} style={S.icon} onPress={()=>open()}><Icon name="add"/></Pressable>}</View>
  {!places.length&&<Text style={S.muted}>შენახული ადგილი ჯერ არ არის.</Text>}
  {places.map(p=><View key={p.id} style={[S.card,{gap:12}]}><View style={S.row}>{p.photo_id&&photos[p.photo_id]?<Image source={{uri:photos[p.photo_id]}} style={{width:48,height:48,borderRadius:14}}/>:<View style={[S.icon,{width:48,height:48}]}><Icon name="location"/></View>}<Text style={[S.subtitle,{flex:1}]}>{p.name}</Text>{canManage&&<Pressable accessibilityLabel={p.name+' · შეცვლა'} disabled={busy} style={S.icon} onPress={()=>open(p)}><Icon name="create-outline" size={20}/></Pressable>}</View><View style={S.between}><Pressable accessibilityRole="link" onPress={()=>void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`)}><Text style={{color:C.blue}}>მარშრუტი ↗</Text></Pressable>{canManage&&<Pressable accessibilityLabel={p.name+' · წაშლა'} disabled={busy} onPress={()=>Alert.alert('ადგილის წაშლა',`წაიშალოს „${p.name}“ რუკიდან?`,[{text:'გაუქმება',style:'cancel'},{text:'წაშლა',style:'destructive',onPress:()=>void remove(p)}])}><Text style={{color:C.red}}>წაშლა</Text></Pressable>}</View></View>)}
  {!!error&&!form&&<State error={error}/>}
  <Sheet visible={!!form} title={form?.id?'ადგილის შეცვლა':'ახალი ადგილი'} onClose={()=>{if(!busy)setForm(null)}}>{form&&<>
   <Field label="ადგილის სახელი" value={form.name} maxLength={80} onChangeText={name=>setForm({...form,name})}/>
   <Field label="Google Maps / Apple Maps ბმული" value={form.url} autoCapitalize="none" autoCorrect={false} keyboardType="url" onChangeText={url=>setForm({...form,url,point:null})}/>
   <Button title="ბმულიდან მონიშვნა" secondary busy={busy} disabled={!form.url.trim()} onPress={()=>void resolve()}/>
   <Text style={S.muted}>ან დააჭირე რუკაზე სასურველ წერტილს.</Text>
   <WorkMap select selectionKind="place" pins={form.point?[{...form.point,title:form.name||'ახალი ადგილი',place:true}]:[]} onSelect={(latitude,longitude)=>setForm(old=>old?{...old,point:{latitude,longitude},url:''}:null)}/>
   <Text style={[S.muted,{fontSize:12}]}>{form.point?`მონიშნულია · ${form.point.latitude.toFixed(5)}, ${form.point.longitude.toFixed(5)}`:'წერტილი ჯერ არ მონიშნულა'}</Text>
   <View style={S.row}>{form.photoUri&&<Image source={{uri:form.photoUri}} style={{width:64,height:64,borderRadius:16}}/>}<View style={{flex:1,gap:8}}><Button title={form.photoId?'ფოტოს შეცვლა':'ფოტოს დამატება'} secondary busy={busy} onPress={()=>void photo()}/>{form.photoId&&<Button title="ფოტოს მოცილება" secondary disabled={busy} onPress={()=>setForm({...form,photoId:null,photoUri:null})}/>}</View></View>
   {!!error&&<State error={error}/>}<Button title="ადგილის შენახვა" busy={busy} disabled={!form.name.trim()||!form.point} onPress={()=>void save()}/>
  </>}</Sheet>
 </>;
}
