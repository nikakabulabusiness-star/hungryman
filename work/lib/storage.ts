import {env} from 'cloudflare:workers';
export function storage(){const e=env as unknown as {DB:D1Database;BUCKET:R2Bucket};if(!e.DB||!e.BUCKET)throw Error('Storage unavailable');return e;}
