/* Night City reference: a launcher, not a copy of the book. Each card names a part of the city that the GM often needs
   at the table (corporations, people, gangs, places, the news, prices, the Night Market, rumors, factions) and opens the
   book at the page where it is. Nothing from the book is reproduced here; the short lines are our own. The two cards that
   hold the GM's own data (factions, rumors) are the cards of factions.js and rumors.js: on this page they are drawn when
   asked for (opts.cards), inside the GM hub they already sit in the World tab and this page only points to them.
   Pages are the ones already used in the repository (book-toc.js, book-tables.js, lifestyle-tools.js, night-market.js). */
(function(global){
'use strict';
// id, title, own one-line description, [page, label] jumps, optional shortcut to a tool of the GM hub.
const SECTIONS=Object.freeze([
 {id:'overview',ru:'Обзор города',en:'The city at a glance',dru:'История и устройство города: с чего начать, если нужно быстро войти в тему.',den:'History and layout of the city: where to start when you need to get into the subject fast.',
  pages:[[284,'История','History'],[288,'Город в 2020','The city in 2020'],[295,'Время Красного','Time of the Red'],[300,'Подробности','Particulars']]},
 {id:'corporations',ru:'Корпорации',en:'Corporations',dru:'Кто стоит за вывесками и чьи интересы затронет команда.',den:'Who is behind the signs and whose interests the crew may touch.',
  pages:[[267,'Профили корпораций','Corporate profiles'],[264,'Неокорпорации','Neocorps']],go:['factions','Фракции кампании','Campaign factions']},
 {id:'people',ru:'Люди города',en:'People of the city',dru:'Кто живёт в городе и кого можно встретить на улице.',den:'Who lives in the city and who you can meet on the street.',pages:[[304,'Жители','People']],go:['library','Библиотека NPC','NPC library']},
 {id:'gangs',ru:'Банды',en:'Gangs',dru:'Уличные группировки и их территории.',den:'Street groups and their turf.',pages:[[308,'Банды города','Gangs']],go:['factions','Фракции кампании','Campaign factions']},
 {id:'places',ru:'Места',en:'Places',dru:'Важные места в городе и вокруг него.',den:'Important places in and around the city.',pages:[[310,'Важные места','Key places']]},
 {id:'news',ru:'Новости и заголовки',en:'News and headlines',dru:'Скримшиты и случайные заголовки для сцены.',den:'Screamsheets and random headlines for a scene.',pages:[[326,'Таблица заголовков','Headline table'],[425,'Выпуски новостей','Screamsheets']],go:['random','Бросить заголовок','Roll a headline']},
 {id:'prices',ru:'Цены и жильё',en:'Prices and housing',dru:'Сколько стоит образ жизни и крыша над головой.',den:'What a lifestyle and a roof cost.',pages:[[377,'Образ жизни и жильё','Lifestyle and housing'],[331,'Где достать вещи','Where to get things']]},
 {id:'market',ru:'Ночной рынок',en:'Night Market',dru:'Лавки и товары для сцены на рынке.',den:'Stalls and goods for a market scene.',pages:[[337,'Ночные рынки','Night markets'],[340,'Каталог рынка','Market catalog']],go:['market','Набрать рынок','Stock a market']},
 {id:'rumors',ru:'Слухи',en:'Rumors',dru:'Ваши слухи с пометкой правды; можно отдать игрокам как новость.',den:'Your own rumors with a truth mark; hand one to the players as news.',pages:[],go:['rumors','Открыть слухи','Open rumors']}
]);
const PAGES=Object.freeze([...new Set(SECTIONS.flatMap(s=>s.pages.map(p=>p[0])))].sort((a,b)=>a-b));
const T={
 ru:{title:'ГОРОД',sub:'СПРАВОЧНИК НАЙТ-СИТИ',intro:'Куда заглянуть в книге, когда игроки идут в город. Кнопки открывают нужную страницу; свои данные (фракции, слухи) лежат рядом.',page:'Книга, стр.',sections:'Разделы справочника'},
 en:{title:'CITY',sub:'NIGHT CITY REFERENCE',intro:'Where to look in the book when the players head into the city. The buttons open the page; your own data (factions, rumors) sits next to it.',page:'Book p.',sections:'Reference sections'}
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lg=l=>l==='en'?'en':'ru';
function card(s,l,withGo){
 const i=l==='en'?1:0,t=T[l];
 const jumps=s.pages.map(p=>`<button type="button" class="rule-source nc-jump" data-action="book-page" data-page="${p[0]}">${esc(p[1+i])} · ${p[0]} ↗</button>`).join('');
 const go=withGo&&s.go?`<button type="button" class="btn ghost nc-go" data-gmh-go="${esc(s.go[0])}">${esc(s.go[1+i])}</button>`:'';
 return `<article class="nc-card" data-nc-card="${esc(s.id)}"><h3>${esc(l==='en'?s.en:s.ru)}</h3><p>${esc(l==='en'?s.den:s.dru)}</p><div class="nc-actions">${jumps}${go}</div></article>`;
}
/* opts.cards: also draw the factions and rumors cards under the launcher (the #/city page).
   opts.go: shortcut buttons into the tabs of the GM hub (default true; the standalone page passes false, since
   without the hub there is nothing for them to open). */
function render(lang,opts){
 const l=lg(lang),t=T[l],o=opts&&typeof opts==='object'?opts:{},cards=o.cards===true,go=o.go!==false;
 const extra=cards?`${global.Factions?.render?.(l)||''}${global.Rumors?.render?.(l)||''}`:'';
 return `<section class="card nc-root" data-nc-root data-lang="${l}"><div class="card-heading"><span>${esc(t.title)}</span><span>${esc(t.sub)}</span></div><p class="nc-note">${esc(t.intro)}</p><div class="nc-grid" role="group" aria-label="${esc(t.sections)}">${SECTIONS.filter(s=>go||s.pages.length).map(s=>card(s,l,go)).join('')}</div></section>${extra}`;
}
global.NightCity={SECTIONS,PAGES,render};
})(window);
