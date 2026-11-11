'use client';
import {useState} from 'react';
import {ArrowUpRight,Download,FileText} from 'lucide-react';
import './shoot-work-details.css';

/** Uses the frozen approved shoot snapshot, never the current unsent draft. */
export default function ShootWorkDetails({shootId,videoId}:{shootId:string;videoId:string}){
 const [open,setOpen]=useState(false);
 const source='/api/work/videos/'+encodeURIComponent(videoId)+'/export?shoot='+encodeURIComponent(shootId);
 return <section className="hm-shoot-work-record">
  <a className="hm-shoot-work-track" href={'/work/tasks/video/'+encodeURIComponent(videoId)}><span>Work · ვიდეოს ყველა ეტაპი</span><ArrowUpRight size={18}/></a>
  <details open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
   <summary><FileText size={19}/>დამტკიცებული ქოლშითი, ტექნიკა და ბიუჯეტი</summary>
   {open&&<><p>გადაღებაზე დამტკიცებული ინფორმაცია. ახალი სამუშაო მონახაზი ამ ჩანაწერს არ ცვლის.</p><div className="hm-shoot-work-downloads"><a href={source+'&format=html'} target="_blank" rel="noopener noreferrer">სრულად გახსნა / ბეჭდვა</a><a href={source+'&format=zip'} download><Download size={16}/>სრული არქივი</a></div><iframe title="გადაღების დამტკიცებული ქოლშითი" src={source+'&format=html'} loading="lazy" sandbox="allow-same-origin allow-modals"/></>}
  </details>
 </section>;
}
