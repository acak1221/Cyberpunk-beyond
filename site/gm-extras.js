/* GM extras: progress clocks (saved in state.gmExtras.clocks), random tables (names & handles,
   gigs, loot, yes/no oracle) and Night City weather. All table text here is original fan content
   written for this app; it does not reproduce the corebook or any official tables. The three book
   tables live in book-tables.js and are marked with their pages. Loot draws real items from the app
   catalog (window.CATALOG). Recent table and weather results are kept on this device, so session
   prep survives a reload, and any result can be written into a campaign journal. */
(function(){
'use strict';
const SIZES=Object.freeze([4,6,8,10,12]);
const MAX_CLOCKS=30,MAX_NAME=60,MAX_SHARED=12,LOG_SIZE=6;

// ---------- clocks ----------
function cleanName(v){return typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,MAX_NAME):''}
function cleanClock(c){
 if(!c||typeof c!=='object'||Array.isArray(c))return null;
 const size=Number(c.size);if(!SIZES.includes(size))return null;
 const id=typeof c.id==='string'&&/^[A-Za-z0-9_-]{1,40}$/.test(c.id)?c.id:null;if(!id)return null;
 const f=Number(c.filled),filled=Number.isFinite(f)?Math.min(size,Math.max(0,Math.trunc(f))):0;
 return {id,name:cleanName(c.name),size,filled,shared:c.shared===true};
}
function readClocks(state){
 const raw=state&&state.gmExtras&&typeof state.gmExtras==='object'&&!Array.isArray(state.gmExtras)?state.gmExtras.clocks:null;
 if(!Array.isArray(raw))return [];
 const out=[],seen=new Set();
 for(const c of raw){const x=cleanClock(c);if(x&&!seen.has(x.id)){seen.add(x.id);out.push(x)}if(out.length>=MAX_CLOCKS)break}
 return out;
}
function writeClocks(state,clocks){
 if(!state||typeof state!=='object')return false;
 if(!state.gmExtras||typeof state.gmExtras!=='object'||Array.isArray(state.gmExtras))state.gmExtras={};
 state.gmExtras.clocks=clocks.slice(0,MAX_CLOCKS).map(cleanClock).filter(Boolean);
 return true;
}
function sharedClocks(state){return readClocks(state).filter(c=>c.shared).slice(0,MAX_SHARED).map(c=>({name:c.name,size:c.size,filled:c.filled}))}
let idSeq=0;
function newId(){return 'clk-'+Date.now().toString(36)+'-'+(idSeq++).toString(36)+Math.floor(Math.random()*1296).toString(36)}
// Pure clock operations on a sanitized list; each returns {clocks, ok}.
function addClock(list,name,size,id=newId()){
 if(list.length>=MAX_CLOCKS)return {clocks:list,ok:false};
 const s=SIZES.includes(Number(size))?Number(size):6;
 return {clocks:[...list,{id,name:cleanName(name),size:s,filled:0,shared:false}],ok:true};
}
function updateClock(list,id,fn){let ok=false;const clocks=list.map(c=>{if(c.id!==id)return c;ok=true;return cleanClock(fn({...c}))||c});return {clocks,ok}}
function clickSegment(c,index){const i=Math.trunc(Number(index));if(!(i>=0&&i<c.size))return c;c.filled=c.filled===i+1?i:i+1;return c}
function step(c,delta){c.filled=Math.min(c.size,Math.max(0,c.filled+delta));return c}

// ---------- shared helpers ----------
function die(sides,rng){const n=1+Math.floor(rng()*sides);return n>=1&&n<=sides?n:1}
function pick(arr,rng){return arr[Math.min(arr.length-1,Math.max(0,Math.floor(rng()*arr.length)))]}
function pickDistinct(arr,n,rng){const a=arr.slice(),out=[];n=Math.min(n,a.length);while(out.length<n)out.push(a.splice(Math.min(a.length-1,Math.floor(rng()*a.length)),1)[0]);return out}
const L=(p,l)=>p&&typeof p==='object'?(p[l]??p.en??''):String(p??'');

// ---------- names & handles (original lists) ----------
const FIRST=[
 ['Мигель','Miguel'],['Аико','Aiko'],['Дмитрий','Dmitri'],['Амара','Amara'],['Чен','Chen'],['Фатима','Fatima'],['Кофи','Kofi'],['Ингрид','Ingrid'],
 ['Рафаэль','Rafael'],['Ли На','Li Na'],['Джамал','Jamal'],['Соня','Sonya'],['Тэян','Taeyang'],['Прия','Priya'],['Хавьер','Javier'],['Нгози','Ngozi'],
 ['Мэйв','Maeve'],['Арджун','Arjun'],['Лейла','Leila'],['Томас','Tomás'],['Юки','Yuki'],['Оскар','Oskar'],['Зейнеп','Zeynep'],['Делрой','Delroy'],
 ['Ксиомара','Xiomara'],['Бао','Bao'],['Ирина','Irina'],['Маркус','Marcus'],['Ханна','Hanna'],['Кеоны','Keoni'],['Ана','Ana'],['Саид','Said'],
 ['Рокси','Roxie'],['Виктор','Viktor'],['Ифе','Ife'],['Лука','Luca'],['Мира','Mira'],['Хоакин','Joaquín'],['Сун','Sun'],['Дэш','Dash']
];
const LAST=[
 ['Окафор','Okafor'],['Ямада','Yamada'],['Гарсия-Рейес','García-Reyes'],['Новак','Novak'],['Чжао','Zhao'],['Мендоса','Mendoza'],['Ковальчук','Kovalchuk'],['Бхатт','Bhatt'],
 ['О’Ши','O’Shea'],['Хаддад','Haddad'],['Ким','Kim'],['Сантос','Santos'],['Линдквист','Lindqvist'],['Асанте','Asante'],['Морено','Moreno'],['Петров','Petrov'],
 ['Нгуен','Nguyen'],['Фэрроу','Farrow'],['Кастильо','Castillo'],['Шульц','Schulz'],['Таналеа','Tanalea'],['Абара','Abara'],['Вэй','Wei'],['Дюбуа','Dubois'],
 ['Рамирес','Ramírez'],['Сато','Sato'],['Брукс','Brooks'],['Илиеску','Iliescu'],['Мбеки','Mbeki'],['Фортунато','Fortunato'],['Квон','Kwon'],['Эрнандес','Hernández']
];
const HANDLES=[
 ['Ржавчина','Rust'],['Скальпель','Scalpel'],['Сорока','Magpie'],['Гудок','Klaxon'],['Ноль','Zero'],['Шёпот','Whisper'],['Предохранитель','Fuse'],['Пепел','Ash'],
 ['Чётки','Rosary'],['Неон','Neon'],['Монтировка','Crowbar'],['Карась','Carp'],['Глитч','Glitch'],['Вдова','Widow'],['Сухарь','Rusk'],['Шрапнель','Shrapnel'],
 ['Мотылёк','Moth'],['Бетон','Concrete'],['Кость','Bone'],['Сквозняк','Draft'],['Жестянка','Tin Can'],['Фантик','Wrapper'],['Халява','Freebie'],['Полночь','Midnight'],
 ['Хромка','Chromie'],['Дворник','Wiper'],['Паяльник','Solder'],['Ворон','Raven'],['Сажа','Soot'],['Курок','Trigger'],['Банши','Banshee'],['Мелочь','Small Change'],
 ['Помеха','Static'],['Лимонад','Lemonade'],['Тормоз','Brakes'],['Анекдот','Punchline'],['Кислота','Acid'],['Гвоздь','Nail'],['Таблетка','Pill'],['Светофор','Stoplight']
];
function genName(rng=Math.random,withHandle){const f=pick(FIRST,rng),s=pick(LAST,rng),h=withHandle===undefined?rng()<0.4:withHandle;return {first:f,last:s,handle:h?pick(HANDLES,rng):null}}
function formatName(n,l){const i=l==='en'?1:0,[o,c]=l==='en'?['“','”']:['«','»'];return n.handle?`${n.first[i]} ${o}${n.handle[i]}${c} ${n.last[i]}`:`${n.first[i]} ${n.last[i]}`}

// ---------- gigs (original) ----------
const CLIENTS=[
 {ru:'нервный менеджер среднего звена из корпорации',en:'a nervous corporate middle manager'},
 {ru:'старейшина кочевой семьи',en:'an elder of a nomad family'},
 {ru:'рипердок, которому задолжали',en:'a ripperdoc who is owed money'},
 {ru:'лейтенант уличной банды',en:'a street gang lieutenant'},
 {ru:'встревоженная мать',en:'a worried mother'},
 {ru:'медиа, охотящаяся за сюжетом',en:'a media chasing a story'},
 {ru:'коп, работающий «без протокола»',en:'a cop working off the books'},
 {ru:'владелец ночного клуба',en:'a nightclub owner'},
 {ru:'анонимный заказчик через три посредника',en:'an anonymous client behind three middlemen'},
 {ru:'бывший соло, ушедший на покой',en:'a retired solo'},
 {ru:'местный проповедник',en:'a neighborhood preacher'},
 {ru:'нетраннер-конкурент',en:'a rival netrunner'}
];
const JOBS=[
 {ru:'вытащить человека и доставить живым',en:'extract a person and deliver them alive',tier:3},
 {ru:'доставить запечатанный кейс, не открывая',en:'courier a sealed case without opening it',tier:1},
 {ru:'выкрасть данные с изолированного терминала',en:'lift data from an air-gapped terminal',tier:3},
 {ru:'охранять встречу двух сторон',en:'guard a meeting between two parties',tier:2},
 {ru:'тихо испортить оборудование',en:'quietly sabotage some equipment',tier:2},
 {ru:'найти пропавшего',en:'find a missing person',tier:1},
 {ru:'угнать машину с особым грузом',en:'steal a vehicle with special cargo',tier:2},
 {ru:'подбросить улики',en:'plant evidence',tier:2},
 {ru:'вернуть украденную вещь',en:'recover a stolen item',tier:1},
 {ru:'сопроводить караван через опасный район',en:'escort a convoy through a bad district',tier:3},
 {ru:'припугнуть, но никого не убивать',en:'scare someone off without killing anyone',tier:1},
 {ru:'сорвать сделку конкурентов',en:'break up a rival deal',tier:4}
];
const PLACES=[
 {ru:'в заброшенной станции метро',en:'in an abandoned metro station'},
 {ru:'на плавучем клубе в порту',en:'on a floating club in the harbor'},
 {ru:'в подпольной клинике над прачечной',en:'in an underground clinic above a laundromat'},
 {ru:'в недостроенной башне на 40-м этаже',en:'on the 40th floor of an unfinished tower'},
 {ru:'на ночном рынке под эстакадой',en:'at a night market under an overpass'},
 {ru:'в мотеле у шоссе на краю пустошей',en:'in a highway motel on the edge of the badlands'},
 {ru:'на складе с «просроченной» гуманитаркой',en:'in a warehouse full of "expired" relief supplies'},
 {ru:'в пентхаусе с собственной охраной',en:'in a penthouse with private security'},
 {ru:'на свалке дронов',en:'in a drone scrapyard'},
 {ru:'в капсульном отеле',en:'in a capsule hotel'},
 {ru:'в храме, превращённом в бар',en:'in a church turned into a bar'},
 {ru:'на крыше парковки во время рейва',en:'on a parking-garage roof during a rave'}
];
const COMPLICATIONS=[
 {ru:'цель — чей-то родственник, и об этом узнают',en:'the target is somebody’s relative, and word gets out'},
 {ru:'другая команда получила тот же заказ',en:'another crew got the same job'},
 {ru:'заказчик врёт о том, что внутри',en:'the client is lying about what is inside'},
 {ru:'всё нужно сделать до рассвета',en:'it all has to be done before dawn'},
 {ru:'в районе облава, копы на каждом углу',en:'there is a police sweep, cops on every corner'},
 {ru:'рядом бродит киберпсих',en:'a cyberpsycho is loose nearby'},
 {ru:'аванс оказался фальшивыми эдди',en:'the advance turns out to be fake eddies'},
 {ru:'медиа ведёт прямой эфир с места',en:'a media is streaming live from the scene'},
 {ru:'свидетель узнаёт одного из команды',en:'a witness recognizes one of the crew'},
 {ru:'всё прошло гладко… слишком гладко',en:'it went smoothly… too smoothly'},
 {ru:'цель предлагает заплатить вдвое больше',en:'the target offers to pay double'},
 {ru:'нет осложнений — пока',en:'no complication — yet'}
];
const PAY=[
 {min:100,max:300},{min:300,max:800},{min:800,max:2000},{min:2000,max:5000},{min:5000,max:10000}
];
function genGig(rng=Math.random){
 const job=pick(JOBS,rng),shift=die(6,rng),tier=Math.min(PAY.length-1,Math.max(0,job.tier+(shift===1?-1:shift===6?1:0)));
 return {client:pick(CLIENTS,rng),job,place:pick(PLACES,rng),complication:pick(COMPLICATIONS,rng),pay:PAY[tier]};
}

// ---------- loot ----------
const FLAVOR=[
 {ru:'пачка чужих кредитных чипов (половина заблокирована)',en:'a stack of someone else’s credchips (half are blocked)'},
 {ru:'полупустая бутылка синтетического бурбона',en:'a half-empty bottle of synthetic bourbon'},
 {ru:'фото семьи, распечатанное на бумаге',en:'a family photo printed on actual paper'},
 {ru:'ключ-карта от неизвестного номера в капсульном отеле',en:'a keycard to an unknown capsule-hotel room'},
 {ru:'жетон фанклуба рок-группы, которой уже нет',en:'a fan-club token for a band that no longer exists'},
 {ru:'шприц-ручка без маркировки',en:'an unmarked injector pen'},
 {ru:'список имён, три из которых вычеркнуты',en:'a list of names, three crossed out'},
 {ru:'пакет соевых чипсов «Острый неон»',en:'a bag of "Hot Neon" soy chips'},
 {ru:'сломанный дрон размером с ладонь',en:'a broken palm-sized drone'},
 {ru:'квитанция из ломбарда на чужое имя',en:'a pawn-shop ticket under another name'},
 {ru:'игральные кости из пластика, одна утяжелена',en:'plastic dice, one of them loaded'},
 {ru:'визитка фиксера с номером, нацарапанным от руки',en:'a fixer’s card with a hand-scratched number'},
 {ru:'чип с недописанным брейнденсом',en:'a chip with an unfinished braindance'},
 {ru:'пропуск на завод, срок истёк вчера',en:'a factory pass that expired yesterday'},
 {ru:'жвачка, в которую завёрнут крошечный жучок',en:'gum wrapped around a tiny bug'},
 {ru:'талон на бесплатную лапшу',en:'a voucher for free noodles'}
];
const LOOT_CATEGORIES=['weapon','ammo','gear','drugs','cyberware','fashion','attachment'];
const LOOT_MODES=Object.freeze({pockets:{cap:100,items:[1,2],flavor:[1,2],cash:[1,10]},stash:{cap:1000,items:[2,4],flavor:[1,3],cash:[10,50]}});
function lootPool(cap,catalog){const list=Array.isArray(catalog)?catalog:(typeof window!=='undefined'&&Array.isArray(window.CATALOG)?window.CATALOG:[]);return list.filter(i=>i&&LOOT_CATEGORIES.includes(i.category)&&typeof i.price==='number'&&i.price>0&&i.price<=cap&&i.name)}
function between(r,rng){return r[0]+Math.floor(rng()*(r[1]-r[0]+1))}
function genLoot(mode='pockets',rng=Math.random,catalog){
 const m=LOOT_MODES[mode]||LOOT_MODES.pockets,key=LOOT_MODES[mode]?mode:'pockets';
 const items=pickDistinct(lootPool(m.cap,catalog),between(m.items,rng),rng);
 return {mode:key,items:items.map(i=>({id:i.id,name:i.name,price:i.price,page:i.page})),flavor:pickDistinct(FLAVOR,between(m.flavor,rng),rng),cash:between(m.cash,rng)*10};
}

// ---------- yes/no oracle (original) ----------
// Roll 1d10; "yes" when the die is at least the threshold. Extremes add "and", the edge result adds "but".
const LIKELIHOOD=Object.freeze([
 {id:'vu',min:9,ru:'Очень маловероятно',en:'Very unlikely'},
 {id:'u',min:8,ru:'Маловероятно',en:'Unlikely'},
 {id:'even',min:6,ru:'50 на 50',en:'50/50'},
 {id:'l',min:4,ru:'Вероятно',en:'Likely'},
 {id:'vl',min:3,ru:'Очень вероятно',en:'Very likely'},
 {id:'sure',min:2,ru:'Почти наверняка',en:'Almost certain'}
]);
const ANSWERS={yesand:{ru:'Да, и…',en:'Yes, and…'},yes:{ru:'Да',en:'Yes'},yesbut:{ru:'Да, но…',en:'Yes, but…'},nobut:{ru:'Нет, но…',en:'No, but…'},no:{ru:'Нет',en:'No'},noand:{ru:'Нет, и…',en:'No, and…'}};
function oracleAnswer(roll,likelihood){
 const lv=LIKELIHOOD.find(x=>x.id===likelihood)||LIKELIHOOD[2];
 if(roll>=lv.min)return roll===10?'yesand':roll===lv.min?'yesbut':'yes';
 return roll===1?'noand':roll===lv.min-1?'nobut':'no';
}
function oracle(likelihood,rng=Math.random){const lv=LIKELIHOOD.find(x=>x.id===likelihood)||LIKELIHOOD[2],roll=die(10,rng);return {likelihood:lv.id,roll,answer:oracleAnswer(roll,lv.id)}}

// ---------- weather (original) ----------
const SEASONS=Object.freeze([
 {id:'winter',ru:'Зима',en:'Winter',temp:[6,15]},
 {id:'spring',ru:'Весна',en:'Spring',temp:[11,22]},
 {id:'summer',ru:'Лето',en:'Summer',temp:[19,32]},
 {id:'autumn',ru:'Осень',en:'Autumn',temp:[13,26]}
]);
const WEATHER={
 clear:{ru:'Ясно и душно',en:'Clear and muggy',shift:[1,2],hint:{ru:'Никаких поправок. Хороший повод для сцены на крыше.',en:'No adjustments. A good excuse for a rooftop scene.'}},
 smog:{ru:'Густой смог',en:'Thick smog',shift:[0,1],hint:{ru:'Можно считать дальние цели хуже различимыми — например, −1 к Perception за пределами квартала.',en:'Consider far targets harder to make out — e.g. −1 to Perception beyond a block.'}},
 acid:{ru:'Кислотная морось',en:'Acid drizzle',shift:[-2,-1],hint:{ru:'Улицы пустеют; незащищённая одежда портится к утру. Хорошо прятаться под навесами.',en:'Streets empty out; unprotected clothes are ruined by morning. Good cover under awnings.'}},
 storm:{ru:'Ливень с грозой',en:'Thunderstorm downpour',shift:[-4,-2],hint:{ru:'Шум дождя глушит шаги — можно дать небольшой бонус к скрытности и штраф к слуху.',en:'Rain noise covers footsteps — consider a small Stealth bonus and a hearing penalty.'}},
 fog:{ru:'Неоновый туман',en:'Neon fog',shift:[-2,0],hint:{ru:'Вывески светятся в тумане ореолами; видимость — пара десятков метров. Стрельба на дальних дистанциях под вопросом.',en:'Signs glow as halos in the fog; visibility is a couple dozen meters. Long-range shots are questionable.'}},
 wind:{ru:'Ветер с залива',en:'Wind off the bay',shift:[-3,-1],hint:{ru:'Дроны сносит, мусор летит по улицам. Можно усложнить пилотирование лёгких аппаратов.',en:'Drones drift, trash flies down the streets. Consider making light aircraft harder to fly.'}},
 heat:{ru:'Жара',en:'Heat wave',shift:[4,7],hint:{ru:'Кондиционеры перегружают сеть — местами отключения. Долгая беготня утомляет быстрее.',en:'AC units overload the grid — rolling blackouts. Long chases wear people out faster.'}},
 dust:{ru:'Пыль с пустошей',en:'Dust from the badlands',shift:[1,3],hint:{ru:'Оптика и фильтры забиваются; кибероглазам без защиты может понадобиться чистка.',en:'Optics and filters clog; unshielded cybereyes may need cleaning.'}},
 cold:{ru:'Холодная ясная ночь',en:'Cold clear night',shift:[-6,-3],hint:{ru:'Бездомные жгут бочки; тепловизоры видят всё особенно чётко.',en:'The homeless light barrel fires; thermal sights see everything extra clearly.'}},
 blackout:{ru:'Гроза с отключениями',en:'Storm with blackouts',shift:[-3,-1],hint:{ru:'Целые кварталы без света: камеры и замки могут не работать. Отличная ночь для взлома.',en:'Whole blocks go dark: cameras and locks may be offline. A great night for a break-in.'}},
 rain:{ru:'Тёплый дождь',en:'Warm rain',shift:[-1,0],hint:{ru:'Неон отражается в лужах. Особых поправок нет.',en:'Neon reflects in puddles. No special adjustments.'}}
};
// 1d10 per season.
const SEASON_TABLE={
 winter:['cold','cold','rain','rain','storm','fog','fog','acid','wind','blackout'],
 spring:['clear','rain','rain','fog','acid','smog','wind','storm','dust','blackout'],
 summer:['clear','clear','heat','heat','smog','smog','dust','fog','acid','blackout'],
 autumn:['clear','smog','fog','fog','wind','wind','acid','rain','dust','heat']
};
function seasonFor(date=new Date()){const m=date instanceof Date&&!isNaN(date)?date.getMonth():0;return m===11||m<=1?'winter':m<=4?'spring':m<=7?'summer':'autumn'}
function genWeather(season,rng=Math.random,date){
 const sid=SEASONS.some(s=>s.id===season)?season:seasonFor(date);const s=SEASONS.find(x=>x.id===sid);
 const roll=die(10,rng),cid=SEASON_TABLE[sid][roll-1],c=WEATHER[cid];
 const lo=s.temp[0]+c.shift[0],hi=s.temp[1]+c.shift[1];
 return {season:sid,roll,condition:cid,temp:[Math.min(lo,hi-3),hi]};
}

// ---------- UI text ----------
const T={
 ru:{group:'ИНСТРУМЕНТЫ ВЕДУЩЕГО',clocks:'ЧАСЫ ПРОГРЕССА',clocksSub:'СОХРАНЯЮТСЯ',clocksIntro:'Отмечайте угрозы, погони и долгие планы: сегменты заполняются по ходу игры. Щёлкните сегмент, чтобы заполнить часы до него (повторный щелчок снимает его).',newName:'Название',newPlaceholder:'Напр. «Банда идёт по следу»',segments:'Сегментов',create:'Создать часы',none:'Часов пока нет.',limit:'Достигнут предел — 30 часов.',shared:'Показывать игрокам',reset:'Сбросить',del:'Удалить',confirm:'Точно удалить?',minus:'Убрать сегмент',plus:'Добавить сегмент',seg:'Сегмент',full:'Заполнено!',rename:'Название часов',untitled:'Без названия',
  tables:'СЛУЧАЙНЫЕ ТАБЛИЦЫ',tablesSub:'ОРИГИНАЛЬНЫЕ',tablesIntro:'Быстрые подсказки для импровизации. Таблицы написаны для этого приложения, а не взяты из книги. Последние результаты хранятся на этом устройстве; нужное запишите в журнал кампании.',names:'Имена и клички',one:'1 имя',five:'5 имён',handle:'Кличка',gigs:'Заказы',gig:'Заказ',loot:'Добыча',pockets:'Карманы',stash:'Тайник',oracle:'Оракул «да/нет»',likely:'Вероятность',ask:'Спросить',history:'Последние результаты',book:'Из книги',bookHeadline:'Заголовок новостей',bookVendit:'Вендит',bookBodega:'Бодега',toJournal:'В журнал',journalFor:'Журнал кампании',journalNone:'Чтобы сохранять результаты в журнал, создайте кампанию.',journalDone:name=>`Записано в журнал кампании «${name}».`,journalFail:'Не удалось записать в журнал.',weatherWord:'Погода',empty:'Пока пусто — нажмите любую кнопку.',clear:'Очистить',client:'Заказчик',job:'Работа',where:'Где',twist:'Осложнение',pay:'Оплата',payNote:'на команду, торг уместен',cash:'Наличные',die:'d10',
  weather:'ПОГОДА В НАЙТ-СИТИ',weatherSub:'1D10',weatherIntro:'Погода на сегодняшнюю ночь. Подсказки — лишь идеи для сцены, а не правила.',season:'Сезон',auto:'Авто (по дате)',roll:'Бросить погоду',again:'Бросить ещё',temp:'Температура',earlier:'Раньше'},
 en:{group:'GM TOOLS',clocks:'PROGRESS CLOCKS',clocksSub:'SAVED',clocksIntro:'Track threats, chases and long plans: segments fill as the game goes on. Click a segment to fill the clock up to it (click it again to clear it).',newName:'Name',newPlaceholder:'E.g. "The gang is on our trail"',segments:'Segments',create:'Create clock',none:'No clocks yet.',limit:'Limit reached — 30 clocks.',shared:'Show to players',reset:'Reset',del:'Delete',confirm:'Really delete?',minus:'Remove a segment',plus:'Add a segment',seg:'Segment',full:'Full!',rename:'Clock name',untitled:'Untitled',
  tables:'RANDOM TABLES',tablesSub:'ORIGINAL',tablesIntro:'Quick prompts for improvising. These tables were written for this app, not taken from the book. Recent results stay below until the page reloads.',names:'Names & handles',one:'1 name',five:'5 names',handle:'Handle',gigs:'Gigs',gig:'Gig',loot:'Loot',pockets:'Pockets',stash:'Stash',oracle:'Yes/No oracle',likely:'Likelihood',ask:'Ask',history:'Recent results',book:'From the book',bookHeadline:'News headline',bookVendit:'Vendit',bookBodega:'Bodega',toJournal:'To journal',journalFor:'Campaign journal',journalNone:'Create a campaign to keep results in its journal.',journalDone:name=>`Written to the journal of “${name}”.`,journalFail:'Could not write to the journal.',weatherWord:'Weather',empty:'Nothing yet — press any button.',clear:'Clear',client:'Client',job:'Job',where:'Where',twist:'Complication',pay:'Pay',payNote:'per crew, haggling expected',cash:'Cash',die:'d10',
  weather:'NIGHT CITY WEATHER',weatherSub:'1D10',weatherIntro:'Tonight’s weather. Hints are scene ideas, not rules.',season:'Season',auto:'Auto (from date)',roll:'Roll weather',again:'Roll again',temp:'Temperature',earlier:'Earlier'}
};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ---------- in-memory UI state ----------
let log=[],weatherLog=[],ui={size:6,likelihood:'even',season:'auto',armed:null,draft:'',campaign:''};
// Session prep stays on this device between reloads. Anything that no longer renders is dropped on load.
const PREP_KEY='nc-gm-prep-v1';
function storePrep(){try{window.localStorage?.setItem(PREP_KEY,JSON.stringify({v:1,log,weatherLog}))}catch(_){}}
function usable(render,e){try{return !!e&&typeof e==='object'&&!!render(e)}catch(_){return false}}
function loadPrep(){
 try{
  const saved=JSON.parse(window.localStorage?.getItem(PREP_KEY)||'null');if(!saved||saved.v!==1)return;
  const t=T.ru;
  if(Array.isArray(saved.log))log=saved.log.filter(e=>usable(x=>entryHtml(x,'ru',t),e)).slice(0,LOG_SIZE);
  if(Array.isArray(saved.weatherLog))weatherLog=saved.weatherLog.filter(e=>usable(x=>weatherHtml(x,'ru',t,true),e)).slice(0,4);
 }catch(_){log=[];weatherLog=[]}
}
function pushLog(entry){log.unshift(entry);log=log.slice(0,LOG_SIZE);storePrep()}
// Plain text of a result for the campaign journal, made from the same markup the GM sees.
function plainText(html){return String(html).replace(/<button[^>]*>.*?<\/button>/g,'').replace(/<\/dt>/g,': ').replace(/<\/(dd|li|strong|h4)>/g,'; ').replace(/<\/span>/g,' ').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').replace(/(; )+/g,'; ').replace(/ ;/g,';').replace(/[;:\s]+$/,'').trim()}
function prepCampaigns(){const st=appState();return (Array.isArray(st?.campaigns)?st.campaigns:[]).filter(c=>c&&typeof c.id==='string')}
function journalTarget(){const list=prepCampaigns();return list.find(c=>c.id===ui.campaign)||list[0]||null}
function journalPicker(t){const list=prepCampaigns();if(!list.length)return `<p class="gx-note">${esc(t.journalNone)}</p>`;const target=journalTarget();return `<label class="field gx-journal-pick">${esc(t.journalFor)}<select data-gx-field="campaign">${list.map(c=>`<option value="${esc(c.id)}"${c===target?' selected':''}>${esc(c.name||'—')}</option>`).join('')}</select></label>`}
function toJournal(text,t){const target=journalTarget(),say=m=>{try{window.App?.notify?.(m)}catch(_){}};if(!target||!text||!window.Campaigns?.journalAdd?.(target,text.slice(0,2000),false)){say(t.journalFail);return false}try{window.App.save()}catch(_){}say(t.journalDone(target.name||'—'));return true}

function appState(){return typeof window!=='undefined'&&window.App&&typeof window.App.getState==='function'?window.App.getState():null}

function wedge(i,n,r){
 if(n===1)return `M0 ${-r}A${r} ${r} 0 1 1 -0.01 ${-r}Z`;
 const a0=(i/n)*2*Math.PI-Math.PI/2,a1=((i+1)/n)*2*Math.PI-Math.PI/2,f=v=>v.toFixed(2);
 return `M0 0L${f(r*Math.cos(a0))} ${f(r*Math.sin(a0))}A${r} ${r} 0 0 1 ${f(r*Math.cos(a1))} ${f(r*Math.sin(a1))}Z`;
}
function clockSvg(c,t){
 let p='';for(let i=0;i<c.size;i++)p+=`<path class="gx-seg${i<c.filled?' on':''}" d="${wedge(i,c.size,46)}" data-gx-action="seg" data-gx-id="${esc(c.id)}" data-gx-seg="${i}" tabindex="0" role="button" aria-label="${esc(t.seg)} ${i+1}/${c.size}"><title>${esc(t.seg)} ${i+1}</title></path>`;
 return `<svg class="gx-clock-svg" viewBox="-50 -50 100 100" aria-hidden="false" focusable="false"><circle r="48" class="gx-rim"/>${p}</svg>`;
}
function renderClocks(l,t){
 const st=appState(),clocks=readClocks(st);
 let h=`<section class="card gx-card gx-clocks" data-gx-section="clocks"><div class="card-heading"><span>${esc(t.clocks)}</span><span>${esc(t.clocksSub)}</span></div><p class="gx-note">${esc(t.clocksIntro)}</p>`;
 h+=`<div class="gx-new"><label class="field">${esc(t.newName)}<input type="text" maxlength="${MAX_NAME}" data-gx-field="draft" placeholder="${esc(t.newPlaceholder)}" value="${esc(ui.draft)}"></label><label class="field">${esc(t.segments)}<select data-gx-field="size">${SIZES.map(s=>`<option value="${s}"${s===ui.size?' selected':''}>${s}</option>`).join('')}</select></label><button type="button" class="btn primary" data-gx-action="add"${clocks.length>=MAX_CLOCKS?' disabled':''}>+ ${esc(t.create)}</button></div>`;
 if(clocks.length>=MAX_CLOCKS)h+=`<p class="gx-note">${esc(t.limit)}</p>`;
 if(!clocks.length)h+=`<p class="gx-note" role="status">${esc(t.none)}</p>`;
 else h+=`<div class="gx-clock-grid">${clocks.map(c=>`<div class="gx-clock${c.filled===c.size?' full':''}" data-gx-clock="${esc(c.id)}">${clockSvg(c,t)}<input type="text" class="gx-clock-name" maxlength="${MAX_NAME}" data-gx-field="name" data-gx-id="${esc(c.id)}" value="${esc(c.name)}" placeholder="${esc(t.untitled)}" aria-label="${esc(t.rename)}"><div class="gx-count"><button type="button" class="btn ghost gx-step" data-gx-action="minus" data-gx-id="${esc(c.id)}" aria-label="${esc(t.minus)}">−</button><strong>${c.filled}/${c.size}</strong><button type="button" class="btn ghost gx-step" data-gx-action="plus" data-gx-id="${esc(c.id)}" aria-label="${esc(t.plus)}">+</button></div>${c.filled===c.size?`<p class="gx-full">${esc(t.full)}</p>`:''}<label class="gx-share"><input type="checkbox" data-gx-field="shared" data-gx-id="${esc(c.id)}"${c.shared?' checked':''}> ${esc(t.shared)}</label><div class="gx-clock-actions"><button type="button" class="btn ghost" data-gx-action="reset" data-gx-id="${esc(c.id)}">↺ ${esc(t.reset)}</button><button type="button" class="btn ghost gx-del${ui.armed===c.id?' armed':''}" data-gx-action="del" data-gx-id="${esc(c.id)}">✕ ${esc(ui.armed===c.id?t.confirm:t.del)}</button></div></div>`).join('')}</div>`;
 return h+'</section>';
}
function entryHtml(e,l,t){
 if(e.kind==='names')return `<div class="gx-entry"><span class="overline">${esc(e.handleOnly?t.handle:t.names)}</span><ul class="gx-list">${e.names.map(n=>`<li>${esc(e.handleOnly?L({ru:n.handle[0],en:n.handle[1]},l):formatName(n,l))}</li>`).join('')}</ul></div>`;
 if(e.kind==='gig'){const g=e.gig;return `<div class="gx-entry"><span class="overline">${esc(t.gig)}</span><dl class="gx-dl"><dt>${esc(t.client)}</dt><dd>${esc(L(g.client,l))}</dd><dt>${esc(t.job)}</dt><dd>${esc(L(g.job,l))}</dd><dt>${esc(t.where)}</dt><dd>${esc(L(g.place,l))}</dd><dt>${esc(t.twist)}</dt><dd>${esc(L(g.complication,l))}</dd><dt>${esc(t.pay)}</dt><dd><span class="gx-mono">${g.pay.min}–${g.pay.max}eb</span> · ${esc(t.payNote)}</dd></dl></div>`}
 if(e.kind==='loot'){const o=e.loot;return `<div class="gx-entry"><span class="overline">${esc(t.loot)} · ${esc(o.mode==='stash'?t.stash:t.pockets)}</span><ul class="gx-list">${o.items.map(i=>`<li>${esc(L(i.name,l))} <span class="gx-mono">${esc(i.price)}eb</span>${i.page?` <button class="rule-source" type="button" data-action="book-page" data-page="${esc(i.page)}">${l==='en'?'p.':'стр.'} ${esc(i.page)}</button>`:''}${window.GMTable?.giveButton?.({item:i.id},l)||''}</li>`).join('')}${o.flavor.map(f=>`<li class="gx-flavor">${esc(L(f,l))}</li>`).join('')}<li>${esc(t.cash)}: <span class="gx-mono">${o.cash}eb</span>${window.GMTable?.giveButton?.({cash:o.cash},l)||''}</li></ul></div>`}
 if(e.kind==='book')return window.BookTables?.html?.(e.book,l)||'';
 if(e.kind==='oracle'){const o=e.oracle,lv=LIKELIHOOD.find(x=>x.id===o.likelihood);return `<div class="gx-entry gx-oracle-out"><span class="overline">${esc(t.oracle)} · ${esc(lv[l])}</span><div class="gx-oracle-row"><span class="gx-die" aria-label="${esc(t.die)}: ${o.roll}">${o.roll}</span><strong class="gx-answer ${o.answer.startsWith('yes')?'yes':'no'}">${esc(ANSWERS[o.answer][l])}</strong><span class="gx-note">${esc(t.die)} ≥ ${lv.min}</span></div></div>`}
 return '';
}
function renderTables(l,t){
 const btn=(a,label,extra='')=>`<button type="button" class="btn ghost" data-gx-action="${a}"${extra}>${esc(label)}</button>`;
 let h=`<section class="card gx-card gx-tables" data-gx-section="tables"><div class="card-heading"><span>${esc(t.tables)}</span><span>${esc(t.tablesSub)}</span></div><p class="gx-note">${esc(t.tablesIntro)}</p><div class="gx-table-grid">`;
 h+=`<div class="gx-tool"><h4>${esc(t.names)}</h4><div class="gx-actions">${btn('name1',t.one)}${btn('name5',t.five)}${btn('handle',t.handle)}</div></div>`;
 h+=`<div class="gx-tool"><h4>${esc(t.gigs)}</h4><div class="gx-actions">${btn('gig',t.gig)}</div></div>`;
 h+=`<div class="gx-tool"><h4>${esc(t.loot)}</h4><div class="gx-actions">${btn('loot-pockets',t.pockets)}${btn('loot-stash',t.stash)}</div></div>`;
 h+=`<div class="gx-tool"><h4>${esc(t.oracle)}</h4><label class="field">${esc(t.likely)}<select data-gx-field="likelihood">${LIKELIHOOD.map(x=>`<option value="${x.id}"${x.id===ui.likelihood?' selected':''}>${esc(x[l])}</option>`).join('')}</select></label><div class="gx-actions">${btn('oracle',t.ask)}</div></div>`;
 if(window.BookTables)h+=`<div class="gx-tool"><h4>${esc(t.book)}</h4><div class="gx-actions">${btn('book-headline',t.bookHeadline)}${btn('book-vendit',t.bookVendit)}${btn('book-bodega',t.bookBodega)}</div></div>`;
 const canJournal=prepCampaigns().length>0;
 h+=`</div><div class="gx-log-head"><strong>${esc(t.history)}</strong>${log.length?btn('clear-log',t.clear):''}</div>${journalPicker(t)}<div class="gx-log" role="status" aria-live="polite">${log.length?log.map((e,i)=>entryHtml(e,l,t)+(canJournal?`<div class="gx-entry-actions">${btn('journal',t.toJournal,` data-gx-index="${i}"`)}</div>`:'')).join(''):`<p class="gx-note">${esc(t.empty)}</p>`}</div>`;
 return h+'</section>';
}
function weatherHtml(w,l,t,main){const s=SEASONS.find(x=>x.id===w.season),c=WEATHER[w.condition];return `<div class="gx-weather${main?' main':''}"><div class="gx-oracle-row"><span class="gx-die" aria-label="${esc(t.die)}: ${w.roll}">${w.roll}</span><strong class="gx-cond">${esc(c[l])}</strong><span class="gx-mono">${w.temp[0]}…${w.temp[1]} °C</span><span class="gx-note">${esc(s[l])}</span></div>${main?`<p class="gx-hint">${esc(c.hint[l])}</p>`:''}</div>`}
function renderWeather(l,t){
 let h=`<section class="card gx-card gx-weather-card" data-gx-section="weather"><div class="card-heading"><span>${esc(t.weather)}</span><span>${esc(t.weatherSub)}</span></div><p class="gx-note">${esc(t.weatherIntro)}</p><div class="gx-new"><label class="field">${esc(t.season)}<select data-gx-field="season"><option value="auto"${ui.season==='auto'?' selected':''}>${esc(t.auto)} — ${esc(SEASONS.find(s=>s.id===seasonFor())[l])}</option>${SEASONS.map(s=>`<option value="${s.id}"${ui.season===s.id?' selected':''}>${esc(s[l])}</option>`).join('')}</select></label><button type="button" class="btn primary" data-gx-action="weather">☂ ${esc(weatherLog.length?t.again:t.roll)}</button></div>`;
 if(weatherLog.length){h+=`<div role="status" aria-live="polite">${weatherHtml(weatherLog[0],l,t,true)}</div>${prepCampaigns().length?`<div class="gx-entry-actions"><button type="button" class="btn ghost" data-gx-action="journal-weather">${esc(t.toJournal)}</button></div>`:''}`;if(weatherLog.length>1)h+=`<p class="overline gx-earlier">${esc(t.earlier)}</p>${weatherLog.slice(1).map(w=>weatherHtml(w,l,t,false)).join('')}`}
 return h+'</section>';
}
let lateRender=false;
function render(lang){
 const l=lang==='en'?'en':'ru',t=T[l];
 // On boot app.js renders the first view before it defines window.App, so saved clocks are not
 // readable yet: re-render this group once the bridge exists.
 if(!appState()&&!lateRender&&typeof setTimeout==='function'&&typeof document!=='undefined'){lateRender=true;setTimeout(()=>{lateRender=false;const r=document.querySelector?.('[data-gx-root]');if(r&&appState())rerender(r)},0)}
 return `<div class="gm-extras" data-gx-root data-lang="${l}"><p class="overline gx-group">${esc(t.group)}</p>${renderClocks(l,t)}${renderTables(l,t)}${renderWeather(l,t)}${window.NpcLibrary?.render?.(l)||''}</div>`;
}

// ---------- events ----------
function mutate(fn){const st=appState();if(!st)return false;const r=fn(readClocks(st));if(!r.ok)return false;writeClocks(st,r.clocks);try{window.App.save()}catch(_){}return true}
function rerender(root,lang){
 const l=lang||(typeof window!=='undefined'&&window.App?.lang?.())||root.dataset.lang;
 if(typeof root.outerHTML!=='string'||root.isConnected===false)return;
 const active=typeof document!=='undefined'?document.activeElement:null,key=active&&root.contains?.(active)?(active.dataset?.gxAction||active.dataset?.gxField)+'|'+(active.dataset?.gxId||'')+'|'+(active.dataset?.gxSeg||''):null;
 root.outerHTML=render(l);
 if(key&&typeof document!=='undefined'){const [a,id,seg]=key.split('|');const el=[...document.querySelectorAll('[data-gx-root] [data-gx-action],[data-gx-root] [data-gx-field]')].find(e=>(e.dataset.gxAction||e.dataset.gxField)===a&&(e.dataset.gxId||'')===id&&(e.dataset.gxSeg||'')===seg);el?.focus?.()}
}
function act(a,b,root,rng){
 const id=b?.dataset?.gxId;
 if(a!=='del')ui.armed=null;
 switch(a){
  case 'add':{const name=root.querySelector?.('[data-gx-field="draft"]')?.value??ui.draft;const size=Number(root.querySelector?.('[data-gx-field="size"]')?.value)||ui.size;ui.size=SIZES.includes(size)?size:6;if(mutate(list=>addClock(list,name,ui.size)))ui.draft='';return true}
  case 'seg':return mutate(list=>updateClock(list,id,c=>clickSegment(c,b.dataset.gxSeg)))||true;
  case 'plus':return mutate(list=>updateClock(list,id,c=>step(c,1)))||true;
  case 'minus':return mutate(list=>updateClock(list,id,c=>step(c,-1)))||true;
  case 'reset':return mutate(list=>updateClock(list,id,c=>(c.filled=0,c)))||true;
  case 'del':if(ui.armed!==id){ui.armed=id;return true}ui.armed=null;mutate(list=>{const clocks=list.filter(c=>c.id!==id);return {clocks,ok:clocks.length!==list.length}});return true;
  case 'name1':pushLog({kind:'names',names:[genName(rng)]});return true;
  case 'name5':pushLog({kind:'names',names:Array.from({length:5},()=>genName(rng,false))});return true;
  case 'handle':pushLog({kind:'names',handleOnly:true,names:pickDistinct(HANDLES,3,rng).map(h=>({handle:h}))});return true;
  case 'gig':pushLog({kind:'gig',gig:genGig(rng)});return true;
  case 'loot-pockets':pushLog({kind:'loot',loot:genLoot('pockets',rng)});return true;
  case 'loot-stash':pushLog({kind:'loot',loot:genLoot('stash',rng)});return true;
  case 'oracle':{const v=root.querySelector?.('[data-gx-field="likelihood"]')?.value;if(LIKELIHOOD.some(x=>x.id===v))ui.likelihood=v;pushLog({kind:'oracle',oracle:oracle(ui.likelihood,rng)});return true}
  case 'book-headline':pushLog({kind:'book',book:window.BookTables.headline(rng)});return true;
  case 'book-vendit':pushLog({kind:'book',book:window.BookTables.vendit(rng)});return true;
  case 'book-bodega':pushLog({kind:'book',book:window.BookTables.bodega(rng)});return true;
  case 'journal':{const entry=log[Number(b.dataset.gxIndex)];if(!entry)return true;const l=root.dataset?.lang==='en'?'en':'ru',t=T[l];toJournal(entry.kind==='book'?window.BookTables?.text?.(entry.book,l)||'':plainText(entryHtml(entry,l,t)),t);return true}
  case 'journal-weather':{if(!weatherLog[0])return true;const l=root.dataset?.lang==='en'?'en':'ru',t=T[l];toJournal(t.weatherWord+': '+plainText(weatherHtml(weatherLog[0],l,t,true)),t);return true}
  case 'clear-log':log=[];storePrep();return true;
  case 'weather':{const v=root.querySelector?.('[data-gx-field="season"]')?.value;if(v==='auto'||SEASONS.some(s=>s.id===v))ui.season=v;weatherLog.unshift(genWeather(ui.season==='auto'?null:ui.season,rng));weatherLog=weatherLog.slice(0,4);storePrep();return true}
 }
 return false;
}
function handle(e,lang,rng=Math.random){
 const target=e?.target,root=target?.closest?.('[data-gx-root]');
 // A detached input (replaced by a re-render) can still fire a late change event: ignore it.
 if(!root||root.isConnected===false)return false;
 const f=target.dataset?.gxField;
 if(e.type==='input'){if(f==='draft'){ui.draft=cleanName(target.value);return true}return false}
 if(e.type==='change'){
  if(f==='draft')return true;
  if(f==='size'){const s=Number(target.value);if(SIZES.includes(s))ui.size=s;return true}
  if(f==='campaign'){ui.campaign=String(target.value||'').slice(0,200);return true}
  if(f==='likelihood'){if(LIKELIHOOD.some(x=>x.id===target.value))ui.likelihood=target.value;return true}
  if(f==='season'){if(target.value==='auto'||SEASONS.some(s=>s.id===target.value))ui.season=target.value;return true}
  // Rename saves without re-rendering so a click elsewhere is not swallowed by the DOM swap.
  if(f==='name'){const v=cleanName(target.value);mutate(list=>updateClock(list,target.dataset.gxId,c=>(c.name=v,c)));return true}
  if(f==='shared'){mutate(list=>updateClock(list,target.dataset.gxId,c=>(c.shared=!!target.checked,c)));return true}
  return false;
 }
 let b=null;
 if(e.type==='click')b=target.closest('[data-gx-action]');
 else if(e.type==='keydown'&&(e.key==='Enter'||e.key===' ')){const s=target.closest('[data-gx-action="seg"]');if(s){b=s;e.preventDefault?.()}else if(f==='draft'&&e.key==='Enter'){b={dataset:{gxAction:'add'}};e.preventDefault?.()}}
 if(!b)return false;
 if(!act(b.dataset.gxAction,b,root,rng))return false;
 rerender(root,lang);
 return true;
}
function reset(){log=[];weatherLog=[];ui={size:6,likelihood:'even',season:'auto',armed:null,draft:'',campaign:''};storePrep()}
loadPrep();
if(typeof document!=='undefined'&&document.addEventListener){for(const type of ['click','change','input','keydown'])document.addEventListener(type,e=>{handle(e)})}
window.GMExtras={SIZES,MAX_CLOCKS,MAX_NAME,LIKELIHOOD,SEASONS,WEATHER,SEASON_TABLE,FIRST,LAST,HANDLES,CLIENTS,JOBS,PLACES,COMPLICATIONS,FLAVOR,
 cleanClock,readClocks,writeClocks,sharedClocks,addClock,updateClock,clickSegment,step,genName,formatName,genGig,genLoot,lootPool,oracle,oracleAnswer,seasonFor,genWeather,render,handle,reset,get log(){return log},get weatherLog(){return weatherLog}};
})();
