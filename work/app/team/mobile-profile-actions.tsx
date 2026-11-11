'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- native navigation survives unavailable client routing. */
import {CalendarDays,Network,Smartphone} from 'lucide-react';
import LogoutButton from './logout-button';

/** Same account actions as native Profile, using the web platform's install settings. */
export default function MobileProfileActions({canLeave,canDepartments}:{canLeave:boolean;canDepartments:boolean}){
 return <div className="hm-profile-mobile-actions">
  {canLeave&&<a className="hm-profile-leave-link" href="/team/requests"><CalendarDays size={20}/>შვებულება / დეი ოფი / ბიულეტენი</a>}
  {canDepartments&&<a className="hm-profile-departments-link" href="/admin/departments"><Network size={20}/>დეპარტამენტები</a>}
  <a className="hm-profile-install-link" href="/install"><Smartphone size={20}/><span>აპი და განახლებები<small>დაყენება და შეტყობინებები</small></span></a>
  <div className="hm-profile-logout" onClickCapture={event=>{if(!window.confirm('გსურს ანგარიშიდან გასვლა?')){event.preventDefault();event.stopPropagation()}}}><LogoutButton/><span aria-hidden="true">ანგარიშიდან გასვლა</span></div>
 </div>;
}
