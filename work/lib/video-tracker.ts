import type {WorkVideo} from '@/mobile/src/lib/work-model';
export const defaultStatuses=['სცენარი','გადაღება','გადაღებულია','არქივშია','მონტაჟი','მზადაა','Finish'];
export type TrackerSettings={order:string[];statuses:string[];version:number};
export function videoStatus(v:WorkVideo){
 if(v.content.tracker?.status)return v.content.tracker.status;
 if(v.stages.editing==='done'||v.stages.social==='done')return 'მზადაა';
 if(v.stages.editing==='editing')return 'მონტაჟი';
 if(v.stages.production==='filmed'||v.stages.editing)return 'გადაღებულია';
 return v.stages.production||v.stages.technical?'გადაღება':'სცენარი';
}
