import {notFound} from 'next/navigation';
import {requireApprovedStaff} from '@/lib/staff-access';
import {canManageAbsences} from '@/lib/absence-policy';
import StaffHeader from '@/app/team/staff-header';
import AbsencesClient from './absences-client';
import './absences.css';
export const dynamic='force-dynamic';
export default async function AbsencesPage(){
 const access=await requireApprovedStaff('/admin/absences');if(!canManageAbsences(access))notFound();
 return <main className="staff-shell"><StaffHeader access={access} active="admin"/><section className="absences-page"><header><div><p className="eyebrow">გუნდის მართვა</p><h1>შვებულებები და ბიულეტენები</h1><p>ვინ არის შვებულებაში, დეი ოფზე ან ბიულეტენზე — თარიღები და ისტორია.</p></div><a className="work-secondary" href="/admin/time-off">შემოსული მოთხოვნები ↗</a></header><AbsencesClient/></section></main>;
}
