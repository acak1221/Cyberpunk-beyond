/* Random tables from the Corebook: the screamsheet headline generator (p. 326), the nearest
   Vendit (p. 331) and the bodega's clientele (p. 332). Dice and structure follow the book;
   the entries are short translations or our own wording, each result links to its page. */
(function(){
'use strict';
const HEADLINE={page:326,
 category:[['Международные','International'],['Национальные','National'],['Новости штата','State'],['Местные','Local'],['Финансы','Financial'],['Светская хроника','Gossip']],
 who:[['Корпорация (на ваш выбор)','A Corp of your choice'],['Сенатор','Senator'],['Президент','President'],['Корпорации','Corporations'],['Городской совет','City Council'],['Киберпсих','Cyberpsycho'],['Убийца','Killer'],['Душегуб','Slayer'],['Трагедия','Tragic'],['Следователи','Investigators']],
 does:[['предлагает','offers'],['угрожает','threatens'],['идёт на уступки','compromises'],['убивает','murders'],['убит','killed'],['умирает','dies'],['хвалит','praises'],['объявляет','announces'],['раскрывает','reveals'],['продолжает','continues']],
 what:[['корпорации','corporations'],['город','city'],['компромисс','compromise'],['предупреждение','warning'],['план','plan'],['скандал','scandal'],['женщина','woman'],['мужчина','man'],['несчастный случай','accident'],['надежда','hope']]};
// 1d6: 1–3 food, 4–5 personal, 6 just plain weird; then 1d10 for the contents.
const VENDIT={page:331,
 types:[['Еда','Food'],['Личные вещи','Personal'],['Нечто странное','Just plain weird']],
 items:[
  [['Лапша рамэн','Ramen noodles'],['Пицца','Pizza'],['Гамбургеры','Hamburgers'],['Smash','Smash'],['Суши','Sushi'],['Горячее мясо','Hot meat'],['Сухой корм в пакетах по 1 кг','1 kg bags of kibble'],['Кофе в банках','Canned coffee'],['Сок в банках','Canned juice'],['Газировка в банках','Canned soft drinks']],
  [['Футболки в банках','Canned T-shirts'],['Секс-игрушки','Sex toys'],['Зонты','Umbrellas'],['Галстуки','Ties'],['Медицинские маски','Surgical masks'],['Нижнее бельё','Underwear'],['Букеты','Floral arrangements'],['Оружие и патроны','Guns and ammo'],['Чипы брейнданса','Braindance chips'],['Видеоигры','Video games']],
  [['Парики для питомцев','Pet wigs'],['Закуски из насекомых','Bug snacks'],['Кочаны салата','Balls of lettuce'],['Суп из летучей рыбы','Flying fish soup'],['Морепродукты из чана','Vat-grown seafood'],['Запахи в банках','Canned smells'],['Живые жуки-носороги','Live rhinoceros beetles'],['Бумажные костюмы для косплея','Paper cosplay costumes'],['Странные игрушки в капсулах','Bizarre capsule toys'],['Ношеное бельё','Used panties']],
 ]};
// 1d6 on each column.
const BODEGA={page:332,
 owner:[['Заботливая бабушка: опекает вас как родного','A motherly granny who fusses over you like family'],['Сердитый пенсионер: ему не нравится никто, и вы тоже','A grumpy retiree who dislikes everyone, you included'],['Скучающий подросток из банды, которого родители поставили за кассу','A bored young ganger stuck at the register by their parents'],['Слишком дружелюбный тип: неуклюже заигрывает','An overly friendly type who flirts, clumsily'],['Обкуренный продавец, которому всё равно','A stoned clerk who waves everything through'],['Человек средних лет: его не понять, но он всё время с вами спорит','A middle-aged person you cannot understand, who argues with you anyway']],
 first:[['Бормочущий покупатель: вдруг замирает и смотрит на вас','A mumbling customer who stops to stare at you'],['Шумный пьяный покупатель','A loud, drunk customer'],['Покупатель под веществами: отмахивается от того, чего нет','A high customer swatting at things only they can see'],['Джойгёрл или джойбой без денег: предлагает «услугу» за Smash','A cash-strapped joygirl or joyboy offering “a favor” for some Smash'],['Законник не при исполнении: зашёл перекусить и не настроен говорить','An off-duty lawman after a quick bite, not in a talking mood'],['Перепуганный покупатель: готов сорваться (и, возможно, достать оружие) на любого, кто подойдёт','A customer terrified of the Street, ready to jump, maybe draw, on anyone who comes close']],
 second:[['Юный бандит присматривается к магазину и набирается смелости его ограбить','A young ganger casing the place, working up the nerve to rob it'],['Бандит, который собирается разгромить магазин через 1d6 ходов','A ganger about to smash the place up in 1d6 turns'],['Мелкий бандит выбивает из хозяина деньги «за защиту»','A small-time ganger shaking the owner down for “protection”'],['Потерявшийся четырёхлетний ребёнок ищет маму','A lost four-year-old looking for “Mommy”'],['Пара, которая ссорится уже на входе, и дальше только громче','A couple arguing as they come in, and only getting louder'],['Богатая пара в дорогих вещах: зашли за выпивкой после вечеринки','A wealthy couple in too much finery, picking up booze after a party']]};
const die=(sides,rng)=>Math.min(sides,Math.max(1,Math.floor(rng()*sides)+1));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function headline(rng=Math.random){return {table:'headline',category:die(6,rng),who:die(10,rng),does:die(10,rng),what:die(10,rng)}}
function vendit(rng=Math.random){return {table:'vendit',type:die(6,rng),item:die(10,rng)}}
function bodega(rng=Math.random){return {table:'bodega',owner:die(6,rng),first:die(6,rng),second:die(6,rng)}}
const venditType=roll=>roll<=3?0:roll<=5?1:2;
const inRange=(n,max)=>Number.isInteger(n)&&n>=1&&n<=max;
function valid(e){
 if(!e||typeof e!=='object')return false;
 if(e.table==='headline')return inRange(e.category,6)&&inRange(e.who,10)&&inRange(e.does,10)&&inRange(e.what,10);
 if(e.table==='vendit')return inRange(e.type,6)&&inRange(e.item,10);
 if(e.table==='bodega')return inRange(e.owner,6)&&inRange(e.first,6)&&inRange(e.second,6);
 return false;
}
// [label, value, dice] rows for a result, in the chosen language.
function rows(e,lang){
 const i=lang==='en'?1:0,ru=i===0;
 if(!valid(e))return [];
 if(e.table==='headline')return [[ru?'Раздел':'Section',HEADLINE.category[e.category-1][i],'1d6: '+e.category],[ru?'Заголовок':'Headline',`${HEADLINE.who[e.who-1][i]} · ${HEADLINE.does[e.does-1][i]} · ${HEADLINE.what[e.what-1][i]}`,`1d10: ${e.who}, ${e.does}, ${e.what}`]];
 if(e.table==='vendit'){const type=venditType(e.type);return [[ru?'Автомат':'Machine',VENDIT.types[type][i],'1d6: '+e.type],[ru?'Внутри':'Inside',VENDIT.items[type][e.item-1][i],'1d10: '+e.item]]}
 return [[ru?'За кассой':'At the register',BODEGA.owner[e.owner-1][i],'1d6: '+e.owner],[ru?'Посетитель':'Customer',BODEGA.first[e.first-1][i],'1d6: '+e.first],[ru?'Ещё один':'Another one',BODEGA.second[e.second-1][i],'1d6: '+e.second]];
}
function title(e,lang){const ru=lang!=='en';return e?.table==='headline'?(ru?'Заголовок скримшита':'Screamsheet headline'):e?.table==='vendit'?(ru?'Ближайший вендит':'The nearest Vendit'):(ru?'Кто в бодеге':'Who is in the bodega')}
const pageOf=e=>e?.table==='headline'?HEADLINE.page:e?.table==='vendit'?VENDIT.page:BODEGA.page;
function html(e,lang){
 const list=rows(e,lang);if(!list.length)return '';
 return `<div class="gx-entry"><span class="overline">${esc(title(e,lang))} <button class="rule-source" type="button" data-action="book-page" data-page="${pageOf(e)}">${lang==='en'?'p.':'стр.'} ${pageOf(e)}</button></span><dl class="gx-dl">${list.map(([label,value,dice])=>`<dt>${esc(label)}</dt><dd>${esc(value)} <span class="gx-mono">${esc(dice)}</span></dd>`).join('')}</dl></div>`;
}
function text(e,lang){const list=rows(e,lang);return list.length?`${title(e,lang)} (${lang==='en'?'p.':'стр.'} ${pageOf(e)}): `+list.map(([label,value])=>`${label}: ${value}`).join('; '):''}
window.BookTables={HEADLINE,VENDIT,BODEGA,headline,vendit,bodega,valid,rows,title,html,text};
})();
