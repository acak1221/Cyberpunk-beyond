/* Tabbed character sheet. Presentation only: sections stay in the DOM and keep
   their own handlers; CSS (theme.css) hides the ones outside the active tab. */
(function(global){
'use strict';
const KEY='nightcity-red-sheet-tab-v1';
const TABS=[
 ['main','Основное','Overview','◈'],
 ['skills','Навыки','Skills','▤'],
 ['combat','Бой','Combat','⌖'],
 ['gear','Снаряжение','Gear','◇'],
 ['role','Роль','Role','✳'],
 ['life','Жизнь','Life','⌁'],
 ['netrun','NETRUN','NETRUN','⌬'],
 ['all','Весь лист','Full sheet','☰'],
];
const IDS=new Set(TABS.map(t=>t[0]));
/* The «Досье» look has its own set, after the tabletop character boards: the rolls of a fight and of the Role are «Действия»,
   what works by itself is «Особенности», and who the character is — «Персонаж». «Основное» and «Весь лист» are not there:
   the STATs, the condition and the skills are on the board all the time. The ids stay the same, so a saved tab still means something. */
const BOARD_TABS=[
 ['combat','Действия','Actions','⌖'],
 ['skills','Навыки','Skills','▤'],
 ['gear','Снаряжение','Gear','◇'],
 ['role','Особенности','Features','✳'],
 ['life','Персонаж','Character','⌁'],
 ['netrun','NETRUN','NETRUN','⌬'],
];
const BOARD_OWNER={'sheet-identity':'life','sheet-stats':'life','sheet-resources':'life','sheet-reputation':'life','sheet-role':'combat','sheet-role-ability':'role','sheet-features':'role'};
// Which tab owns each jump-nav target, so links into the sheet still land somewhere visible.
const OWNER={'sheet-identity':'main','sheet-stats':'main','sheet-resources':'main','sheet-reputation':'main','sheet-vitals':'main','sheet-skills':'skills','sheet-specializations':'skills','sheet-weapons':'combat','sheet-damage':'combat','reload-tools-mount':'combat','sheet-equipment':'gear','sheet-items':'gear','sheet-role':'role','sheet-role-ability':'role','sheet-ip':'life','sheet-lifepath':'life','sheet-notes':'life','sheet-agent':'life','sheet-netrun':'netrun'};
let current='main',lastCharacter=null,hpOpen=false,hpReason='damage',dv=0,locked=false;
const LOCK_KEY='nc-sheet-lock',DVS=[[9,'Простая','Simple'],[13,'Обычная','Everyday'],[15,'Сложная','Difficult'],[17,'Профессиональная','Professional'],[21,'Героическая','Heroic'],[24,'Невероятная','Incredible'],[29,'Легендарная','Legendary']];
try{locked=global.localStorage?.getItem(LOCK_KEY)==='1'}catch{}
const STATS=['INT','REF','DEX','TECH','COOL','WILL','LUCK','MOVE','BODY','EMP'];
try{const saved=global.localStorage?.getItem(KEY);if(IDS.has(saved))current=saved}catch{}

function lang(){return global.document.documentElement.lang==='en'?'en':'ru'}
/* The «Досье» look keeps the skills beside the tab panel on a wide screen, so there the «Навыки» tab has nothing of its own
   to show: the panel shows «Основное» instead. The chosen tab is kept and comes back on a narrow screen or in another look. */
const WIDE='(min-width: 1024px)',WIDEST='(min-width: 1360px)';
function board(){try{return !!global.document.documentElement.classList?.contains('ui-board')}catch{return false}}
function boardWide(){try{return board()&&!!global.matchMedia?.(WIDE)?.matches}catch{return false}}
const shown=()=>board()&&(current==='main'||current==='all'||(current==='skills'&&boardWide()))?'combat':current;
const tabList=()=>board()?BOARD_TABS:TABS;
// The tab a section of the sheet is shown under, in the look that is on. On the wide board the specializations stand with the features.
function owner(id){
 if(board()){
  if(id==='sheet-specializations'&&boardWide())return 'role';
  // The condition block has a column of its own on the widest board (every tab shows it); below that it is part of «Персонаж».
  if(id==='sheet-vitals'){let own=false;try{own=!!global.matchMedia?.(WIDEST)?.matches}catch{}return own?shown():'life'}
  if(BOARD_OWNER[id])return BOARD_OWNER[id];
 }
 return OWNER[id];
}
function bar(){
 const ru=lang()==='ru';
 const net=global.NetrunTab?.interfaceRank?.(lastCharacter)>0;
 return `<div class="sheet-tabs" role="tablist" aria-label="${ru?'Разделы листа':'Sheet sections'}">${tabList().filter(([id])=>id!=='netrun'||net).map(([id,r,e,icon])=>`<button type="button" role="tab" data-sheet-tab="${id}" aria-selected="${id===shown()}" class="${id===shown()?'active':''}"><span aria-hidden="true">${icon}</span>${ru?r:e}</button>`).join('')}</div>`;
}
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const html=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function vitals(c){
 const st=c?.stats||{},max=10+5*Math.ceil((num(st.BODY)+num(st.WILL))/2),hp=num(c?.hp);
 const wound=hp<1?'mortal':hp<Math.ceil(max/2)?'serious':hp<max?'light':'full';
 const luckMax=num(st.LUCK),luck=c?.extra&&c.extra.luck!==undefined&&c.extra.luck!==''?num(c.extra.luck):luckMax;
 return {hp,max,wound,humanity:num(c?.humanity),emp:Math.max(0,Math.floor(num(c?.humanity)/10)),luck,luckMax};
}
function hud(c){
 if(!c)return '';
 const ru=lang()==='ru',v=vitals(c),n=pending(c),w={full:ru?'Без ранений':'Unhurt',light:ru?'Лёгкое ранение':'Lightly wounded',serious:ru?'Тяжёлое ранение · −2':'Seriously wounded · −2',mortal:ru?'Смертельное ранение · −4':'Mortally wounded · −4'}[v.wound];
 return `<div class="sheet-hud" data-wound="${v.wound}">${global.Portrait?.html(c,'hud-avatar',{small:true})||''}<button type="button" class="hud-chip hud-hp" data-hud-hp aria-expanded="${hpOpen}" aria-controls="hud-hp-panel" title="${html(w)}"><span aria-hidden="true">♥</span><b>${v.hp}</b><small>/ ${v.max}</small><em>${html(w)}</em></button><button type="button" class="hud-chip" data-hud-jump="sheet-vitals"><span aria-hidden="true">◈</span><small>HUM</small><b>${v.humanity}</b><small>EMP ${v.emp}</small></button><button type="button" class="hud-chip${n.use?' hud-pending':''}" data-hud-next data-hud-jump="sheet-resources"><span aria-hidden="true">✳</span><small>LUCK</small><b>${v.luck}</b><small>/ ${v.luckMax}</small>${n.use?`<i class="hud-plus">+${n.use}</i>`:''}</button>${n.mod?`<button type="button" class="hud-chip hud-pending" data-hud-next data-hud-jump="sheet-resources"><small>${ru?'Модификатор':'Modifier'}</small><b>${sign(n.mod)}</b></button>`:''}<button type="button" class="hud-chip hud-lock${locked?' active':''}" data-sheet-lock aria-pressed="${locked}" aria-label="${ru?'Режим игры: не менять характеристики и навыки':'Play mode: lock STATs and Skills'}" title="${ru?'Режим игры: не менять характеристики и навыки':'Play mode: lock STATs and Skills'}"><span aria-hidden="true">${locked?'🔒':'🔓'}</span></button>${global.KeepAwake?.button?.(lang(),true)||''}</div>`;
}
function extras(c){
 if(!c)return '';
 const ru=lang()==='ru';
 return `${nextRoll(c)}${quickRolls(c)}<div class="sheet-shop"><button type="button" class="btn ghost" data-sheet-shop>${ru?'Купить в каталоге':'Buy from the catalog'} →</button></div><div class="sheet-stat-strip" aria-label="${ru?'Характеристики':'Statistics'}">${STATS.map(k=>`<div><small>${k}</small><b>${html(c?.stats?.[k]??'—')}</b></div>`).join('')}</div>`;
}
const sign=n=>(n<0?'−':'+')+Math.abs(n);
// What is set for the next roll: the check modifier and the LUCK to spend (never more than the pool).
function pending(c){
 const x=c?.extra||{},v=vitals(c);
 return {mod:Math.max(-100,Math.min(100,Math.trunc(num(x.modifier)))),use:Math.min(v.luck,Math.max(0,Math.trunc(num(x.luckUse)))),hold:x.modifierHold===true,luck:v.luck};
}
function nextRoll(c){
 const ru=lang()==='ru',n=pending(c);
 const step=(kind,d,label,off)=>`<button type="button" data-next-roll="${kind}" data-delta="${d}" data-keep="${kind}${d}" aria-label="${html(label)} ${d<0?'−1':'+1'}"${off?' disabled':''}>${d<0?'−':'+'}</button>`;
 const mod=ru?'Модификатор':'Modifier';
 return `<div class="sheet-next-roll" role="group" aria-label="${ru?'Следующий бросок':'Next roll'}"><div class="nr-step${n.mod?' on':''}"><small>${mod}</small>${step('modifier',-1,mod,n.mod<=-100)}<b>${n.mod?sign(n.mod):'0'}</b>${step('modifier',1,mod,n.mod>=100)}<button type="button" class="nr-hold" data-next-roll="hold" data-keep="hold" aria-pressed="${n.hold}" title="${ru?'Не сбрасывать модификатор после броска':'Keep the modifier after a roll'}">${ru?'Закрепить':'Keep'}</button></div><div class="nr-step${n.use?' on':''}"><small>LUCK</small>${step('luckUse',-1,'LUCK',n.use<=0)}<b>${n.use?'+'+n.use:'0'}</b>${step('luckUse',1,'LUCK',n.use>=n.luck)}<small>${ru?'из':'of'} ${n.luck}</small></div><label class="nr-step nr-dv${dv?' on':''}"><small>DV</small><select data-next-dv data-keep="dv" aria-label="${ru?'Сложность следующей проверки':'Difficulty of the next check'}"><option value="0">${ru?'не задана':'not set'}</option>${DVS.map(([value,r,e])=>`<option value="${value}"${dv===value?' selected':''}>${value} · ${ru?r:e}</option>`).join('')}</select></label></div>`;
}
function quickRolls(c){
 const ru=lang()==='ru',st=c?.stats||{},sk=c?.skills||{},A=global.App;
 const bonus=(stat,level)=>typeof A?.checkBonus==='function'?A.checkBonus(c,stat,level):num(st[stat])+num(level);
 const death=Math.max(0,num(st.BODY)-Math.max(0,num(c?.extra?.deathPenalty)));
 const rolls=[
  ['[data-action="initiative-roll"]',ru?'Инициатива':'Initiative',sign(typeof A?.initiativeBonus==='function'?A.initiativeBonus(c):num(st.REF)),'1d10 + REF'],
  ['[data-action="skill-roll"][data-skill="Evasion"]',ru?'Уклонение':'Evasion',sign(bonus('DEX',sk.Evasion)),'1d10 + DEX + '+(ru?'Уклонение':'Evasion')],
  ['[data-action="skill-roll"][data-skill="Brawling"]',ru?'Рукопашный бой':'Brawling',sign(bonus('DEX',sk.Brawling)),'1d10 + DEX + '+(ru?'Рукопашный бой':'Brawling')],
  ['[data-cx-action="facedown"]',ru?'Лицом к лицу':'Facedown',sign(num(st.COOL)+(c?.extra?.reputationCoward===true?-1:1)*Math.max(0,Math.min(10,Math.trunc(num(c?.extra?.reputation))))),'1d10 + COOL + '+(ru?'репутация':'Reputation')],
  ['[data-cx-action="death-save"]',ru?'Спасбросок от смерти':'Death Save','< '+death,ru?'1d10 + штраф должно быть ниже BODY; 10 — всегда провал':'1d10 + penalty must be under BODY; a 10 always fails'],
 ];
 return `<div class="sheet-quick-rolls">${rolls.map(([target,label,total,hint])=>`<button type="button" data-proxy-roll="${html(target)}" title="${html(hint)}"><span>${html(label)}</span><b>${html(total)}</b></button>`).join('')}</div>`;
}
// Quick HP: steps and «take N damage» from the HUD. The sheet's own HP field does the work, so its rules stay in one place.
function hpPanel(c){
 const ru=lang()==='ru',v=vitals(c);
 const step=d=>`<button type="button" data-hp-step="${d}" aria-label="HP ${d<0?'−':'+'}${Math.abs(d)}">${d<0?'−':'+'}${Math.abs(d)}</button>`;
 const reason=(id,label)=>`<button type="button" role="radio" data-hp-reason="${id}" aria-checked="${hpReason===id}">${label}</button>`;
 return `<div class="hud-hp-row">${step(-5)}${step(-1)}<span class="hud-hp-now" data-hp-now aria-live="polite"><b>${v.hp}</b><small>/ ${v.max}</small></span>${step(1)}${step(5)}</div><div class="hud-hp-row"><label>${ru?'Урон':'Damage'}<input type="number" inputmode="numeric" min="1" max="999" data-hp-amount placeholder="0"></label><button type="button" class="btn small" data-hp-take>${ru?'Получить урон':'Take damage'}</button><button type="button" class="btn ghost small" data-hud-jump="sheet-damage">${ru?'С учётом брони':'With armor'}</button></div><div class="hud-hp-row hud-hp-reasons" role="radiogroup" aria-label="${ru?'Причина снижения HP':'Why HP goes down'}"><small>${ru?'Кнопки «−» это':'The «−» buttons mean'}</small>${reason('damage',ru?'Новый урон':'New damage')}${reason('correction',ru?'Исправление':'Correction')}</div>`;
}
// The DV chosen for the next check is used once: the roll takes it and it is cleared.
function takeDV(){const value=dv;if(dv){dv=0;setTimeout(()=>refreshHud(),0)}return value}
// Play mode: STATs and Skill levels cannot be changed by a stray tap.
function applyLock(){
 const doc=global.document,layout=doc.querySelector('.sheet-layout');if(!layout)return;
 layout.classList.toggle('sheet-locked',locked);
 for(const el of layout.querySelectorAll('input[data-stat],input[data-skill]'))el.readOnly=locked;
 for(const b of doc.querySelectorAll('[data-sheet-lock]')){b.setAttribute('aria-pressed',String(locked));b.classList.toggle('active',locked)}
}
// Autofire lives in the combat tools; open it with this character's numbers filled in.
function openAutofire(type){
 const c=global.App?.active?.()||lastCharacter,A=global.App;if(!A?.setView?.('combat'))return;
 setTimeout(()=>{
  const doc=global.document,weapon=doc.querySelector('[data-af-weapon]'),box=weapon?.closest('details,section,.card')||weapon;
  const put=(sel,value)=>{const el=doc.querySelector(sel);if(el&&Number.isFinite(value)){el.value=String(value);fire(el,'input');fire(el,'change')}};
  if(weapon&&[...weapon.options].some(o=>o.value===type)){weapon.value=type;fire(weapon,'change')}
  if(c){put('[data-af-ref]',num(c.stats?.REF));put('[data-af-skill]',num(c.skills?.Autofire));if(typeof A.checkBonus==='function')put('[data-af-attack]',A.checkBonus(c,'REF',c.skills?.Autofire))}
  for(const d of [weapon,doc.querySelector('[data-af-ref]')])d?.closest?.('details')?.setAttribute('open','');
  box?.scrollIntoView?.({block:'start'});
 },80);
}
function fire(el,type){const E=global.Event;if(el&&typeof E==='function')el.dispatchEvent(new E(type,{bubbles:true}))}
function setHp(next,reason){
 const root=global.document.querySelector('.sheet-layout [data-sheet-hp-root]'),input=root?.querySelector('[data-field="hp"]'),select=root?.querySelector('[data-sheet-hp-reason]');
 if(!input||!lastCharacter)return;
 const now=num(lastCharacter.hp);next=Math.max(-999,Math.min(1000,Math.trunc(next)));if(next===now)return;
 if(next<now&&select)select.value=reason||hpReason;
 input.value=String(next);fire(input,'input');fire(input,'change');
}
function setNext(kind,delta){
 const doc=global.document,c=global.App?.active?.()||lastCharacter;if(!c)return;
 if(kind==='hold'){const x=global.CharacterExtra?.init?.(c);if(!x)return;if(x.modifierHold===true)delete x.modifierHold;else x.modifierHold=true;global.App?.save?.();refreshHud(c);return}
 const input=doc.querySelector(`.sheet-layout [data-cx-field="${kind==='luckUse'?'luckUse':'modifier'}"]`);if(!input)return;
 const n=pending(c),next=kind==='luckUse'?Math.max(0,Math.min(n.luck,n.use+delta)):Math.max(-100,Math.min(100,n.mod+delta));
 input.value=String(next);fire(input,'input');
}
function refreshHud(c){
 lastCharacter=c||lastCharacter;
 const dock=global.document.querySelector('.sheet-dock');if(!dock||!lastCharacter)return;
 const doc=global.document,lockFocus=doc.activeElement?.hasAttribute?.('data-sheet-lock'),keep=doc.activeElement?.dataset?.keep,hpFocus=doc.activeElement?.hasAttribute?.('data-hud-hp'),awakeFocus=doc.activeElement?.hasAttribute?.('data-keep-awake')&&dock.contains(doc.activeElement);
 const old=dock.querySelector('.sheet-hud-wrap');if(old)old.innerHTML=hud(lastCharacter);
 const more=doc.querySelector('.sheet-extras');if(more)more.innerHTML=extras(lastCharacter);
 if(keep)more?.querySelector(`[data-keep="${String(keep).replace(/[^\w-]/g,'')}"]`)?.focus?.({preventScroll:true});
 if(hpFocus)dock.querySelector('[data-hud-hp]')?.focus?.({preventScroll:true});
 if(awakeFocus)dock.querySelector('[data-keep-awake]')?.focus?.({preventScroll:true});
 if(doc.activeElement===doc.body&&lockFocus)dock.querySelector('[data-sheet-lock]')?.focus?.({preventScroll:true});
 applyLock();
 const panel=dock.querySelector('.hud-hp-panel');
 if(panel){panel.hidden=!hpOpen;const v=vitals(lastCharacter),now=panel.querySelector('[data-hp-now]');if(now)now.innerHTML=`<b>${v.hp}</b><small>/ ${v.max}</small>`;for(const b of panel.querySelectorAll('[data-hp-reason]'))b.setAttribute('aria-checked',String(b.dataset.hpReason===hpReason))}
}
function apply(c){
 const doc=global.document,layout=doc.querySelector('.sheet-layout');
 if(!layout)return;
 if(c)lastCharacter=c;
 if(current==='netrun'&&!(global.NetrunTab?.interfaceRank?.(lastCharacter)>0))current='main';
 const tab=shown();
 layout.dataset.activeTab=tab;
 let dock=doc.querySelector('.sheet-dock'),tabs=dock?.querySelector('.sheet-tabs');
 let more=doc.querySelector('.sheet-extras');
 const wantNet=global.NetrunTab?.interfaceRank?.(lastCharacter)>0,hasNet=!!dock?.querySelector('[data-sheet-tab="netrun"]');
 // The chips of the «Досье» look may stand between the two.
 const mid=dock?.nextElementSibling,afterDock=mid?.classList?.contains?.('dossier-filter')?mid.nextElementSibling:mid;
 if(!dock||!more||more.nextElementSibling!==layout||afterDock!==more||wantNet!==hasNet||(dock.dataset.board==='1')!==board()){
  dock?.remove();more?.remove();doc.querySelector('.dossier-filter')?.remove();
  layout.insertAdjacentHTML('beforebegin',`<div class="sheet-dock" data-active-tab="${tab}" data-board="${board()?1:0}"><div class="sheet-hud-wrap">${hud(lastCharacter)}</div><div class="hud-hp-panel" id="hud-hp-panel"${hpOpen?'':' hidden'}>${hpPanel(lastCharacter)}</div>${bar()}</div><div class="sheet-extras" data-active-tab="${tab}">${extras(lastCharacter)}</div>`);
 }else{
  dock.dataset.activeTab=tab;more.dataset.activeTab=tab;
  refreshHud();
  for(const b of tabs.querySelectorAll('[data-sheet-tab]')){const on=b.dataset.sheetTab===tab;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on))}
 }
 applyLock();
 doc.querySelector('.app-shell')?.classList.add('sheet-tabs-on');
}
function select(id,{scroll=true}={}){
 if(!IDS.has(id))return;
 current=id;
 try{global.localStorage?.setItem(KEY,id)}catch{}
 apply();
 if(scroll){const tabs=global.document.querySelector('.sheet-tabs');if(tabs&&tabs.getBoundingClientRect().top<0)tabs.scrollIntoView({block:'start'})}
}
global.document.addEventListener('click',e=>{
 const tab=e.target.closest?.('.sheet-tabs [data-sheet-tab]');
 if(tab){select(tab.dataset.sheetTab);return}
 const proxy=e.target.closest?.('[data-proxy-roll]');
 // Re-use the sheet's own roll buttons so every rule, modifier and check stays in one place.
 if(proxy){const target=global.document.querySelector('.sheet-layout '+proxy.dataset.proxyRoll);if(target&&!target.disabled)target.click();return}
 const hp=e.target.closest?.('[data-hud-hp],[data-hp-step],[data-hp-take],[data-hp-reason]');
 if(hp){
  const now=num(lastCharacter?.hp),max=vitals(lastCharacter).max;
  if(hp.hasAttribute('data-hud-hp')){hpOpen=!hpOpen;refreshHud()}
  else if(hp.dataset.hpReason){hpReason=hp.dataset.hpReason==='correction'?'correction':'damage';refreshHud()}
  else if(hp.dataset.hpStep){const d=Math.trunc(num(hp.dataset.hpStep));setHp(d>0?Math.max(now,Math.min(max,now+d)):now+d)}
  else{const field=hp.closest('.hud-hp-panel')?.querySelector('[data-hp-amount]'),amount=Math.trunc(num(field?.value));if(amount>0){setHp(now-amount,'damage');field.value=''}else field?.focus?.()}
  return;
 }
 if(e.target.closest?.('[data-sheet-lock]')){locked=!locked;try{global.localStorage?.setItem(LOCK_KEY,locked?'1':'0')}catch{}refreshHud();return}
 const auto=e.target.closest?.('[data-sheet-autofire]');if(auto){openAutofire(auto.dataset.sheetAutofire);return}
 if(e.target.closest?.('[data-sheet-shop]')){global.App?.shopFor?.(lastCharacter?.id);return}
 if(e.target.closest?.('[data-sheet-lifepath]')){global.App?.lifepathFor?.(global.App?.active?.()?.id||lastCharacter?.id);return}
 const next=e.target.closest?.('[data-next-roll]');
 if(next){setNext(next.dataset.nextRoll,Math.trunc(num(next.dataset.delta)));return}
 // With the roll buttons in view, the LUCK and modifier chips lead to the next-roll bar, not away to another tab.
 const toBar=e.target.closest?.('[data-hud-next]');
 if(toBar&&(shown()==='skills'||shown()==='combat'||boardWide())){global.document.querySelector('.sheet-next-roll')?.scrollIntoView?.({block:'center'});return}
 const hudJump=e.target.closest?.('[data-hud-jump]');
 if(hudJump){const id=hudJump.dataset.hudJump,tab=owner(id)||'main';if(tab!==shown())select(tab,{scroll:false});const target=global.document.getElementById(id);global.DossierPanel?.reveal?.(target);target?.scrollIntoView({block:'start'});return}
 // A jump-nav link in "full sheet" mode, or any in-app link to a hidden section, reveals its tab first.
 const jump=e.target.closest?.('[data-sheet-jump]');
 if(jump&&shown()!=='all'){const tab=owner(jump.dataset.sheetJump);if(tab&&tab!==shown())select(tab,{scroll:false})}
},true);
global.document.addEventListener('keydown',e=>{
 const tab=e.target.closest?.('.sheet-tabs [data-sheet-tab]');if(!tab||!['ArrowLeft','ArrowRight'].includes(e.key))return;
 // A tab a look hides (the «Навыки» tab on the wide board) is skipped, so the arrows never land on nothing.
 const list=[...tab.parentElement.querySelectorAll('[data-sheet-tab]')].filter(b=>b===tab||typeof b.getClientRects!=='function'||b.getClientRects().length>0),i=list.indexOf(tab),next=list[(i+(e.key==='ArrowRight'?1:-1)+list.length)%list.length];
 e.preventDefault();select(next.dataset.sheetTab,{scroll:false});global.document.querySelector(`.sheet-tabs [data-sheet-tab="${next.dataset.sheetTab}"]`)?.focus();
});
// HP, Luck and Humanity change through many sheet tools; refresh the small HUD after any edit.
let hudTimer=0;const later=()=>{clearTimeout(hudTimer);hudTimer=setTimeout(()=>refreshHud(),0)};
global.document.addEventListener('change',e=>{const el=e.target;if(el?.hasAttribute?.('data-next-dv')){const value=Math.trunc(num(el.value));dv=DVS.some(x=>x[0]===value)?value:0}});
for(const type of ['input','change','click'])global.document.addEventListener(type,later);
try{global.matchMedia?.(WIDE)?.addEventListener?.('change',()=>apply())}catch{}
global.SheetTabs={takeDV,apply,select,refreshHud,current:()=>current,shown,tabs:TABS.map(t=>t[0]),boardTabs:BOARD_TABS.map(t=>t[0]),owner};
})(window);
