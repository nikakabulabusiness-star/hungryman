'use client';

import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import './cabinet-mascot.css';

type Pose='idle'|'walk'|'sit'|'shawarma'|'chips'|'jump'|'climb'|'hang'|'held'|'fall'|'land';
type Point={x:number;y:number};
const ART='/work/mascot/hungryman-full.webp';
const HEAD='M276 0H720V194H676V480L574 516L489 536L380 499L294 470Z';

/** A small, local-only desktop companion. No data, credentials or pointer positions leave the page. */
export default function CabinetMascot(){
 const uid=useId().replace(/:/g,'');
 const rootRef=useRef<HTMLDivElement>(null),bodyRef=useRef<HTMLButtonElement>(null),position=useRef<Point|null>(null),groundRef=useRef<number|null>(null);
 const [desktop,setDesktop]=useState(false),[reduced,setReduced]=useState(false),[hidden,setHidden]=useState(true),[paused,setPaused]=useState(false);

 useEffect(()=>{
  groundRef.current=innerHeight;
  const desktopQuery=matchMedia('(min-width: 1000px) and (pointer: fine)'),motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
  const update=()=>{setDesktop(desktopQuery.matches);setReduced(motionQuery.matches);};update();
  // Deliberately start disabled on every page mount, regardless of older saved preferences.
  desktopQuery.addEventListener('change',update);motionQuery.addEventListener('change',update);
  return()=>{desktopQuery.removeEventListener('change',update);motionQuery.removeEventListener('change',update);};
 },[]);

 useEffect(()=>{
  const root=rootRef.current,body=bodyRef.current;
  if(!desktop||hidden||!root||!body)return;
  let timer:ReturnType<typeof setTimeout>|undefined,animation:Animation|undefined,frame=0,gazeFrame=0,disposed=false,step=0,revision=0;
  let drag:{id:number;origin:Point;start:Point;latest:Point;moved:boolean}|null=null;
  const ground=()=>groundRef.current??innerHeight;
 const size=()=>({w:root.offsetWidth,h:body.offsetHeight});
  const space=()=>{const el=document.querySelector('.cabinet-home')||document.querySelector('main');const r=el?.getBoundingClientRect();return {left:(r?.left||0)+scrollX,right:(r?.right||innerWidth)+scrollX,top:(r?.top||0)+scrollY,bottom:ground()};};
  const bound=(p:Point)=>{const {w,h}=size(),r=space();return{x:Math.max(r.left+12,Math.min(r.right-w-12,p.x)),y:Math.max(r.top+12,Math.min(r.bottom-h-12,p.y))};};
  const floor=()=>space().bottom-size().h-12;
  const paint=(p:Point)=>{position.current=bound(p);root.style.transform=`translate3d(${position.current.x}px,${position.current.y}px,0)`;};
  paint(position.current||{x:space().left+28,y:floor()});
  const pose=(name:Pose)=>{root.dataset.pose=name;};
  const stop=()=>{
   revision++;clearTimeout(timer);
   if(animation){const rect=root.getBoundingClientRect();animation.cancel();animation=undefined;paint({x:rect.left+scrollX,y:rect.top+scrollY});}
  };
  const later=(callback:()=>void,delay:number)=>{clearTimeout(timer);timer=setTimeout(()=>{if(!disposed&&document.visibilityState==='visible'&&!paused&&!drag)callback();},delay);};
  const move=(target:Point,duration:number,name:Pose,done:()=>void)=>{
   const from=position.current!,to=bound(target),ticket=revision;
   pose(name);root.dataset.facing=to.x<from.x?'left':'right';
   animation=root.animate([{transform:`translate3d(${from.x}px,${from.y}px,0)`},{transform:`translate3d(${to.x}px,${to.y}px,0)`}],{duration,easing:name==='walk'?'linear':name==='fall'?'cubic-bezier(.42,0,.72,.65)':'cubic-bezier(.25,.8,.35,1)',fill:'forwards'});
   void animation.finished.then(()=>{if(disposed||ticket!==revision)return;paint(to);animation?.cancel();animation=undefined;done();}).catch(()=>{});
  };
  const rest=(name:Pose,duration=3500)=>{pose(name);later(next,duration);};
  const landmarks=()=>[...document.querySelectorAll('.cabinet-home .staff-calendar-card,.cabinet-home .staff-profile-card,.cabinet-home .work-panel,.cabinet-home .cabinet-card')].map(el=>{const r=el.getBoundingClientRect();return {top:r.top+scrollY,left:r.left+scrollX,right:r.right+scrollX,width:r.width};}).filter(r=>r.top>space().top+size().h+12&&r.width>140);
  function next(){
   if(disposed||paused||reduced||document.visibilityState!=='visible')return;
   const actions=['walk','sit','shawarma','walk','chips','climb','jump','idle'] as const;
   const action=actions[step++%actions.length];
   if(action==='walk'){
    if(position.current!.y<floor()-10){descend(()=>rest('idle',800));return;}
    const to={x:space().left+24+Math.random()*Math.max(1,space().right-space().left-size().w-48),y:floor()},distance=Math.hypot(to.x-position.current!.x,to.y-position.current!.y);
    move(to,Math.min(6500,Math.max(1800,distance*11)),'walk',()=>rest('idle',900));
   }else if(action==='climb'){
    const panels=landmarks(),panel=panels[Math.floor(Math.random()*panels.length)];
    if(!panel){rest('sit',2500);return;}
    const x=panel.right-size().w*.65;
    descend(()=>move({x,y:floor()},Math.max(1000,Math.abs(x-position.current!.x)*10),'walk',()=>move({x,y:panel.top-35},2800,'climb',()=>{pose('hang');later(()=>move({x,y:panel.top-size().h+8},850,'climb',()=>rest('sit',3500)),1200);})));
   }else if(action==='jump'){
    const p=position.current!;
    move({x:p.x+35,y:p.y-85},450,'jump',()=>descend(()=>rest('idle',1800)));
   }else rest(action,action==='shawarma'||action==='chips'?5200:3800);
  }
  const descend=(done:()=>void)=>{
   const p=position.current!, platforms=landmarks().map(r=>({x:r.left,right:r.right,y:r.top-size().h+8}));
   const below=platforms.filter(r=>p.x+size().w*.5>r.x&&p.x+size().w*.5<r.right&&r.y>p.y+12).sort((a,b)=>a.y-b.y)[0];
   const y=below?.y??floor(),distance=Math.max(0,y-p.y);
   move({x:p.x,y},reduced?0:Math.min(2400,Math.max(650,Math.sqrt(distance)*100)),'fall',()=>{pose('land');if(paused||reduced){pose('idle');return;}later(done,450);});
  };
  const pointerDown=(event:PointerEvent)=>{
   if(event.button!==0)return;
   stop();body.setPointerCapture(event.pointerId);
   drag={id:event.pointerId,origin:{...position.current!},start:{x:event.clientX+scrollX,y:event.clientY+scrollY},latest:{x:event.clientX+scrollX,y:event.clientY+scrollY},moved:false};
   root.dataset.dragging='true';
  };
  const pointerMove=(event:PointerEvent)=>{
   if(!drag||event.pointerId!==drag.id)return;
   drag.latest={x:event.clientX+scrollX,y:event.clientY+scrollY};
   if(Math.hypot(event.clientX+scrollX-drag.start.x,event.clientY+scrollY-drag.start.y)>5){drag.moved=true;pose('held');}
   if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(drag?.moved){paint({x:drag.origin.x+drag.latest.x-drag.start.x,y:drag.origin.y+drag.latest.y-drag.start.y});root.style.setProperty('--mascot-sway',`${Math.max(-18,Math.min(18,(drag.latest.x-drag.start.x)*.06))}deg`);}});
  };
  const pointerUp=(event:PointerEvent)=>{
   if(!drag||event.pointerId!==drag.id)return;
   const moved=drag.moved;if(moved)paint({x:drag.origin.x+drag.latest.x-drag.start.x,y:drag.origin.y+drag.latest.y-drag.start.y});drag=null;root.dataset.dragging='false';root.style.setProperty('--mascot-sway','0deg');
   if(body.hasPointerCapture(event.pointerId))body.releasePointerCapture(event.pointerId);
   cancelAnimationFrame(frame);frame=0;
   if(moved){descend(()=>rest('idle',2200));}else{pose('idle');if(!paused&&!reduced)later(next,2200);}
  };
  const keyboard=(event:KeyboardEvent)=>{
   if(event.key==='Enter'||event.key===' '){event.preventDefault();stop();pose('idle');if(!paused&&!reduced)later(next,2200);}
   if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();stop();const p=position.current!;paint({x:p.x+(event.key==='ArrowLeft'?-24:event.key==='ArrowRight'?24:0),y:p.y+(event.key==='ArrowUp'?-24:event.key==='ArrowDown'?24:0)});pose('idle');if(!paused&&!reduced)later(next,5000);}
  };
  let cursor:Point|null=null;
  const gaze=(event:PointerEvent)=>{
   if(reduced||drag)return;cursor={x:event.clientX,y:event.clientY};
   if(!gazeFrame)gazeFrame=requestAnimationFrame(()=>{
    gazeFrame=0;if(!cursor)return;const box=body.getBoundingClientRect(),dx=cursor.x-(box.left+box.width*.49),dy=cursor.y-(box.top+box.height*.18),near=Math.hypot(dx,dy)<320;
    const facing=root.dataset.facing==='left'&&root.dataset.pose==='walk'?-1:1;
    root.style.setProperty('--mascot-look-x',`${near?Math.max(-7,Math.min(7,dx/18))*facing:0}px`);root.style.setProperty('--mascot-look-y',`${near?Math.max(-4,Math.min(4,dy/28)):0}px`);
    root.style.setProperty('--mascot-head-turn',`${near?Math.max(-5,Math.min(5,dx/55)):0}deg`);
   });
  };
  const resize=()=>{groundRef.current=innerHeight;stop();paint(position.current!);pose('idle');if(!paused&&!reduced)later(next,2500);};
  const visibility=()=>{stop();pose('idle');if(document.visibilityState==='visible'&&!paused&&!reduced)later(next,2500);};
  body.addEventListener('pointerdown',pointerDown);body.addEventListener('pointermove',pointerMove);body.addEventListener('pointerup',pointerUp);body.addEventListener('pointercancel',pointerUp);body.addEventListener('keydown',keyboard);
  window.addEventListener('pointermove',gaze,{passive:true});window.addEventListener('resize',resize,{passive:true});document.addEventListener('visibilitychange',visibility);
  pose('idle');if(!paused&&!reduced)later(next,4500);
  return()=>{disposed=true;stop();cancelAnimationFrame(frame);cancelAnimationFrame(gazeFrame);body.removeEventListener('pointerdown',pointerDown);body.removeEventListener('pointermove',pointerMove);body.removeEventListener('pointerup',pointerUp);body.removeEventListener('pointercancel',pointerUp);body.removeEventListener('keydown',keyboard);window.removeEventListener('pointermove',gaze);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visibility);};
 },[desktop,hidden,paused,reduced]);

 
 if(!desktop)return null;
 if(hidden)return <button type="button" className="cabinet-mascot-restore" onClick={()=>{position.current=null;setPaused(false);setHidden(false);}} title="ჰანგრიმენის კაცუნას ჩართვა">კაცუნას ჩართვა</button>;
 const original=<image href={ART} width="1024" height="1536"/>;
 return createPortal(<div ref={rootRef} className="cabinet-mascot" data-pose="idle" data-paused={paused||reduced}>
  <div className="cabinet-mascot-actions">
   <button type="button" onClick={()=>{setPaused(!paused);}} aria-label={paused?'კაცუნას მოძრაობის გაგრძელება':'კაცუნას მოძრაობის შეჩერება'} title={reduced?'მოძრაობა შემცირებულია მოწყობილობის პარამეტრით':paused?'მოძრაობის გაგრძელება':'მოძრაობის შეჩერება'} disabled={reduced}>{paused?'▶':'Ⅱ'}</button>
   <button type="button" onClick={()=>{setHidden(true);}} aria-label="კაცუნას დამალვა" title="დამალვა">×</button>
  </div>
  <button ref={bodyRef} className="cabinet-mascot-body" type="button" aria-label="ჰანგრიმენის კაცუნა. გადმოათრიე გადასაადგილებლად მაუსს თვალს აყოლებს. კლავიატურით გამოიყენე ისრები." title="მომკიდე ხელი და გადამიყვანე">
   <svg viewBox="0 0 1024 1536" width="128" height="192" aria-hidden="true" focusable="false">
    <defs><clipPath id={uid+'-head'}><path d={HEAD}/></clipPath>
     <linearGradient id={uid+'-suit'} x2="1" y2=".4"><stop stopColor="#343540"/><stop offset="1" stopColor="#171923"/></linearGradient>
    </defs>
    <g className="mascot-facing"><g className="mascot-rig">
     <g className="mascot-part mascot-leg-left"><path d="M390 935L490 940L477 1190L370 1190Z" fill="#242632"/><g className="mascot-shin"><path d="M370 1160H477L441 1460H341Z" fill="#242632"/><path d="M341 1430L439 1430L458 1510H260Q247 1470 341 1430Z" fill="#080b13"/><path d="M281 1494H445" stroke="#414350" strokeWidth="12"/></g></g>
     <g className="mascot-part mascot-leg-right"><path d="M505 940L615 935L640 1190H533Z" fill="#30323e"/><g className="mascot-shin"><path d="M533 1160H640L661 1460H560Z" fill="#30323e"/><path d="M560 1430H661Q750 1470 746 1510H550Z" fill="#080b13"/><path d="M563 1494H728" stroke="#414350" strokeWidth="12"/></g></g>
     <g className="mascot-part mascot-arm-left"><path d="M342 600Q290 560 270 638L245 840" fill="none" stroke="#252733" strokeWidth="100" strokeLinecap="round"/><g className="mascot-forearm"><path d="M245 830L256 1000" stroke="#252733" strokeWidth="90" strokeLinecap="round"/><path d="M256 957L256 993" stroke="#f4f5fa" strokeWidth="88"/><ellipse cx="256" cy="1033" rx="44" ry="57" fill="#f2c99f" stroke="#b98c66" strokeWidth="5"/></g></g>
     <path d="M430 500H566V594H430Z" fill="#edc39d"/><path d="M340 565Q490 530 640 565L666 997L511 1040L489 1002L330 1020Z" fill={`url(#${uid}-suit)`}/>
     <path d="M382 565H603L496 842Z" fill="#fff"/><path d="M344 577L395 570L490 841L361 717L404 695Z M625 570L584 575L503 841L638 708L589 685Z" fill="#10131d"/>
     <path d="M433 582L495 609L552 582V645L495 621L433 645Z" fill="#090c13"/><path d="M497 850V1001" stroke="#080b14" strokeWidth="11"/><g fill="#10131d"><circle cx="497" cy="675" r="12"/><circle cx="497" cy="723" r="12"/><circle cx="497" cy="770" r="12"/></g>
     <g className="mascot-part mascot-head mascot-head-front" clipPath={`url(#${uid}-head)`}>{original}<path d="M590 192L657 173L644 470L566 514Z" fill="#8b4d27" opacity=".17"/><path fill="#f9d7b4" d="M390 249h43v44h-43zM515 249h42v44h-42z"/><g className="mascot-gaze" fill="#080909"><path d="m402 258 16-1 2 31-16 1zM529 257l17 1-1 31-17-1z"/></g></g>
     <g className="mascot-part mascot-arm-right"><path d="M640 610Q687 598 703 658L724 828" fill="none" stroke="#30323e" strokeWidth="100" strokeLinecap="round"/>
      <g className="mascot-forearm"><path d="M724 824L730 1000" stroke="#30323e" strokeWidth="90" strokeLinecap="round"/><path d="M730 957V994" stroke="#f4f5fa" strokeWidth="88"/>
       <g className="mascot-food mascot-shawarma"><path d="M673 920L786 920L770 1074H694Z" fill="#e5c083" stroke="#9b693f" strokeWidth="7"/><path d="M677 925L693 897L715 910L739 890L765 910L783 925" fill="#7e4930" stroke="#6cba55" strokeWidth="16"/><path d="M687 990H778L766 1078H697Z" fill="#faf4e9"/><path d="M705 1040H759" stroke="#ef2549" strokeWidth="12"/></g>
       <g className="mascot-food mascot-chips"><path d="M668 926H789L778 1077H684Z" fill="#ee284b" stroke="#a71a37" strokeWidth="6"/><path d="M668 926H789" stroke="#f8cb70" strokeWidth="14"/><ellipse cx="730" cy="982" rx="26" ry="34" fill="#f6cb70"/></g>
       <path d="M752 1004Q701 986 695 1020L698 1054Q738 1082 761 1048" fill="#f2c99f" stroke="#b98c66" strokeWidth="5"/><path d="M706 1026L746 1032M706 1041L743 1046" stroke="#c59670" strokeWidth="5"/>
      </g>
     </g>
    </g></g>
   </svg>
  </button>
  <span className="cabinet-mascot-shadow" aria-hidden="true"/>
 </div>,document.body);
}
