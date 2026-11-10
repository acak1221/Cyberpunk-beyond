/* «Свои материалы» / My content: items, cyberware and opponents the player makes up.
   Kept apart from the main archive, in its own localStorage key (nightcity-red-custom-v1), and added to backups as the
   top-level `customContent` field. Items are mirrored into window.CATALOG (id «custom-…», custom:true) so the catalog search,
   «Добавить» and «Купить» work on them; opponents are offered to the NPC library (id «cc-…»).
   Everything read from storage or from a pack file is rebuilt field by field from a whitelist: nothing from an untrusted file
   is kept as it came, and every string is escaped when drawn. Original UI text; no rulebook text. */
(function(global){
'use strict';
const KEY='nightcity-red-custom-v1',UNREADABLE_KEY=KEY+':unreadable',FORMAT='nightcity-red-custom',PACK_FORMAT='nightcity-red-content-pack',VERSION=1;
const MAX_ITEMS=300,MAX_NPCS=100,MAX_FILE_CHARS=1e6,MAX_SCAN=2000,MAX_NAME=80,MAX_DESC=400,MAX_TITLE=80,MAX_PRICE=9999999;
const CATEGORIES=['weapon','armor','gear','cyberware'];
const WEAPON_SKILLS=['Handgun','Shoulder Arms','Heavy Weapons','Archery','Melee Weapon'];
const AMMO=['M Pistol','H Pistol','VH Pistol','Slug','Rifle','Arrow','Grenade','Rocket'];
const INSTALL=['Mall','Clinic','Hospital','N/A'];
const DICE=/^([1-9]\d?)d(6|10)$/,HUMANITY=/^(?:0|([1-9])d6(\/2)?)$/,ID=/^[A-Za-z0-9_-]{1,32}$/;
const NPC_NAME=60,NPC_WEAPONS=300,NPC_NOTES=500,NPC_SKILLS=12,NPC_ATTACKS=6,NPC_ITEM=40;

const T={
 ru:{title:'Свои материалы',count:(i,n)=>`ПРЕДМЕТЫ ${i} · ПРОТИВНИКИ ${n}`,open:'Открыть редактор',close:'Свернуть редактор',
  intro:'Придумайте свои предметы, киберимпланты и противников. Предметы появятся в поиске каталога с пометкой «Своё», противники — в разделе «Мастер», в библиотеке NPC. Всё хранится только в этом браузере и попадает в резервную копию.',
  tabItems:'Предметы',tabNpcs:'Противники',tabPack:'Набор (файл)',tabs:'Разделы своих материалов',
  noItems:'Своих предметов пока нет.',noNpcs:'Своих противников пока нет.',newItem:'Новый предмет',newNpc:'Новый противник',
  edit:'Изменить',del:'Удалить',sure:'Точно удалить?',save:'Сохранить',cancel:'Отмена',editing:'ИЗМЕНЕНИЕ',creating:'НОВАЯ ЗАПИСЬ',
  nameRu:'Название (русский)',nameEn:'Название (English)',nameHelp:'Достаточно одного языка — второй заполнится тем же названием.',
  category:'Категория',price:'Цена, eb',priceHelp:'Можно оставить пустым — тогда предмет нельзя купить, только добавить.',
  descRu:'Описание (русский)',descEn:'Описание (English)',
  cat:{weapon:'Оружие',armor:'Броня',gear:'Снаряжение',cyberware:'Киберимплант'},
  damage:'Урон (кубики)',damagePh:'например, 3d6',rof:'Скорострельность (ROF)',hands:'Сколько рук',handsVaries:'по-разному',skill:'Навык',
  concealable:'Можно спрятать под одеждой',magazine:'Магазин, патронов',magazineHelp:'Пусто — оружие без боеприпасов.',ammo:'Тип боеприпасов',noAmmo:'не использует',
  sp:'Прочность брони (SP)',penalty:'Штраф брони',humanity:'Потеря Humanity',install:'Установка',
  inst:{Mall:'Торговый центр',Clinic:'Клиника',Hospital:'Больница','N/A':'Не требуется'},
  sum:{damage:'Урон',rof:'ROF',skill:'Навык',hands:'Руки',mag:'Магазин',sp:'SP',penalty:'Штраф',none:'Без штрафа',loss:'Потеря Humanity',install:'Установка',hidden:'Скрытное'},
  noPrice:'цена не указана',
  npcName:'Имя или название',npcNamePh:'Например, Уличный стрелок',ref:'REF',body:'BODY',will:'WILL',hp:'HP',head:'Броня головы (SP)',torso:'Броня тела (SP)',calc:'HP из BODY/WILL',
  weapons:'Оружие (текстом)',skills:'Навыки для бросков',skillsPh:'Пистолеты 10\nУклонение 7',skillsHelp:'По одному в строке: название и итог (характеристика + навык).',
  attacks:'Атаки',attacksPh:'Тяжёлый пистолет 10 3d6',attacksHelp:'По одной в строке: название, итог атаки и кубики урона (например, 3d6).',notes:'Заметки',
  npcWhere:'Чтобы добавить противника в бой, откройте «Мастер» → «Библиотека NPC».',
  err:{name:'Укажите название хотя бы на одном языке.',category:'Выберите категорию.',price:'Цена — целое число от 0 до 9 999 999 или пусто.',damage:'Урон записывается кубиками: например, 2d6 или 1d10.',skill:'Выберите навык оружия.',sp:'Прочность брони — целое число от 0 до 30.',humanity:'Потеря Humanity: 0, 1d6/2 или от 1d6 до 9d6.',npcName:'Укажите имя противника.',full:'Достигнут предел записей. Удалите лишнее.',line:l=>`Не удалось прочитать строку: «${l}».`,storage:'Не удалось сохранить: в браузере не хватает места.',missing:'Запись не найдена.'},
  saved:'Сохранено.',removed:'Удалено.',
  packIntro:'Набор — это файл со всеми вашими материалами. Отправьте его друзьям или перенесите на другое устройство. Перед загрузкой чужого набора вы увидите, что в нём, и сможете отказаться.',
  packTitle:'Название набора',packTitlePh:'Например, Арсенал Тихоокеанского района',export:'Скачать набор',exportEmpty:'Пока нечего выгружать: добавьте хотя бы одну запись.',
  import:'Открыть файл набора',preview:'ПРЕДПРОСМОТР НАБОРА',untitled:'Набор без названия',
  plan:(a,u,s)=>`Новых: ${a} · заменит ваши: ${u} · без изменений: ${s}`,rejected:n=>`Не прочитано и будет пропущено: ${n}`,overflow:n=>`Не поместится (предел записей): ${n}`,
  tagNew:'новое',tagUpdate:'заменит',tagSame:'уже есть',more:n=>`…и ещё ${n}`,apply:'Добавить в свои материалы',nothing:'В наборе нет ничего нового.',
  imported:(a,u)=>`Набор загружен. Добавлено: ${a}, обновлено: ${u}.`,fromBackup:(n,kept)=>`Свои материалы из копии: ${n}.`+(kept?` Не изменено: ${kept} — у вас уже есть свои версии этих записей.`:''),
  bad:{size:'Файл слишком большой для набора (больше 1 МБ).',json:'Это не файл набора: его не удалось прочитать.',format:'Это не файл набора «Своих материалов».',newer:'Набор сделан в более новой версии приложения. Обновите страницу и попробуйте снова.',empty:'В наборе нет ни одной читаемой записи.'},
  unreadable:'Сохранённые свои материалы не удалось прочитать. Исходная копия отложена в этом браузере.',unreadableGet:'Скачать исходную копию',unreadableDrop:'Удалить копию',
  mark:'Своё',
 },
 en:{title:'My content',count:(i,n)=>`ITEMS ${i} · OPPONENTS ${n}`,open:'Open the editor',close:'Close the editor',
  intro:'Make up your own items, cyberware and opponents. Items show up in the catalog search marked “Custom”; opponents appear under GM, in the NPC library. Everything stays in this browser and is included in backups.',
  tabItems:'Items',tabNpcs:'Opponents',tabPack:'Pack (file)',tabs:'My content sections',
  noItems:'No custom items yet.',noNpcs:'No custom opponents yet.',newItem:'New item',newNpc:'New opponent',
  edit:'Edit',del:'Delete',sure:'Really delete?',save:'Save',cancel:'Cancel',editing:'EDITING',creating:'NEW ENTRY',
  nameRu:'Name (Russian)',nameEn:'Name (English)',nameHelp:'One language is enough — the other one will use the same name.',
  category:'Category',price:'Price, eb',priceHelp:'May stay empty — then the item can be added but not bought.',
  descRu:'Description (Russian)',descEn:'Description (English)',
  cat:{weapon:'Weapon',armor:'Armor',gear:'Gear',cyberware:'Cyberware'},
  damage:'Damage (dice)',damagePh:'e.g. 3d6',rof:'Rate of fire (ROF)',hands:'Hands needed',handsVaries:'varies',skill:'Skill',
  concealable:'Can be hidden under clothing',magazine:'Magazine, rounds',magazineHelp:'Empty — the weapon uses no ammunition.',ammo:'Ammunition type',noAmmo:'none',
  sp:'Stopping power (SP)',penalty:'Armor penalty',humanity:'Humanity loss',install:'Installation',
  inst:{Mall:'Mall',Clinic:'Clinic',Hospital:'Hospital','N/A':'Not needed'},
  sum:{damage:'Damage',rof:'ROF',skill:'Skill',hands:'Hands',mag:'Magazine',sp:'SP',penalty:'Penalty',none:'No penalty',loss:'Humanity loss',install:'Installation',hidden:'Concealable'},
  noPrice:'price not specified',
  npcName:'Name',npcNamePh:'e.g. Street shooter',ref:'REF',body:'BODY',will:'WILL',hp:'HP',head:'Head armor (SP)',torso:'Body armor (SP)',calc:'HP from BODY/WILL',
  weapons:'Weapons (free text)',skills:'Skills to roll',skillsPh:'Handgun 10\nEvasion 7',skillsHelp:'One per line: the name and the total (STAT + Skill).',
  attacks:'Attacks',attacksPh:'Heavy Pistol 10 3d6',attacksHelp:'One per line: the name, the attack total and the damage dice (for example 3d6).',notes:'Notes',
  npcWhere:'To put an opponent into a fight, open GM → NPC library.',
  err:{name:'Enter a name in at least one language.',category:'Choose a category.',price:'The price is a whole number from 0 to 9,999,999, or empty.',damage:'Damage is written as dice: for example 2d6 or 1d10.',skill:'Choose the weapon skill.',sp:'Stopping power is a whole number from 0 to 30.',humanity:'Humanity loss: 0, 1d6/2, or 1d6 to 9d6.',npcName:'Enter the opponent’s name.',full:'The entry limit is reached. Delete something first.',line:l=>`Could not read the line: “${l}”.`,storage:'Could not save: the browser is out of space.',missing:'The entry was not found.'},
  saved:'Saved.',removed:'Deleted.',
  packIntro:'A pack is a file with all of your content. Send it to friends or move it to another device. Before a pack from someone else is loaded you will see what is in it and can decline.',
  packTitle:'Pack title',packTitlePh:'e.g. Pacifica arsenal',export:'Download the pack',exportEmpty:'Nothing to export yet: add at least one entry.',
  import:'Open a pack file',preview:'PACK PREVIEW',untitled:'Untitled pack',
  plan:(a,u,s)=>`New: ${a} · replaces yours: ${u} · unchanged: ${s}`,rejected:n=>`Unreadable, will be skipped: ${n}`,overflow:n=>`Will not fit (entry limit): ${n}`,
  tagNew:'new',tagUpdate:'replaces',tagSame:'already here',more:n=>`…and ${n} more`,apply:'Add to my content',nothing:'The pack holds nothing new.',
  imported:(a,u)=>`Pack loaded. Added: ${a}, updated: ${u}.`,fromBackup:(n,kept)=>`Custom content from the backup: ${n}.`+(kept?` Left as they are: ${kept} — you already have your own versions of these entries.`:''),
  bad:{size:'The file is too large for a pack (over 1 MB).',json:'This is not a pack file: it could not be read.',format:'This is not a “My content” pack file.',newer:'The pack was made by a newer version of the app. Reload the page and try again.',empty:'The pack has no readable entries.'},
  unreadable:'The saved custom content could not be read. The original copy was set aside in this browser.',unreadableGet:'Download the original copy',unreadableDrop:'Delete the copy',
  mark:'Custom',
 },
};
const L=lang=>lang==='en'?'en':'ru';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ---------- cleaning: every stored or imported value goes through these ----------
function line(v,max){return typeof v==='string'?v.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):''}
function para(v,max){return typeof v==='string'?v.replace(/\r/g,'').replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f\u2028\u2029]/g,'').trim().slice(0,max):''}
function int(v,lo,hi,d){const n=typeof v==='number'?v:typeof v==='string'&&/^\s*-?\d{1,9}\s*$/.test(v)?Number(v):NaN;return Number.isFinite(n)?Math.min(hi,Math.max(lo,Math.trunc(n))):d}
function exact(v,lo,hi){const n=typeof v==='number'?v:typeof v==='string'&&/^\s*-?\d{1,9}\s*$/.test(v)?Number(v):NaN;return Number.isSafeInteger(n)&&n>=lo&&n<=hi?n:null}
const blank=v=>v===undefined||v===null||(typeof v==='string'&&v.trim()==='');
const plainObject=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function pair(v,max){const o=plainObject(v)?v:{};return {ru:line(o.ru,max),en:line(o.en,max)}}
function humanityAtCreation(loss){const m=HUMANITY.exec(loss);if(!m||!m[1])return 0;const fixed=Math.floor(3.5*Number(m[1]));return m[2]?Math.ceil(fixed/2):fixed}

// {ok:true,item} with a freshly built item, or {ok:false,reason}. Reasons: id, name, category, price, damage, skill, sp, humanity.
function checkItem(raw){
 if(!plainObject(raw))return {ok:false,reason:'name'};
 const id=typeof raw.id==='string'&&ID.test(raw.id)?raw.id:null;if(!id)return {ok:false,reason:'id'};
 const name=pair(raw.name,MAX_NAME);if(!name.ru&&!name.en)return {ok:false,reason:'name'};
 const category=CATEGORIES.includes(raw.category)?raw.category:null;if(!category)return {ok:false,reason:'category'};
 let price=null;if(!blank(raw.price)){price=exact(raw.price,0,MAX_PRICE);if(price===null)return {ok:false,reason:'price'}}
 const s=plainObject(raw.stats)?raw.stats:{},stats={};
 if(category==='weapon'){
  const damage=typeof s.damage==='string'?s.damage.trim().toLowerCase():'';if(!DICE.test(damage))return {ok:false,reason:'damage'};
  if(!WEAPON_SKILLS.includes(s.skill))return {ok:false,reason:'skill'};
  const magazine=blank(s.magazine)?null:exact(s.magazine,1,999),ammo=magazine&&AMMO.includes(s.ammo)?s.ammo:null;
  Object.assign(stats,{damage,rof:int(s.rof,1,4,1),hands:s.hands==='varies'?'varies':int(s.hands,1,2,1),concealable:s.concealable===true,skill:s.skill,magazine:ammo?magazine:null,ammo});
 }else if(category==='armor'){
  const sp=exact(s.sp,0,30);if(sp===null)return {ok:false,reason:'sp'};
  Object.assign(stats,{sp,penalty:int(s.penalty,-6,0,0)});
 }else if(category==='cyberware'){
  const loss=blank(s.humanityLoss)?'0':typeof s.humanityLoss==='number'?String(s.humanityLoss):String(s.humanityLoss).trim().toLowerCase();
  if(typeof loss!=='string'||!HUMANITY.test(loss))return {ok:false,reason:'humanity'};
  Object.assign(stats,{humanityLoss:loss,humanityLossAtCreation:humanityAtCreation(loss),installation:INSTALL.includes(s.installation)?s.installation:'Clinic'});
 }
 return {ok:true,item:{id,category,name,price,details:pair(raw.details,MAX_DESC),stats}};
}
const cleanItem=raw=>{const r=checkItem(raw);return r.ok?r.item:null};

// Opponents use the NPC library's shape and limits, so an entry can be handed to it as is.
function cleanSkills(v){const out=[];for(const x of Array.isArray(v)?v.slice(0,MAX_SCAN):[]){const name=line(x?.name,NPC_ITEM),base=int(x?.base,0,40,NaN);if(name&&Number.isFinite(base))out.push({name,base});if(out.length>=NPC_SKILLS)break}return out}
function cleanAttacks(v){const out=[];for(const x of Array.isArray(v)?v.slice(0,MAX_SCAN):[]){const name=line(x?.name,NPC_ITEM),base=int(x?.base,0,40,NaN),damage=typeof x?.damage==='string'?x.damage.trim().toLowerCase():'';if(name&&Number.isFinite(base)&&DICE.test(damage))out.push({name,base,damage});if(out.length>=NPC_ATTACKS)break}return out}
function checkNpc(raw){
 if(!plainObject(raw))return {ok:false,reason:'npcName'};
 const id=typeof raw.id==='string'&&ID.test(raw.id)?raw.id:null;if(!id)return {ok:false,reason:'id'};
 const name=line(raw.name,NPC_NAME);if(!name)return {ok:false,reason:'npcName'};
 const o={id,name,ref:int(raw.ref,0,20,6),hp:int(raw.hp,0,999,30),head:int(raw.head,0,30,0),torso:int(raw.torso,0,30,0),weapons:para(raw.weapons,NPC_WEAPONS),notes:para(raw.notes,NPC_NOTES)};
 const b=int(raw.body,0,20,0),w=int(raw.will,0,20,0);if(b)o.body=b;if(w)o.will=w;
 const skills=cleanSkills(raw.skills),attacks=cleanAttacks(raw.attacks);if(skills.length)o.skills=skills;if(attacks.length)o.attacks=attacks;
 return {ok:true,npc:o};
}
const cleanNpc=raw=>{const r=checkNpc(raw);return r.ok?r.npc:null};
function hpFromStats(body,will){const b=exact(body,1,20),w=exact(will,1,20);return b!==null&&w!==null?10+5*Math.ceil((b+w)/2):null}
function parseLines(text,pattern,make,max){const list=[],bad=[];for(const raw of String(text??'').split('\n').slice(0,100)){const l=line(raw,90);if(!l)continue;const m=pattern.exec(l),item=m?make(m):null;if(item&&item.name&&list.length<max)list.push(item);else bad.push(l)}return {list,bad}}
const parseSkills=text=>parseLines(text,/^(.+?)[\s:+]+(\d{1,2})$/,m=>({name:line(m[1],NPC_ITEM),base:int(m[2],0,40,0)}),NPC_SKILLS);
const parseAttacks=text=>parseLines(text,/^(.+?)[\s:+]+(\d{1,2})[\s,;]+(\d{1,2}d(?:6|10))$/i,m=>({name:line(m[1],NPC_ITEM),base:int(m[2],0,40,0),damage:m[3].toLowerCase()}),NPC_ATTACKS);

// Reads a stored or imported collection: unknown fields are dropped, broken entries are counted, ids stay unique.
function cleanData(raw){
 const out={items:[],npcs:[],rejected:[]},src=plainObject(raw)?raw:{};
 const take=(list,check,key,target,max,kind)=>{const seen=new Set();for(const x of Array.isArray(list)?list.slice(0,MAX_SCAN):[]){const r=check(x);
  if(r.ok&&!seen.has(r[key].id)&&target.length<max){seen.add(r[key].id);target.push(r[key])}
  else out.rejected.push({kind,name:line(plainObject(x)?(typeof x.name==='string'?x.name:x.name?.ru||x.name?.en):'',60),reason:r.ok?(seen.has(r[key].id)?'duplicate':'full'):r.reason})}};
 take(src.items,checkItem,'item',out.items,MAX_ITEMS,'item');take(src.npcs,checkNpc,'npc',out.npcs,MAX_NPCS,'npc');
 return out;
}
const emptyData=()=>({items:[],npcs:[]});

// ---------- catalog and NPC library views of the data ----------
function statLine(item,lang){
 const t=T[L(lang)],s=item.stats||{},sum=t.sum;
 if(item.category==='weapon')return [`${sum.damage} ${s.damage}`,`${sum.rof} ${s.rof}`,`${sum.skill}: ${s.skill}`,`${sum.hands}: ${s.hands==='varies'?t.handsVaries:s.hands}`,s.ammo?`${sum.mag} ${s.magazine} (${s.ammo})`:'',s.concealable?sum.hidden:''].filter(Boolean).join(' · ');
 if(item.category==='armor')return `${sum.sp} ${s.sp} · ${s.penalty?`${sum.penalty} ${s.penalty}`:sum.none}`;
 return '';
}
function toCatalogItem(item){
 const text=lang=>[statLine(item,lang),item.details[lang]||item.details[lang==='ru'?'en':'ru']].filter(Boolean).join(' · ').slice(0,600);
 return {id:'custom-'+item.id,custom:true,category:item.category,name:{ru:item.name.ru||item.name.en,en:item.name.en||item.name.ru},price:item.price,page:null,details:{ru:text('ru'),en:text('en')},stats:JSON.parse(JSON.stringify(item.stats))};
}
const toNpcEntry=npc=>({...JSON.parse(JSON.stringify(npc)),id:'cc-'+npc.id});
// window.CATALOG is changed in place: other modules hold on to the same array.
function syncCatalog(catalog,items){
 if(!Array.isArray(catalog))return 0;
 for(let i=catalog.length-1;i>=0;i--)if(catalog[i]&&catalog[i].custom===true)catalog.splice(i,1);
 const taken=new Set(catalog.map(x=>x&&x.id));let n=0;
 for(const item of items){const c=toCatalogItem(item);if(!taken.has(c.id)){taken.add(c.id);catalog.push(c);n++}}
 return n;
}

// ---------- pack files ----------
function buildPack(data,title,now=new Date()){const d=cleanData(data);return {format:PACK_FORMAT,version:VERSION,title:line(title,MAX_TITLE),exportedAt:now.toISOString(),items:d.items,npcs:d.npcs}}
// Accepts a pack, the stored collection, or a full backup that carries `customContent`.
function readPack(value){
 if(!plainObject(value))return {ok:false,reason:'format'};
 let src=value;
 if(value.format==='nightcity-red-backup'){if(!plainObject(value.customContent))return {ok:false,reason:'format'};src=value.customContent}
 if(src.format!==PACK_FORMAT&&src.format!==FORMAT)return {ok:false,reason:'format'};
 if(src.version!==VERSION)return {ok:false,reason:Number.isSafeInteger(src.version)&&src.version>VERSION?'newer':'format'};
 const d=cleanData(src);
 if(!d.items.length&&!d.npcs.length)return {ok:false,reason:'empty',rejected:d.rejected};
 return {ok:true,title:line(src.title,MAX_TITLE),items:d.items,npcs:d.npcs,rejected:d.rejected};
}
function parsePack(text){
 if(typeof text!=='string')return {ok:false,reason:'json'};
 if(text.length>MAX_FILE_CHARS)return {ok:false,reason:'size'};
 let value;try{value=JSON.parse(text)}catch{return {ok:false,reason:'json'}}
 return readPack(value);
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// What loading a pack would do: every entry is new, an update of an entry with the same id, the same as stored, or over the limit.
function planImport(current,pack){
 const plan={items:[],npcs:[],added:0,updated:0,same:0,overflow:0};
 for(const [key,max] of [['items',MAX_ITEMS],['npcs',MAX_NPCS]]){
  const have=new Map(current[key].map(x=>[x.id,x]));let room=max-current[key].length;
  for(const entry of pack[key]){
   const old=have.get(entry.id);let status;
   if(old)status=same(old,entry)?'same':'update';else if(room>0){status='new';room--}else status='overflow';
   plan[key].push({entry,status});plan[{new:'added',update:'updated',same:'same',overflow:'overflow'}[status]]++;
  }
 }
 return plan;
}
function applyImport(current,pack,addOnly){
 const plan=planImport(current,pack),next={items:current.items.slice(),npcs:current.npcs.slice()};
 for(const key of ['items','npcs'])for(const {entry,status} of plan[key]){
  if(status==='new')next[key].push(entry);
  else if(status==='update'&&!addOnly)next[key]=next[key].map(x=>x.id===entry.id?entry:x);
 }
 return {data:next,added:plan.added,updated:plan.updated,same:plan.same,overflow:plan.overflow};
}

// ---------- list edits (pure) ----------
let seq=0;
function newId(){return 'c'+Date.now().toString(36)+(seq++).toString(36)+Math.floor(Math.random()*46656).toString(36)}
function upsert(list,entry,max){
 if(list.some(x=>x.id===entry.id))return {ok:true,list:list.map(x=>x.id===entry.id?entry:x)};
 if(list.length>=max)return {ok:false,reason:'full',list};
 return {ok:true,list:[...list,entry]};
}
function saveItem(data,raw,id=newId()){const r=checkItem({...raw,id:raw&&raw.id||id});if(!r.ok)return r;const u=upsert(data.items,r.item,MAX_ITEMS);return u.ok?{ok:true,entry:r.item,data:{items:u.list,npcs:data.npcs}}:u}
function saveNpc(data,raw,id=newId()){const r=checkNpc({...raw,id:raw&&raw.id||id});if(!r.ok)return r;const u=upsert(data.npcs,r.npc,MAX_NPCS);return u.ok?{ok:true,entry:r.npc,data:{items:data.items,npcs:u.list}}:u}
function remove(data,kind,id){const key=kind==='npc'?'npcs':'items',list=data[key].filter(x=>x.id!==id);return {ok:list.length!==data[key].length,data:{...data,[key]:list}}}

// ---------- storage ----------
let data=emptyData(),unreadable=false;
const storage=()=>{try{return global.localStorage||null}catch{return null}};
function load(){
 const ls=storage();data=emptyData();unreadable=false;
 let raw=null;try{raw=ls?ls.getItem(KEY):null}catch{}
 try{unreadable=!!ls&&ls.getItem(UNREADABLE_KEY)!==null}catch{}
 if(typeof raw!=='string')return data;
 let value=null;try{value=JSON.parse(raw)}catch{}
 if(!plainObject(value)||value.format!==FORMAT||!Number.isSafeInteger(value.version)||value.version>VERSION){
  // Never overwrite what could not be read: one copy is set aside, the editor says so and offers it as a download.
  try{if(raw.length<=MAX_FILE_CHARS*2&&ls.getItem(UNREADABLE_KEY)===null)ls.setItem(UNREADABLE_KEY,raw);unreadable=ls.getItem(UNREADABLE_KEY)!==null}catch{}
  return data;
 }
 const d=cleanData(value);data={items:d.items,npcs:d.npcs};
 return data;
}
function persist(next){
 const d=cleanData(next),clean={items:d.items,npcs:d.npcs},ls=storage();
 try{
  if(!clean.items.length&&!clean.npcs.length)ls.removeItem(KEY);
  else ls.setItem(KEY,JSON.stringify({format:FORMAT,version:VERSION,...clean}));
 }catch{return false}
 data=clean;syncCatalog(global.CATALOG,data.items);
 return true;
}
const getData=()=>JSON.parse(JSON.stringify(data));
const npcEntries=()=>data.npcs.map(toNpcEntry);
// The backup file carries the collection next to the main archive; a backup without it changes nothing here.
function backupPart(){return data.items.length||data.npcs.length?{customContent:{format:FORMAT,version:VERSION,items:getData().items,npcs:getData().npcs}}:{}}
const backupPack=file=>{const src=plainObject(file)&&plainObject(file.customContent)?file.customContent:null,pack=src?readPack(src):null;return pack&&pack.ok?pack:null};
// What adding a backup would do here, for a preview: `kept` are entries stored here under the same id with other content.
function backupPlan(file){const pack=backupPack(file);if(!pack)return null;const p=planImport(data,pack);return {added:p.added,kept:p.updated,same:p.same,overflow:p.overflow}}
// A backup only adds: an entry edited here is never replaced by the file's version, like the sheets of the main archive.
// `overwrite` is for "replace everything with the archive", where the user has agreed to take the file's versions.
function restoreFromBackup(file,opts){
 const o=opts===true?{quiet:true}:plainObject(opts)?opts:{},overwrite=o.overwrite===true;
 const pack=backupPack(file);if(!pack)return {ok:false,changed:0,kept:0};
 const r=applyImport(data,pack,!overwrite),changed=r.added+(overwrite?r.updated:0),kept=overwrite?0:r.updated;
 if(changed&&!persist(r.data))return {ok:false,changed:0,kept:0};
 if(!o.quiet&&(changed||kept))notify(T[L(appLang())].fromBackup(changed,kept));
 return {ok:true,changed,kept};
}

// ---------- UI ----------
const EMPTY_ITEM=()=>({nameRu:'',nameEn:'',category:'gear',price:'',descRu:'',descEn:'',damage:'',rof:'1',hands:'1',concealable:false,skill:'Handgun',magazine:'',ammo:'',sp:'',penalty:'0',humanityLoss:'0',installation:'Clinic'});
const EMPTY_NPC=()=>({name:'',ref:6,body:'',will:'',hp:30,head:0,torso:0,weapons:'',notes:'',skillsText:'',attacksText:''});
let ui={open:false,tab:'items',kind:null,editing:null,draft:null,error:'',armed:null,preview:null,packError:'',packTitle:''};
function reset(){ui={open:false,tab:'items',kind:null,editing:null,draft:null,error:'',armed:null,preview:null,packError:'',packTitle:''}}
function appLang(){try{return global.App?.lang?.()||'ru'}catch{return 'ru'}}
function notify(m){try{global.App.notify(m)}catch{}}
function itemDraft(item){const s=item.stats||{};return {...EMPTY_ITEM(),nameRu:item.name.ru,nameEn:item.name.en,category:item.category,price:item.price===null?'':String(item.price),descRu:item.details.ru,descEn:item.details.en,
 ...(item.category==='weapon'?{damage:s.damage,rof:String(s.rof),hands:String(s.hands),concealable:!!s.concealable,skill:s.skill,magazine:s.magazine===null?'':String(s.magazine),ammo:s.ammo||''}:{}),
 ...(item.category==='armor'?{sp:String(s.sp),penalty:String(s.penalty)}:{}),
 ...(item.category==='cyberware'?{humanityLoss:s.humanityLoss,installation:s.installation}:{})}}
function draftItem(d){
 const stats=d.category==='weapon'?{damage:d.damage,rof:d.rof,hands:d.hands,concealable:d.concealable===true,skill:d.skill,magazine:d.magazine,ammo:d.ammo}:d.category==='armor'?{sp:d.sp,penalty:d.penalty}:d.category==='cyberware'?{humanityLoss:d.humanityLoss,installation:d.installation}:{};
 return {category:d.category,name:{ru:d.nameRu,en:d.nameEn},price:d.price,details:{ru:d.descRu,en:d.descEn},stats};
}
const skillsText=list=>cleanSkills(list).map(x=>`${x.name} ${x.base}`).join('\n'),attacksText=list=>cleanAttacks(list).map(x=>`${x.name} ${x.base} ${x.damage}`).join('\n');
function npcDraft(n){return {...EMPTY_NPC(),...n,body:n.body||'',will:n.will||'',skillsText:skillsText(n.skills),attacksText:attacksText(n.attacks)}}

const text=(label,key,value,max,more='')=>`<label class="field">${esc(label)}<input type="text" maxlength="${max}" data-cc-field="${key}" value="${esc(value)}"${more}></label>`;
const num=(label,key,value,min,max)=>`<label class="field">${esc(label)}<input type="number" inputmode="numeric" min="${min}" max="${max}" data-cc-field="${key}" value="${esc(value)}"></label>`;
const select=(label,key,value,options)=>`<label class="field">${esc(label)}<select data-cc-field="${key}">${options.map(([v,n])=>`<option value="${esc(v)}"${String(value)===String(v)?' selected':''}>${esc(n)}</option>`).join('')}</select></label>`;
const area=(label,key,value,max,rows,ph='',help='')=>`<label class="field">${esc(label)}<textarea rows="${rows}" maxlength="${max}" data-cc-field="${key}" placeholder="${esc(ph)}">${esc(value)}</textarea>${help?`<small class="cc-help">${esc(help)}</small>`:''}</label>`;
// Errors are kept as keys and worded when drawn, so they follow the language switch.
const errorText=(t,e)=>!e?'':e.bad?(t.bad[e.bad]||t.bad.format):e.key==='line'?t.err.line(e.arg):(t.err[e.key]||t.err.name);
const formEnd=t=>`${ui.error?`<p class="cc-error" role="alert" tabindex="-1">${esc(errorText(t,ui.error))}</p>`:''}<div class="cc-row"><button type="button" class="btn primary" data-cc-action="save">${esc(t.save)}</button><button type="button" class="btn ghost" data-cc-action="cancel">${esc(t.cancel)}</button></div>`;
function itemForm(t){
 const d=ui.draft,c=d.category;
 const stats=c==='weapon'?`<div class="cc-grid">${text(t.damage,'damage',d.damage,6,` placeholder="${esc(t.damagePh)}" autocapitalize="off" spellcheck="false"`)}${select(t.rof,'rof',d.rof,[1,2,3,4].map(v=>[v,v]))}${select(t.hands,'hands',d.hands,[[1,'1'],[2,'2'],['varies',t.handsVaries]])}${select(t.skill,'skill',d.skill,WEAPON_SKILLS.map(v=>[v,v]))}${num(t.magazine,'magazine',d.magazine,1,999)}${select(t.ammo,'ammo',d.ammo,[['',t.noAmmo],...AMMO.map(v=>[v,v])])}</div><small class="cc-help">${esc(t.magazineHelp)}</small><label class="cc-check"><input type="checkbox" data-cc-field="concealable"${d.concealable?' checked':''}> <span>${esc(t.concealable)}</span></label>`
  :c==='armor'?`<div class="cc-grid">${num(t.sp,'sp',d.sp,0,30)}${select(t.penalty,'penalty',d.penalty,[0,-1,-2,-3,-4,-5,-6].map(v=>[v,v]))}</div>`
  :c==='cyberware'?`<div class="cc-grid">${select(t.humanity,'humanityLoss',d.humanityLoss,['0','1d6/2','1d6','2d6','3d6','4d6','5d6','6d6','7d6','8d6','9d6'].map(v=>[v,v]))}${select(t.install,'installation',d.installation,INSTALL.map(v=>[v,t.inst[v]]))}</div>`:'';
 return `<div class="cc-form" data-cc-form><p class="overline">${esc(ui.editing?t.editing:t.creating)}</p><div class="cc-grid cc-two">${text(t.nameRu,'nameRu',d.nameRu,MAX_NAME)}${text(t.nameEn,'nameEn',d.nameEn,MAX_NAME)}</div><small class="cc-help">${esc(t.nameHelp)}</small><div class="cc-grid cc-two">${select(t.category,'category',c,CATEGORIES.map(v=>[v,t.cat[v]]))}${num(t.price,'price',d.price,0,MAX_PRICE)}</div><small class="cc-help">${esc(t.priceHelp)}</small>${stats}${area(t.descRu,'descRu',d.descRu,MAX_DESC,2)}${area(t.descEn,'descEn',d.descEn,MAX_DESC,2)}${formEnd(t)}</div>`;
}
function npcForm(t){
 const d=ui.draft;
 return `<div class="cc-form" data-cc-form><p class="overline">${esc(ui.editing?t.editing:t.creating)}</p>${text(t.npcName,'name',d.name,NPC_NAME,` placeholder="${esc(t.npcNamePh)}"`)}<div class="cc-grid">${num(t.ref,'ref',d.ref,0,20)}${num(t.body,'body',d.body,0,20)}${num(t.will,'will',d.will,0,20)}${num(t.hp,'hp',d.hp,0,999)}${num(t.head,'head',d.head,0,30)}${num(t.torso,'torso',d.torso,0,30)}</div><div class="cc-row"><button type="button" class="btn ghost" data-cc-action="calc">${esc(t.calc)}</button></div>${area(t.attacks,'attacksText',d.attacksText,600,3,t.attacksPh,t.attacksHelp)}${area(t.skills,'skillsText',d.skillsText,700,3,t.skillsPh,t.skillsHelp)}${area(t.weapons,'weapons',d.weapons,NPC_WEAPONS,2)}${area(t.notes,'notes',d.notes,NPC_NOTES,2)}${formEnd(t)}</div>`;
}
function entryButtons(t,kind,id){
 const armed=ui.armed===kind+':'+id;
 return `<div class="cc-row"><button type="button" class="btn ghost" data-cc-action="edit" data-cc-kind="${kind}" data-cc-id="${esc(id)}">${esc(t.edit)}</button><button type="button" class="btn ghost cc-del${armed?' armed':''}" data-cc-action="del" data-cc-kind="${kind}" data-cc-id="${esc(id)}">${esc(armed?t.sure:t.del)}</button></div>`;
}
function itemEntry(item,t,lang){
 const c=toCatalogItem(item),loss=item.category==='cyberware'?`${t.sum.loss}: ${item.stats.humanityLoss} · ${t.sum.install}: ${t.inst[item.stats.installation]}`:'';
 return `<li class="cc-entry"><div class="cc-head"><strong>${esc(c.name[lang])}</strong><span class="cc-meta"><span class="badge">${esc(t.cat[item.category])}</span> ${esc(item.price===null?t.noPrice:item.price+' eb')}</span></div>${c.details[lang]||loss?`<p class="cc-text">${esc([c.details[lang],loss].filter(Boolean).join(' · '))}</p>`:''}${entryButtons(t,'item',item.id)}</li>`;
}
function npcEntry(n,t){
 const stats=`${t.ref} ${n.ref} · ${t.hp} ${n.hp}${n.body||n.will?` · ${t.body}/${t.will} ${n.body||'–'}/${n.will||'–'}`:''} · SP ${n.head}/${n.torso}`;
 const rolls=[...(n.attacks||[]).map(a=>`${a.name} +${a.base} ${a.damage}`),...(n.skills||[]).map(s=>`${s.name} +${s.base}`)].join(' · ');
 return `<li class="cc-entry"><div class="cc-head"><strong>${esc(n.name)}</strong><span class="cc-meta">${esc(stats)}</span></div>${rolls?`<p class="cc-text">${esc(rolls)}</p>`:''}${n.weapons?`<p class="cc-text">${esc(n.weapons)}</p>`:''}${n.notes?`<p class="cc-text cc-muted">${esc(n.notes)}</p>`:''}${entryButtons(t,'npc',n.id)}</li>`;
}
function previewHtml(t,lang){
 const p=ui.preview;if(!p)return '';
 const plan=planImport(data,p),tag={new:t.tagNew,update:t.tagUpdate,same:t.tagSame,overflow:'—'},SHOW=40;
 const rows=(list,name)=>list.slice(0,SHOW).map(x=>`<li><span class="cc-tag cc-tag-${x.status}">${esc(tag[x.status])}</span> <span>${esc(name(x.entry))}</span></li>`).join('')+(list.length>SHOW?`<li class="cc-muted">${esc(t.more(list.length-SHOW))}</li>`:'');
 const itemName=e=>{const c=toCatalogItem(e);return `${c.name[lang]} — ${t.cat[e.category]}${e.price===null?'':', '+e.price+' eb'}`},npcName=e=>`${e.name} — ${t.ref} ${e.ref}, ${t.hp} ${e.hp}`;
 const can=plan.added+plan.updated>0;
 return `<div class="cc-preview" data-cc-preview><p class="overline">${esc(t.preview)}</p><h3 class="cc-pack-title">${esc(p.title||t.untitled)}</h3><p class="cc-text">${esc(t.plan(plan.added,plan.updated,plan.same))}</p>${plan.overflow?`<p class="cc-text cc-warn">${esc(t.overflow(plan.overflow))}</p>`:''}${p.rejected.length?`<p class="cc-text cc-warn">${esc(t.rejected(p.rejected.length))}</p>`:''}${plan.items.length?`<h4>${esc(t.tabItems)} · ${plan.items.length}</h4><ul class="cc-plan">${rows(plan.items,itemName)}</ul>`:''}${plan.npcs.length?`<h4>${esc(t.tabNpcs)} · ${plan.npcs.length}</h4><ul class="cc-plan">${rows(plan.npcs,npcName)}</ul>`:''}${can?'':`<p class="cc-text">${esc(t.nothing)}</p>`}<div class="cc-row">${can?`<button type="button" class="btn primary" data-cc-action="apply">${esc(t.apply)}</button>`:''}<button type="button" class="btn ghost" data-cc-action="discard">${esc(t.cancel)}</button></div></div>`;
}
function packTab(t,lang){
 const any=data.items.length||data.npcs.length;
 return `<p class="cc-lead">${esc(t.packIntro)}</p><div class="cc-pack">${text(t.packTitle,'packTitle',ui.packTitle,MAX_TITLE,` placeholder="${esc(t.packTitlePh)}"`)}<div class="cc-row"><button type="button" class="btn ghost" data-cc-action="export"${any?'':' disabled'}>↓ ${esc(t.export)}</button><label class="btn ghost cc-file"><span>↑ ${esc(t.import)}</span><input type="file" accept="application/json,.json" data-cc-file class="cc-file-input"></label></div>${any?'':`<p class="cc-lead">${esc(t.exportEmpty)}</p>`}</div>${ui.packError?`<p class="cc-error" role="alert" tabindex="-1">${esc(errorText(t,ui.packError))}</p>`:''}${previewHtml(t,lang)}`;
}
function render(lang){
 const l=L(lang),t=T[l];
 const tabs=[['items',t.tabItems,data.items.length],['npcs',t.tabNpcs,data.npcs.length],['pack',t.tabPack,null]];
 let body='';
 if(ui.open){
  const tab=ui.tab==='npcs'||ui.tab==='pack'?ui.tab:'items';
  const inner=tab==='pack'?packTab(t,l)
   :tab==='npcs'?`${data.npcs.length?`<ul class="cc-list">${data.npcs.map(n=>npcEntry(n,t)).join('')}</ul><p class="cc-lead">${esc(t.npcWhere)}</p>`:`<p class="cc-lead">${esc(t.noNpcs)}</p>`}${ui.draft&&ui.kind==='npc'?npcForm(t):`<button type="button" class="btn primary" data-cc-action="new" data-cc-kind="npc">＋ ${esc(t.newNpc)}</button>`}`
   :`${data.items.length?`<ul class="cc-list">${data.items.map(i=>itemEntry(i,t,l)).join('')}</ul>`:`<p class="cc-lead">${esc(t.noItems)}</p>`}${ui.draft&&ui.kind==='item'?itemForm(t):`<button type="button" class="btn primary" data-cc-action="new" data-cc-kind="item">＋ ${esc(t.newItem)}</button>`}`;
  body=`<div class="cc-body" id="cc-body"><p class="cc-lead">${esc(t.intro)}</p>${unreadable?`<div class="cc-unreadable" role="status"><p class="cc-text cc-warn">${esc(t.unreadable)}</p><div class="cc-row"><button type="button" class="btn ghost" data-cc-action="unreadable-get">${esc(t.unreadableGet)}</button><button type="button" class="btn ghost" data-cc-action="unreadable-drop">${esc(t.unreadableDrop)}</button></div></div>`:''}<div class="cc-tabs" role="group" aria-label="${esc(t.tabs)}">${tabs.map(([k,n,c])=>`<button type="button" class="btn ghost cc-tab${tab===k?' active':''}" data-cc-action="tab" data-cc-tab="${k}" aria-pressed="${tab===k}">${esc(n)}${c===null?'':` · ${c}`}</button>`).join('')}</div>${inner}</div>`;
 }
 return `<section class="card cc-card" data-cc-root data-lang="${l}"><div class="cc-top"><div><h2 class="cc-title">${esc(t.title)}</h2><p class="cc-count">${esc(t.count(data.items.length,data.npcs.length))}</p></div><button type="button" class="btn ghost" data-cc-action="toggle" aria-expanded="${ui.open}"${ui.open?' aria-controls="cc-body"':''}>${esc(ui.open?t.close:t.open)}</button></div>${body}</section>`;
}
function download(raw,name){
 try{const blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob),a=global.document.createElement('a');a.href=url;a.download=name;global.document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return true}catch{return false}
}
// Returns 'none' (nothing to draw), 'self' (only this card changed) or 'all' (the catalog list changed too).
function act(a,b,lang){
 const t=T[L(lang)],ds=b?.dataset||{},kind=ds.ccKind==='npc'?'npc':'item',id=ds.ccId;
 if(a!=='del')ui.armed=null;
 switch(a){
  case 'toggle':ui.open=!ui.open;return 'self';
  case 'tab':ui.tab=['items','npcs','pack'].includes(ds.ccTab)?ds.ccTab:'items';ui.draft=null;ui.editing=null;ui.kind=null;ui.error='';return 'self';
  case 'new':ui.kind=kind;ui.editing=null;ui.error='';ui.draft=kind==='npc'?EMPTY_NPC():EMPTY_ITEM();return 'self';
  case 'cancel':ui.kind=null;ui.editing=null;ui.draft=null;ui.error='';return 'self';
  case 'edit':{const e=(kind==='npc'?data.npcs:data.items).find(x=>x.id===id);if(!e){notify(t.err.missing);return 'self'}ui.kind=kind;ui.editing=id;ui.error='';ui.draft=kind==='npc'?npcDraft(e):itemDraft(e);return 'self'}
  case 'calc':{const h=hpFromStats(ui.draft?.body,ui.draft?.will);if(h!==null&&ui.draft)ui.draft.hp=h;return 'self'}
  case 'save':{
   const d=ui.draft;if(!d)return 'self';
   let r;
   if(ui.kind==='npc'){
    const skills=parseSkills(d.skillsText),attacks=parseAttacks(d.attacksText),bad=[...attacks.bad,...skills.bad];
    if(bad.length){ui.error={key:'line',arg:bad[0]};return 'self'}
    r=saveNpc(data,{...d,id:ui.editing||undefined,skills:skills.list,attacks:attacks.list});
   }else r=saveItem(data,{...draftItem(d),id:ui.editing||undefined});
   if(!r.ok){ui.error={key:r.reason};return 'self'}
   if(!persist(r.data)){ui.error={key:'storage'};return 'self'}
   ui.kind=null;ui.editing=null;ui.draft=null;ui.error='';notify(t.saved);return 'all'}
  case 'del':{
   const key=kind+':'+id;if(ui.armed!==key){ui.armed=key;return 'self'}
   ui.armed=null;const r=remove(data,kind,id);if(!r.ok)return 'self';
   if(!persist(r.data)){notify(t.err.storage);return 'self'}
   if(ui.editing===id){ui.editing=null;ui.draft=null;ui.kind=null}
   notify(t.removed);return 'all'}
  case 'export':{
   if(!data.items.length&&!data.npcs.length)return 'none';
   download(JSON.stringify(buildPack(data,ui.packTitle),null,2),'night-city-content-pack-'+new Date().toISOString().slice(0,10)+'.json');return 'none'}
  case 'discard':ui.preview=null;ui.packError='';return 'self';
  case 'apply':{
   if(!ui.preview)return 'self';
   const r=applyImport(data,ui.preview);
   if(!persist(r.data)){ui.packError={key:'storage'};return 'self'}
   ui.preview=null;ui.packError='';notify(t.imported(r.added,r.updated));return 'all'}
  case 'unreadable-get':{let raw=null;try{raw=storage().getItem(UNREADABLE_KEY)}catch{}if(typeof raw==='string')download(raw,'night-city-custom-original.json');return 'none'}
  case 'unreadable-drop':try{storage().removeItem(UNREADABLE_KEY);unreadable=false}catch{}return 'self';
 }
 return 'none';
}
// A chosen file is only read and shown: nothing is stored until «Добавить в свои материалы» is pressed.
function openPack(text){
 const r=parsePack(text);
 if(!r.ok){ui.preview=null;ui.packError={bad:r.reason};return r}
 ui.preview={title:r.title,items:r.items,npcs:r.npcs,rejected:r.rejected};ui.packError='';
 return r;
}
function redraw(root,lang,how,focus){
 const doc=global.document;
 if(how==='all'){let done=false;try{if(global.App?.render){global.App.render();done=true}}catch{}if(!done)how='self'}
 if(how==='self'&&root&&typeof root.outerHTML==='string'&&root.isConnected!==false)root.outerHTML=render(lang);
 if(focus&&doc?.querySelector){try{doc.querySelector(focus)?.focus?.({preventScroll:how==='self'})}catch{}}
}
function focusFor(a,b){
 const ds=b?.dataset||{};
 if(a==='new'||a==='edit')return '[data-cc-root] [data-cc-form] input';
 if(a==='save'&&ui.draft)return '[data-cc-root] .cc-error';
 if(a==='save'||a==='cancel')return '[data-cc-root] [data-cc-action="new"]';
 if(a==='del')return ui.armed?`[data-cc-root] [data-cc-action="del"][data-cc-kind="${ds.ccKind==='npc'?'npc':'item'}"][data-cc-id="${String(ds.ccId||'').replace(/[^A-Za-z0-9_-]/g,'')}"]`:'[data-cc-root] [data-cc-action="new"]';
 if(a==='tab')return `[data-cc-root] [data-cc-tab="${['items','npcs','pack'].includes(ds.ccTab)?ds.ccTab:'items'}"]`;
 if(a==='apply'||a==='discard')return '[data-cc-root] .cc-file-input';
 if(a==='calc')return '[data-cc-root] [data-cc-action="calc"]';
 return '[data-cc-root] [data-cc-action="toggle"]';
}
function handle(e,lang){
 const target=e?.target,root=target?.closest?.('[data-cc-root]');
 if(!root||root.isConnected===false)return false;
 const l=L(lang||appLang()||root.dataset?.lang),ds=target.dataset||{};
 if(e.type==='input'||e.type==='change'){
  if(ds.ccFile!==undefined){
   if(e.type!=='change')return false;
   const file=target.files?.[0];if(!file)return false;
   const show=()=>{const now=global.document?.querySelector?.('[data-cc-root]')||root;redraw(now,L(appLang()||l),'self','[data-cc-root] [data-cc-action="apply"], [data-cc-root] .cc-error, [data-cc-root] [data-cc-action="discard"]')};
   if(Number(file.size)>MAX_FILE_CHARS*4){ui.preview=null;ui.packError={bad:'size'};show();return true}
   Promise.resolve().then(()=>file.text()).then(text=>{openPack(text);show()},()=>{ui.preview=null;ui.packError={bad:'json'};show()});
   return true;
  }
  if(ds.ccField==='packTitle'){ui.packTitle=line(target.value,MAX_TITLE);return true}
  if(ds.ccField&&ui.draft){
   ui.draft[ds.ccField]=target.type==='checkbox'?!!target.checked:target.value;
   // A message about the last attempt goes once the form is being corrected.
   if(ui.error){ui.error='';try{root.querySelector?.('.cc-error')?.remove?.()}catch{}}
   // Each category has its own fields: draw them as soon as the category changes.
   if(ds.ccField==='category'&&e.type==='change')redraw(root,l,'self','[data-cc-root] [data-cc-field="category"]');
   return true;
  }
  return false;
 }
 if(e.type!=='click')return false;
 const b=target.closest('[data-cc-action]');if(!b)return false;
 const a=b.dataset.ccAction,how=act(a,b,l);
 if(how==='none')return true;
 redraw(root,l,how,focusFor(a,b));
 return true;
}

load();syncCatalog(global.CATALOG,data.items);
if(global.document?.addEventListener)for(const type of ['click','change','input'])global.document.addEventListener(type,e=>{handle(e)});
// Another tab changed the collection: read it again so this tab does not write over it with older data.
global.addEventListener?.('storage',e=>{if(e&&e.key===KEY){load();syncCatalog(global.CATALOG,data.items);try{if(global.document?.querySelector?.('[data-cc-root]')&&!ui.draft)global.App?.render?.()}catch{}}});

global.CustomContent={KEY,FORMAT,PACK_FORMAT,VERSION,MAX_ITEMS,MAX_NPCS,MAX_FILE_CHARS,CATEGORIES,WEAPON_SKILLS,
 checkItem,cleanItem,checkNpc,cleanNpc,cleanData,toCatalogItem,toNpcEntry,syncCatalog,statLine,humanityAtCreation,hpFromStats,parseSkills,parseAttacks,
 buildPack,readPack,parsePack,planImport,applyImport,saveItem,saveNpc,remove,
 load,getData,npcEntries,backupPart,backupPlan,restoreFromBackup,render,handle,openPack,reset};
})(typeof window!=='undefined'?window:globalThis);
