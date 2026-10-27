/* Corebook catalog expansion, sourced from print pp. 163–165, 190–191, 356–358, 368–371, 376–378.
   Loaded after catalog.js; prices and units are explicit. No existing entries are replaced. */
(function(){
'use strict';
if(!Array.isArray(window.CATALOG))throw Error('catalog.js must load before catalog-extra.js');
const extra=[];
const tr=(ru,en)=>({ru,en});
function add(id,category,ru,en,price,page,detailRu,detailEn,unitRu,unitEn,stats={},priceNote){
  const entry={id:'extra-'+id,category,name:tr(ru,en),price,page,details:tr(detailRu,detailEn),stats};
  if(unitRu||unitEn)entry.priceUnit=tr(unitRu||'',unitEn||'');
  if(priceNote)entry.priceNote=priceNote;
  extra.push(entry);
}
// Cyberdeck hardware. Each piece normally occupies one hardware slot, except those marked 2.
const hardware=[
 ['backup-drive','Резервный накопитель','Backup Drive',2,'Хранит уничтоженные не-Black ICE программы для переустановки; 2 слота.','Stores destroyed non-Black ICE programs for reinstallation; 2 slots.'],
 ['dna-lock','Биометрический замок','DNA Lock',2,'Биометрическая блокировка; вскрытие проверкой Electronics/Security Tech DV17; 2 слота.','Biometric lock; bypass with Electronics/Security Tech DV17; 2 slots.'],
 ['hardened-circuitry','Усиленная схемотехника','Hardened Circuitry',1,'Защищает деку от отключения и уничтожения эффектами EMP и программ, кроме Black ICE.','Protects the deck from EMP and non-Black ICE program effects that disable or destroy it.'],
 ['insulated-wiring','Изолированная проводка','Insulated Wiring',1,'Предотвращает возгорание деки или одежды от эффекта программы.','Prevents the deck or clothing catching fire due to a program effect.'],
 ['krash-barrier','Барьер KRASH','KRASH Barrier',2,'Защищает от программ, принудительно вызывающих выход из сети; 2 слота.','Prevents program effects forcing a safe or unsafe Jack Out; 2 slots.'],
 ['range-upgrade','Увеличитель дальности','Range Upgrade',1,'Позволяет подключиться к точке доступа с расстояния до 8 м.','Allows connection to an access point from up to 8 m.']
];
for(const [id,ru,en,slots,dr,de] of hardware)add('deck-'+id,'programs',ru,en,100,368,dr,de,'за модуль','per module',{type:'hardware',slots});
// Program profile: attack, defense and REZ, including one-use restrictions in the synopsis.
const programs=[
 ['eraser','Eraser','booster',0,0,7,20,368,'+2 ко всем Cloak Checks, пока активна.','+2 to all Cloak Checks while rezzed.'],
 ['see-ya','See Ya','booster',0,0,7,20,368,'+2 ко всем Pathfinder Checks, пока активна.','+2 to all Pathfinder Checks while rezzed.'],
 ['speedy-gonzalvez','Speedy Gonzalvez','booster',0,0,7,100,368,'+2 к Speed, пока активна.','+2 Speed while rezzed.'],
 ['worm','Worm','booster',0,0,7,50,368,'+2 ко всем Backdoor Checks, пока активна.','+2 to all Backdoor Checks while rezzed.'],
 ['armor','Armor','defender',0,0,7,50,369,'Уменьшает урон мозгу на 4; одна копия одновременно, каждую копию можно использовать один раз за Netrun.','Reduces brain damage by 4; one copy active at a time; each copy can be used once per Netrun.'],
 ['flak','Flak','defender',0,0,7,50,369,'Обнуляет ATK вражеских атакующих программ, кроме Black ICE; одна копия одновременно, каждую копию можно использовать один раз за Netrun.','Sets ATK of incoming non-Black ICE attacker programs to 0; one copy active at a time; each copy can be used once per Netrun.'],
 ['shield','Shield','defender',0,0,7,20,369,'Блокирует первый успешный эффект не-Black ICE, наносящий урон мозгу, затем отключается; одна копия одновременно, каждую копию можно использовать один раз за Netrun.','Stops the first successful non-Black ICE brain-damage effect, then derezzes; one copy active at a time; each copy can be used once per Netrun.'],
 ['banhammer','Banhammer','anti-program',1,0,0,50,369,'3d6 REZ программе не-Black ICE; 2d6 REZ программе Black ICE.','Deals 3d6 REZ to non-Black ICE or 2d6 REZ to Black ICE.'],
 ['sword','Sword','anti-program',1,0,0,50,369,'3d6 REZ программе Black ICE; 2d6 REZ программе не-Black ICE.','Deals 3d6 REZ to Black ICE or 2d6 REZ to non-Black ICE.'],
 ['deckkrash','DeckKRASH','anti-personnel',0,0,0,100,369,'Принудительный небезопасный выход вражеского нетраннера из архитектуры.','Forces an enemy Netrunner to unsafely Jack Out of the architecture.'],
 ['hellbolt','Hellbolt','anti-personnel',2,0,0,100,369,'2d6 урона мозгу; незащищённые дека и одежда загораются.','Deals 2d6 brain damage; uninsulated deck and clothing catch fire.'],
 ['nervescrub','Nervescrub','anti-personnel',0,0,0,100,369,'INT, REF и DEX цели снижаются на 1d6 на час, минимум 1.','Target INT, REF and DEX are lowered by 1d6 for an hour, minimum 1.'],
 ['poison-flatline','Poison Flatline','anti-personnel',0,0,0,100,370,'Уничтожает случайную программу не-Black ICE на деке цели.','Destroys a random non-Black ICE program installed on the target deck.'],
 ['superglue','Superglue','anti-personnel',2,0,0,100,370,'На 1d6 раундов запрещает продвигаться глубже и безопасно выходить; раз за Netrun на копию.','Prevents deeper progress and safe Jack Out for 1d6 rounds; once per copy per Netrun.'],
 ['vrizzbolt','Vrizzbolt','anti-personnel',1,0,0,50,370,'1d6 урона мозгу; −1 NET Action в следующий ход цели, минимум 2.','Deals 1d6 brain damage; target has −1 NET Action next turn, minimum 2.']
];
for(const [id,name,type,atk,def,rez,price,page,ru,en] of programs)add('program-'+id,'programs',name,name,price,page,ru,en,'за копию','per copy',{type,atk,def,rez,slots:1});
const blackIce=[
 ['asp','Asp','anti-personnel',4,6,2,2,15,100,370,'Уничтожает случайную программу на деке противника.','Destroys a random program installed on the enemy deck.'],
 ['giant','Giant','anti-personnel',2,2,8,4,25,1000,370,'3d6 урона мозгу и принудительный небезопасный выход.','Deals 3d6 brain damage and forces an unsafe Jack Out.'],
 ['hellhound','Hellhound','anti-personnel',6,6,6,2,20,500,370,'2d6 урона мозгу; незащищённые дека и одежда загораются.','Deals 2d6 brain damage; uninsulated deck and clothing catch fire.'],
 ['kraken','Kraken','anti-personnel',6,2,8,4,30,1000,370,'3d6 урона мозгу; до конца следующего хода нельзя идти глубже или безопасно выйти.','Deals 3d6 brain damage and blocks deeper progress or safe Jack Out until the end of the next turn.'],
 ['liche','Liche','anti-personnel',8,2,6,2,25,500,371,'Снижает INT, REF и DEX на 1d6 на час, минимум 1.','Lowers INT, REF and DEX by 1d6 for an hour, minimum 1.'],
 ['raven','Raven','anti-personnel',6,4,4,2,15,50,371,'Дезактивирует случайную активную защитную программу и наносит 1d6 урона мозгу.','Derezzes a random active Defender program and deals 1d6 brain damage.'],
 ['scorpion','Scorpion','anti-personnel',2,6,2,2,15,100,371,'Снижает MOVE на 1d6 на час, минимум 1.','Lowers MOVE by 1d6 for an hour, minimum 1.'],
 ['skunk','Skunk','anti-personnel',2,4,4,2,10,500,371,'Даёт −2 к Slide Checks до деактивации; эффекты нескольких копий складываются.','Inflicts −2 to Slide Checks until derezzed; multiple copies can stack.'],
 ['wisp','Wisp','anti-personnel',4,4,4,2,15,50,371,'1d6 урона мозгу и −1 NET Action в следующий ход, минимум 2.','Deals 1d6 brain damage and −1 NET Action next turn, minimum 2.'],
 ['dragon','Dragon','anti-program',6,4,6,6,30,1000,371,'6d6 урона программе; при достаточном уроне программа уничтожается.','Deals 6d6 to a program, destroying it if the damage would derezz it.'],
 ['killer','Killer','anti-program',4,8,6,2,20,500,371,'4d6 урона программе; при достаточном уроне программа уничтожается.','Deals 4d6 to a program, destroying it if the damage would derezz it.'],
 ['sabertooth','Sabertooth','anti-program',8,6,6,2,25,1000,371,'6d6 урона программе; при достаточном уроне программа уничтожается.','Deals 6d6 to a program, destroying it if the damage would derezz it.']
];
for(const [id,name,target,per,speed,atk,def,rez,price,page,ru,en] of blackIce)add('ice-'+id,'programs',name,name,price,page,ru,en,'за копию','per copy',{type:'black-ice',target,per,speed,atk,def,rez,slots:2});
// NET architectures: floor and component prices are distinct units (p. 372–373).
for(const [id,ru,en,price,dr,de] of [
 ['small','Архитектура NET: 3–6 этажей','NET architecture: 3–6 floors',1000,'До двух Control Nodes; портативная.','Up to two Control Nodes; portable.'],
 ['medium','Архитектура NET: 7–12 этажей','NET architecture: 7–12 floors',5000,'До трёх Control Nodes; не портативная.','Up to three Control Nodes; not portable.'],
 ['large','Архитектура NET: 13–18 этажей','NET architecture: 13–18 floors',10000,'Не портативная; ограничение Control Nodes см. в книге.','Not portable; see the book for Control Node limits.']
])add('net-architecture-'+id,'programs',ru,en,price,372,dr,de,'за этаж','per floor',{type:'architecture'});
for(const [dv,price] of [[6,500],[8,1000],[10,5000],[12,10000]])add('net-feature-dv'+dv,'programs','Пароль / узел / файл NET: DV'+dv,'NET password / node / file: DV'+dv,price,372,'Цена отдельного элемента с указанной сложностью.','Price for one feature at the specified difficulty.','за элемент','per feature',{type:'net-feature',dv});
for(const [dv,price] of [[9,500],[13,1000],[17,5000],[21,10000]])add('net-defense-dv'+dv,'programs','Защита узла NET: DV'+dv,'NET node defense: DV'+dv,price,373,'Цена защиты с указанной сложностью Electronics/Security Tech.','Price of a defense with the specified Electronics/Security Tech counter DV.','за защиту','per defense',{type:'net-defense',dv});
for(const [id,name,rez,inter,actions,combat,price] of [['imp','Imp',15,3,2,14,1000],['efreet','Efreet',25,4,3,14,5000],['balron','Balron',30,7,4,14,10000]])add('net-demon-'+id,'programs',name+' — демон NET',name+' — NET Demon',price,372,`Демон NET: REZ ${rez}; Interface ${inter}; NET Actions ${actions}; Combat Number ${combat}.`,`NET Demon: REZ ${rez}; Interface ${inter}; NET Actions ${actions}; Combat Number ${combat}.`,'за демона','per demon',{type:'demon',rez,interface:inter,netActions:actions,combatNumber:combat});
// Fashion table is a 10 x 9 matrix; prices are per individual article, not a full outfit.
const kinds=[['bottoms','Низ','Bottoms'],['top','Верх','Top'],['jacket','Куртка','Jacket'],['footwear','Обувь','Footwear'],['jewelry','Украшение','Jewelry'],['mirrorshades','Зеркальные очки','Mirrorshades'],['glasses','Очки','Glasses'],['contact-lenses','Контактные линзы','Contact lenses'],['hat','Головной убор','Hat']];
const styles=[
 ['bag-lady','Bag Lady Chic','Bag Lady Chic',[20,10,20,20,20,20,10,10,10]],
 ['gang-colors','Цвета банды','Gang Colors',[50,20,50,20,50,20,20,10,10]],
 ['generic-chic','Generic Chic','Generic Chic',[50,20,50,20,50,20,20,10,10]],
 ['bohemian','Богемный стиль','Bohemian',[50,20,50,50,100,50,50,10,10]],
 ['leisurewear','Спортивный стиль','Leisurewear',[100,20,100,50,100,50,50,20,50]],
 ['nomad-leathers','Кожа номадов','Nomad Leathers',[100,20,100,100,100,50,50,20,100]],
 ['asia-pop','Asia Pop','Asia Pop',[100,20,100,100,100,100,100,100,100]],
 ['urban-flash','Urban Flash','Urban Flash',[100,20,100,100,100,100,100,100,100]],
 ['businesswear','Деловой стиль','Businesswear',[500,50,500,500,5000,500,500,100,500]],
 ['high-fashion','Высокая мода','High Fashion',[1000,500,1000,5000,50000,1000,1000,1000,5000]]
];
for(const [styleId,styleRu,styleEn,prices] of styles)kinds.forEach(([kindId,ru,en],i)=>add('fashion-'+styleId+'-'+kindId,'fashion',ru+' — '+styleRu,en+' — '+styleEn,prices[i],356,'Один предмет одежды или аксессуар указанного стиля.','One clothing item or accessory of the listed style.','за предмет','per item',{style:styleEn,article:en}));
// Street drugs: summary does not substitute addiction and treatment rules.
const drugs=[
 ['black-lace','Black Lace',50,24,17,'Игнорирует эффекты тяжёлого ранения; временная потеря 2d6 Humanity возвращается, если не возник вторичный эффект.','Ignores Seriously Wounded effects; 2d6 Humanity lost from the dose returns unless the secondary effect occurs.'],
 ['blue-glass','Blue Glass',20,4,15,'Краткие галлюцинации могут лишить действия; при зависимости доза вместо этого временно предотвращает приступы.','Brief hallucinations can cost an Action; for an addicted user, a dose instead temporarily prevents flashouts.'],
 ['boost','Boost',50,24,17,'Повышает INT на 2, в том числе выше 8.','Increases INT by 2, potentially above 8.'],
 ['smash','Smash',10,4,15,'Даёт +2 к Dance, Contortionist, Conversation, Human Perception, Persuasion и Acting.','Grants +2 to Dance, Contortionist, Conversation, Human Perception, Persuasion and Acting.'],
 ['synthcoke','Synthcoke',20,4,15,'Повышает REF на 1, в том числе выше 8; возможна паранойя.','Increases REF by 1, potentially above 8; paranoia can occur.']
];
for(const [id,name,price,hours,dv,ru,en] of drugs)add('drug-'+id,'drugs',name,name,price,id==='synthcoke'?358:357,`${ru} Длительность ${hours} ч; вторичный эффект DV${dv}.`,`${en} Duration ${hours} h; secondary effect DV${dv}.`,'за дозу','per dose',{durationHours:hours,secondaryDV:dv});
// Medtech pharmaceuticals: the book gives materials per batch, not a fixed retail price per dose.
for(const [id,name,ru,en] of [
 ['antibiotic','Antibiotic','После начала естественного восстановления добавляет 2 HP в день на неделю; один действующий курс.','Once natural healing has begun, adds 2 HP per day for one week; one active course.'],
 ['rapidetox','Rapidetox','Немедленно устраняет действие наркотика, яда или интоксиканта.','Immediately clears the effects of a drug, poison or intoxicant.'],
 ['speedheal','Speedheal','Если цель не смертельно ранена, восстанавливает BODY + WILL HP; не чаще раза в день.','If not Mortally Wounded, immediately restores BODY + WILL HP; once per day.'],
 ['stim','Stim','На час устраняет штрафы от тяжёлого ранения; не чаще раза в день.','Ignores Seriously Wounded penalties for one hour; once per day.'],
 ['surge','Surge','Позволяет действовать без сна 24 часа без штрафов; не чаще раза в неделю.','Allows functioning without sleep for 24 hours without impairment; once per week.']
])add('pharmaceutical-'+id,'drugs',name,name,null,150,ru+' Дозу правильно вводит только Medtech.',en+' Only a Medtech can administer a dose correctly.','за партию','per batch',{type:'pharmaceutical',batchMaterialCost:200},tr('Материалы 200 eb за партию; число доз равно уровню Medical Tech','200 eb of materials per batch; doses equal Medical Tech level'));
// Services & entertainment table; duration is kept in the price unit.
const serviceRows=[
 ['body-standard','Бодискульптинг: стандартный','Bodysculpting (Standard)',500,'за услугу','per service'],['body-exotic','Бодискульптинг: экзотический','Bodysculpting (Exotic)',1000,'за услугу','per service'],
 ['braindance','Брейнданс','Braindance',20,'за сеанс','per session'],['drink-dive','Напиток в дешёвом баре','Drink, Dive Bar',10,'за напиток','per drink'],['drink-good','Напиток в хорошем баре','Drink, Good Bar',10,'за напиток','per drink'],['drink-excellent','Напиток в отличном баре','Drink, Excellent Bar',20,'за напиток','per drink'],['drink-executive','Напиток в представительском баре','Drink, Executive Bar',50,'за напиток','per drink'],
 ['install-mall','Установка найденного киберимпланта: Mall','Found Cyberware Installation (Mall)',100,'за установку','per installation'],['install-clinic','Установка найденного киберимпланта: Clinic','Found Cyberware Installation (Clinic)',500,'за установку','per installation'],['install-hospital','Установка найденного киберимпланта: Hospital','Found Cyberware Installation (Hospital)',1000,'за установку','per installation'],
 ['hospital-10','Лечение в больнице DV10','Hospital Treatment (DV10)',50,'за визит','per visit'],['hospital-13','Лечение в больнице DV13','Hospital Treatment (DV13)',100,'за визит','per visit'],['hospital-15','Лечение в больнице DV15','Hospital Treatment (DV15)',500,'за визит','per visit'],['hospital-17','Лечение в больнице DV17+','Hospital Treatment (DV17+)',1000,'за визит','per visit'],
 ['hotel','Отель','Hotel',100,'за ночь','per night'],['hotel-luxury','Роскошный отель','Hotel, Luxury',500,'за ночь','per night'],['braindance-interactive','Интерактивный брейнданс','Interactive Braindance',50,'за сеанс','per session'],['concert','Концерт или спортивное событие','Live Concert / Sporting Event',100,'за посещение','per event'],['movie','Кино','Movie',20,'за просмотр','per viewing'],
 ['professional-good','Услуги специалиста: хорошие','Professional Services, Good',100,'за час','per hour'],['professional-excellent','Услуги специалиста: отличные','Professional Services, Excellent',500,'за час','per hour'],['professional-world','Услуги специалиста: мировой класс','Professional Services, World Class',5000,'за работу','per job'],
 ['meal-fast','Фастфуд','Restaurant Meal, Fast Food',10,'за приём пищи','per meal'],['meal-good','Еда в хорошем ресторане','Restaurant Meal, Good',20,'за приём пищи','per meal'],['meal-excellent','Еда в отличном ресторане','Restaurant Meal, Excellent',50,'за приём пищи','per meal'],['meal-world','Еда в ресторане мирового класса','Restaurant Meal, World Class',500,'за приём пищи','per meal'],['taxi','Такси','Taxi',20,'за поездку','per ride'],
 ['therapy-standard','Терапия: обычная потеря Humanity','Therapy (Standard Humanity Loss)',500,'за терапию','per treatment'],['therapy-extreme','Терапия: экстремальная потеря Humanity','Therapy (Extreme Humanity Loss)',1000,'за терапию','per treatment'],['therapy-addiction','Терапия зависимости','Therapy (Addiction)',1000,'за терапию','per treatment'],['trauma-silver','Trauma Team: Silver','Trauma Team (Silver)',500,'в месяц','per month'],['trauma-executive','Trauma Team: Executive','Trauma Team (Executive)',1000,'в месяц','per month'],['video-game','Видеоигра','Video Game',50,'за игру','per game']
];
for(const [id,ru,en,price,ur,ue] of serviceRows)add('service-'+id,'services',ru,en,price,376,'Цена услуги из таблицы услуг и развлечений.','Price from the services and entertainment table.',ur,ue,{});
add('service-hospital-bed','services','Больничная койка','Hospital bed',100,225,'Пребывание ночью во время восстановления или терапии.','Overnight hospital stay during healing or therapy.','за ночь','per night',{});
add('service-cloned-limb','services','Клонированная конечность про запас','Spare cloned limb',50,226,'Отдельно приобретённая конечность для хранения; замена в ходе лечения включена в стоимость визита.','A spare limb purchased for storage; replacement during treatment is included in the hospital visit.','за конечность','per limb',{});
const lifestyle=[['kibble','Корм Kibble','Kibble',100],['generic-prepak','Обычные готовые пайки','Generic Prepak',300],['good-prepak','Хорошие готовые пайки','Good Prepak',600],['fresh-food','Свежая еда','Fresh Food',1500]];
for(const [id,ru,en,price] of lifestyle)add('lifestyle-'+id,'housing',ru,en,price,377,'Стоимость образа жизни, оплачивается в начале месяца.','Lifestyle cost, paid at the start of the month.','в месяц','per month',{type:'lifestyle'});
const properties=[
 ['cube','Куб-отель','Cube Hotel',500,null],['container','Грузовой контейнер','Cargo Container',1000,15000],['studio','Квартира-студия','Studio Apartment',1500,25000],['two-bedroom','Квартира с двумя спальнями','Two-Bedroom Apartment',2500,35000],['upscale','Престижный конапт','Upscale Conapt',7500,85000],['penthouse','Роскошный пентхаус','Luxury Penthouse',15000,null]
];
for(const [id,ru,en,rent,buy] of properties){add('housing-rent-'+id,'housing',ru+' — аренда',en+' — rent',rent,378,'Аренда за месяц.','Monthly rental.','в месяц','per month',{type:'rent'});if(buy!==null)add('housing-buy-'+id,'housing',ru+' — покупка',en+' — purchase',buy,378,'Цена покупки недвижимости.','Purchase price of the property.','за объект','per property',{type:'purchase'});}
add('housing-buy-beaverville-house','housing','Дом Beaverville — покупка','Beaverville House — purchase',200000,378,'Корпоративная недвижимость; аренда не указана.','Corporate real estate; rent is not listed.','за объект','per property',{type:'purchase'});
add('housing-buy-beaverville-mcmansion','housing','Особняк Beaverville — покупка','Beaverville McMansion — purchase',500000,378,'Корпоративная недвижимость; аренда не указана.','Corporate real estate; rent is not listed.','за объект','per property',{type:'purchase'});
// Corebook vehicle prices, dimensions and caveats. Room-based ships require the stated minimum number of rooms.
const vehicles=[
 ['roadbike','Дорожный мотоцикл','Roadbike',20000,190,35,'2',20,161],['superbike','Супербайк','Superbike',100000,190,35,'2',60,483],['compact-groundcar','Компактный автомобиль','Compact Groundcar',30000,190,50,'4',20,161],['high-performance-groundcar','Спортивный автомобиль','High Performance Groundcar',50000,190,50,'4',40,322],['super-groundcar','Суперавтомобиль','Super Groundcar',100000,190,50,'2',60,483],
 ['jetski','Гидроцикл','Jetski',20000,190,35,'2',20,97],['speedboat','Скоростной катер','Speedboat',30000,190,50,'4',20,97],['cabin-cruiser','Катер с каютами','Cabin Cruiser',30000,190,60,'2 per room',10,24,2],['yacht','Яхта','Yacht',50000,190,100,'4 per room',10,24,4],
 ['gyrocopter','Гирокоптер','Gyrocopter',20000,191,35,'2',20,161],['helicopter','Вертолёт','Helicopter',40000,191,60,'4',40,322],['av4','AV-4 Aerodyne','AV-4 Multipurpose Aerodyne',50000,191,100,'6',40,322],['av9','AV-9 Aerodyne','AV-9 Super Aerodyne',100000,191,60,'2',60,483],['aerozep','Аэрозеп','Aerozep',30000,191,100,'2 per room',20,161,2]
];
for(const [id,ru,en,price,page,sdp,seats,move,kph,minRooms] of vehicles){let room=minRooms?` ${'Цена за комнату; минимум '+minRooms+' комнаты.'}`:'',roomEn=minRooms?` Price per room; minimum ${minRooms} rooms.`:'';add('vehicle-'+id,'vehicles',ru,en,price,page,`SDP ${sdp}; мест: ${seats.replace(' per room',' на комнату')}; MOVE ${move}; ${kph} км/ч.${room}`,`SDP ${sdp}; seats: ${seats}; MOVE ${move}; ${kph} km/h.${roomEn}`,minRooms?'за комнату':'за транспорт',minRooms?'per room':'per vehicle',{sdp,seats,move,kph,...(minRooms?{minRooms}: {})});}
// Market availability and cost are category-only for higher-rank Nomad upgrades.
const upgrades=[
 ['armored-chassis','Бронированное шасси','Armored Chassis',5,163,'SP13 для машины, не стекла.','Vehicle SP13; does not armor glass.'],
 ['bulletproof-glass','Пуленепробиваемые стёкла','Bulletproof Glass',1,163,'Тонкое стекло даёт укрытие 15 HP; повторное улучшение — 30 HP.','Thin bulletproof glass provides 15 HP cover; second upgrade makes it 30 HP.'],
 ['communications-center','Центр связи','Communications Center',1,163,'Бортовой Agent и набор съёмных средств связи.','Onboard Agent and removable communications equipment.'],
 ['nos','NOS','NOS',1,163,'Одно дополнительное действие движения за действие водителя; каждый бак используется раз в день.','Allows the driver an extra Move Action as an Action; each tank usable once per day.'],
 ['onboard-flamethrower','Бортовой огнемёт','Onboard Flamethrower',1,163,'Встроенный огнемёт; не перезаряжается во время движения.','Mounted flamethrower; cannot be reloaded while driving.'],
 ['onboard-machine-gun','Бортовой пулемёт','Onboard Machine Gun',1,163,'Встроенная штурмовая винтовка на 30 патронов; только Autofire.','Mounted assault rifle with 30 rounds, Autofire only.'],
 ['seating-upgrade','Дополнительные места','Seating Upgrade',1,163,'Добавляет два места; применяются ограничения на повторные улучшения.','Adds two seats; repeat upgrades have vehicle restrictions.'],
 ['security-upgrade','Система безопасности','Security Upgrade',5,163,'Биометрические замки и маскировка стоящего транспорта.','Biometric locks and camouflage for a stationary vehicle.'],
 ['smuggling-upgrade','Тайники для контрабанды','Smuggling Upgrade',1,163,'Два скрытых оружейных отсека и один большой тайник.','Two concealed weapon holsters and one large smuggling compartment.'],
 ['heavy-chassis','Усиленное шасси','Heavy Chassis',1,164,'+20 SDP; недоступно для мотоциклов, гидроциклов и гирокоптеров.','Adds 20 SDP; unavailable to bikes, jetskis and gyrocopters.'],
 ['rocket-pod','Ракетный блок','Onboard Rocket Pod',5,164,'Ракетная установка с тремя ракетами; требуется Heavy Chassis.','Rocket launcher with three rockets; requires Heavy Chassis.'],
 ['heavy-weapon-mount','Крепление тяжёлого оружия','Vehicle Heavy Weapon Mount',5,164,'Оружейное место пассажира; требуется Heavy Chassis.','Passenger heavy-weapon position; requires Heavy Chassis.'],
 ['onboard-melee','Бортовое оружие ближнего боя','Onboard Melee Weapon',1,164,'Встроенное очень тяжёлое оружие ближнего боя для наземного и водного транспорта.','Mounted very heavy melee weapon for land and sea vehicles.'],
 ['hover','Ховер-улучшение','Hover Upgrade',5,164,'Позволяет наземному транспорту двигаться по воде.','Lets a land vehicle travel across the surface of water.'],
 ['av4-engine','Двигатель AV-4','AV-4 Engine Upgrade',7,164,'Позволяет наземному транспорту летать; в воздухе используется Pilot Air Vehicle.','Enables flight for a land vehicle using Pilot Air Vehicle.'],
 ['combat-plow','Боевой отвал','Combat Plow',1,164,'Улучшает таран; ограничения для наземных и водных машин.','Improves ramming; land and sea vehicle restrictions apply.'],
 ['bike-interface','Улучшенный интерфейс мотоцикла','Enhanced Interface Plug Integration',5,165,'Особое уклонение при управлении мотоциклом через Interface Plugs.','Special evasion while driving a bike through Interface Plugs.'],
 ['spike-strip','Выбрасываемая полоса шипов','Deployable Spike Strip',1,165,'Шипы требуют от преследователя проверку вождения DV17.','Spike strips require a pursuing driver to beat DV17.'],
 ['housing-capacity','Жилой модуль','Housing Capacity',1,165,'Добавляет жилое пространство; для некоторых машин требуется Heavy Chassis.','Adds living space; some vehicles require Heavy Chassis.']
];
for(const [id,ru,en,rank,page,dr,de] of upgrades){const fixed=rank===1;add('upgrade-'+id,'vehicles',ru,en,fixed?1000:null,page,`Улучшение транспорта; Moto rank ${rank}. ${dr} На открытом рынке встречается редко.`,`Vehicle upgrade; Moto rank ${rank}. ${de} Rare on the open market.`,'за улучшение','per upgrade',{type:'upgrade',motoRank:rank},fixed?undefined:tr('Категория Luxury; точная цена не указана','Luxury category; exact price not specified'));}
const seen=new Set(window.CATALOG.map(x=>x.id));for(const e of extra){if(seen.has(e.id))throw Error('Duplicate catalog id: '+e.id);seen.add(e.id);window.CATALOG.push(e)}
window.CATALOG_EXTRA_COUNT=extra.length;
})();
