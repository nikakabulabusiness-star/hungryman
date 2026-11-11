import runtime from '@/mobile/personal-runtime.json';
import app from '@/mobile/app.json';
export const dynamic='force-dynamic';
/** Public release metadata only; no user data or signing credentials. */
export async function GET(){
 return Response.json({schema:1,platform:'ios',channel:runtime.channel,runtimeVersion:runtime.runtimeVersion,version:app.expo.version,replaces:runtime.previousRuntimeVersions},{headers:{'Cache-Control':'no-store'}});
}
