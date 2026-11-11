import {env} from 'cloudflare:workers';
export function isCareersBridge(h:Headers){const secret=(env as unknown as {CAREERS_BRIDGE_SECRET?:string}).CAREERS_BRIDGE_SECRET;return !!secret&&h.get('x-hm-careers-key')===secret;}
export function isPublicCareersPath(path:string){return /^\/api\/(applications(?:\/[0-9a-f-]{36}\/rating)?|events|presence)$/.test(path);}
