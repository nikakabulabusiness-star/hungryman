'use client';
import {useLayoutEffect,useRef} from 'react';
import type {WorkContent} from '@/mobile/src/lib/work-model';

const allowed=new Set('a p div br strong b em i u s strike blockquote h1 h2 h3 ol ul li table tbody tr td th span font'.split(' '));
function clean(source:string){
 const template=document.createElement('template');template.innerHTML=source;
 function copy(node:Node):Node{
  if(node.nodeType===Node.TEXT_NODE)return document.createTextNode(node.textContent||'');
  if(!(node instanceof Element)||['SCRIPT','STYLE','IFRAME','OBJECT','SVG'].includes(node.tagName))return document.createTextNode('');
  const tag=node.tagName.toLowerCase(),el=allowed.has(tag)?document.createElement(tag):document.createDocumentFragment();
  if(el instanceof HTMLElement){
   const align=node.getAttribute('align')||(node as HTMLElement).style?.textAlign;
   if(align&&['left','center','right','justify'].includes(align))el.style.textAlign=align;
   if(tag==='a'){const url=node.getAttribute('href')||'';if(/^https?:\/\//i.test(url)){el.setAttribute('href',url);el.setAttribute('rel','noopener noreferrer');el.setAttribute('target','_blank')}}
   if(tag==='font'){const color=node.getAttribute('color');if(color&&/^#[0-9a-f]{6}$/i.test(color))el.setAttribute('color',color)}
   if(node instanceof HTMLElement){for(const key of ['fontWeight','fontStyle','textDecorationLine','backgroundColor','color'] as const)el.style[key]=node.style[key]}
  }
  node.childNodes.forEach(child=>el.appendChild(copy(child)));return el;
 }
 const out=document.createElement('div');template.content.childNodes.forEach(child=>out.appendChild(copy(child)));return out.innerHTML;
}
export default function ScriptDocument({content,disabled,update}:{content:WorkContent;disabled:boolean;update:(patch:Partial<WorkContent>)=>void}){
 const page=useRef<HTMLDivElement>(null),last=useRef<{html:string;text:string}|null>(null);
 useLayoutEffect(()=>{const el=page.current;if(!el)return;
  const html=content.scriptHtml||'',text=content.script;
  if(last.current?.html===html&&last.current.text===text)return;
  if(html)el.innerHTML=clean(html);else el.textContent=text;
  last.current={html,text};
 },[content.scriptHtml,content.script]);
 function changed(){const el=page.current;if(!el)return;const html=clean(el.innerHTML),text=el.innerText;last.current={html,text};update({script:text,scriptHtml:html})}
 function addRow(){
  const node=window.getSelection()?.anchorNode,cell=(node instanceof Element?node:node?.parentElement)?.closest('td,th');
  if(!cell||!page.current?.contains(cell))return;
  const row=cell.closest('tr')!,table=row.closest('table')!;const next=table.insertRow(row.rowIndex+1);
  for(let i=0;i<row.cells.length;i++)next.insertCell().appendChild(document.createElement('br'));
  changed()
 }
 function run(cmd:string,arg?:string){if(disabled)return;page.current?.focus();document.execCommand(cmd,false,arg);changed()}
 const buttons=[['B','მუქი','bold'],['I','დახრილი','italic'],['U','ხაზგასმა','underline'],['•','მარკირებული სია','insertUnorderedList'],['1.','დანომრილი სია','insertOrderedList'],['⇤','მარცხნივ','justifyLeft'],['≡','ცენტრში','justifyCenter'],['⇥','მარჯვნივ','justifyRight'],['↶','გაუქმება','undo'],['↷','გამეორება','redo']];
 return <section className="hm-script"><div className="hm-script-tools" role="toolbar" aria-label="სცენარის ფორმატირება">
 <select aria-label="აბზაცის სტილი" defaultValue="p" onChange={e=>run('formatBlock',e.target.value)}><option value="p">აბზაცი</option><option value="h1">სათაური</option><option value="h2">სცენა</option><option value="blockquote">ციტატა</option></select>
 {buttons.map(([label,title,cmd])=><button key={cmd} type="button" title={title} aria-label={title} onMouseDown={e=>e.preventDefault()} onClick={()=>run(cmd)}>{label}</button>)}
 <button type="button" title="ცხრილის ჩასმა" onMouseDown={e=>e.preventDefault()} onClick={()=>run('insertHTML','<table><tbody><tr><th>კადრი</th><th>ტექსტი</th></tr><tr><td><br></td><td><br></td></tr></tbody></table><p><br></p>')}>▦ ცხრილი</button>
 <button type="button" onMouseDown={e=>e.preventDefault()} onClick={addRow} title="მოათავსე კურსორი ცხრილში">+ მწკრივი</button>
 <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>{const url=window.prompt('ჩასვი https ბმული');if(url&&/^https?:\/\//i.test(url))run('createLink',url)}}>ბმული</button>
 <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>run('hiliteColor','#fff3a1')}>მონიშვნა</button></div>
 <div className="hm-script-paper" ref={page} contentEditable={!disabled} role="textbox" aria-label="სრული სცენარი" aria-multiline="true" suppressContentEditableWarning onInput={changed} onDrop={e=>e.preventDefault()} onPaste={e=>{e.preventDefault();const html=e.clipboardData.getData('text/html');if(html)run('insertHTML',clean(html));else run('insertText',e.clipboardData.getData('text/plain'))}}/>
 <small>{content.script.trim().split(/\s+/).filter(Boolean).length} სიტყვა</small></section>
}
