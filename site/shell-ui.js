/* Mobile shell behaviour: slide-out section menu, bottom bar and the install button.
   Pure presentation: never touches saved data. */
(function(global){
'use strict';
const doc=global.document,root=doc.documentElement;
let focusTimer=0;
// The page is redrawn as a whole, so the state of the drawer is put back on the new elements after every redraw.
function sync(){
 const open=root.classList.contains('nav-open');
 for(const b of doc.querySelectorAll('[data-shell="menu"]'))b.setAttribute('aria-expanded',String(open));
 // While the drawer is open, what lies under the dimmed layer cannot be reached by Tab or by a screen reader.
 for(const el of doc.querySelectorAll('.app-shell .content, .app-shell .top-context, .app-shell .top-actions'))el.inert=open;
}
function setOpen(open){
 const was=root.classList.contains('nav-open');
 root.classList.toggle('nav-open',open);
 sync();
 clearTimeout(focusTimer);
 // The drawer slides in and is not focusable until it is visible: move the focus when the slide has finished.
 if(open)focusTimer=setTimeout(()=>{if(root.classList.contains('nav-open'))doc.querySelector('#app-sidebar .nav-item.active, #app-sidebar .nav-item')?.focus({preventScroll:true})},260);
 else if(was&&doc.querySelector('#app-sidebar')?.contains(doc.activeElement))doc.querySelector('.menu-toggle')?.focus({preventScroll:true});
}
// Capture phase: app.js handles data-action clicks on #app; this only closes the drawer.
doc.addEventListener('click',e=>{
 const el=e.target.closest?.('[data-shell],[data-action="navigate"],[data-action="open"]');if(!el)return;
 const shell=el.dataset.shell;
 if(shell==='menu'){e.preventDefault();setOpen(!root.classList.contains('nav-open'));return}
 if(shell==='close'){setOpen(false);return}
 if(shell==='skip'){const main=doc.querySelector('#main-content');main?.focus({preventScroll:true});main?.scrollIntoView({block:'start'});return}
 if(shell==='install'){e.preventDefault();global.PWA?.install();return}
 if(root.classList.contains('nav-open'))setOpen(false);
},true);
// Close open dropdown menus (details.data-menu) on outside click or Escape.
doc.addEventListener('click',e=>{for(const m of doc.querySelectorAll('details.data-menu[open]'))if(!m.contains(e.target))m.open=false});
doc.addEventListener('keydown',e=>{if(e.key!=='Escape')return;for(const m of doc.querySelectorAll('details.data-menu[open]')){m.open=false;m.querySelector('summary')?.focus()}if(root.classList.contains('nav-open')){setOpen(false);doc.querySelector('.menu-toggle')?.focus()}});
global.addEventListener('popstate',()=>setOpen(false));
global.matchMedia?.('(min-width: 821px)').addEventListener?.('change',e=>{if(e.matches)setOpen(false)});
global.ShellUI={setOpen,sync};
})(window);
