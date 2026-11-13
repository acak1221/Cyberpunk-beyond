/* Allies, loot and the player's Death Save in the GM tracker (campaigns.js, gm-table.js call into this module).
   - an Exec's team members and a Lawman's backup officers join the fight as allied rows; their HP and SP are written back to the sheet;
   - loot of a dead or removed NPC goes to a character's inventory (to a player in the room: as an offer through RoomGrants);
   - a player's Death Save is rolled from the tracker row with the sheet's own functions (CharacterExtra.deathSaveStart / deathSaveResolve).
   Part 1 is pure (it changes only the objects it is given) and is covered by tests; part 2 builds HTML; part 3 handles the clicks.
   Everything new is stored inside the campaign: roster[i].ally, roster[i].lootTaken, campaign.lootPile. */
(function(){
'use strict';
const T={
 ru:{
  team:'КОМАНДА',backup:'ПОДКРЕПЛЕНИЕ',toFight:'В бой',allToFight:'Вся команда в бой',inFight:'в бою',
  noProfile:'Сотрудники без профиля из книги не имеют характеристик — добавьте их как обычного противника.',
  onSite:'на месте',enRoute:n=>`в пути, раундов: ${n}`,officers:n=>`бойцов ${n}`,
  teamLine:(name,hp,max,sp)=>`${name} · HP ${hp}/${max} · SP ${sp}`,
  backupLine:(tier,n,combat,sp,hp)=>`${tier} · бойцов ${n} · Combat Number ${combat} · SP ${sp} · HP ${hp}`,
  arrive:n=>`Прибудет через ${n} раунд(а)`,backupName:(who,i)=>`Подкрепление · ${who} № ${i}`,
  allyCaption:who=>`СОЮЗНИК · ${who}`,
  roomHint:'Лист у игрока в комнате: HP союзников с листа не обновляется отсюда.',
  added:list=>`Добавлены в бой: ${list}`,addedJournal:list=>`Союзники в бою: ${list}`,addFail:'Не удалось добавить: уже в бою или нет данных на листе.',
  death:target=>`⬡ Death Save < ${target}`,penalty:n=>`штраф ${n}`,deathOnline:'Игрок в комнате: Death Save бросается на его листе.',deathNone:'Death Save сейчас не нужен.',
  deathJournal:line=>`Death Save: ${line}`,
  loot:n=>`Забрать добычу (${n})`,lootClose:'Скрыть добычу',lootTitle:'ДОБЫЧА',lootCatalog:'из каталога',lootPlain:'как предмет',to:'Кому',inRoom:'в комнате',
  give:'Отдать выбранное',drop:'Убрать',dropSure:'Точно убрать?',noRecipient:'Добавьте персонажа в кампанию, чтобы отдать добычу.',
  pickItems:'Отметьте предметы.',pickWho:'Выберите, кому отдать.',giveFail:'Не удалось отдать: лист несовместим. Ничего не изменено.',
  lootNote:'Добыча',lootLine:(from,to,list)=>`Добыча (${from}) → ${to}: ${list}`,lootSkipped:list=>` Не отправлено: ${list}.`,lootBack:n=>`Игрок отказался: ${n}. Предмет возвращён в общую добычу.`,dropped:'Добыча убрана.',
  pileHelp:'Что осталось от убранных противников. Отдайте персонажу или уберите.'
 },
 en:{
  team:'TEAM',backup:'BACKUP',toFight:'Join the fight',allToFight:'The whole team joins',inFight:'in the fight',
  noProfile:'Team members without a book profile have no stats — add them as an ordinary opponent.',
  onSite:'on site',enRoute:n=>`on the way, rounds: ${n}`,officers:n=>`officers ${n}`,
  teamLine:(name,hp,max,sp)=>`${name} · HP ${hp}/${max} · SP ${sp}`,
  backupLine:(tier,n,combat,sp,hp)=>`${tier} · officers ${n} · Combat Number ${combat} · SP ${sp} · HP ${hp}`,
  arrive:n=>`Arrives in ${n} round(s)`,backupName:(who,i)=>`Backup · ${who} #${i}`,
  allyCaption:who=>`ALLY · ${who}`,
  roomHint:'The sheet belongs to a player in the room: allies’ HP is not updated on it from here.',
  added:list=>`Joined the fight: ${list}`,addedJournal:list=>`Allies in the fight: ${list}`,addFail:'Could not add: already in the fight or the sheet has no data.',
  death:target=>`⬡ Death Save < ${target}`,penalty:n=>`penalty ${n}`,deathOnline:'The player is in the room: the Death Save is rolled on their sheet.',deathNone:'No Death Save is needed now.',
  deathJournal:line=>`Death Save: ${line}`,
  loot:n=>`Take the loot (${n})`,lootClose:'Hide the loot',lootTitle:'LOOT',lootCatalog:'from the catalog',lootPlain:'as an item',to:'To',inRoom:'in the room',
  give:'Give the chosen',drop:'Discard',dropSure:'Really discard?',noRecipient:'Add a character to the campaign to hand out loot.',
  pickItems:'Tick some items.',pickWho:'Choose who gets it.',giveFail:'Could not give it: the sheet is incompatible. Nothing was changed.',
  lootNote:'Loot',lootLine:(from,to,list)=>`Loot (${from}) → ${to}: ${list}`,lootSkipped:list=>` Not sent: ${list}.`,lootBack:n=>`The player declined: ${n}. The item is back in the loot pile.`,dropped:'The loot was discarded.',
  pileHelp:'What is left of removed opponents. Give it to a character or discard it.'
 }
};
const L=lang=>lang==='en'?'en':'ru';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const newId=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const MAX_ROSTER=2045,PILE_MAX=120,ITEMS_MAX=30,TAKEN_MAX=60;

// Weapons of a backup tier, damage from the weapon table (p. 171ff); the same gear as RoleTools backupGear.
const BACKUP_WEAPONS={1:[['Heavy Pistol','3d6']],3:[['Heavy Pistol','3d6']],5:[['Heavy Pistol','3d6'],['Assault Rifle','5d6']],
 8:[['Very Heavy Pistol','4d6'],['Assault Rifle','5d6'],['Grenade Launcher','6d6']],9:[['Assault Rifle','5d6'],['Rocket Launcher','8d6']],
 10:[['Very Heavy Pistol','4d6'],['Assault Rifle','5d6']]};
// Names of the book NPCs that differ from the catalog, where the match is certain.
const ALIASES={'leather':'armor-leathers','disposable cellphone':'gear-disposable-cell-phone','crossbow':'weapon-bows-crossbows','rope':'gear-rope-60m-yds','bulletproof shield (10 hp)':'armor-bulletproof-shield','radio scanner/music player':'gear-radio-scanner-music-player','homing tracers':'gear-homing-tracer'};
const IMPLANT=/^(cyber|neural link|popup|grafted|subdermal|interface plugs)/i;

const RK=()=>window.RoleKit,CE=()=>window.CharacterExtra,PC=()=>window.PlayCombat;
const norm=s=>String(s??'').toLowerCase().replace(/\s+/g,' ').trim();
const catalogOf=()=>Array.isArray(window.CATALOG)?window.CATALOG:[];

// ---------- 1. pure part ----------

const validAlly=r=>!!r&&isObj(r.ally)&&r.ally.v===1&&(r.ally.from==='exec'||r.ally.from==='backup')&&typeof r.ally.characterId==='string'&&!!r.ally.characterId;
const readTeam=pc=>{const t=pc?.extra?.roleTools?.exec?.team;return Array.isArray(t)?t:[]};
const brawlDice=body=>body<=4?1:body<=6?2:body<=10?3:4;

function execRow(pc,m,st,lang,order){
 const ru=L(lang)==='ru',p=st.profile,job=window.RoleTools?.data?.execJobs?.[m.execProfile?.job],skills=RK().memberSkills(p);
 const name=(String(m.name||'').trim()||String(job?.name?.[ru?0:1]||'Exec')).slice(0,100);
 const ref=Number(p.stats.REF)||0,body=Number(p.stats.BODY)||0,attacks=[];
 const hand=skills.find(s=>s.key==='Handgun'),brawl=skills.find(s=>s.key==='Brawling');
 if(hand)attacks.push({name:'Very Heavy Pistol',base:hand.total,damage:'4d6'});
 if(brawl)attacks.push({name:'Brawling',base:brawl.total,damage:brawlDice(body)+'d6'});
 return {id:newId(),kind:'npc',name,ref,hp:st.hp,maxHp:st.max,initiative:0,order,sp:{head:st.sp,body:st.sp},body,
  ally:{v:1,from:'exec',characterId:pc.id,memberId:m.id,hp:st.hp,sp:st.sp,attacks}};
}
function backupRow(pc,st,index,lang,order){
 const tier=st.tier,tt=T[L(lang)],weapons=BACKUP_WEAPONS[tier.min]||[];
 const row={id:newId(),kind:'npc',name:tt.backupName(pc.name||'Edgerunner',index+1).slice(0,100),ref:6,hp:st.hp[index],maxHp:tier.hp,initiative:0,order,sp:{head:tier.sp,body:tier.sp},body:tier.body,
  ally:{v:1,from:'backup',characterId:pc.id,tier:tier.min,index,hp:st.hp[index],attacks:weapons.map(([name,damage])=>({name,base:tier.combat,damage}))}};
 if(st.rounds>0){row.out=true;row.combatNote={version:1,text:tt.arrive(st.rounds)}}
 return row;
}
const inFightExec=(roster,pc,m)=>(Array.isArray(roster)?roster:[]).some(r=>validAlly(r)&&r.ally.from==='exec'&&r.ally.characterId===pc.id&&r.ally.memberId===m.id);
const inFightBackup=(roster,pc,tier,index)=>(Array.isArray(roster)?roster:[]).some(r=>validAlly(r)&&r.ally.from==='backup'&&r.ally.characterId===pc.id&&r.ally.tier===tier&&r.ally.index===index);

/* What can join the fight from a player character's sheet and is not in it yet. Changes nothing.
   -> {exec:[{member,state,inFight,row}], backup:{state,missing:[index],row:[...]}|null} */
function allyRowsFor(pc,roster,lang,now){
 const out={exec:[],backup:null},at=Number.isFinite(now)?now:Date.now();
 if(!isObj(pc)||typeof pc.id!=='string'||!RK()?.memberState)return out;
 readTeam(pc).forEach((m,i)=>{
  if(!isObj(m)||typeof m.id!=='string')return;
  let st=null;try{st=RK().memberState(pc,m)}catch{}
  if(!st)return;
  const inFight=inFightExec(roster,pc,m);
  out.exec.push({member:m,state:st,inFight,row:inFight?null:execRow(pc,m,st,lang,at+i)});
 });
 let st=null;try{st=RK().backupState?.(pc)||null}catch{}
 if(st){
  const missing=st.hp.map((_,i)=>i).filter(i=>!inFightBackup(roster,pc,st.tier.min,i));
  out.backup={state:st,missing,row:missing.map((i,k)=>backupRow(pc,st,i,lang,at+100+k))};
 }
 return out;
}
/* Puts allies into the roster. which = {memberId} | {allMembers:true} | {backup:true}. -> {ok, added:[rows]} */
function addAllies(campaign,pc,which,lang,now){
 if(!isObj(campaign)||!Array.isArray(campaign.roster)||!isObj(pc)||!isObj(which))return {ok:false,added:[]};
 const found=allyRowsFor(pc,campaign.roster,lang,now);let rows=[];
 if(which.backup===true){if(found.backup)rows=found.backup.row}
 else if(which.allMembers===true)rows=found.exec.filter(x=>!x.inFight).map(x=>x.row);
 else if(typeof which.memberId==='string'){const x=found.exec.find(e=>e.member.id===which.memberId);if(x&&!x.inFight)rows=[x.row]}
 if(!rows.length||campaign.roster.length+rows.length>MAX_ROSTER)return {ok:false,added:[]};
 campaign.roster.push(...rows);
 return {ok:true,added:rows};
}

/* The one place where the sheet and the tracker meet (see the module's header). Never saves. -> {changed} */
function sync(campaign,characters,isOnline){
 const online=typeof isOnline==='function'?isOnline:x=>!!window.GMTable?.onlineMember?.(x),list=Array.isArray(characters)?characters:[];
 let changed=false;
 for(const r of Array.isArray(campaign?.roster)?campaign.roster:[]){
  if(!validAlly(r))continue;
  const a=r.ally,owners=list.filter(c=>c&&c.id===a.characterId);if(owners.length!==1)continue;
  const owner=owners[0];if(online(owner))continue;
  const rk=RK();if(!rk?.memberSet||!rk.backupSetHp)continue;
  let sheet=null,m=null;
  if(a.from==='exec'){
   m=readTeam(owner).find(x=>isObj(x)&&x.id===a.memberId);if(!m)continue;
   const st=rk.memberState(owner,m);if(!st)continue;sheet={hp:st.hp,sp:st.sp};
  }else{
   const st=rk.backupState(owner);if(!st||st.tier.min!==a.tier||!Number.isSafeInteger(a.index)||a.index<0||a.index>=st.hp.length)continue;sheet={hp:st.hp[a.index]};
   if(r.out===true&&isObj(r.combatNote)&&/^(Прибудет через|Arrives in) /.test(String(r.combatNote.text))){
    const en=/^Arrives/.test(r.combatNote.text);
    if(st.rounds<=0){delete r.out;delete r.combatNote;changed=true}
    else{const txt=T[en?'en':'ru'].arrive(st.rounds);if(r.combatNote.text!==txt){r.combatNote.text=txt;changed=true}}
   }
  }
  const hp=Number(r.hp);if(!Number.isFinite(hp))continue;
  const exec=a.from==='exec',spRow=exec?Number(r.sp?.body):null;
  const trackerChanged=hp!==a.hp||(exec&&spRow!==a.sp&&Number.isFinite(spRow));
  if(trackerChanged){
   const ok=exec?rk.memberSet(owner,m,hp,Number.isFinite(spRow)?spRow:undefined):rk.backupSetHp(owner,a.index,hp);
   if(!ok)continue;
   a.hp=hp;if(exec&&Number.isFinite(spRow))a.sp=spRow;changed=true;
  }else if(sheet.hp!==hp||(exec&&sheet.sp!==spRow)){
   r.hp=sheet.hp;a.hp=sheet.hp;
   if(exec){r.sp={...(isObj(r.sp)?r.sp:{head:sheet.sp}),body:sheet.sp};a.sp=sheet.sp}
   if(r.hp>=1){delete r.dead;delete r.deathPenalty}
   changed=true;
  }
 }
 return {changed};
}

// ----- loot -----
function catalogMatch(name,catalog){
 const n=norm(name),list=Array.isArray(catalog)?catalog:[];if(!n)return null;
 const exact=list.filter(x=>x&&norm(x.name?.en)===n);
 if(exact.length===1)return exact[0];
 if(Object.hasOwn(ALIASES,n))return list.find(x=>x&&x.id===ALIASES[n])||null;
 return null;
}
// "Handcuffs x2" -> {name:'Handcuffs', qty:2}
function parseName(text){
 let name=String(text??'').trim(),qty=1;
 const m=/\s+x(\d{1,3})$/i.exec(name);
 if(m){qty=Math.min(99,Math.max(1,Number(m[1])));name=name.slice(0,m.index).trim()}
 return {name,qty};
}
const AMMO_RU={'Rifle Ammo':'Патроны для винтовки','VH Pistol Ammo':'Патроны для сверхтяжёлого пистолета','Heavy Pistol Ammo':'Патроны для тяжёлого пистолета','Slug Ammo':'Патроны-жаканы','Arrow Ammo':'Стрелы','Flamethrower Ammo':'Топливо для огнемёта','Incendiary Grenade':'Зажигательная граната','Flashbang Grenade':'Светошумовая граната','Armor Piercing Grenade':'Бронебойная граната'};
const displayName=(raw,lang)=>lang==='ru'?(window.GMTools?.WEAPONS_RU?.[raw]||window.GMTools?.ARMOR_RU?.[raw]||AMMO_RU[raw]||raw):raw;
function sourceEntries(row,templates,library){
 const out=[];
 if(typeof row?.sourceTemplate==='string'&&row.sourceTemplate){
  const hit=(Array.isArray(templates)?templates:[]).filter(x=>x&&x.id===row.sourceTemplate);if(hit.length!==1)return out;
  const temp=hit[0];
  for(const w of Array.isArray(temp.weapons)?temp.weapons:[])if(w&&typeof w.name==='string')out.push({text:w.name,kind:'weapon'});
  if(isObj(temp.armor)&&typeof temp.armor.name==='string')out.push({text:temp.armor.name,kind:'armor'});
  if(typeof temp.equipment==='string')for(const part of temp.equipment.split(/,\s*(?![^()]*\))/))out.push({text:part,kind:'gear'});
 }else if(typeof row?.sourceLibrary==='string'&&row.sourceLibrary){
  const entry=(Array.isArray(library)?library:[]).find(x=>x&&x.id===row.sourceLibrary);
  if(typeof entry?.weapons==='string')for(const part of entry.weapons.split(/\n|;/))out.push({text:part.replace(/\s+\d{1,2}d(6|10)\b.*$/i,''),kind:'library'});
 }
 return out;
}
/* The things an NPC row can be looted of, minus those already taken. -> [{key,name,qty,catalogId,kind}] */
function lootItems(row,templates,library,catalog,lang){
 const l=L(lang),taken=new Set(Array.isArray(row?.lootTaken)?row.lootTaken:[]),out=[];
 sourceEntries(row,templates,library).forEach((e,pos)=>{
  const {name,qty}=parseName(e.text);if(!name)return;
  const hit=catalogMatch(name,catalog);
  if(hit?.category==='cyberware'||IMPLANT.test(name))return;
  const kind=e.kind==='library'?(hit?.category==='weapon'?'weapon':'gear'):e.kind,key=kind+':'+norm(name)+':'+pos;
  if(taken.has(key))return;
  out.push({key,name:hit?String(hit.name?.[l]||hit.name?.en||name):displayName(name,l),qty,catalogId:hit?String(hit.id):'',kind});
 });
 return out.slice(0,ITEMS_MAX);
}
const lootable=(row,items)=>!!row&&row.kind==='npc'&&!row.own&&!row.ally&&(row.dead===true||row.out===true||Number(row.hp)<1)&&Array.isArray(items)&&items.length>0;
function itemsOf(row,lang){
 let lib=[];try{lib=window.NpcLibrary?.readLibrary?.(window.App?.getState?.())||[]}catch{}
 return lootItems(row,window.GMTools?.NPC_TEMPLATES,lib,catalogOf(),lang);
}
/* Stages items on a copy of the sheet's extra; the caller assigns `extra` on success. -> {ok,extra}|{ok:false} */
function giveLocal(character,items,fromName,lang){
 const ce=CE(),l=L(lang),note=T[l].lootNote+': '+String(fromName||'').slice(0,60);
 if(!isObj(character)||!ce?.addCatalog||!ce.addItem||(character.extra!==undefined&&!isObj(character.extra))||!Array.isArray(items))return {ok:false};
 try{
  const stage={...character,extra:JSON.parse(JSON.stringify(character.extra||{}))};
  for(const it of items){
   const qty=Math.min(99,Math.max(1,Number(it.qty)||1)),cat=it.catalogId?catalogOf().find(x=>x&&x.id===it.catalogId):null;
   if(cat){
    const r=ce.addCatalog(stage,cat,l);if(!r)return {ok:false};
    if(r.kind==='weapon'){for(let i=1;i<Math.min(qty,5);i++)if(!ce.addCatalog(stage,cat,l))return {ok:false}}
    else if(qty>1)r.record.quantity=qty;
    r.record.notes=(String(r.record.notes||'')+(r.record.notes?' · ':'')+note).slice(0,500);
   }else{
    const r=ce.addItem(stage,{name:String(it.name||'').slice(0,100),category:it.kind==='armor'?'armor':'equipment',quantity:qty,notes:note});if(!r)return {ok:false};
   }
  }
  return {ok:true,extra:stage.extra};
 }catch{return {ok:false}}
}
const validPile=x=>isObj(x)&&typeof x.id==='string'&&typeof x.name==='string'&&typeof x.fromId==='string'&&Number.isSafeInteger(x.qty)&&x.qty>=1&&x.qty<=99;
const readPile=c=>Array.isArray(c?.lootPile)?c.lootPile.filter(validPile):[];
/* Moves what is left on removed NPC rows into campaign.lootPile (a flat list: export drops deep objects). -> number added */
function stash(campaign,rows,lang){
 if(!isObj(campaign))return 0;
 const add=[];
 for(const r of Array.isArray(rows)?rows:[]){
  const items=itemsOf(r,lang);if(!lootable(r,items))continue;
  for(const it of items)add.push({id:newId(),from:String(r.name||'?').slice(0,100),fromId:String(r.id),name:it.name,qty:it.qty,catalogId:it.catalogId,kind:it.kind,at:Date.now()});
 }
 if(!add.length)return 0;
 campaign.lootPile=[...(Array.isArray(campaign.lootPile)?campaign.lootPile:[]),...add].slice(-PILE_MAX);
 return add.length;
}
function deathButtonState(pc){
 const show=Number(pc?.hp)<1&&pc?.extra?.deathRecord?.dead!==true;
 let target=0;try{target=PC()?.deathTarget?.(pc)??0}catch{}
 return {show,target,penalty:Math.max(0,(Number(pc?.stats?.BODY)||0)-target)};
}

// ---------- 2. HTML ----------
const lootOpen=new Map();let lastRecipient='',armed='';
const onlineOf=x=>{try{return window.GMTable?.onlineMember?.(x)||''}catch{return ''}};
function label(r,characters,lang){
 if(!validAlly(r))return '';
 const owner=(Array.isArray(characters)?characters:[]).find(c=>c&&c.id===r.ally.characterId);
 return T[L(lang)].allyCaption(owner?.name||'Edgerunner');
}
function deathHTML(r,pc,lang){
 const t=T[L(lang)],s=deathButtonState(pc);if(!s.show)return '';
 if(onlineOf(pc))return `<p class="muted ta-hint">${esc(t.deathOnline)}</p>`;
 return `<div class="ta-death"><button type="button" class="btn primary" data-ta-action="pc-death" data-id="${esc(r.id)}">${esc(t.death(s.target))}</button>${s.penalty?`<small>${esc(t.penalty(s.penalty))}</small>`:''}</div>`;
}
function teamHTML(r,pc,c,lang){
 const t=T[L(lang)],found=allyRowsFor(pc,c?.roster,lang),parts=[];
 if(found.exec.length){
  const free=found.exec.filter(x=>!x.inFight).length,unlisted=readTeam(pc).some(m=>isObj(m)&&!found.exec.some(x=>x.member===m));
  parts.push(`<div class="ta-team"><strong class="gt-title">${esc(t.team)}</strong><ul class="ta-list">${found.exec.map(x=>{
   const m=x.member,p=x.state.profile,job=window.RoleTools?.data?.execJobs?.[m.execProfile?.job],name=String(m.name||'').trim()||job?.name?.[L(lang)==='ru'?0:1]||'?';
   return `<li><span>${esc(t.teamLine(name,x.state.hp,x.state.max,x.state.sp))}</span>${x.inFight?`<span class="camp-chip">${esc(t.inFight)}</span>`:`<button type="button" class="btn ghost" data-ta-action="ally-add" data-id="${esc(r.id)}" data-member="${esc(m.id)}">${esc(t.toFight)}</button>`}</li>`}).join('')}</ul>${free>=2?`<button type="button" class="btn ghost" data-ta-action="ally-add-all" data-id="${esc(r.id)}">${esc(t.allToFight)}</button>`:''}${unlisted?`<p class="muted">${esc(t.noProfile)}</p>`:''}</div>`);
 }
 const b=found.backup;
 if(b){
  const st=b.state,tier=st.tier,name=tier.name?.[L(lang)==='ru'?0:1]||'',status=st.rounds>0?t.enRoute(st.rounds):t.onSite,hp=st.hp.join('/');
  parts.push(`<div class="ta-team"><strong class="gt-title">${esc(t.backup)}</strong><p>${esc(t.backupLine(name,st.hp.length,tier.combat,tier.sp,hp))} · ${esc(status)}</p>${b.missing.length?`<button type="button" class="btn ghost" data-ta-action="backup-add" data-id="${esc(r.id)}">${esc(t.toFight)}</button>`:`<span class="camp-chip">${esc(t.inFight)}</span>`}</div>`);
 }
 if(parts.length&&onlineOf(pc))parts.push(`<p class="muted ta-hint">${esc(t.roomHint)}</p>`);
 return parts.join('');
}
const pcHTML=(r,pc,c,characters,lang)=>deathHTML(r,pc,lang)+teamHTML(r,pc,c,lang);

// Who can receive loot: PC rows with a local sheet and `own` rows of players in the room.
function recipients(c,characters,lang){
 const t=T[L(lang)],out=[];
 for(const r of Array.isArray(c?.roster)?c.roster:[]){
  if(r?.kind==='pc'){const p=(Array.isArray(characters)?characters:[]).find(x=>x&&x.id===r.characterId);if(p)out.push({value:'c:'+p.id,name:(p.name||'Edgerunner')+(onlineOf(p)?' · '+t.inRoom:'')})}
  else if(r?.kind==='npc'&&typeof r.own==='string'&&r.own&&onlineOf(r))out.push({value:'m:'+r.id,name:(r.name||'?')+' · '+t.inRoom});
 }
 return out;
}
function controlsHTML(src,items,c,characters,lang,tail=''){
 const t=T[L(lang)],who=recipients(c,characters,lang);
 const list=items.map(i=>`<li><label class="gt-check"><input type="checkbox" data-ta-item="${esc(i.key)}" checked><span>${esc(i.name)}${i.qty>1?' ×'+i.qty:''}</span> <small>${esc(i.catalogId?t.lootCatalog:t.lootPlain)}</small></label></li>`).join('');
 const pick=who.length?`<label class="field">${esc(t.to)}<select data-ta-to>${who.map(x=>`<option value="${esc(x.value)}"${x.value===lastRecipient?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label><button type="button" class="btn primary" data-ta-action="loot-give" data-src="${esc(src)}">${esc(t.give)}</button>`:`<p class="muted">${esc(t.noRecipient)}</p>`;
 return `<div class="ta-loot" data-ta-loot="${esc(src)}"><ul class="ta-items">${list}</ul>${pick}${tail}</div>`;
}
function lootHTML(r,c,characters,lang){
 const items=itemsOf(r,lang);if(!lootable(r,items))return '';
 const t=T[L(lang)],open=lootOpen.get(r.id)===true;
 return `<div class="ta-lootbox"><button type="button" class="btn ghost" data-ta-action="loot-open" data-id="${esc(r.id)}" aria-expanded="${open}">${esc(open?t.lootClose:t.loot(items.length))}</button>${open?controlsHTML('row:'+r.id,items,c,characters,lang):''}</div>`;
}
function pileHTML(c,characters,lang){
 const pile=readPile(c);if(!pile.length)return '';
 const t=T[L(lang)],groups=new Map();
 for(const e of pile){if(!groups.has(e.fromId))groups.set(e.fromId,{from:e.from,items:[]});groups.get(e.fromId).items.push({key:e.id,name:e.name,qty:e.qty,catalogId:e.catalogId||'',kind:e.kind})}
 return `<section class="card gt-party ta-pile" data-gt><div class="card-heading"><span>${esc(t.lootTitle)}</span><span>${pile.length}</span></div><p class="muted">${esc(t.pileHelp)}</p>${[...groups].map(([id,g])=>`<div class="ta-group"><strong class="gt-title">${esc(g.from)}</strong>${controlsHTML('pile:'+id,g.items,c,characters,lang,`<button type="button" class="btn ghost" data-ta-action="pile-drop" data-src="pile:${esc(id)}">${esc(armed==='pile:'+id?t.dropSure:t.drop)}</button>`)}</div>`).join('')}</section>`;
}

// ---------- 3. clicks ----------
const nameList=rows=>rows.map(r=>r.name).join(', ');
/* The player refused a sent offer: the item goes back to the loot pile so it can be given to someone else. */
function giveBack(c,row,from,it,ctx){
 if(!isObj(c))return false;
 const keep=Array.isArray(c.lootPile)?c.lootPile:[];
 c.lootPile=[...keep,{id:newId(),from:String(from||'?').slice(0,100),fromId:String(row?.id||'returned'),name:it.name,qty:it.qty,catalogId:it.catalogId||'',kind:it.kind,at:Date.now()}].slice(-PILE_MAX);
 try{window.Campaigns?.journalAdd?.(c,T[L(ctx?.lang)].lootBack(it.name),true)}catch{}
 try{ctx?.save?.()}catch{}
 try{ctx?.rerender?.()}catch{}
 return true;
}
function handle(e,c,ctx){
 const b=e?.type==='click'?e.target?.closest?.('[data-ta-action]'):null;if(!b)return null;
 const lang=L(ctx?.lang),t=T[lang],characters=Array.isArray(ctx?.characters)?ctx.characters:[],a=b.dataset.taAction,roster=Array.isArray(c?.roster)?c.roster:[];
 const journal=text=>{try{window.Campaigns?.journalAdd?.(c,text,true)}catch{}};
 const rowOf=id=>roster.find(x=>x&&x.id===id),pcOf=r=>r?.kind==='pc'?characters.find(p=>p&&p.id===r.characterId):null;
 if(a!=='pile-drop')armed='';
 if(a==='ally-add'||a==='ally-add-all'||a==='backup-add'){
  const pc=pcOf(rowOf(b.dataset.id));if(!pc)return {notify:t.addFail};
  const r=addAllies(c,pc,a==='backup-add'?{backup:true}:a==='ally-add-all'?{allMembers:true}:{memberId:b.dataset.member},lang);
  if(!r.ok)return {rerender:true,notify:t.addFail};
  journal(t.addedJournal(nameList(r.added)));
  return {dirty:true,rerender:true,notify:t.added(nameList(r.added))};
 }
 if(a==='pc-death'){
  const row=rowOf(b.dataset.id),pc=pcOf(row);if(!pc)return {};
  if(onlineOf(pc))return {notify:t.deathOnline};
  if(!deathButtonState(pc).show||!CE()?.deathSaveStart)return {rerender:true,notify:t.deathNone};
  try{PC()?.syncDeathBase?.(pc)}catch{}
  const s=CE().deathSaveStart(pc,'mortal',lang);if(!s.ok)return {rerender:true,notify:s.text};
  const die=1+Math.floor(Math.random()*10),r=CE().deathSaveResolve(pc,s.q,die,lang),name=`${pc.name||'Edgerunner'} · ${s.q.label}`;
  try{window.App?.report?.(name,r.detail,r.total,[{v:r.die,s:10}])}catch{}
  if(!r.success)row.out=true;
  journal(t.deathJournal(`${name} — ${r.detail}`));
  return {dirty:true,rerender:true,notify:`${name}: ${r.detail}`};
 }
 if(a==='loot-open'){lootOpen.set(b.dataset.id,lootOpen.get(b.dataset.id)!==true);if(lootOpen.size>200)lootOpen.delete(lootOpen.keys().next().value);return {rerender:true}}
 if(a==='pile-drop'){
  const src=String(b.dataset.src||'');
  if(armed!==src){armed=src;return {rerender:true}}
  armed='';const id=src.slice(5);
  c.lootPile=(Array.isArray(c.lootPile)?c.lootPile:[]).filter(x=>!(validPile(x)&&x.fromId===id));
  return {dirty:true,rerender:true,notify:t.dropped};
 }
 if(a==='loot-give'){
  const src=String(b.dataset.src||''),kind=src.slice(0,src.indexOf(':')),id=src.slice(src.indexOf(':')+1),box=b.closest?.('.ta-loot');
  let items=[],row=null;
  if(kind==='row'){row=rowOf(id);items=row?itemsOf(row,lang):[];if(!lootable(row,items))items=[]}
  else if(kind==='pile')items=readPile(c).filter(x=>x.fromId===id).map(x=>({key:x.id,name:x.name,qty:x.qty,catalogId:x.catalogId||'',kind:x.kind,from:x.from}));
  const keys=new Set([...(box?.querySelectorAll?.('[data-ta-item]')||[])].filter(x=>x.checked).map(x=>x.dataset.taItem));
  const chosen=items.filter(i=>keys.has(i.key)),to=String(box?.querySelector?.('[data-ta-to]')?.value||'');
  if(!chosen.length)return {notify:t.pickItems};
  if(!to)return {notify:t.pickWho};
  const from=row?.name||items[0]?.from||'?',target=to.startsWith('m:')?rowOf(to.slice(2)):characters.find(p=>p&&p.id===to.slice(2));
  if(!target)return {notify:t.pickWho};
  const online=onlineOf(target);let taken=[],failed=[];
  if(online){
   for(const it of chosen){
    let r={ok:false};try{r=window.RoomGrants.sendTo(online,{kind:'item',n:it.qty,name:it.name,note:t.lootNote+': '+from},lang,{declined:()=>giveBack(c,row,from,it,ctx)})}catch{}
    (r?.ok?taken:failed).push(it);
   }
  }else{
   const g=giveLocal(target,chosen,from,lang);if(!g.ok)return {notify:t.giveFail};
   target.extra=g.extra;taken=chosen;
  }
  if(!taken.length)return {notify:t.lootSkipped(failed.map(x=>x.name).join(', ')).trim()};
  lastRecipient=to;
  const keysDone=new Set(taken.map(x=>x.key));
  if(row)row.lootTaken=[...(Array.isArray(row.lootTaken)?row.lootTaken:[]),...keysDone].slice(-TAKEN_MAX);
  else c.lootPile=(Array.isArray(c.lootPile)?c.lootPile:[]).filter(x=>!(validPile(x)&&keysDone.has(x.id)));
  const text=t.lootLine(from,target.name||'Edgerunner',taken.map(x=>x.name+(x.qty>1?' ×'+x.qty:'')).join(', '));
  journal(text);
  return {dirty:true,rerender:true,notify:text+(failed.length?t.lootSkipped(failed.map(x=>x.name).join(', ')):'')};
 }
 return {};
}

window.TrackerAllies={text:T,BACKUP_WEAPONS,ALIASES,allyRowsFor,addAllies,sync,lootItems,catalogMatch,lootable,giveLocal,stash,deathButtonState,pcHTML,deathHTML,teamHTML,lootHTML,pileHTML,label,handle,giveBack,
 reset(){lootOpen.clear();lastRecipient='';armed=''}};
})();
