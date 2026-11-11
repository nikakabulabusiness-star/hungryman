'use client';

import {useEffect,useRef} from 'react';

/** Decorative only: observes pointer coordinates and focus, never form values. */
export default function WorkMascot(){
 const svgRef=useRef<SVGSVGElement>(null);
 const leftRef=useRef<SVGGElement>(null);
 const rightRef=useRef<SVGGElement>(null);

 useEffect(()=>{
  const svg=svgRef.current;
  if(!svg)return;
  let frame=0;
  let pointer:{x:number;y:number}|null=null;
  const draw=()=>{
   frame=0;
   const matrix=svg.getScreenCTM();
   if(!matrix)return;
   const point=pointer?new DOMPoint(pointer.x,pointer.y).matrixTransform(matrix.inverse()):null;
   for(const [eye,x] of [[leftRef.current,352],[rightRef.current,441]] as const){
    const dx=point?(point.x-x)/100:0,dy=point?(point.y-295)/100:0;
    const distance=Math.max(1,Math.hypot(dx,dy));
    eye?.setAttribute('transform',`translate(${dx/distance*7} ${dy/distance*4})`);
   }
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(draw);};
  const move=(event:PointerEvent)=>{pointer={x:event.clientX,y:event.clientY};schedule();};
  const reset=()=>{pointer=null;schedule();};
  const focus=()=>{svg.dataset.closed=String(document.activeElement?.id==='staff-auth-password');};
  focus();
  window.addEventListener('pointermove',move,{passive:true});
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('blur',reset);
  document.documentElement.addEventListener('pointerleave',reset);
  document.addEventListener('focusin',focus);
  document.addEventListener('focusout',focus);
  return()=>{
   cancelAnimationFrame(frame);
   window.removeEventListener('pointermove',move);
   window.removeEventListener('resize',schedule);
   window.removeEventListener('scroll',schedule);
   window.removeEventListener('blur',reset);
   document.documentElement.removeEventListener('pointerleave',reset);
   document.removeEventListener('focusin',focus);
   document.removeEventListener('focusout',focus);
  };
 },[]);

 return <div className="work-entry-brand" aria-hidden="true">
  <svg ref={svgRef} className="work-mascot" viewBox="0 0 800 800" width="800" height="800" focusable="false">
   <image href="/careers/hungryman-logo.webp" width="800" height="800"/>
   {/* Cover only the original eyes; keep the face, brows and brand untouched. */}
   <path fill="#f5dcbe" d="M334 277h38v34h-38zM423 277h38v34h-38z"/>
   <g className="mascot-open-eyes">
    <path fill="#fff8e9" d="m337 281 29-1 1 28-29 1zM426 280l29 2-1 28-29-2z"/>
    <g ref={leftRef}><path fill="#080909" d="m347 285 10-.5 1 19-10 .5z"/></g>
    <g ref={rightRef}><path fill="#080909" d="m437 285 10 .5-1 19-10-.5z"/></g>
   </g>
   <g className="mascot-closed-eyes" fill="none" stroke="#17191a" strokeWidth="3.5" strokeLinecap="round">
    <path d="M338 293q14 9 28-1M427 292q14 10 28 1"/>
   </g>
  </svg>
 </div>;
}
