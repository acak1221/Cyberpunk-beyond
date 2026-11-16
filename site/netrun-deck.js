/* The cyberdeck as a rack of slots on the NETRUN tab (window.NetrunDeck).
   One cell per slot: general slots first, then the Hardware-only ones. A filled cell shows the installed copy (a two-slot copy
   is one wide cell), an empty cell is a «+» that opens a picker. Create, install, remove and delete do not ask through
   window.confirm(): the change is made and «Отменить» takes exactly that step back, as long as nothing else changed meanwhile.
   Data: c.extra.cyberdecks (see RoleTools.deckState); a deck made from an owned deck may carry the optional `sourceId`
   (catalog id of the owned item). Which deck is shown is a view preference kept in localStorage per character, not in the sheet.
   Own words only; the numbers come from the catalog (slots of a deck, ATK/DEF/REZ and slots of a copy). */
(function(global){
'use strict';
const doc=global.document;
const T={
 ru:{title:'Кибердека',kicker:'DECK',invalid:'Формат дек несовместим; данные не изменены.',stale:'Данные изменились. Повторите действие.',undo:'Отменить',
  emptyLead:'Дека — это набор слотов под программы и Hardware. Возьмите кибердеку из инвентаря или заведите свою.',ownedHead:'Кибердеки из инвентаря',noOwned:'В инвентаре нет кибердек. Купите её в каталоге или заведите свою ниже.',
  create:'Создать деку',made:'Уже есть дека',slotsN:n=>`слотов: ${n}`,own:(o,u)=>`куплено ${o}, под деки занято ${u}`,free:'Своя дека',name:'Название',general:'Общие слоты',hw:'Слоты только Hardware',
  newDeck:'Новая дека',cancel:'Отмена',cyberarm:'В инвентаре есть кибердека в киберруке: по её описанию деке добавляется 1 слот. Прибавьте его сами в параметрах деки.',
  deck:'Дека',used:'Занято',of:'из',regionGeneral:'Общие слоты',regionHw:'Только Hardware',rack:'Слоты деки',
  addCell:(n,hw)=>`Пустой слот ${n}${hw?' (только Hardware)':''}. Добавить`,cell:(n,s,st)=>`${n}, слотов: ${s}${st?', '+st:''}. Подробности`,
  settings:'Параметры деки',save:'Сохранить',del:'Удалить деку',jack:'Jack Out: сбросить активность и REZ',jackNoteAtk:'Активация и деактивация тратят NET-действие.',jackNote:'Активация и деактивация тратят NET-действие. При REZ 0 программа Derezzed: деактивируйте и активируйте её снова.',
  remove:'Снять',close:'Закрыть',details:'Подробности',slotWord:n=>n===1?'1 слот':`${n} слота`,
  pickTitle:'Установить в слот',search:'Поиск по названию',classes:'Класс',booster:'Бустеры',defender:'Защитники',attacker:'Атакующие',ice:'Black ICE',hardware:'Hardware',
  nothing:'Ничего не найдено.',ownedMark:(o,f)=>`куплено ${o}, свободно ${f}`,notOwned:'нет в инвентаре',pickNote:'Установка или снятие занимает час. Покупку и деньги ведите в каталоге.',
  reasonFull:'Нет свободных слотов',reasonHwOnly:'Свободны только слоты Hardware',reasonHwCell:'Этот слот только для Hardware',reasonSize:(n,f)=>`Нужно слотов: ${n}, свободно: ${f}`,reasonLimit:'Достигнут предел записей',
  active:'Активна',idle:'Не активна',down:'Derezzed',act:'Активировать',deact:'Деактивировать',
  made1:'Дека создана',saved:'Параметры деки сохранены',installed:n=>`Установлено: ${n}`,removed:n=>`Снято: ${n}`,deleted:n=>`Дека удалена: ${n}`,restored:'Возвращено.',
  badName:'Проверьте название и число слотов.',deckLimit:'Достигнут предел числа дек.',notFit:'Не помещается в деку.',notOwnedMsg:'Такой кибердеки нет в инвентаре.',allUsed:'Все такие кибердеки уже заняты своими деками.',unknown:'Эта программа недоступна.',
  shrink:'Занятые слоты не помещаются в новые числа.',pickDeck:'Какая дека показана'},
 en:{title:'Cyberdeck',kicker:'DECK',invalid:'Cyberdeck data is incompatible; it was not changed.',stale:'Data changed. Try again.',undo:'Undo',
  emptyLead:'A deck is a set of slots for programs and Hardware. Take a cyberdeck from your inventory or make your own.',ownedHead:'Cyberdecks in your inventory',noOwned:'No cyberdeck in your inventory. Buy one in the catalog or make your own below.',
  create:'Create deck',made:'A deck already exists',slotsN:n=>`slots: ${n}`,own:(o,u)=>`owned ${o}, used by decks ${u}`,free:'Custom deck',name:'Name',general:'General slots',hw:'Hardware-only slots',
  newDeck:'New deck',cancel:'Cancel',cyberarm:'Your inventory has a cyberdeck in a cyberarm: by its description it adds 1 slot to the deck. Add it yourself in the deck settings.',
  deck:'Deck',used:'Used',of:'of',regionGeneral:'General slots',regionHw:'Hardware only',rack:'Deck slots',
  addCell:(n,hw)=>`Empty slot ${n}${hw?' (Hardware only)':''}. Add`,cell:(n,s,st)=>`${n}, slots: ${s}${st?', '+st:''}. Details`,
  settings:'Deck settings',save:'Save',del:'Delete deck',jack:'Jack Out: reset activation and REZ',jackNoteAtk:'Activating and deactivating cost a NET Action.',jackNote:'Activating and deactivating cost a NET Action. At REZ 0 a program is Derezzed: deactivate and activate it again.',
  remove:'Remove',close:'Close',details:'Details',slotWord:n=>n===1?'1 slot':`${n} slots`,
  pickTitle:'Install into slot',search:'Search by name',classes:'Class',booster:'Boosters',defender:'Defenders',attacker:'Attackers',ice:'Black ICE',hardware:'Hardware',
  nothing:'Nothing found.',ownedMark:(o,f)=>`owned ${o}, free ${f}`,notOwned:'not in inventory',pickNote:'Installing or removing takes an hour. Buy and pay in the catalog.',
  reasonFull:'No free slots',reasonHwOnly:'Only Hardware slots are free',reasonHwCell:'This slot is for Hardware only',reasonSize:(n,f)=>`Needs ${n} slots, ${f} free`,reasonLimit:'Entry limit reached',
  active:'Rezzed',idle:'Not rezzed',down:'Derezzed',act:'Activate',deact:'Deactivate',
  made1:'Deck created',saved:'Deck settings saved',installed:n=>`Installed: ${n}`,removed:n=>`Removed: ${n}`,deleted:n=>`Deck deleted: ${n}`,restored:'Restored.',
  badName:'Check the name and the slot numbers.',deckLimit:'Deck limit reached.',notFit:'Does not fit in the deck.',notOwnedMsg:'No such cyberdeck in your inventory.',allUsed:'Every such cyberdeck already has a deck of its own.',unknown:'This program is not available.',
  shrink:'The occupied slots do not fit the new numbers.',pickDeck:'Which deck is shown'}
};
Object.assign(T.ru,{gone:'Уничтожена',goneBtn:'Отметить уничтоженной',restoreBtn:'Восстановить',goneNote:'Уничтоженная программа остаётся в слоте, но её нельзя активировать. Восстановите её вручную или снимите с деки.',
 spentTag:'использована',spentBtn:'Отметить использованной',unspentBtn:'Снять отметку «использована»',spentNote:'Эта программа срабатывает один раз за забег: Jack Out снимает отметку.',
 markedGone:n=>`Уничтожена: ${n}`,markedBack:n=>`Восстановлена: ${n}`,markedSpent:n=>`Использована: ${n}`,markedFresh:n=>`Отметка снята: ${n}`});
Object.assign(T.en,{gone:'Destroyed',goneBtn:'Mark destroyed',restoreBtn:'Restore',goneNote:'A destroyed program stays in its slot but cannot be activated. Restore it by hand or remove it from the deck.',
 spentTag:'used',spentBtn:'Mark as used',unspentBtn:'Clear the “used” mark',spentNote:'This program works once per run: Jack Out clears the mark.',
 markedGone:n=>`Destroyed: ${n}`,markedBack:n=>`Restored: ${n}`,markedSpent:n=>`Used: ${n}`,markedFresh:n=>`Mark cleared: ${n}`});
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const int=(x,a,b)=>Number.isSafeInteger(x)&&x>=a&&x<=b;
const lng=l=>l==='en'?'en':'ru';
const RT=()=>global.RoleTools,RP=()=>global.RolePlay;
const rank=c=>{try{return Number(global.NetrunTab?.interfaceRank?.(c))||0}catch{return 0}};

// ---------- catalog of what can stand in a deck ----------
const CLASSES=['booster','defender','attacker','ice','hardware'];
const clsOf=t=>t==='booster'?'booster':t==='defender'?'defender':t==='anti-program'||t==='anti-personnel'?'attacker':t==='black-ice'?'ice':t==='hardware'?'hardware':'';
function catalogRows(){
 const rt=RT(),all=Array.isArray(global.CATALOG)?global.CATALOG:[],out=[];
 if(!rt?.deckCatalog)return out;
 for(const p of all){if(p?.category!=='programs')continue;const d=rt.deckCatalog(p.id);if(!d||d.p!==p)continue;const cls=clsOf(p.stats?.type);if(cls)out.push({p,kind:d.kind,slots:d.slots,cls})}
 return out;
}
const statLine=r=>{if(r.kind==='hardware')return '';const s=r.p.stats||{};return `ATK ${s.atk} · DEF ${s.def} · REZ ${s.rez}`};

// ---------- the decks of a character ----------
function snap(c){const x=c?.extra?.cyberdecks;return x===undefined?null:JSON.stringify(x)}
function hash(s){let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(36)}
// A short stamp of what the deck data is now; a button drawn from older data carries an older stamp and is refused.
const rev=c=>{const j=snap(c);return hash(String(c?.id)+'|'+(j===null?'-':j))};
function state(c){const rt=RT();return rt?.deckState?rt.deckState(c):{kind:'invalid'}}
const decksOf=c=>{const s=state(c);return s.kind==='ok'?s.value.decks:[]};
function newId(){try{const u=global.crypto?.randomUUID?.();if(u)return u}catch{}return 'dk-'+Date.now().toString(36)+Math.random().toString(36).slice(2,10)}

// What the character owns: cyberdecks of the inventory with a slot count in the catalog.
function ownedDecks(c){
 const items=Array.isArray(c?.extra?.items)?c.extra.items:[],decks=decksOf(c),all=Array.isArray(global.CATALOG)?global.CATALOG:[],out=[];
 for(const it of items){
  if(!obj(it)||typeof it.catalogId!=='string'||!/^gear-cyberdeck-/.test(it.catalogId)||out.some(o=>o.id===it.catalogId))continue;
  const p=all.find(x=>x?.id===it.catalogId),slots=p?.stats?.slots;if(!p||!int(slots,1,30))continue;
  const owned=items.filter(i=>obj(i)&&i.catalogId===it.catalogId).reduce((n,i)=>n+Math.max(0,Math.trunc(Number(i.quantity)||0)),0);
  if(owned<1)continue;
  out.push({id:p.id,p,slots,owned,used:decks.filter(d=>d.sourceId===p.id).length});
 }
 return out;
}
const hasCyberarm=c=>(Array.isArray(c?.extra?.items)?c.extra.items:[]).some(i=>obj(i)&&i.catalogId==='cyberware-cyberdeck');

// ---------- the rack: which cell holds what ----------
/* Counts decide everything (the same rules as RoleTools.deckState): programs and Black ICE use general slots; Hardware fills the
   Hardware-only slots first and the rest of it lands in general slots. A Hardware copy may straddle both parts. */
function layout(deck){
 const entries=Array.isArray(deck?.entries)?deck.entries:[],general=[],hw=[];
 let hwLeft=Math.max(0,deck?.hardwareOnly|0),over=[];
 for(const e of entries)if(e.kind!=='hardware')general.push({entry:e,span:e.slots,part:'whole'});
 for(const e of entries)if(e.kind==='hardware'){
  const inHw=Math.min(e.slots,hwLeft);hwLeft-=inHw;
  if(inHw)hw.push({entry:e,span:inHw,part:inHw<e.slots?'head':'whole'});
  if(e.slots>inHw)over.push({entry:e,span:e.slots-inHw,part:inHw?'tail':'whole'});
 }
 const taken=general.reduce((n,s)=>n+s.span,0)+over.reduce((n,s)=>n+s.span,0);
 return {general:general.concat(over),hw,freeGeneral:Math.max(0,(deck?.slots|0)-taken),freeHw:hwLeft,used:entries.reduce((n,e)=>n+e.slots,0),total:(deck?.slots|0)+(deck?.hardwareOnly|0)};
}
// Does a copy of `kind`/`slots` fit now? -> {ok:true} | {ok:false, reason, need, free}
function fit(deck,kind,slots){
 if(!obj(deck)||!Array.isArray(deck.entries))return {ok:false,reason:'stale'};
 if(deck.entries.length>=40)return {ok:false,reason:'limit'};
 const L=layout(deck);
 if(kind==='hardware')return slots<=L.freeGeneral+L.freeHw?{ok:true}:{ok:false,reason:L.freeGeneral+L.freeHw?'size':'full',need:slots,free:L.freeGeneral+L.freeHw};
 if(slots<=L.freeGeneral)return {ok:true};
 return L.freeGeneral?{ok:false,reason:'size',need:slots,free:L.freeGeneral}:{ok:false,reason:L.freeHw?'hwonly':'full',need:slots,free:L.freeGeneral};
}

// ---------- changes of the data (pure on the character; no DOM, no confirm) ----------
const fail=(l,reason,message)=>({ok:false,reason,message:message||T[lng(l)].stale});
function restore(c,undo,l){
 const t=T[lng(l)];
 if(!obj(c)||!obj(undo)||c.id!==undo.characterId||snap(c)!==undo.after)return fail(l,'stale');
 if(undo.before===null){if(obj(c.extra))delete c.extra.cyberdecks}else{if(!obj(c.extra))c.extra={};c.extra.cyberdecks=JSON.parse(undo.before)}
 return {ok:true,message:t.restored};
}
/* Runs `fn(next)` on a copy of the deck data. `opts.rev` is the stamp the pressed button was drawn with: when the data moved on
   since, nothing changes. The copy is checked by deckState before it replaces anything. */
function work(c,l,opts,fn){
 const t=T[lng(l)],st=state(c);
 if(st.kind==='invalid')return fail(l,'invalid',t.invalid);
 if(opts?.rev!==undefined&&opts.rev!==rev(c))return fail(l,'stale');
 const before=snap(c),next=st.kind==='ok'?JSON.parse(JSON.stringify(st.value)):{version:1,decks:[]};
 const out=fn(next,t);
 if(!out||out.ok===false)return fail(l,out?.reason||'stale',out?.message);
 if(RT().deckState({extra:{cyberdecks:next}}).kind!=='ok')return fail(l,'invalid',t.notFit);
 if(!obj(c.extra))c.extra={};
 c.extra.cyberdecks=next;
 return {ok:true,message:out.message,deckId:out.deckId,entryId:out.entryId,undo:{characterId:c.id,before,after:snap(c)}};
}
const cleanName=x=>String(x??'').trim();
function parseNum(x,a,b){const s=String(x??'').trim();return /^\d+$/.test(s)&&int(Number(s),a,b)?Number(s):NaN}
function createFree(c,l,o){
 return work(c,l,o,(next,t)=>{
  const name=cleanName(o.name),slots=parseNum(o.slots,1,30),hardwareOnly=parseNum(o.hardwareOnly??0,0,10);
  if(!name||name.length>100||!Number.isFinite(slots)||!Number.isFinite(hardwareOnly))return {ok:false,reason:'name',message:t.badName};
  if(next.decks.length>=20)return {ok:false,reason:'limit',message:t.deckLimit};
  const id=newId();if(next.decks.some(d=>d.id===id))return {ok:false};
  next.decks.push({id,name,slots,hardwareOnly,entries:[]});
  return {message:t.made1,deckId:id};
 });
}
function createOwned(c,l,o){
 const own=ownedDecks(c).find(x=>x.id===o?.catalogId),t=T[lng(l)];
 if(!own)return fail(l,'notOwned',t.notOwnedMsg);
 if(own.used>=own.owned)return fail(l,'allUsed',t.allUsed);
 return work(c,l,o,(next)=>{
  if(next.decks.length>=20)return {ok:false,reason:'limit',message:t.deckLimit};
  const base=String(own.p.name[lng(l)]||own.p.name.en).slice(0,90);let name=base,n=2;
  while(next.decks.some(d=>d.name===name))name=`${base} ${n++}`;
  const id=newId();if(next.decks.some(d=>d.id===id))return {ok:false};
  next.decks.push({id,name,slots:own.slots,hardwareOnly:0,sourceId:own.id,entries:[]});
  return {message:t.made1,deckId:id};
 });
}
function updateDeck(c,l,o){
 return work(c,l,o,(next,t)=>{
  const d=next.decks.find(x=>x.id===o.deckId);if(!d)return {ok:false};
  const name=cleanName(o.name),slots=parseNum(o.slots,1,30),hardwareOnly=parseNum(o.hardwareOnly,0,10);
  if(!name||name.length>100||!Number.isFinite(slots)||!Number.isFinite(hardwareOnly))return {ok:false,reason:'name',message:t.badName};
  const used=d.entries.reduce((n,e)=>n+e.slots,0),non=d.entries.filter(e=>e.kind!=='hardware').reduce((n,e)=>n+e.slots,0);
  if(non>slots||used>slots+hardwareOnly)return {ok:false,reason:'shrink',message:t.shrink};
  d.name=name;d.slots=slots;d.hardwareOnly=hardwareOnly;
  return {message:t.saved,deckId:d.id};
 });
}
function install(c,l,o){
 const t=T[lng(l)],p=RT()?.deckCatalog?.(o?.catalogId);
 if(!p)return fail(l,'unknown',t.unknown);
 return work(c,l,o,(next)=>{
  const d=next.decks.find(x=>x.id===o.deckId);if(!d)return {ok:false};
  const f=fit(d,p.kind,p.slots);if(!f.ok)return {ok:false,reason:f.reason,message:t.notFit};
  const id=newId();if(d.entries.some(e=>e.id===id))return {ok:false};
  d.entries.push({id,catalogId:o.catalogId,name:{ru:p.p.name.ru,en:p.p.name.en},kind:p.kind,slots:p.slots});
  return {message:t.installed(p.p.name[lng(l)]),deckId:d.id,entryId:id};
 });
}
function removeEntry(c,l,o){
 return work(c,l,o,(next,t)=>{
  const d=next.decks.find(x=>x.id===o.deckId),e=d?.entries.find(x=>x.id===o.entryId);if(!d||!e)return {ok:false};
  d.entries.splice(d.entries.indexOf(e),1);
  return {message:t.removed(e.name[lng(l)]),deckId:d.id};
 });
}
/* The marks of a program that are not REZ: «destroyed» (stays in its slot, cannot be activated), «used» (a once-per-run program).
   op: 'destroy' | 'restore' | 'spend' | 'unspend'. The same guard, copy-and-validate and undo as every other change of the deck. */
function markEntry(c,l,o){
 return work(c,l,o,(next,t)=>{
  const d=next.decks.find(x=>x.id===o.deckId),e=d?.entries.find(x=>x.id===o.entryId);if(!d||!e||!RP()?.runState?.(e))return {ok:false};
  const name=e.name[lng(l)];
  if(o.op==='destroy'){delete e.active;delete e.down;delete e.rez;e.destroyed=true;return {message:t.markedGone(name),deckId:d.id,entryId:e.id}}
  if(o.op==='restore'){if(e.destroyed!==true)return {ok:false};delete e.destroyed;delete e.active;delete e.down;delete e.rez;return {message:t.markedBack(name),deckId:d.id,entryId:e.id}}
  if(o.op==='spend'||o.op==='unspend'){
   if(global.NetrunEffects?.isOnce?.(e.catalogId)!==true)return {ok:false};
   if(o.op==='spend')e.spent=true;else delete e.spent;
   return {message:(o.op==='spend'?t.markedSpent:t.markedFresh)(name),deckId:d.id,entryId:e.id};
  }
  return {ok:false};
 });
}
function removeDeck(c,l,o){
 return work(c,l,o,(next,t)=>{
  const d=next.decks.find(x=>x.id===o.deckId);if(!d)return {ok:false};
  next.decks.splice(next.decks.indexOf(d),1);
  return {message:t.deleted(d.name)};
 });
}

// ---------- which deck is shown (a view preference, not part of the sheet) ----------
const memory=new Map(),KEY='nc-netrun-deck:';
function currentId(c){
 const decks=decksOf(c);if(!decks.length)return '';
 let id=memory.get(c.id);
 if(id===undefined){try{id=global.localStorage?.getItem(KEY+c.id)}catch{}}
 return decks.some(d=>d.id===id)?id:decks[0].id;
}
function setCurrent(c,id){memory.set(c.id,id);try{global.localStorage?.setItem(KEY+c.id,id)}catch{}}

// ---------- drawing ----------
let ui={char:'',open:'',creating:false};
const uiFor=c=>{if(ui.char!==c.id)ui={char:c.id,open:'',creating:false};return ui};
const scopeOf=()=>{try{const s=global.App?.editScope?.();return s==null?'':String(s)}catch{return ''}};
function stateText(e,t){const s=RP()?.runState?.(e);return s?[s.destroyed?t.gone:s.down?t.down:s.active?t.active:t.idle,e.spent===true?t.spentTag:''].filter(Boolean).join(', '):''}
const atkOf=e=>{const p=(Array.isArray(global.CATALOG)?global.CATALOG:[]).find(x=>x?.id===e?.catalogId);return Number(p?.stats?.atk)||0};
function cellHtml(seg,t,l,openId,idx){
 const e=seg.entry,s=RP()?.runState?.(e),cls=['nd-cell','nd-filled','nd-k-'+e.kind];
 if(s?.active)cls.push('is-on');if(s?.down)cls.push('is-down');if(s?.destroyed)cls.push('is-gone');if(s&&e.spent===true)cls.push('is-spent');if(seg.part!=='whole')cls.push('is-part');
 const name=e.name[l]||e.name.en,meta=s?(s.destroyed?t.gone:s.attacker?`ATK ${atkOf(e)}`:`REZ ${s.rez}/${s.max}`)+(e.spent===true&&!s.destroyed?' · '+t.spentTag:''):seg.part==='head'?'→':seg.part==='tail'?'←':'';
 const dot=s?`<i class="nd-dot" aria-hidden="true"></i>`:'';
 return `<button type="button" class="${cls.join(' ')}" data-span="${seg.span}" data-nd-act="entry" data-nd-entry="${esc(e.id)}" aria-expanded="${openId===e.id?'true':'false'}" aria-label="${esc(t.cell(name,e.slots,stateText(e,t)))}">${dot}<span class="nd-cname">${esc(name)}</span>${meta?`<small>${esc(meta)}</small>`:''}</button>`;
}
function rackHtml(deck,t,l,openId){
 const L=layout(deck);let n=0;
 const empties=(k,hw)=>Array.from({length:k},()=>`<button type="button" class="nd-cell nd-empty${hw?' nd-hw':''}" data-nd-act="add" data-nd-region="${hw?'hw':'general'}" aria-label="${esc(t.addCell(++n,hw))}"><span aria-hidden="true">+</span></button>`).join('');
 const gen=L.general.map(s=>cellHtml(s,t,l,openId)).join('')+empties(L.freeGeneral,false);
 const hwCells=deck.hardwareOnly>0?`<div class="nd-region-label"><span>${esc(t.regionHw)}</span><b>${deck.hardwareOnly}</b></div><div class="nd-cells nd-cells-hw">${L.hw.map(s=>cellHtml(s,t,l,openId)).join('')+empties(L.freeHw,true)}</div>`:'';
 return `<div class="nd-region-label"><span>${esc(t.regionGeneral)}</span><b>${deck.slots}</b></div><div class="nd-cells">${gen}</div>${hwCells}`;
}
function detailHtml(c,deck,e,t,l){
 const row=catalogRows().find(r=>r.p.id===e.catalogId),s=RP()?.runState?.(e),name=e.name[l]||e.name.en;
 const stats=row?statLine(row):'',text=row?.p.details?.[l]||'';
 let run='';
 if(s){
  const b=(op,label,off,aria)=>`<button type="button" class="nd-btn" data-rp-deck="${op}" data-deck-entry="${esc(e.id)}"${off?' disabled':''}${aria?` aria-label="${esc(aria)}"`:''}>${esc(label)}</button>`;
  const once=global.NetrunEffects?.isOnce?.(e.catalogId)===true;
  if(s.destroyed)run=`<div class="nd-run"><span class="rp-badge off">${esc(t.gone)}</span><button type="button" class="nd-btn" data-nd-act="restore" data-nd-entry="${esc(e.id)}">${esc(t.restoreBtn)}</button></div><p class="nd-note">${esc(t.goneNote)}</p>`;
  else run=`<div class="nd-run"><span class="rp-badge ${s.down?'off':s.active?'on':''}">${esc(s.down?t.down:s.active?t.active:t.idle)}</span>${b('toggle',s.active||s.down?t.deact:t.act)}${s.attacker?'':`<span class="nd-rez">REZ ${b('rez-','−',s.rez<=0,'REZ −1')}<b>${s.rez}</b>${b('rez+','+',s.rez>=s.max||s.down,'REZ +1')}<span>/ ${s.max}</span></span>`}</div>${s.attacker?(global.NetrunConsole?.attackHtml?.(c,e,l)||''):''}${once?`<div class="nd-run"><button type="button" class="nd-btn" data-nd-act="${e.spent===true?'unspend':'spend'}" data-nd-entry="${esc(e.id)}" aria-pressed="${e.spent===true?'true':'false'}">${esc(e.spent===true?t.unspentBtn:t.spentBtn)}</button></div><p class="nd-note">${esc(t.spentNote)}</p>`:''}<div class="nd-run"><button type="button" class="nd-btn" data-nd-act="destroy" data-nd-entry="${esc(e.id)}">${esc(t.goneBtn)}</button></div>`;
 }
 return `<div class="nd-detail" id="nd-detail" role="region" aria-label="${esc(name)}"><div class="nd-detail-head"><strong>${esc(name)}</strong><span>${esc(t.slotWord(e.slots))}${stats?' · '+esc(stats):''}</span></div>${text?`<p class="nd-text">${esc(text)}</p>`:''}${run}<div class="nd-actions"><button type="button" class="nd-btn" data-nd-act="remove" data-nd-entry="${esc(e.id)}">${esc(t.remove)}</button><button type="button" class="nd-btn" data-nd-act="detail-close">${esc(t.close)}</button></div></div>`;
}
function createHtml(c,t,l,hasDecks){
 const owned=ownedDecks(c);
 const list=owned.length?`<ul class="nd-owned">${owned.map(o=>{const done=o.used>=o.owned;return `<li><div><strong>${esc(o.p.name[l])}</strong><small>${esc(t.slotsN(o.slots))} · ${esc(t.own(o.owned,o.used))}</small></div><button type="button" class="nd-btn${done?'':' nd-primary'}" data-nd-act="create-owned" data-nd-source="${esc(o.id)}"${done?' aria-disabled="true"':''}>${esc(done?t.made:t.create)}</button></li>`}).join('')}</ul>`:`<p class="nd-note">${esc(t.noOwned)}</p>`;
 const arm=hasCyberarm(c)?`<p class="nd-note">${esc(t.cyberarm)}</p>`:'';
 const free=`<details class="nd-free"${owned.length?'':' open'}><summary>${esc(t.free)}</summary><div class="nd-form" data-nd-form="create"><label>${esc(t.name)}<input data-nd-f="name" maxlength="100" value=""></label><label>${esc(t.general)}<input data-nd-f="slots" type="number" inputmode="numeric" min="1" max="30" value="7"></label><label>${esc(t.hw)}<input data-nd-f="hw" type="number" inputmode="numeric" min="0" max="10" value="0"></label><button type="button" class="nd-btn nd-primary" data-nd-act="create-free">${esc(t.create)}</button></div></details>`;
 return `<div class="nd-create" data-nd-create><h3 class="nd-sub">${esc(t.ownedHead)}</h3>${list}${arm}${free}${hasDecks?`<button type="button" class="nd-btn" data-nd-act="create-cancel">${esc(t.cancel)}</button>`:''}</div>`;
}
function render(c,lang){
 const r=rank(c);if(!r||!obj(c))return '';
 const l=lng(lang),t=T[l],st=state(c);
 const head=`<div class="card-heading"><span id="nd-title">${esc(t.title)}</span><span>${t.kicker}</span></div>`;
 const open=`<section class="card nd-card" data-nd-root data-nd-char="${esc(c.id)}" data-nd-rev="${esc(rev(c))}" data-nd-scope="${esc(scopeOf())}" aria-labelledby="nd-title">${head}`;
 if(st.kind==='invalid')return `${open}<p class="nd-warning" role="status">${esc(t.invalid)}</p></section>`;
 const decks=st.kind==='ok'?st.value.decks:[],u=uiFor(c);
 if(!decks.length)return `${open}<p class="nd-note">${esc(t.emptyLead)}</p>${createHtml(c,t,l,false)}</section>`;
 const cur=decks.find(d=>d.id===currentId(c))||decks[0],L=layout(cur);
 const opened=cur.entries.find(e=>e.id===u.open)||null;
 const picker=decks.length>1?`<label class="nd-pick">${esc(t.deck)}<select data-nd-select aria-label="${esc(t.pickDeck)}">${decks.map(d=>`<option value="${esc(d.id)}"${d.id===cur.id?' selected':''}>${esc(d.name)}</option>`).join('')}</select></label>`:'';
 const anyRun=cur.entries.some(e=>RP()?.runState?.(e));
 const jack=anyRun?`<div class="nd-actions"><button type="button" class="nd-btn" data-rp-deck="jackout">${esc(t.jack)}</button></div><p class="nd-note">${esc(cur.entries.some(e=>{const r=RP()?.runState?.(e);return r&&!r.attacker})?t.jackNote:t.jackNoteAtk)}</p>`:'';
 const settings=`<details class="nd-settings"><summary>${esc(t.settings)}</summary><div class="nd-form" data-nd-form="settings"><label>${esc(t.name)}<input data-nd-f="name" maxlength="100" value="${esc(cur.name)}"></label><label>${esc(t.general)}<input data-nd-f="slots" type="number" inputmode="numeric" min="1" max="30" value="${cur.slots}"></label><label>${esc(t.hw)}<input data-nd-f="hw" type="number" inputmode="numeric" min="0" max="10" value="${cur.hardwareOnly}"></label><div class="nd-actions"><button type="button" class="nd-btn nd-primary" data-nd-act="settings-save">${esc(t.save)}</button><button type="button" class="nd-btn nd-danger" data-nd-act="deck-delete">${esc(t.del)}</button></div></div></details>`;
 return `${open}<div class="nd-head"><h3 class="nd-name" tabindex="-1">${esc(cur.name)}</h3><span class="nd-count" aria-label="${esc(`${t.used} ${L.used} ${t.of} ${L.total}`)}"><b>${L.used}</b> / ${L.total}</span>${picker}<button type="button" class="nd-btn" data-nd-act="new">+ ${esc(t.newDeck)}</button></div><div class="nd-deck" data-deck-id="${esc(cur.id)}"><div class="nd-rack" role="group" aria-label="${esc(t.rack)}">${rackHtml(cur,t,l,opened?opened.id:'')}</div>${opened?detailHtml(c,cur,opened,t,l):''}${jack}${u.creating?createHtml(c,t,l,true):''}${settings}</div></section>`;
}

// ---------- the page: events ----------
const app=()=>global.App;
const langNow=()=>lng(app()?.lang?.());
const say=m=>{if(m)try{app()?.notify?.(m)}catch{}};
function sameChar(c){const A=app(),a=A?.active?.();return !!c&&!!a&&a.id===c.id}
// An id is data (a file or a peer may send any text): it goes into a selector only escaped, and a bad selector never throws out of the timer.
const qa=x=>String(x).replace(/[\\"\u0000-\u001f\u007f]/g,ch=>'\\'+ch.charCodeAt(0).toString(16)+' ');
function focusLater(sel){try{setTimeout(()=>{try{const n=sel&&doc.querySelector(sel);n?.focus?.({preventScroll:false})}catch{}},0)}catch{}}
// Redraw only the deck card (no full sheet redraw: the page stays where it is).
function refresh(focusSel){
 const A=app(),c=A?.active?.(),root=doc?.querySelector?.('[data-nd-root]');
 if(!c||!root){A?.render?.();return}
 const box=doc.createElement('div');box.innerHTML=render(c,langNow());const next=box.firstElementChild;
 if(!next){A?.render?.();return}
 root.replaceWith(next);if(focusSel)focusLater(focusSel);
}
// The toast button is gone after the press, so focus goes to the deck name (or, with no deck left, the create form).
const AFTER_UNDO='[data-nd-root] .nd-name, [data-nd-root] [data-nd-create] button, [data-nd-root] [data-nd-create] summary';
function afterChange(r,focusSel){
 const A=app();try{A?.save?.()}catch{}
 refresh(focusSel);
 const l=langNow(),back=()=>{
  const ch=A?.getState?.()?.characters?.find?.(x=>x&&x.id===r.undo.characterId),again=ch?restore(ch,r.undo,l):fail(l,'stale');
  if(again.ok){try{A?.save?.()}catch{}if(sameChar(ch))refresh(AFTER_UNDO);else A?.render?.()}
  say(again.message);
 };
 try{if(typeof A?.notifyAction==='function')A.notifyAction(r.message,T[l].undo,back);else say(r.message)}catch{say(r.message)}
}
// The card the press was drawn in must still be the current one: same character, same data stamp, same account.
function guard(el){
 const A=app(),c=A?.active?.(),root=el?.closest?.('[data-nd-root]'),l=langNow();
 if(!c||!root||root.isConnected===false||root.dataset.ndChar!==String(c.id)||root.dataset.ndRev!==rev(c)||(root.dataset.ndScope||'')!==scopeOf()||!rank(c)){say(T[l].stale);if(root)refresh();return null}
 return {c,l,root,rev:root.dataset.ndRev,deckId:el.closest('[data-deck-id]')?.dataset?.deckId||root.querySelector('[data-deck-id]')?.dataset?.deckId||''};
}
const val=(root,form,key)=>root.querySelector(`[data-nd-form="${form}"] [data-nd-f="${key}"]`)?.value;

// the picker
let pk=null,lastChip='booster';
const overlay=()=>doc?.getElementById?.('nd-overlay')||null;
function pickRows(c,l,deck,st){
 const t=T[l],q=st.q.trim().toLowerCase(),rows=catalogRows().filter(r=>r.cls===st.chip&&(!q||`${r.p.name.ru} ${r.p.name.en}`.toLowerCase().includes(q)));
 rows.sort((a,b)=>String(a.p.name[l]).localeCompare(String(b.p.name[l]),l));
 return rows.map(r=>{
  const f=fit(deck,r.kind,r.slots);let reason='';
  if(st.region==='hw'&&r.kind!=='hardware')reason=t.reasonHwCell;
  else if(!f.ok)reason=f.reason==='limit'?t.reasonLimit:f.reason==='hwonly'?t.reasonHwOnly:f.reason==='size'?t.reasonSize(f.need,f.free):t.reasonFull;
  const o=RP()?.ownedFree?.(c,r.p.id)||{owned:0,free:0},mark=o.owned?t.ownedMark(o.owned,o.free):t.notOwned,stats=statLine(r);
  return `<li><button type="button" class="nd-row${reason?' is-off':''}" data-nd-pick-id="${esc(r.p.id)}"${reason?` aria-disabled="true" aria-describedby="nd-why-${esc(r.p.id)}"`:''}><span class="nd-row-main"><strong>${esc(r.p.name[l])}</strong><small>${esc([stats,t.slotWord(r.slots)].filter(Boolean).join(' · '))}</small></span><span class="nd-row-side">${esc(mark)}</span>${reason?`<span class="nd-why" id="nd-why-${esc(r.p.id)}">${esc(reason)}</span>`:''}</button></li>`;
 }).join('')||`<li class="nd-none">${esc(t.nothing)}</li>`;
}
function pickerHtml(c,l,deck){
 const t=T[l],counts=Object.fromEntries(CLASSES.map(k=>[k,catalogRows().filter(r=>r.cls===k).length]));
 return `<h2 id="nd-dlg-title" tabindex="-1">${esc(t.pickTitle)}</h2><p class="nd-note">${esc(deck.name)}</p><div class="nd-chips" role="group" aria-label="${esc(t.classes)}">${CLASSES.map(k=>`<button type="button" class="nd-chip" data-nd-chip="${k}" aria-pressed="${pk.chip===k?'true':'false'}">${esc(t[k])} <small>${counts[k]}</small></button>`).join('')}</div><label class="nd-search">${esc(t.search)}<input type="search" data-nd-q value="${esc(pk.q)}" autocomplete="off" enterkeyhint="search"></label><ul class="nd-list" data-nd-list>${pickRows(c,l,deck,pk)}</ul><p class="nd-note">${esc(t.pickNote)}</p><div class="nd-actions"><button type="button" class="nd-btn" data-nd-act="pick-close">${esc(t.close)}</button></div>`;
}
function openPicker(el){
 const g=guard(el);if(!g||!doc)return;
 const deck=decksOf(g.c).find(d=>d.id===g.deckId);if(!deck){say(T[g.l].stale);refresh();return}
 const region=el.dataset.ndRegion==='hw'?'hw':'general';
 closePicker(true);
 pk={char:g.c.id,deckId:deck.id,rev:g.rev,scope:scopeOf(),region,chip:region==='hw'?'hardware':lastChip,q:'',opener:el};
 const box=doc.createElement('div');box.id='nd-overlay';box.className='nd-overlay';
 box.innerHTML='<div class="nd-backdrop" data-nd-act="pick-close"></div><section class="nd-dialog" role="dialog" aria-modal="true" aria-labelledby="nd-dlg-title"></section>';
 doc.body.appendChild(box);doc.documentElement.classList.add('nd-open');
 paintPicker(true);
}
function paintPicker(first){
 const box=overlay(),A=app(),c=A?.active?.();if(!box||!pk||!c){closePicker();return}
 const deck=decksOf(c).find(d=>d.id===pk.deckId);if(!deck){closePicker();return}
 const dlg=box.querySelector('.nd-dialog');dlg.innerHTML=pickerHtml(c,langNow(),deck);
 if(first){let fine=false;try{fine=!!global.matchMedia?.('(pointer: fine)').matches}catch{}(fine?dlg.querySelector('[data-nd-q]'):dlg.querySelector('#nd-dlg-title'))?.focus?.({preventScroll:true})}
}
function paintList(){
 const box=overlay(),c=app()?.active?.();if(!box||!pk||!c)return;
 const deck=decksOf(c).find(d=>d.id===pk.deckId);if(!deck)return;
 const list=box.querySelector('[data-nd-list]');if(list)list.innerHTML=pickRows(c,langNow(),deck,pk);
}
function closePicker(silent,focusSel){
 const box=overlay(),was=pk;
 if(box)box.remove();
 doc?.documentElement?.classList?.remove('nd-open');
 if(was&&was.region!=='hw')lastChip=was.chip;
 pk=null;
 if(!was||silent===true||!was.opener)return;
 if(focusSel){focusLater(focusSel);return}
 const op=was.opener;
 if(op.isConnected)op.focus?.({preventScroll:true});
 else focusLater('[data-nd-root] [data-nd-act="add"], [data-nd-root] [data-nd-act="entry"]');
}
function pickItem(btn){
 const A=app(),c=A?.active?.(),l=langNow();
 if(!pk||!c||c.id!==pk.char||rev(c)!==pk.rev||pk.scope!==scopeOf()){say(T[l].stale);closePicker();refresh();return}
 if(btn.getAttribute('aria-disabled')==='true'){const why=btn.querySelector('.nd-why')?.textContent;if(why)say(why);return}
 const r=install(c,l,{deckId:pk.deckId,catalogId:btn.dataset.ndPickId,rev:pk.rev});
 if(!r.ok){say(r.message);closePicker();refresh();return}
 const sel=`[data-nd-root] [data-nd-entry="${qa(r.entryId)}"]`;
 closePicker(true);
 afterChange(r,sel);
}

function onClick(e){
 const t=e.target;if(!t?.closest)return;
 const chip=t.closest('[data-nd-chip]');
 if(chip&&pk){pk.chip=chip.dataset.ndChip;paintPicker(false);doc.querySelector(`#nd-overlay [data-nd-chip="${pk.chip}"]`)?.focus?.({preventScroll:true});return}
 const row=t.closest('[data-nd-pick-id]');if(row&&pk){pickItem(row);return}
 const el=t.closest('[data-nd-act]');if(!el)return;
 const act=el.dataset.ndAct;
 if(act==='pick-close'){closePicker();return}
 if(!el.closest('[data-nd-root]'))return;
 if(act==='add'){openPicker(el);return}
 const g=guard(el);if(!g)return;
 const {c,l}=g,u=uiFor(c);
 if(act==='entry'){const id=el.dataset.ndEntry;u.open=u.open===id?'':id;refresh(`[data-nd-root] [data-nd-entry="${qa(id)}"]`);return}
 if(act==='detail-close'){const id=u.open;u.open='';refresh(`[data-nd-root] [data-nd-entry="${qa(id)}"]`);return}
 if(act==='new'){u.creating=true;refresh('[data-nd-create] button, [data-nd-create] input');return}
 if(act==='create-cancel'){u.creating=false;refresh('[data-nd-act="new"]');return}
 let r=null,focus='';
 if(act==='create-owned'){if(el.getAttribute('aria-disabled')==='true'){say(T[l].allUsed);return}r=createOwned(c,l,{catalogId:el.dataset.ndSource,rev:g.rev})}
 else if(act==='create-free')r=createFree(c,l,{name:val(g.root,'create','name'),slots:val(g.root,'create','slots'),hardwareOnly:val(g.root,'create','hw'),rev:g.rev});
 else if(act==='settings-save')r=updateDeck(c,l,{deckId:g.deckId,name:val(g.root,'settings','name'),slots:val(g.root,'settings','slots'),hardwareOnly:val(g.root,'settings','hw'),rev:g.rev});
 else if(act==='remove')r=removeEntry(c,l,{deckId:g.deckId,entryId:el.dataset.ndEntry,rev:g.rev});
 else if(act==='destroy'||act==='restore'||act==='spend'||act==='unspend')r=markEntry(c,l,{op:act,deckId:g.deckId,entryId:el.dataset.ndEntry,rev:g.rev});
 else if(act==='deck-delete')r=removeDeck(c,l,{deckId:g.deckId,rev:g.rev});
 else return;
 if(!r.ok){say(r.message);if(r.reason==='stale')refresh();return}
 if(act==='create-owned'||act==='create-free'){setCurrent(c,r.deckId);u.creating=false;u.open='';focus='[data-nd-root] [data-nd-act="add"], [data-nd-root] .nd-name'}
 else if(act==='remove'){u.open='';focus='[data-nd-root] [data-nd-act="add"]'}
 else if(act==='destroy'||act==='restore'||act==='spend'||act==='unspend'){focus=`[data-nd-root] [data-nd-entry="${qa(r.entryId||el.dataset.ndEntry)}"]`}
 else if(act==='deck-delete'){u.open='';focus='[data-nd-root] .nd-name, [data-nd-root] [data-nd-act="create-owned"], [data-nd-root] [data-nd-form="create"] input'}
 else focus='[data-nd-root] .nd-settings summary';
 afterChange(r,focus);
}
function onChange(e){
 const s=e.target?.closest?.('[data-nd-select]');if(!s)return;
 const A=app(),c=A?.active?.();if(!c||!decksOf(c).some(d=>d.id===s.value))return;
 setCurrent(c,s.value);uiFor(c).open='';refresh('[data-nd-select]');
}
function onInput(e){
 const q=e.target?.closest?.('[data-nd-q]');if(!q||!pk)return;
 pk.q=q.value;paintList();
}
function onKey(e){
 if(!pk)return;
 if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closePicker();return}
 const box=overlay();if(!box)return;
 if(e.key==='Tab'){
  const items=[...box.querySelectorAll('button,input,select,[tabindex="0"]')].filter(x=>!x.disabled&&x.getClientRects?.().length&&!x.classList.contains('nd-backdrop'));
  if(!items.length)return;
  const first=items[0],last=items[items.length-1],on=doc.activeElement;
  if(e.shiftKey&&(on===first||!box.contains(on))){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&(on===last||!box.contains(on))){e.preventDefault();first.focus()}
  return;
 }
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){
  const rows=[...box.querySelectorAll('.nd-row')],i=rows.indexOf(doc.activeElement);
  if(i<0&&e.key==='ArrowDown'&&doc.activeElement?.matches?.('[data-nd-q]')&&rows[0]){e.preventDefault();rows[0].focus();return}
  if(i>=0){e.preventDefault();const n=rows[i+(e.key==='ArrowDown'?1:-1)];if(n)n.focus();else if(e.key==='ArrowUp')box.querySelector('[data-nd-q]')?.focus()}
 }
}
if(doc?.addEventListener){
 doc.addEventListener('click',onClick);
 doc.addEventListener('change',onChange);
 doc.addEventListener('input',onInput);
 doc.addEventListener('keydown',onKey,true);
}
global.NetrunDeck={redraw:refresh,pickRows:(c,l,deck,st)=>pickRows(c,lng(l),deck,{chip:'booster',q:'',region:'general',...st}),render,layout,fit,rev,ownedDecks,catalogRows,currentId,setCurrent,createFree,createOwned,updateDeck,install,removeEntry,removeDeck,markEntry,restore,decksOf,CLASSES,qa};
})(window);
