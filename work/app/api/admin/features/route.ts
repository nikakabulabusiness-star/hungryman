import {getAdminAccess} from '@/lib/admin';
import {featureCatalog,canControl,type FeatureKey} from '@/lib/site-controls';
import {getSiteFeatures,getSiteControlState} from '@/lib/site-controls-store';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
export const dynamic='force-dynamic';
export async function GET(){const a=await getAdminAccess();if(!a||!featureCatalog.some(f=>canControl(a,'features.'+f.key)))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});return Response.json({features:await getSiteFeatures(),editable:featureCatalog.filter(f=>canControl(a,'features.'+f.key)).map(f=>f.key)},{headers:{'Cache-Control':'private, no-store'}})}
export async function PATCH(req:Request){
 const a=await getAdminAccess();if(!a||!sameOrigin(req))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 const b=await req.json().catch(()=>null) as {key?:FeatureKey;enabled?:boolean}|null;
 if(!b||!featureCatalog.some(f=>f.key===b.key)||typeof b.enabled!=='boolean')return Response.json({error:'არასწორი პარამეტრი.'},{status:400});
 if(!canControl(a,'features.'+b.key))return Response.json({error:'ამ ფუნქციის მართვის უფლება არ გაქვს.'},{status:403});
 if(b.enabled&&(await getSiteControlState()).removedFeatures.includes(b.key!))return Response.json({error:'ფუნქცია დეველოპერმა ამოიღო. ჯერ საჭიროა მისი აღდგენა.'},{status:409});
 const {DB}=storage(),now=Date.now();
 const statements=[DB.prepare(`INSERT INTO workspace_settings(key,value,updated,updated_by) VALUES('site_features',json_set('{}',?,json(?)),?,?) ON CONFLICT(key) DO UPDATE SET value=json_set(workspace_settings.value,?,json(?)),updated=excluded.updated,updated_by=excluded.updated_by`).bind('$.'+b.key,JSON.stringify(b.enabled),now,a.email,'$.'+b.key,JSON.stringify(b.enabled)),DB.prepare('INSERT INTO workspace_audit(id,actor,action,target,details,created) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),a.email,'site.feature.changed',b.key,JSON.stringify({enabled:b.enabled}),now)];
 if(!b.enabled&&['calls','teamChat','privateChats','groups'].includes(b.key!)){
  const condition=b.key==='calls'?'1=1':b.key==='teamChat'?"conversation_id='team'":b.key==='privateChats'?"conversation_id LIKE 'dm_%'":"conversation_id LIKE 'grp_%'";
  statements.push(DB.prepare('UPDATE chat_calls SET ended=? WHERE ended IS NULL AND '+condition).bind(now));
 }
 await DB.batch(statements);return Response.json({ok:true,features:await getSiteFeatures()},{headers:{'Cache-Control':'no-store'}});
}
