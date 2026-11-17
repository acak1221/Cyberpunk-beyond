/* Quick dice: a small floating d10 button on every screen that has no dice of its own. It opens a sheet with a d10 check
   (STAT + skill + modifier), 1d6…4d6, 1d10, d100 and the last five rolls. Every roll goes through Rolls, so the history and
   the room feed get it and the result chip shows it. The button is not shown in print, while another dialog is open,
   or on the Dice screen; a switch in the sheet hides it on this device (UIMemory quick-dice-off). */
(function(global){
'use strict';
const doc=global.document;
const T={
 ru:{
  fab:'Быстрые кубики',title:'Быстрые кубики',close:'Закрыть',check:'Проверка d10',stat:'Характеристика',skill:'Навык',mod:'Модификатор',roll:'Бросить d10',
  plain:'Простые кубики',last:'Последние броски',none:'Бросков пока нет.',again:'Повторить',showFab:'Показывать плавающую кнопку',side:'Кнопка слева, а не справа',
  total:n=>`Итог ${n}`
 },
 en:{
  fab:'Quick dice',title:'Quick dice',close:'Close',check:'d10 check',stat:'Stat',skill:'Skill',mod:'Modifier',roll:'Roll d10',
  plain:'Plain dice',last:'Last rolls',none:'No rolls yet.',again:'Roll again',showFab:'Show the floating button',side:'Button on the left, not the right',
  total:n=>`Total ${n}`
 }
};
const L=lang=>lang==='en'?'en':'ru';
const t=(lang,key)=>T[L(lang)][key];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const HIDDEN_VIEWS=['dice'];
const DICE=[[1,6],[2,6],[3,6],[4,6],[1,10],[1,100]];
const MEM='quick-dice',OFF='quick-dice-off',FOCUSABLE='button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';
const int=(v,lo,hi,fallback)=>{const n=Number(v);return v!==''&&v!==null&&Number.isFinite(n)?Math.max(lo,Math.min(hi,Math.trunc(n))):fallback};

// Whether the floating button is shown: pure, for the tests.
function visible({view,modal=false,printing=false,enabled=true}={}){return enabled&&!modal&&!printing&&!HIDDEN_VIEWS.includes(view)}
// The remembered numbers of the check; anything else is ignored.
function cleanMemory(v){
 if(!v||typeof v!=='object'||Array.isArray(v))return null;
 return {stat:int(v.stat,0,20,0),skill:int(v.skill,0,20,0),mod:int(v.mod,-100,100,0)};
}
const lang=()=>{try{return global.App?.lang?.()==='en'?'en':'ru'}catch{return 'ru'}};
function mem(){
 let v=null;try{v=global.UIMemory?.get(MEM,null,cleanMemory)}catch{}
 if(v)return v;
 try{const d=global.App?.getState?.().diceValues;if(d)return {stat:int(d.stat,0,20,0),skill:int(d.skill,0,20,0),mod:int(d.modifier,-100,100,0)}}catch{}
 return {stat:0,skill:0,mod:0};
}
const SIDE='quick-dice-left';
const onLeft=()=>{try{return global.UIMemory?.get(SIDE,false,v=>v===true)===true}catch{return false}};
const enabled=()=>{try{return global.UIMemory?.get(OFF,false,v=>v===true)!==true}catch{return true}};

function lastRolls(){try{return (global.RollHistory?.all?.()||[]).slice(0,5)}catch{return []}}
function rowsHTML(l){
 const rolls=lastRolls();
 if(!rolls.length)return `<p class="qd-none">${esc(t(l,'none'))}</p>`;
 return `<ul class="qd-rows">${rolls.map((r,i)=>`<li><span class="qd-row-text"><strong>${esc(r.label)}</strong><small>${esc(r.detail)}</small></span><b class="qd-row-total">${esc(r.total)}</b>${r.replay?`<button type="button" class="btn small ghost" data-qd-again="${i}" aria-label="${esc(t(l,'again')+': '+r.label)}">${esc(t(l,'again'))}</button>`:''}</li>`).join('')}</ul>`;
}
function sheetHTML(l){
 const m=mem(),field=(k,label,min,max)=>`<label class="qd-field"><span>${esc(label)}</span><input type="number" inputmode="numeric" data-qd-field="${k}" min="${min}" max="${max}" value="${m[k]}"></label>`;
 return `<div class="qd-head"><h2 id="qd-title">${esc(t(l,'title'))}</h2><button type="button" class="qd-close" data-qd-close aria-label="${esc(t(l,'close'))}">✕</button></div><section class="qd-sec" aria-labelledby="qd-check-h"><h3 id="qd-check-h">${esc(t(l,'check'))}</h3><div class="qd-fields">${field('stat',t(l,'stat'),0,20)}${field('skill',t(l,'skill'),0,20)}${field('mod',t(l,'mod'),-100,100)}</div><button type="button" class="btn primary qd-roll" data-qd-check>${esc(t(l,'roll'))} <span aria-hidden="true">⬡</span></button></section><section class="qd-sec" aria-labelledby="qd-plain-h"><h3 id="qd-plain-h">${esc(t(l,'plain'))}</h3><div class="qd-dice">${DICE.map(([n,f])=>`<button type="button" class="btn ghost qd-die" data-qd-dice="${n}d${f}">${n===1&&f===100?'d100':`${n}d${f}`}</button>`).join('')}</div></section><section class="qd-sec" aria-labelledby="qd-last-h"><h3 id="qd-last-h">${esc(t(l,'last'))}</h3><div id="qd-last">${rowsHTML(l)}</div></section><label class="qd-switch"><input type="checkbox" data-qd-fab${enabled()?' checked':''}> <span>${esc(t(l,'showFab'))}</span></label><label class="qd-switch"><input type="checkbox" data-qd-side${onLeft()?' checked':''}> <span>${esc(t(l,'side'))}</span></label>`;
}

let fab=null,sheet=null,backdrop=null,opener=null,appEl=null,viewNow='overview';
function modalOpen(){
 try{
  const open=doc.querySelector('dialog[open],[aria-modal="true"]');
  if(open&&open!==sheet)return true;
  return doc.documentElement.classList.contains('nav-open');
 }catch{return false}
}
function ensureFab(){
 if(fab||!doc?.body||typeof doc.createElement!=='function')return fab;
 fab=doc.createElement('button');fab.type='button';fab.className='qd-fab';fab.setAttribute('data-quick-dice-open','');fab.setAttribute('aria-haspopup','dialog');
 fab.innerHTML=`<span aria-hidden="true">${global.Icons?.dice||'⬡'}</span>`;
 doc.body.appendChild(fab);
 return fab;
}
function sync(view){
 if(typeof view==='string')viewNow=view;
 const b=ensureFab();if(!b)return false;
 const l=lang();
 b.setAttribute('aria-label',t(l,'fab'));b.setAttribute('title',t(l,'fab'));
 // While the sheet itself is open it is the dialog; the button is hidden behind it anyway.
 b.classList.toggle('qd-left',onLeft());
 b.hidden=!visible({view:viewNow,modal:modalOpen()||!!sheet,enabled:enabled()});
 return !b.hidden;
}
function open(trigger){
 if(sheet||!doc?.body)return false;
 try{global.MoreSheet?.close?.({restore:false});global.CommandPalette?.close?.({restore:false})}catch{}
 const l=lang(),a=trigger&&trigger.nodeType===1?trigger:doc.activeElement;opener=a&&a!==doc.body?a:null;
 backdrop=doc.createElement('div');backdrop.className='qd-backdrop';backdrop.setAttribute('data-qd-close','');
 sheet=doc.createElement('div');sheet.className='qd-sheet';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-labelledby','qd-title');
 sheet.innerHTML=sheetHTML(l);
 doc.body.append(backdrop,sheet);
 appEl=doc.querySelector('#app');if(appEl)appEl.inert=true;
 sync();
 sheet.querySelector('[data-qd-check]')?.focus?.({preventScroll:true});
 return true;
}
function close({restore=true}={}){
 if(!sheet)return false;
 const s=sheet,b=backdrop,back=opener,app=appEl;sheet=null;backdrop=null;opener=null;appEl=null;
 try{s.remove();b?.remove()}catch{}
 try{if(app)app.inert=false}catch{}
 sync();
 if(restore){try{const target=back&&back.isConnected!==false&&back!==doc.body?back:fab&&!fab.hidden?fab:doc.querySelector('#main-content');target?.focus?.({preventScroll:true})}catch{}}
 return true;
}
function readCheck(){
 const v=k=>sheet?.querySelector?.(`[data-qd-field="${k}"]`)?.value;
 return {stat:int(v('stat'),0,20,0),skill:int(v('skill'),0,20,0),mod:int(v('mod'),-100,100,0)};
}
function rollCheck(){
 const m=readCheck();
 try{global.UIMemory?.set(MEM,m)}catch{}
 const total=global.Rolls?.quickCheck?.({...m});
 afterRoll();return total;
}
function rollDice(spec){
 const m=/^(\d{1,2})d(\d{1,3})$/.exec(String(spec||''));if(!m)return null;
 const total=global.Rolls?.quickDice?.(Number(m[1]),Number(m[2]));
 afterRoll();return total;
}
// The list of last rolls is drawn again; the focus stays on the button that was pressed (the sheet is not redrawn).
function afterRoll(){
 if(!sheet)return;
 const box=sheet.querySelector('#qd-last');if(box)box.innerHTML=rowsHTML(lang());
}
function trap(e){
 if(!sheet)return false;
 if(e.key==='Escape'){e.preventDefault?.();close();return true}
 if(e.key!=='Tab')return false;
 const items=[...sheet.querySelectorAll(FOCUSABLE)];if(!items.length)return false;
 const first=items[0],last=items[items.length-1],cur=doc.activeElement;
 if(!sheet.contains(cur)||(e.shiftKey&&cur===first)){e.preventDefault?.();(e.shiftKey?last:first).focus({preventScroll:true});return true}
 if(!e.shiftKey&&cur===last){e.preventDefault?.();first.focus({preventScroll:true});return true}
 return false;
}
if(doc?.addEventListener){
 doc.addEventListener('keydown',e=>{
  trap(e);
  // Enter in a number field rolls the check.
  if(sheet&&e.key==='Enter'&&e.target?.dataset?.qdField!==undefined){e.preventDefault?.();rollCheck()}
 },true);
 doc.addEventListener('click',e=>{
  const o=e.target?.closest?.('[data-quick-dice-open]');
  if(o&&!sheet){e.preventDefault?.();open(o);return}
  if(!sheet)return;
  if(e.target?.closest?.('[data-qd-close]')){close();return}
  if(e.target?.closest?.('[data-qd-check]')){rollCheck();return}
  const die=e.target?.closest?.('[data-qd-dice]');if(die){rollDice(die.dataset.qdDice);return}
  const again=e.target?.closest?.('[data-qd-again]');
  if(again){const r=lastRolls()[Number(again.dataset.qdAgain)];if(r?.replay)global.RollHistory?.replay?.(r.replay);afterRoll()}
 });
 doc.addEventListener('change',e=>{
  if(e.target?.matches?.('[data-qd-side]')){try{global.UIMemory?.set(SIDE,e.target.checked===true)}catch{}sync()}
  if(e.target?.matches?.('[data-qd-fab]')){try{global.UIMemory?.set(OFF,!e.target.checked)}catch{}sync()}
 });
 try{
  if(typeof global.MutationObserver==='function'){
   const mo=new global.MutationObserver(()=>{if(fab)sync()});
   mo.observe(doc.documentElement,{attributes:true,attributeFilter:['class']});
   mo.observe(doc.body||doc.documentElement,{childList:true});
  }
 }catch{}
}
global.QuickDice={onLeft,visible,cleanMemory,open,close,sync,rollCheck,rollDice,sheetHTML,rowsHTML,HIDDEN_VIEWS,DICE,t};
})(typeof window!=='undefined'?window:globalThis);
