/* A random handle or name, one tap away from the name field.

   Where. A small die button next to the name field in both character builders and in the three forms that create an NPC
   (a campaign opponent, the NPC library, «Свои материалы»). A page wraps its own name <label> in open() … close(kind, lang);
   everything else happens here. The button sits NEXT to the label, not inside it: a button inside a label would become part
   of the field's name for a screen reader.

   How the name gets stored. This file never talks to the page that owns the field. It writes input.value and sends the
   same 'input' event typing sends, so each page saves the name through the handler it already has, with its own length
   limit. Nothing new is stored, and nothing is sent anywhere.

   Undo. A tap replaces what was typed, so a second button brings the previous text back, step by step. The steps are kept
   in memory only, under the address of the page and the marks of the field, so they outlive the page being drawn again
   (the quick builder redraws on the very next choice). A field that comes back holding something else is a new form, and
   its old steps are dropped. Text typed over a generated name is never thrown away by the undo button: it goes one step
   down, and the next tap brings it back.

   Real people. A first name and a surname from these lists must not add up to a well-known living or historical person;
   tests/name-gen.test.cjs walks every pair against a list of such names.

   The words. Every list below was written for this app. No name, handle, corporation, gang or brand from the rulebook, from
   any other book, game or app may be added; tests/name-gen.test.cjs holds a list of such names and fails if one appears.
   Russian handles are single nouns, or a title and a noun: an adjective would have to agree with the noun in gender, and
   Russian surnames here are only those that read the same for a man and a woman.

   Chance. generate() takes the random source as an argument (rng, a function returning 0..1), so tests can script it.
   The order of draws is fixed:
     handle, ru:  shape, then word            (shape < 0.75)   or  shape, title, word
     handle, en:  shape, then word            (shape < 0.5)    or  shape, adjective, word (shape < 0.85)  or  shape, title, word
     npc:         kind, then first, last      (kind < 0.67)    or  kind, then the draws of a handle
   When the result is what the field already holds, the whole run is drawn again, at most eight times. */
(function(global){
'use strict';
const LISTS={
 ru:{
  first:['Алексей','Борис','Глеб','Данила','Егор','Захар','Игнат','Кирилл','Лев','Макар','Назар','Остап','Платон','Роман','Савва','Тимур','Фёдор','Юлиан','Ян','Арсений','Марк','Олег','Рустам','Демид','Эльдар','Алиса','Варвара','Вера','Дарья','Ева','Жанна','Зоя','Инга','Кира','Лада','Майя','Нина','Ольга','Софья','Тамара','Ульяна','Яна','Ася','Лейла','Мира','Злата','Регина','Агата','Стефания','Эмма'],
  last:['Бондаренко','Савченко','Ткаченко','Лысенко','Гриценко','Остапенко','Юрченко','Дорошенко','Кузьменко','Шевчук','Марчук','Полищук','Гайдук','Мельничук','Савчук','Стельмах','Дрозд','Жук','Коваль','Байда','Саркисян','Петросян','Григорян','Геворкян','Климович','Богданович','Станкевич','Юркевич','Синкевич','Бергер','Штольц','Вайс','Кляйн','Вебер','Фогель','Майер','Ли','Ким','Пак','Цой','Чен','Тран','Сато','Ямада','Окафор','Диалло','Коста','Мендоса','Ортис','Варга','Новак','Кравец','Шаповал','Бурлака','Чумак','Гончар','Бондарь','Кушнир','Швец','Рудь'],
  handle:['Гвоздь','Шов','Искра','Фитиль','Зуммер','Клин','Жесть','Окурок','Сквозняк','Шестерня','Пломба','Копоть','Изолента','Рубильник','Заклёпка','Нихром','Вольфрам','Кварц','Гранит','Графит','Статика','Помеха','Шум','Эхо','Блик','Сполох','Зарница','Аргон','Ксенон','Фосфор','Кобальт','Ртуть','Свинец','Олово','Латунь','Кремень','Сажа','Пепел','Уголь','Смог','Туман','Иней','Град','Ливень','Шквал','Сирена','Гудок','Свисток','Трещотка','Молоток','Штопор','Шило','Стамеска','Напильник','Отвёртка','Кусачки','Домкрат','Лебёдка','Поршень','Клапан','Глушитель','Тормоз','Стартер','Дизель','Форсаж','Занос','Вираж','Кювет','Шлагбаум','Светофор','Тупик','Подвал','Чердак','Флюгер','Маятник','Метроном','Камертон','Аккорд','Бемоль','Фейдер','Сэмпл','Пиксель','Курсор','Байт','Патч','Кэш','Лаг','Буфер','Шифр','Отмычка','Скрепка','Кнопка','Булавка','Напёрсток','Лоскут','Заплатка','Грач','Сорока','Стриж','Щука','Ёрш','Рысь','Хорёк','Барсук','Шакал','Мангуст','Шершень','Овод','Сверчок','Скарабей','Полынь','Репей','Чертополох','Крапива','Шиповник','Белена'],
  prefix:['Док','Кэп','Шеф','Босс','Мастер','Сержант','Профессор','Майор','Папаша','Мамаша','Дядя','Тётя','Брат','Сестра','Мистер','Мадам','Инженер','Тренер'],
 },
 en:{
  first:['Ada','Bram','Cass','Dara','Elio','Faye','Gus','Hana','Idris','June','Kofi','Lena','Milo','Nadia','Omar','Petra','Quinn','Rosa','Sami','Tess','Uma','Vince','Wren','Xavi','Yara','Zeke','Amara','Boris','Carmen','Dmitri','Esme','Felix','Greta','Hugo','Ines','Jonah','Kira','Luca','Marta','Nico','Opal','Pavel','Remy','Selma','Tobias','Vera','Wade','Zora','Anouk','Leif'],
  last:['Abara','Benitez','Calloway','Dvorak','Esposito','Farrow','Galvez','Hartmann','Ibarra','Jurisic','Kowalczyk','Lindqvist','Marchetti','Nakagawa','Okonkwo','Petrakis','Quintero','Rasmussen','Sokolov','Thackeray','Udoka','Vasquez','Whitlock','Yilmaz','Zielinski','Achebe','Brandt','Castellan','Dunmore','Eklund','Fontaine','Grieve','Halloran','Imani','Jurado','Kessler','Lachance','Moreau','Novak','Osei','Pryce','Rahimi','Strand','Tolliver','Varga','Winslow','Yeo','Zamora','Abiodun','Marlowe'],
  handle:['Rivet','Solder','Gasket','Sprocket','Fuse','Breaker','Static','Flicker','Gutter','Cinder','Soot','Ember','Smog','Drizzle','Squall','Sleet','Hail','Klaxon','Buzzer','Whistle','Rattle','Mallet','Awl','Chisel','Rasp','Pliers','Winch','Piston','Valve','Muffler','Choke','Diesel','Skid','Swerve','Ditch','Tollgate','Culvert','Cellar','Attic','Vane','Pendulum','Metronome','Chord','Fader','Sample','Pixel','Cursor','Byte','Patch','Cache','Lag','Buffer','Cipher','Latch','Lockpick','Staple','Thimble','Needle','Scrap','Rook','Magpie','Swift','Pike','Lynx','Ferret','Badger','Jackal','Mongoose','Hornet','Gadfly','Cricket','Weevil','Scarab','Wormwood','Burdock','Thistle','Nettle','Briar','Henbane','Flint','Graphite','Quartz','Cobalt','Tungsten','Nichrome','Argon','Xenon','Phosphor','Tin','Brass','Dross','Slag','Tinder','Kindling','Gantry','Trestle','Bollard','Kerbstone','Lintel','Mortar','Grout'],
  prefix:['Doc','Cap','Chief','Boss','Uncle','Auntie','Mama','Papa','Sarge','Professor','Major','Mister','Madam','Coach','Brother','Sister','Deacon','Granny'],
  adj:['Rusty','Quiet','Crooked','Lucky','Hollow','Brittle','Sour','Bitter','Dusty','Gilded','Tarnished','Patient','Restless','Sleepless','Borrowed','Secondhand','Leftover','Lopsided','Threadbare','Frayed','Dented','Scuffed','Soggy','Brisk','Wary','Gaunt','Nimble','Sly','Blunt','Stray','Faint','Idle','Thrifty','Little','Old','Two-Bit'],
 },
};
// The longest name any field gets from here. Every field that has a button allows at least this much.
const MAX=60,STEPS=20,RETRIES=8;
const T={
 ru:{handle:'Случайный позывной',npc:'Случайное имя',undo:'Вернуть прежний текст',said:n=>`Подставлено: ${n}`,back:n=>n?`Возвращено: ${n}`:'Поле очищено'},
 en:{handle:'Random handle',npc:'Random name',undo:'Bring back the previous text',said:n=>`Filled in: ${n}`,back:n=>n?`Restored: ${n}`:'Field cleared'},
};
const L=lang=>lang==='en'?'en':'ru';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// A source that returns 1, a negative number or nonsense still picks an entry of the list.
function pick(list,rng){
 let r;try{r=Number(rng())}catch{r=0}
 return list[Number.isFinite(r)?Math.min(list.length-1,Math.max(0,Math.floor(r*list.length))):0];
}
const draw=rng=>{let r;try{r=Number(rng())}catch{r=0}return Number.isFinite(r)?r:0};
function handleName(lang,rng=Math.random){
 const l=L(lang),W=LISTS[l],shape=draw(rng);
 if(l==='ru')return shape<0.75?pick(W.handle,rng):`${pick(W.prefix,rng)} ${pick(W.handle,rng)}`;
 if(shape<0.5)return pick(W.handle,rng);
 return shape<0.85?`${pick(W.adj,rng)} ${pick(W.handle,rng)}`:`${pick(W.prefix,rng)} ${pick(W.handle,rng)}`;
}
function personName(lang,rng=Math.random){const W=LISTS[L(lang)];return `${pick(W.first,rng)} ${pick(W.last,rng)}`}
const once=(kind,lang,rng)=>kind==='npc'?(draw(rng)<0.67?personName(lang,rng):handleName(lang,rng)):handleName(lang,rng);
function generate({kind='handle',lang,rng=Math.random,avoid='',max=MAX}={}){
 const source=typeof rng==='function'?rng:Math.random,n=Math.floor(Number(max)),limit=Number.isFinite(n)&&n>=1?Math.min(n,MAX):MAX,was=String(avoid??'').trim();
 let name='';
 for(let i=0;i<=RETRIES;i++){name=once(kind,lang,source).slice(0,limit).trim();if(name!==was)break}
 return name;
}

/* ---------- Markup ---------- */
const open=()=>'<div class="ng-slot">';
function close(kind,lang){
 const l=L(lang||global.App?.lang?.()),k=kind==='npc'?'npc':'handle',t=T[l];
 return `<button type="button" class="btn ghost ng-btn" data-ng="${k}" data-ng-lang="${l}" aria-label="${esc(t[k])}" title="${esc(t[k])}">${global.Icons?.dice||'<span aria-hidden="true">⚄</span>'}</button><button type="button" class="btn ghost ng-btn ng-undo" data-ng-undo data-ng-lang="${l}" aria-label="${esc(t.undo)}" title="${esc(t.undo)}" hidden><span aria-hidden="true">↶</span></button><span class="sr-only" role="status" data-ng-said></span></div>`;
}

/* ---------- The tap ---------- */
/* The steps back of one field: what it held before each tap (newest last), what this file last put into it, and what it
   was last seen holding. Kept twice: by the input itself, and by a key that stays the same when the page is drawn again
   and the input is replaced by a new one. */
const byInput=new WeakMap(),fields=new Map(),KEEP=12;
const same=(a,b)=>String(a??'').trim()===String(b??'').trim();
function keyOf(input){
 let marks='';try{marks=JSON.stringify(Object.entries(input.dataset||{}))}catch{}
 return `${String(global.location?.hash||'').split('?')[0]}|${input.id||''}|${input.name||''}|${marks}`;
}
// The steps of this field, if it has any: its own, or those left by the input it replaced. The second kind count only
// while the field still holds what the old one held; anything else means another form was opened under the same address.
function known(input){
 let f=byInput.get(input);if(f)return f;
 const key=keyOf(input);f=fields.get(key);if(!f)return null;
 if(!f.stack.length||!same(input.value,f.cur)){fields.delete(key);return null}
 byInput.set(input,f);return f;
}
// After the page is drawn again the undo button comes out hidden, as close() writes it: show it where there are steps.
function sync(){
 if(!fields.size)return;
 let slots=[];try{slots=global.document?.querySelectorAll?.('.ng-slot')||[]}catch{}
 for(const slot of slots){
  const input=slot.querySelector?.('input'),undo=slot.querySelector?.('[data-ng-undo]');
  if(input&&undo&&!byInput.has(input)&&known(input))undo.hidden=false;
 }
}
// The page that owns the field stores the name on the same event typing sends.
function fire(input){try{input.dispatchEvent(new global.Event('input',{bubbles:true}))}catch{}}
function handle(e,rng){
 if(e?.type!=='click')return false;
 const btn=e.target?.closest?.('[data-ng],[data-ng-undo]'),slot=btn?.closest?.('.ng-slot'),input=slot?.querySelector?.('input');
 if(!btn||!slot||!input)return false;
 if(input.disabled||input.readOnly)return true;
 const t=T[L(btn.dataset?.ngLang)],said=slot.querySelector('[data-ng-said]'),undo=slot.querySelector('[data-ng-undo]'),key=keyOf(input);
 let f=known(input);
 if(btn.dataset?.ngUndo!==undefined){
  if(!f||!f.stack.length){if(undo)undo.hidden=true;return true}
  const now=String(input.value??''),back=f.stack.pop();
  // The player has typed since the last tap: that text would be gone for good, so it becomes the next step back.
  if(now.trim()&&!same(now,f.wrote)&&!same(now,back))f.stack.push(now);
  f.wrote=f.cur=back;
  if(!f.stack.length)fields.delete(key);
  input.value=back;fire(input);
  // A hidden button cannot keep the focus: hand it to the die first, or the keyboard user is thrown to the top of the page.
  if(!f.stack.length){slot.querySelector('[data-ng]')?.focus?.();if(undo)undo.hidden=true}
  if(said)said.textContent=t.back(String(input.value));
  return true;
 }
 const prev=String(input.value??''),name=generate({kind:btn.dataset?.ng,lang:btn.dataset?.ngLang,rng:rng||api.rng||Math.random,avoid:prev,max:input.maxLength>0?input.maxLength:MAX});
 if(!f)byInput.set(input,f={stack:[],wrote:'',cur:''});
 f.stack.push(prev);if(f.stack.length>STEPS)f.stack.shift();
 // Everything is written down before the page hears about it: the page may draw itself again right inside the event.
 f.wrote=f.cur=name;
 fields.delete(key);fields.set(key,f);
 if(fields.size>KEEP)fields.delete(fields.keys().next().value);
 input.value=name;fire(input);
 if(undo)undo.hidden=false;
 if(said)said.textContent=t.said(name);
 return true;
}
// Typing in a field that has steps: remember what it holds now, so the steps are found again after the page is redrawn.
function typed(e){const input=e?.target,f=input&&byInput.get(input);if(f)f.cur=String(input.value??'')}
// rng: tests and the browser check may put their own source here; null means Math.random.
const api={LISTS,T,MAX,pick,handleName,personName,generate,open,close,handle,sync,typed,rng:null};
global.NameGen=api;
if(global.document?.addEventListener){
 global.document.addEventListener('click',e=>{handle(e)});
 global.document.addEventListener('input',typed);
 // Pages draw themselves by replacing their markup; this runs before the new markup is painted, so nothing flickers.
 try{if(global.MutationObserver&&global.document.documentElement)new global.MutationObserver(sync).observe(global.document.documentElement,{childList:true,subtree:true})}catch{}
}
})(window);
