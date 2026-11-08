/* Mobile shell behaviour: slide-out section menu, bottom bar and the install button.
   Pure presentation: never touches saved data. */
(function(global){
'use strict';
const doc=global.document,root=doc.documentElement;
function setOpen(open){
 root.classList.toggle('nav-open',open);
 for(const b of doc.querySelectorAll('[data-shell="menu"]'))b.setAttribute('aria-expanded',String(open));
 if(open)doc.querySelector('#app-sidebar .nav-item.active, #app-sidebar .nav-item')?.focus({preventScroll:true});
}
// Capture phase: app.js handles data-action clicks on #app; this only closes the drawer.
doc.addEventListener('click',e=>{
 const el=e.target.closest?.('[data-shell],[data-action="navigate"],[data-action="open"]');if(!el)return;
 const shell=el.dataset.shell;
 if(shell==='menu'){e.preventDefault();setOpen(!root.classList.contains('nav-open'));return}
 if(shell==='close'){setOpen(false);return}
 if(shell==='install'){e.preventDefault();global.PWA?.install();return}
 if(root.classList.contains('nav-open'))setOpen(false);
},true);
doc.addEventListener('keydown',e=>{if(e.key==='Escape'&&root.classList.contains('nav-open')){setOpen(false);doc.querySelector('.menu-toggle')?.focus()}});
global.addEventListener('popstate',()=>setOpen(false));
global.matchMedia?.('(min-width: 821px)').addEventListener?.('change',e=>{if(e.matches)setOpen(false)});
global.ShellUI={setOpen};
})(window);
