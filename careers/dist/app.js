'use strict';
// Dark is the default on every fresh page load; switching does not depend on OS settings.
const root=document.documentElement;
const themeButtons=[...document.querySelectorAll('[data-theme-choice]')];
function setTheme(theme){root.dataset.theme=theme;themeButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice===theme)));document.querySelector('meta[name="theme-color"]').content=theme==='dark'?'#07182c':'#eef5fc';}
themeButtons.forEach(button=>button.addEventListener('click',()=>setTheme(button.dataset.themeChoice)));

// Keep native mailto links: the device opens its configured email app.

const menuButton=document.querySelector('.menu-toggle');
const menu=document.getElementById('mobile-nav');
function closeMenu(){menu.hidden=true;menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label','მენიუს გახსნა');}
menuButton.addEventListener('click',()=>{const open=menu.hidden;menu.hidden=!open;menuButton.setAttribute('aria-expanded',String(open));menuButton.setAttribute('aria-label',open?'მენიუს დახურვა':'მენიუს გახსნა');});
menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
document.addEventListener('click',event=>{if(!event.target.closest('.site-header'))closeMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(!menu.hidden){closeMenu();menuButton.focus();}}});
matchMedia('(min-width:701px)').addEventListener('change',event=>{if(event.matches)closeMenu();});
document.querySelectorAll('[data-dialog]').forEach(a=>a.addEventListener('click',event=>{event.preventDefault();closeMenu();document.getElementById(a.dataset.dialog).showModal();document.body.classList.add('modal-open');}));
document.querySelectorAll('dialog').forEach(dialog=>{dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());dialog.querySelector('.dialog-positions').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>document.body.classList.remove('modal-open'));dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}});});
