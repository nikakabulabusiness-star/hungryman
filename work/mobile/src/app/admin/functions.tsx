import {useState} from 'react';
import {Text,View} from 'react-native';
import {featureCatalog,type FunctionState} from '../../../../lib/site-controls';
import {permissionGroups,protectedSystemPermissions,hasPermission} from '../../lib/permissions';
import {useAuth} from '../../lib/auth';
import {useResource} from '../../lib/use-resource';
import {api} from '../../lib/api';
import {Button,Field,Fold,Screen,State,S,success} from '../../ui/components';
const groups:{label:string;items:{kind:'feature'|'permission';key:string;label:string;protected:boolean}[]}[]=[{label:'აპის მოდულები',items:featureCatalog.map(f=>({kind:'feature' as const,key:f.key,label:f.label,protected:false}))},...permissionGroups.map(g=>({label:g.label,items:g.permissions.map(p=>({kind:'permission' as const,key:p.key,label:p.label,protected:protectedSystemPermissions.includes(p.key)}))}))];
function label(target:string){return groups.flatMap(g=>g.items).find(i=>`${i.kind}:${i.key}`===target)?.label||target}
export default function Functions(){
 const {session,refresh}=useAuth(),allowed=!!session?.permissions?.isDeveloper,r=useResource<FunctionState>('/api/developer/functions',0,allowed);
 const [q,setQ]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState('');
 async function change(kind:'feature'|'permission',key:string,removed:boolean){if(busy)return;setBusy(kind+':'+key);setError('');try{const result=await api<FunctionState>('/api/developer/functions',{method:'PATCH',body:{kind,key,removed}});await refresh();r.setData(result);success()}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 return <Screen title="ფუნქციების ამოღება" back refresh={()=>void r.refresh()}>{!allowed?<State error="მხოლოდ დეველოპერისთვის."/>:<>
 <Text style={S.muted}>ერთი დაჭერით ამოიღე ფუნქცია აპიდან და საიტიდან. მონაცემები ინახება; აღდგენა აქვე შეგიძლია. დამოკიდებული მოქმედებები ავტომატურად იზღუდება.</Text>
 <Field label="ფუნქციის ძიება" value={q} onChangeText={setQ}/>{(error||r.error)&&<State error={error||r.error} retry={()=>void r.refresh()}/>}{!r.data&&r.loading&&<State loading/>}
 {r.data&&groups.map(group=>{const items=group.items.filter(i=>i.label.toLocaleLowerCase().includes(q.trim().toLocaleLowerCase()));return !!items.length&&<Fold key={group.label} title={group.label} subtitle={`${items.length} ფუნქცია`}>{items.map(item=>{
  const removed=(item.kind==='feature'?r.data!.removedFeatures as string[]:r.data!.removedPermissions).includes(item.key);
  const enabled=item.kind==='feature'?r.data!.features[item.key as keyof FunctionState['features']]!==false:hasPermission({isDeveloper:true,features:r.data!.features},item.key as Parameters<typeof hasPermission>[1]);
  return <View key={item.kind+':'+item.key} style={{gap:9,paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#26364b'}}><Text style={S.text}>{item.label}</Text><Text style={S.muted}>{item.protected?'სისტემის აუცილებელი ნაწილი':removed?'ამოღებულია':enabled?'ხელმისაწვდომია':'შეზღუდულია პარამეტრით ან დამოკიდებული ფუნქციით'}</Text>{!item.protected&&<Button secondary title={removed?'აღდგენა':'ამოღება'} disabled={!!busy} onPress={()=>void change(item.kind,item.key,!removed)}/>}</View>
 })}</Fold>})}
 {r.data&&<Fold title="ცვლილებების ისტორია" subtitle={`${r.data.history.length} ჩანაწერი`}>{!r.data.history.length?<Text style={S.muted}>ცვლილებები ჯერ არ არის.</Text>:r.data.history.map((h,i)=><View key={i} style={{gap:3,paddingVertical:7}}><Text style={S.text}>{label(h.target)} · {h.action.endsWith('.removed')?'ამოღება':'აღდგენა'}</Text><Text style={S.muted}>{new Date(h.created).toLocaleString('ka-GE',{timeZone:'Asia/Tbilisi'})}</Text></View>)}</Fold>}
 </>}</Screen>
}
