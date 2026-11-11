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
 const d=c?.extra?.pharmacy?.doses,out=[];if(!obj(d))return out;
 for(const k of Object.keys(DRUG_NAMES)){const n=Number(d[k]);if(Number.isSafeInteger(n)&&n>0)out.push([k,DRUG_NAMES[k],n])}
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
 const all=()=>[...doc.querySelectorAll('#sheet-role button')],index=all().indexOf(b),text=b.textContent,top=b.getBoundingClientRect().top;
 setTimeout(()=>{
  const next=all()[index];if(!next||next.textContent!==text)return;
  const delta=next.getBoundingClientRect().top-top;
  if(Math.abs(delta)>2)try{global.scrollBy(0,delta)}catch{}
  // The result line stands under the button; it must not end up under the bottom bar of a phone.
  const line=next.nextElementSibling?.classList?.contains('rt-last-inline')?next.nextElementSibling:null,room=(global.innerHeight||0)-96;
  if(line&&room>0){const over=line.getBoundingClientRect().bottom-room;if(over>0)try{global.scrollBy(0,over)}catch{}}
 },0);
}
if(doc?.addEventListener){
 doc.addEventListener('click',holdButton,true);
 doc.addEventListener('click',e=>{
  const t=e.target;if(!t?.closest)return;
  const open=t.closest('[data-rp-open]');if(open){e.preventDefault?.();openTools(open.dataset.rpOpen);return}
  // The «Роль» chip: on a phone the panel is far below the chips, so it is brought into view.
  if(t.closest('[data-dossier-filter="role"]')){setTimeout(sheetRoleIntoView,40);return}
  if(t.closest('[data-sheet-tab="role"]'))setTimeout(refreshSummary,0);
 });
}

global.RolePlay={placeLast,summary,ledger,doses,makerCandidates,makerTargets,makerForm,makerDeliver,makerDeliveredLine,firstWithRole,openTools};
})(window);
