/* Roll history that survives a reload. The last 50 rolls live in this browser's own localStorage key
   (nc-roll-history), never in the saved app state or in backups. A roll that can be repeated (a check, plain dice)
   carries a small recipe; «Roll again» rolls it afresh through App with the same numbers. */
(function(global){
'use strict';
const KEY='nc-roll-history',MAX=50;
let list=[],undoStack=null,loaded=false;
const int=v=>{const n=Number(v);return v!==null&&v!==''&&Number.isFinite(n)?Math.trunc(n):null};
const lang=()=>{try{return global.App?.lang?.()==='en'?'en':'ru'}catch{return 'ru'}};
const T={ru:{again:'Повторить бросок',clear:'Очистить историю',undo:'Вернуть',cleared:'История очищена.',empty:'Пока бросков нет.'},
 en:{again:'Roll again',clear:'Clear history',undo:'Undo',cleared:'History cleared.',empty:'No rolls yet.'}};
const tr=k=>T[lang()][k];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function cleanReplay(r){
 if(!r||typeof r!=='object')return null;
 if(r.kind==='check'){const stat=int(r.stat),skill=int(r.skill),mod=int(r.mod),dv=int(r.dv)||0;
  if(stat===null||skill===null||mod===null)return null;
  return {kind:'check',stat,skill,mod,dv:dv>0&&dv<=99?dv:0,ignoreFumble:r.ignoreFumble===true,label:String(r.label??'').slice(0,140)}}
 if(r.kind==='dice'){const n=int(r.n),s=int(r.sides);
  if(n===null||s===null||n<1||n>50||s<2||s>100)return null;
  return {kind:'dice',n,sides:s,label:String(r.label??'').slice(0,100)}}
 return null;
}
function clean(e){
 if(!e||typeof e!=='object')return null;const total=int(e.total);
 if(total===null||typeof e.label!=='string'||!e.label.trim())return null;
 return {label:e.label.slice(0,140),detail:String(e.detail??'').slice(0,320),total,at:int(e.at)||0,replay:cleanReplay(e.replay)};
}
function load(){
 if(loaded)return;loaded=true;
 try{const raw=JSON.parse(global.localStorage?.getItem(KEY)||'null');
  if(Array.isArray(raw))list=raw.map(clean).filter(Boolean).slice(0,MAX)}catch{list=[]}
}
function store(){try{global.localStorage?.setItem(KEY,JSON.stringify(list))}catch{}}
function all(){load();return list.map(e=>({...e}))}
function refresh(){try{const el=global.document?.querySelector?.('#history-list');if(el)el.innerHTML=rows()}catch{}}
function add(e){
 load();const x=clean({...e,at:e?.at||Date.now()});if(!x)return false;
 list.unshift(x);list=list.slice(0,MAX);undoStack=null;store();refresh();return true;
}
function rows(){
 load();
 if(!list.length)return undoStack?`<p class="muted">${esc(tr('cleared'))} <button type="button" class="text-link" data-rh-undo>${esc(tr('undo'))}</button></p>`:`<p class="muted">${esc(tr('empty'))}</p>`;
 return list.map((r,i)=>`<div class="history-row"><div><strong>${esc(r.label)}</strong><small>${esc(r.detail)}</small>${r.replay?`<button type="button" class="text-link roll-again-link" data-rh-again="${i}">${esc(tr('again'))}</button>`:''}</div><b>${esc(r.total)}</b></div>`).join('');
}
function clear(){load();if(!list.length)return false;undoStack=list;list=[];store();refresh();return true}
function undo(){if(!undoStack)return false;list=undoStack;undoStack=null;store();refresh();return true}
function replay(r){
 const a=global.App;r=cleanReplay(r);if(!a||!r)return false;
 if(r.kind==='check'){a.check(r.stat,r.label,{wounds:false,dv:r.dv,skill:r.skill,mod:r.mod,ignoreFumble:r.ignoreFumble});return true}
 a.dice(r.n,r.sides,r.label);return true;
}
/* Called by the toast of a fresh roll: adds the «Roll again» button. */
function decorate(box,roll){
 const r=cleanReplay(roll?.replay);if(!r||!box?.querySelector)return;
 const body=box.querySelector('.roll-body');if(!body)return;
 const b=global.document.createElement('button');b.type='button';b.className='btn small roll-again';b.textContent=tr('again');
 b.addEventListener('click',()=>replay(r),{once:true});body.append(b);
}
function onClick(ev){
 const t=ev.target?.closest?.('[data-rh-again],[data-rh-undo]');if(!t)return;
 if(t.hasAttribute('data-rh-undo')){undo();return}
 load();const e=list[int(t.getAttribute('data-rh-again'))];if(e)replay(e.replay);
}
try{global.document?.addEventListener('click',onClick)}catch{}
global.RollHistory={all,add,rows,clear,undo,replay,decorate,labels:tr,KEY,MAX};
})(window);
