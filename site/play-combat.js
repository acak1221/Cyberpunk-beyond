/* The player's fight on the sheet: what a person at the table needs between «my turn» and «next».
   Pure rules are in the first half (tested in tests/play-combat.test.cjs); the second half is the small amount of DOM work.
   Nothing here changes a character by itself: the app calls in, gets a plan and saves the way it always does. */
(function(global){
'use strict';
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const int=(v,lo,hi)=>Math.max(lo,Math.min(hi,Math.trunc(num(v))));

/* ---------- 1. The page keeps its place when the sheet is drawn again ----------
   Every saving action (a shot, «−1», a reload) redraws the whole sheet. The browser then «anchors» the scroll to whatever
   block it finds, and on a phone in the «Досье» look the page ran away by a screen. The tapped control is remembered here
   by a selector, and after the redraw the page is moved so that the control is where the finger left it. */
const cssText=v=>String(v).replace(/["\\]/g,'\\$&');
// A selector that finds the same control after the HTML has been replaced: tag, id or data-attributes, and its number among equals.
function markOf(el,root){
 try{
  if(!el||!root||typeof el.getAttribute!=='function')return null;
  let sel=String(el.tagName||'').toLowerCase();if(!sel)return null;
  if(el.id)sel+=`[id="${cssText(el.id)}"]`;
  else{
   const attrs=[...(el.attributes||[])].filter(a=>a.name.startsWith('data-')&&a.value.length<=120);
   if(!attrs.length&&!el.getAttribute('name'))return null;
   for(const a of attrs)sel+=`[${a.name}="${cssText(a.value)}"]`;
   if(el.getAttribute('name'))sel+=`[name="${cssText(el.getAttribute('name'))}"]`;
  }
  return {sel,index:Math.max(0,[...root.querySelectorAll(sel)].indexOf(el))};
 }catch{return null}
}
// How far to move the page: the control was at `before` px from the top of the screen and is now at `after`.
function scrollFix(before,after){const d=Math.round(num(after)-num(before));return Math.abs(d)<1?0:d}
let touched=null,touchedAt=0,lastScreen=null;
function remember(e){
 const t=e?.target?.closest?.('button,select,input,textarea,summary,a,[data-action],[data-cx-action]');
 if(t){touched=t;touchedAt=Date.now()}
}
/* Called by the app right before a redraw; returns the function to call right after it. `screen` names what is shown
   (view + character): a change of screen is navigation, and navigation decides the scroll itself. */
function keepPlace(screen){
 const doc=global.document,win=global;
 try{
  const same=lastScreen===screen;lastScreen=screen;
  if(!same||!doc?.querySelector||typeof win.scrollBy!=='function')return null;
  const root=doc.body,y=win.scrollY;
  const el=touched&&touched.isConnected&&Date.now()-touchedAt<4000&&touched.getClientRects?.().length?touched:null;
  const mark=el?markOf(el,root):null,top=el?el.getBoundingClientRect().top:0;
  let expected=null;
  const fix=()=>{
   try{
    // Somebody else has scrolled since (a link to a section, «to the top»): leave it.
    if(expected!==null&&Math.abs(win.scrollY-expected)>1)return;
    const now=mark?root.querySelectorAll(mark.sel)[mark.index]:null;
    if(now&&now.getClientRects?.().length){const d=scrollFix(top,now.getBoundingClientRect().top);if(d)win.scrollBy(0,d)}
    else if(Math.abs(win.scrollY-y)>1)win.scrollTo(0,y);
    expected=win.scrollY;
   }catch{}
  };
  return ()=>{
   fix();
   // The looks finish their layout after the redraw (the chips of «Досье» in a microtask, the native look in a frame).
   try{global.queueMicrotask?.(fix)}catch{}
   try{global.requestAnimationFrame?.(()=>{fix();global.requestAnimationFrame?.(fix)})}catch{}
  };
 }catch{return null}
}

const API={markOf,scrollFix,keepPlace};
try{
 const doc=global.document;
 if(doc?.addEventListener)for(const type of ['pointerdown','click','change','input'])doc.addEventListener(type,remember,true);
}catch{}
global.PlayCombat=API;
})(window);
