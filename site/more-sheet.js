/* «More»: a sheet with grouped icon tiles for every section, opened by the last button of the phone bottom bar and by the
   hamburger on a phone. It does not keep a list of its own: the tiles are read from the section menu the app has just drawn
   (so the role, the groups and the markers always agree), and the sheet is drawn again after every page redraw while it is open.
   A labelled dialog: Tab stays inside, Escape and the backdrop close it, the focus returns to the button that opened it. */
(function(global){
'use strict';
const doc=global.document;
const T={
 ru:{title:'Все разделы',close:'Закрыть',settings:'Настройки',app:'Приложение'},
 en:{title:'All sections',close:'Close',settings:'Settings',app:'App'}
};
const L=lang=>lang==='en'?'en':'ru';
const t=(lang,key)=>T[L(lang)][key];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const VIEW=/^[a-z][a-z-]{0,30}$/;
const FOCUSABLE='button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/* groups: [{label, items:[{view, label, icon, extra, active}]}]. Pure: used by the tests. `icon` and `extra` are markup the
   app drew itself (an inline SVG, a «new» dot); everything else is escaped. Items with a view that is not a plain route name are dropped. */
function build(groups,{lang='ru',role=''}={}){
 const body=(Array.isArray(groups)?groups:[]).map(g=>{
  const items=(Array.isArray(g?.items)?g.items:[]).filter(i=>i&&VIEW.test(String(i.view||''))&&String(i.label||'').trim());
  if(!items.length)return '';
  return `<section class="more-group"><h3>${esc(g.label||'')}</h3><div class="more-grid">${items.map(i=>`<button type="button" class="more-tile${i.active?' active':''}" data-more-view="${esc(i.view)}"${i.active?' aria-current="page"':''}><span class="more-icon" aria-hidden="true">${i.icon||''}</span><span class="more-label">${esc(i.label)}</span>${i.extra||''}</button>`).join('')}</div></section>`;
 }).join('');
 return `<div class="more-handle" aria-hidden="true"></div><div class="more-head"><h2 id="more-sheet-title">${esc(t(lang,'title'))}</h2><button type="button" class="more-close" data-more-close aria-label="${esc(t(lang,'close'))}">✕</button></div><div class="more-body">${body}${role||''}</div>`;
}
// Reads the section menu the app drew: group labels, nav items, the settings item.
function read(root,lang){
 const side=root?.querySelector?.('#app-sidebar');if(!side)return [];
 const groups=[];let cur=null;
 for(const el of side.querySelectorAll('.nav-group-label, .nav-item')){
  if(el.classList.contains('nav-group-label')){cur={label:el.textContent.trim(),items:[]};groups.push(cur);continue}
  const view=el.dataset?.view;if(!view)continue;
  const text=el.querySelector('.nav-text')?.textContent?.trim()||el.getAttribute('title')||'';
  const extra=[...el.children].filter(c=>!c.classList.contains('nav-icon')&&!c.classList.contains('nav-text')&&!c.classList.contains('nav-arrow')).map(c=>c.outerHTML).join('');
  const item={view,label:text,icon:el.querySelector('.nav-icon')?.innerHTML||'',extra,active:el.classList.contains('active')};
  if(el.classList.contains('drawer-settings')){groups.push({label:t(lang,'settings'),items:[item]});continue}
  (cur||(cur={label:'',items:[]},groups.push(cur),cur)).items.push(item);
 }
 return groups;
}

let sheet=null,backdrop=null,opener=null,appEl=null;
const lang=()=>{try{return global.App?.lang?.()==='en'?'en':'ru'}catch{return 'ru'}};
const isOpen=()=>!!sheet;
function markers(open){
 try{for(const b of doc.querySelectorAll('[data-shell="menu"]'))b.setAttribute('aria-expanded',String(open))}catch{}
}
function draw(){
 const l=lang(),role=global.RoleMode?.switchHTML?.(l)||'';
 sheet.innerHTML=build(read(doc,l),{lang:l,role});
}
function open(trigger){
 if(sheet||!doc?.body)return false;
 const a=trigger||doc.activeElement;opener=a&&a!==doc.body?a:null;
 backdrop=doc.createElement('div');backdrop.className='more-backdrop';backdrop.setAttribute('data-more-close','');
 sheet=doc.createElement('div');sheet.id='more-sheet';sheet.className='more-sheet';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-labelledby','more-sheet-title');
 draw();
 doc.body.append(backdrop,sheet);
 appEl=doc.querySelector('#app');if(appEl)appEl.inert=true;
 doc.documentElement.classList.add('more-open');markers(true);
 (sheet.querySelector('.more-tile.active')||sheet.querySelector('.more-tile'))?.focus?.({preventScroll:true});
 return true;
}
function close({restore=true}={}){
 if(!sheet)return false;
 const s=sheet,b=backdrop,back=opener,app=appEl;sheet=null;backdrop=null;opener=null;appEl=null;
 try{s.remove();b?.remove()}catch{}
 try{if(app)app.inert=false}catch{}
 doc.documentElement.classList.remove('more-open');markers(false);
 if(restore){
  const target=back&&back.isConnected!==false&&back!==doc.body?back:doc.querySelector('.bottom-nav [data-shell="menu"]')||doc.querySelector('#main-content');
  try{target?.focus?.({preventScroll:true})}catch{}
 }
 return true;
}
function toggle(trigger){return sheet?close():open(trigger)}
// The page was drawn again while the sheet is open (the role changed): the tiles follow, the focus stays on the same control.
function refresh(){
 if(!sheet)return false;
 const was=doc.activeElement,key=was&&sheet.contains(was)?(was.dataset?.moreView?`[data-more-view="${was.dataset.moreView}"]`:was.dataset?.roleSet?`[data-role-set="${was.dataset.roleSet}"]`:was.hasAttribute?.('data-more-close')?'[data-more-close]':''):'';
 draw();
 appEl=doc.querySelector('#app')||appEl;if(appEl)appEl.inert=true;
 if(key)sheet.querySelector(key)?.focus?.({preventScroll:true});
 return true;
}
function go(view){
 if(!VIEW.test(String(view||'')))return false;
 close({restore:false});
 const ok=(global.App?.navigate||global.App?.setView)?.call(global.App,view)===true;
 try{const a=doc.activeElement;if(!a||a===doc.body)doc.querySelector('#main-content')?.focus?.({preventScroll:true})}catch{}
 return ok;
}
function trap(e){
 if(!sheet)return false;
 if(e.key==='Escape'){e.preventDefault?.();close();return true}
 if(e.key!=='Tab')return false;
 const items=[...sheet.querySelectorAll(FOCUSABLE)].filter(x=>!x.hidden&&(typeof x.getClientRects!=='function'||x.getClientRects().length>0));
 if(!items.length)return false;
 const first=items[0],last=items[items.length-1],cur=doc.activeElement;
 if(!sheet.contains(cur)||(e.shiftKey&&cur===first)){e.preventDefault?.();(e.shiftKey?last:first).focus({preventScroll:true});return true}
 if(!e.shiftKey&&cur===last){e.preventDefault?.();first.focus({preventScroll:true});return true}
 return false;
}
if(doc?.addEventListener){
 doc.addEventListener('keydown',e=>{trap(e)},true);
 doc.addEventListener('click',e=>{
  if(!sheet)return;
  const tile=e.target?.closest?.('[data-more-view]');
  if(tile&&sheet.contains(tile)){e.preventDefault?.();go(tile.dataset.moreView);return}
  if(e.target?.closest?.('[data-more-close]'))close();
 });
 global.addEventListener?.('popstate',()=>close({restore:false}));
}
global.MoreSheet={build,read,open,close,toggle,refresh,isOpen,go,trap};
})(typeof window!=='undefined'?window:globalThis);
