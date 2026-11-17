/* The GM screen as a hub. Everything the GM page used to stack in one long scroll (encounters, NPCs, clocks, tables,
   the Night Market, the world cards) is now behind one sticky tab bar: Encounter, NPCs, Clocks, Tables, Market,
   World, Help. The pieces still come from their own modules (gm-tools.js, night-market.js, gm-extras.js, night-city.js);
   this file only composes them, marks which tab each piece belongs to (data-gm-pane) and shows one tab at a time with CSS,
   so the pieces keep redrawing themselves exactly as before and nothing is lost when the tab changes.

   - Deep links: #/gm/clocks opens the Clocks tab (tabFromHash). The last tab is remembered in this browser (nc-gm-tab).
   - «Find a tool»: a small search over the tools of every tab (findTools, a pure function); a result opens its tab and
     moves focus to the tool.
   - The rolls switch (open / hidden) and the list of hidden rolls come from gm-rolls.js; the NPC filter row from npc-filter.js.
   Original UI text. */
(function(global){
'use strict';
const TABS=Object.freeze(['meeting','npc','clocks','tables','market','world','help']);
const ALIASES={encounter:'meeting',encounters:'meeting',npcs:'npc',clock:'clocks',table:'tables',rolltables:'tables',night:'market',nightmarket:'market',city:'world',factions:'world',rumors:'world',weather:'world'};
const STORE_KEY='nc-gm-tab';
const NAMES={
 ru:{meeting:'Встреча',npc:'НИП',clocks:'Часы',tables:'Таблицы',market:'Рынок',world:'Мир',help:'Справка'},
 en:{meeting:'Encounter',npc:'NPCs',clocks:'Clocks',tables:'Tables',market:'Market',world:'World',help:'Help'}
};
const T={
 ru:{title:'ИНСТРУМЕНТЫ ВЕДУЩЕГО',intro:'Всё для стола ведущего по вкладкам: встречи, противники, часы, таблицы, рынок и мир.',tabs:'Разделы экрана ведущего',find:'Найти инструмент',findPh:'Например: погода, часы, фракции',results:'Найденные инструменты',none:'Ничего не найдено',found:n=>`Найдено: ${n}`,
  helpHead:'Как пользоваться',h1:'Вкладки и ссылки',h1t:'Инструменты разложены по вкладкам. Последняя открытая вкладка запоминается в этом браузере, а у каждой есть своя ссылка: её можно сохранить в закладки.',
  h2:'Броски ведущего',h2t:'Переключатель в верхней части экрана решает, увидят ли игроки бросок. Открытый бросок попадает в историю бросков и в ленту комнаты. Скрытый остаётся только у вас: его можно найти в списке «Скрытые броски» и при желании показать игрокам.',
  h3:'Уровни противников',h3t:'У карточки противника и у выбора «Добавить в бой» есть уровень угрозы. Это собственная настройка приложения, а не правило книги: за ступень характеристики REF, BODY и WILL меняются на 1, HP на 5, навыки на 2, броня на одну ступень.',
  h4:'Поиск противников',h4t:'Строка над списками противников ищет по имени и роли, а кнопки уровня и выбор источника сужают список. Фильтр не меняет сохранённые данные.',
  h5:'Где хранятся данные',h5t:'Часы, таблицы и библиотека противников хранятся в этом браузере и входят в резервную копию. Скрытые броски лежат только здесь: в копию и в комнату они не попадают.',linkWord:'Ссылка'},
 en:{title:'GM TOOLS',intro:'Everything for the GM’s table in tabs: encounters, opponents, clocks, tables, the market and the world.',tabs:'GM screen sections',find:'Find a tool',findPh:'For example: weather, clocks, factions',results:'Tools found',none:'Nothing found',found:n=>`Found: ${n}`,
  helpHead:'How to use it',h1:'Tabs and links',h1t:'The tools are grouped in tabs. The tab you opened last is remembered in this browser, and every tab has its own link you can bookmark.',
  h2:'GM rolls',h2t:'The switch at the top of the screen decides whether players see a roll. An open roll goes to the roll history and the room feed. A hidden roll stays with you only: find it in the «Hidden rolls» list and show it to the players later if you want.',
  h3:'Opponent levels',h3t:'An opponent card and the «Add to combat» form have a threat level. It is the app’s own setting, not a book rule: per step REF, BODY and WILL change by 1, HP by 5, skills by 2 and armor by one rung.',
  h4:'Finding opponents',h4t:'The box above the opponent lists searches by name and role; the level buttons and the source choice narrow the list. The filter never changes saved data.',
  h5:'Where the data lives',h5t:'Clocks, tables and the opponent library are kept in this browser and are part of the backup. Hidden rolls stay here only: they are not in the backup or in the room.',linkWord:'Link'}
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lg=l=>l==='en'?'en':'ru';
// ---------- pure parts ----------
function normTab(v){const k=String(v??'').toLowerCase().replace(/[^a-z-]/g,'');const a=ALIASES[k.replace(/-/g,'')]||k;return TABS.includes(a)?a:null}
function tabFromHash(hash){const m=/^#\/gm\/([A-Za-z-]{1,24})(?:[/?].*)?$/.exec(String(hash??''));return m?normTab(m[1]):null}
const hashFor=tab=>TABS.includes(tab)?'#/gm/'+tab:'#/gm';
function pickTab(hash,stored){return tabFromHash(hash)||(TABS.includes(stored)?stored:'meeting')}
// The searchable tools: id, the tab they live in, a selector of the tool on the page, names in both languages, extra words.
const TOOLS=Object.freeze([
 {id:'encounter',tab:'meeting',sel:'[data-gm-pane="meeting"] section.card',ru:'Случайная встреча 1d100',en:'Random encounter 1d100',kw:'бросок d100 улица патруль random encounter roll'},
 {id:'facedown',tab:'meeting',sel:'[data-face-root]',ru:'Противостояние и известность',en:'Face down and reputation',kw:'face down репутация рэп cool'},
 {id:'templates',tab:'npc',sel:'[data-gm-tpl]',ru:'Шаблоны противников из книги',en:'Book opponent templates',kw:'npc нип телохранитель банда мук mook lieutenant босс уровень level'},
 {id:'roster',tab:'npc',sel:'[data-gm-pane="npc"] [data-gm-npc="name"]',ru:'Мой список NPC',en:'My NPC list',kw:'ростер список roster hp броня'},
 {id:'builder',tab:'npc',sel:'[data-nb-root]',ru:'NPC по шагам',en:'NPC step by step',kw:'конструктор builder создать'},
 {id:'library',tab:'npc',sel:'[data-nl-root]',ru:'Библиотека NPC',en:'NPC library',kw:'заготовки свои противники presets library'},
 {id:'clocks',tab:'clocks',sel:'[data-gx-section="clocks"]',ru:'Часы прогресса',en:'Progress clocks',kw:'таймер угроза clock pool пул'},
 {id:'random',tab:'tables',sel:'[data-gx-section="tables"]',ru:'Случайные таблицы: имена, заказы, добыча, оракул',en:'Random tables: names, gigs, loot, oracle',kw:'имена гиг заказ loot oracle да нет name handle заголовок вендит бодега'},
 {id:'mytables',tab:'tables',sel:'[data-rtb-root]',ru:'Свои таблицы бросков',en:'Your roll tables',kw:'мои таблицы custom roll tables импорт'},
 {id:'market',tab:'market',sel:'[data-nm-root]',ru:'Ночной рынок',en:'Night Market',kw:'торговцы товары stalls лавки market'},
 {id:'weather',tab:'world',sel:'[data-gx-section="weather"]',ru:'Погода в Найт-Сити',en:'Night City weather',kw:'сезон дождь weather season'},
 {id:'city',tab:'world',sel:'[data-nc-root]',ru:'Справочник Найт-Сити',en:'Night City reference',kw:'корпорации банды места люди новости цены night city gangs corporations places'},
 {id:'factions',tab:'world',sel:'[data-fc-root]',ru:'Фракции кампании',en:'Campaign factions',kw:'банды корпорации отношение attitude'},
 {id:'rumors',tab:'world',sel:'[data-ru-root]',ru:'Слухи',en:'Rumors',kw:'новости news правда'},
 {id:'hidden',tab:'meeting',sel:'[data-gmr-mode-root]',ru:'Скрытые броски',en:'Hidden rolls',kw:'история скрытый открытый hidden open history secret'},
 {id:'help',tab:'help',sel:'[data-gmh-help]',ru:'Справка по экрану ведущего',en:'GM screen help',kw:'помощь как пользоваться help guide'}
]);
const fold=v=>String(v??'').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();
function findTools(query,lang,limit=6){
 const q=fold(query).slice(0,60);if(!q)return [];
 const words=q.split(' '),l=lg(lang),out=[];
 for(const tool of TOOLS){
  const name=fold(tool[l]),hay=fold(`${tool.ru} ${tool.en} ${tool.kw} ${NAMES.ru[tool.tab]} ${NAMES.en[tool.tab]}`);
  if(!words.every(w=>hay.includes(w)))continue;
  out.push({tool,score:name.startsWith(q)?0:name.includes(q)?1:2});
 }
 out.sort((a,b)=>a.score-b.score);
 return out.slice(0,Math.max(1,limit)).map(x=>x.tool);
}
// ---------- state ----------
let cur=null;
const storage=()=>{try{return global.localStorage||null}catch{return null}};
function readStored(){const s=storage();if(!s)return null;try{return s.getItem(STORE_KEY)}catch{return null}}
function writeStored(tab){const s=storage();if(!s)return;try{s.setItem(STORE_KEY,tab)}catch{}}
const hashNow=()=>{try{return global.location?.hash||''}catch{return ''}};
function currentTab(){if(!cur||!TABS.includes(cur))cur=pickTab(hashNow(),readStored());return cur}
// ---------- drawing ----------
function tabBar(l,tab){
 const t=T[l];
 return `<div class="gmh-bar"><div class="gmh-tabs" role="tablist" aria-label="${esc(t.tabs)}">${TABS.map(k=>`<button type="button" class="gmh-tab" role="tab" id="gmh-tab-${k}" data-gmh-tab="${k}" aria-selected="${k===tab}" aria-controls="gmh-panel" tabindex="${k===tab?0:-1}">${esc(NAMES[l][k])}</button>`).join('')}</div></div>`;
}
function finder(l){
 const t=T[l];
 return `<details class="gmh-find" data-gmh-find-root><summary>${esc(t.find)}</summary><label class="field"><span class="sr-only">${esc(t.find)}</span><input type="search" data-gmh-find maxlength="60" placeholder="${esc(t.findPh)}" autocomplete="off" aria-controls="gmh-results"></label><ul class="gmh-results" id="gmh-results" data-gmh-results aria-label="${esc(t.results)}"></ul><p class="gmh-count" data-gmh-count role="status" aria-live="polite"></p></details>`;
}
function resultsHTML(list,l){return list.map(x=>`<li><button type="button" class="gmh-hit" data-gmh-go="${esc(x.id)}"><strong>${esc(x[l])}</strong><span>${esc(NAMES[l][x.tab])}</span></button></li>`).join('')}
function helpHTML(l){
 const t=T[l];
 const links=TABS.map(k=>`<li><code>${esc(hashFor(k))}</code> — ${esc(NAMES[l][k])}</li>`).join('');
 const item=(h,p,extra='')=>`<section class="card gmh-help-card"><div class="card-heading"><span>${esc(h)}</span></div><p>${esc(p)}</p>${extra}</section>`;
 return `<div data-gm-pane="help" data-gmh-help tabindex="-1"><div class="card-heading gmh-help-head"><span>${esc(t.helpHead)}</span></div>${item(t.h1,t.h1t,`<ul class="gmh-links">${links}</ul>`)}${item(t.h2,t.h2t)}${item(t.h3,t.h3t)}${item(t.h4,t.h4t)}${item(t.h5,t.h5t)}</div>`;
}
function render(ctx){
 const c=ctx&&typeof ctx==='object'?ctx:{},l=lg(c.lang),t=T[l],tab=currentTab();
 const tools=global.GMTools?.render?.({...c,lang:l,panes:true})||'',market=global.NightMarket?.render?.(l)||'',extras=global.GMExtras?.render?.(l)||'',city=global.NightCity?.render?.(l)||'';
 const filter=global.NpcFilter?.rowHTML?.(l)||'';
 if(typeof setTimeout==='function')setTimeout(afterDraw,0);
 return `<div class="gm-hub" data-gm-hub data-tab="${tab}" data-lang="${l}"><div class="page-header"><div><div class="overline">REFEREE / COREBOOK 412–424</div><h1>${esc(t.title)}</h1><p>${esc(t.intro)}</p></div></div>${tabBar(l,tab)}<div class="gmh-meta">${global.GmRolls?.toggleHTML?.(l)||''}${finder(l)}${global.GmRolls?.historyHTML?.(l)||''}</div><div class="gmh-body" id="gmh-panel" role="tabpanel" aria-labelledby="gmh-tab-${tab}" tabindex="-1"><h2 class="sr-only" data-gmh-h2>${esc(NAMES[l][tab])}</h2>${filter?`<div data-gm-pane="npc" class="gmh-filter">${filter}</div>`:''}${tools}<div data-gm-pane="market">${market}</div>${city?`<div data-gm-pane="world">${city}</div>`:''}${extras}${helpHTML(l)}</div></div>`;
}
// ---------- screen behaviour ----------
const root=()=>typeof document!=='undefined'?document.querySelector?.('[data-gm-hub]'):null;
function setTab(tab,opts={}){
 const k=normTab(tab);if(!k)return false;
 cur=k;if(opts.store!==false)writeStored(k);
 const r=root();
 if(r){
  r.dataset.tab=k;
  r.querySelectorAll('[data-gmh-tab]').forEach(b=>{const on=b.dataset.gmhTab===k;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1});
  r.querySelector('#gmh-panel')?.setAttribute('aria-labelledby','gmh-tab-'+k);
  const h2=r.querySelector('[data-gmh-h2]');if(h2)h2.textContent=NAMES[lg(r.dataset.lang)][k];
  const sel=r.querySelector(`[data-gmh-tab="${k}"]`);
  // A tab bar that scrolls sideways on a phone must show the chosen tab.
  try{sel?.scrollIntoView?.({inline:'center',block:'nearest',behavior:'auto'})}catch{}
  if(opts.top){try{r.querySelector('.gmh-bar')?.scrollIntoView?.({block:'start',behavior:'auto'})}catch{}}
  if(opts.focus)r.querySelector(`[data-gmh-tab="${k}"]`)?.focus?.();
 }
 if(opts.hash!==false&&/^#\/gm(\/|$)/.test(hashNow())){try{global.history?.replaceState?.(null,'',hashFor(k))}catch{}}
 return true;
}
function goTool(id){
 const tool=TOOLS.find(x=>x.id===id);if(!tool)return false;
 setTab(tool.tab);
 const r=root();let el=null;
 try{el=r?.querySelector(tool.sel)}catch{}
 if(el){
  if(!el.hasAttribute('tabindex'))el.setAttribute('tabindex','-1');
  try{el.scrollIntoView?.({block:'start',behavior:'auto'})}catch{}
  try{el.focus?.({preventScroll:true})}catch{}
 }else{r?.querySelector(`[data-gmh-tab="${tool.tab}"]`)?.focus?.()}
 return true;
}
function runFind(input){
 const r=input.closest('[data-gmh-find-root]'),list=r?.querySelector('[data-gmh-results]'),count=r?.querySelector('[data-gmh-count]');if(!list)return [];
 const l=lg(global.App?.lang?.()||r.closest('[data-lang]')?.dataset?.lang),t=T[l],hits=input.value.trim()?findTools(input.value,l):[];
 list.innerHTML=resultsHTML(hits,l);
 if(count)count.textContent=input.value.trim()?(hits.length?t.found(hits.length):t.none):'';
 return hits;
}
function onEvent(e){
 const el=e?.target;if(!el||typeof el.closest!=='function')return false;
 if(e.type==='input'&&el.matches?.('[data-gmh-find]')){runFind(el);return true}
 if(e.type==='keydown'){
  if(el.matches?.('[data-gmh-find]')&&e.key==='Enter'){const hits=runFind(el);if(hits[0]){e.preventDefault?.();goTool(hits[0].id);el.value='';runFind(el)}return true}
  const tab=el.closest('[data-gmh-tab]');
  if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
   const i=TABS.indexOf(tab.dataset.gmhTab),n=e.key==='Home'?0:e.key==='End'?TABS.length-1:(i+(e.key==='ArrowRight'?1:-1)+TABS.length)%TABS.length;
   e.preventDefault?.();setTab(TABS[n],{focus:true});return true;
  }
  return false;
 }
 if(e.type!=='click')return false;
 const tab=el.closest('[data-gmh-tab]');if(tab){setTab(tab.dataset.gmhTab,{top:true});return true}
 const go=el.closest('[data-gmh-go]');
 if(go){const box=go.closest('[data-gmh-find-root]'),input=box?.querySelector('[data-gmh-find]');goTool(go.dataset.gmhGo);if(input){input.value='';runFind(input)}return true}
 return false;
}
function onHash(){
 // #/city is the short link of the Night City reference: it lives in the World tab.
 if(/^#\/city\/?$/.test(hashNow())){try{global.location.replace('#/gm/world')}catch{}return}
 const k=tabFromHash(hashNow());if(k&&k!==cur&&root())setTab(k,{hash:false});
}
// After drawing: the router writes #/gm; put the tab back so the address bar and a copied link keep it.
function afterDraw(){
 const r=root();if(!r)return;
 if(/^#\/gm\/?$/.test(hashNow())){try{global.history?.replaceState?.(null,'',hashFor(currentTab()))}catch{}}
 try{r.querySelector(`[data-gmh-tab="${currentTab()}"]`)?.scrollIntoView?.({inline:'center',block:'nearest',behavior:'auto'})}catch{}
}
if(typeof document!=='undefined'&&document.addEventListener){for(const type of ['click','input','keydown'])document.addEventListener(type,onEvent)}
if(typeof global.addEventListener==='function'){global.addEventListener('hashchange',onHash);global.addEventListener('load',()=>{if(/^#\/city\/?$/.test(hashNow()))onHash()})}
global.GmHub={TABS,NAMES,TOOLS,STORE_KEY,normTab,tabFromHash,hashFor,pickTab,findTools,render,afterDraw,setTab,goTool,onEvent,tab:currentTab,hash:()=>hashFor(currentTab()),_reset(){cur=null}};
})(window);
