/* Role play at the table: the small things that tie the Role tools to the sheet, so nobody keeps the books by hand.
   - the result of a Role roll stands right under the button that was pressed;
   - a short summary of the Role tools for the «Особенности» tab and the links from the sheet to the tool pages;
   - a finished Maker project puts its item on the sheet and pays for the materials (through Wallet);
   - damage after a hit in the NET, and the state of the programs on a cyberdeck during a run.
   The functions that change a character never mutate it: they return a staged `extra`, the caller assigns and saves. */
(function(global){
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const int=(x,a,b)=>Number.isSafeInteger(x)&&x>=a&&x<=b;
const lng=l=>l==='en'?'en':'ru';
const clone=x=>JSON.parse(JSON.stringify(x));
const money=n=>global.Wallet?.format?global.Wallet.format(n):String(n);
const cash=c=>global.Wallet?.cash?global.Wallet.cash(c):Math.max(0,Math.floor(Number(c?.extra?.cash)||0));

// ---------- the result line under the pressed button ----------
// `html` is the markup of the Role controls. The line goes right after the button of `action`; null when there is no such button.
function placeLast(html,action,text){
 if(typeof html!=='string'||typeof action!=='string'||!/^[a-z-]{1,40}$/.test(action)||!text)return null;
 const at=html.indexOf(`data-rt-action="${action}"`);if(at<0)return null;
 const end=html.indexOf('</button>',at);if(end<0)return null;
 const cut=end+'</button>'.length;
 return html.slice(0,cut)+`<div class="rt-last rt-last-inline" role="status">${esc(text)}</div>`+html.slice(cut);
}

// ---------- the sheet: a summary and the links to the tool pages ----------
const PAGES={tech:['repair','Проекты и ремонт','Projects and repairs'],medtech:['medical','Препараты и лечение','Pharmaceuticals and treatment'],netrunner:['net','NET-архитектура и бой','NET architecture and combat']};
const DRUG_NAMES={antibiotic:'Antibiotic',rapidetox:'Rapidetox',speedheal:'Speedheal',stim:'Stim',surge:'Surge'};
function doses(c){
 const d=c?.extra?.pharmacy?.doses,out=[],S=global.DoseStock;if(!S&&!obj(d))return out;
 for(const k of Object.keys(DRUG_NAMES)){const n=S?S.count(c,k):Number(d[k]);if(Number.isSafeInteger(n)&&n>0)out.push([k,DRUG_NAMES[k],n])}
 return out;
}
function makerProjects(c){
 const x=c?.extra?.makerProjects;if(!obj(x)||!Array.isArray(x.projects))return [];
 return x.projects.filter(p=>obj(p)&&typeof p.name==='string'&&typeof p.status==='string');
}
const MAKER_STATE={planned:['ждёт проверки','awaiting check'],passed:['успех, ждёт срока','passed, waiting out the time'],failed:['провал, начать заново','failed, start again'],complete:['завершён','completed']};
// What the Role tools hold for this character besides the numbers: Maker projects, Medtech doses.
function ledger(c,lang){
 const l=lng(lang),ru=l==='ru',role=c?.role;let rows='';
 if(role==='tech'){
  const list=makerProjects(c).filter(p=>p.status!=='complete');
  rows=list.length?`<ul class="rp-list">${list.slice(0,8).map(p=>`<li><strong>${esc(p.name)}</strong> · ${esc((MAKER_STATE[p.status]||['',''])[ru?0:1])}</li>`).join('')}</ul>`:`<p class="rt-help">${ru?'Активных проектов нет.':'No active projects.'}</p>`;
  rows=`<div class="rt-subhead">${ru?'ПРОЕКТЫ MAKER':'MAKER PROJECTS'}</div>${rows}`;
 }else if(role==='medtech'){
  const list=doses(c);
  rows=`<div class="rt-subhead">${ru?'ГОТОВЫЕ ДОЗЫ':'DOSES ON HAND'}</div>`+(list.length?`<ul class="rp-list rp-doses">${list.map(([,name,n])=>`<li><strong>${esc(name)}</strong> × ${n}</li>`).join('')}</ul>`:`<p class="rt-help">${ru?'Доз нет. Синтез: проверка DV 13, час работы, 200 eb материалов.':'No doses. Synthesis: a DV 13 check, one hour, 200 eb of materials.'}</p>`);
 }
 else if(role==='solo')rows=soloBar(c,l);
 const page=PAGES[role];
 if(!page)return rows?`<section class="rt-section rp-ledger">${rows}</section>`:'';
 return `<section class="rt-section rp-ledger">${rows}<button type="button" class="rt-button rp-open" data-rp-open="${page[0]}">${esc(ru?page[1]:page[2])} →</button></section>`;
}
// The «Особенности» tab: what the Role gives right now, without the forms.
function summary(c,lang){
 const l=lng(lang),ru=l==='ru';let rows='';
 try{rows=global.RoleTools?.derived?.(c,l)||''}catch{rows=''}
 if(!rows)return '';
 return `<div class="rp-summary" data-rp-summary><div class="rt-derived">${rows}</div>${ledger(c,l)}<button type="button" class="rt-button rp-open" data-rp-open="role">${ru?'Открыть инструменты роли':'Open the Role tools'} →</button></div>`;
}

// ---------- Maker: a finished project reaches the sheet ----------
const norm=s=>String(s||'').trim().normalize('NFKC').toLocaleLowerCase();
function makerPlan(p){try{return global.CraftingTools?.plan?.(p.op,p.category,p.price)||null}catch{return null}}
// Catalog entries a fabricated item can be: same list price as the project's category; an exact name match comes first.
function makerCandidates(p,lang){
 const l=lng(lang),plan=makerPlan(p),all=Array.isArray(global.CATALOG)?global.CATALOG:[];if(!plan||p.op!=='fabricate')return [];
 const name=norm(p.name);
 const same=all.filter(i=>obj(i)&&typeof i.id==='string'&&obj(i.name)&&i.category!=='cyberware'&&(norm(i.name.ru)===name||norm(i.name.en)===name));
 const priced=all.filter(i=>obj(i)&&typeof i.id==='string'&&obj(i.name)&&i.category!=='cyberware'&&i.price===plan.price&&!same.includes(i));
 return [...same,...priced].slice(0,200).map(i=>({id:i.id,name:String(i.name[l]||i.name.en||i.id),exact:same.includes(i)}));
}
// Things an upgrade can be marked on.
function makerTargets(c){
 const x=c?.extra||{},out=[];
 (Array.isArray(x.weapons)?x.weapons:[]).forEach((w,i)=>{if(obj(w)&&String(w.name||'').trim())out.push({key:'w'+i,name:String(w.name)})});
 (Array.isArray(x.items)?x.items:[]).forEach((it,i)=>{if(obj(it)&&String(it.name||'').trim())out.push({key:'i'+i,name:String(it.name)})});
 return out;
}
function makerForm(c,p,lang){
 const l=lng(lang),ru=l==='ru',plan=makerPlan(p);if(!plan)return '';
 const cost=Number.isSafeInteger(plan.materials)&&plan.materials>0?plan.materials:0,have=cash(c),short=cost>have;
 let pick='';
 if(p.op==='fabricate'){
  const list=makerCandidates(p,l),first=list[0]?.exact?list[0].id:'';
  pick=`<label class="field">${ru?'Что добавить на лист':'What to add to the sheet'}<select data-maker-deliver-item><option value=""${first?'':' selected'}>${esc((ru?'Свой предмет: ':'Custom item: ')+p.name)}</option>${list.map(i=>`<option value="${esc(i.id)}"${i.id===first?' selected':''}>${esc(i.name)}</option>`).join('')}</select></label><p class="rp-note">${ru?'Предмет из каталога попадёт на лист со своими параметрами; оружие — в список оружия.':'A catalog item reaches the sheet with its numbers; a weapon goes to the weapon list.'}</p>`;
 }else if(p.op==='upgrade'){
  const list=makerTargets(c);
  pick=`<label class="field">${ru?'Что улучшено':'What was upgraded'}<select data-maker-deliver-target><option value="">${ru?'Не отмечать на листе':'Do not mark on the sheet'}</option>${list.map(i=>`<option value="${esc(i.key)}">${esc(i.name)}</option>`).join('')}</select></label><p class="rp-note">${ru?'В заметки предмета добавится строка об улучшении.':'A line about the upgrade is added to the notes of the item.'}</p>`;
 }else pick=`<p class="rp-note">${ru?'Изобретение — это чертёж. Сам предмет изготавливается отдельным проектом.':'An invention is a design. The item itself is made as a separate project.'}</p>`;
 const pay=cost?`<label class="rp-check"><input type="checkbox" data-maker-deliver-pay${short?' disabled':' checked'}> ${ru?`Списать ${money(cost)} eb за материалы`:`Pay ${money(cost)} eb for materials`} <small>${short?(ru?`не хватает ${money(cost-have)} eb, сейчас ${money(have)} eb`:`short by ${money(cost-have)} eb, ${money(have)} eb now`):(ru?`сейчас ${money(have)} eb, останется ${money(have-cost)} eb`:`${money(have)} eb now, ${money(have-cost)} eb left`)}</small></label>`:'';
 return `<div class="rp-deliver" data-maker-deliver><strong>${ru?'Завершение проекта':'Finishing the project'}</strong>${pick}${pay}<div class="rp-actions"><button type="button" class="btn primary" data-maker-action="deliver">${ru?'Завершить и записать на лист':'Finish and put on the sheet'}</button><button type="button" class="btn ghost" data-maker-action="deliver-skip">${ru?'Завершить без записи':'Finish without the sheet'}</button><button type="button" class="btn ghost" data-maker-action="deliver-cancel">${ru?'Отмена':'Cancel'}</button></div></div>`;
}
/* Finish a Maker project. options: {item: catalog id or '', target: key from makerTargets or '', pay: boolean, record: boolean}.
   -> {ok:true, extra, message, delivered} | {ok:false, reason, message}. Never mutates `c`. */
function makerDeliver(c,projectId,options,lang){
 const l=lng(lang),ru=l==='ru',fail=(reason,message)=>({ok:false,reason,message});
 if(!obj(c)||!obj(c.extra))return fail('invalid',ru?'Данные изменились. Повторите действие.':'Data changed. Try again.');
 let stage;try{stage=clone(c)}catch{return fail('invalid',ru?'Данные изменились. Повторите действие.':'Data changed. Try again.')}
 const p=stage.extra?.makerProjects?.projects?.find?.(x=>obj(x)&&x.id===projectId),plan=p?makerPlan(p):null;
 if(!p||!plan||!['passed','complete'].includes(p.status)||obj(p.delivered))return fail('invalid',ru?'Проект уже закрыт или изменился.':'The project is already closed or has changed.');
 const o=obj(options)?options:{},record=o.record!==false,delivered={at:new Date().toISOString()};
 const parts=[];
 if(record&&p.op==='fabricate'){
  const CX=global.CharacterExtra;if(!CX?.addItem)return fail('invalid',ru?'Лист недоступен.':'The sheet is unavailable.');
  const item=o.item?(Array.isArray(global.CATALOG)?global.CATALOG:[]).find(i=>obj(i)&&i.id===o.item):null;
  if(o.item&&!item)return fail('item',ru?'Выберите предмет из списка.':'Choose an item from the list.');
  const note=(ru?'Изготовлено: проект Maker':'Fabricated: a Maker project');
  let made;
  if(item){made=CX.addCatalog(stage,item,l);if(!made?.record)return fail('item',ru?'Не удалось добавить предмет.':'The item could not be added.');made.record.notes=[note,made.record.notes].filter(Boolean).join(' · ').slice(0,500)}
  else made={kind:'item',record:CX.addItem(stage,{name:p.name,category:'equipment',quantity:1,notes:note})};
  delivered.kind=made.kind;delivered.name=String(made.record.name||p.name).slice(0,150);
  parts.push(made.kind==='weapon'?(ru?`«${delivered.name}» — в оружии`:`“${delivered.name}” is in the weapons`):(ru?`«${delivered.name}» — в инвентаре`:`“${delivered.name}” is in the inventory`));
 }
 if(record&&p.op==='upgrade'&&o.target){
  const m=/^([wi])(\d{1,4})$/.exec(String(o.target)),list=m?(m[1]==='w'?stage.extra.weapons:stage.extra.items):null,row=Array.isArray(list)?list[Number(m[2])]:null;
  if(!obj(row))return fail('target',ru?'Выберите предмет из списка.':'Choose an item from the list.');
  row.notes=[String(row.notes||''),(ru?'Улучшение: ':'Upgrade: ')+p.name].filter(Boolean).join(' · ').slice(0,500);
  delivered.kind='upgrade';delivered.name=String(row.name||'').slice(0,150);
  parts.push(ru?`улучшение отмечено на «${delivered.name}»`:`the upgrade is marked on “${delivered.name}”`);
 }
 const cost=Number.isSafeInteger(plan.materials)&&plan.materials>0?plan.materials:0;
 if(record&&o.pay===true&&cost){
  if(!global.Wallet?.spend)return fail('invalid',ru?'Кошелёк недоступен.':'The wallet is unavailable.');
  const r=global.Wallet.spend(stage,cost,(ru?'Материалы: ':'Materials: ')+p.name);
  if(!r.ok)return fail(r.reason,r.reason==='short'?(ru?`Не хватает ${money(r.short)} eb на материалы.`:`Short by ${money(r.short)} eb for the materials.`):(ru?'Не удалось списать деньги.':'The money could not be spent.'));
  stage.extra=r.extra;delivered.paid=cost;
  parts.push(ru?`списано ${money(cost)} eb, осталось ${money(r.balance)} eb`:`${money(cost)} eb paid, ${money(r.balance)} eb left`);
 }
 const again=stage.extra.makerProjects.projects.find(x=>x.id===projectId);
 again.status='complete';again.delivered=delivered;
 const head=ru?`Проект «${p.name}» завершён`:`Project “${p.name}” is finished`;
 return {ok:true,extra:stage.extra,delivered,message:parts.length?`${head}: ${parts.join('; ')}.`:`${head}.`};
}
function makerDeliveredLine(p,lang){
 const ru=lng(lang)==='ru',d=p?.delivered;if(!obj(d))return '';
 const parts=[];
 if(d.kind==='weapon')parts.push(ru?`«${d.name}» в оружии`:`“${d.name}” in the weapons`);
 else if(d.kind==='item')parts.push(ru?`«${d.name}» в инвентаре`:`“${d.name}” in the inventory`);
 else if(d.kind==='upgrade')parts.push(ru?`отмечено на «${d.name}»`:`marked on “${d.name}”`);
 if(Number.isSafeInteger(d.paid)&&d.paid>0)parts.push(ru?`материалы ${money(d.paid)} eb списаны`:`${money(d.paid)} eb of materials paid`);
 return parts.length?(ru?'На листе: ':'On the sheet: ')+parts.join(' · '):(ru?'Закрыт без записи на лист.':'Closed without the sheet.');
}
// The character a tool page should start with: the first one who has the Role (as the main or an additional one).
function firstWithRole(chars,role){
 if(!Array.isArray(chars))return null;
 const has=c=>obj(c)&&(c.role===role||(Array.isArray(c.extra?.advancement?.additionalRoles)&&c.extra.advancement.additionalRoles.some(r=>obj(r)&&r.role===role)));
 return chars.find(c=>has(c)&&typeof c.id==='string')||null;
}

// ---------- Netrunner: NET Actions and the programs of a deck during a run ----------
/* A deck entry may carry the state of the run: `active` (rezzed), `rez` (current REZ) and `down` (Derezzed). Old saves have
   none of them and read as: not active, full REZ. Attacker programs (REZ 0 in the catalog) have no state to keep. */
const BOOST={'extra-program-worm':'Backdoor','extra-program-eraser':'Cloak','extra-program-see-ya':'Pathfinder'};
function catalogProgram(id){const all=Array.isArray(global.CATALOG)?global.CATALOG:[];return all.find(p=>obj(p)&&p.id===id&&p.category==='programs')||null}
function progState(e){
 const max=Number(catalogProgram(e?.catalogId)?.stats?.rez),top=int(max,1,999)?max:0;
 if(!top||!obj(e)||e.kind==='hardware')return null;
 const down=e.down===true,gone=e.destroyed===true;
 return {max:top,active:e.active===true&&!down&&!gone,down,rez:down?0:int(e.rez,0,top)?e.rez:top,...(gone?{destroyed:true}:{})};
}
/* The state of a program during a run for the NETRUN tab: progState, and for an attacker program (REZ 0 in the catalog) only
   «activated or not» (it has no REZ to keep). progState itself stays as it was. */
function runState(e){
 const s=progState(e);if(s)return s;
 if(!obj(e)||e.kind!=='program')return null;
 const p=catalogProgram(e.catalogId),t=p?.stats?.type;
 if(t!=='anti-program'&&t!=='anti-personnel')return null;
 const gone=e.destroyed===true;
 return {max:0,active:e.active===true&&!gone,down:false,rez:0,attacker:true,...(gone?{destroyed:true}:{})};
}
// The player's own modifier for Interface checks (the field of the Role tools, -100..100) and the «jacked in» flag (absent = not in).
function netMod(c){const n=Number(c?.extra?.roleTools?.netrunner?.values?.modifier);return Number.isFinite(n)?Math.max(-100,Math.min(100,Math.trunc(n))):0}
const jackedIn=c=>c?.extra?.roleTools?.netrunner?.values?.jackedIn===true;
// extra with some keys of the netrunner values set (undefined removes a key); nothing else is touched.
function withRun(extra,patch){
 const x=obj(extra)?extra:{},rt=obj(x.roleTools)?x.roleTools:{},nr=obj(rt.netrunner)?rt.netrunner:{},v={...(obj(nr.values)?nr.values:{})};
 for(const [k,val] of Object.entries(patch)){if(val===undefined)delete v[k];else v[k]=val}
 return {...x,roleTools:{...rt,netrunner:{team:[],...nr,values:v}}};
}
function netLeft(c,rank){
 let max=0;try{max=Number(global.RoleTools?.netActions?.(rank))||0}catch{}
 if(!max){const r=Math.max(1,Math.min(10,Math.trunc(Number(rank)||1)));max=r<=3?2:r<=6?3:r<=9?4:5}
 const used=Math.max(0,Math.min(100,Math.trunc(Number(c?.extra?.roleTools?.netrunner?.values?.used)||0)));
 // `cut`: the «−1 NET Action» of a Wisp or Vrizzbolt that «New turn» moved from the pending marker onto this turn; never below 2 (or the whole count when it is lower).
 const cut=Math.max(0,Math.min(5,Math.trunc(Number(c?.extra?.roleTools?.netrunner?.values?.cut)||0)));
 if(cut){const full=max;max=Math.max(Math.min(full,2),full-cut);return {max,used,left:Math.max(0,max-used),cut:full-max,full}}
 return {max,used,left:Math.max(0,max-used)};
}
// extra with the NET Action counter set to `used`; nothing else is touched.
function withUsed(extra,used){
 const x=obj(extra)?extra:{},rt=obj(x.roleTools)?x.roleTools:{},nr=obj(rt.netrunner)?rt.netrunner:{},v=obj(nr.values)?nr.values:{};
 return {...x,roleTools:{...rt,netrunner:{team:[],...nr,values:{...v,used}}}};
}
// +2 from a rezzed booster to its ability (Worm — Backdoor, Eraser — Cloak, See Ya — Pathfinder); the same program does not stack.
function netBonus(c,ability,skip){
 const decks=c?.extra?.cyberdecks?.decks,names=[],off=[],offNames=[],skipped=Array.isArray(skip)?skip:[];if(!Array.isArray(decks))return {value:0,names};
 for(const d of decks)for(const e of Array.isArray(d?.entries)?d.entries:[])if(obj(e)&&BOOST[e.catalogId]===ability&&progState(e)?.active){
  const n=String(e.name?.en||e.catalogId);
  if(skipped.includes(e.catalogId)){if(!off.includes(e.catalogId)){off.push(e.catalogId);offNames.push(n)}continue}
  if(!names.includes(n))names.push(n);
 }
 // `off`: boosters that are rezzed but switched off for this one roll (only present when there are some).
 return off.length?{value:names.length*2,names,off,offNames}:{value:names.length*2,names};
}
// «New turn»: the counter is refilled, and a pending «−1 NET Action» marker (values.netPenalty) moves onto this turn (values.cut) and is cleared.
function turnExtra(extra){
 const x=obj(extra)?extra:{},v=x.roleTools?.netrunner?.values,pend=Number(v?.netPenalty)>0;
 return withRun(extra,{used:0,cut:pend?1:undefined,netPenalty:undefined});
}
function deckEntryHtml(c,deck,e,lang){
 const s=progState(e);if(!s)return '';
 const ru=lng(lang)==='ru',id=esc(e.id),btn=(op,label,off,title)=>`<button type="button" class="rt-button" data-rp-deck="${op}" data-deck-entry="${id}"${off?' disabled':''}${title?` aria-label="${esc(title)}"`:''}>${esc(label)}</button>`;
 return `<div class="rp-prog-row"><span class="rp-badge ${s.down||s.destroyed?'off':s.active?'on':''}">${s.destroyed?(ru?'Уничтожена':'Destroyed'):s.down?'Derezzed':s.active?(ru?'Активна':'Rezzed'):(ru?'Не активна':'Not rezzed')}</span>${btn('toggle',s.active||s.down?(ru?'Деактивировать':'Deactivate'):(ru?'Активировать':'Activate'),s.destroyed)}<span>REZ</span>${btn('rez-','−',s.rez<=0||s.destroyed,'REZ −1')}<b>${s.rez}</b>${btn('rez+','+',s.rez>=s.max||s.down||s.destroyed,'REZ +1')}<span>/ ${s.max}</span></div>`;
}
function deckFootHtml(c,deck,lang){
 const ru=lng(lang)==='ru';
 if(!Array.isArray(deck?.entries)||!deck.entries.some(e=>progState(e)))return '';
 return `<div class="rp-actions"><button type="button" class="rt-button" data-rp-deck="jackout">${ru?'Jack Out: сбросить активность и REZ':'Jack Out: reset activation and REZ'}</button></div><p class="rt-help">${ru?'Активация и деактивация тратят NET-действие. При REZ 0 программа Derezzed: деактивируйте и активируйте её снова, чтобы восстановить.':'Activating and deactivating cost a NET Action. At REZ 0 a program is Derezzed: deactivate and activate it again to restore it.'}</p>`;
}
// How many copies of a program the character owns and has not installed yet (bought in the catalog).
function ownedFree(c,catalogId){
 const x=c?.extra||{},owned=(Array.isArray(x.items)?x.items:[]).filter(i=>obj(i)&&i.catalogId===catalogId).reduce((n,i)=>n+Math.max(0,Math.trunc(Number(i.quantity)||0)),0);
 const installed=(Array.isArray(x.cyberdecks?.decks)?x.cyberdecks.decks:[]).reduce((n,d)=>n+(Array.isArray(d?.entries)?d.entries.filter(e=>obj(e)&&e.catalogId===catalogId).length:0),0);
 return {owned,installed,free:Math.max(0,owned-installed)};
}
function ownedMark(c,catalogId,lang){const o=ownedFree(c,catalogId);return o.owned?(lng(lang)==='ru'?` · куплено ${o.owned}, свободно ${o.free}`:` · owned ${o.owned}, free ${o.free}`):''}
/* op: 'toggle' | 'rez-' | 'rez+' for one entry, 'jackout' for the deck. `rank` is the Interface rank.
   -> {ok:true, extra, message?} | {ok:false, message}. Never mutates `c`. */
function deckAct(c,deckId,entryId,op,rank,lang){
 const ru=lng(lang)==='ru',stale={ok:false,message:ru?'Данные изменились. Повторите действие.':'Data changed. Try again.'};
 if(!obj(c)||!obj(c.extra)||!obj(c.extra.cyberdecks)||!Array.isArray(c.extra.cyberdecks.decks))return stale;
 let decks;try{decks=clone(c.extra.cyberdecks)}catch{return stale}
 const deck=decks.decks.find(d=>obj(d)&&d.id===deckId);if(!deck||!Array.isArray(deck.entries))return stale;
 let extra={...c.extra,cyberdecks:decks};
 if(op==='jackout'){
  for(const e of deck.entries)if(obj(e)){delete e.active;delete e.rez;delete e.down;delete e.spent}
  return {ok:true,extra:withRun(extra,{used:0,jackedIn:undefined,cut:undefined,netPenalty:undefined}),message:ru?'Jack Out: программы деактивированы, REZ восстановлен, NET-действия сброшены.':'Jack Out: programs deactivated, REZ restored, NET Actions reset.'};
 }
 const e=deck.entries.find(x=>obj(x)&&x.id===entryId),s=runState(e);if(!s)return stale;
 if(s.destroyed&&(op==='toggle'||op==='rez-'||op==='rez+'))return {ok:false,message:ru?'Программа уничтожена: сначала восстановите её.':'The program is destroyed: restore it first.'};
 if(op==='toggle'){
  const n=netLeft(c,rank);
  if(n.left<1)return {ok:false,message:ru?'NET-действия этого хода исчерпаны. Нажмите «Новый ход».':'No NET Actions remain this turn. Press “New turn”.'};
  if(s.active||s.down){delete e.active;delete e.down;delete e.rez}
  else{e.active=true;delete e.down;if(s.attacker)delete e.rez;else e.rez=s.max}
  return {ok:true,extra:withUsed(extra,n.used+1)};
 }
 if(op==='rez-'||op==='rez+'){
  const next=Math.max(0,Math.min(s.max,s.rez+(op==='rez-'?-1:1)));
  if(next===s.rez)return stale;
  e.rez=next;if(next===0){e.down=true;delete e.active}
  return {ok:true,extra,message:next===0?(ru?`${e.name?.en||''}: REZ 0 — Derezzed.`:`${e.name?.en||''}: REZ 0 — Derezzed.`):''};
 }
 return stale;
}
// The NETRUN tab: the DV for the next check, the NET Actions of the turn.
let netDv=0;
function netrunBar(c,rank,lang){
 const ru=lng(lang)==='ru',n=netLeft(c,rank);
 return `<div class="rp-round rp-netbar" data-rp-netbar><span>${ru?'NET-действия':'NET Actions'}: <b>${n.left}</b> ${ru?'из':'of'} ${n.max}</span><button type="button" class="rt-button" data-rp-net-turn>${ru?'Новый ход':'New turn'}</button><label class="rp-dv">${ru?'DV проверки':'Check DV'} <input type="number" min="0" max="99" inputmode="numeric" data-rp-net-dv value="${netDv||''}" placeholder="${ru?'нет':'none'}"></label></div><p class="netrun-lead">${ru?'Кнопка способности бросает проверку и тратит одно NET-действие (Scanner — физическое действие, не тратит). Активные Worm, Eraser и See Ya дают +2 к своей способности.':'An ability button rolls the check and spends one NET Action (Scanner is a Meat Action and spends none). Rezzed Worm, Eraser and See Ya give +2 to their ability.'}</p>`;
}
/* One press on an ability of the NETRUN tab. -> {ok:true, base, mod, parts, label, dv, extra|null} | {ok:false, message}.
   `mod` is the player's own modifier (values.modifier); `base` and `label` do not contain it (it goes into the check as its own part).
   opts.requireJack: a NET ability pressed while the character is not jacked in explains itself instead of rolling (Scanner is a Meat Action). */
function netrunPlan(c,rank,ability,dv,lang,opts){
 const ru=lng(lang)==='ru',meat=ability==='Scanner',n=netLeft(c,rank);
 if(opts?.requireJack===true&&!meat&&!jackedIn(c))return {ok:false,reason:'jack',message:ru?'Вы не в сети. Нажмите «Войти в сеть», чтобы пользоваться этой способностью.':'You are not jacked in. Press “Jack In” to use this ability.'};
 if(!meat&&n.left<1)return {ok:false,reason:'actions',message:ru?'NET-действия этого хода исчерпаны. Нажмите «Новый ход».':'No NET Actions remain this turn. Press “New turn”.'};
 const skip=Array.isArray(opts?.skip)?opts.skip:[],b=netBonus(c,ability,skip),free=['Scanner','Pathfinder','Cloak'].includes(ability),target=free?0:Math.max(0,Math.min(99,Math.trunc(Number(dv)||0))),mod=netMod(c);
 return {ok:true,base:rank+b.value,mod,parts:mod?[{k:'sheet',v:mod}]:[],dv:target,label:`${ability} (Interface ${rank}${b.value?` + ${b.names.join(', ')} ${b.value}`:''}${b.off?`; ${b.offNames.join(', ')} ${ru?'выкл.':'off'}`:''})`,skipped:b.off||[],extra:meat?null:withUsed(c.extra,n.used+1)};
}
/* The «Атака» of an attacker program. -> {ok:true, base, mod, parts, label, dv, program} | {ok:false, message}.
   Interface rank + ATK of the program (from the catalog); the program has to be active and the character jacked in.
   No NET Action is taken by the attack itself: the repo data does not say the attack costs one, so the player marks it. */
function netrunAttackPlan(c,rank,deckId,entryId,dv,lang){
 const ru=lng(lang)==='ru',decks=c?.extra?.cyberdecks?.decks,deck=Array.isArray(decks)?decks.find(d=>obj(d)&&d.id===deckId):null,e=Array.isArray(deck?.entries)?deck.entries.find(x=>obj(x)&&x.id===entryId):null,s=runState(e);
 if(!s||!s.attacker)return {ok:false,reason:'stale',message:ru?'Данные изменились. Повторите действие.':'Data changed. Try again.'};
 if(!jackedIn(c))return {ok:false,reason:'jack',message:ru?'Вы не в сети. Нажмите «Войти в сеть», чтобы атаковать.':'You are not jacked in. Press “Jack In” to attack.'};
 if(!s.active)return {ok:false,reason:'idle',message:ru?'Программа не активна. Сначала активируйте её.':'The program is not rezzed. Activate it first.'};
 const p=catalogProgram(e.catalogId),atk=Number(p?.stats?.atk),name=String(e.name?.[ru?'ru':'en']||e.name?.en||p?.name?.en||''),mod=netMod(c);
 if(!Number.isSafeInteger(atk))return {ok:false,reason:'stale',message:ru?'Данные изменились. Повторите действие.':'Data changed. Try again.'};
 return {ok:true,base:rank+atk,mod,parts:mod?[{k:'sheet',v:mod}]:[],dv:Math.max(0,Math.min(99,Math.trunc(Number(dv)||0))),label:`${String(e.name?.en||p?.name?.en||'')} (Interface ${rank} + ATK ${atk})`,program:{catalogId:e.catalogId,name,atk}};
}
/* What the damage of an attacker program is, from the data of the tool (NET_DMG): {fixed:true, plan, to, dice, vsIce?} when the number of dice is
   known, {fixed:false} for a program whose effect is only described in text (the player picks the dice). `vsIce` is for programs whose dice
   depend on the target (Sword, Banhammer). */
function attackDamage(catalogId,vsBlackIce){
 const d=NET_DMG[catalogId];if(!d)return {fixed:false};
 const person=d[1]==='brain',plan=netDamagePlan('program',catalogId,person?'person':'program',vsBlackIce===true);
 return plan?{fixed:true,plan,dice:plan.dice,to:plan.to,byTarget:d.length===3}:{fixed:false};
}
// jack in (starts a turn) or out (the same as the Jack Out of the deck, plus the flag). -> {ok, extra, message}
function jackAct(c,op,deckId,rank,lang){
 const ru=lng(lang)==='ru';
 if(!obj(c))return {ok:false,message:ru?'Данные изменились. Повторите действие.':'Data changed. Try again.'};
 if(op==='in'){
  if(jackedIn(c))return {ok:false,message:ru?'Вы уже в сети.':'You are already jacked in.'};
  // A counter already spent (an old save mid-run, or actions spent while out) is the player's turn in progress: it is kept, not refilled.
  if(netLeft(c,rank).used>0)return {ok:true,extra:withRun(c.extra,{jackedIn:true}),message:ru?'Вы в сети. Счётчик NET-действий оставлен как был; нажмите «Новый ход», чтобы восстановить его.':'You are jacked in. The NET Action counter is left as it was; press “New turn” to restore it.'};
  return {ok:true,extra:withRun(c.extra,{used:0,jackedIn:true}),message:ru?'Вы в сети. Новый ход: NET-действия восстановлены.':'You are jacked in. New turn: NET Actions restored.'};
 }
 if(op!=='out')return {ok:false,message:ru?'Данные изменились. Повторите действие.':'Data changed. Try again.'};
 const decks=c.extra?.cyberdecks?.decks;
 // Leaving the net leaves it for every deck of the character: a booster of a second deck must not stay rezzed and counted.
 if(Array.isArray(decks)&&decks.some(d=>obj(d)&&d.id===deckId)){
  let extra=c.extra,done=false;
  for(const d of decks){if(!obj(d)||typeof d.id!=='string')continue;const r=deckAct({...c,extra},d.id,'','jackout',rank,lang);if(r.ok){extra=r.extra;done=true}}
  if(done){const many=decks.filter(d=>obj(d)).length>1;return {ok:true,extra,message:ru?(many?'Вы вышли из сети: программы всех дек деактивированы, REZ восстановлен, NET-действия сброшены.':'Jack Out: программы деактивированы, REZ восстановлен, NET-действия сброшены.'):(many?'You jacked out: programs on all decks deactivated, REZ restored, NET Actions reset.':'Jack Out: programs deactivated, REZ restored, NET Actions reset.')}}
 }
 return {ok:true,extra:withRun(c.extra,{used:0,jackedIn:undefined,cut:undefined,netPenalty:undefined}),message:ru?'Вы вышли из сети. NET-действия сброшены.':'You jacked out. NET Actions reset.'};
}
// ---------- Solo: the round of the fight ----------
/* Spot Weakness and Damage Deflection work once a round and keep a journal by «fight + round». The sheet keeps the current
   fight and round (`extra.soloRound = {version:1, battle, round, n}`), fills both forms from it, and moves on with one button. */
const hasSolo=c=>{try{return global.RoleTools?.hasSolo?global.RoleTools.hasSolo(c)===true:c?.role==='solo'}catch{return c?.role==='solo'}};
function soloRound(c,lang){
 const ru=lng(lang)==='ru',x=c?.extra?.soloRound,name=n=>(ru?'Бой ':'Fight ')+n;
 if(!obj(x)||x.version!==1||typeof x.battle!=='string'||!x.battle.trim()||x.battle.length>100||!int(x.round,1,9999))return {battle:name(1),round:1,n:1,saved:false};
 return {battle:x.battle.trim(),round:x.round,n:int(x.n,1,99999)?x.n:1,saved:true};
}
// kind: 'next' — the next round of the same fight; 'new' — a new fight from round 1. -> the value for extra.soloRound.
function soloAdvance(c,kind,lang){
 const s=soloRound(c,lang),ru=lng(lang)==='ru';
 if(kind==='new'){const n=Math.min(99999,s.n+1);return {version:1,battle:(ru?'Бой ':'Fight ')+n,round:1,n}}
 return {version:1,battle:s.battle,round:Math.min(9999,s.round+1),n:s.n};
}
const same=(a,b)=>norm(a)===norm(b);
// What was already used in the current round, by the journals of the two abilities.
function soloLogged(c,lang){
 const s=soloRound(c,lang),x=c?.extra||{};
 const spot=Array.isArray(x.soloSpotUsage?.uses)&&x.soloSpotUsage.uses.some(u=>obj(u)&&u.round===s.round&&same(u.battle,s.battle));
 const deflect=Array.isArray(x.soloDeflection?.entries)&&x.soloDeflection.entries.some(u=>obj(u)&&u.round===s.round&&same(u.encounter,s.battle));
 return {spot,deflect};
}
// The journal or the player's own mark («the first hit of this round already happened»).
function soloUsed(c,lang){
 const j=soloLogged(c,lang),s=soloRound(c,lang),x=s.saved?c.extra.soloRound:null;
 return {spot:j.spot||x?.spotDone===true,deflect:j.deflect||x?.deflectDone===true};
}
function soloBar(c,lang){
 if(!obj(c)||!hasSolo(c))return '';
 const l=lng(lang),ru=l==='ru',v=c.extra?.roleTools?.solo?.values||{},weak=Number(v.weakness)||0,defl=Number(v.deflect)||0;
 if(!(c.extra?.soloRollAutomation?.enabled===true)||(!weak&&!defl))return '';
 const s=soloRound(c,l),u=soloUsed(c,l);
 const tip=ru?'Отметить: первое попадание в этом раунде уже было':'Mark: the first hit this round already happened';
 const mark=(on,name,used,kind)=>on?`<button type="button" data-rp-solo-mark="${kind}" aria-pressed="${used?'true':'false'}" title="${esc(tip)}" class="${used?'rp-used':''}">${esc(name)}${used?(ru?' — уже в этом раунде':' — used this round'):(ru?' — доступно':' — ready')}</button>`:'';
 return `<div class="rp-round" data-rp-solo-bar><span>${esc(s.battle)} · ${ru?'раунд':'round'} <b>${s.round}</b></span>${mark(weak>0,`Spot Weakness +${weak}`,u.spot,'spot')}${mark(defl>0,`Damage Deflection −${defl}`,u.deflect,'deflect')}<button type="button" class="rt-button" data-rp-solo="next">${ru?'Новый раунд':'Next round'}</button><button type="button" class="rt-button" data-rp-solo="new">${ru?'Новый бой':'New fight'}</button></div>`;
}
// The Damage Deflection form follows the round of the sheet until the player types something else in it.
function deflectReady(c,lang){
 try{const b=global.RoleTools?.soloRollBonuses?.(c);return !!(b?.ok&&b.enabled&&b.deflect>0&&!soloUsed(c,lang).deflect)}catch{return false}
}
function soloFill(c,draft,lang){
 if(!obj(draft)||!obj(c)||!hasSolo(c))return;
 const s=soloRound(c,lang),stamp=s.battle+'#'+s.round;
 if(draft.soloStamp!==stamp){draft.deflectEncounter=s.battle;draft.deflectRound=String(s.round);draft.soloStamp=stamp;draft.pending=null;draft.deflect=deflectReady(c,lang)}
 if(draft.deflect===true&&draft.deflectEncounter===s.battle&&draft.deflectRound===String(s.round)&&soloUsed(c,lang).deflect)draft.deflect=false;
}

// ---------- NET combat: damage after a hit ----------
// [dice against Black ICE or the only value, what is hit, dice against anything that is not Black ICE] (pp. 201–205).
const NET_DMG={'extra-ice-hellhound':[2,'brain'],'extra-ice-giant':[3,'brain'],'extra-ice-kraken':[3,'brain'],'extra-ice-raven':[1,'brain'],'extra-ice-wisp':[1,'brain'],'extra-ice-dragon':[6,'rez'],'extra-ice-killer':[4,'rez'],'extra-ice-sabertooth':[6,'rez'],'extra-program-hellbolt':[2,'brain'],'extra-program-vrizzbolt':[1,'brain'],'extra-program-sword':[3,'rez',2],'extra-program-banhammer':[2,'rez',3]};
// mode: 'program' | 'ice' | 'zap'; source: catalog id of what attacks; target: 'program' | 'person'. null when the hit has no dice of damage.
function netDamagePlan(mode,source,target,vsBlackIce){
 if(mode==='zap')return {dice:1,to:target==='person'?'brain':'rez'};
 if(mode!=='program'&&mode!=='ice')return null;
 const d=NET_DMG[source];if(!d)return null;
 if((d[1]==='brain')!==(target==='person'))return null;
 return {dice:d.length===3&&!vsBlackIce?d[2]:d[0],to:d[1]};
}
function netDamageRoll(plan,rng=Math.random){
 if(!plan||!int(plan.dice,1,12))return null;
 const dice=[];for(let i=0;i<plan.dice;i++){const v=rng(),f=typeof v==='number'&&v>=0&&v<1?1+Math.floor(v*6):null;if(f===null)return null;dice.push(f)}
 return {dice,total:dice.reduce((a,b)=>a+b,0),to:plan.to};
}
// An active, not derezzed Armor on any deck of the character takes 4 off brain damage.
function armorUp(c){
 const decks=c?.extra?.cyberdecks?.decks;if(!Array.isArray(decks))return false;
 return decks.some(d=>Array.isArray(d?.entries)&&d.entries.some(e=>obj(e)&&e.catalogId==='extra-program-armor'&&e.active===true&&e.down!==true&&e.destroyed!==true&&e.spent!==true));
}
function netRezAfter(entry,total){const before=Math.max(0,Math.trunc(Number(entry?.rez)||0)),after=Math.max(0,before-Math.max(0,Math.trunc(Number(total)||0)));return {before,after,state:after===0&&before>0?'derezzed':entry?.state}}
function netBrainAfter(c,total,armor){const before=Math.trunc(Number(c?.hp)||0),taken=Math.max(0,Math.trunc(Number(total)||0)-(armor?4:0));return {before,after:Math.max(0,before-taken),taken}}
/* Called by the NET calculator right after an opposed roll. Names the two sides on the result and, on a hit, rolls the damage.
   info: {l, mode, target, program, ice, iceKey, iceRef, runner, runners, draft}. */
function netAfterRoll(r,info){
 if(!obj(r)||!obj(info))return;
 const l=lng(info.l),ru=l==='ru',mode=info.mode,person=info.target==='person';
 const name=x=>String(x?.name?.[l]||x?.name?.en||x?.name||'').trim();
 const runner=info.runner?String(info.runner.name||'').trim():'',iceName=info.ice?String(info.ice.name||'').trim()||'Black ICE':'',program=info.program?name(info.program):'';
 const side=(who,what)=>[who,what].filter(Boolean).join(' · ');
 if(mode==='program')r.labels={attack:side(runner||(ru?'Нетраннер':'Netrunner'),(program?program+' ':'')+'ATK + Interface'),defend:person?(ru?'Interface цели':'Target Interface'):side(iceName||(ru?'Цель':'Target'),'DEF')};
 else if(mode==='ice')r.labels={attack:side(iceName||'Black ICE','ATK'),defend:person?side(runner||(ru?'Нетраннер':'Netrunner'),'Interface'):(ru?'DEF программы':'Program DEF')};
 else if(mode==='zap')r.labels={attack:side(runner||(ru?'Нетраннер':'Netrunner'),'Zap · Interface'),defend:person?(ru?'Interface цели':'Target Interface'):side(iceName||(ru?'Цель':'Target'),'DEF')};
 else if(mode==='encounter')r.labels={attack:side(iceName||'Black ICE','SPEED'),defend:side(runner||(ru?'Нетраннер':'Netrunner'),'Interface + Speed')};
 if(!r.hit)return;
 const source=mode==='program'?info.program?.id:mode==='ice'?info.iceRef?.id:'',vsIce=mode!=='ice'&&!!info.ice,plan=netDamagePlan(mode,source,info.target,vsIce),roll=netDamageRoll(plan);
 if(!roll)return;
 const what=mode==='zap'?'Zap':mode==='ice'?(name(info.iceRef)||iceName):program;
 r.damage={dice:roll.dice,total:roll.total,to:roll.to,source:what,iceKey:roll.to==='rez'&&vsIce?String(info.iceKey||''):'',vsIce,applied:null};
 if(roll.to==='brain'&&obj(info.draft)){
  const d=info.draft,list=Array.isArray(info.runners)?info.runners:[];
  // Who takes it: the attacker's own sheet is never the default target of his own program.
  const others=mode==='ice'?list:list.filter(c=>c!==info.runner);
  if(!d.victim||!list.some(c=>c.id===d.victim))d.victim=others.length===1?others[0].id:(mode==='ice'&&info.runner?info.runner.id:'');
  const v=list.find(c=>c.id===d.victim);d.armor=armorUp(v);
 }
 try{global.Rolls?.sum?.('NET · '+(ru?'урон':'damage')+(what?' · '+what:''),roll.dice,6,{note:roll.to==='brain'?(ru?'в мозг, напрямую в HP':'to the brain, straight to HP'):'REZ'})}catch{}
}
function netDamageHtml(r,info){
 const dm=r?.damage;if(!obj(dm)||!obj(info))return '';
 const l=lng(info.l),ru=l==='ru',d=info.draft||{},dice=`${dm.dice.length}d6 (${dm.dice.join(' + ')}) = <strong>${dm.total}</strong>`;
 let h=`<div class="rp-result" data-rp-net-damage><div>${ru?'Урон':'Damage'}${dm.source?' · '+esc(dm.source):''}: ${dice} ${dm.to==='brain'?(ru?'в мозг, напрямую в HP':'to the brain, straight to HP'):(ru?'по REZ':'to REZ')}</div>`;
 if(dm.applied)return h+`<div class="rp-done">${esc(dm.applied)}</div>${dm.undo?`<div class="rp-actions"><button type="button" class="btn ghost" data-net="combat-undo">${ru?'Отменить применение':'Undo'}</button></div>`:''}</div>`;
 if(dm.to==='rez'){
  const e=info.ice;
  if(e&&dm.iceKey){const n=netRezAfter(e,dm.total);h+=`<div>REZ ${esc(e.name||'Black ICE')}: ${n.before} → <strong>${n.after}</strong>${n.after===0&&n.before>0?' · '+(ru?'Derezzed':'Derezzed'):''}</div><div class="rp-actions"><button type="button" class="btn primary" data-net="combat-apply">${ru?'Применить к ICE':'Apply to the ICE'}</button></div>`}
  else if(!info.programPick)h+=`<p class="rp-note">${dm.vsIce?'':ru?(info.mode==='ice'?'Снизьте REZ программы на листе нетраннера: вкладка NETRUN, кибердека.':'Цель не выбрана из архитектуры: урон посчитан как по не-Black ICE. Снизьте REZ цели вручную.'):(info.mode==='ice'?'Lower the REZ of the program on the Netrunner’s sheet: NETRUN tab, cyberdeck.':'The target is not picked from the architecture: damage is rolled as against non-Black ICE. Lower the target’s REZ by hand.')}</p>`;
 }else{
  const list=Array.isArray(info.runners)?info.runners:[],v=list.find(c=>c.id===d.victim);
  h+=`<label class="field">${ru?'Кто получает урон':'Who takes the damage'}<select data-net-combat="victim"><option value="">${ru?'Не выбран':'Not selected'}</option>${list.map(c=>`<option value="${esc(c.id)}"${c.id===d.victim?' selected':''}>${esc(c.name||'—')} · HP ${esc(c.hp)}</option>`).join('')}</select></label><label class="rp-check"><input type="checkbox" data-net-combat="armor"${d.armor?' checked':''}> ${ru?'Активна программа Armor: −4 к урону':'An Armor program is active: −4 damage'}</label>`;
  if(v){const n=netBrainAfter(v,dm.total,d.armor===true);h+=`<div>HP ${esc(v.name||'—')}: ${n.before} → <strong>${n.after}</strong>${d.armor?` (${dm.total} − 4)`:''}</div><div class="rp-actions"><button type="button" class="btn primary" data-net="combat-apply">${ru?'Применить к листу':'Apply to the sheet'}</button></div>`}
  else h+=`<p class="rp-note">${ru?'Выберите нетраннера с личного листа, чтобы списать HP, или учтите урон сами.':'Choose a Netrunner from the personal sheets to take the HP off, or track the damage yourself.'}</p>`;
 }
 return h+'</div>';
}
/* What applying the rolled damage changes. -> {ok:true, message, ice?:{rez,state}, victim?:{hp,extra}, undo} | {ok:false, message}.
   Nothing is mutated here: the calculator writes the returned values. */
function netApply(dm,info){
 const l=lng(info?.l),ru=l==='ru',stale={ok:false,message:ru?'Данные изменились. Бросьте ещё раз.':'Data changed. Roll again.'};
 if(!obj(dm)||dm.applied||!int(dm.total,0,999))return stale;
 if(dm.to==='rez'){
  const e=info.ice;if(!obj(e)||!dm.iceKey)return stale;
  const n=netRezAfter(e,dm.total);
  return {ok:true,ice:{rez:n.after,state:n.state},undo:{kind:'ice',rez:n.before,state:e.state,after:n.after},message:ru?`REZ ${e.name||'Black ICE'}: ${n.before} → ${n.after}${n.after===0&&n.before>0?' · Derezzed':''}.`:`${e.name||'Black ICE'} REZ: ${n.before} → ${n.after}${n.after===0&&n.before>0?' · Derezzed':''}.`};
 }
 const v=info.victim;if(!obj(v)||!Number.isFinite(Number(v.hp)))return {ok:false,message:ru?'Выберите, кто получает урон.':'Choose who takes the damage.'};
 const n=netBrainAfter(v,dm.total,info.armor===true),med=v.extra?.medical,reopen=n.taken>0&&obj(med)&&med.stabilized===true;
 return {ok:true,victim:{hp:n.after,extra:reopen?{...v.extra,medical:{...med,stabilized:false}}:null},undo:{kind:'victim',id:v.id,hp:n.before,after:n.after,medical:reopen?med:null},message:ru?`${v.name||'Нетраннер'}: урон в мозг ${n.taken}${info.armor?' (Armor −4)':''}, HP ${n.before} → ${n.after}.`:`${v.name||'Netrunner'}: ${n.taken} brain damage${info.armor?' (Armor −4)':''}, HP ${n.before} → ${n.after}.`};
}

// ---------- the page ----------
const doc=global.document;
function sheetRoleIntoView(){
 const el=doc.querySelector('#sheet-role');if(!el||!el.getBoundingClientRect)return;
 const r=el.getBoundingClientRect(),h=global.innerHeight||0;
 if(r.height>0&&(r.top<0||r.top>h*0.55))try{el.scrollIntoView({block:'start',behavior:'auto'})}catch{}
}
function openTools(target){
 const A=global.App,c=A?.active?.();
 if(target==='role'){
  doc.querySelector('[data-sheet-tab="combat"]')?.click();
  try{global.DossierPanel?.setFilter?.(doc.documentElement.classList.contains('ui-board')?'role':'all')}catch{}
  setTimeout(()=>{const el=doc.querySelector('#sheet-role');if(el){try{el.scrollIntoView({block:'start'})}catch{}try{el.focus({preventScroll:true})}catch{}}},60);
  return;
 }
 if(c?.id){
  if(target==='repair')try{global.MakerProjects?.select?.(c.id)}catch{}
  if(target==='medical')try{global.PharmacyTools?.select?.(c.id)}catch{}
 }
 if(['repair','medical','net'].includes(target))global.location.hash='#/'+target;
}
function refreshSummary(){
 const box=doc.querySelector('[data-rp-summary]'),c=global.App?.active?.();if(!box||!c)return;
 const html=summary(c,global.App?.lang?.());if(!html)return;
 const t=doc.createElement('div');t.innerHTML=html;const next=t.firstElementChild;if(next&&next.innerHTML!==box.innerHTML)box.innerHTML=next.innerHTML;
}
/* A press inside the Role block redraws the sheet, and with a chip of «Действия» on the blocks above are hidden again only
   after that, so the page used to jump away from the pressed button. The button is put back where it was. */
function holdButton(e){
 const b=e.target?.closest?.('#sheet-role button');if(!b||!b.getBoundingClientRect)return;
 const sign=x=>{try{return JSON.stringify(Object.entries(x.dataset))}catch{return ''}};
 const all=()=>[...doc.querySelectorAll('#sheet-role button')],index=all().indexOf(b),mark=sign(b),top=b.getBoundingClientRect().top;
 setTimeout(()=>{
  const next=all()[index];if(!next||sign(next)!==mark)return;
  const delta=next.getBoundingClientRect().top-top;
  if(Math.abs(delta)>2)try{global.scrollBy(0,delta)}catch{}
  // The result line stands under the button; it must not end up under the bottom bar of a phone.
  const line=next.nextElementSibling?.classList?.contains('rt-last-inline')?next.nextElementSibling:null,room=(global.innerHeight||0)-96;
  if(line&&room>0){const over=line.getBoundingClientRect().bottom-room;if(over>0)try{global.scrollBy(0,over)}catch{}}
 },0);
}
/* The DV field of the NETRUN tab (not stored in the sheet): read from the field when it is on the page, else the last value.
   An ability press of the tab: the check with the DV, the boosters, the wound penalty and the own modifier, then one NET Action is spent.
   -> {ok:true, plan, out} | {ok:false, message} (the message is shown and the console may explain it); false without the app. */
function readDv(){const field=doc?.querySelector?.('[data-rp-net-dv]');if(field)netDv=Math.max(0,Math.min(99,Math.trunc(Number(field.value)||0)));return netDv}
function netrunRoll(c,rank,ability,opts){
 const A=global.App;if(!A||!c)return false;
 const dv=opts&&Number.isInteger(opts.dv)?Math.max(0,Math.min(99,opts.dv)):readDv(),p=netrunPlan(c,rank,ability,dv,A.lang?.(),{requireJack:!!global.NetrunConsole,skip:global.NetrunEffects?.skipList?.(c)});
 if(!p.ok){A.notify?.(p.message);redrawNet(c,rank);return {ok:false,message:p.message,reason:p.reason}}
 // opts.suffix: a target named by the caller (a record of a net architecture shown by the Game Master), appended to the label.
 const out=A.check(p.base,opts&&typeof opts.suffix==='string'&&opts.suffix?p.label+' → '+opts.suffix:p.label,{dv:p.dv,mod:p.mod,parts:p.parts.length?p.parts:undefined});
 if(p.extra){c.extra=p.extra;try{A.save?.()}catch{}}
 if(p.skipped?.length)try{global.NetrunEffects?.consume?.(c,p.skipped)}catch{}
 redrawNet(c,rank);
 return {ok:true,plan:p,out,ability};
}
// The toast stays; only the console (or the old counter bar) is redrawn.
function redrawNet(c,rank){
 const A=global.App;
 if(global.NetrunConsole?.refresh){try{global.NetrunConsole.refresh()}catch{}}
 else{const bar=doc?.querySelector?.('[data-rp-netbar]');if(bar){const t=doc.createElement('div');t.innerHTML=netrunBar(c,rank,A?.lang?.());const next=t.querySelector('[data-rp-netbar]');if(next)bar.innerHTML=next.innerHTML}}
 try{global.RoleTools?.refresh?.(doc?.querySelector?.('[data-rt-root]'),c,A?.lang?.())}catch{}
}
/* «Атака» of an attacker program: the same check path (App.check), Interface rank + ATK + modifiers, against the DV field.
   -> {ok:true, plan, out, deckId, entryId} | {ok:false, message} | false. */
function netrunAttack(c,rank,deckId,entryId){
 const A=global.App;if(!A||!c)return false;
 const dv=readDv(),p=netrunAttackPlan(c,rank,deckId,entryId,dv,A.lang?.());
 if(!p.ok){A.notify?.(p.message);return {ok:false,message:p.message,reason:p.reason}}
 const out=A.check(p.base,p.label,{dv:p.dv,mod:p.mod,parts:p.parts.length?p.parts:undefined});
 return {ok:true,plan:p,out,deckId,entryId};
}
if(doc?.addEventListener){
 doc.addEventListener('input',e=>{const f=e.target?.closest?.('[data-rp-net-dv]');if(f)netDv=Math.max(0,Math.min(99,Math.trunc(Number(f.value)||0)))});
 doc.addEventListener('click',holdButton,true);
 doc.addEventListener('click',e=>{
  const t=e.target;if(!t?.closest)return;
  const open=t.closest('[data-rp-open]');if(open){e.preventDefault?.();openTools(open.dataset.rpOpen);return}
  const deckButton=t.closest('[data-rp-deck]');if(deckButton){
   const A=global.App,c=A?.active?.(),rank=global.NetrunTab?.interfaceRank?.(c)||Number(c?.rank)||1;if(!c)return;
   if(deckButton.dataset.rpDeck==='jackout'&&global.NetrunConsole?.jack?.('out',deckButton.closest('[data-deck-id]')?.dataset.deckId))return;
   const r=deckAct(c,deckButton.closest('[data-deck-id]')?.dataset.deckId,deckButton.dataset.deckEntry,deckButton.dataset.rpDeck,rank,A.lang?.());
   if(r.ok){c.extra=r.extra;try{A.save?.();A.render?.()}catch{}}
   if(r.message)try{A.notify?.(r.message)}catch{}
   return;
  }
  if(t.closest('[data-rp-net-turn]')){
   const A=global.App,c=A?.active?.();if(!c)return;
   c.extra=turnExtra(c.extra);try{A.save?.();A.render?.()}catch{}
   return;
  }
  const markBtn=t.closest('[data-rp-solo-mark]');if(markBtn){
   const A=global.App,c=A?.active?.();if(!c||!hasSolo(c))return;
   const l=A.lang?.(),kind=markBtn.dataset.rpSoloMark==='deflect'?'deflect':'spot',field=kind+'Done',ru=lng(l)==='ru';
   if(soloLogged(c,l)[kind]){try{A.notify?.(ru?'Уже записано в журнале этого раунда.':'Already recorded in this round\'s log.')}catch{}return}
   const s=soloRound(c,l),base=s.saved?c.extra.soloRound:{version:1,battle:s.battle,round:s.round,n:s.n},next={...base};
   if(base[field]===true)delete next[field];else next[field]=true;
   c.extra={...(obj(c.extra)?c.extra:{}),soloRound:next};
   try{A.save?.();A.render?.()}catch{}
   return;
  }
  const solo=t.closest('[data-rp-solo]');if(solo){
   const A=global.App,c=A?.active?.();if(!c||!hasSolo(c))return;
   const l=A.lang?.(),next=soloAdvance(c,solo.dataset.rpSolo==='new'?'new':'next',l);
   c.extra={...(obj(c.extra)?c.extra:{}),soloRound:next};
   try{A.save?.();A.render?.()}catch{}
   try{A.notify?.(l==='en'?`${next.battle}, round ${next.round}. Spot Weakness and Damage Deflection are ready again.`:`${next.battle}, раунд ${next.round}. Spot Weakness и Damage Deflection снова доступны.`)}catch{}
   return;
  }
  // The «Роль» chip: on a phone the panel is far below the chips, so it is brought into view.
  if(t.closest('[data-dossier-filter="role"]')){setTimeout(sheetRoleIntoView,40);return}
  if(t.closest('[data-sheet-tab="role"]'))setTimeout(refreshSummary,0);
 });
}

global.RolePlay={placeLast,summary,ledger,doses,makerCandidates,makerTargets,makerForm,makerDeliver,makerDeliveredLine,firstWithRole,openTools,
 netDamagePlan,netDamageRoll,netRezAfter,netBrainAfter,netAfterRoll,netDamageHtml,netApply,armorUp,
 soloRound,soloAdvance,soloUsed,soloLogged,soloBar,soloFill,
 BOOST,progState,runState,netMod,jackedIn,withRun,turnExtra,netLeft,netBonus,deckEntryHtml,deckFootHtml,ownedFree,ownedMark,deckAct,jackAct,netrunBar,netrunPlan,netrunRoll,netrunAttackPlan,netrunAttack,attackDamage,getDv:()=>netDv};
})(window);
