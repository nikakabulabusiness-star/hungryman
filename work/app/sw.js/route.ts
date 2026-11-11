import {isCareersBridge} from '@/lib/careers-bridge';
import {isWorkPwaHost} from '@/lib/pwa-policy';
import {workServiceWorker} from '@/lib/work-service-worker';
import release from '@/lib/pwa-release.json';
export const dynamic='force-dynamic';
export function GET(req:Request){if(isCareersBridge(req.headers)||!isWorkPwaHost(new URL(req.url).hostname))return new Response(null,{status:404});return new Response(workServiceWorker(release.version),{headers:{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store','Service-Worker-Allowed':'/','X-Content-Type-Options':'nosniff'}})}
