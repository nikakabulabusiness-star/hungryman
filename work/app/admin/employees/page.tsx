import {hasPermission} from '@/lib/permissions';
import {chatGPTSignInPath} from '@/app/chatgpt-auth';
import {getAdminAccess} from '@/lib/admin';
import {storage} from '@/lib/storage';
import {getAssignablePositions,getPositions} from '@/lib/positions';
import AdminHeader from '../admin-header';
import EmployeesManager,{type EmployeeRecord} from './employees-manager';

export const dynamic='force-dynamic';

export default async function EmployeesPage(){
 const access=await getAdminAccess();
 if(!access)return <main><h1>თანამშრომლების გვერდი</h1><a className="action" href={chatGPTSignInPath('/admin/employees')}>ავტორიზაცია</a></main>;
 if(!hasPermission(access,'employees.view'))return <main><h1>წვდომა შეზღუდულია</h1><p>თანამშრომლების მონაცემების მართვა მხოლოდ დამფუძნებელსა და HR-ს შეუძლია.</p><a href="/admin">ადმინისტრატორის პანელი</a></main>;
 let employees:EmployeeRecord[];
 try{employees=(await storage().DB.prepare('SELECT e.id,e.full_name,e.birth_date,e.personal_number,e.email,e.phone,e.position,e.created,e.updated,COALESCE((SELECT a.role FROM admin_users a WHERE lower(a.email)=lower(e.email) LIMIT 1),(SELECT t.role FROM team_members t WHERE lower(t.email)=lower(e.email) LIMIT 1)) AS account_role FROM employees e ORDER BY e.full_name').all<EmployeeRecord>()).results}
 catch{return <main><h1>თანამშრომლების მონაცემები დროებით მიუწვდომელია</h1><p>შენახული ინფორმაცია არ შეცვლილა.</p><a className="action" href="/admin/employees">სცადე ხელახლა</a></main>}
 return <main className="admin-shell"><AdminHeader access={access} active="employees" isOwner={access.isOwner} canManagePeople/><div className="admin-heading"><div><p className="eyebrow">გუნდის მართვა</p><h1>არსებული თანამშრომლები</h1><p className="lead">ბარათი გახსენი თანამშრომლის პირადი ინფორმაციის სანახავად ან შესაცვლელად.</p></div></div><EmployeesManager actor={access} canManage={hasPermission(access,'employees.manage')} canManagePositions={hasPermission(access,'positions.view')} roleMetadata={(await getPositions()).map(({name,departmentId,rank,memberships})=>({name,departmentId,rank,memberships}))} initialEmployees={employees} availableRoles={await getAssignablePositions()}/></main>;
}
