/* Named modifiers of a character: «Smartgun +1», «Темнота −2».
   The «Модификатор» counter of the next roll is typed again for every roll and says nothing about where the number
   came from. A named modifier is written once, switched on and off with one tap next to the roll buttons, and is
   named in the text of every roll it took part in.

   A modifier can count for every check, for ranged or melee attacks only, for checks with one STAT or for checks of
   one Skill. It can be tied to a thing of the inventory: then it counts while that thing is on the sheet, sleeps when
   the thing is gone and wakes up when the thing comes back. Nothing is ever deleted behind the player's back.

   The numbers do not go into the rolls from here. Effects.collect (effects.js) asks contribute() the way it asks the
   implants, so every roll, every tool and every number on a roll button sees the same sum. A modifier «to checks with
   REF» is kept apart from the STAT changes of the effects layer on purpose: it must not move Initiative or the sheet.

   The list lives on the character (extra.namedModifiers) and travels with the sheet: in a file, a link, a sheet sent
   to the Game Master. Such a sheet is not trusted, so every read rebuilds each entry from the known fields, and an
   entry or a whole record this module cannot read is left exactly as it was. Only the player can clear such a thing
   away (a damaged record, a list clogged with unreadable rows), and that can be taken back. */
(function(global){
'use strict';
const LIMITS=Object.freeze({max:24,name:32,value:20});
const SCOPES=Object.freeze(['all','ranged','melee','stat','skill']);
const STATS=Object.freeze(['INT','REF','DEX','TECH','COOL','WILL','BODY','EMP']);
// More stored rows than this (readable or not) and nothing is added: a damaged list must not grow without end.
const RAW_MAX=200;
const T={
 ru:{group:'Свои модификаторы',first:'+ Свой модификатор',setup:'Настроить модификаторы',
  help:'Включённые модификаторы прибавляются к каждому подходящему броску, пока вы их не выключите. Привязанный к вещи считается, пока вещь есть на листе. Разовую поправку задавайте счётчиком «Модификатор» выше.',
  name:'Название',namePlaceholder:'Например: Темнота',value:'Значение',when:'Когда действует',item:'Пока есть вещь',none:'Не привязан',
  all:'Все проверки',ranged:'Дальние атаки',melee:'Атаки ближнего боя',statGroup:'Проверки с характеристикой',skillGroup:'Проверки навыка',weaponGroup:'Оружие',itemGroup:'Вещи',
  tagRanged:'дальние атаки',tagMelee:'ближний бой',tagAll:'все проверки',
  formNew:'Новый модификатор',formEdit:'Изменение: {0}',add:'Добавить',save:'Сохранить',cancel:'Отмена',edit:'Изменить',remove:'Удалить',detach:'Отвязать',
  asleep:'вещи нет',whileOwned:'пока есть: {0}',on:'включён',off:'выключен',cardLine:'Модификатор',more:'ещё модификаторы',unnamed:'без названия',
  errName:'Введите название.',errValue:'Введите целое значение от −20 до 20, кроме нуля.',errWhen:'Выберите, когда действует модификатор.',errItem:'Этой вещи уже нет на листе — выберите другую.',
  full:'На листе уже 24 модификатора — удалите ненужный.',stale:'Лист изменился — попробуйте ещё раз.',
  foreign:'Модификаторы записаны другой версией приложения. Данные не тронуты.',
  damaged:'Запись модификаторов на этом листе повреждена, и они не действуют. Чтобы добавлять новые, начните заново.',startOver:'Начать заново',resetDone:'Запись модификаторов начата заново.',
  clogged:'В списке накопились записи, которые приложение не может прочитать, и для новых модификаторов не осталось места.',cleanUp:'Убрать нечитаемые записи',cleaned:'Нечитаемые записи убраны.',resetBack:'Прежняя запись возвращена.',
  added:'Модификатор «{0}» добавлен и включён.',saved:'Модификатор «{0}» сохранён.',removed:'Модификатор «{0}» удалён.',restored:'Модификатор «{0}» возвращён.',detached:'Модификатор «{0}» больше не привязан к вещи.',undo:'Вернуть'},
 en:{group:'Named modifiers',first:'+ Named modifier',setup:'Set up modifiers',
  help:'Modifiers that are on are added to every roll they fit until you switch them off. One tied to a thing counts while the thing is on the sheet. For a one-off change use the “Modifier” counter above.',
  name:'Name',namePlaceholder:'For example: Darkness',value:'Value',when:'Applies to',item:'While you have',none:'Not tied to a thing',
  all:'All checks',ranged:'Ranged attacks',melee:'Melee attacks',statGroup:'Checks with a STAT',skillGroup:'Checks of a Skill',weaponGroup:'Weapons',itemGroup:'Things',
  tagRanged:'ranged attacks',tagMelee:'melee attacks',tagAll:'all checks',
  formNew:'New modifier',formEdit:'Editing: {0}',add:'Add',save:'Save',cancel:'Cancel',edit:'Edit',remove:'Delete',detach:'Untie',
  asleep:'thing missing',whileOwned:'while you have: {0}',on:'on',off:'off',cardLine:'Modifier',more:'more modifiers',unnamed:'unnamed',
  errName:'Enter a name.',errValue:'Enter a whole value from −20 to 20, not zero.',errWhen:'Choose what the modifier applies to.',errItem:'That thing is no longer on the sheet — choose another.',
  full:'The sheet already has 24 modifiers — delete one you do not need.',stale:'The sheet has changed — please try again.',
  foreign:'The modifiers were saved by another version of the app. The data is untouched.',
  damaged:'The modifier record on this sheet is damaged, so the modifiers do not count. To add new ones, start over.',startOver:'Start over',resetDone:'The modifier record was started over.',
  clogged:'The list has filled up with entries the app cannot read, and there is no room for new modifiers.',cleanUp:'Remove unreadable entries',cleaned:'Unreadable entries removed.',resetBack:'The previous record is back.',
  added:'Modifier “{0}” added and switched on.',saved:'Modifier “{0}” saved.',removed:'Modifier “{0}” deleted.',restored:'Modifier “{0}” is back.',detached:'Modifier “{0}” is no longer tied to a thing.',undo:'Undo'},
};
const L=lang=>lang==='en'?'en':'ru';
const t=(lang,key,...a)=>String(T[L(lang)][key]??T.ru[key]??key).replace(/\{(\d)\}/g,(_,i)=>String(a[i]??''));
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isObject=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const signed=n=>(n<0?'−':'+')+Math.abs(n);
const fail=(lang,key)=>({ok:false,message:t(lang,key)});

/* ---------- reading ---------- */
// A name as it is kept: no control or direction characters (it is shown to other people in a room), single spaces,
// at most 32 characters, never half of a character that takes two.
function cleanName(v){
 if(typeof v!=='string')return '';
 let s=v.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g,' ').replace(/\s+/g,' ').trim();
 if(s.length>LIMITS.name){s=s.slice(0,LIMITS.name);if(/[\ud800-\udbff]$/.test(s))s=s.slice(0,-1);s=s.trim()}
 return s;
}
const validValue=v=>typeof v==='number'&&Number.isInteger(v)&&v!==0&&Math.abs(v)<=LIMITS.value;
// A Skill key is used as a property name in the sum of the effects, so a name every object already has is never one.
function validSkill(c,key){
 if(typeof key!=='string'||!key||key.length>60||key in Object.prototype)return false;
 const labels=global.SKILL_LABELS;
 return !isObject(labels)||Object.hasOwn(labels,key)||(isObject(c?.skills)&&Object.hasOwn(c.skills,key));
}
const validItemId=v=>typeof v==='string'&&v.length>0&&v.length<=160;
// One stored row rebuilt from the fields this module knows; null when any of them is not what it should be.
function clean(c,raw){
 if(!isObject(raw)||typeof raw.id!=='string'||!/^[A-Za-z0-9_-]{1,40}$/.test(raw.id))return null;
 const name=cleanName(raw.name);
 if(!name||!validValue(raw.value)||typeof raw.on!=='boolean'||!SCOPES.includes(raw.scope))return null;
 const out={id:raw.id,name,value:raw.value,on:raw.on,scope:raw.scope,key:'',itemId:''};
 if(raw.scope==='stat'){if(!STATS.includes(raw.key))return null;out.key=raw.key}
 if(raw.scope==='skill'){if(!validSkill(c,raw.key))return null;out.key=raw.key}
 if(raw.itemId!==undefined){if(!validItemId(raw.itemId))return null;out.itemId=raw.itemId}
 return out;
}
// 'none' = the sheet has no record yet (every sheet made before this feature), 'ok' = a record this version reads,
// 'foreign' = a record with a later version number: a newer app wrote it, so it is not used and never written over,
// 'damaged' = anything else (null, a string, a list in the wrong shape). It is not used either and nothing writes
// over it on its own, but the player may start over (reset), because otherwise the feature is closed for good.
function store(c){
 if(!isObject(c)||!isObject(c.extra)||c.extra.namedModifiers===undefined)return {state:'none',raw:null};
 const x=c.extra.namedModifiers;
 if(isObject(x)&&x.version===1&&Array.isArray(x.list))return {state:'ok',raw:x.list};
 return {state:isObject(x)&&Number.isInteger(x.version)&&x.version>1?'foreign':'damaged',raw:null};
}
// Why nothing may be written right now, as an answer for the player; null when writing is fine.
function refusal(c,lang){const st=store(c).state;return st==='foreign'?fail(lang,'foreign'):st==='damaged'?fail(lang,'damaged'):null}
// The list is full of rows that cannot be read, so there is no room to add although fewer than 24 modifiers are shown.
function clogged(c){const s=store(c);return s.state==='ok'&&s.raw.length>=RAW_MAX&&list(c).length<LIMITS.max}
function list(c){
 const out=[];
 try{
  const s=store(c);if(s.state!=='ok')return out;
  const seen=new Set();
  for(let index=0;index<s.raw.length&&index<RAW_MAX&&out.length<LIMITS.max;index++){
   const m=clean(c,s.raw[index]);if(!m||seen.has(m.id))continue;
   seen.add(m.id);m.index=index;out.push(m);
  }
 }catch{return []}
 return out;
}
const rows=(c,kind)=>Array.isArray(c?.extra?.[kind])?c.extra[kind].filter(isObject):[];
// On the sheet at all (a thing with quantity 0 too): what a modifier may be tied to.
function record(c,itemId){
 if(!validItemId(itemId))return null;
 const w=rows(c,'weapons').find(r=>r.id===itemId);if(w)return {kind:'weapons',record:w};
 const i=rows(c,'items').find(r=>r.id===itemId);return i?{kind:'items',record:i}:null;
}
// Owned now: a weapon while its record exists, any other thing while there is at least one of it.
function owned(c,itemId){
 const hit=record(c,itemId);if(!hit)return false;
 return hit.kind==='weapons'||Math.floor(Number(hit.record.quantity??1))>=1;
}
function recordName(r,lang){
 const name=String(r?.name||'').trim(),ln=r?.localizedName,item=Array.isArray(global.CATALOG)&&typeof r?.catalogId==='string'?global.CATALOG.find(x=>x&&x.id===r.catalogId):null;
 let out=name;
 if(isObject(ln)&&[ln.ru,ln.en].includes(name))out=ln[L(lang)]||name;
 else if(item&&[item.name?.ru,item.name?.en].includes(name))out=item.name[L(lang)]||name;
 return String(out||t(lang,'unnamed')).slice(0,80);
}
function itemName(c,itemId,lang){const hit=record(c,itemId);return hit?recordName(hit.record,lang):''}
const active=c=>list(c).filter(m=>m.on&&(!m.itemId||owned(c,m.itemId)));

/* ---------- the effects layer ---------- */
function partsOf(m){
 return m.scope==='all'?{all:m.value}:m.scope==='ranged'?{ranged:m.value}:m.scope==='melee'?{melee:m.value}:m.scope==='skill'?{skills:{[m.key]:m.value}}:{checkStats:{[m.key]:m.value}};
}
// Called by Effects.collect. Everything is worked out first and written after, so a surprise half way leaves `total` as it was.
function contribute(c,total){
 if(!isObject(total)||!Array.isArray(total.sources)||!isObject(total.skills))return;
 const act=active(c);if(!act.length)return;
 const flat={all:0,ranged:0,melee:0},skills={},stats={},sources=[];
 for(const m of act){
  if(m.scope==='skill')skills[m.key]=(Object.hasOwn(skills,m.key)?skills[m.key]:0)+m.value;
  else if(m.scope==='stat')stats[m.key]=(stats[m.key]||0)+m.value;
  else flat[m.scope]+=m.value;
  sources.push({kind:'named',name:{ru:m.name,en:m.name},parts:partsOf(m),note:null});
 }
 const checkStats=isObject(total.checkStats)?total.checkStats:{};
 for(const k of ['all','ranged','melee'])total[k]=(Number(total[k])||0)+flat[k];
 for(const [k,n] of Object.entries(skills))total.skills[k]=(Object.hasOwn(total.skills,k)?Number(total.skills[k])||0:0)+n;
 for(const [k,n] of Object.entries(stats))checkStats[k]=(Object.hasOwn(checkStats,k)?Number(checkStats[k])||0:0)+n;
 // Only a sheet with such a modifier gets the extra key: the sum for everyone else keeps its old shape.
 if(Object.keys(stats).length)total.checkStats=checkStats;
 total.sources.push(...sources);
}
// The modifiers that count for one check, the way Effects.checkModifier adds them: [{name, value}].
function forCheck(c,q){
 const o=isObject(q)?q:{},kind=o.kind==='melee'||o.kind==='ranged'?o.kind:'',skill=typeof o.skill==='string'?o.skill:'',stat=typeof o.stat==='string'?o.stat:'';
 return active(c).filter(m=>m.scope==='all'||(m.scope==='skill'?!!skill&&m.key===skill:m.scope==='stat'?!!stat&&m.key===stat:m.scope===kind)).map(m=>({name:m.name,value:m.value}));
}
/* The tail of a roll label: « · Smartgun +1». A label is cut short on the way to other people in a room, so only the
   first three are named, each with a short name, and the rest come as one sum; the detail line names every one in full. */
function tail(parts,lang){
 const ok=(Array.isArray(parts)?parts:[]).filter(p=>isObject(p)&&typeof p.name==='string'&&Number.isSafeInteger(p.value)&&p.value!==0);
 if(!ok.length)return '';
 const short=s=>s.length>20?s.slice(0,19).replace(/[\ud800-\udbff]$/,'').trim()+'…':s;
 let out=ok.slice(0,3).map(p=>` · ${short(p.name)} ${signed(p.value)}`).join('');
 if(ok.length>3){const n=ok.slice(3).reduce((a,p)=>a+p.value,0);out+=` · ${t(lang,'more')} ${n?signed(n):'0'}`}
 return out;
}

/* ---------- writing ---------- */
function newId(c){
 const taken=new Set((store(c).raw||[]).map(r=>r?.id));
 for(let i=0;i<50;i++){
  let id='';try{id=String(global.crypto?.randomUUID?.()||'')}catch{}
  if(!/^[A-Za-z0-9_-]{1,40}$/.test(id))id='nm-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*1e9).toString(36);
  if(!taken.has(id))return id;
 }
 return '';
}
// What the form (or a caller) gave, checked: {ok, entry} with the fields to store, or {ok:false, message}.
function fromDraft(c,draft,lang){
 const d=isObject(draft)?draft:{},name=cleanName(d.name);
 if(!name)return fail(lang,'errName');
 if(!validValue(d.value))return fail(lang,'errValue');
 if(!SCOPES.includes(d.scope)||(d.scope==='stat'&&!STATS.includes(d.key))||(d.scope==='skill'&&!validSkill(c,d.key)))return fail(lang,'errWhen');
 const entry={name,value:d.value,scope:d.scope};
 if(d.scope==='stat'||d.scope==='skill')entry.key=d.key;
 if(d.itemId!==undefined&&d.itemId!==null&&d.itemId!==''){if(!validItemId(d.itemId))return fail(lang,'errItem');entry.itemId=d.itemId}
 return {ok:true,entry};
}
function add(c,draft,lang){
 if(!isObject(c))return fail(lang,'stale');
 let s=store(c);const no=refusal(c,lang);if(no)return no;
 if(c.extra!==undefined&&!isObject(c.extra))return fail(lang,'stale');
 const v=fromDraft(c,draft,lang);if(!v.ok)return v;
 if(v.entry.itemId&&!record(c,v.entry.itemId))return fail(lang,'errItem');
 if(list(c).length>=LIMITS.max)return fail(lang,'full');
 // Not «24 already»: the player sees fewer and has nothing to delete. The editor offers to clear the unreadable rows.
 if(s.raw&&s.raw.length>=RAW_MAX)return fail(lang,'clogged');
 const id=newId(c);if(!id)return fail(lang,'stale');
 if(s.state==='none'){if(!isObject(c.extra))c.extra={};c.extra.namedModifiers={version:1,list:[]};s=store(c)}
 const {name,value,scope,key,itemId}=v.entry,entry={id,name,value,on:true,scope};
 if(key)entry.key=key;if(itemId)entry.itemId=itemId;
 s.raw.push(entry);
 return {ok:true,id,message:t(lang,'added',name)};
}
// The stored row behind an id, found through the checked view, so a change never lands on a broken neighbour with the same id.
function rawOf(c,id){
 const s=store(c);if(s.state!=='ok'||typeof id!=='string')return null;
 const m=list(c).find(x=>x.id===id);return m?{raw:s.raw,index:m.index,row:s.raw[m.index],view:m}:null;
}
function update(c,id,draft,lang){
 const no=refusal(c,lang);if(no)return no;
 const at=rawOf(c,id);if(!at)return fail(lang,'stale');
 const v=fromDraft(c,draft,lang);if(!v.ok)return v;
 // A thing that is gone may stay as the link it already was; a new link has to lead to a thing on the sheet.
 if(v.entry.itemId&&v.entry.itemId!==at.view.itemId&&!record(c,v.entry.itemId))return fail(lang,'errItem');
 const row=at.row;row.name=v.entry.name;row.value=v.entry.value;row.scope=v.entry.scope;
 if(v.entry.key)row.key=v.entry.key;else delete row.key;
 if(v.entry.itemId)row.itemId=v.entry.itemId;else delete row.itemId;
 return {ok:true,id,message:t(lang,'saved',v.entry.name)};
}
function toggle(c,id,lang){
 const no=refusal(c,lang);if(no)return no;
 const at=rawOf(c,id);if(!at)return fail(lang,'stale');
 at.row.on=!at.view.on;return {ok:true,id,on:at.row.on,message:''};
}
function detach(c,id,lang){
 const no=refusal(c,lang);if(no)return no;
 const at=rawOf(c,id);if(!at)return fail(lang,'stale');
 delete at.row.itemId;return {ok:true,id,message:t(lang,'detached',at.view.name)};
}
function remove(c,id,lang){
 const no=refusal(c,lang);if(no)return no;
 const at=rawOf(c,id);if(!at)return fail(lang,'stale');
 let copy;try{copy=JSON.parse(JSON.stringify(at.row))}catch{return fail(lang,'stale')}
 /* A damaged sheet can hold more rows with this id further down. They were hidden behind this one; left where they
    are, the first of them would start to count the moment this one is gone, and the way back would be shut. So they
    leave together with it and come back together with it. */
 const twins=[];
 for(let i=at.index+1;i<at.raw.length;i++){const r=at.raw[i];if(isObject(r)&&r.id===id)twins.push({index:i,entry:r})}
 for(let i=twins.length-1;i>=0;i--)at.raw.splice(twins[i].index,1);
 at.raw.splice(at.index,1);
 return {ok:true,id,message:t(lang,'removed',at.view.name),undo:{characterId:c.id,index:at.index,entry:copy,twins}};
}
// Puts a deleted modifier back where it was. Refused when it is back already or the list has filled up meanwhile.
// It only returns what remove() took out, so the cap on stored rows (which is about growth) is not asked here.
function restore(c,undo,lang){
 if(!isObject(c)||!isObject(undo))return fail(lang,'stale');
 let s=store(c);const no=refusal(c,lang);if(no)return no;
 const m=clean(c,undo.entry);if(!m)return fail(lang,'stale');
 if(s.state==='none'){if(c.extra!==undefined&&!isObject(c.extra))return fail(lang,'stale');if(!isObject(c.extra))c.extra={};c.extra.namedModifiers={version:1,list:[]};s=store(c)}
 // «Back already» is asked of the checked view: a row that cannot be read does not stand in the way.
 if(list(c).some(x=>x.id===m.id))return fail(lang,'stale');
 if(list(c).length>=LIMITS.max)return fail(lang,'full');
 const index=Number.isInteger(undo.index)&&undo.index>=0?Math.min(undo.index,s.raw.length):s.raw.length;
 s.raw.splice(index,0,undo.entry);
 const twins=(Array.isArray(undo.twins)?undo.twins:[]).filter(x=>isObject(x)&&Number.isInteger(x.index)&&x.index>index&&isObject(x.entry)&&x.entry.id===m.id).slice(0,RAW_MAX);
 for(const x of twins)s.raw.splice(Math.min(x.index,s.raw.length),0,x.entry);
 return {ok:true,id:m.id,message:t(lang,'restored',m.name)};
}
/* Starting over. A damaged record is replaced by an empty one; a list clogged with rows that cannot be read keeps the
   modifiers it shows (and the readable ones that did not fit into the first rows) and loses the rest. The old record
   is handed back whole for «Вернуть», so nothing is lost by a tap. A record of a newer version is never touched. */
function reset(c,lang){
 if(!isObject(c)||!isObject(c.extra))return fail(lang,'stale');
 const s=store(c),before=c.extra.namedModifiers;let kept=[],key='resetDone';
 if(s.state==='ok'&&clogged(c)){
  const seen=new Set();
  for(const r of s.raw){if(kept.length>=LIMITS.max)break;const m=clean(c,r);if(!m||seen.has(m.id))continue;seen.add(m.id);kept.push(r)}
  key='cleaned';
 }else if(s.state!=='damaged')return s.state==='foreign'?fail(lang,'foreign'):fail(lang,'stale');
 c.extra.namedModifiers={version:1,list:kept};
 let left='';try{left=JSON.stringify(c.extra.namedModifiers)}catch{}
 return {ok:true,message:t(lang,key),undo:{characterId:c.id,record:before,left}};
}
// Takes a reset back, while the record is still exactly what the reset left.
function unreset(c,undo,lang){
 if(!isObject(c)||!isObject(c.extra)||!isObject(undo)||typeof undo.left!=='string'||!undo.left)return fail(lang,'stale');
 let now='';try{now=JSON.stringify(c.extra.namedModifiers)}catch{}
 if(now!==undo.left)return fail(lang,'stale');
 c.extra.namedModifiers=undo.record;
 return {ok:true,message:t(lang,'resetBack')};
}

/* ---------- drawing ---------- */
/* The bar is drawn again after every roll and every tap on the page (sheet-tabs.js), so what the player has open and
   has typed is kept here, per character: it is not part of the sheet and is never saved. */
let open=false;
const drafts=new Map();
const blank=()=>({id:'',name:'',value:'',when:'all',item:''});
function draftOf(c){const key=String(c?.id??'');if(!drafts.has(key)){if(drafts.size>40)drafts.clear();drafts.set(key,blank())}return drafts.get(key)}
const skillLabel=(key,lang)=>String(global.SKILL_LABELS?.[key]?.[L(lang)]||key);
function scopeTag(m,lang){return m.scope==='all'?'':m.scope==='ranged'?t(lang,'tagRanged'):m.scope==='melee'?t(lang,'tagMelee'):m.scope==='stat'?m.key:skillLabel(m.key,lang)}
const whenOf=m=>m.scope==='stat'||m.scope==='skill'?m.scope+':'+m.key:m.scope;
function parseWhen(v){
 const s=String(v??''),i=s.indexOf(':');
 return i<0?{scope:s,key:''}:{scope:s.slice(0,i),key:s.slice(i+1)};
}
// What a modifier is, in words, for a screen reader and for the rows of the editor.
function about(c,m,lang){
 const bits=[m.scope==='all'?t(lang,'tagAll'):scopeTag(m,lang)];
 if(m.itemId)bits.push(owned(c,m.itemId)?t(lang,'whileOwned',itemName(c,m.itemId,lang)):t(lang,'asleep'));
 return bits.join(', ');
}
function chip(c,m,lang){
 const asleep=!!m.itemId&&!owned(c,m.itemId),tag=[scopeTag(m,lang),asleep?t(lang,'asleep'):''].filter(Boolean).join(' · ');
 return `<button type="button" class="nm-chip${asleep?' nm-asleep':''}" role="switch" aria-checked="${m.on}" data-nm-op="toggle" data-nm-id="${esc(m.id)}" data-keep="nm-t-${m.index}" aria-label="${esc(`${m.name}, ${signed(m.value)}, ${about(c,m,lang)}`)}"><span class="nm-name">${esc(m.name)}</span><b>${signed(m.value)}</b>${tag?`<small>${esc(tag)}</small>`:''}</button>`;
}
function row(c,m,lang){
 const asleep=!!m.itemId&&!owned(c,m.itemId),b=(op,label,key)=>`<button type="button" class="cx-button nm-btn" data-nm-op="${op}" data-nm-id="${esc(m.id)}" data-keep="nm-${key}-${m.index}" aria-label="${esc(label+': '+m.name)}">${esc(label)}</button>`;
 return `<div class="nm-row${asleep?' nm-asleep':''}" data-nm-row="${esc(m.id)}"><span class="nm-row-text"><strong>${esc(m.name)}</strong> <b>${signed(m.value)}</b> <small>${esc(about(c,m,lang))} · ${esc(t(lang,m.on?'on':'off'))}</small></span><span class="nm-row-actions">${b('edit',t(lang,'edit'),'e')}${asleep?b('detach',t(lang,'detach'),'u'):''}${b('remove',t(lang,'remove'),'d')}</span></div>`;
}
/* The value is a text field on purpose. A number field throws away the «−» the app itself prints on every switch (and
   a pasted «1,5» becomes 15), so a penalty would be saved as a bonus without a word; a text field lets the save check
   what was really typed. No inputmode either: the number pads of phones have no minus key. */
function parseValue(v){
 const s=String(v??'').trim().replace(/[\u2212\u2013\u2014]/g,'-');
 return /^[+-]?\d{1,3}$/.test(s)?Number(s):NaN;
}
function form(c,lang){
 const d=draftOf(c),editing=d.id?list(c).find(m=>m.id===d.id):null,opt=(value,label,sel)=>`<option value="${esc(value)}"${sel===value?' selected':''}>${esc(label)}</option>`;
 if(d.id&&!editing)Object.assign(d,blank());
 const labels=isObject(global.SKILL_LABELS)?Object.keys(global.SKILL_LABELS):[],extra=isObject(c?.skills)?Object.keys(c.skills).filter(k=>!labels.includes(k)):[];
 const skills=[...labels,...extra].filter(k=>validSkill(c,k)).map(k=>[k,skillLabel(k,lang)]).sort((a,b)=>a[1].localeCompare(b[1],L(lang)));
 const things=kind=>rows(c,kind).filter(r=>validItemId(r.id)).map(r=>[r.id,recordName(r,lang)+(kind==='items'&&Math.floor(Number(r.quantity??1))>1?` ×${Math.floor(Number(r.quantity))}`:'')]);
 const weapons=things('weapons'),items=things('items'),known=!d.item||weapons.some(x=>x[0]===d.item)||items.some(x=>x[0]===d.item);
 const group=(label,list,sel)=>list.length?`<optgroup label="${esc(label)}">${list.map(x=>opt(x[0],x[1],sel)).join('')}</optgroup>`:'';
 return `<div class="nm-form" role="group" aria-label="${esc(editing?t(lang,'formEdit',editing.name):t(lang,'formNew'))}"><strong class="nm-form-title">${esc(editing?t(lang,'formEdit',editing.name):t(lang,'formNew'))}</strong>`
  +`<label class="nm-field nm-field-name"><span>${esc(t(lang,'name'))}</span><input type="text" maxlength="${LIMITS.name}" autocomplete="off" data-nm-field="name" data-keep="nm-name" placeholder="${esc(t(lang,'namePlaceholder'))}" value="${esc(d.name)}"></label>`
  +`<label class="nm-field nm-field-value"><span>${esc(t(lang,'value'))}</span><input type="text" maxlength="6" autocomplete="off" autocapitalize="off" spellcheck="false" data-nm-field="value" data-keep="nm-value" placeholder="+1" value="${esc(d.value)}"></label>`
  +`<label class="nm-field"><span>${esc(t(lang,'when'))}</span><select data-nm-field="when" data-keep="nm-when">${opt('all',t(lang,'all'),d.when)}${opt('ranged',t(lang,'ranged'),d.when)}${opt('melee',t(lang,'melee'),d.when)}${group(t(lang,'statGroup'),STATS.map(k=>['stat:'+k,k]),d.when)}${group(t(lang,'skillGroup'),skills.map(x=>['skill:'+x[0],x[1]]),d.when)}</select></label>`
  +`<label class="nm-field"><span>${esc(t(lang,'item'))}</span><select data-nm-field="item" data-keep="nm-item">${opt('',t(lang,'none'),d.item)}${known?'':opt(d.item,t(lang,'asleep'),d.item)}${group(t(lang,'weaponGroup'),weapons,d.item)}${group(t(lang,'itemGroup'),items,d.item)}</select></label>`
  +`<span class="nm-form-actions"><button type="button" class="cx-button nm-btn nm-primary" data-nm-op="save" data-keep="nm-save">${esc(t(lang,editing?'save':'add'))}</button>${editing?`<button type="button" class="cx-button nm-btn" data-nm-op="cancel" data-keep="nm-cancel">${esc(t(lang,'cancel'))}</button>`:''}</span></div>`;
}
// The block inside the «Следующий бросок» bar: a switch for every modifier and, folded, the place to make and change them.
function bar(c,lang){
 if(!isObject(c))return '';
 try{
  const head=`<div class="nm-bar" data-nm-root role="group" aria-label="${esc(t(lang,'group'))}">`;
  const st=store(c).state,again=key=>`<button type="button" class="cx-button nm-btn" data-nm-op="reset" data-keep="nm-reset">${esc(t(lang,key))}</button>`;
  if(st==='foreign')return `${head}<p class="nm-help">${esc(t(lang,'foreign'))}</p></div>`;
  if(st==='damaged')return `${head}<p class="nm-help">${esc(t(lang,'damaged'))}</p><span class="nm-form-actions">${again('startOver')}</span></div>`;
  const all=list(c),stuck=clogged(c)?`<p class="nm-help">${esc(t(lang,'clogged'))}</p><span class="nm-form-actions nm-stuck">${again('cleanUp')}</span>`:'';
  return `${head}${all.length?`<div class="nm-chips">${all.map(m=>chip(c,m,lang)).join('')}</div>`:''}<details class="nm-edit" data-nm-edit${open?' open':''}><summary data-keep="nm-sum">${esc(t(lang,all.length?'setup':'first'))}</summary><p class="nm-help">${esc(t(lang,'help'))}</p>${all.map(m=>row(c,m,lang)).join('')}${stuck}${form(c,lang)}</details></div>`;
 }catch{return ''}
}
// On an inventory card: what is tied to this thing. To read only; the switches stay next to the roll buttons.
function itemChips(c,rec,lang){
 try{
  if(!isObject(rec)||!validItemId(rec.id))return '';
  return list(c).filter(m=>m.itemId===rec.id).map(m=>`<span class="nm-item-chip${m.on?'':' nm-off'}">${esc(`${t(lang,'cardLine')}: ${m.name} ${signed(m.value)} (${t(lang,m.on?'on':'off')})`)}</span>`).join('');
 }catch{return ''}
}

/* ---------- page wiring ---------- */
const app=()=>global.App,doc=global.document;
const langNow=()=>L(app()?.lang?.());
const say=message=>{if(message)try{app()?.notify?.(message)}catch{}};
const inBar=el=>el?.closest?.('[data-nm-root]');
const focusKeep=key=>{try{doc?.querySelector?.(`.sheet-extras [data-keep="${String(key).replace(/[^\w-]/g,'')}"]`)?.focus?.({preventScroll:true})}catch{}};
// Draws only the bar's surroundings again (nothing on the sheet changed), then puts the keyboard where it should be.
function redraw(key){try{global.SheetTabs?.refreshHud?.()}catch{}if(key)focusKeep(key)}
// After a change of the sheet: save, draw the sheet again so every roll button shows the new number, keep the focus.
function commit(key,fallback){
 const A=app();try{A?.save?.();A?.render?.()}catch{}
 if(!key)return;
 focusKeep(key);
 if(fallback&&doc?.activeElement?.dataset?.keep!==key)focusKeep(fallback);
}
function onClick(e){
 const root=inBar(e.target);if(!root)return;
 const sum=e.target.closest?.('[data-nm-edit] > summary');
 if(sum){
  // The bar is drawn again right after any tap, before the browser tells anyone the block has opened, so the tap is handled here.
  e.preventDefault();open=!open;const box=sum.parentElement;if(box)box.open=open;return;
 }
 const el=e.target.closest?.('[data-nm-op]');
 if(!el){
  // A tap inside the form must not draw the bar again: that would take the caret (and a half-typed word on a phone) away.
  if(e.target.closest?.('.nm-form'))e.stopPropagation();
  return;
 }
 // The button may be gone from the page before this tap has finished its way up, so nobody else is asked about it.
 e.stopPropagation();
 const c=app()?.active?.(),l=langNow();if(!c)return;
 const op=el.dataset.nmOp,id=el.dataset.nmId||'',key=el.dataset.keep||'',d=draftOf(c);
 if(op==='toggle'){const r=toggle(c,id,l);if(r.ok)commit(key);else{say(r.message);redraw()}return}
 if(op==='edit'){
  const m=list(c).find(x=>x.id===id);if(!m){say(t(l,'stale'));redraw();return}
  Object.assign(d,{id:m.id,name:m.name,value:String(m.value),when:whenOf(m),item:m.itemId});open=true;redraw('nm-name');return;
 }
 if(op==='cancel'){Object.assign(d,blank());redraw('nm-name');return}
 if(op==='detach'){const r=detach(c,id,l);if(r.ok)commit('nm-e-'+key.replace(/^nm-u-/,''));else redraw();say(r.message);return}
 if(op==='remove'){
  const r=remove(c,id,l);if(!r.ok){say(r.message);redraw();return}
  if(d.id===id)Object.assign(d,blank());
  commit(key,'nm-sum');
  const back=()=>{
   const A=app(),who=A?.getState?.()?.characters?.find?.(x=>x&&x.id===r.undo.characterId),again=who?restore(who,r.undo,langNow()):fail(langNow(),'stale');
   // The notice that held the keyboard is replaced by the answer, so the focus goes to the switch that has come back.
   if(again.ok){const at=A?.active?.()===who?list(who).find(x=>x.id===again.id):null;if(at)commit('nm-t-'+at.index,'nm-sum');else commit('')}
   say(again.message);
  };
  if(typeof app()?.notifyAction==='function')app().notifyAction(r.message,t(l,'undo'),back);else say(r.message);
  return;
 }
 if(op==='reset'){
  const r=reset(c,l);if(!r.ok){say(r.message);redraw();return}
  commit('nm-sum','nm-name');
  const back=()=>{
   const A=app(),who=A?.getState?.()?.characters?.find?.(x=>x&&x.id===r.undo.characterId),again=who?unreset(who,r.undo,langNow()):fail(langNow(),'stale');
   if(again.ok)commit(A?.active?.()===who?'nm-reset':'','nm-sum');
   say(again.message);
  };
  if(typeof app()?.notifyAction==='function')app().notifyAction(r.message,t(l,'undo'),back);else say(r.message);
  return;
 }
 if(op==='save'){
  const w=parseWhen(d.when);
  const draft={name:d.name,value:parseValue(d.value),scope:w.scope,key:w.key,itemId:d.item};
  const r=d.id?update(c,d.id,draft,l):add(c,draft,l);
  if(!r.ok){say(r.message);focusKeep(r.message===t(l,'errValue')?'nm-value':r.message===t(l,'errName')?'nm-name':key);return}
  Object.assign(d,blank());commit('nm-name');say(r.message);
 }
}
function onField(e){
 const el=e.target;if(!el?.matches?.('[data-nm-field]')||!inBar(el))return;
 // Typing here changes nothing on the sheet; the page must not draw the bar again under the player's fingers.
 e.stopPropagation();
 const c=app()?.active?.();if(!c)return;
 const d=draftOf(c),f=el.dataset.nmField;
 if(f==='name')d.name=String(el.value).slice(0,LIMITS.name*2);
 else if(f==='value')d.value=String(el.value).slice(0,8);
 else if(f==='when')d.when=String(el.value).slice(0,80);
 else if(f==='item')d.item=String(el.value).slice(0,160);
}
// Enter in the name or the value saves, as in a form.
function onKey(e){
 if(e.key!=='Enter'||!e.target?.matches?.('input[data-nm-field]')||!inBar(e.target))return;
 e.preventDefault();inBar(e.target).querySelector('[data-nm-op="save"]')?.click();
}
if(doc?.addEventListener){
 doc.addEventListener('click',onClick,true);
 doc.addEventListener('input',onField,true);
 doc.addEventListener('change',onField,true);
 doc.addEventListener('keydown',onKey,true);
}

global.NamedModifiers={LIMITS,SCOPES,STATS,T,t,cleanName,list,owned,itemName,active,contribute,forCheck,tail,add,update,toggle,detach,remove,restore,reset,unreset,parseValue,bar,itemChips,
 _test:{open:v=>{if(v!==undefined)open=!!v;return open},draft:(c,v)=>{const d=draftOf(c);if(isObject(v))Object.assign(d,v);return d},reset:()=>{open=false;drafts.clear()}}};
})(typeof window!=='undefined'?window:globalThis);
