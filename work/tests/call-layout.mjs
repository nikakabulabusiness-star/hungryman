import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
let mobile=true,width=390,height=600;
const events={},css={},classes=new Set(),attributes={};
const grid={getBoundingClientRect:()=>({left:10,top:40,width,height})};
const self={isConnected:true,tabIndex:-1,style:{setProperty:(k,v)=>css[k]=v,removeProperty:k=>delete css[k]},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)},setAttribute:(k,v)=>attributes[k]=v,addEventListener:(k,f)=>events[k]=f,removeEventListener:k=>delete events[k],getBoundingClientRect:()=>({left:10+parseFloat(css['--pip-x']||0),top:40+parseFloat(css['--pip-y']||0),width:110,height:150}),setPointerCapture:id=>self.captured=id,releasePointerCapture:()=>self.captured=null};
const documentElement={dataset:{}};
const win={matchMedia:()=>({matches:mobile}),addEventListener:(k,f)=>events['window-'+k]=f};
vm.runInNewContext(fs.readFileSync('public/work/call-layout.js','utf8'),{window:win,document:{documentElement,getElementById:()=>grid}});
const layout=win.HMCallLayout;
layout.attachSelf(self);assert.equal(css['--pip-x'],'268px');assert.equal(css['--pip-y'],'438px');assert.equal(self.tabIndex,0,'mobile pip is keyboard movable');
const event=(x,y,extra={})=>({pointerId:1,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,preventDefault(){},...extra});
function dragTo(x,y){const r=self.getBoundingClientRect();events.pointerdown(event(r.left+10,r.top+10));assert.equal(self.captured,1);events.pointermove(event(grid.getBoundingClientRect().left+x+10,grid.getBoundingClientRect().top+y+10));events.pointerup(event(0,0))}
for(const [x,y] of [[12,12],[140,12],[268,12],[12,225],[268,225],[12,438],[140,438],[268,438]]){dragTo(x,y);assert.equal(css['--pip-x'],x+'px');assert.equal(css['--pip-y'],y+'px')}
dragTo(-200,900);assert.equal(css['--pip-x'],'12px');assert.equal(css['--pip-y'],'438px','drag stays inside media stage above controls');
events.keydown({key:'ArrowUp',preventDefault(){}});assert.equal(css['--pip-y'],'225px');events.keydown({key:'Home',preventDefault(){}});assert.equal(css['--pip-x'],'268px');assert.equal(css['--pip-y'],'438px');
width=300;height=360;events['window-resize']();assert.equal(css['--pip-x'],'178px');assert.equal(css['--pip-y'],'198px','resize retains bottom-right anchor');
mobile=false;layout.refresh();assert.equal(css['--pip-x'],undefined);assert.equal(self.tabIndex,-1);events.pointerdown(event(1,1));assert.equal(self.captured,null,'desktop self view cannot be dragged');
documentElement.dataset.layout='mobile';layout.refresh();assert.equal(self.tabIndex,0,'native mobile remains PiP in landscape');
layout.reset();assert.equal(events.pointerdown,undefined,'cleanup removes pointer listeners');
console.log('PASS call PiP bottom-right default, free dragging, eight anchors, bounds, keyboard, resize, desktop disable and cleanup.');
