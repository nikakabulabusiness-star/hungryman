import {hasPermission,type PermissionActor} from './permissions';

export function workTabs(actor:PermissionActor){
 return [
  {id:'home',href:'/work',label:'მთავარი',show:hasPermission(actor,'workspace.view')},
  {id:'shoots',href:'/shoots',label:'გადაღებები',show:hasPermission(actor,'shoots.view')},
  {id:'chat',href:'/chat',label:'ჩატი',show:hasPermission(actor,'chat.view')},
  {id:'team',href:'/team',label:'კაბინეტი',show:hasPermission(actor,'cabinet.view')},
  {id:'manage',href:'/work/manage',label:'მართვა',show:hasPermission(actor,'admin.view')||hasPermission(actor,'youtube.view')},
 ].filter(tab=>tab.show);
}
export function isWorkRoute(path:string){
 path=path.replace(/\/$/,'')||'/';
 return path==='/work'||path==='/work/tasks'||path.startsWith('/work/tasks/')||path==='/work/manage'||path==='/work/calendar'||path==='/shoots'||path==='/chat'||path==='/team'||path.startsWith('/team/')&&!path.startsWith('/team/auth')||path==='/admin'||path.startsWith('/admin/');
}
export function workTabForPath(path:string){
 path=path.replace(/\/$/,'')||'/';
 return path==='/work'||path==='/work/tasks'||path.startsWith('/work/tasks/')||path==='/work/calendar'?'home':path==='/shoots'?'shoots':path==='/chat'?'chat':path.startsWith('/admin')||path==='/work/manage'?'manage':'team';
}
