import {DEVELOPER_EMAIL,getAdminAccess} from '@/lib/admin';
import {featureCatalog} from '@/lib/site-controls';
import {permissionKeys,protectedSystemPermissions,type PermissionKey} from '@/lib/permissions';
import {getSiteControlState} from '@/lib/site-controls-store';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
async function developer(){const a=await getAdminAccess();return a?.isDeveloper&&a.email===DEVELOPER_EMAIL?a:null}
export async function GET(){return await developer()?json(await getSiteControlState()):json({error:'მხოლოდ დეველოპერისთვის.'},403)}
export async function PATCH(req:Request){
 const a=await developer();if(!a||!sameOrigin(req))return json({error:'მხოლოდ დეველოპერისთვის.'},403);
 const b=await req.json().catch(()=>null) as {kind?:unknown;key?:unknown;removed?:unknown}|null;
 if(!b||typeof b.key!=='string'||typeof b.removed!=='boolean'||!['feature','permission'].includes(String(b.kind)))return json({error:'არასწორი მოთხოვნა.'},400);
 const key=b.key,feature=b.kind==='feature';
 if(feature?!featureCatalog.some(f=>f.key===key):!permissionKeys.includes(key as PermissionKey))return json({error:'ფუნქცია ვერ მოიძებნა.'},400);
 if(!feature&&protectedSystemPermissions.includes(key as PermissionKey))return json({error:'შესვლა და აღდგენის მართვა სისტემის აუცილებელი ნაწილია.'},403);
 const {DB}=storage(),now=Date.now(),jsonPath=`$._removed${feature?'Features':'Permissions'}."${key}"`;
 // Only configuration changes. Records and links remain intact for dependent modules.
 const mutation=b.removed?DB.prepare(`INSERT INTO workspace_settings(key,value,updated,updated_by) VALUES('site_features',json_set('{}',?,json(?)),?,?) ON CONFLICT(key) DO UPDATE SET value=json_set(workspace_settings.value,?,json(?)),updated=MAX(workspace_settings.updated+1,excluded.updated),updated_by=excluded.updated_by`).bind(jsonPath,JSON.stringify({at:now}),now,a.email,jsonPath,JSON.stringify({at:now})):
  DB.prepare("UPDATE workspace_settings SET value=json_remove(value,?),updated=MAX(updated+1,?),updated_by=? WHERE key='site_features'").bind(jsonPath,now,a.email);
 const statements=[mutation,DB.prepare('INSERT INTO workspace_audit(id,actor,action,target,details,created) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),a.email,b.removed?'site.function.removed':'site.function.restored',`${b.kind}:${key}`,JSON.stringify({retainedData:true}),now)];
 if(b.removed&&((feature&&['calls','teamChat','privateChats','groups'].includes(key))||(!feature&&['chat.view','chat.call'].includes(key)))){
  const condition=!feature||key==='calls'?'1=1':key==='teamChat'?"conversation_id='team'":key==='privateChats'?"conversation_id LIKE 'dm_%'":"conversation_id LIKE 'grp_%'";
  statements.push(DB.prepare('UPDATE chat_calls SET ended=? WHERE ended IS NULL AND '+condition).bind(now));
 }
 try{await DB.batch(statements);return json(await getSiteControlState())}catch{return json({error:'ცვლილება ვერ შეინახა. სცადე ხელახლა.'},503)}
}
