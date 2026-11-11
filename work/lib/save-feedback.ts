'use client';

export async function finishSave(target:HTMLElement|null,message='შენახულია'){
 window.dispatchEvent(new CustomEvent('hungryman:saved',{detail:message}));
 const details=target?.closest('details');
 if(!details?.open)return;
 const summary=details.querySelector(':scope > summary') as HTMLElement|null;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(!reduced&&details.animate){
  const style=getComputedStyle(details),padding=parseFloat(style.paddingTop)+parseFloat(style.paddingBottom);
  const animation=details.animate([{height:`${details.getBoundingClientRect().height}px`,overflow:'hidden'},{height:`${(summary?.getBoundingClientRect().height||44)+padding+2}px`,overflow:'hidden'}],{duration:210,easing:'cubic-bezier(.2,.8,.2,1)'});
  await animation.finished.catch(()=>{});
 }
 details.open=false;
 summary?.focus({preventScroll:true});
}
