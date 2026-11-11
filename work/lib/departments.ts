import {storage} from '@/lib/storage';
import {departmentDefinitions,founderLabel,type Department} from '@/lib/department-directory';
export * from '@/lib/department-directory';
export async function getDepartments():Promise<Department[]>{
 const rows=(await storage().DB.prepare('SELECT id,name,sort_order,head_name,director_name,description,head_user_id,director_user_id FROM staff_departments ORDER BY sort_order,name').all<{id:string;name:string;sort_order:number;head_name:string;director_name:string;description:string;head_user_id:string|null;director_user_id:string|null}>()).results;
 return rows.filter(row=>departmentDefinitions.some(d=>d.id===row.id)).map(row=>({id:row.id,name:row.name,order:row.sort_order,headName:founderLabel,directorName:row.director_name,description:row.description,headUserId:row.head_user_id,directorUserId:row.director_user_id}));
}
