import html from '@/lib/careers-html';
import {addVacancies} from '@/lib/additional-vacancies';
import {getVacancyStates} from '@/lib/vacancies';
export const dynamic='force-dynamic';
export async function GET(){let page=addVacancies(html,await getVacancyStates());page=page.replace(/<a class="staff-auth-icon"[\s\S]*?<\/a>/g,'').replace('</head>','<link rel="canonical" href="https://team.hungryman.ge/"/></head>');return new Response(page,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});}
