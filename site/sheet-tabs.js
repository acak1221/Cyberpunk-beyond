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
// Which tab owns each jump-nav target, so links into the sheet still land somewhere visible.
const OWNER={'sheet-identity':'main','sheet-stats':'main','sheet-resources':'main','sheet-vitals':'main','sheet-skills':'skills','sheet-specializations':'skills','sheet-weapons':'combat','sheet-damage':'combat','reload-tools-mount':'combat','sheet-equipment':'gear','sheet-items':'gear','sheet-role':'role','sheet-role-ability':'role','sheet-ip':'life','sheet-lifepath':'life','sheet-notes':'life','sheet-agent':'life','sheet-netrun':'netrun'};
let current='main',lastCharacter=null,hpOpen=false,hpReason='damage';
const STATS=['INT','REF','DEX','TECH','COOL','WILL','LUCK','MOVE','BODY','EMP'];
try{const saved=global.localStorage?.getItem(KEY);if(IDS.has(saved))current=saved}catch{}

function lang(){return global.document.documentElement.lang==='en'?'en':'ru'}
function bar(){
 const ru=lang()==='ru';
 const net=global.NetrunTab?.interfaceRank?.(lastCharacter)>0;
 return `<div class="sheet-tabs" role="tablist" aria-label="${ru?'Разделы листа':'Sheet sections'}">${TABS.filter(([id])=>id!=='netrun'||net).map(([id,r,e,icon])=>`<button type="button" role="tab" data-sheet-tab="${id}" aria-selected="${id===current}" class="${id===current?'active':''}"><span aria-hidden="true">${icon}</span>${ru?r:e}</button>`).join('')}</div>`;
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
 return `<div class="sheet-hud" data-wound="${v.wound}">${global.Portrait?.html(c,'hud-avatar',{small:true})||''}<button type="button" class="hud-chip hud-hp" data-hud-hp aria-expanded="${hpOpen}" aria-controls="hud-hp-panel" title="${html(w)}"><span aria-hidden="true">♥</span><b>${v.hp}</b><small>/ ${v.max}</small><em>${html(w)}</em></button><button type="button" class="hud-chip" data-hud-jump="sheet-vitals"><span aria-hidden="true">◈</span><small>HUM</small><b>${v.humanity}</b><small>EMP ${v.emp}</small></button><button type="button" class="hud-chip${n.use?' hud-pending':''}" data-hud-next data-hud-jump="sheet-resources"><span aria-hidden="true">✳</span><small>LUCK</small><b>${v.luck}</b><small>/ ${v.luckMax}</small>${n.use?`<i class="hud-plus">+${n.use}</i>`:''}</button>${n.mod?`<button type="button" class="hud-chip hud-pending" data-hud-next data-hud-jump="sheet-resources"><small>${ru?'Модификатор':'Modifier'}</small><b>${sign(n.mod)}</b></button>`:''}</div>`;
}
function extras(c){
 if(!c)return '';
 const ru=lang()==='ru';
 return `${nextRoll(c)}${quickRolls(c)}<div class="sheet-stat-strip" aria-label="${ru?'Характеристики':'Statistics'}">${STATS.map(k=>`<div><small>${k}</small><b>${html(c?.stats?.[k]??'—')}</b></div>`).join('')}</div>`;
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
 return `<div class="sheet-next-roll" role="group" aria-label="${ru?'Следующий бросок':'Next roll'}"><div class="nr-step${n.mod?' on':''}"><small>${mod}</small>${step('modifier',-1,mod,n.mod<=-100)}<b>${n.mod?sign(n.mod):'0'}</b>${step('modifier',1,mod,n.mod>=100)}<button type="button" class="nr-hold" data-next-roll="hold" data-keep="hold" aria-pressed="${n.hold}" title="${ru?'Не сбрасывать модификатор после броска':'Keep the modifier after a roll'}">${ru?'Закрепить':'Keep'}</button></div><div class="nr-step${n.use?' on':''}"><small>LUCK</small>${step('luckUse',-1,'LUCK',n.use<=0)}<b>${n.use?'+'+n.use:'0'}</b>${step('luckUse',1,'LUCK',n.use>=n.luck)}<small>${ru?'из':'of'} ${n.luck}</small></div></div>`;
}
function quickRolls(c){
 const ru=lang()==='ru',st=c?.stats||{},sk=c?.skills||{},A=global.App;
 const bonus=(stat,level)=>typeof A?.checkBonus==='function'?A.checkBonus(c,stat,level):num(st[stat])+num(level);
 const death=Math.max(0,num(st.BODY)-Math.max(0,num(c?.extra?.deathPenalty)));
 const rolls=[
  ['[data-action="initiative-roll"]',ru?'Инициатива':'Initiative',sign(typeof A?.initiativeBonus==='function'?A.initiativeBonus(c):num(st.REF)),'1d10 + REF'],
  ['[data-action="skill-roll"][data-skill="Evasion"]',ru?'Уклонение':'Evasion',sign(bonus('DEX',sk.Evasion)),'1d10 + DEX + '+(ru?'Уклонение':'Evasion')],
  ['[data-action="skill-roll"][data-skill="Brawling"]',ru?'Рукопашный бой':'Brawling',sign(bonus('DEX',sk.Brawling)),'1d10 + DEX + '+(ru?'Рукопашный бой':'Brawling')],
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
 const doc=global.document,keep=doc.activeElement?.dataset?.keep,hpFocus=doc.activeElement?.hasAttribute?.('data-hud-hp');
 const old=dock.querySelector('.sheet-hud-wrap');if(old)old.innerHTML=hud(lastCharacter);
 const more=doc.querySelector('.sheet-extras');if(more)more.innerHTML=extras(lastCharacter);
 if(keep)more?.querySelector(`[data-keep="${String(keep).replace(/[^\w-]/g,'')}"]`)?.focus?.({preventScroll:true});
 if(hpFocus)dock.querySelector('[data-hud-hp]')?.focus?.({preventScroll:true});
 const panel=dock.querySelector('.hud-hp-panel');
 if(panel){panel.hidden=!hpOpen;const v=vitals(lastCharacter),now=panel.querySelector('[data-hp-now]');if(now)now.innerHTML=`<b>${v.hp}</b><small>/ ${v.max}</small>`;for(const b of panel.querySelectorAll('[data-hp-reason]'))b.setAttribute('aria-checked',String(b.dataset.hpReason===hpReason))}
}
function apply(c){
 const doc=global.document,layout=doc.querySelector('.sheet-layout');
 if(!layout)return;
 if(c)lastCharacter=c;
 if(current==='netrun'&&!(global.NetrunTab?.interfaceRank?.(lastCharacter)>0))current='main';
 layout.dataset.activeTab=current;
 let dock=doc.querySelector('.sheet-dock'),tabs=dock?.querySelector('.sheet-tabs');
 let more=doc.querySelector('.sheet-extras');
 const wantNet=global.NetrunTab?.interfaceRank?.(lastCharacter)>0,hasNet=!!dock?.querySelector('[data-sheet-tab="netrun"]');
 if(!dock||!more||more.nextElementSibling!==layout||dock.nextElementSibling!==more||wantNet!==hasNet){
  dock?.remove();more?.remove();
  layout.insertAdjacentHTML('beforebegin',`<div class="sheet-dock" data-active-tab="${current}"><div class="sheet-hud-wrap">${hud(lastCharacter)}</div><div class="hud-hp-panel" id="hud-hp-panel"${hpOpen?'':' hidden'}>${hpPanel(lastCharacter)}</div>${bar()}</div><div class="sheet-extras" data-active-tab="${current}">${extras(lastCharacter)}</div>`);
 }else{
  dock.dataset.activeTab=current;more.dataset.activeTab=current;
  refreshHud();
  for(const b of tabs.querySelectorAll('[data-sheet-tab]')){const on=b.dataset.sheetTab===current;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on))}
 }
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
 const next=e.target.closest?.('[data-next-roll]');
 if(next){setNext(next.dataset.nextRoll,Math.trunc(num(next.dataset.delta)));return}
 // With the roll buttons in view, the LUCK and modifier chips lead to the next-roll bar, not away to another tab.
 const toBar=e.target.closest?.('[data-hud-next]');
 if(toBar&&(current==='skills'||current==='combat')){global.document.querySelector('.sheet-next-roll')?.scrollIntoView?.({block:'center'});return}
 const hudJump=e.target.closest?.('[data-hud-jump]');
 if(hudJump){const id=hudJump.dataset.hudJump;select(OWNER[id]||'main',{scroll:false});global.document.getElementById(id)?.scrollIntoView({block:'start'});return}
 // A jump-nav link in "full sheet" mode, or any in-app link to a hidden section, reveals its tab first.
 const jump=e.target.closest?.('[data-sheet-jump]');
 if(jump&&current!=='all'){const owner=OWNER[jump.dataset.sheetJump];if(owner&&owner!==current)select(owner,{scroll:false})}
},true);
global.document.addEventListener('keydown',e=>{
 const tab=e.target.closest?.('.sheet-tabs [data-sheet-tab]');if(!tab||!['ArrowLeft','ArrowRight'].includes(e.key))return;
 const list=[...tab.parentElement.querySelectorAll('[data-sheet-tab]')],i=list.indexOf(tab),next=list[(i+(e.key==='ArrowRight'?1:-1)+list.length)%list.length];
 e.preventDefault();select(next.dataset.sheetTab,{scroll:false});global.document.querySelector(`.sheet-tabs [data-sheet-tab="${next.dataset.sheetTab}"]`)?.focus();
});
// HP, Luck and Humanity change through many sheet tools; refresh the small HUD after any edit.
let hudTimer=0;const later=()=>{clearTimeout(hudTimer);hudTimer=setTimeout(()=>refreshHud(),0)};
for(const type of ['input','change','click'])global.document.addEventListener(type,later);
global.SheetTabs={apply,select,refreshHud,current:()=>current,tabs:TABS.map(t=>t[0])};
})(window);
