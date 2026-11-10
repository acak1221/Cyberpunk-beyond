/* «Досье» look only (html.ui-native.ui-board): a details panel and the filter chips on the «Бой» tab.
   The panel opens from a Skill name, a weapon name or a STAT box and shows what the number is made of (STAT, Skill,
   wounds, effects with their sources from effects.js, the modifier and LUCK set for the next roll), the Corebook
   pages and a roll button that presses the sheet's own roll button, so every rule stays in one place.
   The chips only hide weapon rows and quick rolls on screen; nothing in the character changes.
   Presentation only: no character data is written here. The chosen chip is a per-device preference.
   Pages: checks pp. 128–130, Skill list pp. 130–142, ranged combat pp. 170–173, melee pp. 175–178,
   wound states pp. 186–187, STATs pp. 72–73. All wording is this app's own. */
(function(global){
'use strict';
const doc=global.document;
const STATS=['INT','REF','DEX','TECH','COOL','WILL','LUCK','MOVE','BODY','EMP'];
const STAT_NAMES={INT:['Интеллект','Intelligence'],REF:['Рефлексы','Reflexes'],DEX:['Ловкость','Dexterity'],TECH:['Техника','Technique'],COOL:['Хладнокровие','Cool'],WILL:['Воля','Willpower'],LUCK:['Удача','Luck'],MOVE:['Скорость','Movement'],BODY:['Телосложение','Body'],EMP:['Эмпатия','Empathy']};
const FILTER_KEY='nc-dossier-combat-filter';
// [id, Russian, English, hint RU, hint EN]
const FILTERS=[
 ['all','Все','All','Всё оружие и все быстрые броски','Every weapon and every quick roll'],
 ['attacks','Атаки','Attacks','Оружие и бросок рукопашного боя','Weapons and the Brawling roll'],
 ['quick','Быстрые броски','Quick rolls','Только быстрые броски','Quick rolls only'],
 ['limited','С боезапасом','Limited use','Только оружие, у которого считаются патроны','Only weapons that count ammunition'],
];
const FILTER_IDS=new Set(FILTERS.map(f=>f[0]));
const PHONE='(max-width: 820px)';
let filter='all',opened=null,panel=null,backdrop=null,modal=false,lastHtml='',dirty=false,pendingFocus=null,focusTimer=0;
try{const saved=global.localStorage?.getItem(FILTER_KEY);if(FILTER_IDS.has(saved))filter=saved}catch{}

const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const signed=n=>(n<0?'−':'+')+Math.abs(n);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const quote=x=>String(x??'').replace(/["\\]/g,'\\$&');
const isObject=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function lang(){try{const l=global.App?.lang?.();if(l==='en'||l==='ru')return l}catch{}return doc?.documentElement?.lang==='en'?'en':'ru'}
function isBoard(){try{return !!doc.documentElement.classList.contains('ui-board')}catch{return false}}
function character(){try{return global.App?.active?.()||null}catch{return null}}
function skillLabel(skill,l){return global.SKILL_LABELS?.[skill]?.[l]||skill}

// ---------- the chips ----------
// item: {type:'weapon', ammo:boolean} or {type:'quick', attack:boolean}. Anything else is never hidden.
function visible(id,item){
 if(!item||!FILTER_IDS.has(id)||id==='all')return true;
 if(item.type==='weapon')return id==='attacks'||(id==='limited'&&item.ammo===true);
 if(item.type==='quick')return id==='quick'||(id==='attacks'&&item.attack===true);
 return true;
}
function countLine(id,w,q,l){
 if(id==='all'||!FILTER_IDS.has(id))return '';
 return l==='en'?`Shown: weapons ${w.shown} of ${w.total}, quick rolls ${q.shown} of ${q.total}`:`Показано: оружие ${w.shown} из ${w.total}, быстрые броски ${q.shown} из ${q.total}`;
}
function barHtml(id,l){
 const ru=l!=='en';
 return `<div class="dossier-filter" role="group" aria-label="${ru?'Фильтр раздела «Бой»':'Combat tab filter'}">${FILTERS.map(f=>`<button type="button" data-dossier-filter="${f[0]}" aria-pressed="${f[0]===id}" title="${esc(ru?f[3]:f[4])}">${esc(ru?f[1]:f[2])}</button>`).join('')}<span class="dossier-filter-count" role="status"></span></div>`;
}

// ---------- what a number is made of ----------
function hpMax(c){const s=c?.stats||{};return 10+5*Math.ceil((num(s.BODY)+num(s.WILL))/2)}
// The wound state and its penalty to checks (pp. 186–187). Something that switches the Seriously Wounded penalty off is named.
function wound(c){
 const hp=num(c?.hp),max=hpMax(c);
 if(hp<1)return {id:'mortal',value:-4,ignored:false};
 if(hp<Math.ceil(max/2)){let off=false;try{off=!!global.Effects?.ignoresSerious?.(c)}catch{}return {id:'serious',value:off?0:-2,ignored:off}}
 return {id:'',value:0,ignored:false};
}
// The STAT as a check takes it: REF and DEX after worn armor, EMP from current Humanity.
function statBase(c,stat){
 const sheet=num(c?.stats?.[stat]);
 if(stat==='EMP'){const humanity=num(c?.humanity);return {sheet,value:Math.max(0,Math.floor(humanity/10)),humanity}}
 if(stat==='REF'||stat==='DEX'||stat==='MOVE'){
  let a=null;try{a=global.EquipmentTools?.armorRollAdjustment?.(c,stat)}catch{}
  if(a&&a.ok&&a.enabled&&Number.isFinite(Number(a.value)))return {sheet,value:num(a.value),armor:num(a.value)-sheet};
 }
 return {sheet,value:sheet};
}
const SOURCE={injury:['критическая травма','Critical Injury'],cyber:['киберимплант','cyberware'],drug:['уличный наркотик','street drug']};
// One row per thing acting on the character that changes this very check; the situational reminders go to `notes`.
function effectRows(c,q,l){
 const ru=l!=='en',rows=[],notes=[];let total=null;
 try{total=global.Effects?.collect?.(c)||null}catch{}
 for(const s of Array.isArray(total?.sources)?total.sources:[]){
  const p=isObject(s?.parts)?s.parts:{},kind=SOURCE[s?.kind]?s.kind:'injury';let v=0;
  if(kind==='injury'){
   if(q.check)v+=num(p.all)+(q.kind==='melee'?num(p.melee):q.kind==='ranged'?num(p.ranged):0);
   if(q.move)v+=num(p.move);
  }
  if(kind==='drug'&&q.stat&&isObject(p.stats)&&Object.hasOwn(p.stats,q.stat))v+=num(p.stats[q.stat]);
  if(kind!=='injury'&&q.skill&&isObject(p.skills)&&Object.hasOwn(p.skills,q.skill))v+=num(p.skills[q.skill]);
  const name=String(s?.name?.[ru?'ru':'en']||s?.name?.en||'').trim()||(ru?SOURCE[kind][0]:SOURCE[kind][1]);
  if(v)rows.push({label:name,source:ru?SOURCE[kind][0]:SOURCE[kind][1],value:v});
  if(Array.isArray(s?.note)&&s.note[ru?0:1])notes.push(`${name}: ${s.note[ru?0:1]}`);
 }
 return {rows,notes};
}
// The parts of a check, in the order the sheet adds them (see checkBonus in app.js).
function checkParts(c,q,l){
 const ru=l!=='en',parts=[],base=statBase(c,q.stat);
 if(q.stat==='EMP')parts.push({label:'EMP',source:ru?`от текущей Человечности (${base.humanity})`:`from current Humanity (${base.humanity})`,value:base.value});
 else{
  parts.push({label:q.stat,source:ru?'характеристика на листе':'STAT on the sheet',value:base.sheet});
  if(base.armor)parts.push({label:ru?'Броня':'Armor',source:ru?'штраф надетой брони':'penalty of the armor worn',value:base.armor});
 }
 parts.push({label:q.levelLabel,source:q.levelSource,value:q.level});
 const w=wound(c);
 if(w.value)parts.push({label:w.id==='mortal'?(ru?'Смертельное ранение':'Mortally Wounded'):(ru?'Тяжёлое ранение':'Seriously Wounded'),source:ru?'состояние ранения':'wound state',value:w.value});
 const fx=effectRows(c,{check:true,kind:q.kind,skill:q.skill,stat:q.stat},l);
 parts.push(...fx.rows);
 if(w.ignored)fx.notes.unshift(ru?'Тяжёлое ранение: штраф −2 сейчас не действует':'Seriously Wounded: the −2 penalty is not in force now');
 return {parts,notes:fx.notes,next:nextParts(c,l)};
}
// What is set for the next roll only: the check modifier and the LUCK to spend.
function nextParts(c,l){
 const ru=l!=='en',x=isObject(c?.extra)?c.extra:{},out=[];
 const mod=clamp(num(x.modifier),-100,100),pool=x.luck===undefined||x.luck===''?num(c?.stats?.LUCK):Math.max(0,num(x.luck)),luck=Math.min(pool,Math.max(0,num(x.luckUse)));
 if(mod)out.push({label:ru?'Модификатор':'Modifier',source:ru?'задан для следующего броска':'set for the next roll',value:mod});
 if(luck)out.push({label:'LUCK',source:ru?'будет потрачено на этот бросок':'will be spent on this roll',value:luck});
 return out;
}
const sum=parts=>parts.reduce((a,p)=>a+num(p.value),0);
// The sheet's own number is the truth. If a rule this panel does not know about took part, the difference gets its own row.
function reconcile(parts,real,l){
 if(!Number.isFinite(real))return sum(parts);
 const diff=real-sum(parts);
 if(diff)parts.push({label:l==='en'?'Other':'Прочее',source:l==='en'?'other rules of the sheet':'другие правила листа',value:diff});
 return real;
}
function soloThreat(c){try{const s=global.RoleTools?.soloRollBonuses?.(c);return s?.ok&&s.enabled?num(s.threat):0}catch{return 0}}
function skillSummary(skill,l){
 const row=(Array.isArray(global.SkillReference?.SKILLS)?global.SkillReference.SKILLS:[]).find(r=>r?.[0]===skill);
 return row?String(row[l==='en'?7:6]||''):'';
}
function skillStat(skill){
 const row=(Array.isArray(global.SkillReference?.SKILLS)?global.SkillReference.SKILLS:[]).find(r=>r?.[0]===skill);
 return STATS.includes(row?.[2])?row[2]:'';
}
// o: {skill, stat}. The STAT comes from the sheet row, so the panel explains exactly what the row rolls.
function skillBreakdown(c,o,l){
 const skill=String(o?.skill||''),stat=STATS.includes(o?.stat)?o.stat:skillStat(skill);
 if(!c||!skill||!stat)return null;
 const ru=l!=='en',name=skillLabel(skill,ru?'ru':'en'),level=num(c.skills?.[skill]);
 const made=checkParts(c,{stat,level,levelLabel:name,levelSource:ru?'уровень навыка':'Skill level',kind:'',skill},l),parts=[...made.parts];
 const threat=skill==='Perception'?soloThreat(c):0;
 if(threat)parts.push({label:ru?'Обнаружение угроз':'Threat Detection',source:ru?'способность Соло':'Solo ability',value:threat});
 parts.push(...made.next);
 let real=NaN;try{const f=global.App?.checkBonus;if(typeof f==='function')real=Number(f(c,stat,c.skills?.[skill],'',skill))+threat}catch{}
 const total=reconcile(parts,real,l);
 return {kind:'skill',key:skill,eyebrow:`${ru?'Навык':'Skill'} · ${stat}`,title:name,total:signed(total),value:total,formula:`1d10 + ${stat} + ${name}`,summary:skillSummary(skill,l),parts,notes:made.notes,facts:[],
  pages:ru?'Проверка навыка: Корбук, с. 128–130. Список навыков: с. 130–142. Штрафы ранений: с. 186–187.':'Skill Check: Corebook pp. 128–130. Skill list: pp. 130–142. Wound penalties: pp. 186–187.',
  rolls:[{label:`${ru?'Бросить':'Roll'} 1d10 ${signed(total)}`,selector:`[data-action="skill-roll"][data-skill="${quote(skill)}"]`,primary:true}]};
}
// A Skill specialization a weapon attacks with; an entry that is not unique or not valid is not used (same as the sheet).
function specialization(c,id){
 if(typeof id!=='string'||!id)return null;
 const list=(Array.isArray(c?.extra?.specializations)?c.extra.specializations:[]).filter(s=>isObject(s)&&s.id===id);
 if(list.length!==1)return null;
 const s=list[0],level=typeof s.level==='number'?s.level:typeof s.level==='string'&&s.level.trim()!==''?Number(s.level):NaN;
 return typeof s.name==='string'&&s.name.trim()&&STATS.includes(s.stat)&&Number.isInteger(level)&&level>=0&&level<=10?{name:s.name.trim(),stat:s.stat,level}:null;
}
function tracksAmmo(w){try{const f=global.WeaponAmmo?.tracks;if(typeof f==='function')return !!f(w)}catch{}return false}
// o: {index, title}. The title is what the sheet shows for the weapon.
function weaponBreakdown(c,o,l){
 const index=Math.trunc(Number(o?.index)),w=c?.extra?.weapons?.[index];
 if(!c||!Number.isInteger(index)||!isObject(w))return null;
 const ru=l!=='en',skill=w.skill||'Handgun',spec=Object.hasOwn(w,'skillSpecializationId')?specialization(c,w.skillSpecializationId):null;
 const stat=spec?spec.stat:STATS.includes(w.stat)?w.stat:'REF',level=spec?spec.level:clamp(num(c.skills?.[skill]),0,10);
 let kind='';try{kind=global.Effects?.attackKind?.(skill)||''}catch{}
 const skillName=spec?spec.name:skillLabel(skill,ru?'ru':'en');
 const made=checkParts(c,{stat,level,levelLabel:skillName,levelSource:spec?(ru?'уровень специализации':'specialization level'):(ru?'уровень навыка атаки':'attack Skill level'),kind,skill:spec?'':skill},l),parts=[...made.parts];
 const own=clamp(num(w.modifier),-100,100);
 if(own)parts.push({label:ru?'Модификатор оружия':'Weapon modifier',source:ru?'записан в карточке оружия':'written on the weapon entry',value:own});
 parts.push(...made.next);
 let real=NaN;try{const f=global.CharacterExtra?.attackBonus;if(typeof f==='function'){const v=f(c,index);if(v!==null&&v!==undefined)real=Number(v)}}catch{}
 const total=reconcile(parts,real,l),name=String(o?.title||(typeof w.name==='string'?w.name:'')||(ru?'Оружие':'Weapon')).trim();
 const facts=[];
 if(w.damage)facts.push([ru?'Урон':'Damage',String(w.damage)]);
 facts.push(['ROF',String(clamp(Math.trunc(num(w.rof||1)),1,10))]);
 if(tracksAmmo(w)){const cap=clamp(Math.trunc(num(w.capacity)),0,9999),cur=clamp(Math.trunc(num(w.ammo)),0,9999);facts.push([ru?'Патроны в магазине':'Rounds in the magazine',cap?`${cur} / ${cap}`:String(cur)])}
 if(w.notes)facts.push([ru?'Особенности':'Notes',String(w.notes).slice(0,200)]);
 const at=`[data-cx-index="${index}"]`,melee=kind==='melee';
 return {kind:'weapon',key:String(index),eyebrow:`${ru?'Атака':'Attack'} · ${kind==='melee'?(ru?'ближний бой':'melee'):kind==='ranged'?(ru?'дальний бой':'ranged'):(ru?'оружие':'weapon')}`,title:name,total:signed(total),value:total,formula:`1d10 + ${stat} + ${skillName}`,summary:'',parts,notes:made.notes,facts,
  pages:melee?(ru?'Ближний бой: Корбук, с. 175–178. Проверки: с. 128–130. Штрафы ранений: с. 186–187.':'Melee: Corebook pp. 175–178. Checks: pp. 128–130. Wound penalties: pp. 186–187.'):(ru?'Дальний бой и таблица дистанций: Корбук, с. 170–173. Проверки: с. 128–130. Штрафы ранений: с. 186–187.':'Ranged combat and the range table: Corebook pp. 170–173. Checks: pp. 128–130. Wound penalties: pp. 186–187.'),
  rolls:[{label:`${ru?'Атака':'Attack'} 1d10 ${signed(total)}`,selector:`[data-cx-action="attack"]${at}`,primary:true},...(w.damage?[{label:`${ru?'Урон':'Damage'} ${w.damage}`,selector:`[data-cx-action="damage"]${at}`}]:[])]};
}
// o: {stat}. The number in the box is the sheet value; the panel shows what checks take right now and what hangs on it.
function statBreakdown(c,o,l){
 const stat=String(o?.stat||'');
 if(!c||!STATS.includes(stat))return null;
 const ru=l!=='en',base=statBase(c,stat),parts=[{label:stat,source:ru?'значение на листе':'value on the sheet',value:base.sheet}],facts=[],notes=[];
 let value=base.value;
 if(stat==='EMP'&&base.value!==base.sheet)parts.push({label:ru?'Человечность':'Humanity',source:ru?`сейчас ${base.humanity}: EMP = десятки Человечности`:`now ${base.humanity}: EMP is its tens digit`,value:base.value-base.sheet});
 if(base.armor)parts.push({label:ru?'Броня':'Armor',source:ru?'штраф надетой брони':'penalty of the armor worn',value:base.armor});
 const fx=effectRows(c,stat==='MOVE'?{move:true,stat}:{stat},l);
 parts.push(...fx.rows);value+=sum(fx.rows);
 if(stat==='MOVE')value=Math.max(base.sheet>0?1:0,value);
 if(stat==='LUCK'){const x=isObject(c.extra)?c.extra:{},pool=x.luck===undefined||x.luck===''?base.sheet:Math.max(0,num(x.luck));facts.push([ru?'Осталось в запасе':'Left in the pool',`${pool} / ${base.sheet}`]);notes.push(ru?'LUCK не прибавляется сам: очки тратятся перед броском и возвращаются в начале следующей игровой встречи.':'LUCK is not added by itself: points are spent before a roll and come back at the start of the next session.')}
 if(stat==='BODY'||stat==='WILL')facts.push([ru?'Максимум HP':'Maximum HP',`${hpMax(c)} = 10 + 5 × ⌈(BODY + WILL) / 2⌉`]);
 if(stat==='BODY'){const penalty=Math.max(0,num(c.extra?.deathPenalty));facts.push([ru?'Спасбросок от смерти':'Death Save',ru?`1d10${penalty?' + '+penalty:''} должно быть ниже ${base.sheet}`:`1d10${penalty?' + '+penalty:''} must be under ${base.sheet}`])}
 if(stat==='EMP')facts.push([ru?'Человечность':'Humanity',String(num(c.humanity))]);
 const w=wound(c);
 if(w.value&&stat!=='LUCK'&&stat!=='MOVE')notes.push(ru?`${w.id==='mortal'?'Смертельное':'Тяжёлое'} ранение: ещё ${signed(w.value)} ко всем проверкам.`:`${w.id==='mortal'?'Mortally':'Seriously'} Wounded: another ${signed(w.value)} to every check.`);
 // The Skills that use this STAT and are trained, strongest first.
 const linked=(Array.isArray(global.SkillReference?.SKILLS)?global.SkillReference.SKILLS:[]).filter(r=>r?.[2]===stat&&num(c.skills?.[r[0]])>0).map(r=>[skillLabel(r[0],ru?'ru':'en'),num(c.skills[r[0]])]).sort((a,b)=>b[1]-a[1]).slice(0,6);
 if(linked.length)facts.push([ru?'Развитые навыки':'Trained Skills',linked.map(([n,v])=>`${n} ${v}`).join(', ')]);
 const rollable=stat!=='LUCK'&&stat!=='MOVE',names=STAT_NAMES[stat];
 if(rollable)notes.push(ru?'Бросок отсюда — проверка без навыка: учитываются ранения и эффекты «ко всем действиям»; модификатор и LUCK следующего броска не тратятся.':'A roll from here is a check without a Skill: wounds and «all Actions» effects count; the modifier and LUCK set for the next roll are not used up.');
 return {kind:'stat',key:stat,eyebrow:ru?'Характеристика':'STAT',title:`${stat} · ${ru?names[0]:names[1]}`,total:String(value),value,formula:ru?'сейчас в проверках':'in checks right now',summary:'',parts,notes:[...notes,...fx.notes],facts,
  pages:ru?'Характеристики: Корбук, с. 72–73. Проверки: с. 128–130. Штрафы ранений: с. 186–187.':'STATs: Corebook pp. 72–73. Checks: pp. 128–130. Wound penalties: pp. 186–187.',
  rolls:rollable?[{label:`${ru?'Бросить':'Roll'} 1d10 ${signed(value)}`,check:{base:value,label:ru?`Проверка ${stat}`:`${stat} check`},primary:true}]:[]};
}

// ---------- markup ----------
function render(m,l){
 if(!m)return '';
 const ru=l!=='en',value=n=>`<b class="${n<0?'neg':''}">${signed(n)}</b>`;
 const first=m.kind==='stat';
 const rows=m.parts.map((p,i)=>`<li><span>${esc(p.label)}${p.source?`<small>${esc(p.source)}</small>`:''}</span>${first&&i===0?`<b>${esc(p.value)}</b>`:value(num(p.value))}</li>`).join('');
 const roll=(r,i)=>`<button type="button" class="btn ${r.primary?'primary':'ghost'}" data-keep="roll${i}" ${r.selector?`data-dossier-roll="${esc(r.selector)}"`:`data-dossier-check="${esc(r.check.base)}" data-dossier-label="${esc(r.check.label)}"`}${r.disabled?' disabled':''}><span aria-hidden="true">⬡</span> ${esc(r.label)}</button>`;
 return `<header class="dossier-head"><div><small>${esc(m.eyebrow)}</small><h2 id="dossier-title">${esc(m.title)}</h2></div><button type="button" class="dossier-close" data-dossier-close data-keep="close" aria-label="${ru?'Закрыть подробности':'Close details'}"><span aria-hidden="true">✕</span></button></header>`
 +`<div class="dossier-body"><p class="dossier-total"><b>${esc(m.total)}</b><span>${esc(m.formula)}</span></p>`
 +(m.summary?`<p class="dossier-summary">${esc(m.summary)}</p>`:'')
 +`<h3>${ru?'Из чего складывается':'What it is made of'}</h3><ul class="dossier-parts">${rows}<li class="dossier-sum"><span>${ru?'Итого':'Total'}</span><b>${esc(m.total)}</b></li></ul>`
 +(m.facts.length?`<dl class="dossier-facts">${m.facts.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`:'')
 +(m.notes.length?`<h3>${ru?'Не забудьте':'Keep in mind'}</h3><ul class="dossier-notes">${m.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>`:'')
 +`<p class="dossier-pages">${esc(m.pages)}</p></div>`
 +(m.rolls.length?`<footer class="dossier-actions">${m.rolls.map(roll).join('')}</footer>`:'');
}

// ---------- the page ----------
function mark(el,kind,key,label){
 if(!el||el.dataset.dossier===kind&&el.dataset.dossierKey===String(key))return;
 el.dataset.dossier=kind;el.dataset.dossierKey=String(key);
 el.setAttribute('role','button');el.setAttribute('tabindex','0');el.setAttribute('aria-haspopup','dialog');
 el.setAttribute('aria-label',`${label}: ${lang()==='en'?'what the number is made of':'из чего складывается число'}`);
}
function unmark(el){for(const a of ['role','tabindex','aria-haspopup','aria-label','data-dossier','data-dossier-key'])el.removeAttribute(a)}
function decorate(layout){
 for(const row of layout.querySelectorAll('#sheet-skills .skill-row')){const box=row.firstElementChild,skill=row.querySelector('input[data-skill]')?.dataset.skill;if(box&&skill)mark(box,'skill',skill,box.querySelector('strong')?.textContent||skill)}
 for(const row of layout.querySelectorAll('#sheet-weapons .cx-weapon')){const name=row.querySelector('.cx-entry-heading > strong'),index=row.querySelector('[data-cx-attack-total]')?.dataset.cxAttackTotal;if(name&&index!==undefined)mark(name,'weapon',index,name.textContent||'')}
 for(const box of doc.querySelectorAll('.sheet-extras .sheet-stat-strip > div')){const stat=box.querySelector('small')?.textContent?.trim();if(STATS.includes(stat))mark(box,'stat',stat,`${stat} ${box.querySelector('b')?.textContent||''}`.trim())}
}
const off=(el,hide)=>{if(hide){if(!el.hasAttribute('data-dossier-off'))el.setAttribute('data-dossier-off','')}else if(el.hasAttribute('data-dossier-off'))el.removeAttribute('data-dossier-off')};
function applyFilter(layout){
 const l=lang(),c=character(),combat=layout.dataset.activeTab==='combat',id=combat?filter:'all';
 let bar=layout.querySelector('.dossier-filter');
 if(!bar){layout.insertAdjacentHTML('afterbegin',barHtml(filter,l));bar=layout.querySelector('.dossier-filter')}
 if(bar)for(const b of bar.querySelectorAll('[data-dossier-filter]')){const on=String(b.dataset.dossierFilter===filter);if(b.getAttribute('aria-pressed')!==on)b.setAttribute('aria-pressed',on)}
 const w={shown:0,total:0},q={shown:0,total:0};
 for(const row of layout.querySelectorAll('#sheet-weapons .cx-weapon')){
  const index=Number(row.querySelector('[data-cx-attack-total]')?.dataset.cxAttackTotal),data=c?.extra?.weapons?.[index];
  const show=visible(id,{type:'weapon',ammo:isObject(data)?tracksAmmo(data)||!!row.querySelector('.wa-row'):!!row.querySelector('.wa-row')});
  off(row,!show);w.total++;if(show)w.shown++;
 }
 for(const b of doc.querySelectorAll('.sheet-extras .sheet-quick-rolls [data-proxy-roll]')){
  const show=visible(id,{type:'quick',attack:/data-skill="Brawling"/.test(b.dataset.proxyRoll||'')});
  off(b,!show);q.total++;if(show)q.shown++;
 }
 const rolls=doc.querySelector('.sheet-extras .sheet-quick-rolls');if(rolls)off(rolls,q.total>0&&q.shown===0);
 const count=bar?.querySelector('.dossier-filter-count'),text=countLine(id,w,q,l);
 if(count&&count.textContent!==text)count.textContent=text;
}
function cleanup(){
 for(const el of doc.querySelectorAll('[data-dossier]'))unmark(el);
 for(const el of doc.querySelectorAll('[data-dossier-off]'))el.removeAttribute('data-dossier-off');
 doc.querySelector('.dossier-filter')?.remove();
 dirty=false;
}
function opener(o){return o?doc.querySelector(`[data-dossier="${quote(o.kind)}"][data-dossier-key="${quote(o.key)}"]`):null}
function model(c,o){
 const l=lang();
 if(o.kind==='skill'){
  // The row's roll button says which STAT it rolls with: «…: 1d10 + REF + Пистолеты».
  const title=doc.querySelector(`.sheet-layout [data-action="skill-roll"][data-skill="${quote(o.key)}"]`)?.getAttribute('title')||'',stat=(title.match(/1d10 \+ ([A-Z]+) \+/)||[])[1];
  return skillBreakdown(c,{skill:o.key,stat},l);
 }
 if(o.kind==='weapon'){
  const title=opener(o)?.textContent||'';
  return weaponBreakdown(c,{index:Number(o.key),title},l);
 }
 if(o.kind==='stat')return statBreakdown(c,{stat:o.key},l);
 return null;
}
function paint(m){
 // A roll button whose sheet button is missing or switched off cannot roll.
 for(const r of m.rolls)if(r.selector){const target=doc.querySelector('.sheet-layout '+r.selector);r.disabled=!target||!!target.disabled}
 const next=render(m,lang());
 if(next===lastHtml)return;
 const keep=panel.contains(doc.activeElement)?doc.activeElement?.dataset?.keep:null,had=panel.contains(doc.activeElement);
 panel.innerHTML=next;lastHtml=next;
 if(had)(keep&&panel.querySelector(`[data-keep="${quote(keep)}"]`)||panel).focus?.({preventScroll:true});
}
function ensure(){
 if(panel&&panel.isConnected!==false)return;
 backdrop=doc.createElement('div');backdrop.className='dossier-backdrop';backdrop.hidden=true;backdrop.setAttribute('data-dossier-close','');
 panel=doc.createElement('aside');panel.className='dossier-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','dossier-title');panel.setAttribute('tabindex','-1');
 doc.body.appendChild(backdrop);doc.body.appendChild(panel);
}
function open(kind,key){
 if(!isBoard())return false;
 const c=character(),o={kind:String(kind),key:String(key)},m=c?model(c,o):null;
 if(!m)return false;
 ensure();opened=o;pendingFocus=null;
 try{modal=!!global.matchMedia?.(PHONE)?.matches}catch{modal=false}
 panel.setAttribute('aria-modal',String(modal));panel.hidden=false;backdrop.hidden=!modal;lastHtml='';
 paint(m);
 doc.documentElement.classList.add('dossier-open');
 for(const el of doc.querySelectorAll('[data-dossier][aria-expanded]'))el.removeAttribute('aria-expanded');
 opener(o)?.setAttribute('aria-expanded','true');
 panel.focus?.({preventScroll:true});
 return true;
}
function close({focus=true}={}){
 if(!opened)return false;
 const o=opened;opened=null;lastHtml='';
 if(panel){panel.hidden=true;panel.innerHTML=''}
 if(backdrop)backdrop.hidden=true;
 doc.documentElement.classList.remove('dossier-open');
 const el=opener(o);el?.removeAttribute('aria-expanded');
 if(focus)el?.focus?.({preventScroll:true});
 return true;
}
// A roll redraws the sheet, so the element that opened the panel is replaced: focus goes to its successor.
function refocusSoon(o){
 pendingFocus=o;global.clearTimeout?.(focusTimer);
 focusTimer=global.setTimeout?.(()=>{restoreFocus();pendingFocus=null},400)||0;
}
function restoreFocus(){
 if(!pendingFocus||opened)return;
 const a=doc.activeElement;
 if(a&&a!==doc.body&&a.isConnected!==false&&a!==doc.documentElement)return;
 opener(pendingFocus)?.focus?.({preventScroll:true});
}
function roll(button){
 const o=opened,selector=button.dataset.dossierRoll,base=button.dataset.dossierCheck,label=button.dataset.dossierLabel;
 close();
 if(selector){const target=doc.querySelector('.sheet-layout '+selector);if(target&&!target.disabled)target.click()}
 else if(base!==undefined){try{global.App?.check?.(num(base),label||'')}catch{}}
 if(o)refocusSoon(o);
}
function setFilter(id){
 if(!FILTER_IDS.has(id))return false;
 filter=id;try{global.localStorage?.setItem(FILTER_KEY,id)}catch{}
 sync();return true;
}
// Keeps the page in step with the sheet: runs after every redraw. Outside the «Досье» look it takes everything away again.
function sync(){
 if(!doc)return;
 const layout=isBoard()?doc.querySelector('.sheet-layout'):null;
 if(!layout){if(opened)close({focus:false});if(dirty)cleanup();return}
 dirty=true;
 decorate(layout);applyFilter(layout);
 if(opened){const c=character(),m=c?model(c,opened):null;if(m){paint(m);opener(opened)?.setAttribute('aria-expanded','true')}else close({focus:false})}
 restoreFocus();
}

if(doc?.addEventListener){
 doc.addEventListener('click',e=>{
  const t=e.target;if(!t?.closest)return;
  const chip=t.closest('[data-dossier-filter]');if(chip){setFilter(chip.dataset.dossierFilter);return}
  if(t.closest('[data-dossier-close]')){close();return}
  const button=t.closest('[data-dossier-roll],[data-dossier-check]');if(button){if(!button.disabled)roll(button);return}
  const from=t.closest('[data-dossier]');
  if(from&&isBoard()){if(opened&&opened.kind===from.dataset.dossier&&opened.key===from.dataset.dossierKey)close();else open(from.dataset.dossier,from.dataset.dossierKey)}
 });
 doc.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&opened){e.preventDefault?.();close();return}
  const from=e.target?.closest?.('[data-dossier]');
  if(from&&e.target===from&&(e.key==='Enter'||e.key===' ')&&isBoard()){e.preventDefault?.();open(from.dataset.dossier,from.dataset.dossierKey);return}
  // A bottom sheet covers the page, so Tab stays inside it.
  if(e.key==='Tab'&&opened&&modal&&panel){
   const items=[...panel.querySelectorAll('button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])')];if(!items.length){e.preventDefault?.();return}
   const firstItem=items[0],last=items[items.length-1],a=doc.activeElement;
   if(e.shiftKey&&(a===firstItem||a===panel)){e.preventDefault?.();last.focus()}
   else if(!e.shiftKey&&(a===last||!panel.contains(a))){e.preventDefault?.();firstItem.focus()}
  }
 });
 try{
  const Observer=global.MutationObserver;
  if(typeof Observer==='function'){
   const start=()=>{
    if(!doc.body)return;
    new Observer(sync).observe(doc.body,{childList:true,subtree:true});
    new Observer(sync).observe(doc.documentElement,{attributes:true,attributeFilter:['class','lang']});
    sync();
   };
   if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start);else start();
  }
 }catch{}
}
global.DossierPanel={FILTERS:FILTERS.map(f=>f[0]),visible,countLine,barHtml,wound,statBase,effectRows,skillBreakdown,weaponBreakdown,statBreakdown,render,open,close,sync,setFilter,filter:()=>filter,opened:()=>opened&&{...opened}};
})(window);
