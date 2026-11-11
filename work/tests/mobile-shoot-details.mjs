import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const listeners=new Map(),mediaListeners=new Set(),scrolled=[],requests=[];
let url=new URL('https://work.example/shoots'),confirm=true,current;
const media={matches:true,addEventListener:(_event,fn)=>mediaListeners.add(fn),removeEventListener:(_event,fn)=>mediaListeners.delete(fn)};
const window={location:{get hash(){return url.hash}},history:{state:null,pushState:(_state,_title,next)=>{url=new URL(next,url)},replaceState:(_state,_title,next)=>{url=new URL(next,url)}},scrollY:180,scrollTo:position=>scrolled.push(position),confirm:()=>confirm,matchMedia:()=>media,requestAnimationFrame:fn=>fn(),addEventListener:(event,fn)=>{if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn)},removeEventListener:(event,fn)=>listeners.get(event)?.delete(fn),dispatchEvent:event=>{for(const fn of listeners.get(event.type)||[])fn(event)}};
class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}
class Element{constructor(interactive=false){this.interactive=interactive}closest(){return this.interactive?this:null}}
class HTMLDetailsElement{open=false;scrollIntoView(){}querySelector(){return {focus(){}}}}
const detailTarget=new HTMLDetailsElement();
const document={getElementById:()=>detailTarget,querySelector:()=>null};
const react={
 useState(initial){const h=current,index=h.cursor++;if(!(index in h.slots))h.slots[index]=typeof initial==='function'?initial():initial;return [h.slots[index],value=>{const next=typeof value==='function'?value(h.slots[index]):value;if(!Object.is(next,h.slots[index])){h.slots[index]=next;h.dirty=true}}]},
 useRef(initial){const h=current,index=h.cursor++;return h.slots[index]??(h.slots[index]={current:initial})},
 useMemo(fn){current.cursor++;return fn()},
 useEffect(fn,deps){const h=current,index=h.cursor++,old=h.effects[index];if(!old||deps.some((dep,i)=>!Object.is(dep,old.deps[i])))h.pending.push(()=>{old?.cleanup?.();h.effects[index]={deps,cleanup:fn()}})}
};
function harness(Component,props){const h={slots:[],effects:[],pending:[],cursor:0,dirty:false,tree:null,render(){let turns=0;do{assert.ok(turns++<15,'effects must settle');h.cursor=0;h.pending=[];h.dirty=false;current=h;h.tree=Component(props);for(const effect of h.pending)effect()}while(h.dirty);return h.tree},dispose(){for(const effect of h.effects)effect?.cleanup?.()}};return h}
const module={exports:{}};
const require=name=>{
 if(name==='react')return react;
 if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
 if(name==='@/lib/department-directory')return {roleLabel:value=>value};
 if(name==='@/components/shoot-work-details')return {default:'ShootWorkDetails'};
 if(name==='@/components/shoot-photo')return {ShootPhoto:'ShootPhoto',preparePhoto:()=>{throw Error('not called')}};
 if(name==='@/lib/save-feedback')return {finishSave:async()=>{}};
 if(name==='@/lib/work-mobile')return {WORK_MOBILE_QUERY:'test-media'};
 if(name==='lucide-react')return {Map:'Map',Pencil:'Pencil'};
 throw Error('Unexpected dependency '+name);
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/shoots/shoots-client.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:module.exports,require,window,document,CustomEvent,HTMLDetailsElement,Element,HTMLElement:Element,URL,Date,Intl,Map,encodeURIComponent,decodeURIComponent,fetch:async(path,options)=>{requests.push({path,options});return {ok:true,json:async()=>({})}}});
const makeShoot=(id,status)=>({id,status,title:'Shoot '+id,shoot_date:'2026-10-28',start_time:'10:00',end_time:'11:00',location_name:'Studio',location_url:'https://maps.example/studio',details:'Brief',photo_id:null,latitude:null,longitude:null,tasks:[{id:'task-'+id,assignee_name:'Crew',assignee_email:'crew@example.test',assignee_role:'Operator',task:'Camera'}]});
const props={initialShoots:[makeShoot('first','planned'),makeShoot('second','completed')],people:[],canCreate:true,canEdit:true,canDelete:true,canWorkFlow:true};
const app=harness(module.exports.default,props);
function nodes(node){if(!node||typeof node!=='object')return [];return [node,...[node.props?.children].flat(Infinity).flatMap(nodes)]}
const getDetail=()=>nodes(app.tree).find(node=>typeof node.type==='function'&&node.type.name==='MobileShootDetail');
app.render();assert.equal(getDetail(),undefined);
const card=nodes(app.tree).find(node=>typeof node.type==='function'&&node.props?.shoot?.id==='first');
assert.equal(typeof card.props.onOpen,'function');const cardView=harness(card.type,card.props);cardView.render();const summary=nodes(cardView.tree).find(node=>node.type==='summary');let prevented=false;summary.props.onClick({target:new Element(true),preventDefault(){prevented=true}});assert.equal(url.hash,'','photo buttons stay independent of card navigation');summary.props.onClick({target:new Element(),preventDefault(){prevented=true}});assert.equal(prevented,true,'mobile card replaces accordion action with detail');cardView.dispose();app.render();
assert.equal(url.hash,'#shoot-first');assert.equal(getDetail()?.props.shoot.id,'first');
let handshake;const receiveDetail=event=>{handshake=event.detail.active};window.addEventListener('hmw:shoot-detail',receiveDetail);window.dispatchEvent(new CustomEvent('hmw:shoot-detail-request'));assert.equal(handshake,true,'shell can request detail state after mounting');window.removeEventListener('hmw:shoot-detail',receiveDetail);
assert.equal(scrolled.at(-1).top,0);
const detail=getDetail(),view=harness(detail.type,detail.props);view.render();
assert.ok(nodes(view.tree).some(node=>node.type==='a'&&node.props.href==='https://maps.example/studio'));
const edit=nodes(view.tree).find(node=>node.type==='button'&&[node.props.children].flat().includes('რედაქტირება'));assert.ok(edit);edit.props.onClick();view.render();
const form=nodes(view.tree).find(node=>typeof node.type==='function');assert.equal(form.props.method,'PATCH');assert.equal(form.props.endpoint,'/api/shoots/first');form.props.onCancel();view.render();view.dispose();
const restricted=harness(detail.type,{...detail.props,canEdit:false,canDelete:false});restricted.render();assert.equal(nodes(restricted.tree).filter(node=>node.type==='button').length,0);restricted.dispose();
url=new URL('/shoots',url);window.dispatchEvent(new CustomEvent('popstate'));app.render();assert.equal(getDetail(),undefined,'browser back restores list');
url=new URL('/shoots#shoot-second',url);window.dispatchEvent(new CustomEvent('hashchange'));app.render();assert.equal(getDetail()?.props.shoot.id,'second','deep link opens completed shoot');
media.matches=false;for(const listener of mediaListeners)listener();app.render();assert.equal(getDetail(),undefined);assert.equal(detailTarget.open,true,'desktop retains expanded accordion');assert.ok(nodes(app.tree).filter(node=>node.props?.shoot).every(node=>node.props.onOpen===undefined));
media.matches=true;for(const listener of mediaListeners)listener();app.render();assert.equal(getDetail()?.props.shoot.id,'second','return to phone preserves detail');
confirm=false;await getDetail().props.onDelete('second');assert.equal(requests.length,0);
confirm=true;await getDetail().props.onDelete('second');app.render();assert.equal(requests[0].path,'/api/shoots/second');assert.equal(requests[0].options.method,'DELETE');assert.equal(url.hash,'');assert.equal(getDetail(),undefined,'successful deletion returns to remaining list');
url=new URL('/shoots#%bad',url);window.dispatchEvent(new CustomEvent('hashchange'));app.render();assert.equal(getDetail(),undefined,'malformed deep links keep list usable');
app.dispose();
url=new URL('/shoots?kind=short#shoot-short',url);
const linked={...makeShoot('short','planned'),content_kind:'short',work_video_id:'video-id'};
const linkedApp=harness(module.exports.default,{...props,initialKind:'short',initialShoots:[...props.initialShoots,linked]});linkedApp.render();
const linkedDetail=nodes(linkedApp.tree).find(node=>typeof node.type==='function'&&node.type.name==='MobileShootDetail');assert.equal(linkedDetail.props.shoot.id,'short');assert.equal(linkedDetail.props.canEdit,false,'published workflow shot cannot bypass approval through legacy edit');
const linkedView=harness(linkedDetail.type,linkedDetail.props);linkedView.render();assert.equal(nodes(linkedView.tree).find(node=>node.type==='ShootWorkDetails').props.videoId,'video-id');linkedView.dispose();
url=new URL('/shoots?kind=short',url);window.dispatchEvent(new CustomEvent('popstate'));linkedApp.render();assert.deepEqual(nodes(linkedApp.tree).filter(node=>node.props?.shoot).map(node=>node.props.shoot.id),['short'],'Shorts list excludes main shoots');linkedApp.dispose();
console.log('PASS mobile shoot list/detail, deep links, browser back, desktop accordion, edit/delete permissions and cancellation, successful deletion, and invalid hashes.');
