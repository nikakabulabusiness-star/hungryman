import {canControl,featureCatalog} from '../../../../lib/site-controls';
import {Stack} from 'expo-router';
import {useAuth} from '../../lib/auth';
import {hasPermission} from '../../lib/permissions';
import {C} from '../../ui/components';
export default function AdminLayout(){
 const p=useAuth().session?.permissions;
 return <Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:C.bg}}}>
  <Stack.Protected guard={!!p?.isDeveloper}><Stack.Screen name="system"/><Stack.Screen name="functions"/></Stack.Protected>
  <Stack.Protected guard={featureCatalog.some(f=>canControl(p,'features.'+f.key))}><Stack.Screen name="features"/></Stack.Protected>
  <Stack.Protected guard={hasPermission(p,'applications.view')}><Stack.Screen name="applications"/></Stack.Protected>
  <Stack.Protected guard={hasPermission(p,'analytics.view')}><Stack.Screen name="analytics"/></Stack.Protected>
  <Stack.Protected guard={hasPermission(p,'youtube.view')}><Stack.Screen name="youtube"/></Stack.Protected>
  <Stack.Protected guard={hasPermission(p,'accounts.view')}><Stack.Screen name="accounts"/></Stack.Protected>
  <Stack.Protected guard={hasPermission(p,'positions.view')}><Stack.Screen name="positions"/></Stack.Protected>
  <Stack.Protected guard={hasPermission(p,'employees.view')}><Stack.Screen name="employees"/></Stack.Protected>
  <Stack.Protected guard={hasPermission(p,'calendar.manage')}><Stack.Screen name="calendar"/></Stack.Protected>
  <Stack.Protected guard={hasPermission(p,'attendance.view')||hasPermission(p,'office.manage')}><Stack.Screen name="attendance"/></Stack.Protected>
 </Stack>;
}
