import {hasPermission,type PermissionActor} from './permissions';
export function canManageAbsences(actor:PermissionActor|null|undefined){return !!actor&&(actor.isDeveloper||actor.isSiteAdmin&&hasPermission(actor,'calendar.manage')||['HR','Owner','Developer'].includes(actor.role||''))}
