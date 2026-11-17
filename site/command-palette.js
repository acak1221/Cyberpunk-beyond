/* Command palette: Ctrl/Cmd+K and the search button in the top bar, on every screen.
   One index over the screens, the characters, the skills of the current character (each with a roll action), the catalog,
   the rules entries, the campaigns and a few actions. The index is built only when the palette opens, so it costs nothing
   at load. A combobox for screen readers: the field owns a listbox, the highlighted option is aria-activedescendant,
   the number of results is announced through a status line. build(), rank() and normalize() are pure and exported for tests. */
(function(global){
'use strict';
const doc=global.document;
const T={
 ru:{
  title:'Поиск и команды',placeholder:'Раздел, персонаж, навык, предмет, правило…',close:'Закрыть',
  hint:'↑↓ выбор · Enter выполнить · Esc закрыть',
  count:n=>n?`Найдено: ${n}`:'Ничего не найдено',none:'Ничего не найдено. Попробуйте другое слово.',
  kinds:{screen:'Раздел',character:'Персонаж',skill:'Навык',catalog:'Каталог',rule:'Правила',campaign:'Кампания',action:'Действие'},
  rollSkill:n=>`Бросить ${n}`,nextTurn:'Следующий ход',nextTurnHint:'Трекер кампании',openGm:'Открыть ведущего',openGmHint:'Инструменты ведущего',
  quickDice:'Бросить кубик',quickDiceHint:'Быстрые кубики',newChar:'Создать персонажа',newCharHint:'Выбор способа',
  open:'Открыть',skillHint:(who,lvl)=>`${who} · уровень ${lvl} · без LUCK и разового модификатора листа`,roundHint:n=>`Раунд ${n}`,untitled:'Без имени',
  verbs:'бросить бросок проверка',recent:'Недавнее',gmPlayer:'Сейчас режим игрока: в меню раздел скрыт',toEnglish:'Переключить на английский',toRussian:'Русский язык',langHint:'Язык',
  themeDark:'Тёмная тема',themeLight:'Светлая тема',themeAuto:'Тема как в системе',themeHint:'Оформление'
 },
 en:{
  title:'Search and commands',placeholder:'Screen, character, skill, item, rule…',close:'Close',
  hint:'↑↓ choose · Enter run · Esc close',
  count:n=>n?`Results: ${n}`:'No results',none:'Nothing found. Try another word.',
  kinds:{screen:'Screen',character:'Character',skill:'Skill',catalog:'Catalog',rule:'Rules',campaign:'Campaign',action:'Action'},
  rollSkill:n=>`Roll ${n}`,nextTurn:'Next turn',nextTurnHint:'Campaign tracker',openGm:'Open Game Master tools',openGmHint:'Game Master',
  quickDice:'Roll a die',quickDiceHint:'Quick dice',newChar:'Create a character',newCharHint:'Choose a method',
  open:'Open',skillHint:(who,lvl)=>`${who} · level ${lvl} · no LUCK or one-off sheet modifier`,roundHint:n=>`Round ${n}`,untitled:'Untitled',
  verbs:'roll check',recent:'Recent',gmPlayer:'Player mode is on: the section is hidden in the menu',toEnglish:'English',toRussian:'Switch to Russian',langHint:'Language',
  themeDark:'Dark theme',themeLight:'Light theme',themeAuto:'Theme follows the system',themeHint:'Look'
 }
};
const L=lang=>lang==='en'?'en':'ru';
const t=(lang,key)=>T[L(lang)][key];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list=x=>Array.isArray(x)?x:[];
const str=(v,max=120)=>typeof v==='string'?v.slice(0,max):'';
const LIMIT=40,EMPTY_LIMIT=12;
// Case, ё and extra spaces do not matter.
function normalize(s){return String(s??'').toLocaleLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim()}
const WEIGHT={action:30,screen:20,character:12,campaign:10,skill:6,catalog:3,rule:2};

/* src: {lang, screens:[{view,label}], characters:[{id,name,role}], current:{id,name,skills:[{key,ru,en,level}]}|null,
   catalog:[{id,label,hint}], rules:[{id,label,hint}], campaigns:[{id,name,round}], canNextTurn, hasGm}.
   Returns entries {id,kind,label,hint,n,k,w,run}: n is the normalized label, k the normalized extra words, run a plain
   description of what to do (executed by run()). */
function build(src){
 const lang=L(src?.lang),out=[];
 const add=(kind,id,label,hint,words,run,match)=>{const l=str(label,160).trim();if(!l)return;out.push({id:`${kind}:${id}`,kind,label:l,hint:str(hint,160),n:normalize(match||l),k:normalize(words),w:WEIGHT[kind]||0,run})};
 if(src?.canNextTurn)add('action','next-turn',t(lang,'nextTurn'),t(lang,'nextTurnHint'),'turn next round initiative ход следующий раунд инициатива трекер',{type:'next-turn'});
 add('action','quick-dice',t(lang,'quickDice'),t(lang,'quickDiceHint'),'d10 dice roll кубик бросок кость',{type:'quick-dice'});
 add('action','new-character',t(lang,'newChar'),t(lang,'newCharHint'),'new create builder новый создать персонаж',{type:'view',view:'builder-choice'});
 add('action','lang',t(lang,lang==='en'?'toRussian':'toEnglish'),t(lang,'langHint'),'language язык english русский',{type:'lang',lang:lang==='en'?'ru':'en'});
 for(const [m,k] of [['dark','themeDark'],['light','themeLight'],['auto','themeAuto']])add('action','theme-'+m,t(lang,k),t(lang,'themeHint'),'theme dark light тема темная светлая оформление',{type:'theme',mode:m});
 if(src?.hasGm!==false)add('action','open-gm',t(lang,'openGm'),src?.playerRole?t(lang,'gmPlayer'):t(lang,'openGmHint'),'gm game master ведущий мастер гм',{type:'view',view:'gm'});
 for(const s of list(src?.screens))if(/^[a-z][a-z-]{0,30}$/.test(String(s?.view||'')))add('screen',s.view,s.label,'',s.view,{type:'view',view:s.view});
 for(const c of list(src?.characters))if(typeof c?.id==='string'&&c.id)add('character',c.id,c.name||t(lang,'untitled'),c.role||'',c.role,{type:'open',id:c.id});
 const cur=src?.current;
 if(cur&&typeof cur.id==='string')for(const s of list(cur.skills)){
  const name=lang==='en'?s.en:s.ru;if(!name)continue;
  add('skill',`${cur.id}:${s.key}`,t(lang,'rollSkill')(name),t(lang,'skillHint')(cur.name||t(lang,'untitled'),Math.trunc(Number(s.level))||0),`${s.ru} ${s.en} ${s.key} ${t(lang,'verbs')}`,{type:'roll',id:cur.id,skill:s.key},name);
 }
 for(const c of list(src?.campaigns))if(typeof c?.id==='string'&&c.id)add('campaign',c.id,c.name||t(lang,'untitled'),c.round?t(lang,'roundHint')(c.round):'','campaign кампания трекер',{type:'campaign',id:c.id});
 for(const i of list(src?.catalog))if(i&&typeof i==='object')add('catalog',i.id,i.label,i.hint,i.words,{type:'search',view:'catalog',query:i.label});
 for(const r of list(src?.rules))if(r&&typeof r==='object')add('rule',r.id,r.label,r.hint,r.words,{type:'search',view:'rules',query:r.label});
 return out;
}
// How well one entry fits all the words of the query (0 = not at all). Every word has to match somewhere.
// `n` of a skill is the skill's name (the verb «Бросить» is only an extra word), so «уклон» finds the roll before a rules page.
function score(entry,tokens){
 let total=0;
 for(const tk of tokens){
  let s=0;
  if(entry.n.startsWith(tk))s=100;
  else if(entry.n.includes(' '+tk)||entry.n.includes('-'+tk)||entry.n.includes('('+tk))s=80;
  else if(entry.n.includes(tk))s=60;
  else if(entry.k.startsWith(tk)||entry.k.includes(' '+tk))s=40;
  else if(entry.k.includes(tk))s=25;
  if(!s)return 0;
  total+=s;
 }
 return total+entry.w;
}
// alias(entry, query) may rescue an entry the words did not match (the everyday words of the catalog: «нож», «патроны»).
// recent: ids of the entries chosen last, newest first; with an empty query they come first.
function rank(entries,query,limit=LIMIT,alias,recent){
 const q=normalize(query),all=list(entries);
 if(!q){
  const rec=list(recent),pos=e=>{const i=rec.indexOf(e.id);return i<0?rec.length:i};
  return [...all].sort((a,b)=>pos(a)-pos(b)||b.w-a.w).slice(0,EMPTY_LIMIT);
 }
 const tokens=q.split(' ');
 return all.map((e,i)=>({e,i,s:score(e,tokens)||(typeof alias==='function'&&alias(e,q)?10+e.w:0)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s||a.i-b.i).slice(0,limit).map(x=>x.e);
}

// ---- The live sources ------------------------------------------------------------------------------------------------
const lang=()=>{try{return global.App?.lang?.()==='en'?'en':'ru'}catch{return 'ru'}};
const RECENT='palette-recent',RECENT_MAX=5;
function recents(){try{const v=global.UIMemory?.get(RECENT,[],x=>Array.isArray(x)&&x.every(i=>typeof i==='string'&&i.length<=200));return Array.isArray(v)?v.slice(0,RECENT_MAX):[]}catch{return []}}
function remember(id){try{global.UIMemory?.set(RECENT,[id,...recents().filter(x=>x!==id)].slice(0,RECENT_MAX))}catch{}}
function mem(name){try{return global.UIMemory?.get(name,null,v=>typeof v==='string')||null}catch{return null}}
function sources(){
 const A=global.App,state=A?.getState?.()||{},l=lang(),chars=list(state.characters);
 const screens=[...(doc?.querySelectorAll?.('#app-sidebar .nav-item')||[])].map(el=>({view:el.dataset?.view,label:el.querySelector('.nav-text')?.textContent?.trim()||el.getAttribute('title')||''})).filter(s=>s.view);
 const char=chars.find(c=>c.id===state.active)||chars.find(c=>c.id===mem('home-char'))||chars[0]||null;
 const labels=global.SKILL_LABELS||{};
 const current=char?{id:char.id,name:char.name,skills:Object.keys(labels).map(key=>({key,ru:labels[key]?.ru,en:labels[key]?.en,level:char.skills?.[key]}))}:null;
 const camps=list(state.campaigns);
 return {
  lang:l,playerRole:global.RoleMode?.get?.()==='player',screens,characters:chars.map(c=>({id:c.id,name:c.name,role:c.role})),current,
  campaigns:camps.map(c=>({id:c.id,name:c.name,round:Number(c.round)||1})),
  canNextTurn:camps.some(c=>list(c.roster).length),hasGm:true,
  catalog:list(global.CATALOG).map(i=>({id:i.id,label:i.name?.[l]||i.name?.en||'',hint:'',words:`${i.name?.ru||''} ${i.name?.en||''}`})),
  rules:list(global.RULES).map(r=>({id:r.id,label:r.title?.[l]||r.title?.en||'',hint:r.category?.[l]||'',words:`${r.title?.ru||''} ${r.title?.en||''} ${r.page||''}`}))
 };
}
// What an entry does. The palette is closed first; a roll stays on the screen it was made from.
function run(entry){
 const r=entry?.run,A=global.App;if(!r||!A)return false;
 switch(r.type){
  case 'view':return (A.navigate||A.setView)?.call(A,r.view)===true;
  case 'open':return A.open?.(r.id)===true;
  case 'roll':return A.rollSkill?.(r.id,r.skill)===true;
  case 'campaign':return global.Home?.openCampaign?.(r.id)===true;
  case 'next-turn':return global.Home?.nextTurn?.()===true;
  case 'quick-dice':return global.QuickDice?.open?.()===true;
  case 'search':return A.search?.(r.view,r.query)===true;
  case 'lang':{if(r.lang!=='ru'&&r.lang!=='en')return false;const b=doc.querySelector(`[data-action="lang"][data-lang="${r.lang}"]`);if(!b)return false;b.click();return true}
  case 'theme':{if(!/^(auto|dark|light)$/.test(String(r.mode)))return false;const b=doc.querySelector(`[data-ui-theme="${r.mode}"]`);if(!b)return false;b.click();return true}
 }
 return false;
}

// ---- The dialog -----------------------------------------------------------------------------------------------------
let catalogIndex=new Map();
const alias=(e,q)=>{try{if(e.kind!=='catalog')return false;const item=catalogIndex.get(e.id);return !!item&&global.CatalogSearch?.matches?.(q,item)===true}catch{return false}};
let root=null,input=null,listEl=null,status=null,none=null,entries=[],shown=[],active=0,opener=null,appEl=null,sourcesNow=null;
const isOpen=()=>!!root;
function optionId(i){return 'cmdk-opt-'+i}
function paint(){
 const l=lang();
 shown=rank(entries,input.value,LIMIT,alias,recents());
 if(active>=shown.length)active=Math.max(0,shown.length-1);
 listEl.innerHTML=shown.length?shown.map((e,i)=>`<li id="${optionId(i)}" class="cmdk-opt${i===active?' active':''}" role="option" aria-selected="${i===active}" data-cmdk-index="${i}"><span class="cmdk-kind" aria-hidden="true">${esc(t(l,'kinds')[e.kind])}</span><span class="cmdk-text"><span class="cmdk-label">${esc(e.label)}</span>${e.hint?`<span class="cmdk-sub">${esc(e.hint)}</span>`:''}</span></li>`).join(''):'';
 none.hidden=shown.length>0;none.textContent=t(l,'none');listEl.hidden=!shown.length;
 input.setAttribute('aria-expanded',String(shown.length>0));
 if(shown.length)input.setAttribute('aria-activedescendant',optionId(active));else input.removeAttribute('aria-activedescendant');
 status.textContent=t(l,'count')(shown.length);
}
function move(d){
 if(!shown.length)return;
 active=(active+d+shown.length)%shown.length;
 for(const el of listEl.querySelectorAll('.cmdk-opt'))el.classList.toggle('active',Number(el.dataset.cmdkIndex)===active),el.setAttribute('aria-selected',String(Number(el.dataset.cmdkIndex)===active));
 input.setAttribute('aria-activedescendant',optionId(active));
 listEl.querySelector('#'+optionId(active))?.scrollIntoView?.({block:'nearest'});
}
function open(trigger){
 if(root||!doc?.body)return false;
 try{global.MoreSheet?.close?.({restore:false})}catch{}
 const l=lang(),a=trigger&&trigger.nodeType===1?trigger:doc.activeElement;opener=a&&a!==doc.body?a:null;
 sourcesNow=sources();entries=build(sourcesNow);catalogIndex=new Map(list(global.CATALOG).map(i=>['catalog:'+i.id,i]));active=0;
 root=doc.createElement('div');root.className='cmdk';
 root.innerHTML=`<div class="cmdk-backdrop" data-cmdk-close></div><div class="cmdk-box" role="dialog" aria-modal="true" aria-labelledby="cmdk-title"><div class="cmdk-head"><h2 id="cmdk-title" class="cmdk-title">${esc(t(l,'title'))}</h2><button type="button" class="cmdk-close" data-cmdk-close aria-label="${esc(t(l,'close'))}">✕</button></div><input id="cmdk-input" class="cmdk-input" type="text" role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-autocomplete="list" aria-label="${esc(t(l,'title'))}" placeholder="${esc(t(l,'placeholder'))}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go"><ul id="cmdk-list" class="cmdk-list" role="listbox" aria-label="${esc(t(l,'title'))}"></ul><p class="cmdk-none" hidden></p><div class="cmdk-status" role="status" aria-live="polite"></div><p class="cmdk-hint">${esc(t(l,'hint'))}</p></div>`;
 input=root.querySelector('#cmdk-input');listEl=root.querySelector('#cmdk-list');status=root.querySelector('.cmdk-status');none=root.querySelector('.cmdk-none');
 doc.body.appendChild(root);
 appEl=doc.querySelector('#app');if(appEl)appEl.inert=true;
 doc.documentElement.classList.add('cmdk-open');
 paint();input.focus({preventScroll:true});
 return true;
}
function close({restore=true}={}){
 if(!root)return false;
 const el=root,back=opener,app=appEl;root=null;input=null;listEl=null;status=null;none=null;entries=[];shown=[];opener=null;appEl=null;
 try{el.remove()}catch{}
 try{if(app)app.inert=false}catch{}
 doc.documentElement.classList.remove('cmdk-open');
 if(restore){try{const target=back&&back.isConnected!==false&&back!==doc.body?back:doc.querySelector('#main-content');target?.focus?.({preventScroll:true})}catch{}}
 return true;
}
function choose(i){
 const e=shown[i];if(!e)return false;
 const back=opener;
 close({restore:false});
 let ok=false;try{ok=run(e)}catch{ok=false}
 if(ok)remember(e.id);
 // A roll shows its chip at the top: the keyboard follows it there, so Details and Again can be used.
 if(ok&&e.run?.type==='roll'){try{if(global.RollChip?.focus?.())return ok}catch{}}
 // After a screen change or a roll the focus must not be on the page body: back to the opener if it is still there, else to the content.
 try{const a=doc.activeElement;if(!a||a===doc.body||a.closest?.('#app')===null){const target=back&&back.isConnected!==false&&back!==doc.body?back:doc.querySelector('#main-content');target?.focus?.({preventScroll:true})}}catch{}
 return ok;
}
function onKey(e){
 if(!root)return false;
 if(e.key==='Escape'){e.preventDefault?.();close();return true}
 if(e.key==='ArrowDown'){e.preventDefault?.();move(1);return true}
 if(e.key==='ArrowUp'){e.preventDefault?.();move(-1);return true}
 if(e.key==='Enter'&&!e.isComposing&&doc.activeElement===input){e.preventDefault?.();choose(active);return true}
 if(e.key==='Tab'){
  // Two stops: the field and the close button.
  const stops=[input,root.querySelector('.cmdk-close')],cur=doc.activeElement,i=stops.indexOf(cur),next=e.shiftKey?(i<=0?stops.length-1:i-1):(i+1)%stops.length;
  e.preventDefault?.();stops[next].focus({preventScroll:true});return true;
 }
 return false;
}
function onShortcut(e){
 if(!e||e.defaultPrevented||(e.key!=='k'&&e.key!=='K')||!(e.ctrlKey||e.metaKey)||e.altKey||e.shiftKey)return false;
 e.preventDefault?.();
 if(root)close();else open();
 return true;
}
if(doc?.addEventListener){
 doc.addEventListener('keydown',e=>{if(onShortcut(e))return;onKey(e)},true);
 doc.addEventListener('input',e=>{if(root&&e.target===input){active=0;paint()}});
 doc.addEventListener('click',e=>{
  const o=e.target?.closest?.('[data-cmdk-open]');
  if(o){e.preventDefault?.();root?close():open(o);return}
  if(!root)return;
  if(e.target?.closest?.('[data-cmdk-close]')){close();return}
  const opt=e.target?.closest?.('[data-cmdk-index]');if(opt)choose(Number(opt.dataset.cmdkIndex));
 });
 // A pointer press on an option must not take the focus from the field.
 doc.addEventListener('mousedown',e=>{if(root&&e.target?.closest?.('[data-cmdk-index]'))e.preventDefault?.()});
 global.addEventListener?.('popstate',()=>close({restore:false}));
}
global.CommandPalette={recents,remember,build,rank,normalize,score,run,open,close,isOpen,choose,onShortcut,t};
})(typeof window!=='undefined'?window:globalThis);
