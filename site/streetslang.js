/* Streetslang glossary, RU/EN. Corebook v1.22 "Streetslang" section p. 24, plus setting terms whose
   page buttons open the matching chapter/section start from the printed contents (p. 3): Netrunning 195,
   Cyberpsychosis 230, Time of the Red 258, Welcome to Night City 283, Gangs 308, Everyday Life 319–329,
   Night Markets 337. Buttons marked 24 open the Streetslang section, not a specific entry.
   A curated subset with definitions written for this app; it does not reproduce the printed list. View-only. */
(function(){
'use strict';
const TOPICS=Object.freeze({people:['Люди','People'],talk:['Разговор','Talk'],action:['Дела','Action'],stuff:['Вещи и деньги','Stuff & money'],net:['NET','NET'],places:['Места','Places']});
// [term, topic, page, Russian rendering, Russian meaning, English meaning]
const TERMS=Object.freeze([
['Choom / Choomba','people',24,'чум, чумба','Друг, свой человек, член «семьи».','Friend, one of your own, family.'],
['Gonk','people',0,'гонк','Идиот, болван.','Idiot, fool.'],
['Input/Output','people',24,'инпут/аутпут','Случайный любовник или любовница — «механический» жаргон.','A casual lover, in mechanistic slang.'],
['Corpo','people',0,'корпо, корпорат','Человек корпорации; часто с презрением.','Corporate person; often said with contempt.'],
['Edgerunner','people',0,'эджраннер','Наёмник на грани закона, который живёт гигами.','Outlaw mercenary living job to job on the edge.'],
['Borg','people',0,'борг','Тот, в ком машины больше, чем человека.','Someone who is more machine than human.'],
['Booster / Boostergang','people',308,'бустер, бустер-банда','Уличная банда, помешанная на киберимплантах.','Street gang obsessed with cyberware.'],
['Poser / Posergang','people',308,'позёр, позёр-банда','Банда, копирующая облик кумира или стиля.','Gang that copies the look of an idol or style.'],
['Cyberpsycho','people',230,'киберпсих','Человек, сорвавшийся в насилие из-за потери человечности.','Someone driven to violence by loss of Humanity.'],
['Ripperdoc','people',24,'риппердок','Подпольный хирург, ставящий киберимпланты.','Back-alley surgeon who installs cyberware.'],
['Exotic','people',24,'экзот','Человек с биоскульптурой, придающей звериные черты.','Person bodysculpted with animal-like features.'],
['Handle','people',24,'хэндл, прозвище','Уличное имя, под которым тебя знают.','Street name you are known by.'],
['Reclaimers','people',283,'реклеймеры','Группы, возвращающие к жизни заброшенные районы.','Groups bringing abandoned areas back to life.'],
['Preem','talk',0,'прим','Отличный, первоклассный (от «premium»).','Excellent, top quality (from “premium”).'],
['Nova','talk',0,'нова','Круто, классно.','Cool, great.'],
['Delta','talk',0,'дельта, дельтануть','Быстро уйти, свалить.','Leave in a hurry.'],
['Chilled','talk',24,'чилд','Спокойный, собранный, «в порядке».','Calm and composed; having it together.'],
['Gig','action',0,'гиг','Работа, заказ, дело.','A job.'],
['Flatline','action',24,'флэтлайн','Убить; «флэтлайнуться» — умереть, в том числе в NET.','To kill; to be flatlined is to die, including in the NET.'],
['Zero','action',0,'обнулить','Убить кого-то.','To kill someone.'],
['Jack in / Jack out','net',195,'джекнуться, отключиться','Подключиться к NET или устройству через интерфейсные разъёмы и отключиться.','Connect to the NET or a device via interface plugs, and disconnect.'],
['Meat / Meatspace','net',24,'мясо, мясное пространство','Тело и реальный мир в противоположность NET.','The body and the physical world, as opposed to the NET.'],
['Black ICE','net',195,'чёрный лёд','Программа защиты, способная убить нетраннера.','Defense program that can kill a Netrunner.'],
['NetWatch','net',195,'НетВотч','Сетевая полиция.','The NET police.'],
['Data Pool','net',195,'дата-пул','Остатки общедоступной сети после краха старой NET.','What is left of the public net after the Old NET fell.'],
['Eddies','stuff',0,'эдди','Евродоллары, местные деньги (eb).','Eurodollars, the money of the street (eb).'],
['Chrome / Chromed','stuff',24,'хром, хромированный','Киберимпланты; «хромированный» — сильно аугментированный.','Cyberware; chromed means heavily augmented.'],
['Agent','stuff',319,'агент','Смартфон с ИИ-помощником.','Smartphone with an AI personal assistant.'],
['Braindance (BD)','stuff',329,'брейнданс, БД','Запись чужих ощущений, переживаемая как своя.','Recording of someone’s sensations, experienced as your own.'],
['Kibble','stuff',328,'киббл','Самая дешёвая еда, прессованная пищевая масса.','Cheapest food: processed nutrient pellets.'],
['Screamsheet','stuff',326,'скримшит','Дешёвая распечатка новостей.','Cheap printout of the news.'],
['Combat Zone','places',283,'боевая зона','Беззаконный район, где правят банды.','Lawless area run by gangs.'],
['Megabuilding','places',283,'мегабашня','Огромный жилой комплекс-город в одном здании.','Huge residential building that is a city in itself.'],
['Night Market','places',337,'ночной рынок','Временный рынок, где продают всё — от еды до оружия.','Pop-up market selling everything from food to guns.'],
['Time of the Red','places',258,'Время Красного','Эпоха после 4-й корпоративной войны с красным небом.','The era after the 4th Corporate War, under red skies.']
]);
const T={
 ru:{title:'УЛИЧНЫЙ СЛЕНГ',source:'СТР. 24',intro:'Короткий словарь для игры на русском и английском. Это подборка, а не перепечатка книги: часть терминов взята из других глав о Найт-Сити.',search:'Найти слово',all:'Все темы',none:'Ничего не найдено.',count:'терминов найдено',book:'Книга, стр. 24',page:'стр.'},
 en:{title:'STREETSLANG',source:'P. 24',intro:'A short glossary for play in English and Russian. It is a curated selection, not a reprint; some terms come from other Night City chapters.',search:'Find a word',all:'All topics',none:'Nothing found.',count:'terms',book:'Corebook p. 24',page:'p.'}
};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function countText(n,l){return l==='ru'?'Найдено: '+n:n+' '+T.en.count}
let query='',topic='all';
function filter(q,tp){q=String(q??'').trim().toLowerCase();return TERMS.filter(x=>(tp==='all'||!Object.hasOwn(TOPICS,tp)||x[1]===tp)&&(!q||[x[0],x[3],x[4],x[5]].some(s=>s.toLowerCase().includes(q))))}
function items(list,l){const ru=l==='ru';if(!list.length)return `<p>${esc(T[l].none)}</p>`;return `<dl class="slang-list">${list.map(x=>`<div class="slang-item"><dt><strong>${esc(x[0])}</strong>${ru?` <span class="slang-ru">${esc(x[3])}</span>`:''}</dt><dd>${esc(ru?x[4]:x[5])} ${x[2]?`<button class="rule-source" type="button" data-action="book-page" data-page="${x[2]}">${esc(T[l].page)} ${x[2]}</button>`:''}</dd></div>`).join('')}</dl>`}
function render(lang){const l=lang==='en'?'en':'ru',t=T[l],list=filter(query,topic);return `<section class="card streetslang" data-slang-root data-lang="${l}"><div class="card-heading"><span>${esc(t.title)}</span><span>${esc(t.source)}</span></div><p>${esc(t.intro)}</p><div class="sr-toolbar"><label class="field">${esc(t.search)}<input type="search" value="${esc(query)}" data-slang-field="query"></label><label class="field">${esc(t.all)}<select data-slang-field="topic"><option value="all">${esc(t.all)}</option>${Object.entries(TOPICS).map(([k,v])=>`<option value="${k}"${topic===k?' selected':''}>${esc(v[l==='ru'?0:1])}</option>`).join('')}</select></label><span class="result-count" data-slang-count>${esc(countText(list.length,l))}</span></div><div data-slang-list>${items(list,l)}</div><button class="rule-source" type="button" data-action="book-page" data-page="24">${esc(t.book)} ↗</button></section>`}
function handle(e,lang){const f=e?.target?.dataset?.slangField;if(!f||!['input','change'].includes(e.type))return false;const root=e.target.closest?.('[data-slang-root]');if(!root)return false;const l=(lang||root.dataset.lang)==='en'?'en':'ru';if(f==='query')query=String(e.target.value).slice(0,80);else if(f==='topic')topic=Object.hasOwn(TOPICS,e.target.value)?e.target.value:'all';else return false;const list=filter(query,topic),box=root.querySelector('[data-slang-list]'),count=root.querySelector('[data-slang-count]');if(box)box.innerHTML=items(list,l);if(count)count.textContent=countText(list.length,l);return true}
function reset(){query='';topic='all'}
if(typeof document!=='undefined'&&document.addEventListener){for(const type of ['input','change'])document.addEventListener(type,e=>{handle(e)})}
window.Streetslang={TOPICS,TERMS,filter,render,handle,reset};
})();
