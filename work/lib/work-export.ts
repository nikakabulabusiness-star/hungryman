import {workBoards,workStageLabel,type WorkVideo,type WorkVideoDetail,type WorkSnapshot} from '@/mobile/src/lib/work-model';

/** Historical exports contain this frozen version only, never later drafts or the unrelated staff directory. */
export function workSnapshotExport(detail:WorkVideoDetail,snapshot:WorkSnapshot){
 const saved=snapshot.data,stages:WorkVideo['stages']={story:null,production:null,editing:null,social:null,technical:null};
 stages[snapshot.board]=snapshot.board==='production'||snapshot.board==='social'?'scheduled':'approved';
 const video:WorkVideo={id:detail.video.id,title:saved.title,kind:saved.kind,entryBoard:detail.video.entryBoard,stages,content:saved.content,callSheet:saved.callSheet,technical:saved.technical,approvedTechnical:saved.approvedTechnical,totals:saved.totals,version:snapshot.version,createdBy:detail.video.createdBy,created:detail.video.created,updated:snapshot.created,permissions:{editBoards:[],approve:false,remove:false},shoots:[],reviewNotes:{}};
 const selected:WorkSnapshot={id:snapshot.id,board:snapshot.board,version:snapshot.version,created:snapshot.created,actorName:snapshot.actorName,data:{title:saved.title,kind:saved.kind,content:saved.content,callSheet:saved.callSheet,technical:saved.technical,approvedTechnical:saved.approvedTechnical,totals:saved.totals}};
 const history=detail.history.filter(item=>item.version<=snapshot.version&&item.created<=snapshot.created);
 const projected:WorkVideoDetail={video,history,snapshots:[selected],meta:{boards:workBoards,editBoards:[],canApprove:false,canContacts:false,people:[],assignable:[],unlinkedShoots:[]}};
 const {permissions:_permissions,...archivedVideo}=video;
 return {detail:projected,payload:{schemaVersion:1,timeZone:'Asia/Tbilisi',moneyUnit:'tetri',source:{type:'approved-version',snapshotId:snapshot.id,version:snapshot.version,cutoff:snapshot.created,historyScope:'available-history-up-to-selected-version'},video:archivedVideo,history,snapshots:[selected]}};
}

const escapeHtml=(value:unknown)=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");
const money=(value:number)=>new Intl.NumberFormat('ka-GE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value/100)+' ₾';
const date=(value:number)=>new Date(value).toLocaleString('ka-GE',{timeZone:'Asia/Tbilisi'});
function table(headers:string[],rows:unknown[][]){return '<table><thead><tr>'+headers.map(x=>'<th>'+escapeHtml(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(x=>'<td>'+escapeHtml(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';}
function text(label:string,value:unknown){return '<div class="field"><b>'+escapeHtml(label)+'</b><p>'+escapeHtml(value||'—')+'</p></div>';}
function section(title:string,body:string){return '<section><h2>'+escapeHtml(title)+'</h2>'+body+'</section>';}

/** Escaped, standalone archive content. Callers provide local image paths when packaging a ZIP. */
export function buildWorkArchiveHtml(detail:WorkVideoDetail,options:{video?:WorkVideo;fileUrl?:(id:string)=>string}={}){
 const v=options.video||detail.video,s=v.callSheet,loc=(id:string)=>s.locations.find(x=>x.id===id)?.name||'',day=(id:string)=>s.days.find(x=>x.id===id)?.date||'',fileUrl=options.fileUrl||((id:string)=>'/api/work/files?id='+encodeURIComponent(id));
 const ids=[...new Set([v.content.coverId,...v.content.photoIds,...s.photoIds,...s.locations.flatMap(x=>x.photoIds),...v.technical.photoIds,...(v.approvedTechnical?.photoIds||[])].filter((id):id is string=>!!id))];
 const rows=s.budget.map(x=>[x.category,x.type==='service'?'სერვისი':x.type==='product'?'პროდუქტი':'ნივთი',x.label,x.quantity,money(x.unitPrice),money(Math.round(x.quantity*x.unitPrice))]);
 const equipment=(items:WorkVideo['technical']['items'])=>table(['ტექნიკა','რაოდენობა','წყარო','ერთეულის ფასი','მომწოდებელი','ნომერი','აღება','დაბრუნება','პასუხისმგებელი','მზადაა'],items.map(x=>[x.name,x.quantity,x.source==='rental'?'ქირაობა':'საკუთარი',money(x.unitPrice),x.vendor,x.phone,x.pickupAt,x.returnAt,x.responsible,x.ready?'კი':'არა']));
 const body=
 section('ვიდეო და სცენარი',text('მოკლე იდეა',v.content.summary)+text('იდეა',v.content.idea)+text('სცენარი',v.content.script)+text('საჭიროებები',v.content.requirements))+
 section('ზოგადი ინფორმაცია',text('პროდიუსერი',s.producer)+text('რეჟისორი',s.director)+text('კლიენტი',s.client)+text('ფორმატი / პლატფორმა',s.format)+text('ხანგრძლივობა',s.duration))+
 section('გადაღების დღეები',table(['თარიღი','შეკრება','კამერის დაწყება','დასრულება','დღის მიზანი','ლოკაცია','შენიშვნა'],s.days.map(x=>[x.date,x.callTime,x.cameraTime,x.endTime,x.goal,loc(x.locationId),x.notes])))+
 section('განრიგი და სცენები',table(['სცენა','დღე','მოსვლა','კამერა','დასრულება','ლოკაცია','სივრცე','განათება','გუნდი','აღწერა','რეკვიზიტი','ეფექტები'],s.scenes.map(x=>[x.title,day(x.dayId),x.arrivalTime,x.cameraTime,x.endTime,loc(x.locationId),x.interior,x.light,x.crewIds.map(id=>s.crew.find(p=>p.id===id)?.name||'').join(', '),x.description,x.props,x.effects])))+
 section('გუნდი',table(['სახელი','თანამშრომელი','პოზიცია','დავალება','ნომერი','ელფოსტა','მოსვლა','დღეები'],s.crew.map(x=>[x.name,x.userId?'შიდა':'გარე',x.role,x.task,x.phone,x.email,x.callTime,x.dayIds.map(day).join(', ')])))+
 section('ლოკაციები',table(['სახელი','მისამართი','რუკა','კოორდინატები','საკონტაქტო პირი','ნომერი','პარკინგი','წვდომა'],s.locations.map(x=>[x.name,x.address,x.mapUrl,[x.latitude,x.longitude].filter(n=>n!==null).join(', '),x.contactName,x.contactPhone,x.parking,x.access])))+
 section('საჭიროებები',table(['კატეგორია','აღწერა','პასუხისმგებელი','შესრულებული'],s.needs.map(x=>[x.category,x.description,x.responsible,x.done?'კი':'არა'])))+
 section('ბიუჯეტი',table(['კატეგორია','ტიპი','ხარჯი','რაოდენობა','ერთეულის ფასი','ჯამი'],rows)+text('ქოლშითის თანხა',money(v.totals.base))+text('დამტკიცებული ტექნიკა',money(v.totals.technicalApproved))+text('ტექნიკა — დამტკიცების მოლოდინში (ჯამში არ შედის)',money(v.totals.technicalPending))+text('საერთო თანხა',money(v.totals.grandTotal)))+
 section('მიმდინარე ტექნიკური გეგმა',equipment(v.technical.items)+text('შენიშვნა',v.technical.notes))+
 section('დამტკიცებული ტექნიკური გეგმა',v.approvedTechnical?equipment(v.approvedTechnical.items)+text('შენიშვნა',v.approvedTechnical.notes):'<p>დამტკიცებული ტექნიკური გეგმა ჯერ არ არის.</p>')+
 section('შენიშვნები და უსაფრთხოება',text('საერთო შენიშვნები',s.notes)+text('დეპარტამენტების შენიშვნები',s.departmentNotes)+text('კვება',s.catering)+text('რადიოარხები',s.radioChannels)+text('საგანგებო კონტაქტები',s.emergency)+text('ამინდი',s.weather)+text('დღის სინათლე',s.daylight)+text('პირველი სარეზერვო ასლი',s.backupPrimary?'დასრულებული':'არ არის მონიშნული')+text('მეორე სარეზერვო ასლი',s.backupSecondary?'დასრულებული':'არ არის მონიშნული'))+
 section('ფოტოები',ids.length?ids.map(id=>'<figure><img src="'+escapeHtml(fileUrl(id))+'" alt="გადაღების ფოტო"><figcaption>'+escapeHtml(id)+'</figcaption></figure>').join(''):'<p>ფოტოები არ არის.</p>')+
 section('დეპარტამენტების ეტაპები',table(['დეპარტამენტი','ეტაპი'],workBoards.filter(b=>v.stages[b.id]).map(b=>[b.label,workStageLabel(b.id,v.stages[b.id])])))+
 section('ცვლილებების ისტორია',table(['დრო','დეპარტამენტი','მოქმედება','ვერსია','ავტორი','კომენტარი'],detail.history.map(x=>[date(x.created),workBoards.find(b=>b.id===x.board)?.label||x.board,x.action,x.version,x.actorName,x.comment])))+
 section('დამტკიცებული ვერსიები',detail.snapshots.map(x=>'<details><summary>'+escapeHtml((workBoards.find(b=>b.id===x.board)?.label||x.board)+' · v'+x.version+' · '+date(x.created)+' · '+x.actorName)+'</summary><pre>'+escapeHtml(JSON.stringify(x.data,null,2))+'</pre></details>').join('')||'<p>დამტკიცებული ვერსია არ არის.</p>');
 return '<!doctype html><html lang="ka"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+escapeHtml(v.title)+' — Hungryman Work</title><style>body{font-family:Arial,sans-serif;background:#fff;color:#17202a;margin:32px;font-size:13px;line-height:1.6}h1{font-size:28px}h2{font-size:20px;border-bottom:2px solid #f6465a;padding-bottom:8px}section{margin:28px 0;break-inside:auto}.field{margin:12px 0}.field b{color:#475569}.field p{margin:3px 0;white-space:pre-wrap;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;font-size:11px;table-layout:auto}td,th{border:1px solid #cbd5e1;padding:8px;text-align:left;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap}th{background:#eef2f6}figure{display:inline-block;max-width:45%;margin:10px}img{max-width:100%;max-height:350px;object-fit:contain}figcaption{font-size:10px;color:#64748b}pre{font-size:10px;white-space:pre-wrap;overflow-wrap:anywhere}summary{padding:8px;font-weight:bold}small{color:#64748b}@media print{body{margin:0;font-size:11px}h1{font-size:22px}h2{font-size:16px}tr,figure{break-inside:avoid}thead{display:table-header-group}details>*{display:block!important}summary{list-style:none}a{color:inherit}}</style></head><body><small>HUNGRYMAN WORK · '+escapeHtml(v.id)+' · ვერსია '+v.version+'</small><h1>'+escapeHtml(v.title)+'</h1><p>'+escapeHtml(v.kind==='short'?'Shorts / სოციალური მედია':'ვიდეო')+' · '+escapeHtml(date(v.updated))+'</p>'+body+'</body></html>';
}

/** UTF-8 BOM and formula-safe cells make this suitable for Excel without executable CSV formulas. */
export function buildWorkBudgetCsv(v:WorkVideo){
 const safe=(value:unknown)=>{let valueString=String(value??'');if(/^[=+\-@\t\r]/.test(valueString))valueString="'"+valueString;return '"'+valueString.replaceAll('"','""')+'"';};
 const rows:unknown[][]=[['კატეგორია','ტიპი','დასახელება','რაოდენობა','ერთეულის ფასი (GEL)','ჯამი (GEL)','სტატუსი']];
 for(const x of v.callSheet.budget)rows.push([x.category,x.type==='service'?'სერვისი':x.type==='product'?'პროდუქტი':'ნივთი',x.label,x.quantity,(x.unitPrice/100).toFixed(2),(Math.round(x.quantity*x.unitPrice)/100).toFixed(2),'ქოლშითი']);
 for(const x of v.approvedTechnical?.items||[])if(x.source==='rental')rows.push(['ტექნიკა','ქირაობა',x.name,x.quantity,(x.unitPrice/100).toFixed(2),(Math.round(x.quantity*x.unitPrice)/100).toFixed(2),'დამტკიცებული']);
 rows.push(['','','ქოლშითი','','',(v.totals.base/100).toFixed(2),''],['','','დამტკიცებული ტექნიკა','','',(v.totals.technicalApproved/100).toFixed(2),''],['','','საერთო ჯამი','','',(v.totals.grandTotal/100).toFixed(2),''],['','','ტექნიკა მოლოდინში (ჯამში არ შედის)','','',(v.totals.technicalPending/100).toFixed(2),'მოლოდინში']);
 return '\uFEFF'+rows.map(row=>row.map(safe).join(',')).join('\r\n');
}
