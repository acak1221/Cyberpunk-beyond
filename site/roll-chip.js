/* The result of a roll as a compact chip at the top of the screen: dice faces, the total, the verdict, «Details» and «Roll again».
   It replaces the large sheet that used to cover the list. The chip is the app's own #app-notice drawn in the roll style;
   this module gives it its content, keeps it while it is hovered or has the focus, and takes it away at once when the person
   moves to another tab or screen, so it never stays over content it does not belong to. parse() and body() are pure. */
(function(global){
'use strict';
const doc=global.document;
const T={
 ru:{more:'Подробнее',less:'Скрыть',ok:'успех',bad:'провал'},
 en:{more:'Details',less:'Hide',ok:'success',bad:'failure'}
};
const L=lang=>lang==='en'?'en':'ru';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// «Label: total» on the first line, the arithmetic after it. A verdict is read only when the detail ends with one (a check against a DV).
function parse(text){
 const lines=String(text??'').split('\n'),title=(lines.shift()||'').trim(),detail=lines.join('\n').trim();
 const m=/—\s*(успех|провал|success|failure)\s*$/i.exec(detail);
 const verdict=m?(/^(успех|success)$/i.test(m[1])?'ok':'bad'):'';
 return {title,detail,verdict};
}
// faces: the dice markup the app drew (it is already escaped).
function body(text,lang,faces){
 const t=T[L(lang)],p=parse(text);
 const verdict=p.verdict?`<b class="roll-verdict ${p.verdict}">${esc(t[p.verdict])}</b>`:'';
 const more=p.detail?`<button type="button" class="btn small ghost roll-more" data-roll-more aria-expanded="false" aria-controls="roll-detail">${esc(t.more)}</button>`:'';
 return `<span class="roll-title">${esc(p.title)}${verdict}</span>${faces||''}${p.detail?`<span class="roll-detail" id="roll-detail" hidden>${esc(p.detail)}</span>`:''}<span class="roll-actions">${more}</span>`;
}
let armedKey=null,currentKey=null,armedAt=0,keyboardMode=false;
const KEYBOARD_HOLD=30000;
const noticeBox=()=>{try{return doc.querySelector('#app-notice')}catch{return null}};
// Called by the app each time it draws a screen, with the screen's identity (view, sheet, sheet tab).
function setScreen(key){
 if(armedKey!==null&&key!==armedKey)dismiss();
 currentKey=key;
}
function arm(){armedKey=currentKey;armedAt=Date.now()}
function dismiss(){
 const box=noticeBox();
 if(box?.classList?.contains('roll-notice'))box.classList.remove('visible');
 armedKey=null;
}
// The timer of the app asks before it hides the chip: not while the pointer is over it or the focus is inside it.
// Someone who works with the keyboard cannot hover and may not reach the chip in 6 seconds: the chip stays up to 30 s for them (Escape, a new screen or Alt+J).
function holds(box){
 try{return !!box&&(box.matches?.(':hover')===true||box.contains?.(doc.activeElement)===true||(keyboardMode&&Date.now()-armedAt<KEYBOARD_HOLD))}catch{return false}
}
// Moves the focus to the chip's first button (Details or Again). False when no chip is showing.
function focus(){
 const box=noticeBox();if(!box?.classList?.contains('roll-notice')||!box.classList.contains('visible'))return false;
 const b=box.querySelector?.('button');if(!b)return false;
 try{b.focus({preventScroll:true})}catch{return false}
 return true;
}
// Escape inside the chip takes it away and gives the focus back to the page content.
function escape(e){
 const box=noticeBox();if(e?.key!=='Escape'||!box?.contains?.(doc.activeElement))return false;
 dismiss();try{doc.querySelector('#main-content')?.focus?.({preventScroll:true})}catch{}return true;
}
function toggleDetail(btn){
 const box=btn.closest?.('#app-notice'),detail=box?.querySelector?.('.roll-detail');if(!detail)return false;
 const t=T[L(doc.documentElement?.lang)],open=detail.hidden;
 detail.hidden=!open;btn.setAttribute('aria-expanded',String(open));btn.textContent=open?t.less:t.more;
 box.classList.toggle('open',open);
 return true;
}
if(doc?.addEventListener){
 doc.addEventListener('click',e=>{
  const more=e.target?.closest?.('[data-roll-more]');
  if(more){toggleDetail(more);return}
  // Going somewhere else takes the chip away at once.
  if(e.target?.closest?.('[data-sheet-tab],[role="tab"],.nav-item,[data-action="navigate"],[data-more-view],.bottom-nav button,[data-shell="menu"],[data-view]'))dismiss();
 },true);
 doc.addEventListener('keydown',e=>{
  keyboardMode=true;
  if(e.altKey&&!e.ctrlKey&&!e.metaKey&&String(e.key).toLowerCase()==='j'){if(focus())e.preventDefault?.();return}
  if(escape(e))e.preventDefault?.();
 },true);
 doc.addEventListener('pointerdown',()=>{keyboardMode=false},true);
 global.addEventListener?.('hashchange',dismiss);
 global.addEventListener?.('popstate',dismiss);
}
global.RollChip={parse,body,setScreen,arm,dismiss,holds,toggleDetail,focus,escape};
})(typeof window!=='undefined'?window:globalThis);
