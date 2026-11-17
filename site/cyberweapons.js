/* Cyberware weapons in a fight (Corebook pp. 363–366, 114).
   A table maps the installed cyberware weapons already in the catalog to their attack data: the dice, the ROF and the skill.
   Every number is the one the catalog text of that item states, and the skill is the one of the catalog weapon of the same
   class (tests/cyberweapons.test.cjs pins both). Nothing is saved: the rows are read from what is installed on the sheet.
     window.Cyberweapons.rows(c, lang)    -> one row per installed copy: {key, catalogId, name, dice, rof, skill, stat, attack, ...}
     window.Cyberweapons.render(c, lang)  -> the block for the combat dock (buttons for the attack and the damage)
     window.Cyberweapons.attack / damage  -> the two rolls; the attack goes through Rolls.quickCheck, the damage through Rolls.sum */
(function(global){
'use strict';
/* base: the catalog weapon of the same class (its damage, ROF and skill are the same numbers). dice/rof: what the cyberware text
   itself says (null where the text names none: the pop-up launcher shoots the grenade that is loaded). handBusy: the text says the
   hand can hold nothing, or is occupied, while the weapon is in use. */
const TABLE={
 'cyberware-big-knucks':{base:'weapon-medium-melee-weapon',dice:2,rof:2,skill:'Melee Weapon',stat:'DEX',kind:'melee',handBusy:true},
 'cyberware-rippers':{base:'weapon-medium-melee-weapon',dice:2,rof:2,skill:'Melee Weapon',stat:'DEX',kind:'melee',handBusy:true},
 'cyberware-scratchers':{base:'weapon-light-melee-weapon',dice:1,rof:2,skill:'Melee Weapon',stat:'DEX',kind:'melee',handBusy:true},
 'cyberware-slice-n-dice':{base:'weapon-medium-melee-weapon',dice:2,rof:2,skill:'Melee Weapon',stat:'DEX',kind:'melee',handBusy:true},
 'cyberware-wolvers':{base:'weapon-heavy-melee-weapon',dice:3,rof:2,skill:'Melee Weapon',stat:'DEX',kind:'melee',handBusy:true},
 'cyberware-talon-foot':{base:'weapon-light-melee-weapon',dice:1,rof:2,skill:'Melee Weapon',stat:'DEX',kind:'melee',handBusy:false},
 'cyberware-vampyres':{base:'weapon-light-melee-weapon',dice:1,rof:2,skill:'Melee Weapon',stat:'DEX',kind:'melee',handBusy:false},
 'cyberware-cybersnake':{base:'weapon-very-heavy-melee-weapon',dice:4,rof:1,skill:'Melee Weapon',stat:'DEX',kind:'melee',handBusy:false},
 'cyberware-popup-grenade-launcher':{base:'weapon-grenade-launcher',dice:null,rof:null,skill:'Heavy Weapons',stat:'REF',kind:'ranged',handBusy:true}
};
const T={
 ru:{title:'КИБЕРОРУЖИЕ',attack:'Атака',damage:'Урон',page:'стр.',rof:'ROF',busy:'Пока оружие в деле, рука не может ничего держать.',busyLauncher:'Пока гранатомёт выдвинут, рука занята.',free:'Скрывается без проверки.',byGrenade:'Урон — по заряженной гранате.',crit:'возможное критическое ранение: +5 урона напрямую к HP цели',stale:'Имплант изменился. Откройте боевой лист заново.',noRoll:'Бросок не удался. Попробуйте ещё раз.',attackLabel:'Атака',damageLabel:'Урон',copy:n=>`№${n}`},
 en:{title:'CYBERWEAPONS',attack:'Attack',damage:'Damage',page:'p.',rof:'ROF',busy:'While the weapon is in use, the hand cannot hold anything.',busyLauncher:'While the launcher is out, the hand is occupied.',free:'Concealed without a check.',byGrenade:'Damage comes from the loaded grenade.',crit:'possible Critical Injury: +5 damage directly to HP',stale:'The implant changed. Open the combat sheet again.',noRoll:'The roll failed. Try again.',attackLabel:'Attack',damageLabel:'Damage',copy:n=>`#${n}`}
};
const tr=lang=>T[lang==='en'?'en':'ru'];
const isObject=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const int=(v,lo,hi)=>{if(v===null||v===''||typeof v==='boolean')return null;const n=Number(v);return Number.isInteger(n)&&n>=lo&&n<=hi?n:null};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const find=id=>{const list=Array.isArray(global.CATALOG)?global.CATALOG:[];return list.find(i=>i&&i.id===id)||null};
const A=()=>global.App||null;
const langNow=()=>{try{return A()?.lang?.()==='en'?'en':'ru'}catch{return 'ru'}};
const say=m=>{try{A()?.notify?.(m)}catch{}};
const statNow=(c,stat)=>{let v=null;try{v=global.DossierPanel?.statBase?.(c,stat)?.value}catch{}const n=Number(v);return Number.isFinite(n)?n:(int(c?.stats?.[stat],0,100)??0)};
/* Every installed copy of cyberware that has an entry in the table: {key, catalogId}. The cyber-slots module knows the installs
   (the equipment tool, starting implants, manual entries); without it the same two saved lists are read here. */
function installed(c){
 let list=null;
 try{if(typeof global.CyberSlots?.instances==='function')list=global.CyberSlots.instances(c)}catch{list=null}
 if(!Array.isArray(list)){
  list=[];const x=isObject(c?.extra)?c.extra:{},installs=x.equipment?.installs,items=x.items;
  if(Array.isArray(installs))for(const i of installs)if(isObject(i)&&!i.removedAt&&typeof i.id==='string'&&i.id&&typeof i.catalogId==='string')list.push({key:'i:'+i.id,catalogId:i.catalogId});
  if(Array.isArray(items))for(const r of items){if(!isObject(r)||r.humanityLossIncluded!==true||typeof r.id!=='string'||!r.id||typeof r.catalogId!=='string')continue;const q=int(r.quantity,1,99999)||1;for(let k=0;k<Math.min(q,10);k++)list.push({key:'r:'+r.id+':'+k,catalogId:r.catalogId})}
 }
 const seen=new Set();
 return list.filter(v=>isObject(v)&&typeof v.key==='string'&&typeof v.catalogId==='string'&&own(TABLE,v.catalogId)&&!seen.has(v.key)&&seen.add(v.key)).map(v=>({key:v.key,catalogId:v.catalogId}));
}
// The attack total the sheet shows for a skill: STAT + skill + wounds and effects, through the sheet's own calculation.
function attackParts(c,t){
 const stat=statNow(c,t.stat),level=int(c?.skills?.[t.skill],0,10)||0;let total=stat+level;
 try{const b=Number(A()?.checkBonus?.(c,t.stat,level,t.kind,t.skill));if(Number.isFinite(b))total=b}catch{}
 return {stat,level,total};
}
const skillLabel=(skill,lang)=>global.SKILL_LABELS?.[skill]?.[lang==='en'?'en':'ru']||skill;
// One row per installed copy, in the order the sheet lists the implants. A second copy of the same implant gets a number.
function rows(c,lang){
 lang=lang==='en'?'en':'ru';const t=tr(lang),list=installed(c),count={},total={};
 for(const v of list)total[v.catalogId]=(total[v.catalogId]||0)+1;
 return list.map(v=>{
  const spec=TABLE[v.catalogId],item=find(v.catalogId),p=attackParts(c,spec);
  count[v.catalogId]=(count[v.catalogId]||0)+1;
  const base=item?.name?.[lang]||v.catalogId,name=total[v.catalogId]>1?`${base} ${t.copy(count[v.catalogId])}`:base;
  return {key:v.key,catalogId:v.catalogId,name,page:int(item?.page,1,9999),kind:spec.kind,skill:spec.skill,skillLabel:skillLabel(spec.skill,lang),stat:spec.stat,dice:spec.dice,rof:spec.rof,
   damage:spec.dice?`${spec.dice}d6`:null,handBusy:spec.handBusy,level:p.level,attack:p.total,
   note:spec.dice===null?`${t.busyLauncher} ${t.byGrenade}`:`${spec.handBusy?t.busy+' ':''}${t.free}`};
 });
}
const sign=n=>(n<0?'−':'+')+Math.abs(n);
function render(c,lang){
 lang=lang==='en'?'en':'ru';
 if(!isObject(c)||typeof c.id!=='string')return '';
 const list=rows(c,lang);if(!list.length)return '';const t=tr(lang);
 return `<section class="cw-block" data-cw-root data-cw-char="${esc(c.id)}" aria-label="${esc(t.title)}"><h3>${esc(t.title)}</h3><ul class="cw-list">${list.map(r=>`<li class="cw-row"><div class="cw-head"><strong>${esc(r.name)}</strong><small>${r.damage?esc(r.damage)+' · ':''}${r.rof?esc(t.rof)+' '+r.rof+' · ':''}${esc(r.skillLabel)}${r.page?' · '+esc(t.page)+' '+r.page:''}</small></div><p class="cw-note">${esc(r.note)}</p><div class="cx-entry-actions"><button type="button" class="cx-button" data-cw-attack="${esc(r.key)}">⬡ ${esc(t.attack)} <b>${sign(r.attack)}</b></button>${r.damage?`<button type="button" class="cx-button" data-cw-damage="${esc(r.key)}">⬡ ${esc(t.damage)} ${esc(r.damage)}</button>`:''}</div></li>`).join('')}</ul></section>`;
}
const rowOf=(c,key,lang)=>typeof key==='string'?rows(c,lang).find(r=>r.key===key)||null:null;
// The attack: d10 check through rolls.js with the sheet's own bonus. Returns {ok, total} or {ok:false, reason}.
function attack(c,key,lang){
 lang=lang==='en'?'en':'ru';const r=rowOf(c,key,lang);if(!r)return {ok:false,reason:'stale'};
 const spec=TABLE[r.catalogId],p=attackParts(c,spec);
 const total=global.Rolls?.quickCheck?.({stat:p.stat,skill:p.level,mod:p.total-p.stat-p.level,label:`${r.name} · ${tr(lang).attackLabel}`});
 return Number.isInteger(total)?{ok:true,total}:{ok:false,reason:'roll'};
}
// The damage: the dice of the table, summed and reported through rolls.js. Two or more sixes mark a possible Critical Injury.
function damage(c,key,lang,rng=Math.random){
 lang=lang==='en'?'en':'ru';const r=rowOf(c,key,lang);if(!r)return {ok:false,reason:'stale'};
 if(!r.dice)return {ok:false,reason:'none'};
 const dice=[];for(let i=0;i<r.dice;i++){const v=global.Rolls?.d?.(6,rng);if(!Number.isInteger(v))return {ok:false,reason:'roll'};dice.push(v)}
 const total=dice.reduce((a,b)=>a+b,0),crit=dice.filter(v=>v===6).length>=2;
 const done=global.Rolls?.sum?.(`${r.name} · ${tr(lang).damageLabel}`,dice,6,{total,note:crit?tr(lang).crit:''});
 return done===undefined||done===null?{ok:false,reason:'roll'}:{ok:true,total,dice,crit};
}
function onClick(e){
 const b=e.target?.closest?.('button[data-cw-attack],button[data-cw-damage]');if(!b||b.disabled)return;
 const a=A(),l=langNow(),t=tr(l),c=a?.active?.(),root=b.closest?.('[data-cw-root]'),isAttack=b.dataset.cwAttack!==undefined,key=isAttack?b.dataset.cwAttack:b.dataset.cwDamage;
 if(!a||!c||!root||root.dataset.cwChar!==c.id||!rowOf(c,key,l)){say(t.stale);a?.render?.();return}
 const r=isAttack?attack(c,key,l):damage(c,key,l);
 if(!r.ok)say(r.reason==='stale'?t.stale:t.noRoll);
 try{const sel=isAttack?`button[data-cw-attack="${key}"]`:`button[data-cw-damage="${key}"]`,el=document.querySelector(sel);if(el&&document.activeElement!==el)el.focus()}catch{}
}
if(typeof document!=='undefined'&&document?.addEventListener)document.addEventListener('click',onClick);
global.Cyberweapons={TABLE,installed,rows,render,attack,damage,attackParts};
})(window);
