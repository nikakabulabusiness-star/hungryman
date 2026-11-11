'use client';
import {MessageCircle} from 'lucide-react';

// One shared dock serves both header buttons and the floating launcher.
export default function ChatWidget({active=false}:{active?:boolean}){
 return <button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('hmw:open-chat'))} className={`staff-chat-trigger grid size-11 place-items-center rounded-full border border-sky-300/30 bg-[#082238]/95 text-sky-50 shadow-lg shadow-black/25 transition hover:border-sky-300/60 hover:bg-[#0d3451] ${active?'active':''}`} aria-current={active?'page':undefined} aria-label="ჩატის გახსნა" title="ჩატი"><MessageCircle className="size-5"/></button>;
}
