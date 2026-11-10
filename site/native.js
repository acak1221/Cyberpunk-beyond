/* "Clean" (native-like) appearance: the default look. It only changes presentation:
   long help texts collapse to two lines with a "More" toggle, decorative heading
   codes are hidden, and page references become small pills. The original
   cyberpunk look stays available through the Appearance switch. */
(function(global){
'use strict';
const doc=global.document,root=doc.documentElement,KEY='nc-ui-style';
const isNative=()=>root.classList.contains('ui-native');
const ru=()=>(root.lang||'ru')!=='en';

// Three looks: «Обычное» (native), «Досье» (board: the same clean base laid out as a tabletop character board) and «Киберпанк».
const STYLES=['native','board','cyber'];
const currentStyle=()=>!isNative()?'cyber':root.classList.contains('ui-board')?'board':'native';
function setStyle(style){
 if(!STYLES.includes(style))style='native';
 const native=style!=='cyber';
 root.classList.toggle('ui-native',native);
 root.classList.toggle('ui-board',style==='board');
 try{global.localStorage.setItem(KEY,style)}catch{}
 paintSwitch();
 if(native)scan(doc.querySelector('#app'));else global.App?.render?.(); // bring back the original capitals
 global.SheetTabs?.apply?.(); // the board look lays the sheet out differently on a wide screen
}
function paintSwitch(){const now=currentStyle();for(const b of doc.querySelectorAll('[data-ui-style]')){const on=b.dataset.uiStyle===now;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))}}

// Help and description text that may be long; results and outputs are never collapsed.
const HELP='.rule-card p, .catalog-card p, .page-header p, .cx-help, .et-hint, .rt-help, .hustle-help, .netrun-lead, .gm-note, p.muted, .agent-empty, .sr-note, .nm-note, .gx-note, p[class$="-note"], p[class*="-note "]';
const KEEP='.gm-match, .room-rolls, .room-feed, [aria-live], [role="status"], [role="alert"], .history-card, .nx-open';
const DECO=/^(\d{2}\s*\/\s*[A-Z][A-Z ]*|[A-Z][A-Z]+(\s*\/\/\s*\d+)?|PERSONNEL\s*\/\/\s*\d+)$/;
// Headings written in capitals read as shouting in the clean look. Capitalised words become
// sentence case; game abbreviations (NET, DV, HP, SP, NPC, stats…) and names keep their case.
const CASE='.page-header h1, .section-head h2, .card-heading > span:first-child, .rule-card h3, .catalog-card h3, .rule-source';
const ACRONYMS=new Set('NET DV IP ICE AV NPC NPCS GM HP SP SDP ROF HUM EMP INT REF DEX TECH COOL WILL LUCK MOVE BODY RED EB AI QR PDF ID HUD CP REZ MRE EMG SMG UV DNA NOS KRASH MQTT ЭМИ ИК УФ ИИ ПК'.split(' '));
const NAMES=[[/night city/gi,'Night City'],[/найт[ -]сити/gi,'Найт-Сити'],[/cyberpunk/gi,'Cyberpunk'],[/corebook/gi,'Corebook']];
const CAPS=/^[^a-zа-яё]*$/;
function sentenceCase(text,whole){
 let out=text.replace(/[A-Za-zА-Яа-яЁё]+/g,w=>{if(w!==w.toUpperCase()||ACRONYMS.has(w))return w;if(w.length<2&&!whole)return w;return w.toLowerCase()});
 for(const [re,name] of NAMES)out=out.replace(re,name);
 return out;
}
function recase(el){
 if(el.closest('.sheet-header'))return;
 const nodes=[];const walk=doc.createTreeWalker(el,4);while(walk.nextNode())nodes.push(walk.currentNode);
 const full=nodes.map(n=>n.nodeValue).join('');if(!/[A-ZА-ЯЁ]{2}/.test(full))return;
 const whole=CAPS.test(full);let first=true;
 for(const n of nodes){let v=sentenceCase(n.nodeValue,whole);if(first&&/\p{L}/u.test(v)){v=v.replace(/\p{L}/u,c=>c.toUpperCase());first=false}if(v!==n.nodeValue)n.nodeValue=v}
}
// Page references must be marked: the text starts with a page marker ("СТР. 78–80", "PP. 172") or the
// module flags bare page numbers with data-page-ref. Counters such as "63 / 62", "4 / 300" or "2" stay as they are.
const PAGES=/^\d{1,3}(?:\s*[–\-,/·]\s*\d{1,3})*$/,MARKED=/^(?:СТР|PP?)\.\s*(.+)$/i;
function pageRef(text,explicit,isRu){
 const t=String(text??'').trim(),m=MARKED.exec(t),list=m?m[1]:explicit?t:'';
 if(!PAGES.test(list))return null;
 const pages=list.replace(/\s*[,/·]\s*/g,', ');
 return (isRu?'стр. ':/[,–\-]/.test(pages)?'pp. ':'p. ')+pages;
}

function scan(scope){
 if(!scope||!isNative())return;
 for(const el of scope.querySelectorAll(CASE)){if(el.dataset.nxCase)continue;el.dataset.nxCase='1';recase(el)}
 for(const s of scope.querySelectorAll('.card-heading > span:last-child:not([data-nx])')){
  s.dataset.nx='1';const t=s.textContent.trim(),page=pageRef(t,s.hasAttribute('data-page-ref'),ru());
  if(DECO.test(t))s.classList.add('nx-deco');
  else if(page){s.classList.add('nx-page');s.textContent=page}
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
global.NativeUI={setStyle,isNative,currentStyle,STYLES,scan,sentenceCase,pageRef};
})(window);
