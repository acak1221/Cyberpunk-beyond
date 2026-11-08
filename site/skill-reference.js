/* Skills quick reference: check formula (p. 128), DV ladder (p. 129), critical d10 and modifiers (p. 130),
   skill list with linked STATs and ×2 skills (pp. 130–142); basic skills / creation costs p. 90.
   Descriptions are short paraphrases written for this app, not book text. View-only, no storage. */
(function(){
'use strict';
const DV=Object.freeze([[9,'Простая','Simple'],[13,'Обычная','Everyday'],[15,'Трудная','Difficult'],[17,'Профессиональная','Professional'],[21,'Героическая','Heroic'],[24,'Невероятная','Incredible'],[29,'Легендарная','Legendary']]);
const GROUPS=Object.freeze({awareness:['Восприятие','Awareness'],body:['Тело','Body'],control:['Управление','Control'],education:['Образование','Education'],fighting:['Бой','Fighting'],performance:['Выступление','Performance'],ranged:['Стрелковое оружие','Ranged Weapon'],social:['Социальные','Social'],technique:['Техника','Technique']});
// [English name, group, STAT, cost multiplier, basic skill, Russian name, Russian summary, English summary]
const SKILLS=Object.freeze([
['Concentration','awareness','WILL',1,1,'Концентрация','Сосредоточиться, вспомнить детали, удержать внимание или самоконтроль под давлением.','Focus, recall details, and keep control of attention or body under pressure.'],
['Conceal/Reveal Object','awareness','INT',1,0,'Спрятать / обнаружить предмет','Спрятать предмет на себе или в помещении либо найти спрятанное.','Hide an object on a person or in a place, or find one that is hidden.'],
['Lip Reading','awareness','INT',1,0,'Чтение по губам','Понять речь по движению губ, когда звук не слышен.','Understand speech from lip movement when you cannot hear it.'],
['Perception','awareness','INT',1,1,'Восприятие','Заметить скрытое, засаду, ловушку или важную деталь.','Notice hidden things, ambushes, traps, or important details.'],
['Tracking','awareness','INT',1,0,'Выслеживание','Идти по следам и находить признаки того, кто здесь прошёл.','Follow a trail and read signs of who passed by.'],
['Athletics','body','DEX',1,1,'Атлетика','Лазать, прыгать, плавать, метать предметы и выполнять силовые трюки.','Climb, jump, swim, throw objects, and other physical feats.'],
['Contortionist','body','DEX',1,0,'Акробатическая гибкость','Выскользнуть из пут или протиснуться в узкое место.','Slip out of restraints or squeeze through tight spaces.'],
['Dance','body','DEX',1,0,'Танцы','Танцевать профессионально или эффектно.','Dance well enough to impress or perform.'],
['Endurance','body','WILL',1,0,'Выносливость','Терпеть долгие нагрузки, голод, жажду и тяжёлые условия.','Withstand long exertion, hunger, thirst, and harsh conditions.'],
['Resist Torture/Drugs','body','WILL',1,0,'Сопротивление пыткам / наркотикам','Выдержать пытку, допрос с болью и действие веществ.','Hold out against torture, painful interrogation, and drug effects.'],
['Stealth','body','DEX',1,1,'Скрытность','Двигаться незаметно, прятаться и уходить от наблюдения.','Move unseen, hide, and avoid observation.'],
['Drive Land Vehicle','control','REF',1,0,'Вождение наземного транспорта','Управлять машиной или мотоциклом в сложной ситуации и в погоне.','Handle cars and bikes in tough situations and chases.'],
['Pilot Air Vehicle','control','REF',2,0,'Пилотирование воздушного транспорта','Управлять AV, вертолётами и другими летательными аппаратами.','Fly AVs, helicopters, and other aircraft.'],
['Pilot Sea Vehicle','control','REF',1,0,'Управление водным транспортом','Управлять лодками, катерами и другими судами.','Pilot boats and other watercraft.'],
['Riding','control','REF',1,0,'Верховая езда','Ездить верхом на животном и управлять им в движении.','Ride and control a mount.'],
['Accounting','education','INT',1,0,'Бухгалтерия','Вести счета, считать деньги и находить махинации в отчётах.','Keep books, handle money, and spot cooked accounts.'],
['Animal Handling','education','INT',1,0,'Обращение с животными','Дрессировать, успокаивать и понимать животных.','Train, calm, and care for animals.'],
['Bureaucracy','education','INT',1,0,'Бюрократия','Пробиться через инстанции, документы и чиновников.','Navigate officials, paperwork, and red tape.'],
['Business','education','INT',1,0,'Бизнес','Понимать сделки, рынки и устройство компаний.','Understand deals, markets, and how companies work.'],
['Composition','education','INT',1,0,'Сочинение','Писать тексты, песни, отчёты и сценарии.','Write songs, articles, reports, and scripts.'],
['Criminology','education','INT',1,0,'Криминология','Искать улики, анализировать преступления и полицейские данные.','Find clues and analyze crimes and police records.'],
['Cryptography','education','INT',1,0,'Криптография','Шифровать и расшифровывать сообщения и коды.','Encrypt and decrypt messages and codes.'],
['Deduction','education','INT',1,0,'Дедукция','Делать выводы из разрозненных фактов.','Draw conclusions from scattered clues.'],
['Education','education','INT',1,1,'Образование','Общие знания, чтение, письмо и базовая математика.','General knowledge, reading, writing, and basic math.'],
['Gamble','education','INT',1,0,'Азартные игры','Знать игры, считать шансы и замечать шулеров.','Know games of chance, work the odds, and spot cheats.'],
['Language','education','INT',1,0,'Язык','Говорить и читать на выбранном языке; Streetslang — базовый навык для всех.','Speak and read a chosen language; Streetslang is a basic skill for everyone.'],
['Library Search','education','INT',1,0,'Поиск информации','Находить сведения в базах данных, сети и архивах.','Find information in databases, the Data Pool, and archives.'],
['Local Expert','education','INT',1,0,'Знание района','Знать людей, места и слухи выбранного района; домашний район — базовый навык.','Know the people, places, and rumors of a chosen area; your home area is a basic skill.'],
['Science','education','INT',1,0,'Наука','Знания выбранной научной области.','Knowledge of a chosen scientific field.'],
['Tactics','education','INT',1,0,'Тактика','Планировать бой, засады и действия группы.','Plan fights, ambushes, and team maneuvers.'],
['Wilderness Survival','education','INT',1,0,'Выживание в дикой природе','Найти воду, еду, укрытие и дорогу вне города.','Find water, food, shelter, and direction outside the city.'],
['Brawling','fighting','DEX',1,1,'Рукопашный бой','Удары без оружия и захваты.','Unarmed strikes and grappling.'],
['Evasion','fighting','DEX',1,1,'Уклонение','Уклоняться от атак ближнего боя; от дальних — только при REF 8+.','Dodge melee attacks; dodging ranged attacks needs REF 8+.'],
['Martial Arts','fighting','DEX',2,0,'Боевые искусства','Выбранная школа боевых искусств с особыми приёмами.','A chosen martial arts form with special moves.'],
['Melee Weapon','fighting','DEX',1,0,'Холодное оружие','Атаки ножами, клинками, дубинками и другим оружием ближнего боя.','Attacks with knives, blades, clubs, and other melee weapons.'],
['Acting','performance','COOL',1,0,'Актёрское мастерство','Играть роль, притворяться и изображать эмоции.','Play a role, pretend, and fake emotions.'],
['Play Instrument','performance','TECH',1,0,'Игра на инструменте','Играть на выбранном музыкальном инструменте.','Play a chosen musical instrument.'],
['Archery','ranged','REF',1,0,'Стрельба из лука','Стрелять из луков и арбалетов.','Shoot bows and crossbows.'],
['Autofire','ranged','REF',2,0,'Автоматический огонь','Очереди и подавляющий огонь из SMG и штурмовых винтовок.','Autofire bursts and suppressive fire from SMGs and assault rifles.'],
['Handgun','ranged','REF',1,0,'Пистолеты','Стрелять из пистолетов, а также одиночными из SMG.','Fire pistols, and single shots from SMGs.'],
['Heavy Weapons','ranged','REF',2,0,'Тяжёлое оружие','Гранатомёты, ракетные установки и другое тяжёлое оружие.','Grenade launchers, rocket launchers, and other heavy weapons.'],
['Shoulder Arms','ranged','REF',1,0,'Длинноствольное оружие','Стрелять из винтовок и дробовиков.','Fire rifles and shotguns.'],
['Bribery','social','COOL',1,0,'Подкуп','Понять, кому, сколько и как дать взятку.','Know who to bribe, how much, and how to do it.'],
['Conversation','social','EMP',1,1,'Разговор','Вытянуть сведения из собеседника в обычном разговоре.','Draw information out of someone through casual talk.'],
['Human Perception','social','EMP',1,1,'Понимание людей','Распознать ложь, эмоции и скрытые мотивы.','Read lies, emotions, and hidden motives.'],
['Interrogation','social','COOL',1,0,'Допрос','Добыть сведения у того, кто не хочет говорить.','Get information from someone who does not want to talk.'],
['Persuasion','social','COOL',1,1,'Убеждение','Уговорить, убедить или склонить к своей точке зрения.','Convince people or talk them into something.'],
['Personal Grooming','social','COOL',1,0,'Уход за собой','Выглядеть ухоженно и производить впечатление внешностью.','Look good and impress with your appearance.'],
['Streetwise','social','COOL',1,0,'Знание улиц','Найти нелегальный товар, нужного человека и уличные слухи.','Find illegal goods, the right contact, and street rumors.'],
['Trading','social','COOL',1,0,'Торговля','Торговаться и получать выгодную цену.','Haggle and strike a good deal.'],
['Wardrobe & Style','social','COOL',1,0,'Гардероб и стиль','Одеваться к месту и со вкусом.','Dress right for the occasion, with style.'],
['Air Vehicle Tech','technique','TECH',1,0,'Техника воздушного транспорта','Чинить и улучшать летательные аппараты.','Repair and upgrade aircraft.'],
['Basic Tech','technique','TECH',1,0,'Основы техники','Чинить обычные устройства, бытовую технику и простую электронику.','Repair everyday devices, appliances, and simple electronics.'],
['Cybertech','technique','TECH',1,0,'Кибертехника','Обслуживать и чинить киберимпланты.','Maintain and repair cyberware.'],
['Demolitions','technique','TECH',2,0,'Подрывное дело','Устанавливать, обезвреживать и рассчитывать взрывчатку.','Set, disarm, and size explosive charges.'],
['Electronics/Security Tech','technique','TECH',2,0,'Электроника / безопасность','Работать со сложной электроникой, замками и системами охраны.','Work with complex electronics, locks, and security systems.'],
['First Aid','technique','TECH',1,1,'Первая помощь','Стабилизировать раненого и оказать базовую помощь.','Stabilize the wounded and provide basic care.'],
['Forgery','technique','TECH',1,0,'Подделка документов','Изготавливать и распознавать поддельные документы.','Create and detect forged documents.'],
['Land Vehicle Tech','technique','TECH',1,0,'Техника наземного транспорта','Чинить и улучшать машины и мотоциклы.','Repair and upgrade cars and bikes.'],
['Paint/Draw/Sculpt','technique','TECH',1,0,'Живопись / рисунок / скульптура','Создавать изобразительное искусство.','Create visual art.'],
['Paramedic','technique','TECH',2,0,'Парамедик','Серьёзное лечение и стабилизация; лечение части критических ранений.','Serious medical care and stabilization; treats many Critical Injuries.'],
['Photography/Film','technique','TECH',1,0,'Фото / видеосъёмка','Снимать фото и видео профессионального качества.','Shoot professional-quality photos and video.'],
['Pick Lock','technique','TECH',1,0,'Взлом замков','Открывать механические замки.','Open mechanical locks.'],
['Pick Pocket','technique','TECH',1,0,'Карманные кражи','Незаметно вытащить или подбросить предмет.','Lift or plant an item unnoticed.'],
['Sea Vehicle Tech','technique','TECH',1,0,'Техника водного транспорта','Чинить и улучшать суда.','Repair and upgrade watercraft.'],
['Weaponstech','technique','TECH',1,0,'Оружейная техника','Чинить, модифицировать и улучшать оружие.','Repair, modify, and upgrade weapons.']
]);
// Chance that base + 1d10 beats dv. A natural 10 adds one more d10, a natural 1 subtracts one;
// the extra die does not explode again (Corebook p. 129). Ties fail; opposed ties go to the defender.
function chance(base,dv){base=Number(base);dv=Number(dv);if(!Number.isFinite(base)||!Number.isFinite(dv))return null;let p=0;for(let face=2;face<=9;face++)if(base+face>dv)p+=10;for(let k=1;k<=10;k++){if(base+1-k>dv)p+=1;if(base+10+k>dv)p+=1}return p/100}
const T={
 ru:{title:'НАВЫКИ И СЛОЖНОСТЬ',source:'СТР. 128–141',intro:'Проверка: STAT + навык + 1d10 против DV; нужно превзойти DV, ничья — провал. Во встречной проверке ничья — за защищающимся. Выпало 10 — бросьте ещё 1d10 и прибавьте; выпало 1 — бросьте ещё 1d10 и вычтите.',dvTitle:'Лестница DV',odds:'Шанс успеха',base:'STAT + навык + модификаторы',dv:'DV',search:'Найти навык или STAT',all:'Все группы',skill:'Навык',stat:'STAT',x2:'×2 — двойная стоимость при покупке и повышении',basic:'Базовый навык (минимум 2 при создании)',none:'Ничего не найдено.',count:'навыков найдено',book:'Книга, стр. 130',note:'Краткие описания составлены для приложения; полные правила навыков — в книге. Модификаторы проверки — в разделе «Бой».'},
 en:{title:'SKILLS & DIFFICULTY',source:'PP. 128–141',intro:'Check: STAT + Skill + 1d10 vs DV; you must beat the DV, a tie fails. In an opposed check, the defender wins ties. Roll a 10: roll another 1d10 and add it; roll a 1: roll another 1d10 and subtract it.',dvTitle:'DV ladder',odds:'Chance to succeed',base:'STAT + Skill + modifiers',dv:'DV',search:'Find a skill or STAT',all:'All groups',skill:'Skill',stat:'STAT',x2:'×2 — double cost to buy and raise',basic:'Basic skill (at least 2 at creation)',none:'Nothing found.',count:'skills',book:'Corebook p. 130',note:'Summaries are written for this app; full skill rules are in the Corebook. Check modifiers are in the Combat view.'}
};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function countText(n,l){return l==='ru'?'Найдено: '+n:n+' '+T.en.count}
let query='',group='all',oddsBase=12;
function filter(q,g){q=String(q??'').trim().toLowerCase();return SKILLS.filter(s=>(g==='all'||!Object.hasOwn(GROUPS,g)||s[1]===g)&&(!q||[s[0],s[2],s[5],s[6],s[7],GROUPS[s[1]][0],GROUPS[s[1]][1]].some(x=>x.toLowerCase().includes(q))))}
function pct(p){return p===null?'—':Math.round(p*100)+'%'}
function oddsCells(base){return DV.map(([dv])=>`<td>${pct(chance(base,dv))}</td>`).join('')}
function rows(list,l){const ru=l==='ru';if(!list.length)return `<p class="sr-empty">${esc(T[l].none)}</p>`;return `<div class="sr-table-wrap"><table class="sr-table"><thead><tr><th>${esc(T[l].skill)}</th><th>${esc(T[l].stat)}</th><th></th></tr></thead><tbody>${list.map(s=>`<tr><td><strong>${esc(ru?s[5]:s[0])}</strong>${ru?` <span class="sr-en">${esc(s[0])}</span>`:''}${s[3]===2?' <span class="badge" title="'+esc(T[l].x2)+'">×2</span>':''}${s[4]?' <span class="badge" title="'+esc(T[l].basic)+'">B</span>':''}<br><small>${esc(ru?s[6]:s[7])}</small></td><td>${esc(s[2])}</td><td><small>${esc(GROUPS[s[1]][ru?0:1])}</small></td></tr>`).join('')}</tbody></table></div><p class="sr-legend"><span class="badge">×2</span> ${esc(T[l].x2)} · <span class="badge">B</span> ${esc(T[l].basic)}</p>`}
function render(lang){
 const l=lang==='en'?'en':'ru',t=T[l],ru=l==='ru',list=filter(query,group);
 return `<section class="card skill-reference" data-sr-root data-lang="${l}"><div class="card-heading"><span>${esc(t.title)}</span><span>${esc(t.source)}</span></div><p>${esc(t.intro)}</p><div class="sr-table-wrap"><table class="sr-table sr-dv"><thead><tr><th>${esc(t.dvTitle)}</th>${DV.map(d=>`<th>${esc(ru?d[1]:d[2])}</th>`).join('')}</tr></thead><tbody><tr><td>DV</td>${DV.map(d=>`<td><strong>${d[0]}</strong></td>`).join('')}</tr><tr><td><label>${esc(t.odds)}<br><small>${esc(t.base)}</small> <input type="number" min="-10" max="40" step="1" value="${esc(oddsBase)}" data-sr-field="base" aria-label="${esc(t.base)}"></label></td>${oddsCells(oddsBase)}</tr></tbody></table></div><div class="sr-toolbar"><label class="field">${esc(t.search)}<input type="search" value="${esc(query)}" data-sr-field="query"></label><label class="field">${esc(t.all)}<select data-sr-field="group"><option value="all">${esc(t.all)}</option>${Object.entries(GROUPS).map(([k,v])=>`<option value="${k}"${group===k?' selected':''}>${esc(ru?v[0]:v[1])}</option>`).join('')}</select></label><span class="result-count" data-sr-count>${esc(countText(list.length,l))}</span></div><div data-sr-list>${rows(list,l)}</div><p class="sr-note">${esc(t.note)}</p><button class="rule-source" type="button" data-action="book-page" data-page="130">${esc(t.book)} ↗</button></section>`;
}
function handle(e,lang){
 const f=e?.target?.dataset?.srField;if(!f||!['input','change'].includes(e.type))return false;const root=e.target.closest?.('[data-sr-root]');if(!root)return false;const l=(lang||root.dataset.lang)==='en'?'en':'ru';
 if(f==='base'){const n=Number(e.target.value);if(!Number.isInteger(n)||n<-10||n>40)return true;oddsBase=n;const row=e.target.closest('tr');if(row){row.querySelectorAll('td').forEach((td,i)=>{if(i>0)td.textContent=pct(chance(n,DV[i-1][0]))})}return true}
 if(f==='query')query=String(e.target.value).slice(0,80);else if(f==='group')group=Object.hasOwn(GROUPS,e.target.value)?e.target.value:'all';else return false;
 const list=filter(query,group),box=root.querySelector('[data-sr-list]'),count=root.querySelector('[data-sr-count]');if(box)box.innerHTML=rows(list,l);if(count)count.textContent=countText(list.length,l);return true;
}
function reset(){query='';group='all';oddsBase=12}
if(typeof document!=='undefined'&&document.addEventListener){for(const type of ['input','change'])document.addEventListener(type,e=>{handle(e)})}
window.SkillReference={DV,GROUPS,SKILLS,chance,filter,render,handle,reset};
})();
