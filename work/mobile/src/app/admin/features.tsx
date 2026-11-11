import {useState} from 'react';
import {Alert,Switch,Text,View} from 'react-native';
import {featureCatalog,canControl,type FeatureKey,type SiteFeatures} from '../../../../lib/site-controls';
import {api} from '../../lib/api';
import {useAuth} from '../../lib/auth';
import {useResource} from '../../lib/use-resource';
import {Fold,Screen,State,S,C,success} from '../../ui/components';
type Data={features:SiteFeatures;editable:FeatureKey[]};
export default function Features(){
 const {session,refresh}=useAuth(),allowed=featureCatalog.some(f=>canControl(session?.permissions,'features.'+f.key));
 const r=useResource<Data>('/api/admin/features',0,allowed),[busy,setBusy]=useState(''),[error,setError]=useState('');
 async function save(key:FeatureKey,enabled:boolean){setBusy(key);setError('');try{const result=await api<{features:SiteFeatures}>('/api/admin/features',{method:'PATCH',body:{key,enabled}});const previous=r.data;success();await refresh();if(previous)r.setData({...previous,features:result.features})}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 function toggle(key:FeatureKey,enabled:boolean){if(busy)return;if(enabled){void save(key,true);return}Alert.alert('ფუნქციის გამორთვა','გაითიშება ყველა მომხმარებლისთვის. მონაცემები შენარჩუნდება. დაკავშირებული მიმდინარე ზარები დასრულდება.',[{text:'გაუქმება',style:'cancel'},{text:'გამორთვა',style:'destructive',onPress:()=>void save(key,false)}])}
 return <Screen title="საიტის ფუნქციები" back refresh={()=>void r.refresh()}>{!allowed?<State error="წვდომა შეზღუდულია."/>:<><Text style={S.muted}>სისტემური პარამეტრები მოქმედებს ვებსა და აპზე. მართავ მხოლოდ შენთვის მინიჭებულ ფუნქციებს.</Text>{(error||r.error)&&<State error={error||r.error} retry={()=>void r.refresh()}/>} {!r.data&&r.loading&&<State loading/>}{r.data&&[...new Set(featureCatalog.filter(f=>r.data!.editable.includes(f.key)).map(f=>f.group))].map(group=><Fold key={group} title={group}>{featureCatalog.filter(f=>f.group===group&&r.data!.editable.includes(f.key)).map(f=><View style={[S.row,{paddingVertical:8}]} key={f.key}><View style={{flex:1,gap:4}}><Text style={S.text}>{f.label}</Text><Text style={S.muted}>{f.description}</Text></View><Switch accessibilityLabel={f.label} disabled={!!busy} trackColor={{true:C.blue,false:C.line}} value={r.data!.features[f.key]} onValueChange={value=>toggle(f.key,value)}/></View>)}</Fold>)}</>}</Screen>
}
