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
 ['all','Весь лист','Full sheet','☰'],
];
const IDS=new Set(TABS.map(t=>t[0]));
// Which tab owns each jump-nav target, so links into the sheet still land somewhere visible.
const OWNER={'sheet-identity':'main','sheet-stats':'main','sheet-resources':'main','sheet-vitals':'main','sheet-skills':'skills','sheet-specializations':'skills','sheet-weapons':'combat','sheet-damage':'combat','reload-tools-mount':'combat','sheet-equipment':'gear','sheet-items':'gear','sheet-role':'role','sheet-role-ability':'role','sheet-ip':'life','sheet-lifepath':'life','sheet-notes':'life'};
let current='main',lastCharacter=null;
const STATS=['INT','REF','DEX','TECH','COOL','WILL','LUCK','MOVE','BODY','EMP'];
try{const saved=global.localStorage?.getItem(KEY);if(IDS.has(saved))current=saved}catch{}

function lang(){return global.document.documentElement.lang==='en'?'en':'ru'}
function bar(){
 const ru=lang()==='ru';
 return `<div class="sheet-tabs" role="tablist" aria-label="${ru?'Разделы листа':'Sheet sections'}">${TABS.map(([id,r,e,icon])=>`<button type="button" role="tab" data-sheet-tab="${id}" aria-selected="${id===current}" class="${id===current?'active':''}"><span aria-hidden="true">${icon}</span>${ru?r:e}</button>`).join('')}</div>`;
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
 const ru=lang()==='ru',v=vitals(c),w={full:ru?'Без ранений':'Unhurt',light:ru?'Лёгкое ранение':'Lightly wounded',serious:ru?'Тяжёлое ранение · −2':'Seriously wounded · −2',mortal:ru?'Смертельное ранение · −4':'Mortally wounded · −4'}[v.wound];
 return `<div class="sheet-hud" data-wound="${v.wound}"><button type="button" class="hud-chip hud-hp" data-hud-jump="sheet-vitals" title="${html(w)}"><span aria-hidden="true">♥</span><b>${v.hp}</b><small>/ ${v.max}</small><em>${html(w)}</em></button><button type="button" class="hud-chip" data-hud-jump="sheet-vitals"><span aria-hidden="true">◈</span><small>HUM</small><b>${v.humanity}</b><small>EMP ${v.emp}</small></button><button type="button" class="hud-chip" data-hud-jump="sheet-resources"><span aria-hidden="true">✳</span><small>LUCK</small><b>${v.luck}</b><small>/ ${v.luckMax}</small></button></div>`;
}
function extras(c){
 if(!c)return '';
 const ru=lang()==='ru';
 return `${quickRolls(c)}<div class="sheet-stat-strip" aria-label="${ru?'Характеристики':'Statistics'}">${STATS.map(k=>`<div><small>${k}</small><b>${html(c?.stats?.[k]??'—')}</b></div>`).join('')}</div>`;
}
function quickRolls(c){
 const ru=lang()==='ru',st=c?.stats||{},sk=c?.skills||{},sign=n=>(n<0?'−':'+')+Math.abs(n);
 const rolls=[
  ['[data-action="initiative-roll"]',ru?'Инициатива':'Initiative',sign(num(st.REF)),'1d10 + REF'],
  ['[data-action="skill-roll"][data-skill="Evasion"]',ru?'Уклонение':'Evasion',sign(num(st.DEX)+num(sk.Evasion)),'1d10 + DEX + '+(ru?'Уклонение':'Evasion')],
  ['[data-action="skill-roll"][data-skill="Brawling"]',ru?'Рукопашный бой':'Brawling',sign(num(st.DEX)+num(sk.Brawling)),'1d10 + DEX + '+(ru?'Рукопашный бой':'Brawling')],
  ['[data-cx-action="death-save"]',ru?'Спасбросок от смерти':'Death Save','≤ '+num(st.BODY),ru?'1d10 не выше BODY (с учётом штрафа)':'1d10 at or under BODY (minus penalty)'],
 ];
 return `<div class="sheet-quick-rolls">${rolls.map(([target,label,total,hint])=>`<button type="button" data-proxy-roll="${html(target)}" title="${html(hint)}"><span>${html(label)}</span><b>${html(total)}</b></button>`).join('')}</div>`;
}
function refreshHud(c){
 lastCharacter=c||lastCharacter;
 const dock=global.document.querySelector('.sheet-dock');if(!dock||!lastCharacter)return;
 const old=dock.querySelector('.sheet-hud-wrap');if(old)old.innerHTML=hud(lastCharacter);
 const more=global.document.querySelector('.sheet-extras');if(more)more.innerHTML=extras(lastCharacter);
}
function apply(c){
 const doc=global.document,layout=doc.querySelector('.sheet-layout');
 if(!layout)return;
 if(c)lastCharacter=c;
 layout.dataset.activeTab=current;
 let dock=doc.querySelector('.sheet-dock'),tabs=dock?.querySelector('.sheet-tabs');
 let more=doc.querySelector('.sheet-extras');
 if(!dock||!more||more.nextElementSibling!==layout||dock.nextElementSibling!==more){
  dock?.remove();more?.remove();
  layout.insertAdjacentHTML('beforebegin',`<div class="sheet-dock" data-active-tab="${current}"><div class="sheet-hud-wrap">${hud(lastCharacter)}</div>${bar()}</div><div class="sheet-extras" data-active-tab="${current}">${extras(lastCharacter)}</div>`);
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
