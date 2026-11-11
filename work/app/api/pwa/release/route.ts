import {isCareersBridge} from '@/lib/careers-bridge';
import {isWorkPwaHost} from '@/lib/pwa-policy';
import release from '@/lib/pwa-release.json';
export const dynamic='force-dynamic';
export function GET(req:Request){if(isCareersBridge(req.headers)||!isWorkPwaHost(new URL(req.url).hostname))return new Response(null,{status:404});return Response.json(release,{headers:{'Cache-Control':'no-store'}})}
