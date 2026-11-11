import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('public/work/map.html','utf8');
const bundled=fs.readFileSync('mobile/src/lib/map-document.ts','utf8');
assert.ok(bundled.includes(JSON.stringify(html)), 'Native map must match the hosted document');
const notifications=[],centers=[],markers=[],sources=new Map();
class Element{constructor(){this.style={};this.dataset={};this.children=[]}appendChild(el){this.children.push(el)}setAttribute(){}addEventListener(name,fn){this[name]=fn}}
class MapMock{static current;constructor(options){this.options=options;this.events={};MapMock.current=this}on(e,fn){this.events[e]=fn;return this}jumpTo(v){centers.push(v)}easeTo(v){centers.push(v)}isStyleLoaded(){return true}addControl(){}getSource(id){return sources.get(id)}addSource(id,v){sources.set(id,{data:v.data,setData(data){this.data=data}})}addLayer(){}setStyle(s){this.options.style=s;sources.clear();this.events['style.load']?.()}}
class Marker{constructor({element}){this.element=element;markers.push(this)}setLngLat(p){this.point=p;return this}addTo(){return this}remove(){this.removed=true}setPopup(p){this.popup=p;return this}}
class Popup{setDOMContent(el){this.body=el;return this}}
const office={title:'Office',latitude:41.7,longitude:44.8,office:true,radius:300};
const past={title:'<b>Old shoot</b>',latitude:41.7,longitude:44.8,past:true,date:'2025-01-10',time:'12:00'};
const window={__HMW_MAP_INPUT__:{pins:[office,past],recenter:0},ReactNativeWebView:{postMessage:value=>notifications.push(JSON.parse(value))},addEventListener(){}};
const document={documentElement:new Element(),getElementById:()=>new Element(),createElement:()=>new Element(),head:new Element()};
const code=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/import\('https:[^']+'\)/,'Promise.resolve(glMock)');
vm.runInNewContext(code,{window,document,glMock:{Map:MapMock,Marker,Popup,NavigationControl:class{}},location:{hash:'',origin:'https://test.example'},setTimeout:()=>1,clearTimeout(){},console});
await new Promise(resolve=>setImmediate(resolve));MapMock.current.events.load();
assert.equal(markers.length,1,'Same-location shoots share a marker, preserving every entry');
assert.equal(markers[0].popup.body.children.length,2);
assert.equal(markers[0].popup.body.children[1].children[0].textContent,past.title,'Titles use text content');
assert.match(markers[0].popup.body.children[1].children[1].textContent,/2025-01-10/);
markers[0].popup.body.children[1].children.at(-1).onclick();assert.ok(notifications.some(n=>n.open===1));
const officeArea=sources.get('hmw-areas').data.features[0];assert.equal(officeArea.geometry.coordinates[0].length,65);
window.setMapInput({pins:[office,past],recenter:0,userLocation:{latitude:41.71,longitude:44.81,accuracy:8}});
const live=markers.at(-1);assert.deepEqual([...live.point],[44.81,41.71]);assert.equal(sources.get('hmw-areas').data.features.length,2);
const count=centers.length;MapMock.current.events.dragstart();
window.setMapInput({pins:[office,past],recenter:0,userLocation:{latitude:41.72,longitude:44.82,accuracy:12}});
assert.equal(markers.at(-1),live);assert.deepEqual([...live.point],[44.82,41.72]);assert.equal(centers.length,count,'Dragging must stop auto-follow');
window.setMapInput({pins:[office,past],recenter:1,theme:'light',userLocation:{latitude:41.72,longitude:44.82,accuracy:12}});
assert.equal(centers.at(-1).zoom,16);assert.equal(MapMock.current.options.style.name,'Hungryman Day');assert.equal(sources.get('hmw-areas').data.features.length,2);
window.setMapInput({pins:[office,past],recenter:1,userLocation:null});
assert.equal(live.removed,true);assert.deepEqual([...centers.at(-1).center],[office.longitude,office.latitude]);
window.setMapInput({pins:[office],preview:true,recenter:1});MapMock.current.events.click({});assert.ok(notifications.some(n=>n.expand));
assert.ok(notifications.every(n=>!('latitude' in n)&&!('longitude' in n)),'Viewing own location must not share it');
window.setMapInput({pins:[office],select:true,recenter:1});MapMock.current.events.click({lngLat:{lat:41.8,lng:44.9}});assert.ok(notifications.some(n=>n.latitude===41.8&&n.longitude===44.9));
const place={title:'<img src=x> Studio',latitude:41.73,longitude:44.82,place:true,photo:'data:image/jpeg;base64,/9j/2Q=='};
window.setMapInput({pins:[place],recenter:1});
const placeMarker=markers.at(-1);assert.match(placeMarker.element.className,/place/);assert.equal(placeMarker.element.children[0].src,place.photo);assert.equal(placeMarker.element.children[1].textContent,place.title,'Place labels render as plain text');
window.setMapInput({pins:[{...place,photo:'https://tracker.example/image'}],recenter:1});assert.equal(markers.at(-1).element.children[0].textContent,'⌖','Map thumbnails must not load arbitrary external images');
window.setMapInput({pins:[place],select:true,selectionKind:'place',recenter:1});MapMock.current.events.click({lngLat:{lat:41.76,lng:44.88}});assert.match(markers.at(-1).element.className,/place/);assert.equal(sources.get('hmw-areas').data.features.length,0,'Place selection must not create an office attendance radius');
for(const theme of ['dark','light']){const style=JSON.parse(fs.readFileSync(`public/work/map-${theme}.json`));assert.equal(style.version,8);assert.ok(style.layers.length>10);assert.ok(style.sources.osm.attribution.includes('OpenStreetMap'));assert.equal(new Set(style.layers.map(l=>l.id)).size,style.layers.length)}
console.log('PASS: map parity, live updates, private location lifecycle, drag/recenter, grouped historical pins, date popups, style switching and office selection.');
