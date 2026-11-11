import {getSiteFeatures} from '@/lib/site-controls-store';
/* eslint-disable @next/next/no-html-link-for-pages -- keep a native fallback independent of Vinext hydration. */
import {getSessionUser} from '@/lib/staff-auth';
import { redirect } from 'next/navigation';
import StaffAuthForm from './auth-form';
import WorkMascot from './mascot';
import './auth.css';

export const dynamic = 'force-dynamic';

export default async function StaffAuthPage() {
  if (await getSessionUser()) redirect('/team');
  const {registration}=await getSiteFeatures();

  return (
    <main className="work-entry">
      <div className="work-entry-backdrop" aria-hidden="true"/>
      <header className="work-entry-header">
        <a className="work-entry-wordmark" href="/" aria-label="ჰანგრიმენი — სამუშაო სივრცე">HUNGRY<span>MAN</span><small>სამუშაო სივრცე</small></a>
        <a href="https://hungryman.ge" className="work-entry-home">მთავარი საიტი <span aria-hidden="true">↗</span></a>
      </header>
      <div className="work-entry-content">
        <WorkMascot/>
        <section className="staff-auth-card work-entry-card" aria-labelledby="work-entry-title">
          <div className="staff-auth-copy">
            <p className="eyebrow"><span/> გუნდის სივრცე</p>
            <h1 id="work-entry-title">შენი სამუშაო სივრცე</h1>
            <p>{registration?'შედი ანგარიშზე ან გაიარე რეგისტრაცია.':'შედი შენს ანგარიშზე.'}</p>
          </div>
          <StaffAuthForm registration={registration}/>
          <p className="work-entry-note">ახალი ანგარიშის გააქტიურებას ადმინისტრატორის დამტკიცება სჭირდება.</p>
        </section>
      </div>
      <footer className="work-entry-footer"><span>ჰანგრიმენი · გუნდის სამუშაო სივრცე</span><a href="https://team.hungryman.ge">ვაკანსიები <span aria-hidden="true">↗</span></a></footer>
    </main>
  );
}
