import {emptyCallSheet,emptyTechnical,emptyWorkContent,type WorkCallSheet,type WorkContent,type WorkTechnical,type WorkBudgetTotals,type WorkPerson} from '@/mobile/src/lib/work-model';
import {WorkError} from './work-policy';
import {publicRole} from './site-controls';
function fail(message='შევსებული მონაცემები არასწორია.'):never{throw new WorkError(400,message)}
const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:fail();
function text(v:unknown,max=1000){if(v==null)return '';if(typeof v!=='string'||v.length>max||/[\u0000]/.test(v))fail('ტექსტის ზომა ან ფორმატი არასწორია.');return v.trim()}
function list(v:unknown,max=100):unknown[]{if(v==null)return [];if(!Array.isArray(v)||v.length>max)fail('ჩანაწერების დასაშვები რაოდენობა გადაჭარბებულია.');return v}
function id(v:unknown){const s=text(v,80);if(!/^[A-Za-z0-9_-]{1,80}$/.test(s))fail('ჩანაწერის ID არასწორია.');return s}
function ids(v:unknown,max=40){return [...new Set(list(v,max).map(id))]}
export function fileId(v:unknown){const s=text(v,36);if(!/^[a-f\d-]{36}$/i.test(s))fail('ფოტოს ID არასწორია.');return s}
function files(v:unknown){return [...new Set(list(v,24).map(fileId))]}
function choice<T extends string>(v:unknown,choices:readonly T[],fallback:T):T{return v==null?fallback:choices.includes(v as T)?v as T:fail()}
function number(v:unknown,min:number,max:number,integer=false){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||integer&&!Number.isInteger(v))fail('თანხა ან რაოდენობა არასწორია.');return v}
function boolean(v:unknown){if(v==null)return false;if(typeof v!=='boolean')fail();return v}
export function validWorkDate(v:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v}
function date(v:unknown){const s=text(v,10);if(s&&!validWorkDate(s))fail('თარიღი არასწორია.');return s}
function time(v:unknown){const s=text(v,5);if(s&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(s))fail('დრო არასწორია.');return s}
function dateTime(v:unknown){const s=text(v,30);if(s&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?$/.test(s)||!validWorkDate(s.slice(0,10))||!Number.isFinite(Date.parse(s))))fail('აღების ან დაბრუნების დრო არასწორია.');return s}
function url(v:unknown){const s=text(v,2000);if(s){try{if(!['https:','http:'].includes(new URL(s).protocol))fail()}catch{fail('ბმული არასწორია.')}}return s}
function unique<T extends {id:string}>(rows:T[]):T[]{if(new Set(rows.map(r=>r.id)).size!==rows.length)fail('ჩანაწერის ID მეორდება.');return rows}
export function cleanWorkContent(value:unknown,current=emptyWorkContent()):WorkContent{const v=record(value);return {...current,...(Object.hasOwn(v,'scriptHtml')?{scriptHtml:text(v.scriptHtml,240000)}:Object.hasOwn(v,'script')&&v.script!==current.script?{scriptHtml:''}:{}),...Object.fromEntries(['summary','idea','script','requirements'].filter(k=>Object.hasOwn(v,k)).map(k=>[k,text(v[k],k==='summary'?500:k==='script'?100000:20000)])),...(Object.hasOwn(v,'coverId')?{coverId:v.coverId?fileId(v.coverId):null}:{}),...(Object.hasOwn(v,'photoIds')?{photoIds:files(v.photoIds)}:{})}}
export function cleanWorkCallSheet(value:unknown,people:WorkPerson[]):WorkCallSheet{
 const v=record(value),base=emptyCallSheet();
 const result:WorkCallSheet={...base,...Object.fromEntries(['producer','director','client','format','duration','notes','departmentNotes','catering','radioChannels','emergency','weather','daylight'].map(k=>[k,text(v[k],['notes','departmentNotes'].includes(k)?20000:2000)])),backupPrimary:boolean(v.backupPrimary),backupSecondary:boolean(v.backupSecondary),photoIds:files(v.photoIds),
 days:unique(list(v.days,12).map(raw=>{const r=record(raw);return{id:id(r.id),date:date(r.date),callTime:time(r.callTime),cameraTime:time(r.cameraTime),endTime:time(r.endTime),goal:text(r.goal,2000),locationId:r.locationId?id(r.locationId):'',notes:text(r.notes,4000)}})),
 crew:unique(list(v.crew,80).map(raw=>{const r=record(raw),userId=r.userId?id(r.userId):null,p=userId?people.find(p=>p.userId===userId):null;if(userId&&!p)fail('თანამშრომელი აქტიურ გუნდში ვერ მოიძებნა.');return{id:id(r.id),userId,name:p?.name||text(r.name,180),role:text(r.role,180)||(p?publicRole(p.role):''),task:text(r.task,2000)||(p?publicRole(p.role):''),phone:text(r.phone,80),email:p?.email||text(r.email,254),callTime:time(r.callTime),dayIds:ids(r.dayIds,12)}})),
 locations:unique(list(v.locations,30).map(raw=>{const r=record(raw);return{id:id(r.id),name:text(r.name,200),address:text(r.address,1000),mapUrl:url(r.mapUrl),latitude:r.latitude==null?null:number(r.latitude,-90,90),longitude:r.longitude==null?null:number(r.longitude,-180,180),contactName:text(r.contactName,180),contactPhone:text(r.contactPhone,80),parking:text(r.parking,3000),access:text(r.access,3000),photoIds:files(r.photoIds)}})),
 scenes:unique(list(v.scenes,100).map(raw=>{const r=record(raw);return{id:id(r.id),title:text(r.title,200),description:text(r.description,8000),dayId:r.dayId?id(r.dayId):'',arrivalTime:time(r.arrivalTime),cameraTime:time(r.cameraTime),endTime:time(r.endTime),locationId:r.locationId?id(r.locationId):'',crewIds:ids(r.crewIds,80),interior:choice(r.interior,['INT','EXT'],'INT'),light:choice(r.light,['DAY','NIGHT'],'DAY'),props:text(r.props,3000),effects:text(r.effects,3000)}})),
 needs:unique(list(v.needs,150).map(raw=>{const r=record(raw);return{id:id(r.id),category:text(r.category,120),description:text(r.description,3000),responsible:text(r.responsible,180),done:boolean(r.done)}})),
 budget:unique(list(v.budget,150).map(raw=>{const r=record(raw);return{id:id(r.id),category:text(r.category,120)||'სხვა',type:choice(r.type,['item','product','service'],'item'),label:text(r.label,250),quantity:number(r.quantity,0.001,10000),unitPrice:number(r.unitPrice,0,100000000,true)}}))};
 const dayIds=new Set(result.days.map(d=>d.id)),locationIds=new Set(result.locations.map(d=>d.id)),crewIds=new Set(result.crew.map(d=>d.id));
 for(const row of result.days)if(row.locationId&&!locationIds.has(row.locationId))fail('გადაღების დღის ლოკაცია ვერ მოიძებნა.');
 for(const row of result.crew)if(row.dayIds.some(day=>!dayIds.has(day)))fail('გუნდის წევრის გადაღების დღე ვერ მოიძებნა.');
 for(const row of result.scenes)if(row.dayId&&!dayIds.has(row.dayId)||row.locationId&&!locationIds.has(row.locationId)||row.crewIds.some(id=>!crewIds.has(id)))fail('სცენის დღე, ლოკაცია ან მონაწილე ვერ მოიძებნა.');
 for(const location of result.locations)if((location.latitude===null)!==(location.longitude===null))fail('ლოკაციის ორივე კოორდინატი შეავსე.');
 return result;
}
export function cleanWorkTechnical(value:unknown):WorkTechnical{const v=record(value);return {notes:text(v.notes,20000),photoIds:files(v.photoIds),items:unique(list(v.items,150).map(raw=>{const r=record(raw),pickupAt=dateTime(r.pickupAt),returnAt=dateTime(r.returnAt);if(pickupAt&&returnAt&&Date.parse(returnAt)<Date.parse(pickupAt))fail('დაბრუნების დრო აღების დროზე ადრე ვერ იქნება.');return {id:id(r.id),name:text(r.name,200),quantity:number(r.quantity,0.001,10000),source:choice(r.source,['owned','rental'],'owned'),unitPrice:number(r.unitPrice,0,100000000,true),vendor:text(r.vendor,200),phone:text(r.phone,80),pickupAt,returnAt,responsible:text(r.responsible,180),ready:boolean(r.ready)}}))}}
export function workFileIds(content:WorkContent,sheet:WorkCallSheet,technical:WorkTechnical){const result=[...new Set([...(content.coverId?[content.coverId]:[]),...content.photoIds,...sheet.photoIds,...sheet.locations.flatMap(l=>l.photoIds),...technical.photoIds])];if(result.length>80)fail('ერთ ვიდეოზე მაქსიმუმ 80 ფოტოს შენახვაა შესაძლებელი.');return result}
export function workBudgetTotals(sheet:WorkCallSheet,technical:WorkTechnical,approved:WorkTechnical|null):WorkBudgetTotals{
 const categories=new Map<string,number>();for(const row of sheet.budget){const total=Math.round(row.quantity*row.unitPrice);categories.set(row.category,(categories.get(row.category)||0)+total)}
 const sum=(items:WorkTechnical['items'])=>items.filter(r=>r.source==='rental').reduce((n,r)=>n+Math.round(r.quantity*r.unitPrice),0),base=[...categories.values()].reduce((a,b)=>a+b,0),technicalApproved=sum(approved?.items||[]),technicalPending=JSON.stringify(technical)!==JSON.stringify(approved)?sum(technical.items):0;
 if(!Number.isSafeInteger(base+technicalApproved)||base+technicalApproved>100000000000)fail('ჯამური ბიუჯეტი დასაშვებ ზღვარს აღემატება.');
 return {currency:'GEL',base,technicalApproved,technicalPending,grandTotal:base+technicalApproved,categories:[...categories].map(([name,total])=>({name,total}))};
}
export function assertWorkSchedule(sheet:WorkCallSheet){
 if(!sheet.days.length)fail('დაამატე გადაღების თარიღი და დრო.');
 for(const day of sheet.days){if(!day.date||!day.callTime||!day.cameraTime||!day.endTime)fail('ყოველ დღეს შეავსე თარიღი, შეკრების, კამერისა და დასრულების დრო.');if(day.cameraTime<day.callTime||day.endTime<=day.cameraTime)fail('კამერა შეკრების შემდეგ, დასრულება კი კამერის შემდეგ უნდა იყოს.');if(!day.locationId)fail('ყოველი დღის ლოკაცია მიუთითე.')}
 if(!sheet.crew.length||sheet.crew.some(p=>!p.name||!p.role))fail('შეავსე გადაღების გუნდი და მონაწილეების პოზიციები.');
 for(const line of sheet.budget)if(!line.label)fail('ბიუჯეტის ყველა ხარჯს დასახელება სჭირდება.');
}
export function cleanWorkTitle(v:unknown){const s=text(v,160);if(!s)fail('მიუთითე ვიდეოს სათაური.');return s}
export function cleanWorkComment(v:unknown){return text(v,4000)}
