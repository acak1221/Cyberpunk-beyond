/* "Clean" (native-like) appearance: the default look. It only changes presentation:
   long help texts collapse to two lines with a "More" toggle, decorative heading
   codes are hidden, and page references become small pills. The original
   cyberpunk look stays available through the Appearance switch. */
(function(global){
'use strict';
const doc=global.document,root=doc.documentElement,KEY='nc-ui-style';
const isNative=()=>root.classList.contains('ui-native');
let filtersOpen=false;
const ru=()=>(root.lang||'ru')!=='en';

function setStyle(style){
 const native=style!=='cyber';
 root.classList.toggle('ui-native',native);
 try{global.localStorage.setItem(KEY,native?'native':'cyber')}catch{}
 paintSwitch();
 if(native)scan(doc.querySelector('#app'));
}
function paintSwitch(){for(const b of doc.querySelectorAll('[data-ui-style]')){const on=(b.dataset.uiStyle==='native')===isNative();b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))}}

// Help and description text that may be long; results and outputs are never collapsed.
const HELP='.rule-card p, .catalog-card p, .page-header p, .cx-help, .et-hint, .rt-help, .hustle-help, .netrun-lead, .gm-note, p.muted, .agent-empty, .sr-note, .nm-note, .gx-note, p[class$="-note"], p[class*="-note "]';
const KEEP='.gm-match, .room-rolls, .room-feed, [aria-live], [role="status"], [role="alert"], .history-card, .nx-open';
const DECO=/^(\d{2}\s*\/\s*[A-Z][A-Z ]*|[A-Z][A-Z]+(\s*\/\/\s*\d+)?|PERSONNEL\s*\/\/\s*\d+)$/;
const PAGE=/^(?:(?:СТР|PP?)\.?\s*)?\d{1,3}(?:\s*[–\-,/]\s*\d{1,3})*(?:,\s*\d{1,3}(?:[–\-]\d{1,3})?)*$/i;

function scan(scope){
 if(!scope||!isNative())return;
 for(const s of scope.querySelectorAll('.card-heading > span:last-child:not([data-nx])')){
  s.dataset.nx='1';const t=s.textContent.trim();
  if(DECO.test(t))s.classList.add('nx-deco');
  else if(PAGE.test(t)){s.classList.add('nx-page');if(/^\d/.test(t))s.textContent=(ru()?'стр. ':'p. ')+t.replace(/\s*\/\s*/g,', ')}
 }
 // Catalog: keep search and category up front; who-to-buy-for and purchase options fold away.
 for(const bar of scope.querySelectorAll('.catalog-toolbar:not([data-nx])')){
  bar.dataset.nx='1';
  const target=bar.querySelector('#catalog-target')?.closest('label'),purchase=bar.nextElementSibling?.classList.contains('catalog-purchase')?bar.nextElementSibling:null;
  if(!target&&!purchase)continue;
  const box=doc.createElement('details');box.className='nx-filters';if(filtersOpen)box.open=true;
  box.innerHTML=`<summary>${ru()?'Покупка для персонажа':'Buy for a character'}</summary><div class="nx-filters-body"></div>`;
  box.addEventListener('toggle',()=>{filtersOpen=box.open});
  const body=box.lastElementChild;if(target)body.appendChild(target);if(purchase)body.appendChild(purchase);
  bar.after(box);
 }
 for(const p of scope.querySelectorAll(HELP)){
  if(p.dataset.nx||p.closest(KEEP)||p.querySelector('input,select,textarea,button'))continue;
  p.dataset.nx='1';
  const long=p.textContent.trim().length>(p.closest('.rule-card,.catalog-card')?130:170);
  if(!long)continue;
  p.classList.add('nx-clamp');
  const b=doc.createElement('button');b.type='button';b.className='nx-more';b.textContent=ru()?'Подробнее':'More';b.setAttribute('aria-expanded','false');
  p.after(b);
 }
}
doc.addEventListener('click',e=>{
 const s=e.target.closest?.('[data-ui-style]');if(s){setStyle(s.dataset.uiStyle);return}
 const more=e.target.closest?.('.nx-more');if(!more)return;
 const p=more.previousElementSibling;if(!p)return;
 const open=p.classList.toggle('nx-open');more.textContent=open?(ru()?'Свернуть':'Less'):(ru()?'Подробнее':'More');more.setAttribute('aria-expanded',String(open));
});

let queued=false;
function schedule(){if(queued)return;queued=true;global.requestAnimationFrame(()=>{queued=false;scan(doc.querySelector('#app'));paintSwitch()})}
function start(){const app=doc.querySelector('#app');if(!app)return;new MutationObserver(schedule).observe(app,{childList:true,subtree:true});schedule()}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start);else start();
global.NativeUI={setStyle,isNative,scan};
})(window);
