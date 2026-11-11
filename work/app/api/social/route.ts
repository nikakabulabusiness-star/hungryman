import {hasPermission} from '@/lib/permissions';
import {getStaffAccess} from '@/lib/staff-access';
import {storage} from '@/lib/storage';
import {sameOrigin} from '@/lib/visitor';
import {canUseSocial,safeSocialLink,socialPlatforms,socialFields,type SocialMetric} from '@/lib/social';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:Request){const access=await getStaffAccess();if(!access?.isApproved||!hasPermission(access,'social.view'))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 const year=Number(new URL(req.url).searchParams.get('year')||new Date().getUTCFullYear());if(!Number.isInteger(year)||year<2020||year>2100)return Response.json({error:'წელი არასწორია.'},{status:400});
 const db=storage().DB,[saved,metrics]=await Promise.all([db.prepare('SELECT value FROM workspace_settings WHERE key=?').bind('social.links.'+access.userId).first<{value:string}>(),db.prepare('SELECT platform,month,followers,views,likes,comments,shares,posts,source,updated FROM social_monthly_metrics WHERE month>=? AND month<=? ORDER BY month DESC,platform').bind(`${year}-01`,`${year}-12`).all<SocialMetric>()]);
 const links={instagram:'',facebook:'',tiktok:''};if(saved)try{const value=JSON.parse(saved.value);for(const p of socialPlatforms)links[p]=safeSocialLink(value[p])||''}catch{}
 return Response.json({year,links,metrics:metrics.results,connection:'not_connected'},{headers});}
export async function PUT(req:Request){const access=await getStaffAccess();if(!access?.isApproved||!hasPermission(access,'social.manage')||!sameOrigin(req))return Response.json({error:'წვდომა შეზღუდულია.'},{status:403});
 let body:Record<string,unknown>;try{body=await req.json();if(!body||typeof body!=='object')throw Error()}catch{return Response.json({error:'მონაცემები არასწორია.'},{status:400})}
 const db=storage().DB,now=Date.now();if(body.action==='links'){
  const input=body.links;if(!input||typeof input!=='object')return Response.json({error:'ბმულები არასწორია.'},{status:400});const links:Record<string,string>={};for(const p of socialPlatforms){const value=safeSocialLink((input as Record<string,unknown>)[p]);if(value===null)return Response.json({error:'მიუთითე სრული HTTPS ბმული ან დატოვე ცარიელი.'},{status:400});links[p]=value}
  await db.prepare('INSERT INTO workspace_settings (key,value,updated,updated_by) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated=excluded.updated,updated_by=excluded.updated_by').bind('social.links.'+access.userId,JSON.stringify(links),now,access.email).run();return Response.json({ok:true,links},{headers});
 }
 if(body.action!=='metrics'||!socialPlatforms.includes(body.platform as never)||typeof body.month!=='string'||!/^20(?:[2-9][0-9])-(?:0[1-9]|1[0-2])$/.test(body.month))return Response.json({error:'აირჩიე პლატფორმა და თვე.'},{status:400});
 const values:(number|null)[]=[];for(const key of socialFields){const raw=body[key];if(raw==null||raw===''){values.push(null);continue}if(typeof raw!=='number'||!Number.isSafeInteger(raw)||raw<0||raw>1e12)return Response.json({error:'მაჩვენებლები უნდა იყოს არაუარყოფითი მთელი რიცხვები.'},{status:400});values.push(raw)}
 // These are monthly totals entered from the platform's own report, never lifetime video totals.
 await db.prepare(`INSERT INTO social_monthly_metrics (platform,month,followers,views,likes,comments,shares,posts,source,updated,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(platform,month) DO UPDATE SET followers=excluded.followers,views=excluded.views,likes=excluded.likes,comments=excluded.comments,shares=excluded.shares,posts=excluded.posts,source=excluded.source,updated=excluded.updated,updated_by=excluded.updated_by`).bind(body.platform,body.month,...values,'manual',now,access.email).run();return Response.json({ok:true},{headers});}
