/* «Не гасить экран»: holds a Screen Wake Lock while the player wants it, so a phone
   lying on the table stays lit between rolls. The lock is lost whenever the tab is
   hidden, so it is taken again when the tab comes back. Where the browser has no
   Wake Lock, the button is not offered. */
(function(global){
'use strict';
const doc=global.document,KEY='nc-keep-awake';
let wanted=false,lock=null,pending=false;
try{wanted=global.localStorage?.getItem(KEY)==='1'}catch{}
const supported=()=>typeof global.navigator?.wakeLock?.request==='function';
const visible=()=>doc.visibilityState===undefined||doc.visibilityState==='visible';
function paint(){
 for(const b of doc.querySelectorAll?.('[data-keep-awake]')||[]){b.setAttribute('aria-pressed',String(wanted));b.classList.toggle('active',wanted)}
}
async function acquire(){
 if(!wanted||lock||pending||!supported()||!visible())return false;
 pending=true;
 try{
  const got=await global.navigator.wakeLock.request('screen');
  if(!wanted){try{await got.release?.()}catch{}return false}
  lock=got;got.addEventListener?.('release',()=>{if(lock===got)lock=null});
  return true;
 }catch{return false}finally{pending=false}
}
function release(){const held=lock;lock=null;try{held?.release?.()?.catch?.(()=>{})}catch{}}
function set(on){
 wanted=!!on;
 try{global.localStorage?.setItem(KEY,wanted?'1':'0')}catch{}
 paint();
 if(wanted)return acquire();
 release();return Promise.resolve(false);
}
function label(lang){return lang==='en'?'Keep the screen on':'Не гасить экран'}
// A full button for page headers, a compact chip for the sheet HUD.
function button(lang,compact=false){
 if(!supported())return '';
 const text=label(lang);
 return compact
  ?`<button type="button" class="hud-chip hud-awake${wanted?' active':''}" data-keep-awake aria-pressed="${wanted}" aria-label="${text}" title="${text}"><span aria-hidden="true">☀</span></button>`
  :`<button type="button" class="btn ghost keep-awake${wanted?' active':''}" data-keep-awake aria-pressed="${wanted}"><span aria-hidden="true">☀</span> ${text}</button>`;
}
doc.addEventListener?.('click',e=>{if(e.target?.closest?.('[data-keep-awake]'))set(!wanted)});
doc.addEventListener?.('visibilitychange',()=>{if(visible())acquire()});
if(wanted)acquire();
global.KeepAwake={button,set,supported,label,wanted:()=>wanted,held:()=>!!lock};
})(window);
