/* The list of characters: a richer card (portrait, role and rank, HP bar, wound, money) with «Открыть» as the one main action
   and Copy / Folder / Delete behind a «⋯» menu; a sort that is remembered on this device; and a «Выбрать» mode with several
   cards picked and sent to the bin in one step (app.js does the moving and the one undo).

   Nothing here is saved in a sheet. The sort and the times a sheet was last opened live in this browser only (localStorage), so a
   backup, a link and a file are exactly what they were. Selecting is memory only and ends when the page is left. */
(function(global){
'use strict';
const T={
 ru:{sort:'Сортировка',opened:'Недавно открытые',name:'По имени',role:'По роли',rank:'По рангу',
  select:'Выбрать',done:'Готово',all:'Все',none:'Снять выбор',bin:'В корзину',picked:'Выбрано: {n}',pick:'Выбрать: {0}',
  open:'Открыть',more:'Ещё действия: {0}',copy:'Создать копию',folder:'Папка и метки',del:'В корзину',closeFolder:'Готово',
  selectHint:'Отметьте персонажей и отправьте их в корзину. Вернуть можно кнопкой в уведомлении.',
  hp:'HP',hum:'HUM',rank_:'ранг',bar:'HP {a} из {b}',toolsLabel:'Порядок и выбор персонажей',untitled:'Без имени',
  binned:'В корзину перемещено: {n}.',restored:'Возвращено персонажей: {n}.',gone:'Список изменился. Повторите действие.'},
 en:{sort:'Sort',opened:'Recently opened',name:'By name',role:'By role',rank:'By rank',
  select:'Select',done:'Done',all:'All',none:'Clear selection',bin:'Move to bin',picked:'Selected: {n}',pick:'Select: {0}',
  open:'Open',more:'More actions: {0}',copy:'Duplicate',folder:'Folder and tags',del:'Move to bin',closeFolder:'Done',
  selectHint:'Tick characters and move them to the bin. The notice has an undo button.',
  hp:'HP',hum:'HUM',rank_:'rank',bar:'HP {a} of {b}',toolsLabel:'Order and selection of characters',untitled:'Untitled',
  binned:'Moved to the bin: {n}.',restored:'Characters restored: {n}.',gone:'The list changed. Try again.'},
};
const L=lang=>lang==='en'?'en':'ru';
const t=(lang,k,v)=>{let s=T[L(lang)][k]??T.ru[k]??k;if(v)for(const [a,b] of Object.entries(v))s=s.split('{'+a+'}').join(String(b));return s};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const SORTS=Object.freeze(['opened','name','role','rank']);
const SORT_KEY='nc-char-sort',OPENED_KEY='nc-char-opened',OPENED_KEEP=300,KNOWN_KEEP=500;

// ---- what this device remembers (never a sheet's own data)
const store=()=>{try{return global.localStorage||null}catch{return null}};
function sortMode(){try{const v=store()?.getItem(SORT_KEY);return SORTS.includes(v)?v:'opened'}catch{return 'opened'}}
function setSortMode(mode){if(!SORTS.includes(mode))return false;try{store()?.setItem(SORT_KEY,mode);return true}catch{return false}}
function openedMap(){try{const j=JSON.parse(store()?.getItem(OPENED_KEY)||'{}');if(!isObject(j))return {};const out={};for(const [k,v] of Object.entries(j))if(typeof v==='number'&&Number.isFinite(v)&&v>0)out[k]=v;return out}catch{return {}}}
let lastTouch={id:'',at:0};
// Called when a sheet is drawn; the same sheet is not written again within half a minute.
function touch(id,now=Date.now()){
 if(typeof id!=='string'||!id||id.length>160)return false;
 if(lastTouch.id===id&&now-lastTouch.at<30000)return false;
 lastTouch={id,at:now};
 try{const s=store();if(!s)return false;const m=openedMap();m[id]=now;const ids=Object.keys(m);
  if(ids.length>OPENED_KEEP+100){ids.sort((a,b)=>m[a]-m[b]).slice(0,ids.length-OPENED_KEEP).forEach(k=>delete m[k])}
  s.setItem(OPENED_KEY,JSON.stringify(m));return true}catch{return false}
}

/* A sheet that appeared since this device last drew the list (a new one, a copy, an import, a link) has no «opened» time, so it would sink to the
   bottom of «Недавно открытые». The first time the list is drawn every sheet is simply known; after that each unknown sheet is stamped with the
   present moment, shifted by its place so the order of the list is kept. Pure: returns what to store. */
const KNOWN_KEY='nc-char-known';
function noteNew(list,known,opened,now=Date.now()){
 const ids=(Array.isArray(list)?list:[]).filter(c=>isObject(c)&&typeof c.id==='string'&&c.id&&c.id.length<=160).map(c=>c.id);
 if(!Array.isArray(known))return {known:ids.slice(0,KNOWN_KEEP),opened,changed:true};
 const seen=new Set(known),fresh=ids.filter(id=>!seen.has(id));
 if(!fresh.length)return {known,opened,changed:false};
 const m={...opened};ids.forEach((id,i)=>{if(!seen.has(id)&&!m[id])m[id]=now-i});
 return {known:[...known,...fresh].slice(-KNOWN_KEEP),opened:m,changed:true};
}
function knownList(){try{const j=JSON.parse(store()?.getItem(KNOWN_KEY)||'null');return Array.isArray(j)?j.filter(x=>typeof x==='string'):null}catch{return null}}
function stampNew(list,now=Date.now()){
 try{const s=store();if(!s)return;const r=noteNew(list,knownList(),openedMap(),now);if(!r.changed)return;
  s.setItem(KNOWN_KEY,JSON.stringify(r.known));if(r.opened!==undefined)s.setItem(OPENED_KEY,JSON.stringify(r.opened))}catch{}
}

// ---- pure helpers (exported for tests)
const nameKey=(c,lang)=>String(c?.name||'').trim().toLocaleLowerCase(L(lang));
const cmp=(a,b,lang)=>a.localeCompare(b,L(lang),{sensitivity:'base',numeric:true});
/* A new array in the order of `mode`; the list itself is never touched. «Недавно открытые»: the most recent first, the ones never opened
   keep the order of the list after them. The others break a tie by name, then by place in the list, so the order never jumps. */
function sortList(list,mode,opened,lang,roleName){
 const src=Array.isArray(list)?list.filter(isObject):[];
 const rows=src.map((c,i)=>({c,i,name:nameKey(c,lang),at:num(opened?.[c.id]),rank:num(c.rank),role:String(typeof roleName==='function'?roleName(c):c.role||'').toLocaleLowerCase(L(lang))}));
 const by={
  opened:(a,b)=>b.at-a.at,
  name:(a,b)=>cmp(a.name,b.name,lang),
  role:(a,b)=>cmp(a.role,b.role,lang)||cmp(a.name,b.name,lang),
  rank:(a,b)=>b.rank-a.rank||cmp(a.name,b.name,lang),
 }[SORTS.includes(mode)?mode:'opened'];
 return rows.sort((a,b)=>by(a,b)||a.i-b.i).map(r=>r.c);
}
const hpPercent=(hp,max)=>{max=num(max);return max>0?Math.max(0,Math.min(100,Math.round(num(hp)/max*100))):0};
const woundOf=(c,max)=>{try{return global.CardInfo?.wound?.(c?.hp,max)||'full'}catch{return 'full'}};

// ---- selecting
let selecting=false;const picked=new Set();
const isSelecting=()=>selecting;
const pickedIds=()=>[...picked];
function leave(){selecting=false;picked.clear()}
function prune(list){const ids=new Set((Array.isArray(list)?list:[]).filter(isObject).map(c=>c.id));for(const id of [...picked])if(!ids.has(id))picked.delete(id)}

// ---- markup
function bar(list,lang){
 prune(list);const mode=sortMode(),n=picked.size;
 const sorter=`<label class="field cl-sort"><span>${esc(t(lang,'sort'))}</span><select data-cl-sort>${SORTS.map(k=>`<option value="${k}"${k===mode?' selected':''}>${esc(t(lang,k))}</option>`).join('')}</select></label>`;
 const tools=selecting
  ?`<div class="cl-select-tools" role="group" aria-label="${esc(t(lang,'toolsLabel'))}"><span class="cl-count" data-cl-count role="status" aria-live="polite">${esc(t(lang,'picked',{n}))}</span><button type="button" class="btn ghost" data-cl="all">${esc(t(lang,'all'))}</button><button type="button" class="btn ghost" data-cl="none">${esc(t(lang,'none'))}</button><button type="button" class="btn ghost" data-cl="bin" data-cl-bin${n?'':' disabled'}>${esc(t(lang,'bin'))}</button><button type="button" class="btn" data-cl="done">${esc(t(lang,'done'))}</button></div><p class="cl-hint">${esc(t(lang,'selectHint'))}</p>`
  :`<button type="button" class="btn ghost cl-select" data-cl="select" aria-pressed="false">${esc(t(lang,'select'))}</button>`;
 return `<div class="cl-bar${selecting?' selecting':''}" data-cl-root>${sorter}${tools}</div>`;
}
function menu(c,lang,name){
 const id=esc(c.id);
 return `<details class="cl-menu" data-cl-menu><summary class="cl-more" aria-label="${esc(t(lang,'more',{0:name}))}"><span aria-hidden="true">⋯</span></summary><div class="cl-menu-panel"><button type="button" class="cl-item duplicate-character" data-action="duplicate" data-id="${id}" aria-label="${esc(t(lang,'copy')+': '+name)}">${esc(t(lang,'copy'))}</button><button type="button" class="cl-item" data-cl="folder" data-id="${id}" aria-label="${esc(t(lang,'folder')+': '+name)}">${esc(t(lang,'folder'))}</button><button type="button" class="cl-item cl-danger delete-character-card" data-action="delete-card" data-id="${id}" aria-label="${esc(t(lang,'del')+': '+name)}">${esc(t(lang,'del'))}</button></div></details>`;
}
/* One card of the list. `o`: {lang, roleName, hpMax, portrait (html), extra (html under the actions: the folder line and its editor)}. */
function card(c,o){
 const lang=L(o?.lang),id=esc(c.id),name=String(c.name||'').trim()||t(lang,'untitled'),max=num(o?.hpMax),hp=num(c.hp),w=woundOf(c,max);
 const pick=selecting?`<label class="cl-pick"><input type="checkbox" data-cl-pick="${id}"${picked.has(c.id)?' checked':''} aria-label="${esc(t(lang,'pick',{0:name}))}"><span aria-hidden="true"></span></label>`:'';
 const info=(()=>{try{return global.CardInfo?.html?.(c,lang,max)||''}catch{return ''}})();
 return `<article class="character-card cl-card${selecting&&picked.has(c.id)?' picked':''}" data-character-card="${id}">${pick}<div class="char-art">${o?.portrait||''}<div class="char-art-grid"></div><span class="char-art-glyph">${esc(name.slice(0,1).toUpperCase())}</span><span class="char-index">NC // ${esc(String(c.role||'').toUpperCase())}</span></div><div class="char-body"><div class="char-kicker">${esc(o?.roleName||c.role||'')} <span> / ${esc(t(lang,'rank_'))} ${num(c.rank)}</span></div><h3>${esc(name)}</h3><div class="cl-hp" data-wound="${w}" role="img" aria-label="${esc(t(lang,'bar',{a:hp,b:max}))}"><i style="width:${hpPercent(hp,max)}%"></i></div><div class="char-meta"><span>${esc(t(lang,'hp'))} <strong>${hp}/${max}</strong></span><span>${esc(t(lang,'hum'))} <strong>${num(c.humanity)}</strong></span>${info}</div><div class="cl-actions"><button class="btn cl-open" type="button" data-action="open" data-id="${id}" aria-label="${esc(t(lang,'open')+': '+name)}">${esc(t(lang,'open'))} <span aria-hidden="true">↗</span></button>${selecting?'':menu(c,lang,name)}</div>${o?.extra||''}</div></article>`;
}

// ---- events
const doc=global.document;
// null when the page has no cards to look at (nothing is hidden then, so nothing is dropped).
const visibleIds=()=>{try{const els=[...(doc?.querySelectorAll?.('[data-character-card]')||[])];return els.length?els.filter(el=>!el.hidden).map(el=>el.dataset?.characterCard).filter(Boolean):null}catch{return null}};
function refreshCount(lang){
 try{
  const n=picked.size,count=doc?.querySelector?.('[data-cl-count]'),bin=doc?.querySelector?.('[data-cl-bin]');
  if(count)count.textContent=t(lang,'picked',{n});
  if(bin){if(n)bin.removeAttribute('disabled');else bin.setAttribute('disabled','')}
  for(const el of doc?.querySelectorAll?.('[data-character-card]')||[]){const on=picked.has(el.dataset?.characterCard);el.classList?.toggle?.('picked',on)}
 }catch{}
}
/* A filter can hide cards that were ticked: only what is on screen stays picked, so «В корзину» never moves a sheet the player cannot see. */
function sync(lang){
 try{if(!picked.size)return;const ids=visibleIds();if(!ids)return;const vis=new Set(ids);let ch=false;for(const id of [...picked])if(!vis.has(id)){picked.delete(id);ch=true}if(ch)refreshCount(L(lang))}catch{}
}
function openFolder(b){
 const card=b?.closest?.('[data-character-card]'),det=card?.querySelector?.('[data-char-tags-edit]');if(!det)return false;
 try{b.closest('[data-cl-menu]')?.removeAttribute('open')}catch{}
 det.open=true;try{det.querySelector('input')?.focus?.()}catch{}return true;
}
/* -> {handled, rerender?, focus?, bin?}. `o` = {lang}. A press on the card's own buttons (open, copy, delete) is app.js's business. */
function handle(e,o){
 const lang=L(o?.lang),el=e?.target;if(!el)return {handled:false};
 if(e.type==='change'){
  if(el.matches?.('[data-cl-sort]')){if(!setSortMode(String(el.value)))return {handled:true};return {handled:true,rerender:true,focus:'[data-cl-sort]'}}
  const id=el.matches?.('[data-cl-pick]')?el.getAttribute?.('data-cl-pick'):null;
  if(id){if(el.checked)picked.add(id);else picked.delete(id);refreshCount(lang);return {handled:true}}
  return {handled:false};
 }
 if(e.type!=='click')return {handled:false};
 const b=el.closest?.('[data-cl]');if(!b)return {handled:false};
 const kind=b.getAttribute?.('data-cl')||b.dataset?.cl;
 if(kind==='select'){selecting=true;picked.clear();return {handled:true,rerender:true,focus:'[data-cl="done"]'}}
 if(kind==='done'){leave();return {handled:true,rerender:true,focus:'[data-cl="select"]'}}
 if(kind==='all'){for(const id of visibleIds()||[])picked.add(id);return {handled:true,rerender:true,focus:'[data-cl="all"]'}}
 if(kind==='none'){picked.clear();return {handled:true,rerender:true,focus:'[data-cl="none"]'}}
 if(kind==='bin'){sync(lang);if(!picked.size)return {handled:true};return {handled:true,bin:pickedIds()}}
 if(kind==='folder'){openFolder(b);return {handled:true}}
 return {handled:false};
}
// Puts the focus where a redraw left it: the control that was in use, or the sort field when that one is gone.
function focus(selector){try{const el=(selector&&doc?.querySelector?.(selector))||doc?.querySelector?.('[data-cl-sort]');if(!el)return false;el.focus({preventScroll:true});return true}catch{return false}}
const closeMenus=except=>{try{for(const m of doc?.querySelectorAll?.('[data-cl-menu][open]')||[])if(m!==except)m.removeAttribute('open')}catch{}};
doc?.addEventListener?.('click',e=>{const m=e.target?.closest?.('[data-cl-menu]');closeMenus(m||null)});
doc?.addEventListener?.('keydown',e=>{if(e.key!=='Escape')return;const m=e.target?.closest?.('[data-cl-menu][open]')||doc?.querySelector?.('[data-cl-menu][open]');if(!m)return;m.removeAttribute('open');try{m.querySelector('summary')?.focus?.()}catch{}});
// A folder editor opened from the menu closes with its own «Готово» too.
doc?.addEventListener?.('click',e=>{const b=e.target?.closest?.('[data-cl-folder-done]');if(!b)return;const d=b.closest('[data-char-tags-edit]');if(d){d.open=false;try{d.closest('[data-character-card]')?.querySelector?.('.cl-more')?.focus?.()}catch{}}});

global.CharList={T,t,SORTS,noteNew,stampNew,sync,sortMode,setSortMode,openedMap,touch,sortList,hpPercent,bar,card,handle,focus,leave,isSelecting,pickedIds,prune,
  sorted:(list,lang,roleName)=>{stampNew(list);return sortList(list,sortMode(),openedMap(),lang,roleName)},
 _test:{reset(){leave();lastTouch={id:'',at:0}},picked}};
})(typeof window!=='undefined'?window:globalThis);
