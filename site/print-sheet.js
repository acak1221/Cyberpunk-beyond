/* Printed character sheet and GM card.
   The paper version is built from the character data, not from the screen: it is the same white A4 sheet in every look,
   with no buttons and no empty tool panels. Sections without data are left out.
   - model(c, env)        plain data for paper (pure; env supplies the app's own calculators when they are loaded)
   - sheetHTML / cardHTML  markup of the full sheet (1–2 pages) and of the GM card (a third of a page)
   - open()               the "what to print" dialog; prepare()/cleanup() mount and remove the paper root (#print-sheet)
   Print options are a per-device convenience (localStorage nc-print-options); nothing is added to saved characters. */
(function(global){
'use strict';
const STATS=['INT','REF','DEX','TECH','COOL','WILL','LUCK','MOVE','BODY','EMP'];
const LIFE_KEYS=['culture','personality','clothing','hairstyle','affectation','valued','feelPeople','valuedPerson','valuedThing','family','environment','familyCrisis','motivation','friends','enemies','romance','roleHistory'];
const CARD_SKILLS=['Perception','Evasion','Athletics','Brawling','Concentration','Human Perception','Stealth','Resist Torture/Drugs'];
const OPTIONS_KEY='nc-print-options';
const L={
 ru:{sheet:'Лист персонажа',card:'Карточка для ведущего',unnamed:'Без имени',rank:'ранг',stats:'Характеристики',derived:'Производные значения',hp:'ОЗ (HP)',serious:'Тяжёлое ранение',seriousAt:'ниже',deathSave:'Спасбросок от смерти',humanity:'Человечность',emp:'Текущая EMP',init:'Инициатива',move:'MOVE',spHead:'Броня: голова',spBody:'Броня: тело',luck:'Запас удачи',rep:'Репутация',cash:'Наличные',ip:'Очки развития',skills:'Навыки',skill:'Навык',lvl:'Ур.',total:'Итог',specs:'Специализации и языки',native:'Родной язык',weapons:'Оружие',weapon:'Оружие',attack:'Атака',damage:'Урон',rof:'ROF',ammo:'Патроны',notes:'Заметки',armor:'Броня',head:'Голова',body:'Тело',cyberware:'Кибернетика',gear:'Снаряжение',ability:'Ролевая способность',life:'Жизненный путь',lifeNames:{culture:'Происхождение',personality:'Характер',clothing:'Одежда',hairstyle:'Причёска',affectation:'Примета',valued:'Главная ценность',feelPeople:'Отношение к людям',valuedPerson:'Важный человек',valuedThing:'Ценная вещь',family:'Семья',environment:'Детство',familyCrisis:'Семейный кризис',motivation:'Цель',friends:'Друзья',enemies:'Враги',romance:'Отношения',roleHistory:'История роли'},page:'стр.',printed:'Напечатано',totalsNote:'Итог навыка: характеристика + уровень + постоянные модификаторы; без штрафов за ранения и без потраченной удачи.',app:'Night City // RED · помощник для Cyberpunk RED',dead:'Мёртв',
  dlgTitle:'Печать и PDF',dlgWhat:'Что напечатать',modeSheet:'Лист персонажа (1–2 страницы A4)',modeCard:'Карточка для ведущего (треть страницы)',modeBoth:'Лист и карточка',incLife:'Добавить жизненный путь',incNotes:'Добавить заметки',hint:'Чтобы сохранить PDF, в окне печати выберите «Сохранить как PDF». На бумаге лист всегда белый, без кнопок.',preview:'Предпросмотр',print:'Печать / PDF',close:'Закрыть'},
 en:{sheet:'Character sheet',card:'GM card',unnamed:'Unnamed',rank:'rank',stats:'STATS',derived:'Derived values',hp:'HP',serious:'Seriously Wounded',seriousAt:'below',deathSave:'Death Save',humanity:'Humanity',emp:'Current EMP',init:'Initiative',move:'MOVE',spHead:'Armor: head',spBody:'Armor: body',luck:'LUCK pool',rep:'Reputation',cash:'Cash',ip:'Improvement Points',skills:'Skills',skill:'Skill',lvl:'Lvl',total:'Total',specs:'Specializations and languages',native:'Native language',weapons:'Weapons',weapon:'Weapon',attack:'Attack',damage:'Damage',rof:'ROF',ammo:'Ammo',notes:'Notes',armor:'Armor',head:'Head',body:'Body',cyberware:'Cyberware',gear:'Gear',ability:'Role ability',life:'Lifepath',lifeNames:{culture:'Origin',personality:'Personality',clothing:'Clothing',hairstyle:'Hairstyle',affectation:'Affectation',valued:'Values most',feelPeople:'View of people',valuedPerson:'Valued person',valuedThing:'Valued possession',family:'Family',environment:'Childhood',familyCrisis:'Family crisis',motivation:'Goal',friends:'Friends',enemies:'Enemies',romance:'Romance',roleHistory:'Role history'},page:'p.',printed:'Printed',totalsNote:'Skill total: STAT + level + lasting modifiers; no wound penalties and no spent LUCK.',app:'Night City // RED · a Cyberpunk RED helper',dead:'Dead',
  dlgTitle:'Print and PDF',dlgWhat:'What to print',modeSheet:'Character sheet (1–2 A4 pages)',modeCard:'GM card (a third of a page)',modeBoth:'Sheet and card',incLife:'Include the lifepath',incNotes:'Include notes',hint:'To save a PDF, choose “Save as PDF” in the print window. On paper the sheet is always white, with no buttons.',preview:'Preview',print:'Print / PDF',close:'Close'}
};
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const num=(v,fallback=0)=>{const n=Number(v);return Number.isFinite(n)?n:fallback};
const text=(v,max=4000)=>typeof v==='string'?v.trim().slice(0,max):typeof v==='number'&&Number.isFinite(v)?String(v):'';
const signed=n=>(n<0?'−':'+')+Math.abs(n);
const list=v=>Array.isArray(v)?v.filter(isObj):[];
const attempt=(fn,fallback)=>{try{const v=fn();return v===undefined||v===null?fallback:v}catch{return fallback}};
const PICTURE=/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
function clone(c){try{return JSON.parse(JSON.stringify(c))}catch{return null}}
function normalOptions(o){const x=isObj(o)?o:{};return {mode:['sheet','card','both'].includes(x.mode)?x.mode:'sheet',life:x.life!==false,notes:x.notes!==false}}

/* Everything paper needs, as plain data. Never changes `c`: calculators that fill in missing fields get a copy.
   The copy is "rested" (full HP, no situational modifier, no LUCK spent) so the printed totals do not go stale
   with the next wound. */
function model(c,env={}){
 if(!isObj(c)||!isObj(c.stats))return null;
 const lang=env.lang==='en'?'en':'ru',t=L[lang],x=isObj(c.extra)?c.extra:{};
 const stat=k=>num(c.stats[k]),hpMax=10+5*Math.ceil((stat('BODY')+stat('WILL'))/2),humanity=num(c.humanity),emp=Math.max(0,Math.floor(humanity/10));
 const rested=clone(c)||c;if(rested!==c){rested.hp=hpMax;if(isObj(rested.extra)){rested.extra.modifier=0;rested.extra.luckUse=0}}
 const base=(s,level)=>(s==='EMP'?emp:stat(s))+level;
 const bonus=(s,level,name)=>{const n=typeof env.checkBonus==='function'?attempt(()=>Number(env.checkBonus(rested,s,level,'',name)),NaN):NaN;return Number.isFinite(n)?n:base(s,level)};
 const roles=Array.isArray(env.roles)?env.roles:[],role=roles.find(r=>r&&r.id===c.role)||null;
 const skills=(Array.isArray(env.skills)?env.skills:[]).filter(s=>Array.isArray(s)&&typeof s[0]==='string').map(s=>{
  const level=Math.max(0,Math.min(10,num(isObj(c.skills)?c.skills[s[0]]:0))),extra=s[0]==='Perception'&&typeof env.perceptionBonus==='function'?num(attempt(()=>env.perceptionBonus(rested),0)):0;
  return {id:s[0],name:lang==='ru'?String(s[1]||s[0]):s[0],stat:String(s[2]||''),level,hard:Number(s[3])===2,total:bonus(String(s[2]||''),level,s[0])+extra};
 });
 const specs=list(x.specializations).map(s=>{const st=STATS.includes(s.stat)?s.stat:'INT',level=Math.max(0,Math.min(10,num(s.level)));return {name:text(s.name,100),stat:st,level,total:bonus(st,level,'')}}).filter(s=>s.name);
 const weapons=list(x.weapons).map((w,i)=>{
  const skill=text(w.skill,60)||'Handgun',known=skills.find(s=>s.id===skill),st=STATS.includes(w.stat)?w.stat:'REF';
  const fallback=base(st,known?known.level:0)+num(w.modifier),attack=typeof env.attackBonus==='function'?attempt(()=>{const n=Number(env.attackBonus(rested,i));return Number.isFinite(n)?n:fallback},fallback):fallback;
  return {name:text(w.name,100)||'—',skill:known?known.name:skill,attack,damage:text(w.damage,40),rof:w.rof===undefined||w.rof===''?'':String(num(w.rof)),ammo:w.usesAmmo===true||num(w.capacity)>0?`${num(w.ammo)} / ${num(w.capacity)}`:'',notes:text(w.notes,160)};
 });
 const items=list(x.items).map(i=>({id:i.id,name:text(i.name,100),category:['equipment','cyberware','armor','other'].includes(i.category)?i.category:'equipment',quantity:num(i.quantity,1),notes:text(i.notes,160)})).filter(i=>i.name);
 const eq=isObj(x.equipment)?x.equipment:{},worn=where=>{const slot=isObj(eq.armor)?eq.armor[where]:null,item=isObj(slot)?items.find(i=>i.id!==undefined&&i.id===slot.recordId):null;return item?item.name:''};
 const maxHumanity=Number.isSafeInteger(eq.maxHumanity)&&eq.maxHumanity>=0?eq.maxHumanity:null;
 const pool=x.luck===undefined||x.luck===''?stat('LUCK'):Math.max(0,num(x.luck));
 const life=LIFE_KEYS.map(k=>{const own=isObj(x.life)?x.life[k]:'',shown=typeof env.lifeField==='function'?attempt(()=>env.lifeField(c,k,lang),own):own;return {key:k,label:t.lifeNames[k],value:text(shown,600)}}).filter(r=>r.value);
 const rows=typeof env.roleRows==='function'?attempt(()=>env.roleRows(rested,lang),[]):[];
 const picture=typeof x.portrait==='string'&&x.portrait.length<=400000&&PICTURE.test(x.portrait)?x.portrait:'';
 return {
  lang,name:text(c.name,80)||t.unnamed,roleId:String(c.role||''),role:role&&isObj(role.name)?String(role.name[lang]||role.name.en||c.role):String(c.role||''),rank:num(c.rank),picture,
  ability:{name:role&&isObj(role.ability)?String(role.ability[lang]||role.ability.en||''):'',page:role&&Number.isFinite(Number(role.page))?Number(role.page):null,rows:(Array.isArray(rows)?rows:[]).filter(r=>Array.isArray(r)&&text(r[0])).map(r=>[text(r[0],120),text(r[1],300)])},
  stats:STATS.map(k=>({key:k,value:stat(k)})),
  hp:num(c.hp),hpMax,serious:Math.ceil(hpMax/2),deathSave:stat('BODY'),humanity,maxHumanity,emp,
  initiative:typeof env.initiativeBonus==='function'?attempt(()=>{const n=Number(env.initiativeBonus(rested));return Number.isFinite(n)?n:stat('REF')},stat('REF')):stat('REF'),
  move:stat('MOVE'),spHead:num(c.head),spBody:num(c.bodyArmor),armorHead:worn('head'),armorBody:worn('body'),
  luck:pool,luckMax:stat('LUCK'),reputation:x.reputation===undefined?null:Math.max(0,Math.min(10,num(x.reputation))),reputationNote:text(x.reputationNote,200),
  cash:x.cash===undefined||x.cash===''?null:num(x.cash),ip:typeof env.ip==='function'?attempt(()=>{const n=Number(env.ip(rested));return Number.isFinite(n)?n:null},null):null,
  dead:isObj(x.deathRecord)&&x.deathRecord.dead===true,
  native:text(c.native,120),nativeLevel:x.nativeLevel===undefined?null:num(x.nativeLevel),
  skills,specs,weapons,
  armorItems:items.filter(i=>i.category==='armor'),cyberItems:items.filter(i=>i.category==='cyberware'),gearItems:items.filter(i=>i.category==='equipment'||i.category==='other'),
  gearText:text(c.gear,6000),cyberText:text(c.cyberware,6000),notes:text(c.notes,20000),life,
  date:text(env.date,40)
 };
}

const box=(label,value,sub='')=>`<div class="ps-box"><span class="ps-box-label">${esc(label)}</span><b class="ps-box-value">${esc(value)}</b>${sub?`<small class="ps-box-sub">${esc(sub)}</small>`:''}</div>`;
const section=(title,body,cls='',side='')=>body?`<section class="ps-section ${cls}"><h2><span>${esc(title)}</span>${side?`<small>${esc(side)}</small>`:''}</h2>${body}</section>`:'';
const itemLine=i=>`<li><b>${esc(i.name)}</b>${i.quantity!==1?` ×${esc(i.quantity)}`:''}${i.notes?` <span class="ps-dim">— ${esc(i.notes)}</span>`:''}</li>`;
const items=rows=>rows.length?`<ul class="ps-items">${rows.map(itemLine).join('')}</ul>`:'';
const prose=v=>v?`<p class="ps-text">${esc(v)}</p>`:'';
const pairs=rows=>rows.length?`<dl class="ps-pairs">${rows.map(r=>`<div><dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd></div>`).join('')}</dl>`:'';
function vitals(m,t){
 const out=[box(t.hp,`${m.hp} / ${m.hpMax}`,m.dead?t.dead:''),box(t.serious,`${t.seriousAt} ${m.serious}`),box(t.deathSave,m.deathSave),box(t.init,signed(m.initiative)),box(t.move,m.move),
  box(t.spHead,m.spHead,m.armorHead),box(t.spBody,m.spBody,m.armorBody),box(t.humanity,m.maxHumanity===null?String(m.humanity):`${m.humanity} / ${m.maxHumanity}`),box(t.emp,m.emp),box(t.luck,`${m.luck} / ${m.luckMax}`)];
 if(m.reputation!==null)out.push(box(t.rep,m.reputation,m.reputationNote));
 if(m.cash!==null)out.push(box(t.cash,`${m.cash} eb`));
 if(m.ip!==null)out.push(box(t.ip,m.ip));
 return out.join('');
}
function weaponsTable(m,t,compact){
 if(!m.weapons.length)return '';
 const rows=compact?m.weapons.slice(0,4):m.weapons;
 return `<table class="ps-table"><thead><tr><th>${esc(t.weapon)}</th><th>${esc(t.attack)}</th><th>${esc(t.damage)}</th><th>${esc(t.rof)}</th>${compact?'':`<th>${esc(t.ammo)}</th><th>${esc(t.skill)}</th><th>${esc(t.notes)}</th>`}</tr></thead><tbody>${rows.map(w=>`<tr><td><b>${esc(w.name)}</b></td><td class="ps-num">${esc(signed(w.attack))}</td><td class="ps-num">${esc(w.damage||'—')}</td><td class="ps-num">${esc(w.rof||'—')}</td>${compact?'':`<td class="ps-num">${esc(w.ammo||'—')}</td><td>${esc(w.skill)}</td><td class="ps-dim">${esc(w.notes)}</td>`}</tr>`).join('')}</tbody></table>`;
}
function abilityBlock(m,t){
 if(!m.ability.name&&!m.ability.rows.length)return '';
 return `<p class="ps-ability"><b>${esc(m.ability.name||m.role)}</b> · ${esc(t.rank)} ${esc(m.rank)}${m.ability.page?` · ${esc(t.page)} ${esc(m.ability.page)}`:''}</p>${pairs(m.ability.rows)}`;
}
function head(m,t,kind){
 return `<header class="ps-head">${kind==='sheet'&&m.picture?`<img class="ps-portrait" src="${esc(m.picture)}" alt="">`:''}<div class="ps-head-main"><h1>${esc(m.name)}</h1><p>${esc(m.role)} · ${esc(t.rank)} ${esc(m.rank)}${m.ability.name?` · ${esc(m.ability.name)}`:''}</p></div><div class="ps-head-side"><b>${esc(kind==='sheet'?t.sheet:t.card)}</b><span>${esc(t.app)}</span>${m.date?`<span>${esc(t.printed)}: ${esc(m.date)}</span>`:''}</div></header>`;
}
/* The full sheet. options.life / options.notes === false leave those sections out. */
function sheetHTML(m,options){
 if(!m)return '';
 const o=normalOptions(options),t=L[m.lang];
 const skillRows=m.skills.map(s=>`<li class="${s.level>0?'ps-trained':''}"><span class="ps-skill-name">${esc(s.name)}${s.hard?' ×2':''}</span><span class="ps-skill-stat">${esc(s.stat)}</span><span class="ps-skill-level">${esc(s.level)}</span><b class="ps-skill-total">${esc(signed(s.total))}</b></li>`).join('');
 const specRows=[...(m.native?[[`${t.native}: ${m.native}`,m.nativeLevel===null?'':String(m.nativeLevel)]]:[]),...m.specs.map(s=>[`${s.name} (${s.stat})`,`${s.level} → ${signed(s.total)}`])];
 const armor=pairs([[t.head,`SP ${m.spHead}${m.armorHead?` · ${m.armorHead}`:''}`],[t.body,`SP ${m.spBody}${m.armorBody?` · ${m.armorBody}`:''}`]])+items(m.armorItems);
 return `<article class="ps-sheet">${head(m,t,'sheet')}
<section class="ps-section ps-stats-block"><h2><span>${esc(t.stats)}</span></h2><div class="ps-stats">${m.stats.map(s=>box(s.key,s.value)).join('')}</div></section>
<section class="ps-section ps-vitals-block"><h2><span>${esc(t.derived)}</span></h2><div class="ps-vitals">${vitals(m,t)}</div></section>
${skillRows?`<section class="ps-section ps-skills-block"><h2><span>${esc(t.skills)}</span><small>${esc(t.skill)} · STAT · ${esc(t.lvl)} · ${esc(t.total)}</small></h2><ul class="ps-skills">${skillRows}</ul><p class="ps-foot">${esc(t.totalsNote)}</p></section>`:''}
${section(t.specs,pairs(specRows),'ps-specs-block')}
${section(t.weapons,weaponsTable(m,t,false),'ps-weapons-block')}
<div class="ps-columns"><div class="ps-column">${section(t.armor,armor,'ps-armor-block')}${section(t.cyberware,items(m.cyberItems)+prose(m.cyberText),'ps-cyber-block')}</div><div class="ps-column">${section(t.gear,items(m.gearItems)+prose(m.gearText),'ps-gear-block')}${section(t.ability,abilityBlock(m,t),'ps-ability-block')}</div></div>
${o.life?section(t.life,pairs(m.life.map(r=>[r.label,r.value])),'ps-life-block'):''}
${o.notes?section(t.notes,prose(m.notes),'ps-notes-block'):''}
</article>`;
}
/* Which skills make it onto the card: the ones a GM asks for most, then the character's best. */
function cardSkills(m,limit=14){
 const byId=new Map(m.skills.map(s=>[s.id,s])),out=[];
 for(const id of CARD_SKILLS){const s=byId.get(id);if(s)out.push(s)}
 for(const s of m.skills.filter(s=>s.level>0&&!CARD_SKILLS.includes(s.id)).sort((a,b)=>b.level-a.level||b.total-a.total)){if(out.length>=limit)break;out.push(s)}
 return out.slice(0,limit);
}
/* The GM card: a fixed-height block, a third of an A4 page, cut along the dashed border. */
function cardHTML(m){
 if(!m)return '';
 const t=L[m.lang],cyber=[...m.cyberItems.map(i=>i.name),...(m.cyberText?[m.cyberText.replace(/\s*\n+\s*/g,'; ')]:[])].join('; ');
 const quick=[[t.hp,`${m.hp} / ${m.hpMax}`],[t.serious,`${t.seriousAt} ${m.serious}`],[t.deathSave,m.deathSave],[t.init,signed(m.initiative)],[t.move,m.move],[t.spHead,m.spHead],[t.spBody,m.spBody],[t.humanity,m.maxHumanity===null?String(m.humanity):`${m.humanity} / ${m.maxHumanity}`],[t.emp,m.emp],...(m.reputation===null?[]:[[t.rep,m.reputation]])];
 const skills=cardSkills(m);
 return `<article class="ps-card">${head(m,t,'card')}<div class="ps-card-grid">
<div class="ps-card-col"><div class="ps-stats ps-stats-card">${m.stats.map(s=>box(s.key,s.value)).join('')}</div>${pairs(quick.map(r=>[r[0],String(r[1])]))}</div>
<div class="ps-card-col">${skills.length?`<h2><span>${esc(t.skills)}</span></h2><ul class="ps-card-skills">${skills.map(s=>`<li><span>${esc(s.name)}</span><b>${esc(signed(s.total))}</b></li>`).join('')}</ul>`:''}</div>
<div class="ps-card-col">${m.weapons.length?`<h2><span>${esc(t.weapons)}</span></h2>${weaponsTable(m,t,true)}`:''}${cyber?`<h2><span>${esc(t.cyberware)}</span></h2><p class="ps-text ps-clamp">${esc(cyber)}</p>`:''}${m.ability.name?`<h2><span>${esc(t.ability)}</span></h2><p class="ps-text">${esc(m.ability.name)} · ${esc(t.rank)} ${esc(m.rank)}${m.ability.page?` · ${esc(t.page)} ${esc(m.ability.page)}`:''}</p>`:''}</div>
</div></article>`;
}
function documentHTML(c,env,options){
 const m=model(c,env),o=normalOptions(options);
 if(!m)return '';
 return (o.mode!=='card'?sheetHTML(m,o):'')+(o.mode!=='sheet'?cardHTML(m):'');
}

/* ---- Browser side ---- */
let known={},root=null,pageRule=null,dialog=null,freshUntil=0;
const doc=()=>global.document;
function readOptions(){try{return normalOptions(JSON.parse(global.localStorage.getItem(OPTIONS_KEY)||'null'))}catch{return normalOptions(null)}}
function writeOptions(o){try{global.localStorage.setItem(OPTIONS_KEY,JSON.stringify(normalOptions(o)))}catch{}}
/* The role summary comes from the role tools as markup; paper wants label/value pairs. */
function roleRows(c,lang){
 const html=global.RoleTools?.derived?.(c,lang);if(typeof html!=='string'||!html)return [];
 const holder=doc().createElement('template');holder.innerHTML=html;
 return [...holder.content.querySelectorAll('.rt-summary > *')].map(el=>el.children.length>=2?[el.children[0].textContent.trim(),el.children[el.children.length-1].textContent.trim()]:null).filter(Boolean);
}
function environment(){
 // SKILLS is a top-level const of app.js: reachable by name once app.js has run, and handed over by the print button too.
 let skills=known.skills;if(!Array.isArray(skills)){try{skills=SKILLS}catch{skills=null}} // eslint-disable-line no-undef
 if(!Array.isArray(skills))skills=Object.entries(global.SKILL_LABELS||{}).map(([id,n])=>[id,n?.ru||id,'',1,0]);
 const app=global.App||{},lang=attempt(()=>app.lang(),'ru')==='en'?'en':'ru';
 return {lang,skills,roles:global.ROLES||[],
  checkBonus:typeof app.checkBonus==='function'?app.checkBonus:undefined,
  initiativeBonus:typeof app.initiativeBonus==='function'?app.initiativeBonus:undefined,
  attackBonus:typeof global.CharacterExtra?.attackBonus==='function'?global.CharacterExtra.attackBonus:undefined,
  perceptionBonus:c=>{const s=global.RoleTools?.soloRollBonuses?.(c);return s?.ok&&s.enabled?Number(s.threat)||0:0},
  ip:typeof global.CharacterExtra?.ipBalance==='function'?c=>{const v=global.CharacterExtra.ipBalance(c);return typeof v==='number'?v:Number(v?.balance)}:undefined,
  lifeField:typeof global.Lifepath?.displayField==='function'?global.Lifepath.displayField:undefined,
  roleRows,date:new Date().toLocaleDateString(lang==='ru'?'ru-RU':'en-GB')};
}
function current(){const app=global.App;if(!app)return null;const state=attempt(()=>app.getState(),null);if(!state||state.view!=='sheet')return null;return attempt(()=>app.active(),null)}
function cleanup(){root?.remove();root=null;pageRule?.remove();pageRule=null;freshUntil=0;doc()?.documentElement.classList.remove('ps-printing')}
/* Put the paper version into the page (hidden on screen, the only thing visible in print). */
function prepare(options,character){
 cleanup();
 const c=character||current();if(!c)return false;
 const html=documentHTML(c,environment(),options===undefined?readOptions():options);if(!html)return false;
 root=doc().createElement('div');root.id='print-sheet';root.className='ps-paper';root.lang=environment().lang;root.innerHTML=html;
 // The page size and margins are set only while the sheet is being printed, so other printouts keep the browser's own.
 pageRule=doc().createElement('style');pageRule.textContent='@page{size:A4;margin:10mm}';doc().head.appendChild(pageRule);
 doc().body.appendChild(root);doc().documentElement.classList.add('ps-printing');freshUntil=Date.now()+15000;return true;
}
function chosen(){
 const form=dialog?.querySelector('form');if(!form)return readOptions();
 return normalOptions({mode:form.querySelector('input[name="ps-mode"]:checked')?.value,life:form.querySelector('[data-ps-option="life"]')?.checked,notes:form.querySelector('[data-ps-option="notes"]')?.checked});
}
function paintPreview(){
 const view=dialog?.querySelector('[data-ps-preview]');if(!view)return;
 const c=current(),o=chosen();
 view.innerHTML=c?`<div class="ps-paper ps-paper-preview" lang="${environment().lang}">${documentHTML(c,environment(),o)}</div>`:'';
 const paper=view.firstElementChild;if(paper&&view.clientWidth>0&&paper.offsetWidth>0)paper.style.zoom=String(Math.min(1,(view.clientWidth-2)/paper.offsetWidth));
 for(const el of dialog.querySelectorAll('[data-ps-option]'))el.disabled=o.mode==='card';
}
function closeDialog(){
 if(!dialog)return;
 const d=dialog;dialog=null;try{d.close()}catch{}d.remove();
 doc().querySelector('[data-action="print"]')?.focus?.();
}
function printNow(){
 const o=chosen();writeOptions(o);
 if(!prepare(o))return;
 global.print();
}
/* The print button of the sheet. Returns false when there is nothing to print, so the caller can fall back. */
function open(context){
 if(isObj(context)&&Array.isArray(context.skills))known={skills:context.skills};
 const c=current();if(!c||!doc()?.createElement)return false;
 closeDialog();
 const env=environment(),t=L[env.lang],o=readOptions(),radio=(value,label)=>`<label class="ps-choice"><input type="radio" name="ps-mode" value="${value}" ${o.mode===value?'checked autofocus':''}><span>${esc(label)}</span></label>`,check=(key,label)=>`<label class="ps-choice"><input type="checkbox" data-ps-option="${key}" ${o[key]?'checked':''}><span>${esc(label)}</span></label>`;
 dialog=doc().createElement('dialog');dialog.className='ps-dialog';dialog.setAttribute('aria-labelledby','ps-dialog-title');
 dialog.innerHTML=`<form method="dialog" class="ps-form"><div class="ps-dialog-head"><h2 id="ps-dialog-title">${esc(t.dlgTitle)}</h2><button type="button" class="ps-btn" data-ps-close>${esc(t.close)}</button></div><fieldset class="ps-fieldset"><legend>${esc(t.dlgWhat)}</legend>${radio('sheet',t.modeSheet)}${radio('card',t.modeCard)}${radio('both',t.modeBoth)}</fieldset><div class="ps-extras">${check('life',t.incLife)}${check('notes',t.incNotes)}</div><p class="ps-hint">${esc(t.hint)}</p><div class="ps-actions"><button type="button" class="ps-btn ps-btn-primary" data-ps-print>${esc(t.print)}</button></div><h3 class="ps-preview-title">${esc(t.preview)}</h3><div class="ps-preview" data-ps-preview tabindex="0" role="region" aria-label="${esc(t.preview)}"></div></form>`;
 dialog.addEventListener('change',paintPreview);
 dialog.addEventListener('click',e=>{const el=e.target.closest?.('button');if(!el)return;if(el.hasAttribute('data-ps-close'))closeDialog();else if(el.hasAttribute('data-ps-print'))printNow()});
 dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog()});
 doc().body.appendChild(dialog);
 if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
 paintPreview();
 return true;
}
if(typeof global.addEventListener==='function'){
 // Ctrl+P (or the browser menu) on an open sheet prints the same paper version with the last chosen options.
 // A paper root that was just prepared (the dialog, or a caller of prepare) is printed as it is. One left over from an
 // earlier print (a browser that never reported the end of printing) is rebuilt or removed.
 global.addEventListener('beforeprint',()=>{if(root&&Date.now()<freshUntil){freshUntil=0;return}if(current()){prepare();freshUntil=0}else cleanup()});
 global.addEventListener('afterprint',()=>{cleanup()});
 global.addEventListener('resize',()=>{if(dialog)paintPreview()});
}
global.PrintSheet={model,sheetHTML,cardHTML,documentHTML,cardSkills,normalOptions,open,prepare,cleanup,LIFE_KEYS};
})(window);
