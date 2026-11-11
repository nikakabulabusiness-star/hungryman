import {eachDate,validIsoDate} from './staff-calendar';

// Publish this year's occurrence, never the employee's birth year or private fields.
export function birthdayEvents(people:{id:string;full_name:string;birth_date:string}[],from:string,to:string){
 const dates=eachDate(from,to);
 return people.flatMap(person=>{
  if(!validIsoDate(person.birth_date))return [];
  const monthDay=person.birth_date.slice(5);
  return dates.filter(date=>date.slice(5)===monthDay||(monthDay==='02-29'&&date.slice(5)==='02-28'&&!validIsoDate(date.slice(0,4)+'-02-29'))).map(date=>({
   id:`birthday-${person.id}-${date}`,kind:'birthday',title:`${person.full_name} — დაბადების დღე`,start_date:date,end_date:date,
   employee_name:person.full_name,employee_email:null,recurring_yearly:0,visibility:'all',start_time:null,end_time:null,duration_minutes:null,
  }));
 });
}
