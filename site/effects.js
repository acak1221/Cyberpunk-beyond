/* One place for what is acting on a character right now. Sheet tools record things (Critical
   Injuries, installed cyberware, drugs); this module turns the recorded state into numbers the
   rolls and the sheet use: a modifier to every check, to melee or ranged attacks, to MOVE, and
   the Base Death Save Penalty the injuries call for. Effects that depend on the situation
   (a hand, speech, hearing) are listed as reminders and never applied silently.
   Critical Injuries: Corebook pp. 187–188. A Quick Fix or Treatment takes the effect away.
   Cyberware: pp. 110–116, 358–364. Only effects that are always on and name what they change are
   applied; the rest are reminders. More than one of the same implant never stacks. */
(function(){
'use strict';
// By table and 2d6 score: all = every check, melee/ranged = attacks of that kind, move = MOVE, death = Base Death Save Penalty.
// note = a situational effect to keep in mind, in both languages.
const INJURY={
 body:{
  2:{death:1},3:{death:1},4:{move:-2,death:1},
  5:{note:['Более 4 м пешком за ход: снова 5 урона','Over 4 m on foot in a turn: 5 damage again']},
  6:{note:['Рука не действует','The arm cannot be used']},
  7:{note:['Более 4 м пешком за ход: снова 5 урона','Over 4 m on foot in a turn: 5 damage again']},
  8:{move:-4},9:{melee:-2},
  10:{death:1,note:['Следующий ход без Action','No Action next turn']},
  11:{note:['−4 к действиям этой кистью','−4 to Actions with that hand']},
  12:{move:-6,death:1,note:['Уклоняться нельзя','Cannot dodge']},
 },
 head:{
  2:{ranged:-4,death:1,note:['−4 к зрительному Восприятию','−4 to Perception by sight']},
  3:{all:-2,death:1},
  4:{ranged:-2,note:['−2 к зрительному Восприятию','−2 to Perception by sight']},
  5:{all:-2},
  6:{note:['−4 к действиям, требующим речи','−4 to Actions that need speech']},
  7:{note:['Более 4 м пешком за ход: снова 5 урона','Over 4 m on foot in a turn: 5 damage again']},
  8:{death:1},
  9:{death:1,note:['Прицельный урон в голову сквозь броню ×3','Aimed head damage through armor ×3']},
  10:{note:['−2 к Восприятию на слух; после 4 м пешком — ход без движения','−2 to Perception by hearing; after 4 m on foot, no Move next turn']},
  11:{death:1,note:['Говорить нельзя','Cannot speak']},
  12:{death:1,note:['−4 к Восприятию на слух; после 4 м пешком — ход без движения','−4 to Perception by hearing; after 4 m on foot, no Move next turn']},
 },
};
// Installed cyberware by catalog id. initiative = added to Initiative; ignoreSerious = no Seriously Wounded penalty;
// skills = bonus to checks of the named Skills; note = a reminder for effects that depend on the situation or change the sheet.
const TECH_SKILLS=['Basic Tech','Cybertech','Land Vehicle Tech','Sea Vehicle Tech','Air Vehicle Tech','Electronics/Security Tech','Weaponstech'];
const CYBER={
 'cyberware-kerenzikov':{initiative:2},
 'cyberware-pain-editor':{ignoreSerious:true},
 'cyberware-toxin-binders':{skills:{'Resist Torture/Drugs':2}},
 'cyberware-voice-stress-analyzer':{skills:{'Human Perception':2,'Interrogation':2}},
 'cyberware-medscanner-implant':{skills:{'First Aid':2,'Paramedic':2}},
 'cyberware-techscanner-implant':{skills:Object.fromEntries(TECH_SKILLS.map(k=>[k,2]))},
 'cyberware-sandevistan':{note:['+3 к инициативе на минуту после включения (Action), затем час перезарядки','+3 Initiative for a minute once activated (an Action), then an hour of cooldown']},
 'cyberware-targeting-scope':{note:['+1 к прицельным выстрелам','+1 to Aimed Shots']},
 'cyberware-image-enhance':{note:['+2 к Восприятию, чтению по губам и поиску предметов, когда нужно зрение','+2 to Perception, Lip Reading and Conceal/Reveal Object by sight']},
 'cyberware-amplified-hearing':{note:['+2 к Восприятию на слух','+2 to Perception by hearing']},
 'cyberware-grafted-muscle-and-bone-lace':{note:['BODY +2, но не выше 10: поправьте BODY на листе — HP и Death Save пересчитаются','BODY +2, up to 10: change BODY on the sheet and HP and the Death Save follow']},
 'cyberware-implanted-linear-frame-sigma':{note:['BODY 12: поправьте BODY на листе','BODY 12: change BODY on the sheet']},
 'cyberware-implanted-linear-frame-beta':{note:['BODY 14: поправьте BODY на листе','BODY 14: change BODY on the sheet']},
 'cyberware-skin-weave':{note:['SP 7 на голове и теле; в каждой зоне действует наибольший SP','SP 7 on head and body; the highest SP in each location counts']},
 'cyberware-subdermal-armor':{note:['SP 11 на голове и теле; в каждой зоне действует наибольший SP','SP 11 on head and body; the highest SP in each location counts']},
};
const RANGED=new Set(['Handgun','Shoulder Arms','Heavy Weapons','Archery','Autofire']);
const MELEE=new Set(['Brawling','Melee Weapon','Martial Arts']);
const isObject=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function injuryName(location,score,lang){const row=globalThis.window?.CombatTools?.INJURIES?.[location]?.[score-2];return row?row[lang==='en'?'en':'ru']:''}
// Critical Injuries whose effect is in force: recorded, not healed, and not under a Quick Fix.
function activeInjuries(c){
 const x=c?.extra?.criticalInjuries,out=[];
 if(!isObject(x)||x.version!==1||!Array.isArray(x.entries))return out;
 for(const r of x.entries){if(isObject(r)&&r.status==='active'&&INJURY[r.location]?.[r.score])out.push({location:r.location,score:r.score,effect:INJURY[r.location][r.score]})}
 return out;
}
// Cyberware that is installed now, one entry per kind of implant.
function installedCyber(c){
 const list=c?.extra?.equipment?.installs,seen=new Set(),out=[];
 if(!Array.isArray(list))return out;
 for(const i of list){if(!isObject(i)||i.removedAt||typeof i.catalogId!=='string'||!CYBER[i.catalogId]||seen.has(i.catalogId))continue;seen.add(i.catalogId);out.push({id:i.catalogId,effect:CYBER[i.catalogId]})}
 return out;
}
function catalogName(id,lang){const item=(Array.isArray(globalThis.window?.CATALOG)?globalThis.window.CATALOG:[]).find(x=>x?.id===id),name=item?.name;return typeof name==='string'?name:name?.[lang==='en'?'en':'ru']||name?.en||id}
// Everything in force, summed. `sources` lists each one for the sheet: {kind, name:{ru,en}, parts:{...}, note}.
function collect(c){
 const total={all:0,melee:0,ranged:0,move:0,death:0,initiative:0,ignoreSerious:false,skills:{},sources:[]};
 for(const i of installedCyber(c)){
  const e=i.effect;total.initiative+=e.initiative||0;if(e.ignoreSerious)total.ignoreSerious=true;
  for(const [skill,bonus] of Object.entries(e.skills||{}))total.skills[skill]=Math.max(total.skills[skill]||0,bonus);
  total.sources.push({kind:'cyber',name:{ru:catalogName(i.id,'ru'),en:catalogName(i.id,'en')},parts:e,note:e.note||null});
 }
 for(const i of activeInjuries(c)){
  const e=i.effect;for(const k of ['all','melee','ranged','move','death'])total[k]+=e[k]||0;
  total.sources.push({kind:'injury',name:{ru:injuryName(i.location,i.score,'ru'),en:injuryName(i.location,i.score,'en')},parts:e,note:e.note||null});
 }
 return total;
}
// What a weapon's attack skill makes the attack: 'melee', 'ranged' or '' when it cannot be told.
function attackKind(skill){return RANGED.has(skill)?'ranged':MELEE.has(skill)||/^martial arts/i.test(String(skill||''))?'melee':''}
// The modifier the effects add to a check; `kind` is 'melee' or 'ranged' for an attack, `skill` the Skill being rolled.
function checkModifier(c,kind,skill){const t=collect(c);return t.all+(kind==='melee'?t.melee:kind==='ranged'?t.ranged:0)+(skill&&Object.hasOwn(t.skills,skill)?t.skills[skill]:0)}
const initiative=c=>collect(c).initiative,ignoresSerious=c=>collect(c).ignoreSerious;
function move(c,base){const n=Number(base);if(!Number.isFinite(n))return base;const delta=collect(c).move;return delta?Math.max(1,n+delta):n}
const signed=n=>(n<0?'−':'+')+Math.abs(n);
// Short lines for the sheet, one per source: «Сотрясение: −2 ко всем действиям».
function lines(c,lang){
 const ru=lang!=='en',i=ru?0:1;
 return collect(c).sources.map(s=>{
  const p=s.parts,bits=[];
  if(p.all)bits.push(signed(p.all)+(ru?' ко всем действиям':' to all Actions'));
  if(p.melee)bits.push(signed(p.melee)+(ru?' к атакам ближнего боя':' to melee attacks'));
  if(p.ranged)bits.push(signed(p.ranged)+(ru?' к дальним атакам':' to ranged attacks'));
  if(p.move)bits.push('MOVE '+signed(p.move));
  if(p.death)bits.push((ru?'базовый штраф Death Save ':'Base Death Save Penalty ')+signed(p.death));
  if(p.initiative)bits.push(signed(p.initiative)+(ru?' к инициативе':' to Initiative'));
  if(p.ignoreSerious)bits.push(ru?'штраф тяжёлого ранения не действует':'no Seriously Wounded penalty');
  if(p.skills){const by=new Map();for(const [skill,bonus] of Object.entries(p.skills)){if(!by.has(bonus))by.set(bonus,[]);by.get(bonus).push(globalThis.window?.SKILL_LABELS?.[skill]?.[ru?'ru':'en']||skill)}for(const [bonus,names] of by)bits.push(signed(bonus)+(ru?' к навыкам: ':' to Skills: ')+names.join(', '))}
  if(s.note)bits.push(s.note[i]);
  return {name:s.name[ru?'ru':'en']||'',text:bits.join('; ')};
 });
}
window.Effects={INJURY,CYBER,activeInjuries,installedCyber,collect,attackKind,checkModifier,initiative,ignoresSerious,move,lines};
})();
