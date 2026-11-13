/* "/" jumps to the search field of the page on a desktop (catalog, rules, skills filter, book search...),
   unless the person is already typing somewhere, a dialog is open, or a modifier key is held. */
(function(global){
'use strict';
const SELECTOR='#catalog-search,#rules-search,input[type="search"]';
const typing=el=>{
 if(!el||el.nodeType!==1)return false;
 const tag=String(el.tagName||'').toUpperCase();
 return tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||el.isContentEditable===true;
};
const visible=el=>{
 if(!el||el.disabled||el.readOnly||el.type==='hidden')return false;
 if(el.closest?.('[hidden],[inert]'))return false;
 return el.offsetParent!==null||el.getClientRects?.().length>0;
};
function target(doc){
 if(doc.querySelector?.('dialog[open],[aria-modal="true"]'))return null;
 for(const el of doc.querySelectorAll?.(SELECTOR)||[])if(visible(el))return el;
 return null;
}
function desktop(){try{return !global.matchMedia||global.matchMedia('(pointer: fine)').matches}catch{return true}}
function handle(e,doc=global.document){
 if(!e||e.key!=='/'||e.defaultPrevented||e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return false;
 if(typing(e.target)||typing(doc.activeElement))return false;
 if(!desktop())return false;
 const el=target(doc);if(!el)return false;
 e.preventDefault();el.focus();try{el.select?.()}catch{}return true;
}
try{global.document?.addEventListener('keydown',e=>handle(e))}catch{}
global.SearchKey={handle,target};
})(window);
