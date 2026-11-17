/* «Дополнить»: a short checklist at the top of a sheet that was made in the quick builder. The quick builder lets the native language
   and the names of specializations wait; this card asks for them where the player can see the whole sheet, and points at Lifepath.

   Nothing new is stored except one optional flag, extra.todoHidden (true), set by «Скрыть». The list itself is worked out from the
   sheet each time: a missing native language, a specialization that still carries the bare skill name, and a Lifepath that was never
   opened (extra.life empty). A sheet that was not made in the quick builder (no extra.startingPack) never shows the card. */
(function(global){
'use strict';
const T={
 ru:{head:'Дополнить',lead:'Это можно заполнить позже. Список исчезнет, когда всё будет готово.',native:'Родной язык',nativeHint:'Получает 4 бесплатных уровня.',
  spec:'Специализация: {0}',specHint:'Впишите, к чему относится навык.',life:'Lifepath',lifeText:'Происхождение, мотивы и связи персонажа.',lifeOpen:'Открыть Lifepath',
  save:'Сохранить',hide:'Скрыть список',saved:'Сохранено.',empty:'Введите текст.',stale:'Данные изменились. Повторите действие.',count:'Осталось: {n}',more:'Ещё пунктов: {n}'},
 en:{head:'Complete the sheet',lead:'These can wait. The list goes away when everything is filled in.',native:'Native language',nativeHint:'Gets 4 free levels.',
  spec:'Specialization: {0}',specHint:'Say what the skill applies to.',life:'Lifepath',lifeText:'Background, motivation and connections.',lifeOpen:'Open Lifepath',
  save:'Save',hide:'Hide the list',saved:'Saved.',empty:'Enter some text.',stale:'The data changed. Try again.',count:'Left: {n}',more:'More items: {n}'},
};
const L=lang=>lang==='en'?'en':'ru';
const t=(lang,k,v)=>{let s=T[L(lang)][k]??T.ru[k]??k;if(v)for(const [a,b] of Object.entries(v))s=s.split('{'+a+'}').join(String(b));return s};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const label=(skill,lang)=>{try{return global.SKILL_LABELS?.[skill]?.[L(lang)]||skill}catch{return skill}};

/* The skills that need a specialization are those the template of the role marks; a record still named exactly like the skill is
   the one that waits for its text. -> [{id, skill}] */
function pendingSpecs(c){
 const pack=c?.extra?.startingPack;if(!isObject(pack)||typeof pack.role!=='string')return [];
 let names=[];try{names=(global.Archetypes?.getTemplate?.(pack.role)?.streetratSkills||[]).filter(s=>s.needsSpecialty).map(s=>s.name)}catch{return []}
 const list=Array.isArray(c.extra.specializations)?c.extra.specializations:[];
 return list.filter(s=>isObject(s)&&typeof s.id==='string'&&names.includes(s.name)).map(s=>({id:s.id,skill:s.name}));
}
const needsNative=c=>isObject(c)&&isObject(c.extra?.startingPack)&&!String(c.native||'').trim();
const needsLife=c=>isObject(c)&&isObject(c.extra?.startingPack)&&!(isObject(c.extra.life)&&Object.keys(c.extra.life).length>0);
// -> the open items of a sheet, in the order they are shown; [] for a sheet that was not made in the quick builder or was hidden
function items(c){
 if(!isObject(c)||!isObject(c.extra)||!isObject(c.extra.startingPack)||c.extra.todoHidden===true||c.extra.sample===true)return []; // the sample character of the first run is not a quick-built one
 const out=[];
 if(needsNative(c))out.push({id:'native'});
 for(const s of pendingSpecs(c))out.push({id:'spec',specId:s.id,skill:s.skill});
 if(needsLife(c))out.push({id:'life'});
 return out;
}
function html(c,lang){
 const list=items(c);if(!list.length)return '';
 const rows=list.map((it,i)=>{
  if(it.id==='native')return `<li class="char-todo-item"><label for="todo-native">${esc(t(lang,'native'))}</label><small>${esc(t(lang,'nativeHint'))}</small><div class="char-todo-row"><input id="todo-native" data-todo-input="native" maxlength="100" autocomplete="off"><button type="button" class="btn" data-todo="native">${esc(t(lang,'save'))}</button></div></li>`;
  if(it.id==='spec')return `<li class="char-todo-item"><label for="todo-spec-${i}">${esc(t(lang,'spec',{0:label(it.skill,lang)}))}</label><small>${esc(t(lang,'specHint'))}</small><div class="char-todo-row"><input id="todo-spec-${i}" data-todo-input="spec" data-todo-spec="${esc(it.specId)}" maxlength="80" autocomplete="off"><button type="button" class="btn" data-todo="spec" data-todo-spec="${esc(it.specId)}">${esc(t(lang,'save'))}</button></div></li>`;
  return `<li class="char-todo-item"><strong>${esc(t(lang,'life'))}</strong><small>${esc(t(lang,'lifeText'))}</small><div class="char-todo-row"><button type="button" class="btn ghost" data-todo="life">${esc(t(lang,'lifeOpen'))}</button></div></li>`;
 });
 const more=rows.length>1?`<details class="char-todo-more"><summary>${esc(t(lang,'more',{n:rows.length-1}))}</summary><ul class="char-todo-list">${rows.slice(1).join('')}</ul></details>`:'';
 return `<section class="card char-todo" data-todo-root tabindex="-1" aria-labelledby="char-todo-head"><div class="card-heading"><span id="char-todo-head">${esc(t(lang,'head'))}</span><span>${esc(t(lang,'count',{n:list.length}))}</span></div><p class="char-todo-lead">${esc(t(lang,'lead'))}</p><ul class="char-todo-list">${rows[0]}</ul>${more}<button type="button" class="btn ghost" data-todo="hide">${esc(t(lang,'hide'))}</button></section>`;
}
const clean=(v,max)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
/* `e` a click; `c` the open sheet. -> {handled, dirty?, rerender?, notify?, navigate?, focus?}. Stale guard: ctx.isCurrent(c) must be true to write. */
function handle(e,c,lang,ctx){
 const b=e?.type==='click'?e.target?.closest?.('[data-todo]'):null;if(!b)return {handled:false};
 const kind=b.getAttribute?.('data-todo')??b.dataset?.todo;
 const current=()=>{try{return typeof ctx?.isCurrent!=='function'||ctx.isCurrent(c)===true}catch{return false}};
 if(!isObject(c)||!isObject(c.extra))return {handled:true};
 if(kind==='life')return {handled:true,navigate:'lifepath'};
 if(!current())return {handled:true,notify:t(lang,'stale')};
 const root=b.closest?.('[data-todo-root]');
 if(kind==='hide'){c.extra.todoHidden=true;return {handled:true,dirty:true,rerender:true,focus:'.sheet-title h1'}}
 if(kind==='native'){
  const v=clean(root?.querySelector?.('[data-todo-input="native"]')?.value,100);
  if(!v)return {handled:true,notify:t(lang,'empty'),focus:'[data-todo-input="native"]'};
  c.native=v;return {handled:true,dirty:true,rerender:true,notify:t(lang,'saved'),focus:'[data-todo-input]'};
 }
 if(kind==='spec'){
  const id=b.getAttribute?.('data-todo-spec')??b.dataset?.todoSpec;
  let input=null;for(const x of root?.querySelectorAll?.('[data-todo-input="spec"]')||[])if((x.getAttribute?.('data-todo-spec')??x.dataset?.todoSpec)===id)input=x;
  const v=clean(input?.value,60),rec=(Array.isArray(c.extra.specializations)?c.extra.specializations:[]).find(s=>isObject(s)&&s.id===id);
  if(!rec||!pendingSpecs(c).some(s=>s.id===id))return {handled:true,notify:t(lang,'stale')};
  if(!v)return {handled:true,notify:t(lang,'empty'),focus:`[data-todo-spec="${String(id).replace(/["\\]/g,'\\$&')}"]`};
  rec.name=`${rec.name} (${v})`;return {handled:true,dirty:true,rerender:true,notify:t(lang,'saved'),focus:'[data-todo-input]'};
 }
 return {handled:false};
}
// After a redraw: the next field of the list, or the card, or the title of the sheet; the focus never falls back to the page.
function focus(selector){
 try{
  const d=global.document;
  let el=null;for(const s of [selector,'[data-todo-input]','[data-todo-root]','.sheet-title h1']){if(!s)continue;el=d.querySelector(s);if(el)break}
  if(!el)return false;
  if(!/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(el.tagName)&&!el.hasAttribute('tabindex'))el.setAttribute('tabindex','-1');
  el.focus({preventScroll:false});return true;
 }catch{return false}
}
global.document?.addEventListener?.('keydown',e=>{
 if(e.key!=='Enter'||e.isComposing||!e.target?.matches?.('[data-todo-input]'))return;
 e.preventDefault?.();const row=e.target.closest?.('.char-todo-row');row?.querySelector?.('button[data-todo]')?.click?.();
});
global.CharTodo={T,t,items,html,handle,focus,pendingSpecs};
})(typeof window!=='undefined'?window:globalThis);
