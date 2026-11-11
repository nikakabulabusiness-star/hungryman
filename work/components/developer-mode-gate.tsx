import {Suspense} from 'react';
import {getSessionUser} from '@/lib/staff-auth';
import {DEVELOPER_EMAIL,getPreviewRole} from '@/lib/admin';
import DeveloperMode from './developer-mode';

// Same decision as GET /api/developer/mode, made while the page renders: other
// staff no longer send a request that always ended in 403 on every page load.
// Suspense keeps this lookup off the critical path of the page shell.
async function developerModeState():Promise<boolean|null>{
 try{
  const user=await getSessionUser();
  if(user?.email!==DEVELOPER_EMAIL)return null;
  return (await getPreviewRole(user))===null;
 }catch{return null}
}
async function DeveloperModeForAccount(){
 const active=await developerModeState();
 return active===null?null:<DeveloperMode initialActive={active}/>;
}
export default function DeveloperModeGate(){return <Suspense fallback={null}><DeveloperModeForAccount/></Suspense>}
