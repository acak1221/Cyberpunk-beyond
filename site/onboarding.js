/* First run: a short introduction, a ready-made sample character and a guided trial fight in the campaign tracker.
   The "seen" flag lives in its own localStorage key, outside the archive. The sample character is marked with extra.sample,
   the trial fight is an ordinary campaign with an optional `trial` record; both survive backup and restore. */
(function(){
'use strict';
const FLAG='nc-onboarding',STEPS=4,TRIAL_DV=13,ENEMY_TEMPLATE='boosterganger';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const L=lang=>lang==='en'?'en':'ru';
const T={
 ru:{
  count:(n,total)=>`Шаг ${n} из ${total}`,skip:'Пропустить',back:'Назад',next:'Далее',done:'Готово',
  steps:[
   ['Добро пожаловать в Найт-Сити','Это помощник для настольной игры Cyberpunk RED: листы персонажей, кубики, бой и справки по правилам. Всё хранится только в этом браузере — без регистрации. Для игры нужна ваша книга правил: здесь только краткие подсказки и номера страниц.'],
   ['Возьмите готового персонажа','Чтобы сразу посмотреть, как всё работает, добавьте готового соло одним нажатием. Его можно менять и удалить в любой момент. Своего персонажа вы создадите, когда захотите.'],
   ['Попробуйте бой','Пробный бой — это трекер инициативы с вашим персонажем и двумя противниками. Подсказки проведут по одному раунду: инициатива, атака, урон, следующий ход.'],
   ['Что дальше','На листе персонажа — проверки навыков, оружие и здоровье. В разделе «Правила» — краткие справки со страницами книги. В разделе «Персонажи» скачайте резервную копию: очистка данных браузера удалит всё. Это знакомство можно открыть снова внизу «Обзора».']
  ],
  addSample:'Добавить готового персонажа',openSample:'Открыть лист готового персонажа',sampleAdded:name=>`${name} уже в вашем списке персонажей.`,createOwn:'Создать своего',
  startTrial:'Начать пробный бой',continueTrial:'Продолжить пробный бой',
  entryTitle:'Знакомство и пробный бой',entryText:'Короткое знакомство с приложением, готовый персонаж для пробы и бой с подсказками.',reopen:'Показать знакомство',
  sampleFail:{paused:'Сейчас данные нельзя менять. Проверьте сообщение о хранилище вверху страницы.',storage:'Не хватило места в хранилище браузера: персонаж не добавлен.',invalid:'Не удалось добавить готового персонажа.'},
  sampleName:'Вега',sampleNative:'Английский',
  sampleNotes:'Готовый персонаж для знакомства с приложением: соло со стартовыми характеристиками и навыками роли (стр. 74 и 86). Меняйте что угодно или удалите его, когда создадите своего.',
  weaponNote:'Оружие готового персонажа; заряжено.',pistol:'Очень тяжёлый пистолет',rifle:'Штурмовая винтовка',
  trialName:'Пробный бой',trialNotes:'Учебный бой: ваш персонаж против двух противников. Следуйте подсказкам в блоке «Инициатива и бой». Когда закончите, кампанию можно удалить.',
  enemy:'Противник',fallbackWeapon:'Тяжёлый пистолет (условный)',
  trialCount:n=>`Пробный бой · шаг ${n} из 4`,trialDone:'Пробный бой · готово',hide:'Скрыть подсказки',show:'Показать, где это',
  initiativeTitle:'Бросьте инициативу',initiativeText:'В начале боя каждый участник бросает 1d10 и прибавляет REF. Чем больше результат, тем раньше ход. Нажмите «Бросить инициативу» — трекер бросит за всех и расставит по порядку.',
  waitTitle:'Сейчас ход противника',waitText:(who,pc)=>`Ходит ${who}. За противников действует ведущий; в пробном бою просто пропустите этот ход. Нажимайте «Следующий ход», пока очередь не дойдёт до персонажа ${pc}.`,
  attackTitle:'Атакуйте',attackText:(pc,weapon,base,target)=>`Ход персонажа ${pc}. Атака — это 1d10 + характеристика + навык против сложности (DV). ${weapon}: к броску прибавляется ${base}. В пробном бою DV ${TRIAL_DV} — как у пистолета на расстоянии до 6 м (стр. 173). Цель: ${target}.`,
  missed:total=>`Прошлый бросок: ${total} — мимо, нужно больше ${TRIAL_DV}. В настоящей игре на этом ход закончился бы; здесь бросьте ещё раз.`,
  rollAttack:'Бросить атаку',rollAgain:'Бросить атаку заново',
  damageTitle:'Нанесите урон',damageText:(total,dice,damage,target)=>`Попадание: ${total} против DV ${TRIAL_DV}. Урон ${dice}: ${damage}. У участника ${target} откройте «Действия», введите ${damage} в поле «Урон» и нажмите «Применить урон». Трекер сам вычтет броню (SP) и уменьшит её на 1.`,
  critNote:'На кубиках урона выпали две шестёрки: в настоящей игре это ещё и критическое ранение (стр. 187).',
  stoppedNote:'Если броня остановила весь урон, бросьте атаку заново.',
  nextTitle:'Передайте ход',nextText:(target,hp)=>`Урон записан: у участника ${target} осталось ${hp} HP. Ваш ход окончен — нажмите «Следующий ход».`,
  doneTitle:'Раунд пройден',doneText:'Вы бросили инициативу, атаковали, нанесли урон и передали ход. Так проходит каждый ход в бою. Продолжайте сами или уберите пробный бой.',
  brokenTitle:'Пробный бой изменился',brokenText:'В нём не осталось вашего персонажа или противников, поэтому подсказки больше не подходят.',
  remove:'Убрать пробный бой',keep:'Оставить бой без подсказок',confirmRemove:'Удалить пробный бой? Персонажи останутся.',
  attackLabel:(pc,weapon)=>`${pc}: атака · ${weapon}`,damageLabel:(pc,weapon)=>`${pc}: урон · ${weapon}`,
  attackNotice:(total,detail,hit)=>`Атака: ${total} против DV ${TRIAL_DV} — ${hit?'попадание':'мимо'}\n${detail}`,damageNotice:(dice,rolls,damage)=>`Урон ${dice}: ${rolls} = ${damage}`,
  critSuccess:'критический успех',critFailure:'критический провал'
 },
 en:{
  count:(n,total)=>`Step ${n} of ${total}`,skip:'Skip',back:'Back',next:'Next',done:'Done',
  steps:[
   ['Welcome to Night City','This is a helper for the Cyberpunk RED tabletop game: character sheets, dice, combat and rules references. Everything stays in this browser only — no sign-up. You need your own rulebook to play: this app gives short hints and page numbers.'],
   ['Take a ready-made character','To see how things work right away, add a ready-made Solo with one tap. You can change or delete it at any time. Build your own character whenever you like.'],
   ['Try a fight','The trial fight is the initiative tracker with your character and two enemies. Hints walk you through one round: initiative, attack, damage, next turn.'],
   ['What next','The character sheet has skill checks, weapons and health. Rules has short references with book pages. Download a backup from Characters: clearing browser data deletes everything. You can open this introduction again at the bottom of the Overview.']
  ],
  addSample:'Add the ready-made character',openSample:'Open the ready-made character sheet',sampleAdded:name=>`${name} is already in your character list.`,createOwn:'Create your own',
  startTrial:'Start the trial fight',continueTrial:'Continue the trial fight',
  entryTitle:'Introduction and trial fight',entryText:'A short introduction to the app, a ready-made character to try, and a fight with hints.',reopen:'Show the introduction',
  sampleFail:{paused:'Data cannot be changed right now. Check the storage message at the top of the page.',storage:'Browser storage is full: the character was not added.',invalid:'Could not add the ready-made character.'},
  sampleName:'Vega',sampleNative:'English',
  sampleNotes:'A ready-made character for getting to know the app: a Solo with starting STATs and Role skills (pp. 74 and 86). Change anything, or delete it once you have your own.',
  weaponNote:'Ready-made character weapon; loaded.',pistol:'Very Heavy Pistol',rifle:'Assault Rifle',
  trialName:'Trial fight',trialNotes:'A practice fight: your character against two enemies. Follow the hints in the Initiative & Combat block. Delete the campaign when you are done.',
  enemy:'Enemy',fallbackWeapon:'Heavy Pistol (stand-in)',
  trialCount:n=>`Trial fight · step ${n} of 4`,trialDone:'Trial fight · done',hide:'Hide hints',show:'Show me where',
  initiativeTitle:'Roll initiative',initiativeText:'At the start of a fight everyone rolls 1d10 and adds REF. The higher the result, the earlier the turn. Press “Roll initiative” — the tracker rolls for everyone and sorts the order.',
  waitTitle:'It is an enemy’s turn',waitText:(who,pc)=>`${who} is acting. The GM plays the enemies; in the trial fight just skip this turn. Press “Next turn” until it is ${pc}’s turn.`,
  attackTitle:'Attack',attackText:(pc,weapon,base,target)=>`It is ${pc}’s turn. An attack is 1d10 + STAT + skill against a difficulty value (DV). ${weapon}: add ${base} to the roll. In the trial fight the DV is ${TRIAL_DV} — a pistol within 6 m (p. 173). Target: ${target}.`,
  missed:total=>`Last roll: ${total} — a miss, you need more than ${TRIAL_DV}. In a real game the turn would end here; in the trial just roll again.`,
  rollAttack:'Roll the attack',rollAgain:'Roll the attack again',
  damageTitle:'Apply damage',damageText:(total,dice,damage,target)=>`Hit: ${total} against DV ${TRIAL_DV}. Damage ${dice}: ${damage}. Open “Actions” on ${target}, enter ${damage} in “Damage” and press “Apply damage”. The tracker subtracts armor (SP) and lowers it by 1.`,
  critNote:'Two sixes came up on the damage dice: in a real game that is also a Critical Injury (p. 187).',
  stoppedNote:'If armor stopped all of the damage, roll the attack again.',
  nextTitle:'Pass the turn',nextText:(target,hp)=>`Damage recorded: ${target} has ${hp} HP left. Your turn is over — press “Next turn”.`,
  doneTitle:'Round complete',doneText:'You rolled initiative, attacked, applied damage and passed the turn. Every turn in a fight goes like this. Carry on by yourself or remove the trial fight.',
  brokenTitle:'The trial fight has changed',brokenText:'Your character or the enemies are no longer in it, so the hints do not fit any more.',
  remove:'Remove the trial fight',keep:'Keep the fight without hints',confirmRemove:'Delete the trial fight? Your characters stay.',
  attackLabel:(pc,weapon)=>`${pc}: attack · ${weapon}`,damageLabel:(pc,weapon)=>`${pc}: damage · ${weapon}`,
  attackNotice:(total,detail,hit)=>`Attack: ${total} against DV ${TRIAL_DV} — ${hit?'hit':'miss'}\n${detail}`,damageNotice:(dice,rolls,damage)=>`Damage ${dice}: ${rolls} = ${damage}`,
  critSuccess:'critical success',critFailure:'critical failure'
 }
};

// ---- "Seen" flag ------------------------------------------------------------------------------------------------
// open: null = decide automatically, true = shown on request or in progress, false = closed in this session.
let open=null,step=0,seen=null,lastStep=null;
function dismissed(){if(seen===null){try{seen=localStorage.getItem(FLAG)==='done'}catch{seen=false}}return seen}
function dismiss(){seen=true;open=false;step=0;try{localStorage.setItem(FLAG,'done')}catch{}}
const list=x=>Array.isArray(x)?x:[];
// The introduction opens by itself only on a truly empty app: no characters, campaigns, bin or set-aside records.
function shouldShow(state,flags={}){
 if(flags.open===true)return true;
 if(flags.open===false||flags.dismissed)return false;
 return !!state&&!list(state.characters).length&&!list(state.campaigns).length&&!list(state.bin).length&&!list(state.quarantine).length;
}

// ---- Sample character -------------------------------------------------------------------------------------------
// A Solo built the Streetrat way: one row of the Role's STAT table and the Role's fixed skill levels (pp. 74, 86).
const SAMPLE_STATS={INT:5,REF:8,DEX:7,TECH:4,COOL:7,WILL:7,LUCK:6,MOVE:7,BODY:8,EMP:5};
const SAMPLE_SKILLS={Athletics:2,Brawling:2,Concentration:2,Conversation:2,Education:2,Evasion:6,'First Aid':6,'Human Perception':2,'Language (Streetslang)':2,'Local Expert (Home)':2,Perception:6,Persuasion:2,Stealth:2,Autofire:6,Handgun:6,Interrogation:6,'Melee Weapon':6,'Resist Torture/Drugs':6,'Shoulder Arms':6,Tactics:6};
function sampleCharacter(lang){
 const t=T[L(lang)],hp=10+5*Math.ceil((SAMPLE_STATS.BODY+SAMPLE_STATS.WILL)/2);
 const weapon=(id,catalogId,name,skill,damage,rof,capacity)=>({id,catalogId,name,skill,stat:'REF',modifier:0,damage,rof,capacity,ammo:capacity,ammoCost:1,usesAmmo:true,notes:t.weaponNote});
 return {name:t.sampleName,role:'solo',rank:4,stats:{...SAMPLE_STATS},skills:{...SAMPLE_SKILLS},hp,humanity:SAMPLE_STATS.EMP*10,head:11,bodyArmor:11,native:t.sampleNative,gear:'',cyberware:'',notes:t.sampleNotes,
  extra:{sample:true,cash:500,gearBudget:0,fashionBudget:0,nativeLevel:4,weapons:[weapon('sample-vh-pistol','weapon-very-heavy-pistol',t.pistol,'Handgun','4d6',1,8),weapon('sample-assault-rifle','weapon-assault-rifle',t.rifle,'Shoulder Arms','5d6',1,25)]}};
}
const isSample=c=>!!c&&typeof c==='object'&&c.extra?.sample===true;
const findSample=characters=>list(characters).find(isSample)||null;

// ---- Trial fight ------------------------------------------------------------------------------------------------
const newId=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const isTrial=c=>!!c&&typeof c==='object'&&!!c.trial&&typeof c.trial==='object'&&!Array.isArray(c.trial);
// The same order as campaigns.js: initiative, then tie-break rolls, then insertion order.
function ordered(c){return [...list(c?.roster)].sort((a,b)=>{let n=(Number(b?.initiative)||0)-(Number(a?.initiative)||0);if(n)return n;const x=list(a?.ties),y=list(b?.ties);for(let i=0;i<Math.max(x.length,y.length);i++){n=(Number(y[i])||0)-(Number(x[i])||0);if(n)return n}return (Number(a?.order)||0)-(Number(b?.order)||0)})}
// A campaign with the player's character and two enemies. Enemies come from the book template when the GM module has it;
// otherwise two plain stand-ins with the numbers of a street-level opponent.
function buildTrial(lang,characterId,{now=Date.now(),id=newId,campaigns=window.Campaigns}={}){
 const t=T[L(lang)],c={id:id(),name:t.trialName,notes:t.trialNotes,round:1,turnIndex:0,roster:[{id:id(),kind:'pc',characterId,initiative:0,order:now}],trial:{version:1}};
 let added=false;try{added=campaigns?.addTemplates?.(c,ENEMY_TEMPLATE,2,L(lang))?.ok===true}catch{}
 if(!added){c.roster=c.roster.filter(r=>r.kind==='pc');for(let i=1;i<=2;i++)c.roster.push({id:id(),kind:'npc',name:`${t.enemy} ${i}`,ref:6,hp:20,maxHp:20,initiative:0,order:now+i,sp:{head:4,body:4},body:4})}
 return c;
}
function trialParts(c,characters){
 const roster=ordered(c),pcRow=roster.find(r=>r?.kind==='pc'&&list(characters).some(p=>p?.id===r.characterId))||null,pc=pcRow?list(characters).find(p=>p.id===pcRow.characterId):null,npcs=roster.filter(r=>r?.kind==='npc');
 const alive=npcs.filter(r=>r.dead!==true&&r.out!==true&&(Number(r.hp)||0)>0),a=c?.trial?.attack,attack=a&&typeof a==='object'&&!Array.isArray(a)&&Number.isFinite(a.total)?a:null;
 const target=(attack&&npcs.find(r=>r.id===attack.target))||alive[0]||npcs[0]||null,current=roster[Number(c?.turnIndex)||0]||null;
 return {roster,pcRow,pc,npcs,target,current,attack};
}
// Where the player is in the guided round. Everything is read from the campaign itself, so a reload continues the lesson.
// null: not a trial fight. 'broken': the fight no longer has the player's character or an enemy.
function trialStep(c,characters){
 if(!isTrial(c))return null;
 const p=trialParts(c,characters);
 if(c.trial.done===true)return 'done';
 if(!p.pcRow||!p.npcs.length)return 'broken';
 if(p.roster.every(r=>!(Number(r?.initiative)||0)))return 'initiative';
 if(!p.attack||p.attack.hit!==true)return p.current===p.pcRow?'attack':'wait';
 const hit=p.npcs.find(r=>r.id===p.attack.target);
 if(hit&&(Number(hit.hp)||0)>=Number(p.attack.hpBefore))return 'damage';
 if((Number(c.turnIndex)||0)===p.attack.turnIndex&&(Number(c.round)||1)===p.attack.round)return 'next';
 return 'done';
}
const STEP_NUMBER={initiative:1,wait:2,attack:2,damage:3,next:4};
// One attack: 1d10 + base, a 10 adds another d10, a 1 subtracts one. The attack must beat the DV.
function rollAttack(base,dv,rng=Math.random){
 const d=()=>1+Math.floor(rng()*10),first=d(),extra=first===1||first===10?d():0,total=first+(first===1?-extra:extra)+(Number(base)||0);
 return {first,extra,total,hit:total>dv};
}
function rollDamage(count,rng=Math.random){
 const n=Math.max(1,Math.min(10,Math.floor(Number(count))||1)),rolls=Array.from({length:n},()=>1+Math.floor(rng()*6));
 return {rolls,total:rolls.reduce((a,b)=>a+b,0),critical:rolls.filter(x=>x===6).length>=2};
}
// The weapon used in the lesson: the character's first weapon with plain d6 damage, or a stand-in pistol.
function trialWeapon(pc,lang,app=window.App){
 const found=list(pc?.extra?.weapons).find(w=>w&&typeof w==='object'&&/^\d{1,2}d6$/.test(String(w.damage))&&typeof w.skill==='string'&&typeof w.name==='string'&&w.name.trim());
 const w=found||{name:T[L(lang)].fallbackWeapon,skill:'Handgun',stat:'REF',damage:'3d6',modifier:0},stat=['REF','DEX'].includes(w.stat)?w.stat:'REF',level=Number(pc?.skills?.[w.skill])||0;
 let base=NaN;try{base=Number(app?.checkBonus?.(pc,stat,level))}catch{}
 if(!Number.isFinite(base))base=(Number(pc?.stats?.[stat])||0)+level;
 return {name:w.name.trim().slice(0,80),dice:parseInt(w.damage,10),damage:`${parseInt(w.damage,10)}d6`,base:base+Math.max(-20,Math.min(20,Number(w.modifier)||0))};
}

// ---- Views ------------------------------------------------------------------------------------------------------
function intro(state){
 const lang=L(state?.lang),t=T[lang],characters=list(state?.characters);
 if(open===null&&!dismissed()&&characters.length)dismiss(); // a player who already has characters never gets it by itself
 if(!shouldShow(state,{open,dismissed:dismissed()}))return '';
 const i=Math.max(0,Math.min(STEPS-1,step)),[title,body]=t.steps[i],sample=findSample(characters),trial=list(state?.campaigns).some(isTrial);
 const actions=i===1?`<div class="ob-actions">${sample?`<p class="ob-ok" role="status">✓ ${esc(t.sampleAdded(sample.name||t.sampleName))}</p><button type="button" class="btn ghost" data-ob="open-sample">${t.openSample} ↗</button>`:`<button type="button" class="btn primary" data-ob="add-sample">＋ ${t.addSample}</button><button type="button" class="btn ghost" data-action="new">${t.createOwn} ↗</button>`}</div>`
  :i===2?`<div class="ob-actions"><button type="button" class="btn primary" data-ob="start-trial">⬡ ${trial?t.continueTrial:t.startTrial}</button></div>`:'';
 return `<section class="ob-card ob-intro" data-ob-intro aria-labelledby="ob-intro-title"><div class="ob-head"><span class="ob-count">${t.count(i+1,STEPS)}</span><button type="button" class="ob-link" data-ob="skip">${t.skip} ✕</button></div><h2 id="ob-intro-title" tabindex="-1">${esc(title)}</h2><p>${esc(body)}</p>${actions}<div class="ob-nav">${i?`<button type="button" class="btn ghost" data-ob="back">← ${t.back}</button>`:'<span></span>'}<span class="ob-dots" aria-hidden="true">${t.steps.map((_,n)=>`<i${n===i?' class="on"':''}></i>`).join('')}</span>${i<STEPS-1?`<button type="button" class="btn ${i===1&&!sample||i===2?'ghost':'primary'}" data-ob="next">${t.next} →</button>`:`<button type="button" class="btn primary" data-ob="finish">${t.done}</button>`}</div></section>`;
}
// The way back in from the overview, for everyone and at any time.
function entry(state){
 const lang=L(state?.lang),t=T[lang];
 if(shouldShow(state,{open,dismissed:dismissed()||list(state?.characters).length>0}))return '';
 const sample=findSample(state?.characters),trial=list(state?.campaigns).some(isTrial);
 return `<details class="ob-entry"><summary>${t.entryTitle}</summary><p>${t.entryText}</p><div class="ob-actions"><button type="button" class="btn ghost" data-ob="reopen">${t.reopen}</button><button type="button" class="btn ghost" data-ob="${sample?'open-sample':'add-sample'}">${sample?t.openSample+' ↗':'＋ '+t.addSample}</button><button type="button" class="btn ghost" data-ob="start-trial">⬡ ${trial?t.continueTrial:t.startTrial}</button></div></details>`;
}
function trialHint(c,characters,lang){
 const s=trialStep(c,characters);if(!s)return '';
 const t=T[L(lang)],p=trialParts(c,characters),nameOf=r=>!r?'—':r.kind==='pc'?(list(characters).find(x=>x.id===r.characterId)?.name||'Edgerunner'):r.name||t.enemy,pcName=p.pc?.name||'Edgerunner';
 const btn=(action,label,cls='ghost')=>`<button type="button" class="btn ${cls}" data-ob="${action}">${label}</button>`,show=btn('trial-show',t.show+' ↓','primary');
 let title,body,actions;
 if(s==='initiative'){title=t.initiativeTitle;body=esc(t.initiativeText);actions=show}
 else if(s==='wait'){title=t.waitTitle;body=esc(t.waitText(nameOf(p.current),pcName));actions=show}
 else if(s==='attack'){const w=trialWeapon(p.pc,lang);title=t.attackTitle;body=esc(t.attackText(pcName,w.name,w.base,nameOf(p.target)))+(p.attack?`</p><p class="ob-note">${esc(t.missed(p.attack.total))}`:'');actions=btn('trial-attack','⬡ '+(p.attack?t.rollAgain:t.rollAttack),'primary')}
 else if(s==='damage'){title=t.damageTitle;body=esc(t.damageText(p.attack.total,String(p.attack.dice||''),Number(p.attack.damage)||0,nameOf(p.target)))+`</p><p class="ob-note">${p.attack.critical===true?esc(t.critNote)+' ':''}${esc(t.stoppedNote)}`;actions=show+btn('trial-attack','⬡ '+t.rollAgain)}
 else if(s==='next'){title=t.nextTitle;body=esc(t.nextText(nameOf(p.target),Number(p.target?.hp)||0));actions=show}
 else if(s==='done'){title=t.doneTitle;body=esc(t.doneText);actions=btn('trial-keep',t.keep,'primary')+btn('trial-remove','✕ '+t.remove)}
 else{title=t.brokenTitle;body=esc(t.brokenText);actions=btn('trial-remove','✕ '+t.remove,'primary')}
 return `<section class="ob-card ob-trial" data-ob-trial data-ob-step="${s}" aria-labelledby="ob-trial-title"><div class="ob-head"><span class="ob-count">${STEP_NUMBER[s]?t.trialCount(STEP_NUMBER[s]):t.trialDone}</span>${s==='done'||s==='broken'?'':`<button type="button" class="ob-link" data-ob="trial-hide">${t.hide} ✕</button>`}</div><h2 id="ob-trial-title" tabindex="-1">${esc(title)}</h2><p>${body}</p><div class="ob-actions">${actions}</div></section>`;
}

// ---- Actions ----------------------------------------------------------------------------------------------------
const app=()=>window.App;
const doc=()=>typeof document==='undefined'?null:document;
function focusOn(selector){const el=doc()?.querySelector?.(selector);if(!el)return false;try{el.focus?.({preventScroll:true});el.scrollIntoView?.({block:'center',behavior:'smooth'})}catch{}return true}
function addSample(){
 const A=app(),state=A?.getState?.();if(!state)return {ok:false,reason:'invalid'};
 const existing=findSample(state.characters);if(existing)return {ok:true,id:existing.id,existing:true};
 let result;try{result=A.importCharacter(sampleCharacter(state.lang),{})}catch{result=null}
 return result&&result.ok?result:{ok:false,reason:result?.reason||'invalid'};
}
function failText(lang,reason){const f=T[L(lang)].sampleFail;return f[reason]||f.invalid}
function openCampaign(id){
 const d=doc(),host=d?.querySelector?.('#app');if(!host||!d.createElement)return false;
 const b=d.createElement('button');b.dataset.campaignAction='open';b.dataset.id=id;b.hidden=true;host.appendChild(b);b.click();b.remove?.();return true;
}
function startTrial(){
 const A=app();let state=A?.getState?.();if(!state)return false;
 let c=list(state.campaigns).find(isTrial);
 if(!c){
  let pc=findSample(state.characters)||list(state.characters)[0];
  if(!pc){const r=addSample();state=A.getState();if(!r.ok){A.notify?.(failText(state.lang,r.reason));return false}pc=list(state.characters).find(x=>x.id===r.id)}
  if(!pc||!Array.isArray(state.campaigns))return false;
  c=buildTrial(state.lang,pc.id);state.campaigns.unshift(c);A.save?.();
 }
 dismiss();lastStep=trialStep(c,state.characters);
 A.setView?.('campaigns');openCampaign(c.id);focusOn('#ob-trial-title');return true;
}
// The campaign shown on the page right now, when it is a trial fight.
function shownTrial(){
 const id=doc()?.querySelector?.('[data-campaign-view]')?.dataset?.campaignView,state=app()?.getState?.(),c=id?list(state?.campaigns).find(x=>x?.id===id):null;
 return c&&isTrial(c)?{c,state}:null;
}
function showControl(c,state){
 const s=trialStep(c,state.characters),d=doc();if(!d)return;
 if(s==='initiative')return focusOn('[data-campaign-view] [data-campaign-action="roll-all"]');
 if(s==='wait'||s==='next')return focusOn('[data-campaign-view] [data-campaign-action="next"]');
 if(s==='damage'){
  const p=trialParts(c,state.characters),apply=[...(d.querySelectorAll?.('[data-campaign-view] [data-campaign-action="damage"]')||[])].find(b=>b.dataset?.id===p.target?.id),row=apply?.closest?.('.combatant'),box=apply?.closest?.('details'),field=row?.querySelector?.('[data-camp-dmg]');
  if(!field)return;if(box)box.open=true;field.value=String(Number(p.attack.damage)||0);
  try{field.focus({preventScroll:true});row.scrollIntoView({block:'center',behavior:'smooth'})}catch{}
 }
}
function attack(c,state,rng){
 const A=app(),t=T[L(state.lang)],p=trialParts(c,state.characters),s=trialStep(c,state.characters);
 if(!['attack','damage'].includes(s)||!p.pc||!p.target)return false;
 const w=trialWeapon(p.pc,state.lang),roll=rollAttack(w.base,TRIAL_DV,rng),pcName=p.pc.name||'Edgerunner';
 const detail=`1d10 ${roll.first}${roll.extra?` ${roll.first===1?'−':'+'} ${roll.extra} (${roll.first===1?t.critFailure:t.critSuccess})`:''} + ${w.base} = ${roll.total} / DV ${TRIAL_DV}`;
 const record={total:roll.total,hit:roll.hit,target:p.target.id,hpBefore:Number(p.target.hp)||0,turnIndex:Number(c.turnIndex)||0,round:Number(c.round)||1};
 let notice=t.attackNotice(roll.total,detail,roll.hit);
 try{A.report?.(t.attackLabel(pcName,w.name),detail,roll.total,[{v:roll.first,s:10},...(roll.extra?[{v:roll.extra,s:10}]:[])])}catch{}
 if(roll.hit){const dmg=rollDamage(w.dice,rng);Object.assign(record,{dice:w.damage,damage:dmg.total,critical:dmg.critical});notice+='\n'+t.damageNotice(w.damage,dmg.rolls.join(' + '),dmg.total);
  try{A.report?.(t.damageLabel(pcName,w.name),dmg.rolls.join(' + '),dmg.total,dmg.rolls.map(v=>({v,s:6})))}catch{}}
 c.trial={...c.trial,version:1,attack:record};A.save?.();A.render?.();A.notify?.(notice);return true;
}
function removeTrial(c,state){
 const A=app(),ask=typeof confirm==='function'?confirm:()=>true;
 if(!ask(T[L(state.lang)].confirmRemove))return false;
 const now=A.getState(),i=list(now.campaigns).indexOf(c);if(i<0)return false;
 doc()?.querySelector?.('[data-campaign-action="back"]')?.click?.();now.campaigns.splice(i,1);A.save?.();A.render?.();return true;
}
function handle(e,rng){
 const b=e?.target?.closest?.('[data-ob]');if(!b)return false;
 const A=app(),state=A?.getState?.();if(!state)return false;
 const a=b.dataset.ob,redraw=()=>{A.render?.();focusOn('#ob-intro-title')};
 if(a==='next'||a==='back'){open=true;step=Math.max(0,Math.min(STEPS-1,step+(a==='next'?1:-1)));redraw()}
 else if(a==='skip'||a==='finish'){dismiss();A.render?.();focusOn('.ob-entry summary')}
 else if(a==='reopen'){open=true;step=0;redraw()}
 else if(a==='add-sample'){const inIntro=!!b.closest?.('[data-ob-intro]');if(inIntro)open=true;const r=addSample();if(!r.ok){A.notify?.(failText(state.lang,r.reason));return true}if(inIntro)redraw();else A.open?.(r.id)}
 else if(a==='open-sample'){const c=findSample(state.characters);if(c){if(b.closest?.('[data-ob-intro]'))dismiss();A.open?.(c.id)}}
 else if(a==='start-trial')startTrial();
 else if(a.startsWith('trial-')){
  const shown=shownTrial();if(!shown)return true;const {c}=shown;
  if(a==='trial-show')showControl(c,state);
  else if(a==='trial-attack'){if(attack(c,state,rng)){lastStep=trialStep(c,state.characters);if(lastStep==='damage')showControl(c,state);else focusOn('#ob-trial-title')}}
  else if(a==='trial-hide'||a==='trial-keep'){delete c.trial;A.save?.();A.render?.()}
  else if(a==='trial-remove')removeTrial(c,state);
 }else return false;
 return true;
}
// After a tracker action the lesson may have moved on: bring the new hint into view.
function follow(){
 const shown=shownTrial();if(!shown){lastStep=null;return}
 const s=trialStep(shown.c,shown.state.characters);if(s!==lastStep){const first=lastStep===null;lastStep=s;if(!first)focusOn('#ob-trial-title')}
}
const d0=doc();
if(d0?.addEventListener)d0.addEventListener('click',e=>{if(handle(e))return;if(e.target?.closest?.('[data-campaign-action]'))setTimeout(follow,0)});

window.Onboarding={intro,entry,trialHint,handle,shouldShow,sampleCharacter,isSample,findSample,buildTrial,isTrial,trialStep,rollAttack,rollDamage,trialWeapon,TRIAL_DV,FLAG,
 _reset(){open=null;step=0;seen=null;lastStep=null}};
})();
