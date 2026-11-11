import {getSiteFeatures} from '@/lib/site-controls-store';
export const dynamic='force-dynamic';
export async function GET(){return Response.json({registration:(await getSiteFeatures()).registration},{headers:{'Cache-Control':'no-store'}})}
