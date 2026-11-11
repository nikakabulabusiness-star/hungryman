/* Self-view layout only; no media or signaling access. Embedded by sync-call-document. */
(()=>{
 const anchors=[[0,0],[.5,0],[1,0],[0,.5],[1,.5],[0,1],[.5,1],[1,1]];
 const labels=['ზედა მარცხენა','ზედა შუა','ზედა მარჯვენა','მარცხენა შუა','მარჯვენა შუა','ქვედა მარცხენა','ქვედა შუა','ქვედა მარჯვენა'];
 let self=null,anchor=7,drag=null,bound=null,observer=null;
 const small=()=>document.documentElement?.dataset?.layout==='mobile'||(window.matchMedia?.('(max-width:700px)').matches??false);
 const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
 function bounds(){const grid=document.getElementById('grid');if(!grid||!self)return null;const box=grid.getBoundingClientRect(),tile=self.getBoundingClientRect(),gap=12;return {box,minX:gap,minY:gap,maxX:Math.max(gap,box.width-tile.width-gap),maxY:Math.max(gap,box.height-tile.height-gap)}}
 function point(i,b){const a=anchors[i];return {x:b.minX+a[0]*(b.maxX-b.minX),y:b.minY+a[1]*(b.maxY-b.minY)}}
 function position(x,y,b){const p={x:clamp(x,b.minX,b.maxX),y:clamp(y,b.minY,b.maxY)};self.style.setProperty('--pip-x',p.x+'px');self.style.setProperty('--pip-y',p.y+'px');return p}
 function snap(x,y,b){let best=0,distance=Infinity;anchors.forEach((_,i)=>{const p=point(i,b),d=(x-p.x)**2+(y-p.y)**2;if(d<distance){distance=d;best=i}});anchor=best;self.classList.remove('is-dragging');const p=point(anchor,b);position(p.x,p.y,b);self.setAttribute('aria-label','შენი კამერა · '+labels[anchor]+'. გადასაადგილებლად გამოიყენე ისრები.');}
 function refresh(){if(!self||!self.isConnected)return;const pointer=drag?.id;drag=null;self.classList.remove('is-dragging');if(pointer!==undefined){try{self.releasePointerCapture(pointer)}catch{}}if(!small()){drag=null;self.classList.remove('is-dragging');self.style.removeProperty('--pip-x');self.style.removeProperty('--pip-y');self.tabIndex=-1;return}self.tabIndex=0;const b=bounds();if(!b)return;drag=null;const p=point(anchor,b);position(p.x,p.y,b)}
 function attachSelf(el){if(self===el){refresh();return}reset();self=el;self.setAttribute('role','button');self.setAttribute('aria-roledescription','გადასაადგილებელი კამერა');self.setAttribute('aria-label','შენი კამერა. გადაათრიე ან გამოიყენე ისრები.');
  const down=e=>{if(!small()||e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0))return;const b=bounds(),r=self.getBoundingClientRect();if(!b)return;drag={id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top,b,x:r.left-b.box.left,y:r.top-b.box.top};self.classList.add('is-dragging');try{self.setPointerCapture(e.pointerId)}catch{}e.preventDefault()};
  const move=e=>{if(!drag||drag.id!==e.pointerId)return;const p=position(e.clientX-drag.b.box.left-drag.dx,e.clientY-drag.b.box.top-drag.dy,drag.b);drag.x=p.x;drag.y=p.y;e.preventDefault()};
  const up=e=>{if(!drag||drag.id!==e.pointerId)return;const current=drag;drag=null;try{self.releasePointerCapture(e.pointerId)}catch{}snap(current.x,current.y,current.b)};
  const key=e=>{if(!small())return;const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};const direction=directions[e.key];if(!direction&&e.key!=='Home')return;e.preventDefault();const b=bounds();if(!b)return;if(e.key==='Home')anchor=7;else{const from=anchors[anchor];let best=anchor,cost=Infinity;anchors.forEach((p,i)=>{const dx=p[0]-from[0],dy=p[1]-from[1];if(dx*direction[0]+dy*direction[1]<=0)return;const d=dx*dx+dy*dy;if(d<cost){cost=d;best=i}});anchor=best}const p=point(anchor,b);snap(p.x,p.y,b)};
  if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(refresh);const grid=document.getElementById('grid');if(grid)observer.observe(grid)}
  bound={down,move,up,key};el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('lostpointercapture',up);el.addEventListener('keydown',key);refresh();
 }
 function reset(){observer?.disconnect();observer=null;if(self&&bound){self.removeEventListener('pointerdown',bound.down);self.removeEventListener('pointermove',bound.move);self.removeEventListener('pointerup',bound.up);self.removeEventListener('pointercancel',bound.up);self.removeEventListener('lostpointercapture',bound.up);self.removeEventListener('keydown',bound.key)}self=null;bound=null;drag=null;anchor=7}
 window.addEventListener('resize',refresh);window.visualViewport?.addEventListener('resize',refresh);
 window.HMCallLayout={attachSelf,refresh,reset};
})();
