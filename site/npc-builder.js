/* «NPC по шагам» (GM screen): a four-step builder that fills an NPC from the app's own archetype templates
   (gm-tools.js) and saves it as an ordinary preset of the NPC library (npc-library.js), optionally with
   numbered copies in a campaign tracker.

   Nothing new is stored: the result goes through NpcLibrary.addEntry, so the library's own cleaning stays the
   single gate for saved data, and export, the tracker's rolls and rooms keep working as they are. The steps live
   in module memory only; a reload drops an unfinished NPC, which is fine for a half-minute flow.

   The threat level is the app's own setting, not a book rule: per step up or down REF, BODY and WILL move by 1,
   HP by 5, skill and attack totals by 2, armor by one rung of the SP values the catalog has. The archetype's
   own level reproduces the template numbers exactly. Original UI text; no book text or tables are added. */
(function(){
'use strict';
const TIERS=['mook','lieutenant','miniboss','boss'],ARMOR_LADDER=[0,4,7,11,12,13,15,18],STEP={stat:1,hp:5,total:2};
// The library's limits, repeated here so the builder stops at them instead of letting cleanEntry drop data silently.
const MAX_NAME=60,MAX_ITEM=40,MAX_SKILLS=12,MAX_ATTACKS=6,MAX_NOTES=500;
// The kit is saved as one line of the preset's notes: KIT_BUDGET leaves room for its label and the origin line.
const MAX_KIT=16,MAX_KIT_NAME=80,MAX_QTY=999,KIT_BUDGET=440;
const DICE=/^(\d{1,2})d(6|10)$/;
const ATTACK_SKILLS=['Handgun','Shoulder Arms','Archery','Heavy Weapons','Autofire','Melee Weapon','Melee Weapons','Martial Arts'];
const SKILL_PRIORITY=['Evasion','Perception','Athletics','Brawling','Stealth','Concentration','Resist Torture/Drugs','Resist Torture/Drug','Human Perception','Persuasion','Interrogation','Tactics'];
const T={
 ru:{title:'NPC по шагам',sub:'ЧЕТЫРЕ ШАГА',intro:'Выберите архетип и уровень угрозы — числа подставятся из шаблонов приложения. Потом поправьте снаряжение и сохраните заготовку в библиотеку.',open:'Собрать NPC',steps:['Кто','Бой','Кибернетика и снаряжение','Проверка'],stepOf:(n,s)=>`Шаг ${n} из 4 · ${s}`,stepsLabel:'Шаги',back:'Назад',next:'Далее',close:'Закрыть',
  arch:'Архетип',tier:'Уровень угрозы',tiers:{mook:'Рядовой',lieutenant:'Лейтенант',miniboss:'Мини-босс',boss:'Босс'},native:'как в шаблоне',level:'уровень',page:'стр.',tierHint:'Сдвиг уровня — настройка приложения, а не правило книги: за каждый шаг REF, BODY и WILL меняются на 1, HP на 5, итоги навыков и атак на 2, броня — на одну ступень.',resetHint:'Смена архетипа или уровня вернёт броню, оружие, навыки и снаряжение к набору архетипа.',name:'Название',numbers:'Числа',
  armor:'Броня',armorGroup:'Броня, SP',weaker:'Броня слабее',stronger:'Броня крепче',noArmor:'без брони',heavy:'Штраф тяжёлой брони к навыкам учтите сами.',weapons:'Оружие',weaponsHint:'Нажмите на оружие, чтобы убрать его из заготовки или вернуть. Мест шесть: новое оружие займёт место выключенного.',weaponPick:'Оружие из каталога',addWeapon:'Добавить оружие',attacksFull:'В заготовке помещается не больше 6 атак.',skills:'Навыки для бросков',skillsFull:'В заготовке помещается не больше 12 навыков.',
  kitHint:'Кнопки «−» и «+» меняют количество; «−» у последней штуки убирает строку.',kitEmpty:'Список пуст.',less:n=>`Меньше: ${n}`,more:n=>`Больше: ${n}`,kitReset:'Вернуть набор архетипа',kitCount:'Позиций',addCyber:'Кибернетика из каталога',addGear:'Снаряжение из каталога',own:'Свой предмет',add:'Добавить',addOwn:'Добавить свой предмет',addCyberBtn:'Добавить кибернетику',addGearBtn:'Добавить снаряжение',kitFull:'В списке уже 16 позиций.',kitLong:'Список не помещается в заметку заготовки.',kitNote:'Список попадёт в заметки заготовки. Эффекты кибернетики на числа не влияют — поправьте их в библиотеке, если нужно.',added:n=>`Добавлено: ${n}`,removed:n=>`Убрано: ${n}`,kitBack:'Набор архетипа возвращён.',
  preview:'Что будет сохранено',attacks:'Атаки',notes:'Заметки',campaign:'Кампания',count:'Копий в трекер',countHint:n=>`0 — только в библиотеку. Имена нумеруются сами: «${n} 1», «${n} 2»…`,fewer:'Меньше копий',moreCopies:'Больше копий',saveLib:'Сохранить в библиотеку',saveAdd:n=>`Сохранить и добавить в трекер: ${n}`,needName:'Нужно название.',full:'Библиотека заполнена (100).',noCampaign:'Кампаний пока нет — заготовка сохранится только в библиотеку.',saved:n=>`Сохранено в библиотеку: ${n}.`,savedAdded:(c,names)=>`В «${c}» добавлено: ${names}.`,rosterFull:'Ростер кампании переполнен: копии не добавлены.',undo:'Отменить',undone:'Сохранение отменено.',keptEntry:'Заготовку вы уже изменили — она осталась в библиотеке.',keptRows:n=>`Изменённые копии остались в трекере: ${n}.`,kitLabel:'Снаряжение',origin:'Основа'},
 en:{title:'NPC step by step',sub:'FOUR STEPS',intro:'Pick an archetype and a threat level: the numbers come from the app’s templates. Then adjust the gear and save the preset to the library.',open:'Build an NPC',steps:['Who','Fight','Cyberware and gear','Review'],stepOf:(n,s)=>`Step ${n} of 4 · ${s}`,stepsLabel:'Steps',back:'Back',next:'Next',close:'Close',
  arch:'Archetype',tier:'Threat level',tiers:{mook:'Mook',lieutenant:'Lieutenant',miniboss:'Mini-boss',boss:'Boss'},native:'as in the template',level:'level',page:'p.',tierHint:'The level shift is an app setting, not a book rule: each step changes REF, BODY and WILL by 1, HP by 5, skill and attack totals by 2, and armor by one rung.',resetHint:'Changing the archetype or the level puts armor, weapons, skills and gear back to the archetype’s set.',name:'Name',numbers:'Numbers',
  armor:'Armor',armorGroup:'Armor, SP',weaker:'Weaker armor',stronger:'Stronger armor',noArmor:'no armor',heavy:'Apply the heavy armor penalty to skills yourself.',weapons:'Weapons',weaponsHint:'Press a weapon to leave it out of the preset or bring it back. There are six slots: a new weapon takes the place of a switched-off one.',weaponPick:'Weapon from the catalog',addWeapon:'Add weapon',attacksFull:'A preset holds no more than 6 attacks.',skills:'Skills to roll',skillsFull:'A preset holds no more than 12 skills.',
  kitHint:'The “−” and “+” buttons change the quantity; “−” on the last one removes the row.',kitEmpty:'The list is empty.',less:n=>`Less: ${n}`,more:n=>`More: ${n}`,kitReset:'Restore the archetype’s set',kitCount:'Items',addCyber:'Cyberware from the catalog',addGear:'Gear from the catalog',own:'Your own item',add:'Add',addOwn:'Add your own item',addCyberBtn:'Add cyberware',addGearBtn:'Add gear',kitFull:'The list already has 16 items.',kitLong:'The list does not fit into the preset’s notes.',kitNote:'The list goes into the preset’s notes. Cyberware effects do not change the numbers: adjust them in the library if needed.',added:n=>`Added: ${n}`,removed:n=>`Removed: ${n}`,kitBack:'The archetype’s set is back.',
  preview:'What will be saved',attacks:'Attacks',notes:'Notes',campaign:'Campaign',count:'Copies into the tracker',countHint:n=>`0 means the library only. Names number themselves: “${n} 1”, “${n} 2”…`,fewer:'Fewer copies',moreCopies:'More copies',saveLib:'Save to the library',saveAdd:n=>`Save and add to the tracker: ${n}`,needName:'A name is required.',full:'The library is full (100).',noCampaign:'No campaigns yet: the preset will be saved to the library only.',saved:n=>`Saved to the library: ${n}.`,savedAdded:(c,names)=>`Added to “${c}”: ${names}.`,rosterFull:'The campaign roster is full: no copies were added.',undo:'Undo',undone:'The save was undone.',keptEntry:'You have already changed the preset, so it stays in the library.',keptRows:n=>`Changed copies stay in the tracker: ${n}.`,kitLabel:'Gear',origin:'Based on'}
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// One line of typed text: control characters out, spaces folded, clipped (the same cleaning the library applies).
function line(v,max){return typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):''}
function int(v,lo,hi,d){const n=typeof v==='number'?v:typeof v==='string'&&/^\s*-?\d+\s*$/.test(v)?Number(v):NaN;return Number.isFinite(n)?Math.min(hi,Math.max(lo,Math.trunc(n))):d}
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
function appState(){return typeof window!=='undefined'&&window.App&&typeof window.App.getState==='function'?window.App.getState():null}

// ---------- numbers ----------
// Only templates with every field the builder reads; a broken one is skipped instead of breaking the card.
function wellFormed(x){return !!x&&typeof x.id==='string'&&!!x.id&&typeof x.name?.ru==='string'&&typeof x.name?.en==='string'&&TIERS.includes(x.tier)&&['REF','BODY','WILL'].every(k=>Number.isInteger(x.stats?.[k]))&&Number.isInteger(x.hp)&&Number.isInteger(x.armor?.headSP)&&Number.isInteger(x.armor?.bodySP)&&Array.isArray(x.weapons)&&!!x.skillBases&&typeof x.skillBases==='object'}
function archetypes(){const list=typeof window!=='undefined'?window.GMTools?.NPC_TEMPLATES:null;return Array.isArray(list)?list.filter(wellFormed):[]}
function shiftOf(tpl,tier){const a=TIERS.indexOf(tier),b=TIERS.indexOf(tpl?.tier);return a<0||b<0?0:a-b}
// Moves an SP along the ladder. No move returns the SP as it is, so a template value that is not a rung survives.
function ladderStep(sp,n){
 const v=int(sp,0,30,0),d=int(n,-10,10,0);if(!d)return v;
 let i=0;for(let k=0;k<ARMOR_LADDER.length;k++)if(ARMOR_LADDER[k]<=v)i=k;
 return ARMOR_LADDER[clamp(i+d,0,ARMOR_LADDER.length-1)];
}
// HP moves by 5 per step instead of being recomputed: one template does not follow the BODY/WILL formula, and the
// archetype's own level must give the template numbers exactly.
function scaled(tpl,tier){
 const s=shiftOf(tpl,tier),st=tpl.stats;
 return {shift:s,ref:clamp(st.REF+STEP.stat*s,1,10),body:clamp(st.BODY+STEP.stat*s,1,15),will:clamp(st.WILL+STEP.stat*s,1,15),hp:Math.max(10,tpl.hp+STEP.hp*s),sp:ladderStep(Math.max(tpl.armor.headSP,tpl.armor.bodySP),s)};
}
// A template total is a number, or {base, armored} for an NPC whose armor slows it: the armored value is the one
// it fights with (the tracker in gm-table.js makes the same choice). An unreadable value is null.
function skillTotal(tpl,key,shift){
 const raw=tpl?.skillBases&&Object.prototype.hasOwnProperty.call(tpl.skillBases,key)?tpl.skillBases[key]:null,v=raw&&typeof raw==='object'?raw.armored:raw;
 return Number.isInteger(v)?clamp(v+STEP.total*int(shift,-3,3,0),0,40):null;
}
function skillKeys(tpl){return Object.keys(tpl?.skillBases||{}).filter(k=>!ATTACK_SKILLS.includes(k)&&skillTotal(tpl,k,0)!==null)}
function defaultSkills(tpl){
 const rank=k=>{const i=SKILL_PRIORITY.indexOf(k);return i<0?SKILL_PRIORITY.length:i};
 return skillKeys(tpl).sort((a,b)=>rank(a)-rank(b)||skillTotal(tpl,b,0)-skillTotal(tpl,a,0)||(a<b?-1:a>b?1:0)).slice(0,MAX_SKILLS);
}
// The same keyword mapping as gm-table.js, kept here because that file loads later and may be absent.
function weaponSkill(name){
 const other=typeof window!=='undefined'?window.GMTable?.weaponSkill:null;if(typeof other==='function')return other(name);
 const n=String(name||'');
 if(/crossbow|\bbow\b/i.test(n))return 'Archery';
 if(/flamethrower|grenade launcher|rocket|missile/i.test(n))return 'Heavy Weapons';
 if(/shotgun|rifle/i.test(n))return 'Shoulder Arms';
 if(/pistol|smg|handgun|revolver/i.test(n))return 'Handgun';
 if(/melee weapon|ripper|wolver|cybersnake|sword|knife|blade|katana|club|axe|whip|hammer/i.test(n))return 'Melee Weapon';
 return 'Brawling';
}
// The attack total of a weapon for this archetype. A template without that skill falls back to the bare stat.
function attackBase(tpl,weaponName,shift,skill){
 const key=typeof skill==='string'&&skill?skill:weaponSkill(weaponName),total=skillTotal(tpl,key,shift)??skillTotal(tpl,key+'s',shift);
 if(total!==null)return total;
 const stat=/^(Melee Weapon|Brawling|Martial Arts)/.test(key)?tpl.stats.DEX:tpl.stats.REF;
 return clamp((Number.isInteger(stat)?stat:0)+STEP.total*int(shift,-3,3,0),0,40);
}
// In Russian the attack carries the Russian weapon name, so the tracker cannot tell melee from ranged by keyword
// and treats it like any hand-typed library attack (existing behaviour of the library, not changed here).
// Each row remembers where its name came from: «en» is the template's English weapon name, «cat» a catalog id.
// The shown name is worked out from that for the current language, so a GM who switches the interface in the
// middle of a build does not save a preset with two languages in it. A row without either is the GM's own text.
function templateAttacks(tpl,shift,lang){
 const ru=lang!=='en'?window.GMTools?.WEAPONS_RU:null,out=[];
 for(const w of tpl.weapons){
  const damage=typeof w?.damage==='string'?w.damage.trim().toLowerCase():'',en=line(w?.name,80);
  if(!en||!DICE.test(damage))continue;
  out.push({name:line(ru?.[en]||en,MAX_ITEM),base:attackBase(tpl,en,shift),damage,on:true,en});
  if(out.length>=MAX_ATTACKS)break;
 }
 return out;
}
function defaultAttacks(tpl,shift,lang){return templateAttacks(tpl,shift,lang).map(a=>({name:a.name,base:a.base,damage:a.damage,on:a.on}))}
function attackName(a,lang){
 const l=lang==='en'?'en':'ru';
 if(typeof a?.en==='string'&&a.en)return line(l==='ru'&&window.GMTools?.WEAPONS_RU?.[a.en]||a.en,MAX_ITEM);
 if(typeof a?.cat==='string'&&a.cat){const hit=catalog('weapon').find(x=>x.id===a.cat);if(hit)return line(hit.name[l]||hit.name.en,MAX_ITEM)}
 return line(a?.name,MAX_ITEM);
}
function catalog(category){const c=typeof window!=='undefined'?window.CATALOG:null;return Array.isArray(c)?c.filter(x=>x&&x.category===category&&typeof x.id==='string'&&typeof x.name?.en==='string'):[]}
const nameOf=(x,l)=>line(x.name[l]||x.name.en,MAX_KIT_NAME);
function catalogWeapons(lang){const l=lang==='en'?'en':'ru';return catalog('weapon').filter(x=>typeof x.stats?.damage==='string'&&DICE.test(x.stats.damage)&&typeof x.stats.skill==='string').map(x=>({id:x.id,name:line(x.name[l]||x.name.en,MAX_ITEM),en:x.name.en,damage:x.stats.damage,skill:x.stats.skill}))}
function catalogNames(category,lang){const l=lang==='en'?'en':'ru';return catalog(category).map(x=>({id:x.id,name:nameOf(x,l)})).filter(x=>x.name).sort((a,b)=>a.name.localeCompare(b.name,l))}
function armorName(tpl,sp,lang){
 const l=lang==='en'?'en':'ru';
 if(!sp)return T[l].noArmor;
 // The template's own armor name while its SP is untouched, so the builder never contradicts the template card.
 if(sp===Math.max(tpl.armor.headSP,tpl.armor.bodySP)&&typeof tpl.armor.name==='string')return line(l==='ru'&&window.GMTools?.ARMOR_RU?.[tpl.armor.name]||tpl.armor.name,MAX_KIT_NAME);
 const hit=catalog('armor').find(x=>x.stats?.sp===sp);return hit?nameOf(hit,l):'';
}
function skillLabel(key,lang){return lang==='en'?key:(window.GMTools?.SKILLS_RU?.[key]||window.SKILL_LABELS?.[key]?.ru||key)}

// ---------- cyberware and gear ----------
// The templates keep the kit as one hand-written line: «Rifle Ammo x50, Shield (10 HP), Neural Link (A, B)».
// Commas inside parentheses belong to the item; a quantity is «x25» or «×25» at the end, or just before the bracket.
function splitKit(text){
 const parts=[];let depth=0,cur='';
 for(const ch of String(text??'')){if(ch==='(')depth++;else if(ch===')')depth=Math.max(0,depth-1);if(ch===','&&!depth){parts.push(cur);cur=''}else cur+=ch}
 parts.push(cur);
 const out=[];
 for(const raw of parts){
  let name=line(raw,200).replace(/\.$/,'').trim(),qty=1;
  const end=/^(.*\S)\s+[x×]\s*(\d{1,3})$/i.exec(name),mid=end?null:/^([^()]*\S)\s+[x×]\s*(\d{1,3})\s+(\(.*\))$/i.exec(name);
  if(end){name=end[1];qty=Number(end[2])}else if(mid){name=mid[1]+' '+mid[3];qty=Number(mid[2])}
  name=line(name,MAX_KIT_NAME);
  if(name)out.push({name,qty:clamp(qty,1,MAX_QTY)});
  if(out.length>=MAX_KIT)break;
 }
 return out;
}
// The Russian line is one sentence, so its items start in lower case; as separate rows of a list each one gets a
// capital letter, like the catalog items shown next to them.
function archetypeKit(tpl,lang){const ru=lang!=='en'?window.GMTools?.EQUIPMENT_RU?.[tpl.id]:null;return splitKit(typeof ru==='string'&&ru?ru:tpl.equipment).map(x=>({name:x.name.charAt(0).toLocaleUpperCase(lang==='en'?'en':'ru')+x.name.slice(1),qty:x.qty}))}
// A kit row may carry «ref»: «t:3» is the fourth item of the archetype's own kit, «c:<id>» a catalog item. With
// an archetype and a language given, such a row is named afresh for that language (see templateAttacks for why);
// both languages list an archetype's kit in the same order. A row without «ref» is text the GM typed.
const KIT_REF=/^(t:\d{1,2}|c:[\w.-]{1,80})$/;
function kitName(x,tpl,lang){
 const l=lang==='en'?'en':'ru',ref=typeof x?.ref==='string'?x.ref:'';
 if(tpl&&ref.startsWith('t:')){const hit=archetypeKit(tpl,l)[Number(ref.slice(2))];if(hit)return hit.name}
 if(tpl&&ref.startsWith('c:')){const c=typeof window!=='undefined'?window.CATALOG:null,hit=Array.isArray(c)?c.find(y=>y&&y.id===ref.slice(2)&&typeof y.name?.en==='string'):null;if(hit)return nameOf(hit,l)}
 return line(x?.name,MAX_KIT_NAME);
}
function cleanKit(kit,tpl,lang){const out=[];for(const x of Array.isArray(kit)?kit:[]){const name=kitName(x,tpl,lang);if(name){const row={name,qty:int(x?.qty,1,MAX_QTY,1)};if(typeof x.ref==='string'&&KIT_REF.test(x.ref))row.ref=x.ref;out.push(row)}if(out.length>=MAX_KIT)break}return out}
function kitText(kit){return cleanKit(kit).map(x=>x.qty>1?`${x.name} ×${x.qty}`:x.name).join(', ')}
// Plus and minus on one row. Minus on the last piece removes the row; a step that would overflow the notes is refused.
function kitStep(kit,index,delta){
 const list=cleanKit(kit),i=int(index,0,MAX_KIT,-1),d=int(delta,-1,1,0);
 if(!list[i]||!d)return list;
 const next=list.map((x,k)=>k===i?{...x,qty:clamp(x.qty+d,0,MAX_QTY)}:x).filter(x=>x.qty>0);
 return kitText(next).length>KIT_BUDGET?list:next;
}
function kitAdd(kit,name,ref){
 const list=cleanKit(kit),n=line(name,MAX_KIT_NAME),r=typeof ref==='string'&&KIT_REF.test(ref)?ref:'';
 if(!n)return {ok:false,reason:'empty',kit:list};
 const i=list.findIndex(x=>x.name.toLowerCase()===n.toLowerCase()||(r&&x.ref===r));
 if(i<0&&list.length>=MAX_KIT)return {ok:false,reason:'full',kit:list};
 const next=i<0?[...list,r?{name:n,qty:1,ref:r}:{name:n,qty:1}]:list.map((x,k)=>k===i?{...x,qty:clamp(x.qty+1,1,MAX_QTY)}:x);
 if(kitText(next).length>KIT_BUDGET)return {ok:false,reason:'long',kit:list};
 return {ok:true,kit:next,name:i<0?n:list[i].name};
}

// ---------- from the choices to a library preset ----------
function cleanRows(rows,lang){const out=[];for(const a of Array.isArray(rows)?rows:[]){const name=attackName(a,lang),base=int(a?.base,0,40,NaN),damage=typeof a?.damage==='string'?a.damage.trim().toLowerCase():'';if(name&&Number.isFinite(base)&&DICE.test(damage)){const row={name,base,damage,on:a.on!==false};if(typeof a.en==='string'&&a.en)row.en=line(a.en,80);else if(typeof a.cat==='string'&&a.cat)row.cat=line(a.cat,80);out.push(row)}if(out.length>=MAX_ATTACKS)break}return out}
// Everything the steps show, worked out from the choices: a missing choice (null) means «as the archetype has it».
function resolve(sel,lang){
 const list=archetypes(),tpl=list.find(x=>x.id===sel?.arch)||list[0];if(!tpl)return null;
 const tier=TIERS.includes(sel?.tier)?sel.tier:tpl.tier,sc=scaled(tpl,tier);
 return {tpl,tier,sc,sp:Number.isInteger(sel?.sp)?clamp(sel.sp,0,30):sc.sp,
  attacks:Array.isArray(sel?.attacks)?cleanRows(sel.attacks,lang):defaultAttacks(tpl,sc.shift,lang),
  skills:Array.isArray(sel?.skills)?sel.skills.filter((k,i,a)=>typeof k==='string'&&a.indexOf(k)===i&&!ATTACK_SKILLS.includes(k)&&skillTotal(tpl,k,sc.shift)!==null).slice(0,MAX_SKILLS):defaultSkills(tpl),
  kit:Array.isArray(sel?.kit)?cleanKit(sel.kit,tpl,lang):archetypeKit(tpl,lang)};
}
function draftOf(sel,lang){
 const l=lang==='en'?'en':'ru',t=T[l],v=resolve(sel,l);if(!v)return null;
 const kit=kitText(v.kit),origin=`${t.origin}: ${v.tpl.name[l]} · ${t.tiers[v.tier].toLowerCase()} · ${t.page} ${v.tpl.page}`,first=kit?`${t.kitLabel}: ${kit}`:'';
 // The origin line is dropped rather than cut when the kit already fills the notes.
 const notes=!first?origin:first.length+1+origin.length<=MAX_NOTES?first+'\n'+origin:first.slice(0,MAX_NOTES);
 return {name:line(sel?.nameTouched?sel.name:v.tpl.name[l],MAX_NAME),ref:v.sc.ref,body:v.sc.body,will:v.sc.will,hp:v.sc.hp,head:v.sp,torso:v.sp,
  skills:v.skills.map(k=>({name:line(skillLabel(k,l),MAX_ITEM),base:skillTotal(v.tpl,k,v.sc.shift)})),
  attacks:v.attacks.filter(a=>a.on).map(a=>({name:a.name,base:a.base,damage:a.damage})),weapons:'',notes};
}
// Writes the preset, then the copies. The preset is kept even when the roster has no room for the copies.
function save(state,sel,lang,opts={}){
 const N=typeof window!=='undefined'?window.NpcLibrary:null;
 if(!N||!state||typeof state!=='object')return {ok:false,reason:'state',added:[]};
 const draft=draftOf(sel,lang);if(!draft)return {ok:false,reason:'arch',added:[]};
 const r=N.addEntry(N.readLibrary(state),draft,opts.id);
 if(!r.ok)return {ok:false,reason:r.reason,added:[]};
 N.writeLibrary(state,r.list);
 const out={ok:true,entry:r.entry,added:[],campaignId:'',campaignName:''},copies=int(opts.copies,0,N.MAX_COPIES,0);
 const c=copies&&Array.isArray(state.campaigns)?state.campaigns.find(x=>x&&x.id===opts.campaignId&&Array.isArray(x.roster)):null;
 if(c){const a=N.addToCampaign(c,r.entry,copies,lang,opts.uid||uid,opts.now);if(a.ok){out.added=a.added;out.campaignId=c.id;out.campaignName=line(c.name,80)||'—'}else out.rosterFull=true}
 return out;
}
// What undo needs to know about one save: the ids, and a picture of the preset and of each row as they were made.
function receiptOf(r){return {entryId:r.entry.id,campaignId:r.campaignId,rowIds:r.added.map(x=>x.id),entry:JSON.stringify(r.entry),rows:Object.fromEntries(r.added.map(x=>[x.id,rowMark(x)]))}}
// Initiative is left out of a row's picture: rolling it for the whole table is one press, not work to protect.
function rowMark(row){const {initiative,ties,...rest}=row||{};return JSON.stringify(rest)}
// The same order as the tracker's own list (campaigns.js), which turnIndex counts in.
function turnOrder(roster){return [...roster].sort((a,b)=>{let n=(Number(b?.initiative)||0)-(Number(a?.initiative)||0);if(n)return n;const x=a?.ties||[],y=b?.ties||[];for(let i=0;i<Math.max(x.length,y.length);i++){n=(Number(y[i])||0)-(Number(x[i])||0);if(n)return n}return (Number(a?.order)||0)-(Number(b?.order)||0)})}
// Takes back exactly what one save made: that preset, and the rows with its ids that still point at it. Rows the
// GM added from the same preset later have other ids and stay. A preset or campaign that is already gone is fine.
// This undo has no undo of its own, so it only removes what is still as the save left it: a preset the GM has
// edited since, or a copy whose HP or notes were touched, stays where it is and is counted in the answer.
function undo(state,receipt){
 const N=typeof window!=='undefined'?window.NpcLibrary:null,id=receipt?.entryId,none={ok:false,removedRows:0,keptEntry:false,keptRows:0};
 if(!N||!state||typeof state!=='object'||typeof id!=='string')return none;
 const lib=N.readLibrary(state),now=lib.find(x=>x.id===id),keptEntry=!!now&&typeof receipt.entry==='string'&&JSON.stringify(now)!==receipt.entry;
 const r=keptEntry?{ok:false}:N.removeEntry(lib,id);if(r.ok)N.writeLibrary(state,r.list);
 const ids=new Set(Array.isArray(receipt.rowIds)?receipt.rowIds:[]),marks=receipt.rows&&typeof receipt.rows==='object'?receipt.rows:null,c=Array.isArray(state.campaigns)?state.campaigns.find(x=>x&&x.id===receipt.campaignId&&Array.isArray(x.roster)):null;
 let removedRows=0,keptRows=0;
 if(c&&ids.size){
  const ours=row=>!!row&&ids.has(row.id)&&row.sourceLibrary===id,same=row=>!marks||typeof marks[row.id]!=='string'||rowMark(row)===marks[row.id];
  // The tracker counts the turn in initiative order, so the active combatant is found again by id afterwards,
  // the way the tracker's own «remove» does it; a plain clamp could hand the turn to somebody else.
  const index=Number.isInteger(c.turnIndex)?c.turnIndex:null,activeId=index===null?null:turnOrder(c.roster)[index]?.id;
  const keep=c.roster.filter(row=>!(ours(row)&&same(row)));removedRows=c.roster.length-keep.length;keptRows=c.roster.filter(row=>ours(row)&&!same(row)).length;
  if(removedRows){c.roster=keep;if(index!==null){const at=turnOrder(keep).findIndex(x=>x&&x.id===activeId);c.turnIndex=at>=0?at:Math.min(index,Math.max(0,keep.length-1))}}
 }
 return {ok:r.ok||removedRows>0,removedRows,keptEntry,keptRows};
}

// ---------- UI ----------
const FRESH=()=>({open:false,step:0,arch:'',tier:null,name:'',nameTouched:false,sp:null,attacks:null,skills:null,kit:null,count:1,campaign:'',pick:{weapon:'',cyber:'',gear:''},own:'',status:''});
let ui=FRESH();
function campaignsOf(st){return st&&Array.isArray(st.campaigns)?st.campaigns.filter(c=>c&&typeof c.id==='string'&&Array.isArray(c.roster)):[]}
function copiesOf(campaigns){return campaigns.length?int(ui.count,0,window.NpcLibrary?.MAX_COPIES||20,1):0}
const saveLabel=(t,n)=>n>0?t.saveAdd(n):t.saveLib;
// Plus and minus stay focusable at their limit (aria-disabled, not disabled): a re-render must not drop the focus.
function pm(action,d,label,off,focus,extra=''){return `<button type="button" class="btn ghost nb-pm" data-nb-action="${action}" data-nb-d="${d}"${extra} aria-label="${esc(label)}"${off?' aria-disabled="true"':''} data-nb-focus="${esc(focus)}">${d<0?'−':'+'}</button>`}
function summary(v){return `<p class="nb-sum" data-nb-summary><span>REF ${v.sc.ref}</span><span>BODY ${v.sc.body}</span><span>WILL ${v.sc.will}</span><span>HP ${v.sc.hp}</span><span>SP ${v.sp}</span></p>`}
function stepWho(v,t,l){
 const tierOf=x=>`${t.level}: ${t.tiers[x.tier].toLowerCase()} · ${t.page} ${esc(x.page)}`;
 return `<fieldset class="nb-set"><legend>${esc(t.arch)}</legend><div class="nb-options">${archetypes().map(x=>`<label class="nb-option"><input type="radio" name="nb-arch" data-nb-field="arch" data-nb-focus="arch:${esc(x.id)}" value="${esc(x.id)}"${x.id===v.tpl.id?' checked':''}><span><strong>${esc(x.name[l])}</strong><small>${esc(tierOf(x))}</small></span></label>`).join('')}</div></fieldset>`
  +`<fieldset class="nb-set"><legend>${esc(t.tier)}</legend><div class="nb-options nb-tiers">${TIERS.map(k=>`<label class="nb-option"><input type="radio" name="nb-tier" data-nb-field="tier" data-nb-focus="tier:${k}" value="${k}"${k===v.tier?' checked':''}><span><strong>${esc(t.tiers[k])}</strong>${k===v.tpl.tier?`<small>${esc(t.native)}</small>`:''}</span></label>`).join('')}</div><p class="nb-note">${esc(t.tierHint)}</p><p class="nb-note">${esc(t.resetHint)}</p></fieldset>`
  +`<label class="field nb-field">${esc(t.name)}<input type="text" maxlength="${MAX_NAME}" data-nb-field="name" data-nb-focus="name" value="${esc(ui.nameTouched?ui.name:v.tpl.name[l])}"></label>`
  +`<div class="nb-block"><h4>${esc(t.numbers)}</h4>${summary(v)}</div>`;
}
function stepFight(v,t,l){
 const label=armorName(v.tpl,v.sp,l),weapons=catalogWeapons(l),pick=weapons.some(w=>w.id===ui.pick.weapon)?ui.pick.weapon:weapons[0]?.id,fullA=v.attacks.filter(a=>a.on).length>=MAX_ATTACKS,keys=skillKeys(v.tpl);
 return `<div class="nb-block"><h4>${esc(t.numbers)}</h4>${summary(v)}</div>`
  +`<div class="nb-block"><h4>${esc(t.armor)}</h4><div class="nb-stepper" role="group" aria-label="${esc(t.armorGroup)}">${pm('sp',-1,t.weaker,v.sp<=ARMOR_LADDER[0],'sp:-1')}<span class="nb-value" data-nb-sp>SP ${v.sp}${label?' · '+esc(label):''}</span>${pm('sp',1,t.stronger,v.sp>=ARMOR_LADDER[ARMOR_LADDER.length-1],'sp:1')}</div>${v.sp>=12?`<p class="nb-note">${esc(t.heavy)}</p>`:''}</div>`
  +`<div class="nb-block"><h4>${esc(t.weapons)} · ${v.attacks.filter(a=>a.on).length}/${MAX_ATTACKS}</h4><p class="nb-note">${esc(t.weaponsHint)}</p><div class="nb-chips">${v.attacks.map((a,i)=>`<button type="button" class="nb-chip" data-nb-action="attack" data-nb-i="${i}" data-nb-focus="attack:${i}" aria-pressed="${a.on?'true':'false'}">${esc(a.name)} · +${a.base} · ${esc(a.damage)}</button>`).join('')}</div>`
  +(weapons.length?`<div class="nb-add"><label class="field nb-field">${esc(t.weaponPick)}<select data-nb-field="addWeapon" data-nb-focus="addWeapon">${weapons.map(w=>`<option value="${esc(w.id)}"${w.id===pick?' selected':''}>${esc(w.name)} · ${esc(w.damage)}</option>`).join('')}</select></label><button type="button" class="btn ghost" data-nb-action="add-weapon" data-nb-focus="add-weapon"${fullA?' aria-disabled="true"':''}>${esc(t.addWeapon)}</button></div>`:'')+`</div>`
  +`<div class="nb-block"><h4>${esc(t.skills)} · ${v.skills.length}/${MAX_SKILLS}</h4><div class="nb-chips">${keys.map(k=>`<button type="button" class="nb-chip" data-nb-action="skill" data-nb-key="${esc(k)}" data-nb-focus="skill:${esc(k)}" aria-pressed="${v.skills.includes(k)?'true':'false'}">${esc(skillLabel(k,l))} +${skillTotal(v.tpl,k,v.sc.shift)}</button>`).join('')}</div></div>`;
}
function addRow(t,field,label,button,list,pick){
 if(!list.length)return '';
 const sel=list.some(x=>x.id===pick)?pick:list[0].id;
 return `<div class="nb-add"><label class="field nb-field">${esc(label)}<select data-nb-field="${field}" data-nb-focus="${field}">${list.map(x=>`<option value="${esc(x.id)}"${x.id===sel?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label><button type="button" class="btn ghost" data-nb-action="${field==='addCyber'?'add-cyber':'add-gear'}" data-nb-focus="${field}-btn" aria-label="${esc(button)}">${esc(t.add)}</button></div>`;
}
function stepKit(v,t,l){
 return `<p class="nb-note">${esc(t.kitHint)}</p><div class="nb-block"><h4>${esc(t.kitCount)} · ${v.kit.length}/${MAX_KIT}</h4>${v.kit.length?`<ul class="nb-kit">${v.kit.map((x,i)=>`<li><span class="nb-kit-name">${esc(x.name)}</span><span class="nb-stepper">${pm('kit',-1,t.less(x.name),false,`kit:${i}:-1`,` data-nb-i="${i}"`)}<span class="nb-value nb-qty">×${x.qty}</span>${pm('kit',1,t.more(x.name),x.qty>=MAX_QTY,`kit:${i}:1`,` data-nb-i="${i}"`)}</span></li>`).join('')}</ul>`:`<p class="nb-note">${esc(t.kitEmpty)}</p>`}<div class="nb-row"><button type="button" class="btn ghost" data-nb-action="kit-reset" data-nb-focus="kit-reset">${esc(t.kitReset)}</button></div></div>`
  +`<div class="nb-block">${addRow(t,'addCyber',t.addCyber,t.addCyberBtn,catalogNames('cyberware',l),ui.pick.cyber)}${addRow(t,'addGear',t.addGear,t.addGearBtn,catalogNames('gear',l),ui.pick.gear)}<div class="nb-add"><label class="field nb-field">${esc(t.own)}<input type="text" maxlength="${MAX_KIT_NAME}" data-nb-field="own" data-nb-focus="own" value="${esc(ui.own)}"></label><button type="button" class="btn ghost" data-nb-action="add-own" data-nb-focus="add-own" aria-label="${esc(t.addOwn)}">${esc(t.add)}</button></div><p class="nb-note">${esc(t.kitNote)}</p></div>`;
}
function stepReview(v,t,l){
 const d=draftOf(ui,l),campaigns=campaignsOf(appState()),sel=campaigns.some(c=>c.id===ui.campaign)?ui.campaign:(campaigns[0]?.id||''),n=copiesOf(campaigns),max=window.NpcLibrary?.MAX_COPIES||20;
 const preview=`<div class="nl-entry nb-preview" data-nb-preview><div class="nl-head"><strong>${esc(d.name||'—')}</strong><span class="nb-mono">REF ${d.ref} · HP ${d.hp} · BODY/WILL ${d.body}/${d.will} · SP ${d.head}/${d.torso}</span></div>${d.attacks.length?`<p class="nl-text"><b>${esc(t.attacks)}:</b> ${esc(d.attacks.map(a=>`${a.name} +${a.base} ${a.damage}`).join('; '))}</p>`:''}${d.skills.length?`<p class="nl-text"><b>${esc(t.skills)}:</b> ${esc(d.skills.map(x=>`${x.name} +${x.base}`).join(', '))}</p>`:''}<p class="nl-text"><b>${esc(t.notes)}:</b> ${esc(d.notes)}</p></div>`;
 const where=campaigns.length?`<div class="nb-where"><label class="field nb-field">${esc(t.campaign)}<select data-nb-field="campaign" data-nb-focus="campaign">${campaigns.map(c=>`<option value="${esc(c.id)}"${c.id===sel?' selected':''}>${esc(c.name||'—')}</option>`).join('')}</select></label><div class="nb-count"><label class="field nb-field" for="nb-count">${esc(t.count)}</label><div class="nb-stepper">${pm('count',-1,t.fewer,n<=0,'count:-1')}<input id="nb-count" type="number" inputmode="numeric" min="0" max="${max}" data-nb-field="count" data-nb-focus="count" value="${n}">${pm('count',1,t.moreCopies,n>=max,'count:1')}</div></div></div><p class="nb-note">${esc(t.countHint(d.name||v.tpl.name[l]))}</p>`:`<p class="nb-note">${esc(t.noCampaign)}</p>`;
 return `<div class="nb-block"><h4>${esc(t.preview)}</h4>${preview}</div><div class="nb-block">${where}</div>`;
}
function render(lang){
 const l=lang==='en'?'en':'ru',t=T[l],N=typeof window!=='undefined'?window.NpcLibrary:null,v=N?resolve(ui,l):null;
 if(!v)return '';
 const open=`<section class="card gx-card nb-card" id="gx-npc-builder" data-gx-section="npcbuilder" data-nb-root data-lang="${l}"><div class="card-heading"><span>${esc(t.title)}</span><span>${esc(t.sub)}</span></div>`,status=`<p class="nb-note nb-status" role="status" data-nb-status></p>`;
 if(!ui.open)return `${open}<p class="nb-note">${esc(t.intro)}</p>${N.readLibrary(appState()).length>=N.MAX?`<p class="nb-note" tabindex="-1" data-nb-focus="@heading">${esc(t.full)}</p>`:`<div class="nb-row"><button type="button" class="btn primary" data-nb-action="open" data-nb-focus="open">${esc(t.open)}</button></div>`}${status}</section>`;
 const s=clamp(ui.step,0,3),n=copiesOf(campaignsOf(appState()));
 const steps=`<ol class="nb-steps" aria-label="${esc(t.stepsLabel)}">${t.steps.map((name,i)=>`<li${i===s?' class="nb-here" aria-current="step"':''}>${i<s?`<button type="button" class="nb-step" data-nb-action="goto" data-nb-step="${i}" data-nb-focus="goto:${i}"><b>${i+1}</b><span>${esc(name)}</span></button>`:`<span class="nb-step"><b>${i+1}</b><span>${esc(name)}</span></span>`}</li>`).join('')}</ol>`;
 const body=[stepWho,stepFight,stepKit,stepReview][s](v,t,l);
 const foot=`<div class="nb-row nb-foot">${s>0?`<button type="button" class="btn ghost" data-nb-action="back" data-nb-focus="back">${esc(t.back)}</button>`:''}${s<3?`<button type="button" class="btn primary" data-nb-action="next" data-nb-focus="next">${esc(t.next)}</button>`:`<button type="button" class="btn primary" data-nb-action="save" data-nb-focus="save">${esc(saveLabel(t,n))}</button>`}<button type="button" class="btn ghost" data-nb-action="close" data-nb-focus="close">${esc(t.close)}</button></div>`;
 return `${open}${steps}<h3 class="nb-title" tabindex="-1" data-nb-heading data-nb-focus="@heading">${esc(t.stepOf(s+1,t.steps[s]))}</h3><div class="nb-body" data-nb-step-body="${s}">${body}</div>${status}${foot}</section>`;
}
// Redraws the card, says the pending status line in the live region, and puts the focus back: on the control with
// the same key, or on the step heading when the step changed or that control is gone.
function rerender(root,lang,focus){
 const status=ui.status;ui.status='';
 if(!root||typeof root.outerHTML!=='string'||root.isConnected===false)return;
 const doc=typeof document!=='undefined'?document:null,active=doc?.activeElement,key=focus||(active&&root.contains?.(active)?active.dataset?.nbFocus:null);
 root.outerHTML=render(lang);
 const fresh=doc?.querySelector?.('[data-nb-root]');if(!fresh)return;
 const say=fresh.querySelector('[data-nb-status]');if(say&&status)say.textContent=status;
 if(!key)return;
 const all=[...fresh.querySelectorAll('[data-nb-focus]')];
 (all.find(el=>el.dataset.nbFocus===key)||all.find(el=>el.dataset.nbFocus==='@heading')||all[0])?.focus?.();
}
function redrawLibrary(lang){
 const doc=typeof document!=='undefined'?document:null,lib=doc?.querySelector?.('[data-nl-root]');
 if(lib&&lib.isConnected!==false&&typeof lib.outerHTML==='string'){try{lib.outerHTML=window.NpcLibrary.render(lang)}catch(_){}return true}
 return false;
}
// The first change of armor, weapons, skills or kit turns «as the archetype has it» into the GM's own list.
// Rows taken from the archetype keep a reference to it, and a list that is already the GM's is read again for the
// current language first, so names never stay behind in the language the list was started in.
function own(key,lang){
 const v=resolve(ui,lang);
 if(key==='skills'){if(!Array.isArray(ui.skills))ui.skills=v.skills.slice()}
 else if(key==='attacks')ui.attacks=Array.isArray(ui.attacks)?v.attacks:templateAttacks(v.tpl,v.sc.shift,lang);
 else ui[key]=Array.isArray(ui[key])?v[key]:v[key].map((x,i)=>({...x,ref:'t:'+i}));
 return ui[key];
}
function addToKit(name,t,lang,ref){
 const r=kitAdd(own('kit',lang),name,ref);
 if(r.ok){ui.kit=r.kit;ui.status=t.added(r.name)}else ui.status=r.reason==='full'?t.kitFull:r.reason==='long'?t.kitLong:'';
 return r.ok;
}
function commitSave(root,t,l){
 const st=appState(),campaigns=campaignsOf(st),campaignId=campaigns.some(c=>c.id===ui.campaign)?ui.campaign:(campaigns[0]?.id||'');
 const r=st?save(st,ui,l,{copies:copiesOf(campaigns),campaignId}):{ok:false,reason:'state'};
 if(!r.ok){
  if(r.reason==='name'){ui.step=0;ui.status=t.needName;return 'name'}
  ui.status=r.reason==='full'?t.full:'';return 'save';
 }
 try{window.App.save()}catch(_){}
 const receipt=receiptOf(r);
 const message=[t.saved(r.entry.name),r.added.length?t.savedAdded(r.campaignName,r.added.map(x=>x.name).join(', ')):'',r.rosterFull?t.rosterFull:''].filter(Boolean).join(' ');
 ui=FRESH();
 const back=()=>{
  const now=appState();if(!now)return;
  const u=undo(now,receipt);try{window.App.save()}catch(_){}
  const lang=window.App?.lang?.()||l,tt=T[lang==='en'?'en':'ru'],card=typeof document!=='undefined'?document.querySelector?.('[data-nb-root]'):null;
  // On the GM screen the two cards are redrawn in place; anywhere else (the tracker, say) the whole view is.
  if(redrawLibrary(lang)){if(card)rerender(card,lang)}else{try{window.App.render?.()}catch(_){}}
  // What was changed after the save is named, so «undone» never hides that something stayed.
  const kept=[u.keptEntry?tt.keptEntry:'',u.keptRows?tt.keptRows(u.keptRows):''].filter(Boolean);
  try{window.App.notify([u.ok||!kept.length?tt.undone:'',...kept].filter(Boolean).join(' '))}catch(_){}
 };
 try{if(typeof window.App.notifyAction==='function')window.App.notifyAction(message,t.undo,back,15000);else window.App.notify(message)}catch(_){}
 return 'open';
}
// Returns the focus key for the redraw (true-ish), or '' when nothing changed.
function act(a,b,root,l){
 const t=T[l],ds=b?.dataset||{},off=b?.getAttribute?.('aria-disabled')==='true';
 switch(a){
  case 'open':if(!ui.arch)ui.arch=archetypes()[0]?.id||'';ui.open=true;return '@heading';
  case 'close':ui.open=false;return 'open';
  case 'next':ui.step=clamp(ui.step+1,0,3);return '@heading';
  case 'back':ui.step=clamp(ui.step-1,0,3);return '@heading';
  case 'goto':ui.step=int(ds.nbStep,0,3,ui.step);return '@heading';
  case 'sp':{const v=resolve(ui,l),d=int(ds.nbD,-1,1,0);if(!off&&d)ui.sp=ladderStep(v.sp,d);return `sp:${d}`}
  case 'attack':{const rows=own('attacks',l),i=int(ds.nbI,0,MAX_ATTACKS,-1);if(rows[i])rows[i].on=!rows[i].on;return `attack:${i}`}
  case 'add-weapon':{
   const rows=own('attacks',l),v=resolve(ui,l),id=root?.querySelector?.('[data-nb-field="addWeapon"]')?.value||ui.pick.weapon,w=catalogWeapons(l).find(x=>x.id===id)||catalogWeapons(l)[0];
   if(!w)return 'add-weapon';
   const same=rows.find(x=>x.cat===w.id||x.name.toLowerCase()===w.name.toLowerCase()),fresh={name:w.name,base:attackBase(v.tpl,w.en,v.sc.shift,w.skill),damage:w.damage.toLowerCase(),on:true,cat:w.id};
   // The limit is on weapons in the preset. A switched-off row cannot be deleted by hand, so when all six rows
   // are taken the new weapon replaces the first switched-off one instead of being refused.
   const spare=rows.length>=MAX_ATTACKS?rows.findIndex(x=>!x.on):-1;
   if(same){same.on=true;ui.status=t.added(same.name)}
   else if(rows.length<MAX_ATTACKS){rows.push(fresh);ui.status=t.added(w.name)}
   else if(spare>=0){const gone=rows.splice(spare,1)[0];rows.push(fresh);ui.status=t.added(w.name)+' '+t.removed(gone.name)}
   else ui.status=t.attacksFull;
   return 'add-weapon'}
  case 'skill':{
   const v=resolve(ui,l),key=ds.nbKey,list=own('skills',l),i=list.indexOf(key);
   if(i>=0)list.splice(i,1);else if(skillTotal(v.tpl,key,v.sc.shift)===null||ATTACK_SKILLS.includes(key))return '';
   else if(list.length>=MAX_SKILLS)ui.status=t.skillsFull;else list.push(key);
   return `skill:${key}`}
  case 'kit':{
   const kit=own('kit',l),i=int(ds.nbI,0,MAX_KIT,-1),d=int(ds.nbD,-1,1,0),row=kit[i];if(!row||!d||off)return `kit:${i}:${d}`;
   const next=kitStep(kit,i,d);
   if(next.length<kit.length)ui.status=t.removed(row.name);else if(d>0&&next[i].qty===row.qty)ui.status=t.kitLong;
   ui.kit=next;return next.length<kit.length?'kit-reset':`kit:${i}:${d}`}
  case 'kit-reset':ui.kit=null;ui.status=t.kitBack;return 'kit-reset';
  case 'add-cyber':case 'add-gear':{
   const cyber=a==='add-cyber',field=cyber?'addCyber':'addGear',list=catalogNames(cyber?'cyberware':'gear',l),id=root?.querySelector?.(`[data-nb-field="${field}"]`)?.value||ui.pick[cyber?'cyber':'gear'],x=list.find(y=>y.id===id)||list[0];
   if(x)addToKit(x.name,t,l,'c:'+x.id);return field+'-btn'}
  case 'add-own':{const typed=root?.querySelector?.('[data-nb-field="own"]')?.value??ui.own;if(line(typed,MAX_KIT_NAME)&&addToKit(typed,t,l))ui.own='';return 'own'}
  case 'count':{const d=int(ds.nbD,-1,1,0);ui.count=clamp(copiesOf(campaignsOf(appState()))+d,0,window.NpcLibrary?.MAX_COPIES||20);return `count:${d}`}
  case 'save':return commitSave(root,t,l);
 }
 return '';
}
function handle(e,lang){
 const target=e?.target,root=target?.closest?.('[data-nb-root]');
 if(!root||root.isConnected===false)return false;
 const l=(lang||window.App?.lang?.()||root.dataset?.lang)==='en'?'en':'ru',ds=target.dataset||{},f=ds.nbField;
 if(e.type==='input'||e.type==='change'){
  if(!f)return false;
  // Typing never redraws the card: a redraw in the middle of a word would move the caret, and one between a
  // field losing the focus and the click that follows would swallow the click.
  if(f==='name'){ui.name=String(target.value??'').slice(0,MAX_NAME);ui.nameTouched=true;return true}
  if(f==='own'){ui.own=String(target.value??'').slice(0,MAX_KIT_NAME);return true}
  if(f==='addWeapon'){ui.pick.weapon=String(target.value??'');return true}
  if(f==='addCyber'){ui.pick.cyber=String(target.value??'');return true}
  if(f==='addGear'){ui.pick.gear=String(target.value??'');return true}
  if(f==='campaign'){ui.campaign=String(target.value??'');return true}
  if(f==='count'){
   ui.count=int(String(target.value??''),0,window.NpcLibrary?.MAX_COPIES||20,0);
   const b=root.querySelector?.('[data-nb-action="save"]');if(b)b.textContent=saveLabel(T[l],copiesOf(campaignsOf(appState())));
   return true}
  if(e.type!=='change'||(f!=='arch'&&f!=='tier'))return false;
  if(f==='arch'){if(!archetypes().some(x=>x.id===target.value))return false;ui.arch=target.value}
  else{if(!TIERS.includes(target.value))return false;ui.tier=target.value}
  // The later steps follow the new archetype or level; a name the GM typed stays.
  ui.sp=null;ui.attacks=null;ui.skills=null;ui.kit=null;
  if(!ui.nameTouched||!line(ui.name,MAX_NAME)){ui.name='';ui.nameTouched=false}
  rerender(root,l,`${f}:${target.value}`);return true;
 }
 if(e.type!=='click')return false;
 const b=target.closest('[data-nb-action]');if(!b)return false;
 const focus=act(b.dataset.nbAction,b,root,l);if(!focus)return false;
 rerender(root,l,focus);
 if(b.dataset.nbAction==='save'&&focus==='open')redrawLibrary(l);
 return true;
}
function reset(){ui=FRESH()}
if(typeof document!=='undefined'&&document.addEventListener){for(const type of ['click','change','input'])document.addEventListener(type,e=>{handle(e)})}
window.NpcBuilder={TIERS,ARMOR_LADDER,STEP,MAX_KIT,MAX_KIT_NAME,MAX_QTY,KIT_BUDGET,SKILL_PRIORITY,archetypes,shiftOf,ladderStep,scaled,skillTotal,defaultSkills,attackBase,defaultAttacks,catalogWeapons,splitKit,archetypeKit,kitStep,kitAdd,kitText,resolve,draftOf,save,receiptOf,undo,render,handle,reset,_state:()=>JSON.parse(JSON.stringify(ui))};
})();
