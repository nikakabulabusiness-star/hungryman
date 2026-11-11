import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
function fixture(){
 const handlers=new Map(),dh=new Map(),banners=[],oscillators=[];
 const listen=map=>(key,fn)=>{if(!map.has(key))map.set(key,[]);map.get(key).push(fn)};
 class Notice{static permission='granted';constructor(title,options){banners.push({title,options})}close(){}}
 class AudioContext{state='suspended';currentTime=0;destination={};resume(){this.state='running';return Promise.resolve()}createOscillator(){const item={type:'',frequency:{value:0},connect(){},disconnect(){},start(){oscillators.push(this)},stop(){}};return item}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}}}
 const window={AudioContext,Notification:Notice,addEventListener:listen(handlers),dispatchEvent:event=>{for(const fn of handlers.get(event.type)||[])fn(event)},focus(){}};
 const document={hidden:true,hasFocus:()=>false,addEventListener:listen(dh)};
 const context={window,document,Notification:Notice,navigator:{},location:{pathname:'/team',assign(){}},localStorage:storage,crypto,Date,JSON,Set,AbortSignal,fetch:async()=>new Response('',{status:403}),Response,setTimeout:()=>1,clearTimeout(){},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail}}};
 vm.runInNewContext(fs.readFileSync('public/work/desktop-notices.js','utf8'),context);
 return {window,banners,oscillators,gesture:async()=>{for(const fn of dh.get('pointerdown')||[])fn();await Promise.resolve()}};
}
const a=fixture(),b=fixture();
// A tab without a user gesture can show a permitted banner but must not claim sound.
await b.window.hmDesktopNotify({id:'work:locked-first',userId:'hr',target:'accounts'});
assert.equal(b.oscillators.length,0);
await a.gesture();await a.window.hmDesktopNotify({id:'work:locked-first',userId:'hr',target:'accounts'});
assert.equal(a.oscillators.length,2,'Unlocked tab still rings after locked sibling saw event');
a.oscillators.length=0;a.banners.length=0;b.banners.length=0;
await b.gesture();
// Advance beyond burst coalescing without a wall-clock wait.
const realNow=Date.now;Date.now=()=>realNow()+2000;
const notice={id:'work:new-registration',userId:'hr',target:'accounts',targetId:'new-user'};
await a.window.hmDesktopNotify(notice);assert.equal(a.oscillators.length,2);assert.equal(a.banners.length,1);
assert.equal(a.banners[0].options.body,'ახალი შეტყობინება სამუშაო სივრცეში','OS banner does not disclose private registration data');
await a.window.hmDesktopNotify(notice);await b.window.hmDesktopNotify(notice);assert.equal(a.oscillators.length,2);assert.equal(b.oscillators.length,0,'A second tab does not ring twice for the same recipient/event');
a.window.dispatchEvent({type:'hmw:desktop-toggle',detail:{enabled:false}});
await a.window.hmDesktopNotify({...notice,id:'work:muted'});assert.equal(a.oscillators.length,2,'Sound preference respected');assert.equal(a.banners.length,2,'Sound toggle does not disable OS banners');
await b.window.hmDesktopNotify({...notice,userId:'owner'});assert.equal(b.banners.length,1,'Event dedup is scoped by account');
assert.equal(a.banners[0].options.silent,true,'OS chime does not double the app sound');
Date.now=realNow;
console.log('PASS: desktop gesture unlock, sound preference, private OS banner, recipient-scoped cross-tab dedup.');
