import {storage} from './storage';
import {parseFeatures,parseFeatureState} from './site-controls';
export async function getSiteFeatures(){const row=await storage().DB.prepare("SELECT value FROM workspace_settings WHERE key='site_features'").first<{value:string}>();return parseFeatures(row?.value)}
export async function getSiteControlState(){
 const {DB}=storage();
 const [row,history]=await Promise.all([
  DB.prepare("SELECT value,updated FROM workspace_settings WHERE key='site_features'").first<{value:string;updated:number}>(),
  DB.prepare("SELECT action,target,created FROM workspace_audit WHERE action IN ('site.function.removed','site.function.restored') ORDER BY created DESC,id DESC LIMIT 100").all<{action:string;target:string;created:number}>(),
 ]);
 return {...parseFeatureState(row?.value),revision:row?.updated||0,history:history.results};
}
