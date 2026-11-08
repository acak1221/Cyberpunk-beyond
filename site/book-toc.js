/* Bilingual navigation to the supplied Corebook v1.22; printed contents p. 3. */
(function(){
'use strict';
const chapters=[
 [5,'Never Fade Away','Never Fade Away',[]],
 [17,'Взгляд с края','View from the Edge',[[22,'Основы настольной ролевой игры','A Tabletop RPG Primer'],[24,'Уличный сленг','Streetslang']]],
 [27,'Душа и новая машина','Soul and the New Machine',[[29,'Роли','Roles'],[40,'Три способа создания персонажа','The Three Methods of Making a Character']]],
 [43,'Истории улиц','Tales from the Street',[]],
 [71,'Подготовка к будущему','Fitted for the Future',[[72,'Что такое характеристики?','What are Statistics?'],[81,'Навыки','Skills'],[91,'Оружие и броня','Weapons and Armor'],[99,'Твой облик','Your Outfit']]],
 [107,'Кибернетика и панк','Putting the Cyber into the Punk',[[108,'Киберпсихоз','Cyberpsychosis'],[110,'Киберимпланты','Cyberware']]],
 [121,'Падение башен','The Fall of the Towers',[]],
 [125,'За дело','Getting it Done',[[126,'Описание сцены','Getting the Scene Down'],[128,'Решение действий с помощью навыков','Resolving Actions with Skills'],[130,'Список навыков','Skill List'],[142,'Способности ролей','Role Abilities'],[143,'Несколько ролей','Multiclassing Roles']]],
 [167,'Пятничная перестрелка','Friday Night Firefight',[[168,'Боевое время','In Combat Time'],[168,'Действия','Actions'],[170,'Дальний бой','Ranged Combat'],[175,'Ближний бой','Melee Combat'],[180,'Другие источники вреда','Other Ways to Get Hurt'],[182,'Перед получением урона','Before You Take Damage'],[186,'Когда броня не спасает','When Armor Doesn\'t Cut It'],[189,'Транспортный бой','Vehicle Combat'],[193,'Репутация','Reputation']]],
 [195,'Нетраннинг','Netrunning',[[197,'Действия в NET','Doing Things in the NET'],[201,'NET-бой','Net Combat'],[201,'Программы','Programs'],[208,'Прочие улучшения','Miscellaneous Upgrades'],[208,'Hardware кибердеки','Cyberdeck Hardware'],[209,'Проведение нетранна','Doing a Netrun'],[209,'Создание NET-архитектуры','Building a NET Architecture']]],
 [219,'Trauma Team','Trauma Team',[[220,'Состояния ранений и критические травмы','Wound States and Critical Injuries'],[222,'Стабилизация и лечение','Stabilization and Healing'],[223,'Trauma Team','Trauma Team'],[227,'Уличные наркотики','Street Drugs'],[229,'Терапия и ты','Therapy and You'],[230,'Киберпсихоз','Cyberpsychosis']]],
 [233,'Добро пожаловать в тёмное будущее','Welcome to the Dark Future',[[234,'Падение Америки','The Fall of America'],[236,'Отсчёт тёмного будущего','Dark Future Countdown'],[242,'До Времени Красного','Before the Red'],[251,'Четвёртая корпоративная война','The 4th Corp War']]],
 [257,'Время Красного','The Time of the Red',[[258,'Последствия','The Aftermath'],[258,'США во Время Красного','The U.S. in the Time of the Red'],[260,'Мир за пределами США','The World Beyond'],[264,'Неокорпорации','The Neocorps'],[267,'Корпорации','Corporate Profiles']]],
 [283,'Добро пожаловать в Найт-Сити','Welcome to Night City',[[284,'Немного истории Найт-Сити','A Bit of Night City History'],[288,'Найт-Сити в 2020 году','Night City in 2020'],[291,'Найт-Сити: наконец счастье?','Night City, Happy at Last?'],[295,'Найт-Сити во Время Красного','Night City in the Time of the Red'],[300,'Подробности','Particulars'],[304,'Жители','People of Night City'],[308,'Банды','Gangs of Night City'],[310,'Важные места в Найт-Сити и его окрестностях','Key Places in and Around Night City']]],
 [315,'Повседневная жизнь','Everyday Life',[[316,'Как избежать неприятностей','Staying out of Trouble'],[319,'Как поддерживать связь','How You Stay in Touch'],[321,'Что у тебя при себе','What You\'re Packing'],[322,'Как ты передвигаешься','How You Get Around'],[326,'Как ты узнаёшь новости','How You Get the Word'],[327,'Что ты носишь','What You Wear'],[328,'Что ты ешь','What You Eat'],[329,'Как ты развлекаешься','How You Have Fun'],[331,'Где ты достаёшь вещи','Where You Get Stuff']]],
 [333,'Новая уличная экономика','The New Street Economy',[[337,'Ночные рынки','Night Markets'],[340,'Каталог ночного рынка','Night Market Appendix'],[381,'Как зарабатывать в мире Cyberpunk','Making a Living in a Cyberpunk World']]],
 [387,'Как вести Cyberpunk','Running Cyberpunk',[[395,'Beat Charts','Beat Charts'],[408,'Развитие персонажа','Getting Better'],[412,'Противники','Mooks and Grunts'],[417,'Случайные встречи','Encounters in the Red']]],
 [425,'Выпуски новостей','Screamsheets',[]],
 [435,'Black Dog','Black Dog',[]]
];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(lang){const ru=lang!=='en',label=ru?'СОДЕРЖАНИЕ КНИГИ':'BOOK CONTENTS',page=ru?'стр.':'p.';return `<details class="card book-toc"><summary>${label}</summary><p>${ru?'Переход к печатной странице выбранного PDF.':'Jump to a printed page in the selected PDF.'}</p><div class="book-toc-grid">${chapters.map(([n,r,e,sub])=>`<section><button type="button" data-book-action="toc" data-page="${n}">${esc(ru?r:e)} <span>${page} ${n}</span></button>${sub.length?`<ul>${sub.map(([p,sr,se])=>`<li><button type="button" data-book-action="toc" data-page="${p}">${esc(ru?sr:se)} <span>${page} ${p}</span></button></li>`).join('')}</ul>`:''}</section>`).join('')}</div></details>`}
window.BookToc={chapters,render};
})();
