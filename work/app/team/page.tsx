import {roleLabel} from '@/lib/department-directory';
import {hasPermission} from '@/lib/permissions';
import {SocialShortcuts} from '@/components/social-workspace';
import {CabinetPanel,LeaveRequestCard} from '@/components/cabinet-panel';
import {AttendanceSummary} from '@/components/work-notifications';
/* eslint-disable @next/next/no-html-link-for-pages -- keep a native fallback independent of Vinext hydration. */
import {requireSessionUser} from '@/lib/staff-auth';
import {getStaffAccess,syncStaffProfile} from '@/lib/staff-access';
import {getNextShoot} from '@/lib/shoots';
import StaffCalendar from './staff-calendar';
import ProfileCard from './profile-card';
import StaffHeader from './staff-header';
import LogoutButton from './logout-button';
import './cabinet-home.css';
import CabinetMascot from '@/components/cabinet-mascot';
import MobileProfileActions from './mobile-profile-actions';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const user = await requireSessionUser('/team');
  const access = await getStaffAccess();
  const fullName = user.fullName || user.email;

  if(!access?.isApproved){const suspended=access?.status==='suspended';return <main className="staff-shell"><header className="staff-brandbar"><a className="brand" href="/">HUNGRY<span>MAN</span></a><nav><LogoutButton/></nav></header><section className="staff-state-card"><p className="eyebrow">{suspended?'ანგარიშის სტატუსი':'რეგისტრაციის მოთხოვნა'}</p><h1>{fullName}</h1><p className={`role-chip ${suspended?'suspended':'pending'}`}>{suspended?'წვდომა შეჩერებულია':'დადასტურების მოლოდინში'}</p><p className="lead">{suspended?'ანგარიშის წვდომა შეჩერებულია. დეტალებისთვის დაუკავშირდი HR-ს.':'ანგარიში შექმნილია. პირადი კაბინეტი, კალენდარი და საერთო ჩატი სტატუსის მინიჭების შემდეგ გააქტიურდება.'}</p></section></main>}

  if(!hasPermission(access,'cabinet.view'))return <main className='staff-shell'><StaffHeader access={access} active='team'/><section className='staff-state-card'><h1>შენი სამუშაო სივრცე</h1><p>პირადი კაბინეტის ნახვა ამ შტატისთვის გამორთულია. გამოიყენე მენიუში ხელმისაწვდომი გვერდები.</p></section></main>;
  const [profile,nextShoot]=await Promise.all([syncStaffProfile(access,{touch:true}),getNextShoot()]);
  return (
    <main className="staff-shell cabinet-home">
      <StaffHeader active="team" access={profile} nextShoot={nextShoot?{id:nextShoot.id,title:nextShoot.title,shootDate:nextShoot.shoot_date,startTime:nextShoot.start_time}:null}/>
      <section className="staff-hero"><div><p className="eyebrow">პირადი კაბინეტი</p><h1>{profile.fullName}</h1><p className="role-chip">{roleLabel(profile.role)}</p></div></section>
      <div className="staff-grid"><div className="work-stack"><ProfileCard profile={{userId:profile.userId,fullName:profile.fullName,role:profile.role,email:profile.email,hasAvatar:profile.hasAvatar,profileUpdated:profile.profileUpdated,developerMode:profile.isDeveloper}}/>{profile.features?.attendance!==false&&<div className="hm-profile-attendance"><AttendanceSummary/></div>}<div className="hm-profile-balance"><CabinetPanel/></div>{hasPermission(profile,'social.view')&&<div className="hm-profile-social"><SocialShortcuts canManage={hasPermission(profile,'social.manage')}/></div>}{hasPermission(profile,'cabinet.leave.request')&&<div className="hm-profile-desktop-leave"><LeaveRequestCard/></div>}</div>{hasPermission(profile,'calendar.view')&&<StaffCalendar/>}<MobileProfileActions canLeave={hasPermission(profile,'cabinet.leave.request')} canDepartments={hasPermission(profile,'departments.view')}/></div>
      {profile.features?.mascot!==false&&<CabinetMascot/>}
    </main>
  );
}
