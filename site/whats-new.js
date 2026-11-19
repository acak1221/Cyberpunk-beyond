/* «Что нового» and «Сообщить об ошибке».

   What is new. A page (#/news) that lists the releases, newest first, in our own words. A quiet red dot on the menu item
   and on the phone's «Ещё» button says that something was added since the last visit; opening the page removes it. The
   number of the newest release the player has seen is kept in this browser only (localStorage), apart from the archive:
   it is not in backups, exports or rooms.

   HOW TO ADD A RELEASE. Add a line to RELEASES[0].items while that release is still being put together, or put a new
   entry at the top with the next number (n + 1). Never renumber and never reorder: the numbers are what the «seen» mark
   stores. Every title and item needs both languages.

   Report a problem. The button opens a dialog that shows, word for word, the draft of a GitHub issue, and a link that
   carries exactly that text. The draft holds the app version, the look, the language and a short browser name, and nothing
   else. This module does not read the address of the page (a sheet id lives there), the saved archive, the app state or
   any other stored value, so characters, campaigns, notes and room codes cannot end up in the report. The raw user agent
   is not sent either: it names the phone model. Nothing leaves the device until the player presses the link, and then it
   is GitHub's own page where they decide whether to submit. */
(function(global){
'use strict';
const doc=global.document;
const APP_VERSION='2.0';
const REPO='https://github.com/acak1221/Cyberpunk-beyond',ISSUE_URL=REPO+'/issues/new';
const KEY='nc-news-seen',ARCHIVE_KEY='nightcity-red-v1';
const BODY_MAX=800,URL_MAX=2000;

const RELEASES=[
 {n:15,date:'2026-11-20',title:{ru:'Восстановление архивов и бой в комнате',en:'Archive restores and room combat'},items:[
  {ru:'Отмена восстановления архива возвращает прежние версии ваших предметов и противников вместе с персонажами. Повторный перенос той же кампании с жетонами на карте сохраняет одну копию.',en:'Undoing an archive restore brings back your previous custom items and opponents along with your characters. Importing the same campaign with map tokens again keeps a single copy.'},
  {ru:'Игрок в комнате получает тот же критический урон, что и на локальном листе. Если игрок обновит инициативу после ничьей, текущий участник сохранит ход.',en:'A player in a room takes the same critical damage as on a local sheet. Updating initiative after a tie keeps the turn with the current participant.'}
 ]},
 // Release 14 is the new shell: navigation, home, settings and the sheet, combat and tools in one look.
 {n:14,date:'2026-11-16',title:{ru:'Новая оболочка',en:'A new shell'},items:[
  {ru:'Главная начинается с «Продолжить»: последний персонаж, кампания с текущим ходом и комната. Внизу — Главная, Персонажи, Бой, Кубики и «Ещё» со всеми разделами.',en:'Home starts with Continue: your last character, the campaign with the current turn and the room. The bottom bar has Home, Characters, Combat, Dice and More with every section.'},
  {ru:'Поиск и команды по Ctrl+K или кнопке вверху, быстрые кубики на любом экране и компактная плашка результата с «Подробнее» и «Повторить».',en:'Search and commands with Ctrl+K or the top button, quick dice on any screen and a compact result chip with Details and Again.'},
  {ru:'Все настройки на одной странице за шестерёнкой: вид, тема (есть чёрная), язык, роль, звук, сила вибрации, копии, память и очистка данных. Шрифты встроены в приложение.',en:'All settings live on one page behind the gear: look, theme (with a black one), language, role, sound, vibration strength, backups, storage and data erase. Fonts are built into the app.'},
  {ru:'Лист: компактная шапка, один блок здоровья с отменой, полоса быстрых бросков, подробности числа по нажатию на характеристику или навык, группировка навыков.',en:'Sheet: a compact header, one health pad with undo, a quick-rolls rail, the breakdown of a number on tap and grouping of Skills.'},
  {ru:'Бой как стол: раунд, кто ходит, «Следующий ход», группы противников с одним броском инициативы, быстрый бой без кампании. Удалённая кампания лежит в корзине.',en:'Combat as a table: the round, who acts, Next turn, groups of opponents with one initiative roll and a quick combat without a campaign. A deleted campaign goes to the bin.'},
  {ru:'Персонажи: карточки, выбор нескольких с отменой, менеджер папок, создание в три экрана, заметки, цели, контакты и портрет с кадрированием и аватаром.',en:'Characters: richer cards, multi-select with undo, a folder manager, creation in three screens, notes, goals, contacts and a portrait with cropping and an avatar.'},
  {ru:'Снаряжение: качество и модули оружия, слоты киберимплантов, гараж с SDP машин. Ведущему: часы-пул и обратный отсчёт, генератор NET, стол по вкладкам.',en:'Gear: weapon quality and attachments, cyberware slots and a garage with vehicle SDP. For the GM: pool and countdown clocks, a NET generator and a tabbed table.'},
  {ru:'Комната: код и ссылку можно скрыть на экране, а список серверов меняется в самом приложении.',en:'Rooms: the code and link can be hidden on screen, and the server list is edited in the app itself.'}
 ]},
 // Release 12 is the role switch; the Netrunner interface is a release of its own.
 {n:13,date:'2026-11-16',title:{ru:'Нетраннеру: дека, пульт, забег',en:'For netrunners: deck, console, run'},items:[
  {ru:'Дека как стойка слотов: ячейка на слот, выбор программы по классам, а установка и снятие отменяются кнопкой «Отменить».',en:'The cyberdeck as a rack of slots: a cell per slot, programs picked by class, and installing or removing can be undone with one button.'},
  {ru:'Пульт рана: «Войти в сеть» и «Выйти из сети», счётчик NET-действий и девять способностей, на каждой кнопке готовый итог броска.',en:'A run console: Jack In and Jack Out, the NET Action counter and nine abilities, each button showing the total it will roll.'},
  {ru:'Атака программой с уроном и «Входящий урон» для мозга и программ: до применения видно, что изменится, и всё отменяется.',en:'Attacking with a program and incoming damage for the brain and for programs: you see what will change before it is applied, and it can be undone.'},
  {ru:'Эффекты программ: скорость в сети, строка «Что сейчас меняет числа», метка −1 NET-действие и состояние «Уничтожена».',en:'Program effects: net speed, a “What changes the numbers now” strip, a −1 NET Action marker and a “Destroyed” state.'},
  {ru:'Связь с архитектурой: ведущий привязывает нетраннера на столе #/net, а в комнате показывает ему только открытые этажи, зашифровав для него одного.',en:'Link to the architecture: the GM ties a netrunner to the #/net desk, and in a room shows them only the revealed floors, encrypted for that one person.'}
 ]},
 // Release 11 already holds the most lines a release may (eight), so the role switch is a release of its own.
 {n:12,date:'2026-11-16',title:{ru:'Роль: игрок или ведущий',en:'Role: player or Game Master'},items:[
  {ru:'Роль «Игрок / Ведущий»: переключатель в меню убирает инструменты ведущего из меню игрока, а ведущему ставит их первыми. Экраны ведущего открываются по прямой ссылке в любой роли; данные не меняются.',en:'Player / Game Master role: a menu switch hides the GM tools from the player menu and puts them first for a GM. GM screens still open from a direct link in either role, and your data does not change.'}
 ]},
 // Release 10 went out with only five of its lines written. Its number was already stored as «seen» in browsers by then,
 // so the rest is a release of its own: the dot comes back for those who had read the short list.
 {n:11,date:'2026-11-15',title:{ru:'Папки, свои таблицы, карта города',en:'Folders, your own tables, a city map'},items:[
  {ru:'Папки и метки персонажей: на странице «Персонажи» листы раскладываются по папкам, отмечаются своими метками и ищутся по имени.',en:'Folders and tags for characters: on the Characters page, sheets go into folders, take your own tags and are found by name.'},
  {ru:'Именованные модификаторы: свои прибавки и штрафы с названием включаются одним касанием рядом с кнопками бросков и могут быть привязаны к вещи.',en:'Named modifiers: your own named bonuses and penalties switch on with one tap next to the roll buttons and can be tied to an item.'},
  {ru:'Группы предметов: вещи и оружие раскладываются по своим группам, группа сворачивается, а её броня надевается или снимается одной кнопкой.',en:'Item groups: gear and weapons go into groups of your own, a group folds away, and its armor goes on or off with one button.'},
  {ru:'Ведущему: свои таблицы бросков с проверкой диапазонов и NPC по шагам — архетип, уровень угрозы, правки и копии сразу в трекер.',en:'For the GM: your own roll tables with a check of the ranges, and a step-by-step NPC builder: archetype, threat level, tweaks, and copies straight into the tracker.'},
  {ru:'Часы с триггерами: напоминания на выбранном сегменте, бросок кубика для заполнения и ход часов с каждым раундом боя.',en:'Clocks with triggers: reminders at a chosen segment, a die roll to fill the clock, and clocks that advance with every combat round.'},
  {ru:'Редактор NET-архитектуры: этажи карточками в виде дерева, перенос веток кнопками и режим «Проход» по этажам.',en:'A NET architecture editor: floors as cards in a tree, branches moved with buttons, and a run mode that walks the floors.'},
  {ru:'В комнатах: ведущий выбирает, что игроки видят в списке инициативы, и ведёт ленту «Агент» — заказы, новости, розыск, события и места.',en:'In rooms: the GM chooses what players see in the initiative list and runs the Agent feed: jobs, news, wanted notices, events and places.'},
  {ru:'Карта города в кампании: своя картинка остаётся в этом браузере, на ней метки, маршрут и место группы; выбранное можно показать игрокам.',en:'A city map for a campaign: your own picture stays in this browser and carries pins, a route and the crew’s position; chosen pins can be shown to players.'},
 ]},
 {n:10,date:'2026-11-14',title:{ru:'Зал ожидания, инвентарь карточками, звук кубиков',en:'Waiting room, inventory cards, dice sound'},items:[
  {ru:'Зал ожидания в комнатах: ведущий сам впускает каждое устройство, а комната шифруется вторым ключом, который получают только впущенные.',en:'A waiting room for online rooms: the GM lets each device in by hand, and the room is encrypted with a second key that only admitted devices get.'},
  {ru:'Инвентарь карточками: всё имущество одним списком, с фильтрами по типам и действием прямо на карточке.',en:'Inventory as cards: everything a character owns in one list, with type filters and the action right on the card.'},
  {ru:'Звук кубиков создаётся на устройстве, без аудиофайлов. На странице «Кубики» включается бросок встряхиванием телефона.',en:'Dice sound is made on the device, with no audio files. The Dice page has a switch for rolling by shaking the phone.'},
  {ru:'Генератор имён и позывных рядом с полем имени в мастерах создания и в формах NPC.',en:'A name and handle generator next to the name field in the builders and in the NPC forms.'},
  {ru:'Эта страница и кнопка «Сообщить об ошибке»: в заготовку попадают только версия, оформление, язык и браузер.',en:'This page and the “Report a problem” button: the draft holds only the version, look, language and browser.'},
 ]},
 {n:9,date:'2026-11-13',title:{ru:'Правки после игр за столом',en:'Fixes after real sessions'},items:[
  {ru:'Шёпот в комнате: личные сообщения между ведущим и игроком и тайные проверки навыков.',en:'Whispers in a room: private messages between the GM and a player, and secret skill checks.'},
  {ru:'Ведущий выдаёт игроку урон, лечение, деньги, IP или предмет, а игрок применяет это одним нажатием.',en:'The GM hands a player damage, healing, money, IP or an item, and the player applies it with one tap.'},
  {ru:'Игровая дата в кампании, союзники и добыча в трекере, учёт доз.',en:'An in-game date for a campaign, allies and loot in the tracker, dose tracking.'},
  {ru:'В оформлении «Досье» появились вкладки действий, особенностей и персонажа.',en:'The Dossier look got tabs for actions, features and the character.'},
 ]},
 {n:8,date:'2026-11-10',title:{ru:'Десять возможностей',en:'Ten features'},items:[
  {ru:'Перенос архива файлом или с устройства на устройство по коду, напоминание о резервной копии.',en:'Moving the archive as a file or from device to device by a code, and a backup reminder.'},
  {ru:'Лист для печати и PDF, краткая карточка персонажа для ведущего.',en:'A sheet for print and PDF, and a short character card for the GM.'},
  {ru:'Первый запуск: знакомство, персонаж-пример и пробный бой.',en:'First run: an introduction, a sample character and a practice fight.'},
  {ru:'Карта боя, связанная с трекером; экспорт и импорт кампании.',en:'A battle map tied to the tracker; campaign export and import.'},
  {ru:'Свои предметы, импланты и противники.',en:'Your own items, cyberware and enemies.'},
  {ru:'В комнатах: передача роли ведущего, со-ведущий, журнал для игроков.',en:'In rooms: handing over the GM role, a co-GM, a journal for players.'},
 ]},
 {n:7,date:'2026-11-10',title:{ru:'Магазин с корзиной',en:'A shop with a cart'},items:[
  {ru:'В каталоге видны деньги покупателя, покупки собираются в корзину и оплачиваются одним действием.',en:'The catalog shows the buyer’s money; purchases go into a cart and are paid for in one step.'},
 ]},
 {n:6,date:'2026-11-10',title:{ru:'Оформление «Досье»',en:'The Dossier look'},items:[
  {ru:'Лист в виде планшета персонажа: ряд характеристик, состояние и навыки отдельными колонками, панель с вкладками справа.',en:'The sheet as a character board: a row of stats, status and skills in their own columns, a tabbed panel on the right.'},
  {ru:'На телефоне те же разделы открываются вкладками.',en:'On a phone the same sections open as tabs.'},
 ]},
 {n:5,date:'2026-11-10',title:{ru:'Скорость и доступность',en:'Speed and accessibility'},items:[
  {ru:'Каталог не подвисает при вводе, а бросок навыка обновляет лист на месте.',en:'The catalog no longer stalls while typing, and a skill roll updates the sheet in place.'},
  {ru:'Кнопки бросков получили названия для программ чтения с экрана, фокус остаётся на месте после действия.',en:'Roll buttons have spoken names for screen readers, and the focus stays put after an action.'},
  {ru:'Обычное оформление больше не загружает шрифты со стороннего адреса.',en:'The default look no longer loads fonts from another site.'},
 ]},
 {n:4,date:'2026-11-10',title:{ru:'Комнаты: подписи и ключ ведущего',en:'Rooms: signatures and the GM key'},items:[
  {ru:'Сообщения подписаны ключом устройства: выдать себя за другого участника нельзя.',en:'Messages are signed with the device key, so nobody can pose as another member.'},
  {ru:'Инициатива, счётчики и листы принимаются только от ведущего, привязанного к ключу из ссылки.',en:'Initiative, counters and sheets are accepted only from the GM, who is tied to the key in the link.'},
  {ru:'Скрытые противники, сигнал «Ваш ход», текущие HP игроков в трекере ведущего.',en:'Hidden enemies, a “Your turn” signal, players’ current HP in the GM tracker.'},
 ]},
 {n:3,date:'2026-11-10',title:{ru:'Правила считаются сами',en:'Rules that apply themselves'},items:[
  {ru:'Критические ранения, установленные импланты и уличные наркотики сами учитываются в бросках, MOVE и инициативе.',en:'Critical injuries, installed cyberware and street drugs are counted in rolls, MOVE and initiative on their own.'},
  {ru:'Трекер знает состояния ранения, спасбросок от смерти и урон сквозь броню для противников.',en:'The tracker knows wound states, the Death Save and damage through armor for enemies.'},
  {ru:'Репутация и «Лицом к лицу» (Facedown) на листе.',en:'Reputation and Facedown on the sheet.'},
 ]},
 {n:2,date:'2026-11-10',title:{ru:'Удобство за столом',en:'Comfort at the table'},items:[
  {ru:'Кнопки бросков показывают настоящую прибавку; модификатор, LUCK и DV задаются рядом и действуют на следующий бросок.',en:'Roll buttons show the real bonus; the modifier, LUCK and DV are set next to them and apply to the next roll.'},
  {ru:'Быстрое изменение HP, «режим игры» и переключатель «Не гасить экран».',en:'Quick HP changes, a play mode and a “Keep the screen on” switch.'},
  {ru:'Трекер для телефона, покупка и жизненный путь прямо с листа.',en:'A tracker made for phones; shopping and the lifepath right from the sheet.'},
 ]},
 {n:1,date:'2026-11-10',title:{ru:'Защита данных',en:'Data protection'},items:[
  {ru:'Повреждённые записи откладываются и не мешают остальным; есть резервные копии.',en:'Damaged records are set aside and leave the rest working; there are backups.'},
  {ru:'Корзина на 30 дней и отмена для удалённого.',en:'A 30-day bin and undo for what was deleted.'},
  {ru:'Импорт спрашивает перед заменой и сохраняет прежнюю версию.',en:'Import asks before replacing and keeps the previous version.'},
 ]},
];

const T={
 ru:{title:'Что нового',over:'ПРИЛОЖЕНИЕ / ВЫПУСКИ',lead:'Что изменилось в помощнике, от новых выпусков к старым. Сейчас у вас версия {v}.',fresh:'Новое',unread:'есть новое',report:'Сообщить об ошибке',reportLead:'Нашли ошибку или чего-то не хватает? Напишите об этом на GitHub: приложение подставит только версию, оформление, язык и браузер.',dlgLead:'Откроется страница нового обращения в репозитории проекта на GitHub. Понадобится вход на GitHub. Пока вы сами не нажмёте там кнопку отправки, ничего не отправится.',sent:'Вот всё, что приложение передаст:',previewName:'Текст обращения',never:'Персонажи, кампании, заметки и адрес открытой страницы сюда не попадают. Обращения на GitHub видны всем: не прикладывайте файлы персонажей и снимки экрана с личными данными.',offline:'Сейчас нет сети. Скопируйте текст и отправьте его позже.',go:'Открыть GitHub',newTab:'(в новой вкладке)',copy:'Скопировать текст',cancel:'Отмена',copied:'Текст скопирован.',copyFailed:'Выделите текст и скопируйте его вручную.',issueTitle:'Ошибка: ',what:'Что произошло',whatHint:'(опишите здесь)',steps:'Как повторить',envHead:'Окружение',envBy:'(добавлено приложением)',version:'Версия',release:'выпуск',build:'сборка',look:'Оформление',language:'Язык',browser:'Браузер'},
 en:{title:'What’s new',over:'APP / RELEASES',lead:'What has changed in the companion, newest first. You are on version {v}.',fresh:'New',unread:'new',report:'Report a problem',reportLead:'Found a bug, or is something missing? Write about it on GitHub: the app fills in only the version, look, language and browser.',dlgLead:'A new-issue page in the project’s GitHub repository will open. You will need to sign in to GitHub. Nothing is sent until you press the submit button there yourself.',sent:'This is everything the app passes on:',previewName:'Issue text',never:'Characters, campaigns, notes and the address of the open page are not included. GitHub issues are public: do not attach character files or screenshots with personal details.',offline:'There is no network right now. Copy the text and send it later.',go:'Open GitHub',newTab:'(in a new tab)',copy:'Copy the text',cancel:'Cancel',copied:'The text is copied.',copyFailed:'Select the text and copy it by hand.',issueTitle:'Bug: ',what:'What happened',whatHint:'(describe here)',steps:'How to repeat it',envHead:'Environment',envBy:'(added by the app)',version:'Version',release:'release',build:'build',look:'Look',language:'Language',browser:'Browser'},
};
// The same names as the appearance switch at the bottom of the menu.
const LOOKS={native:{ru:'Обычное',en:'Clean'},board:{ru:'Досье',en:'Dossier'},cyber:{ru:'Киберпанк',en:'Cyberpunk'}};
const THEMES={dark:{ru:'тёмная тема',en:'dark theme'},light:{ru:'светлая тема',en:'light theme'}};
const L=lang=>lang==='en'?'en':'ru';
const t=(lang,k)=>T[L(lang)][k]??k;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=k=>{try{return global.localStorage?.getItem(k)??null}catch{return null}};
const write=(k,v)=>{try{global.localStorage?.setItem(k,v)}catch{}};

/* ---------- What has been seen ---------- */
const latest=()=>RELEASES[0].n;
/* The first time this version runs there is no mark yet. Somebody who already has saved data gets the newest release
   pointed out; a brand-new player gets no dot, since everything is new to them. Only the presence of the archive is
   checked, its contents are never read. A stored number that is not a small whole number counts as no mark; one above
   the newest release (an older copy of the app opened after a newer one) means there is nothing unread. */
let known=(()=>{
 const raw=read(KEY);
 if(typeof raw==='string'&&/^\d{1,4}$/.test(raw))return Math.min(latest(),Number(raw));
 const first=read(ARCHIVE_KEY)===null?latest():latest()-1;
 write(KEY,String(first));return first;
})();
// Entries newer than this keep their «Новое» tag until the page is reloaded, though the dot goes at once.
let shownFrom=null;
/* Another tab of the same browser may have opened the page since this one loaded. The stored mark is read again each
   time it is asked for (one getItem), and the mark only ever moves forward, so a dot never comes back by itself. */
function sync(){const raw=read(KEY);if(typeof raw==='string'&&/^\d{1,4}$/.test(raw))known=Math.max(known,Math.min(latest(),Number(raw)));return known}
const seen=()=>sync();
const unread=()=>Math.max(0,latest()-sync());
function markSeen(){if(sync()===latest())return false;known=latest();write(KEY,String(known));return true}
// The dot alone is for places that are hidden from screen readers (the icon of the «Ещё» button); the words go beside it.
const dot=()=>unread()?'<span class="wn-dot" aria-hidden="true"></span>':'';
const note=lang=>unread()?`<span class="wn-sr"> (${esc(t(lang,'unread'))})</span>`:'';
const marker=lang=>dot()+note(lang);
/* On a wide screen the menu item is the last one in the menu and can be below the fold, so the top bar, which is always
   on screen, gets a small link while something is unread. A phone has the dot on «Ещё» instead (see the stylesheet). */
const pill=lang=>unread()?`<button type="button" class="wn-pill" data-action="navigate" data-view="news"><span class="wn-dot" aria-hidden="true"></span><span>${esc(t(lang,'title'))}</span>${note(lang)}</button>`:'';

/* ---------- The page ---------- */
// Dates are written out by hand, so they read the same in every browser and time zone.
function dateText(lang,iso){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);return m?(L(lang)==='ru'?`${m[3]}.${m[2]}.${m[1]}`:`${m[3]}/${m[2]}/${m[1]}`):''}
function page(lang){
 lang=L(lang);
 if(shownFrom===null)shownFrom=sync();
 // Reading the page is what «seen» means; this runs before the menu is drawn, so the dot is gone in the same paint.
 markSeen();
 const list=RELEASES.map(r=>`<section class="card wn-release" data-wn-release="${r.n}"><div class="wn-release-head"><h2>${esc(r.title[lang])}</h2>${r.n>shownFrom?`<span class="wn-new">${esc(t(lang,'fresh'))}</span>`:''}<time datetime="${esc(r.date)}">${esc(dateText(lang,r.date))}</time></div><ul>${r.items.map(i=>`<li>${esc(i[lang])}</li>`).join('')}</ul></section>`).join('');
 return `<div class="page-header"><div><div class="overline">${esc(t(lang,'over'))}</div><h1>${esc(t(lang,'title'))}</h1><p>${esc(t(lang,'lead').replace('{v}',APP_VERSION))}</p></div><div class="header-actions"><button type="button" class="btn ghost" data-wn-report="top">${esc(t(lang,'report'))}</button></div></div><div class="wn-list">${list}</div><section class="card wn-report-card"><p>${esc(t(lang,'reportLead'))}</p><button type="button" class="btn primary" data-wn-report="bottom">${esc(t(lang,'report'))}</button></section>`;
}

/* ---------- What the report says about the device ---------- */
/* Every value below is either picked from a fixed list or checked against a strict pattern before it can reach the link,
   so an odd browser string cannot smuggle markup or a device model into it. */
const BRANDS={'Google Chrome':'Chrome','Microsoft Edge':'Edge','Opera':'Opera','Brave':'Brave','Vivaldi':'Vivaldi','Samsung Internet':'Samsung Internet','YaBrowser':'Yandex','Chromium':'Chromium'};
const UA_NAMES=[[/Edg(?:e|A|iOS)?\/(\d{1,4})/,'Edge'],[/OPR\/(\d{1,4})/,'Opera'],[/YaBrowser\/(\d{1,4})/,'Yandex'],[/SamsungBrowser\/(\d{1,4})/,'Samsung Internet'],[/(?:Firefox|FxiOS)\/(\d{1,4})/,'Firefox'],[/(?:Chrome|CriOS)\/(\d{1,4})/,'Chrome'],[/Version\/(\d{1,4})\S* .*Safari\//,'Safari']];
function browserName(nav){
 let out='';
 try{
  const brands=nav?.userAgentData?.brands;
  if(Array.isArray(brands)){
   const real=brands.filter(b=>typeof b?.brand==='string'&&Object.hasOwn(BRANDS,b.brand)&&/^\d{1,4}(\.|$)/.test(String(b.version??'')));
   const pick=real.find(b=>b.brand!=='Chromium')||real[0];
   if(pick)out=BRANDS[pick.brand]+' '+parseInt(pick.version,10);
  }
  if(!out){const ua=String(nav?.userAgent??'').slice(0,600);for(const [re,name] of UA_NAMES){const m=re.exec(ua);if(m){out=name+' '+Number(m[1]);break}}}
 }catch{out=''}
 return /^[A-Za-z][A-Za-z ]{1,24} \d{1,4}$/.test(out)?out:'unknown';
}
function osName(nav){
 try{
  const ua=String(nav?.userAgent??'').slice(0,600);
  if(/Android/.test(ua))return 'Android';
  // An iPad says it is a Mac; a Mac has no touch screen.
  if(/iPhone|iPad|iPod/.test(ua)||(nav?.platform==='MacIntel'&&Number(nav?.maxTouchPoints)>1))return 'iOS';
  if(/CrOS/.test(ua))return 'ChromeOS';
  if(/Windows/.test(ua))return 'Windows';
  if(/Macintosh|Mac OS X/.test(ua))return 'macOS';
  if(/Linux|X11/.test(ua))return 'Linux';
 }catch{}
 return 'unknown';
}
/* The look is read from what the page actually shows (the classes on <html>), not from the stored setting: an «auto»
   theme is reported as the one the player sees. */
function env(lang){
 const root=doc?.documentElement,has=c=>{try{return !!root?.classList?.contains?.(c)}catch{return false}};
 let build='dev';try{const b=root?.dataset?.build;if(typeof b==='string'&&/^[0-9a-f]{6,16}$/.test(b))build=b}catch{}
 const look=!has('ui-native')?'cyber':has('ui-board')?'board':'native';
 return {version:APP_VERSION,release:latest(),build,look,theme:look!=='cyber'&&has('ui-light')?'light':'dark',lang:L(lang),browser:browserName(global.navigator),os:osName(global.navigator)};
}
// The draft is rebuilt from known fields only, so a caller cannot pass anything else through it.
function draft(lang,e=env(lang)){
 lang=L(lang);
 const look=Object.hasOwn(LOOKS,e?.look)?e.look:'native',theme=e?.theme==='light'?'light':'dark';
 const build=/^[0-9a-f]{6,16}$/.test(String(e?.build))?e.build:'dev';
 const browser=/^[A-Za-z][A-Za-z ]{1,24} \d{1,4}$/.test(String(e?.browser))?e.browser:'unknown';
 const os=['Android','iOS','Windows','macOS','ChromeOS','Linux'].includes(e?.os)?e.os:'unknown';
 const body=[`**${t(lang,'what')}**`,t(lang,'whatHint'),'',`**${t(lang,'steps')}**`,'1. ','',`**${t(lang,'envHead')}** ${t(lang,'envBy')}`,
  `- ${t(lang,'version')}: ${APP_VERSION}, ${t(lang,'release')} ${latest()}, ${t(lang,'build')} ${build}`,
  `- ${t(lang,'look')}: ${LOOKS[look][lang]}, ${THEMES[theme][lang]}`,
  `- ${t(lang,'language')}: ${e?.lang==='en'?'en':'ru'}`,
  `- ${t(lang,'browser')}: ${browser}, ${os}`].join('\n');
 return {title:t(lang,'issueTitle'),body};
}
const previewText=d=>d.title+'\n\n'+d.body;
// Only the two fields GitHub prefills. Should the text ever outgrow what a link can carry, the plain page opens instead.
function issueUrl(d){
 const title=String(d?.title??''),body=String(d?.body??'');
 if(body.length>BODY_MAX)return ISSUE_URL;
 const url=ISSUE_URL+'?title='+encodeURIComponent(title)+'&body='+encodeURIComponent(body);
 return url.length>URL_MAX?ISSUE_URL:url;
}

/* ---------- The report dialog ---------- */
/* The draft is made once, when the dialog opens: the text on the screen, the text that is copied and the text in the
   link are the same strings. */
function reportView(lang){
 lang=L(lang);
 const d=draft(lang),preview=previewText(d),url=issueUrl(d),offline=global.navigator?.onLine===false;
 const html=`<h2 id="wn-report-title">${esc(t(lang,'report'))}</h2><p>${esc(t(lang,'dlgLead'))}</p><p class="wn-label" id="wn-preview-label">${esc(t(lang,'sent'))}</p><pre class="wn-preview" tabindex="0" role="group" aria-labelledby="wn-preview-label">${esc(preview)}</pre><p class="wn-never">${esc(t(lang,'never'))}</p>${offline?`<p class="wn-note">${esc(t(lang,'offline'))}</p>`:''}<p class="wn-note" data-wn-status role="status" hidden></p><div class="wn-actions"><a class="btn primary" data-wn-go href="${esc(url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">${esc(t(lang,'go'))} <span aria-hidden="true">↗</span><span class="wn-sr"> ${esc(t(lang,'newTab'))}</span></a><button type="button" class="btn ghost" data-wn-copy>${esc(t(lang,'copy'))}</button><button type="button" class="btn ghost" data-wn-close>${esc(t(lang,'cancel'))}</button></div>`;
 return {html,preview,url,draft:d};
}
let current=null;
function openReport(lang,from='top'){
 if(!doc?.createElement||!doc.body)return null;
 lang=L(lang);
 for(const old of doc.querySelectorAll?.('.wn-dialog')||[])old.remove();
 const view=reportView(lang),dlg=doc.createElement('dialog');
 dlg.className='share-import wn-dialog';dlg.setAttribute('aria-labelledby','wn-report-title');dlg.innerHTML=view.html;if(dlg.dataset)dlg.dataset.lang=lang;
 doc.body.appendChild(dlg);
 const mine=current={dlg,lang,preview:view.preview,url:view.url};
 dlg.addEventListener('close',()=>{
  dlg.remove();if(current===mine)current=null;
  // The page may have been redrawn while the dialog was open, so the button is looked up again. On another screen
  // there is no such button: the focus goes to the content, where the app puts it after any change of screen.
  (doc.querySelector?.(`[data-wn-report="${from==='bottom'?'bottom':'top'}"]`)||doc.querySelector?.('[data-wn-report]')||doc.querySelector?.('#main-content'))?.focus?.();
 });
 if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');
 return mine;
}
function closeReport(){const dlg=current?.dlg;if(!dlg)return;if(typeof dlg.close==='function')dlg.close();else{dlg.remove();current=null}}
function say(key){const el=current?.dlg?.querySelector?.('[data-wn-status]');if(el){el.textContent=t(current.lang,key);el.hidden=false}}
async function copyReport(){
 const mine=current;if(!mine)return false;
 try{await global.navigator.clipboard.writeText(mine.preview);if(current===mine)say('copied');return true}
 catch{
  // No clipboard (an old browser, a page without permission): select the text, so one more gesture copies it.
  try{const pre=mine.dlg.querySelector('.wn-preview'),range=doc.createRange(),sel=global.getSelection();range.selectNodeContents(pre);sel.removeAllRanges();sel.addRange(range)}catch{}
  if(current===mine)say('copyFailed');return false;
 }
}
const pageLang=()=>{try{const l=global.App?.lang?.()||doc?.documentElement?.lang;return l==='en'?'en':'ru'}catch{return 'ru'}};
doc?.addEventListener?.('click',e=>{
 const b=e.target?.closest?.('[data-wn-report],[data-wn-copy],[data-wn-close],[data-wn-go]');if(!b)return;
 if(b.matches('[data-wn-report]'))openReport(pageLang(),b.dataset?.wnReport);
 else if(b.matches('[data-wn-copy]'))copyReport();
 else if(b.matches('[data-wn-close]'))closeReport();
 // The link itself does the opening. The dialog closes a moment later: a link taken off the page mid-click goes nowhere.
 else if(b.matches('[data-wn-go]'))(global.setTimeout||(f=>f()))(closeReport,0);
});
// The dialog belongs to the «Что нового» page. If the screen changes under it (the phone's Back button, a link),
// it closes instead of staying on top of another screen.
for(const type of ['hashchange','popstate'])global.addEventListener?.(type,closeReport);

global.WhatsNew={T,t,RELEASES,APP_VERSION,REPO,KEYS:{SEEN:KEY},LIMITS:{BODY:BODY_MAX,URL:URL_MAX},latest,seen,unread,markSeen,dot,note,marker,pill,page,env,draft,previewText,issueUrl,browserName,osName,reportView,openReport,closeReport,copyReport,_test:{current:()=>current}};
})(typeof window!=='undefined'?window:globalThis);
