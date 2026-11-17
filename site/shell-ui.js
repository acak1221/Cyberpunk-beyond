/* Shell behaviour: the section menu (a labelled dialog on phones, a sidebar that can shrink to icons on wide screens),
   the bottom bar and the install button. Pure presentation: never touches saved data. */
(function(global){
'use strict';
const doc=global.document,root=doc.documentElement;
const MINI_KEY='nc-nav-mini',PHONE='(max-width: 820px)',WIDE='(min-width: 1024px)';
let focusTimer=0,opener=null;
const phone=()=>{try{return !!global.matchMedia?.(PHONE)?.matches}catch{return false}};
const wide=()=>{try{return !!global.matchMedia?.(WIDE)?.matches}catch{return false}};
// The collapsed sidebar (icons only) is a per-device choice; it only shows from 1024 px up.
function miniWanted(){try{return global.localStorage?.getItem(MINI_KEY)==='1'}catch{return false}}
function setMini(on){
 root.classList.toggle('nav-mini',!!on);
 try{global.localStorage?.setItem(MINI_KEY,on?'1':'0')}catch{}
 sync();
}
const isMini=()=>root.classList.contains('nav-mini');
// The language of the page being drawn: the app's own state, because <html lang> is set a moment after the first render of a direct load.
function appLang(){try{const l=global.App?.lang?.();if(l==='en'||l==='ru')return l}catch{}return root.lang==='en'?'en':'ru'}
if(miniWanted())root.classList.add('nav-mini');
// The page is redrawn as a whole, so the state of the drawer is put back on the new elements after every redraw.
function sync(){
 const open=root.classList.contains('nav-open');
 // On a phone the menu buttons open the «More» sheet; it keeps their aria-expanded itself while it is open.
 for(const b of doc.querySelectorAll('[data-shell="menu"]'))b.setAttribute('aria-expanded',String(open||!!global.MoreSheet?.isOpen?.()));
 // While the drawer is open, what lies under the dimmed layer cannot be reached by Tab or by a screen reader.
 for(const el of doc.querySelectorAll('.app-shell .content, .app-shell .top-context, .app-shell .top-actions'))el.inert=open;
 // On a phone the open drawer is a modal dialog with its own name; on a wide screen it is an ordinary sidebar.
 const side=doc.querySelector('#app-sidebar');
 if(side?.setAttribute){
  if(open&&phone()){side.setAttribute('role','dialog');side.setAttribute('aria-modal','true')}
  else{side.removeAttribute?.('role');side.removeAttribute?.('aria-modal')}
 }
 const mini=isMini()&&wide();
 for(const b of doc.querySelectorAll('[data-shell="mini"]')){
  b.setAttribute('aria-pressed',String(mini));
  const ru=appLang()!=='en',label=mini?(ru?'Развернуть меню':'Expand the menu'):(ru?'Свернуть меню до значков':'Collapse the menu to icons');
  b.setAttribute('aria-label',label);b.setAttribute('title',label);
 }
}
function setOpen(open){
 const was=root.classList.contains('nav-open');
 if(open&&!was){const a=doc.activeElement;opener=a&&a!==doc.body?a:null}
 root.classList.toggle('nav-open',open);
 sync();
 clearTimeout(focusTimer);
 // The drawer slides in and is not focusable until it is visible: move the focus when the slide has finished,
 // unless it is already inside the drawer (a control was used during the slide).
 if(open)focusTimer=setTimeout(()=>{if(root.classList.contains('nav-open')&&!doc.querySelector('#app-sidebar')?.contains(doc.activeElement))doc.querySelector('#app-sidebar .nav-item.active, #app-sidebar .nav-item')?.focus({preventScroll:true})},260);
 else if(was&&doc.querySelector('#app-sidebar')?.contains(doc.activeElement)){
  // Back to the control that opened the drawer (the top button or «Ещё»); the page is drawn again after a section change,
  // so a stale element falls back to the top button.
  const back=opener&&opener.isConnected!==false&&typeof opener.focus==='function'?opener:doc.querySelector('.menu-toggle');
  (back||doc.querySelector('.menu-toggle'))?.focus({preventScroll:true});
 }
 if(!open)opener=null;
}
// Tab and Shift+Tab stay inside the open drawer on a phone.
function trap(e){
 if(e.key!=='Tab'||!root.classList.contains('nav-open')||!phone())return false;
 const side=doc.querySelector('#app-sidebar');if(!side?.querySelectorAll)return false;
 const items=[...side.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x=>!x.hidden&&x.getAttribute?.('aria-hidden')!=='true'&&(typeof x.getClientRects!=='function'||x.getClientRects().length>0));
 if(!items.length)return false;
 const first=items[0],last=items[items.length-1],cur=doc.activeElement;
 if(!side.contains(cur)){e.preventDefault?.();first.focus({preventScroll:true});return true}
 if(e.shiftKey&&cur===first){e.preventDefault?.();last.focus({preventScroll:true});return true}
 if(!e.shiftKey&&cur===last){e.preventDefault?.();first.focus({preventScroll:true});return true}
 return false;
}
// Capture phase: app.js handles data-action clicks on #app; this only closes the drawer.
doc.addEventListener('click',e=>{
 const el=e.target.closest?.('[data-shell],[data-action="navigate"],[data-action="open"]');if(!el)return;
 const shell=el.dataset.shell;
 if(shell==='menu'){e.preventDefault();if(phone()&&global.MoreSheet){global.MoreSheet.toggle(el);return}setOpen(!root.classList.contains('nav-open'));return}
 if(shell==='close'){setOpen(false);return}
 if(shell==='mini'){e.preventDefault();setMini(!isMini());doc.querySelector('[data-shell="mini"]')?.focus?.({preventScroll:true});return}
 if(shell==='skip'){const main=doc.querySelector('#main-content');main?.focus({preventScroll:true});main?.scrollIntoView({block:'start'});return}
 if(shell==='install'){e.preventDefault();global.PWA?.install();return}
 if(root.classList.contains('nav-open'))setOpen(false);
},true);
// Close open dropdown menus (details.data-menu) on outside click or Escape.
doc.addEventListener('click',e=>{for(const m of doc.querySelectorAll('details.data-menu[open]'))if(!m.contains(e.target))m.open=false});
doc.addEventListener('keydown',e=>{if(e.key==='Tab'){trap(e);return}if(e.key!=='Escape')return;for(const m of doc.querySelectorAll('details.data-menu[open]')){m.open=false;m.querySelector('summary')?.focus()}if(root.classList.contains('nav-open')){setOpen(false);doc.querySelector('.menu-toggle')?.focus()}});
global.addEventListener('popstate',()=>setOpen(false));
global.matchMedia?.('(min-width: 821px)').addEventListener?.('change',e=>{if(e.matches)setOpen(false)});
global.ShellUI={setOpen,sync,setMini,isMini,trap,MINI_KEY};
})(window);
