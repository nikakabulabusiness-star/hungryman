import {isCareersBridge} from '@/lib/careers-bridge';
import {isWorkPwaHost,WORK_PWA_MANIFEST} from '@/lib/pwa-policy';
export const dynamic='force-dynamic';
export function GET(req:Request){if(isCareersBridge(req.headers)||!isWorkPwaHost(new URL(req.url).hostname))return new Response(null,{status:404});return Response.json(WORK_PWA_MANIFEST,{headers:{'Content-Type':'application/manifest+json; charset=utf-8','Cache-Control':'no-cache'}})}
