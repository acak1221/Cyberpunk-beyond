/* The Game Master's table: what the tracker needs so nobody does the bookkeeping by hand.
   - an NPC's attack and damage rolled from its tracker row, and the damage applied to a chosen participant;
   - damage to a player character through that character's armor (the sheet's own rules: DamageApply);
   - a compact tracker: one line per participant, details on demand;
   - a reward for the whole party: eb through Wallet and Improvement Points into every sheet's log;
   - loot and Night Market goods handed to a character.
   The functions in part 1 are pure (or change only the object they are given) and are covered by tests;
   part 2 builds HTML for campaigns.js; part 3 handles the clicks. */
(function(){
'use strict';
const T={
 ru:{
  expand:'Подробнее',collapse:'Свернуть',expandAll:'Развернуть всё',collapseAll:'Свернуть всё',colName:'Участник',colInit:'Иниц.',colHp:'HP',
  help:'Как пользоваться трекером',
  attacks:'Атаки',attack:'Атака',damage:'Урон',noAttacks:'У этого участника нет записанного оружия.',
  attackLine:(who,weapon,detail)=>`${who} · атака (${weapon}): ${detail}`,
  damageLine:(who,weapon,detail)=>`${who} · урон (${weapon}): ${detail}`,
  crit:'Две шестёрки — критическое ранение (+5 напрямую в HP).',
  wound:n=>`ранение ${n}`,
  target:'Цель',chooseTarget:'Выберите цель',where:'Куда',body:'Тело',head:'Голова',type:'Тип',ranged:'Обычная атака',melee:'Оружие ближнего боя (SP вдвое меньше)',direct:'Напрямую в HP',
  critBox:'Крит. ранение (+5)',applyTo:n=>`Применить урон ${n}`,apply:'Применить урон',rawDamage:'Урон до брони',
  pcTitle:'Урон по персонажу',pcHelp:'Считается по броне с листа: урон минус SP, пробитая броня теряет 1 SP, в голову прошедший урон удваивается.',
  needTarget:'Выберите цель.',badDamage:'Введите урон: целое число от 1 до 999.',failed:'Не удалось применить урон: проверьте HP и броню на листе. Ничего не изменено.',
  stopped:(name,raw,sp)=>`${name}: броня остановила урон (${raw} против SP ${sp}).`,
  hit:(name,raw,sp,through,dealt,from,to,spFrom,spTo)=>`${name}: ${raw} − SP ${sp} = ${through}${dealt!==through?`, по HP ${dealt}`:''}. HP ${from} → ${to}${spTo!==spFrom&&spTo!==null?`, SP ${spFrom} → ${spTo}`:''}.`,
  directHit:(name,dealt,from,to)=>`${name}: ${dealt} напрямую. HP ${from} → ${to}.`,
  mortalPenalty:(a,b)=>` Штраф Death Save ${a} → ${b}.`,nowMortal:' Смертельно ранен.',
  undo:'Отменить',undone:'Урон отменён.',undoStale:'Данные уже изменились — отмена невозможна.',
  party:'НАГРАДА ГРУППЕ',partyHelp:'Деньги и Improvement Points всем выбранным персонажам одним действием. IP можно указать каждому отдельно (стр. 410–411).',
  partyNone:'Добавьте персонажей в кампанию, чтобы выдавать награду.',
  cash:'Деньги, eb',mode:'Как выдать',each:'Каждому эту сумму',split:'Разделить поровну',ip:'IP каждому',reason:'За что',reasonPh:'Например, работа в Уотсоне',
  ipFor:name=>`IP · ${name}`,give:'Начислить',
  previewNone:'Укажите сумму или IP и отметьте участников.',
  previewRow:(name,cash,ip)=>`${name}: ${[cash?`+${cash} eb`:'',ip?`+${ip} IP`:''].filter(Boolean).join(', ')||'—'}`,
  rest:n=>`Остаток ${n} eb не делится — решите за столом.`,
  awardBad:'Проверьте сумму (целое число от 0) и IP (от 0 до 9999).',awardMax:name=>`${name}: сумма больше предела кошелька. Ничего не начислено.`,awardFail:'Не удалось начислить: один из листов несовместим. Ничего не изменено.',
  awardDone:n=>`Награда начислена: ${n}.`,awardNote:'Награда группе',awardJournal:(rows,reason)=>`Награда группе${reason?` (${reason})`:''}: ${rows}`,
  awardUndo:'Отменить последнюю награду',awardUndone:'Награда отменена.',
  giveTitle:'Отдать персонажу',giveBtn:'Отдать',giveCash:n=>`Наличные: ${n} eb`,recipient:'Кому',free:'Отдать бесплатно',sell:n=>`Продать за ${n} eb`,earn:n=>`Начислить ${n} eb`,cancel:'Отмена',
  noChars:'Сначала создайте персонажа.',gaveItem:(item,name)=>`${item} — на листе: ${name}.`,soldItem:(item,name,price,left)=>`${item} — на листе: ${name}. Списано ${price} eb, осталось ${left} eb.`,gaveCash:(n,name,total)=>`${name}: +${n} eb, теперь ${total} eb.`,
  short:(name,n)=>`${name}: не хватает ${n} eb.`,giveFail:'Не удалось отдать: лист несовместим. Ничего не изменено.',lootNote:'Добыча',marketNote:'Ночной рынок',
  backToCampaign:'Назад в кампанию'
 },
 en:{
  expand:'Details',collapse:'Collapse',expandAll:'Expand all',collapseAll:'Collapse all',colName:'Combatant',colInit:'Init.',colHp:'HP',
  help:'How the tracker works',
  attacks:'Attacks',attack:'Attack',damage:'Damage',noAttacks:'This combatant has no recorded weapons.',
  attackLine:(who,weapon,detail)=>`${who} · attack (${weapon}): ${detail}`,
  damageLine:(who,weapon,detail)=>`${who} · damage (${weapon}): ${detail}`,
  crit:'Two sixes — a Critical Injury (+5 directly to HP).',
  wound:n=>`wound ${n}`,
  target:'Target',chooseTarget:'Choose a target',where:'Location',body:'Body',head:'Head',type:'Type',ranged:'Standard attack',melee:'Melee weapon (half SP)',direct:'Directly to HP',
  critBox:'Critical Injury (+5)',applyTo:n=>`Apply ${n} damage`,apply:'Apply damage',rawDamage:'Damage before armor',
  pcTitle:'Damage to the character',pcHelp:'Uses the armor on the sheet: damage minus SP, penetrated armor loses 1 SP, damage that gets through to the head is doubled.',
  needTarget:'Choose a target.',badDamage:'Enter damage: a whole number from 1 to 999.',failed:'The damage could not be applied: check HP and armor on the sheet. Nothing was changed.',
  stopped:(name,raw,sp)=>`${name}: armor stopped the damage (${raw} against SP ${sp}).`,
  hit:(name,raw,sp,through,dealt,from,to,spFrom,spTo)=>`${name}: ${raw} − SP ${sp} = ${through}${dealt!==through?`, ${dealt} to HP`:''}. HP ${from} → ${to}${spTo!==spFrom&&spTo!==null?`, SP ${spFrom} → ${spTo}`:''}.`,
  directHit:(name,dealt,from,to)=>`${name}: ${dealt} directly. HP ${from} → ${to}.`,
  mortalPenalty:(a,b)=>` Death Save penalty ${a} → ${b}.`,nowMortal:' Mortally Wounded.',
  undo:'Undo',undone:'Damage undone.',undoStale:'The data has already changed — it cannot be undone.',
  party:'PARTY REWARD',partyHelp:'Money and Improvement Points for every chosen character in one action. IP can be set per character (pp. 410–411).',
  partyNone:'Add characters to the campaign to hand out rewards.',
  cash:'Money, eb',mode:'How to pay',each:'This sum to each',split:'Split evenly',ip:'IP each',reason:'Reason',reasonPh:'For example, the Watson job',
  ipFor:name=>`IP · ${name}`,give:'Award',
  previewNone:'Enter a sum or IP and tick the characters.',
  previewRow:(name,cash,ip)=>`${name}: ${[cash?`+${cash} eb`:'',ip?`+${ip} IP`:''].filter(Boolean).join(', ')||'—'}`,
  rest:n=>`${n} eb is left over — settle it at the table.`,
  awardBad:'Check the sum (a whole number from 0) and IP (0 to 9999).',awardMax:name=>`${name}: the sum exceeds the wallet limit. Nothing was awarded.`,awardFail:'Could not award: one of the sheets is incompatible. Nothing was changed.',
  awardDone:n=>`Reward given: ${n}.`,awardNote:'Party reward',awardJournal:(rows,reason)=>`Party reward${reason?` (${reason})`:''}: ${rows}`,
  awardUndo:'Undo the last reward',awardUndone:'The reward was undone.',
  giveTitle:'Give to a character',giveBtn:'Give',giveCash:n=>`Cash: ${n} eb`,recipient:'To',free:'Give for free',sell:n=>`Sell for ${n} eb`,earn:n=>`Add ${n} eb`,cancel:'Cancel',
  noChars:'Create a character first.',gaveItem:(item,name)=>`${item} is now on the sheet: ${name}.`,soldItem:(item,name,price,left)=>`${item} is now on the sheet: ${name}. ${price} eb spent, ${left} eb left.`,gaveCash:(n,name,total)=>`${name}: +${n} eb, now ${total} eb.`,
  short:(name,n)=>`${name}: ${n} eb short.`,giveFail:'Could not give it: the sheet is incompatible. Nothing was changed.',lootNote:'Loot',marketNote:'Night Market',
  backToCampaign:'Back to the campaign'
 }
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const L=lang=>lang==='en'?'en':'ru';
const whole=(v,min,max)=>{const s=String(v??'').trim();if(!/^\d{1,9}$/.test(s))return null;const n=Number(s);return n>=min&&n<=max?n:null};
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);

// ---------- 1. rules ----------

// Which skill a book NPC attacks with, from the weapon's name (the templates list weapons without one).
function weaponSkill(name){
 const n=String(name||'');
 if(/crossbow|\bbow\b/i.test(n))return 'Archery';
 if(/flamethrower|grenade launcher|rocket|missile/i.test(n))return 'Heavy Weapons';
 if(/shotgun|rifle/i.test(n))return 'Shoulder Arms';
 if(/pistol|smg|handgun|revolver/i.test(n))return 'Handgun';
 if(/melee weapon|ripper|wolver|cybersnake|sword|knife|blade|katana|club|axe|whip|hammer/i.test(n))return 'Melee Weapon';
 return 'Brawling';
}
const isMelee=skill=>skill==='Melee Weapon'||skill==='Martial Arts';
const DICE=/^(\d{1,2})d(6|10)$/i;
// The attacks a tracker row can make: [{name, skill, base, damage}]. `base` is null when the skill is unknown.
function attacksOf(row,templates,library){
 if(!row||row.kind!=='npc')return [];
 const out=[];
 if(typeof row.sourceTemplate==='string'&&row.sourceTemplate){
  const matches=(Array.isArray(templates)?templates:[]).filter(x=>x&&x.id===row.sourceTemplate),temp=matches.length===1?matches[0]:null;
  for(const w of Array.isArray(temp?.weapons)?temp.weapons:[]){
   if(!w||typeof w.name!=='string'||!w.name.trim()||typeof w.damage!=='string'||!DICE.test(w.damage.trim()))continue;
   const skill=weaponSkill(w.name);let base=null;
   for(const key of [skill,skill+'s']){const raw=temp.skillBases?.[key],n=isObj(raw)?raw.armored:raw;if(Number.isSafeInteger(n)&&n>=0&&n<=40){base=n;break}}
   out.push({name:w.name.trim().slice(0,60),skill,base,damage:w.damage.trim().toLowerCase(),melee:isMelee(skill)});
  }
 }else if(typeof row.sourceLibrary==='string'&&row.sourceLibrary){
  const entry=(Array.isArray(library)?library:[]).find(x=>x&&x.id===row.sourceLibrary);
  for(const a of Array.isArray(entry?.attacks)?entry.attacks:[]){
   if(!a||typeof a.name!=='string'||!a.name.trim()||typeof a.damage!=='string'||!DICE.test(a.damage.trim())||!Number.isSafeInteger(a.base)||a.base<0||a.base>40)continue;
   const skill=weaponSkill(a.name);out.push({name:a.name.trim().slice(0,60),skill:'',base:a.base,damage:a.damage.trim().toLowerCase(),melee:isMelee(skill)});
  }
 }
 return out.slice(0,8);
}
const die=(sides,rng)=>{const n=rng();return typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<1?1+Math.floor(n*sides):null};
// 1d10 + base with the critical rule (p. 130) and the attacker's wound penalty.
function rollAttack(base,wound,rng=Math.random){
 if(!Number.isSafeInteger(base)||!Number.isSafeInteger(wound))return null;
 const first=die(10,rng);if(first===null)return null;
 const extra=first===1||first===10?die(10,rng):0;if(extra===null)return null;
 return {first,extra,base,wound,total:base+wound+first+(first===10?extra:first===1?-extra:0)};
}
// Weapon damage; two or more sixes on d6 are a Critical Injury (p. 187).
function rollDamage(spec,rng=Math.random){
 const m=DICE.exec(String(spec||'').trim()),count=m?Number(m[1]):0,sides=m?Number(m[2]):0;
 if(count<1||count>20)return null;
 const dice=Array.from({length:count},()=>die(sides,rng));if(dice.some(x=>x===null))return null;
 return {dice,sides,total:dice.reduce((a,b)=>a+b,0),critical:sides===6&&dice.filter(x=>x===6).length>=2};
}
const woundPenalty=state=>state==='mortal'?-4:state==='serious'?-2:0;
const npcSp=(r,loc)=>{const n=Number(r?.sp?.[loc]);return Number.isSafeInteger(n)&&n>=0&&n<=30?n:0};
// Damage to an NPC row of the tracker (changes the row). HP stops at 0: below 1 HP is Mortally Wounded, negatives are not tracked.
function hitNpc(target,args){
 const raw=args?.raw,loc=args?.location==='head'?'head':'body',type=['standard','melee','direct'].includes(args?.type)?args.type:'standard',critical=args?.critical===true;
 if(!target||target.kind!=='npc'||!Number.isSafeInteger(raw)||raw<1||raw>999)return {ok:false,reason:'invalid'};
 const from=Number(target.hp)||0,sp=type==='direct'?0:npcSp(target,loc);
 const calc=type==='direct'?null:window.CombatTools?.calcDamage?.(raw,sp,false,type),effective=type==='direct'?0:calc?calc.effectiveSP:(type==='melee'?Math.ceil(sp/2):sp);
 const through=Math.max(0,raw-effective),dealt=(loc==='head'&&type!=='direct'?through*2:through)+(critical?5:0);
 if(!dealt)return {ok:true,stopped:true,raw,sp:effective,through:0,dealt:0,from,hp:from,spFrom:sp,spTo:sp};
 if(target.maxHp===undefined&&from>0)target.maxHp=from;
 let spTo=sp;if(through>0&&sp>0&&type!=='direct'){spTo=sp-1;target.sp={head:npcSp(target,'head'),body:npcSp(target,'body'),[loc]:spTo}}
 target.hp=Math.max(0,from-dealt);
 let penalty=null;if(from<1){penalty=[Number(target.deathPenalty)||0,Math.min(99,(Number(target.deathPenalty)||0)+1)];target.deathPenalty=penalty[1]}
 return {ok:true,stopped:false,direct:type==='direct',raw,sp:effective,through,dealt,from,hp:target.hp,spFrom:sp,spTo,penalty,nowMortal:from>=1&&target.hp<1};
}
// Damage to a player character through the armor on the sheet, by the sheet's own rules (changes the character).
function hitPc(pc,args){
 const DA=window.DamageApply,raw=args?.raw;
 if(!DA?.quote||!DA?.apply||!isObj(pc)||!Number.isSafeInteger(raw)||raw<1||raw>999)return {ok:false,reason:'invalid'};
 const type=['standard','melee','direct'].includes(args?.type)?args.type:'standard',location=args?.location==='head'?'head':'body',hp=Number(pc.hp);
 const q=DA.apply(pc,{type,location,raw,critical:args?.critical===true,source:Number.isFinite(hp)&&hp<1?'attack':''});
 if(!q)return {ok:false,reason:'invalid'};
 return {ok:true,stopped:q.damage===0,direct:type==='direct',raw,sp:q.effective,through:q.penetrating,dealt:q.damage,from:q.hp,hp:q.hpAfter,spFrom:q.sp,spTo:q.spAfter,penalty:q.mortalAttack?[q.penaltyBefore,q.penaltyAfter]:null,nowMortal:q.hp>=1&&q.hpAfter<1,forcedCritical:q.forcedCritical};
}
function hitText(lang,name,r){
 const t=T[L(lang)];
 if(r.stopped)return t.stopped(name,r.raw,r.sp);
 return (r.direct?t.directHit(name,r.dealt,r.from,r.hp):t.hit(name,r.raw,r.sp,r.through,r.dealt,r.from,r.hp,r.spFrom,r.spTo))+(r.penalty?t.mortalPenalty(r.penalty[0],r.penalty[1]):'')+(r.nowMortal?t.nowMortal:'');
}

/* A reward for the party. `draft` is the form: {cash, mode:'each'|'split', ip, off:{id:true}, ipBy:{id:text}}.
   -> {ok, rows:[{id,name,cash,ip}], each, rest} | {ok:false, reason:'invalid'|'empty'} */
function awardPlan(members,draft){
 const d=draft||{},text=v=>String(v??'').trim();
 const cash=text(d.cash)===''?0:whole(d.cash,0,999999999),ip=text(d.ip)===''?0:whole(d.ip,0,9999);
 if(cash===null||ip===null)return {ok:false,reason:'invalid'};
 const chosen=(Array.isArray(members)?members:[]).filter(c=>c&&typeof c.id==='string'&&!d.off?.[c.id]);
 const share=d.mode==='split'?(window.Wallet?.split?window.Wallet.split(cash,chosen.length):{each:chosen.length?Math.floor(cash/chosen.length):0,rest:chosen.length?cash%chosen.length:cash}):{each:cash,rest:0};
 const rows=[];
 for(const c of chosen){const own=text(d.ipBy?.[c.id]),n=own===''?ip:whole(own,0,9999);if(n===null)return {ok:false,reason:'invalid'};rows.push({id:c.id,name:c.name||'Edgerunner',cash:share.each,ip:n})}
 if(!rows.length||!rows.some(r=>r.cash>0||r.ip>0))return {ok:false,reason:'empty',each:share.each,rest:share.rest};
 return {ok:true,rows,each:share.each,rest:share.rest};
}
/* Stages the reward for every sheet and changes nothing: the caller assigns `extra` to each character.
   -> {ok, changes:[{id, extra}]} | {ok:false, reason:'max'|'unsupported', name} */
function awardStage(members,plan,reason,options){
 const W=window.Wallet,at=options?.at||new Date().toISOString(),note=String(reason||'').trim().slice(0,120)||String(options?.note||''),changes=[];
 if(!plan?.ok||!W?.earn)return {ok:false,reason:'unsupported'};
 for(const row of plan.rows){
  const c=(Array.isArray(members)?members:[]).find(x=>x&&x.id===row.id);
  if(!c||(c.extra!==undefined&&!isObj(c.extra))||(c.extra?.ipLog!==undefined&&(!Array.isArray(c.extra.ipLog)||c.extra.ipLog.length>=5000)))return {ok:false,reason:'unsupported',name:row.name};
  let extra={...(c.extra||{})};
  if(row.cash>0){const r=W.earn({...c,extra},row.cash,note,{at});if(!r.ok)return {ok:false,reason:r.reason==='max'?'max':'unsupported',name:row.name};extra=r.extra}
  if(row.ip>0)extra.ipLog=[...(extra.ipLog||[]),{id:(options?.id||newId)(),date:at.slice(0,10),reason:note.slice(0,200),delta:row.ip}];
  changes.push({id:row.id,extra});
 }
 return {ok:true,changes};
}
const newId=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);

/* Hands a catalog item to a character: free, or sold for its price through Wallet. Changes nothing:
   -> {ok, extra, price, balance} | {ok:false, reason:'short'|'unsupported', short} */
function giveItem(character,item,lang,options){
 const CE=window.CharacterExtra,W=window.Wallet;
 if(!isObj(character)||!isObj(item)||!CE?.addCatalog||(character.extra!==undefined&&!isObj(character.extra)))return {ok:false,reason:'unsupported'};
 let stage;try{stage={...character,extra:JSON.parse(JSON.stringify(character.extra||{}))}}catch{return {ok:false,reason:'unsupported'}}
 let price=0;
 if(options?.sell===true){
  price=Number(item.price);if(!Number.isSafeInteger(price)||price<1||!W?.spend)return {ok:false,reason:'unsupported'};
  const r=W.spend(stage,price,String(options.note||'').slice(0,120));if(!r.ok)return {ok:false,reason:r.reason==='short'?'short':'unsupported',short:r.short};
  stage.extra=r.extra;
 }
 try{if(!CE.addCatalog(stage,item,L(lang)))return {ok:false,reason:'unsupported'}}catch{return {ok:false,reason:'unsupported'}}
 return {ok:true,extra:stage.extra,price,balance:W?.cash?W.cash(stage):Number(stage.extra.cash)||0};
}

// ---------- 2. HTML for the campaign page ----------
const rowOpen=new Map(),results=new Map(),drafts=new Map(),lastAward=new Map();
let fromCampaign=null;
const keep=(map,key,value)=>{map.delete(key);map.set(key,value);while(map.size>200)map.delete(map.keys().next().value)};
// Closed by default; the opponent whose turn it is opens on its own, because its attacks are needed right now.
const isOpen=(id,current)=>rowOpen.has(id)?rowOpen.get(id):current===true;
const open=id=>{if(rowOpen.get(id)===true)return false;keep(rowOpen,id,true);return true};
const auto=(r,current)=>!!current&&r?.kind==='npc';
const rowClass=(r,current)=>' gt-row'+(isOpen(r.id,auto(r,current))?' gt-open':'');
function toggleHTML(r,lang,current,name){const t=T[L(lang)],on=isOpen(r.id,auto(r,current)),label=on?t.collapse:t.expand;return `<button type="button" class="gt-toggle" data-gt data-gt-action="toggle" data-id="${esc(r.id)}" data-open="${on?1:0}" aria-expanded="${on}" aria-label="${esc(label+' · '+name)}" title="${esc(label)}">${on?'▴':'▾'}</button>`}
function headHTML(roster,lang,currentId){const t=T[L(lang)],all=roster.length>0&&roster.every(r=>isOpen(r.id,auto(r,r.id===currentId)));return `<div class="gt-head" data-gt><span>№</span><span>${esc(t.colName)}</span><span>${esc(t.colInit)}</span><span>${esc(t.colHp)}</span><button type="button" class="gt-all" data-gt-action="toggle-all" data-open="${all?1:0}">${esc(all?t.collapseAll:t.expandAll)}</button></div>`}
const helpHTML=(lang,inner)=>`<details class="gt-help"><summary>${esc(T[L(lang)].help)}</summary>${inner}</details>`;
function library(){try{return window.NpcLibrary?.readLibrary?.(window.App?.getState?.())||[]}catch{return []}}
const skillName=(key,lang)=>L(lang)==='ru'?(window.SKILL_LABELS?.[key]?.ru||key):key;
function resultHTML(r,c,characters,lang){
 const t=T[L(lang)],res=results.get(r.id);if(!res)return '';
 let html=`<div class="gt-result" role="status">${res.lines.map(x=>`<p>${esc(x)}</p>`).join('')}`;
 if(res.damage){
  const d=res.damage,targets=(c.roster||[]).filter(x=>x&&x.id!==r.id&&x.dead!==true).map(x=>{const pc=x.kind==='pc'?characters.find(p=>p.id===x.characterId):null;return x.kind==='pc'&&!pc?null:{id:x.id,name:pc?(pc.name||'Edgerunner'):x.name||'?'}}).filter(Boolean);
  html+=`<div class="gt-apply"><label>${esc(t.target)}<select data-gt-field="target"><option value="">${esc(t.chooseTarget)}</option>${targets.map(x=>`<option value="${esc(x.id)}"${d.target===x.id?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label>${hitFields(t,d.melee?'melee':'standard',d.critical)}<button type="button" class="btn primary" data-gt-action="apply-roll" data-id="${esc(r.id)}">${esc(t.applyTo(d.total))}</button></div>`;
 }
 if(res.undo)html+=`<button type="button" class="btn ghost gt-undo" data-gt-action="undo-hit" data-id="${esc(r.id)}">↶ ${esc(t.undo)}</button>`;
 return html+'</div>';
}
const hitFields=(t,type,critical)=>`<label>${esc(t.where)}<select data-gt-field="location"><option value="body">${esc(t.body)}</option><option value="head">${esc(t.head)}</option></select></label><label>${esc(t.type)}<select data-gt-field="type">${[['standard',t.ranged],['melee',t.melee],['direct',t.direct]].map(([v,l])=>`<option value="${v}"${v===type?' selected':''}>${esc(l)}</option>`).join('')}</select></label><label class="gt-check"><input type="checkbox" data-gt-field="critical"${critical?' checked':''}> ${esc(t.critBox)}</label>`;
// What the module adds inside a row's «Действия».
function rowExtras(r,pc,c,characters,lang){
 const t=T[L(lang)];
 if(pc)return `<div class="gt-box" data-gt><strong class="gt-title">${esc(t.pcTitle)}</strong><div class="gt-apply"><label>${esc(t.rawDamage)}<input type="number" inputmode="numeric" min="1" max="999" data-gt-field="raw"></label>${hitFields(t,'standard',false)}<button type="button" class="btn primary" data-gt-action="pc-damage" data-id="${esc(r.id)}">${esc(t.apply)}</button></div><p class="muted">${esc(t.pcHelp)}</p>${resultHTML(r,c,characters,lang)}</div>`;
 if(r.kind!=='npc')return '';
 const list=attacksOf(r,window.GMTools?.NPC_TEMPLATES,library());
 if(!list.length&&!results.has(r.id))return '';
 return `<div class="gt-box" data-gt><strong class="gt-title">${esc(t.attacks)}</strong>${list.length?`<ul class="gt-attacks">${list.map((a,i)=>`<li><span class="gt-weapon">${esc(a.name)}${a.skill&&a.base!==null?` <small>${esc(skillName(a.skill,lang))} ${a.base}</small>`:a.base!==null?` <small>${a.base}</small>`:''}</span>${a.base!==null?`<button type="button" class="btn ghost" data-gt-action="attack" data-id="${esc(r.id)}" data-i="${i}">⬡ ${esc(t.attack)} +${a.base}</button>`:''}<button type="button" class="btn ghost" data-gt-action="dmg-roll" data-id="${esc(r.id)}" data-i="${i}">⬡ ${esc(t.damage)} ${esc(a.damage)}</button></li>`).join('')}</ul>`:''}${resultHTML(r,c,characters,lang)}</div>`;
}
const members=(c,characters)=>(c?.roster||[]).filter(r=>r&&r.kind==='pc').map(r=>characters.find(p=>p.id===r.characterId)).filter(Boolean);
const draftOf=id=>{if(!drafts.has(id))keep(drafts,id,{cash:'',mode:'each',ip:'',reason:'',off:{},ipBy:{}});return drafts.get(id)};
function previewText(list,d,lang){const t=T[L(lang)],p=awardPlan(list,d);if(!p.ok)return p.reason==='invalid'?t.awardBad:t.previewNone;return p.rows.map(r=>t.previewRow(r.name,r.cash,r.ip)).join(' · ')+(p.rest?' · '+t.rest(p.rest):'')}
function partyHTML(c,characters,lang){
 const t=T[L(lang)],list=members(c,characters),d=draftOf(c.id),undo=lastAward.get(c.id);
 if(!list.length)return `<section class="card gt-party" id="gt-party" data-gt><div class="card-heading"><span>${esc(t.party)}</span><span>EB · IP</span></div><p class="muted">${esc(t.partyNone)}</p></section>`;
 const ok=awardPlan(list,d).ok;
 return `<section class="card gt-party" id="gt-party" data-gt><div class="card-heading"><span>${esc(t.party)}</span><span>EB · IP</span></div><p class="muted">${esc(t.partyHelp)}</p><div class="gt-party-grid"><label class="field">${esc(t.cash)}<input type="number" inputmode="numeric" min="0" max="999999999" step="1" data-gt-award="cash" value="${esc(d.cash)}"></label><label class="field">${esc(t.mode)}<select data-gt-award="mode"><option value="each"${d.mode!=='split'?' selected':''}>${esc(t.each)}</option><option value="split"${d.mode==='split'?' selected':''}>${esc(t.split)}</option></select></label><label class="field">${esc(t.ip)}<input type="number" inputmode="numeric" min="0" max="9999" step="1" data-gt-award="ip" value="${esc(d.ip)}"></label><label class="field gt-reason">${esc(t.reason)}<input type="text" maxlength="120" data-gt-award="reason" placeholder="${esc(t.reasonPh)}" value="${esc(d.reason)}"></label></div><ul class="gt-members">${list.map(p=>`<li><label class="gt-check"><input type="checkbox" data-gt-award-pc="${esc(p.id)}"${d.off[p.id]?'':' checked'}> <span>${esc(p.name||'Edgerunner')}</span> <small>${esc(window.Wallet?.format?window.Wallet.format(window.Wallet.cash(p)):Number(p.extra?.cash)||0)} eb</small></label><input type="number" inputmode="numeric" min="0" max="9999" step="1" data-gt-award-ip="${esc(p.id)}" value="${esc(d.ipBy[p.id]??'')}" placeholder="${esc(d.ip||'0')}" aria-label="${esc(t.ipFor(p.name||'Edgerunner'))}"><span class="gt-unit">IP</span></li>`).join('')}</ul><p class="gt-preview" data-gt-preview role="status">${esc(previewText(list,d,lang))}</p><div class="campaign-controls"><button type="button" class="btn primary" data-gt-action="award"${ok?'':' disabled'}>＋ ${esc(t.give)}</button>${undo?`<button type="button" class="btn ghost" data-gt-action="award-undo">↶ ${esc(t.awardUndo)}</button>`:''}</div></section>`;
}
// The sheet's back link when the sheet was opened from a campaign row.
function backLink(character,lang){if(!fromCampaign||!character||fromCampaign!==character.id)return '';return `<button class="back-link" data-action="navigate" data-view="campaigns">← ${esc(T[L(lang)].backToCampaign)}</button>`}

// ---------- 3. events on the campaign page ----------
const owns=e=>!!e?.target?.closest?.('[data-gt]');
function handle(e,c,ctx){
 const el=e.target,lang=L(ctx.lang),t=T[lang],characters=Array.isArray(ctx.characters)?ctx.characters:[];
 const pcOf=x=>x?.kind==='pc'?characters.find(p=>p.id===x.characterId):null,nameOf=x=>{const pc=pcOf(x);return pc?(pc.name||'Edgerunner'):x?.name||'?'};
 if(e.type==='input'||e.type==='change'){
  const party=el.closest?.('.gt-party');if(!party)return {};
  const d=draftOf(c.id),list=members(c,characters);
  if(el.dataset.gtAward){const k=el.dataset.gtAward;if(k==='mode')d.mode=el.value==='split'?'split':'each';else if(['cash','ip','reason'].includes(k))d[k]=String(el.value??'').slice(0,120);if(k==='ip')for(const x of party.querySelectorAll?.('[data-gt-award-ip]')||[])x.placeholder=d.ip||'0'}
  else if(el.dataset.gtAwardPc){if(el.checked)delete d.off[el.dataset.gtAwardPc];else d.off[el.dataset.gtAwardPc]=true}
  else if(el.dataset.gtAwardIp)d.ipBy[el.dataset.gtAwardIp]=String(el.value??'').slice(0,6);
  else return {};
  const preview=party.querySelector?.('[data-gt-preview]'),button=party.querySelector?.('[data-gt-action="award"]');
  if(preview)preview.textContent=previewText(list,d,lang);if(button)button.disabled=!awardPlan(list,d).ok;
  return {};
 }
 const b=e.type==='click'?el.closest?.('[data-gt-action]'):null;if(!b)return {};
 const a=b.dataset.gtAction,row=c.roster.find(x=>x.id===b.dataset.id),box=b.closest?.('.gt-box')||b.closest?.('.gt-result'),read=k=>box?.querySelector?.(`[data-gt-field="${k}"]`);
 if(a==='toggle'){keep(rowOpen,b.dataset.id,b.dataset.open!=='1');return {rerender:true}}
 if(a==='toggle-all'){const on=b.dataset.open!=='1';for(const r of c.roster)keep(rowOpen,r.id,on);return {rerender:true}}
 if(a==='attack'||a==='dmg-roll'){
  if(!row)return {};
  const attack=attacksOf(row,window.GMTools?.NPC_TEMPLATES,library())[Number(b.dataset.i)];if(!attack)return {};
  const old=results.get(row.id),who=nameOf(row);
  if(a==='attack'){
   const wound=woundPenalty(window.Campaigns?.woundOf?.(row,null)),r=rollAttack(attack.base,wound);if(!r)return {};
   const detail=`1d10 ${r.first}${r.extra?(r.first===10?' + ':' − ')+r.extra:''} + ${r.base}${r.wound?` − ${-r.wound} (${t.wound(r.wound)})`:''} = ${r.total}`;
   keep(results,row.id,{lines:[t.attackLine(who,attack.name,detail)]});
   try{window.Rolls?.check?.(`${who} · ${attack.name}`,{first:r.first,extra:r.extra,total:r.total},lang)}catch{}
   return {rerender:true,notify:t.attackLine(who,attack.name,detail)};
  }
  const r=rollDamage(attack.damage);if(!r)return {};
  const detail=`${attack.damage}: ${r.dice.join(' + ')} = ${r.total}`,line=t.damageLine(who,attack.name,detail)+(r.critical?' '+t.crit:'');
  keep(results,row.id,{lines:[...(old&&!old.damage&&!old.undo?old.lines.slice(-1):[]),line],damage:{total:r.total,critical:r.critical,melee:attack.melee,target:old?.target||''},target:old?.target||''});
  try{window.Rolls?.sum?.(`${who} · ${attack.name}`,r.dice,r.sides,{total:r.total})}catch{}
  return {rerender:true,notify:line};
 }
 if(a==='apply-roll'||a==='pc-damage'){
  if(!row)return {};
  const res=results.get(row.id),own=a==='pc-damage';
  const raw=own?whole(read('raw')?.value,1,999):res?.damage?.total;
  if(!Number.isSafeInteger(raw)||raw<1)return {notify:t.badDamage};
  const target=own?row:c.roster.find(x=>x.id===read('target')?.value);if(!target||target===row&&!own)return {notify:t.needTarget};
  const args={raw,location:read('location')?.value==='head'?'head':'body',type:read('type')?.value,critical:read('critical')?.checked===true};
  const pc=pcOf(target);if(target.kind==='pc'&&!pc)return {notify:t.needTarget};
  let before;try{before=JSON.stringify(pc||target)}catch{return {notify:t.failed}}
  const hit=pc?hitPc(pc,args):hitNpc(target,args);
  if(!hit.ok)return {notify:t.failed};
  const line=hitText(lang,nameOf(target),hit),changed=!hit.stopped;
  let after='';try{after=JSON.stringify(pc||target)}catch{}
  keep(results,row.id,{lines:[...(res?.lines||[]).slice(-2),line],target:target.id,...(changed&&after?{undo:{target:target.id,pc:!!pc,before,after}}:{})});
  if(changed)open(target.id);
  return {dirty:changed,rerender:true,notify:line};
 }
 if(a==='undo-hit'){
  const res=row?results.get(row.id):null,u=res?.undo,target=u?c.roster.find(x=>x.id===u.target):null,obj=u?.pc?pcOf(target):target;
  let same=false;try{same=!!obj&&JSON.stringify(obj)===u.after}catch{}
  if(!same){if(res){delete res.undo}return {rerender:true,notify:t.undoStale}}
  const old=JSON.parse(u.before);for(const k of Object.keys(obj))if(!Object.hasOwn(old,k))delete obj[k];Object.assign(obj,old);
  keep(results,row.id,{lines:[t.undone],target:res.target});
  return {dirty:true,rerender:true,notify:t.undone};
 }
 if(a==='award'){
  const list=members(c,characters),d=draftOf(c.id),plan=awardPlan(list,d);
  if(!plan.ok)return {notify:plan.reason==='invalid'?t.awardBad:t.previewNone};
  const staged=awardStage(list,plan,d.reason,{note:t.awardNote});
  if(!staged.ok)return {notify:staged.reason==='max'?t.awardMax(staged.name):t.awardFail};
  const undo=[];for(const ch of staged.changes){const p=list.find(x=>x.id===ch.id);undo.push({id:p.id,before:JSON.stringify(p.extra??null),after:JSON.stringify(ch.extra)});p.extra=ch.extra}
  const rows=plan.rows.filter(r=>r.cash>0||r.ip>0).map(r=>t.previewRow(r.name,r.cash,r.ip)).join('; '),entry=newId();
  try{window.Campaigns?.journalAdd?.(c,t.awardJournal(rows,String(d.reason||'').trim()),true,Date.now(),entry)}catch{}
  keep(lastAward,c.id,{undo,entry});
  keep(drafts,c.id,{cash:'',mode:d.mode,ip:'',reason:'',off:d.off,ipBy:{}});
  return {dirty:true,rerender:true,notify:t.awardDone(rows)};
 }
 if(a==='award-undo'){
  const last=lastAward.get(c.id);if(!last)return {rerender:true};
  const pairs=last.undo.map(u=>[characters.find(p=>p.id===u.id),u]);
  if(pairs.some(([p,u])=>!p||JSON.stringify(p.extra??null)!==u.after)){lastAward.delete(c.id);return {rerender:true,notify:t.undoStale}}
  for(const [p,u] of pairs){const old=JSON.parse(u.before);if(old===null)delete p.extra;else p.extra=old}
  if(Array.isArray(c.journal))c.journal=c.journal.filter(x=>x?.id!==last.entry);
  lastAward.delete(c.id);
  return {dirty:true,rerender:true,notify:t.awardUndone};
 }
 return {};
}

// ---------- 4. «Отдать персонажу»: loot and Night Market goods, on any page ----------
let lastRecipient='';
const giveButton=(what,lang)=>{const t=T[L(lang)],cash=whole(what?.cash,1,999999999);if(cash===null&&!(typeof what?.item==='string'&&what.item))return '';return `<button type="button" class="btn ghost gt-give" ${cash!==null?`data-gt-give-cash="${cash}"`:`data-gt-give="${esc(what.item)}"`} data-gt-note="${esc(what.note==='market'?'market':'loot')}">${esc(cash!==null?t.earn(cash):t.giveBtn)}</button>`};
function closeDialog(){try{const d=document.querySelector('#gt-give');if(d){d.close?.();d.remove()}}catch{}}
function openDialog(what){
 const app=window.App,state=app?.getState?.(),lang=L(state?.lang),t=T[lang],chars=Array.isArray(state?.characters)?state.characters:[];
 if(!chars.length){app?.notify?.(t.noChars);return}
 const item=what.item?(Array.isArray(window.CATALOG)?window.CATALOG:[]).find(x=>x&&x.id===what.item):null;
 if(!item&&!what.cash)return;
 closeDialog();
 // Characters of the campaigns come first: they are the ones at the table.
 const inPlay=new Set((state.campaigns||[]).flatMap(c=>(c?.roster||[]).filter(r=>r?.kind==='pc').map(r=>r.characterId))),sorted=[...chars].sort((x,y)=>Number(inPlay.has(y.id))-Number(inPlay.has(x.id)));
 const name=item?(item.name?.[lang]||item.name?.en||''):t.giveCash(what.cash),price=Number(item?.price),canSell=Number.isSafeInteger(price)&&price>0;
 const d=document.createElement('dialog');d.id='gt-give';d.className='gt-dialog';d.setAttribute('aria-labelledby','gt-give-title');
 d.innerHTML=`<form method="dialog"><h2 id="gt-give-title">${esc(t.giveTitle)}</h2><p class="gt-dialog-item">${esc(name)}${item&&canSell?` <span>${price} eb</span>`:''}</p><label class="field">${esc(t.recipient)}<select data-gt-recipient>${sorted.map(c=>`<option value="${esc(c.id)}"${c.id===lastRecipient?' selected':''}>${esc(c.name||'Edgerunner')} · ${esc(window.Wallet?.format?window.Wallet.format(window.Wallet.cash(c)):Number(c.extra?.cash)||0)} eb</option>`).join('')}</select></label><p class="gt-dialog-error" role="alert" hidden></p><div class="gt-dialog-actions">${item?`<button type="button" class="btn primary" data-gt-do="free">${esc(t.free)}</button>${canSell?`<button type="button" class="btn ghost" data-gt-do="sell">${esc(t.sell(price))}</button>`:''}`:`<button type="button" class="btn primary" data-gt-do="cash">${esc(t.earn(what.cash))}</button>`}<button type="button" class="btn ghost" data-gt-do="cancel">${esc(t.cancel)}</button></div></form>`;
 d.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-gt-do]');if(!b)return;
  const act=b.dataset.gtDo;if(act==='cancel'){closeDialog();return}
  const now=app.getState(),c=(now.characters||[]).find(x=>x.id===d.querySelector('[data-gt-recipient]').value),fail=m=>{const p=d.querySelector('.gt-dialog-error');p.textContent=m;p.hidden=false};
  if(!c)return fail(t.giveFail);
  const who=c.name||'Edgerunner',note=what.note==='market'?t.marketNote:t.lootNote;
  if(act==='cash'){const r=window.Wallet?.earn?.(c,what.cash,note);if(!r?.ok)return fail(t.giveFail);c.extra=r.extra;lastRecipient=c.id;app.save();closeDialog();app.notify(t.gaveCash(what.cash,who,r.balance));return}
  const r=giveItem(c,item,lang,{sell:act==='sell',note:note+': '+name});
  if(!r.ok)return fail(r.reason==='short'?t.short(who,r.short):t.giveFail);
  c.extra=r.extra;lastRecipient=c.id;app.save();closeDialog();app.notify(act==='sell'?t.soldItem(name,who,r.price,r.balance):t.gaveItem(name,who));
 });
 d.addEventListener('close',()=>{try{d.remove()}catch{}});
 document.body.appendChild(d);
 try{d.showModal()}catch{d.setAttribute('open','')}
}
if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('click',e=>{
 const b=e.target?.closest?.('[data-gt-give],[data-gt-give-cash]');
 if(b){openDialog({item:b.dataset.gtGive||'',cash:whole(b.dataset.gtGiveCash,1,999999999)||0,note:b.dataset.gtNote});return}
 // Remember that a sheet was opened from a campaign row, so its back link returns to the fight.
 const sheet=e.target?.closest?.('.camp-open[data-action="open"]');
 if(sheet)fromCampaign=sheet.dataset.id||null;
 else if(e.target?.closest?.('[data-action="navigate"],[data-action="open"]'))fromCampaign=null;
},true);

window.GMTable={text:T,weaponSkill,attacksOf,rollAttack,rollDamage,woundPenalty,hitNpc,hitPc,hitText,awardPlan,awardStage,giveItem,
 isOpen,open,rowClass,toggleHTML,headHTML,helpHTML,rowExtras,partyHTML,backLink,giveButton,owns,handle,
 reset(){rowOpen.clear();results.clear();drafts.clear();lastAward.clear();fromCampaign=null;lastRecipient=''}};
})();
