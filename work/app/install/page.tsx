import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import {isCareersBridge} from '@/lib/careers-bridge';
import {isWorkPwaHost} from '@/lib/pwa-policy';
import {PwaInstallPanel} from '@/components/pwa-runtime';
import {WebPushSettings} from '@/components/web-push-settings';

export const dynamic='force-dynamic';
export default async function InstallPage(){
 const requestHeaders=await headers(),host=new URL('https://'+(requestHeaders.get('host')||'invalid')).hostname;
 if(isCareersBridge(requestHeaders)||!isWorkPwaHost(host))notFound();
 return <main className="hm-pwa-page"><section className="hm-pwa-card"><img src="/work/pwa/icon-192.png" alt="Hungryman" width={68} height={68}/><h1>Hungryman Work</h1><p className="hm-pwa-lead">დაამატე გუნდის სამუშაო სივრცე მთავარ ეკრანზე და გახსენი ერთი შეხებით.</p><PwaInstallPanel/><WebPushSettings/></section></main>;
}
