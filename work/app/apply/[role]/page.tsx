import {getAdminAccess} from '@/lib/admin';
import {hasPermission} from '@/lib/permissions';
import {notFound} from 'next/navigation';
import ApplicationForm from '../../application-form';
import {roles,type Role} from '@/lib/questions';
import {getVacancyStates} from '@/lib/vacancies';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{role:string}>}){const {role}=await params;if(!Object.hasOwn(roles,role))notFound();const vacancy=(await getVacancyStates())[role as Role];if(!vacancy.accepting)return <main><header className="top"><a className="brand" href="/">HUNGRY<span>MAN</span></a></header><section className="panel success"><h1>განაცხადების მიღება დასრულებულია</h1><p>{roles[role as Role]}{vacancy.deadline?' · ბოლო ვადა იყო '+vacancy.deadline:''}</p><a className="action" href="/">სხვა ვაკანსიების ნახვა</a></section></main>;return <ApplicationForm role={role as Role} isAdmin={hasPermission(await getAdminAccess(),'applications.edit')} key={role}/>;}
