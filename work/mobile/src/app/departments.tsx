import {Text,View} from 'react-native';
import {useAuth} from '../lib/auth';
import {useResource} from '../lib/use-resource';
import {hasPermission} from '../lib/permissions';
import {hierarchyInDepartment,roleLabel,type DepartmentsData} from '../lib/departments';
import {Button,Fold,Screen,State,S} from '../ui/components';
import {HierarchyBadge} from '../ui/hierarchy-badge';
import {router} from 'expo-router';
export default function Departments(){
 const r=useResource<DepartmentsData>('/api/mobile/departments'),p=useAuth().session?.permissions;
 return <Screen title="დეპარტამენტები" back refresh={r.refresh}>
  <Text style={S.muted}>ყველა დეპარტამენტის უმაღლესი თანამდებობა ექვემდებარება დამფუძნებელს. ერთ დონეზე მდგომი შტატები თანაბარ საფეხურზეა.</Text>
  {hasPermission(p,'positions.view')&&<Button secondary title="შტატები და უფლებები" icon="layers-outline" onPress={()=>router.push('/admin/positions')}/>}
  {r.loading&&!r.data?<State loading/>:r.error?<State error={r.error} retry={r.refresh}/>:r.data?.departments.map(d=>{
   const roles=hierarchyInDepartment(r.data!.positions,d.id),levels=[...new Set(roles.map(r=>r.displayLevel))],maxLevel=Math.max(1,...levels),people=r.data!.people.filter(p=>roles.some(r=>r.active&&r.name===p.role));
   return <View key={d.id} style={S.card}><Text style={S.subtitle}>{d.name}</Text><Text style={S.muted}>{d.description}</Text>
    <View style={[S.row,{gap:12,marginVertical:8}]}><HierarchyBadge level={0} maxLevel={maxLevel}/><Text style={S.text}>{roleLabel('Owner')}</Text></View>
    {levels.map(level=><View key={level} style={{flexDirection:'row',gap:12,alignItems:'flex-start'}}><HierarchyBadge level={level} maxLevel={maxLevel}/><View style={{flex:1,gap:8}}>{roles.filter(r=>r.displayLevel===level).map(role=><View key={role.name} style={{padding:12,gap:5,borderRadius:12,backgroundColor:'#102f43'}}><Text style={[S.text,{fontSize:14}]}>{roleLabel(role.name)}</Text><Text style={[S.muted,{fontSize:11}]}>ექვემდებარება: {roleLabel(role.reportsTo)}</Text>{!role.active&&<Text style={S.muted}>არააქტიური</Text>}</View>)}</View></View>)}
    <Fold title="რეგისტრირებული გუნდი" subtitle={`${people.length} თანამშრომელი`}>{people.map(person=><View key={person.userId||person.name} style={{gap:4}}><Text style={S.text}>{person.name}</Text><Text style={S.muted}>{roleLabel(person.role)}</Text></View>)}{!people.length&&<Text style={S.muted}>აქტიური თანამშრომელი ჯერ არ არის.</Text>}</Fold>
   </View>;
  })}
 </Screen>;
}
