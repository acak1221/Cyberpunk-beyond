/* Corebook v1.22: Streetrat and Edgerunner source tables. Print pages 45, 74–77, 86–89, 98, 103, 105, 117. */
(function(){
'use strict';
const ORDER=['INT','REF','DEX','TECH','COOL','WILL','LUCK','MOVE','BODY','EMP'];
const parseRows=s=>s.trim().split(/\n/).map(row=>row.trim().split(/\s+/).map(Number));
const statTables={
rockerboy:parseRows(`7 6 6 5 6 8 7 7 3 8
3 7 7 7 7 6 7 7 5 8
4 5 7 7 6 6 7 7 5 8
4 5 7 7 6 8 7 6 3 8
3 7 7 7 6 8 6 5 4 7
5 6 7 5 7 8 5 7 3 7
5 6 6 7 7 8 7 6 3 6
5 7 7 5 6 6 6 6 4 8
3 5 5 6 7 8 7 5 5 7
4 5 6 5 8 8 7 6 4 7`),
solo:parseRows(`6 7 7 3 8 6 5 5 6 5
7 8 6 3 6 6 7 5 6 6
5 8 7 4 7 7 6 7 8 5
5 8 6 4 6 7 6 5 7 6
6 6 7 5 7 6 7 6 8 4
7 7 6 5 7 6 6 7 7 5
7 7 6 5 6 7 7 6 6 6
7 8 7 5 6 6 5 6 8 4
7 7 6 4 6 6 6 5 6 5
6 6 8 5 6 6 5 6 6 5`),
netrunner:parseRows(`5 8 7 7 7 4 8 7 7 4
5 6 7 5 8 3 8 7 5 5
5 6 8 6 6 4 7 6 7 4
5 7 7 7 7 5 8 6 5 5
5 8 8 5 7 3 7 5 5 6
6 6 6 7 8 4 7 7 6 6
6 6 6 7 6 5 7 7 7 6
5 7 8 6 8 4 8 5 7 4
7 6 7 7 6 3 6 5 6 5
7 8 6 6 6 4 7 7 5 6`),
tech:parseRows(`6 7 7 8 4 4 5 5 7 6
7 6 6 7 5 3 7 7 5 5
8 6 5 7 5 4 7 7 5 7
7 8 7 8 4 4 6 5 6 7
6 6 7 6 4 3 7 7 6 6
8 7 5 6 3 3 7 6 6 7
8 6 7 8 4 4 7 6 7 6
8 8 7 8 5 4 6 5 6 6
6 6 7 8 3 3 5 7 7 7
8 8 5 6 4 4 6 5 6 6`),
medtech:parseRows(`7 5 6 7 5 3 8 5 5 7
6 7 7 7 4 4 6 7 7 7
6 5 5 8 5 3 8 5 7 8
8 7 6 8 3 5 6 6 5 7
6 7 5 7 5 5 8 7 6 8
8 5 5 8 5 5 6 6 5 6
8 6 5 8 5 4 8 5 7 7
6 5 7 7 3 5 8 5 5 8
6 6 7 7 5 4 6 6 5 6
8 7 6 6 3 4 8 7 6 7`),
media:parseRows(`6 6 5 5 8 7 5 7 5 7
8 7 7 3 6 6 6 5 6 8
6 7 7 5 6 8 5 5 5 7
6 5 7 5 6 7 5 5 6 6
6 6 7 4 8 7 6 7 5 8
7 5 5 4 8 7 6 7 5 8
8 5 6 3 7 6 6 5 6 7
6 5 6 5 6 8 6 6 7 8
7 7 5 4 6 7 6 5 6 7
7 6 6 3 7 6 7 6 7 6`),
lawman:parseRows(`5 6 7 5 7 8 5 6 5 6
6 6 6 5 6 8 5 7 5 5
5 7 7 7 6 7 5 5 7 6
6 6 7 6 6 8 5 7 7 6
6 6 7 6 7 7 6 5 5 6
7 6 5 5 7 8 5 6 7 4
7 8 7 5 6 8 7 6 5 4
5 6 6 5 6 8 5 7 6 4
7 7 5 5 7 7 6 5 5 6
6 6 5 6 8 7 5 7 6 6`),
exec:parseRows(`8 5 5 3 8 6 6 5 5 7
8 6 6 4 7 6 7 7 5 7
8 7 6 3 8 6 7 6 4 5
8 5 7 5 6 5 6 5 5 7
7 7 6 5 8 5 7 7 5 6
5 7 7 3 6 7 6 5 5 7
6 6 7 5 8 7 6 7 4 6
6 7 7 3 7 5 7 5 5 7
7 6 7 5 7 5 7 6 5 5
7 7 5 5 8 6 6 7 4 7`),
fixer:parseRows(`8 5 7 4 6 5 8 5 5 8
8 5 5 5 6 7 8 7 5 7
6 6 6 4 5 6 8 6 3 8
7 7 5 5 7 6 7 7 5 8
8 6 6 3 6 5 8 7 5 6
8 7 5 5 6 7 7 5 3 6
8 6 6 5 6 5 6 7 5 8
6 6 7 4 7 6 7 7 4 7
8 7 7 5 5 5 7 6 5 7
6 5 6 5 5 6 8 6 4 7`),
nomad:parseRows(`6 6 8 3 6 7 6 6 6 4
5 7 6 5 8 8 8 7 5 4
5 8 6 3 8 7 6 5 6 5
5 8 7 4 8 6 7 7 7 5
6 6 6 3 6 7 6 7 7 4
7 6 8 4 6 7 6 5 6 5
6 7 8 4 6 6 7 5 7 5
5 7 8 3 8 6 7 5 5 5
6 7 6 4 8 6 6 6 6 6
5 6 7 4 7 8 7 7 7 4`)
};
const basic=['Athletics','Brawling','Concentration','Conversation','Education','Evasion','First Aid','Human Perception','Language (Streetslang)','Local Expert (Home)','Perception','Persuasion','Stealth'];
// Each role is represented in the same order as pp. 86–87; cost is from pp. 82–85.
const skillRows={
 rockerboy:{base:[2,6,2,2,2,6,6,6,2,4,2,6,2],extra:[['Composition',6],['Handgun',6],['Melee Weapon',6],['Personal Grooming',4],['Play Instrument',6,'choose'],['Streetwise',6],['Wardrobe & Style',4]]},
 solo:{base:[2,2,2,2,2,6,6,2,2,2,6,2,2],extra:[['Autofire',6],['Handgun',6],['Interrogation',6],['Melee Weapon',6],['Resist Torture/Drugs',6],['Shoulder Arms',6],['Tactics',6]]},
 netrunner:{base:[2,2,2,2,6,6,2,2,2,2,2,2,6],extra:[['Basic Tech',6],['Conceal/Reveal Object',6],['Cryptography',6],['Cybertech',6],['Electronics/Security Tech',6],['Handgun',6],['Library Search',6]]},
 tech:{base:[2,2,2,2,6,6,6,2,2,2,2,2,2],extra:[['Basic Tech',6],['Cybertech',6],['Electronics/Security Tech',6],['Land Vehicle Tech',6],['Shoulder Arms',6],['Science',6,'choose'],['Weaponstech',6]]},
 medtech:{base:[2,2,2,6,6,6,2,6,2,2,2,2,2],extra:[['Basic Tech',6],['Cybertech',4],['Deduction',6],['Paramedic',6],['Resist Torture/Drugs',4],['Science',6,'choose'],['Shoulder Arms',6]]},
 media:{base:[2,2,2,6,2,6,2,6,2,6,6,6,2],extra:[['Bribery',6],['Composition',6],['Deduction',6],['Handgun',6],['Library Search',4],['Lip Reading',4],['Photography/Film',4]]},
 lawman:{base:[2,6,2,6,2,6,2,2,2,2,2,2,2],extra:[['Autofire',6],['Criminology',6],['Deduction',6],['Handgun',6],['Interrogation',6],['Shoulder Arms',6],['Tracking',6]]},
 exec:{base:[2,2,2,6,6,6,2,6,2,2,2,6,2],extra:[['Accounting',6],['Bureaucracy',6],['Business',6],['Deduction',6],['Handgun',6],['Lip Reading',6],['Personal Grooming',4]]},
 fixer:{base:[2,2,2,6,2,6,2,6,4,6,2,4,2],extra:[['Bribery',6],['Business',6],['Forgery',6],['Handgun',6],['Pick Lock',4],['Streetwise',6],['Trading',6]]},
 nomad:{base:[2,6,2,2,2,6,6,2,2,2,4,2,6],extra:[['Animal Handling',6],['Drive Land Vehicle',6],['Handgun',6],['Melee Weapon',6],['Tracking',6],['Trading',6],['Wilderness Survival',6]]}
};
const doubleCost=new Set(['Autofire','Electronics/Security Tech','Paramedic','Pilot Air Vehicle','Heavy Weapons','Martial Arts','Demolitions']);
const rp={rockerboy:{ru:'Рокербой',en:'Rockerboy',stats:74,skills:86},solo:{ru:'Соло',en:'Solo',stats:74,skills:86},netrunner:{ru:'Нетраннер',en:'Netrunner',stats:74,skills:86},tech:{ru:'Техник',en:'Tech',stats:75,skills:86},medtech:{ru:'Медтех',en:'Medtech',stats:75,skills:86},media:{ru:'Медиа',en:'Media',stats:75,skills:87},lawman:{ru:'Законник',en:'Lawman',stats:76,skills:87},exec:{ru:'Корпорат',en:'Exec',stats:76,skills:87},fixer:{ru:'Фиксер',en:'Fixer',stats:76,skills:87},nomad:{ru:'Номад',en:'Nomad',stats:77,skills:87}};
const item=(ru,en,quantity=1)=>({type:'item',name:{ru,en},quantity});
const choose=(...options)=>({type:'choice',choose:1,options});
const I=item,C=choose;
const gear={
rockerboy:[I('Очень тяжёлый пистолет','Very Heavy Pistol'),I('Базовые патроны VH Pistol','Basic VH Pistol Ammunition',50),C(I('Тяжёлое оружие ближнего боя','Heavy Melee Weapon'),I('Светошумовая граната','Flashbang Grenade')),I('Газовая граната','Teargas Grenade',2)],
solo:[I('Штурмовая винтовка','Assault Rifle'),I('Очень тяжёлый пистолет','Very Heavy Pistol'),C(I('Тяжёлое оружие ближнего боя','Heavy Melee Weapon'),I('Пуленепробиваемый щит','Bulletproof Shield')),I('Базовые патроны VH Pistol','Basic VH Pistol Ammunition',30),I('Базовые винтовочные патроны','Basic Rifle Ammunition',70)],
netrunner:[I('Очень тяжёлый пистолет','Very Heavy Pistol'),I('Базовые патроны VH Pistol','Basic VH Pistol Ammunition',30)],
tech:[C(I('Дробовик','Shotgun'),I('Штурмовая винтовка','Assault Rifle')),C(I('Базовые дробовые патроны','Basic Shotgun Shell Ammunition',100),I('Базовые винтовочные патроны','Basic Rifle Ammunition',100)),I('Светошумовая граната','Flashbang Grenade')],
medtech:[C(I('Дробовик','Shotgun'),I('Штурмовая винтовка','Assault Rifle')),C(I('Базовые дробовые патроны','Basic Shotgun Shell Ammunition',100),I('Базовые винтовочные патроны','Basic Rifle Ammunition',100)),C(I('Зажигательные дробовые патроны','Incendiary Shotgun Shell Ammunition',10),I('Зажигательные винтовочные патроны','Incendiary Rifle Ammunition',10)),I('Дымовая граната','Smoke Grenade',2),I('Пуленепробиваемый щит','Bulletproof Shield')],
media:[C(I('Тяжёлый пистолет','Heavy Pistol'),I('Очень тяжёлый пистолет','Very Heavy Pistol')),C(I('Базовые патроны H Pistol','Basic H Pistol Ammunition',50),I('Базовые патроны VH Pistol','Basic VH Pistol Ammunition',50))],
lawman:[C(I('Штурмовая винтовка','Assault Rifle'),I('Дробовик','Shotgun')),I('Тяжёлый пистолет','Heavy Pistol'),C(I('Базовые винтовочные патроны','Basic Rifle Ammunition',100),I('Базовые дробовые патроны','Basic Shotgun Shell Ammunition',100),I('Базовые пулевые патроны для дробовика','Basic Slug Ammunition',100)),I('Базовые патроны H Pistol','Basic H Pistol Ammunition',30),C(I('Пуленепробиваемый щит','Bulletproof Shield'),I('Дымовая граната','Smoke Grenade',2))],
exec:[I('Очень тяжёлый пистолет','Very Heavy Pistol'),I('Базовые патроны VH Pistol','Basic VH Pistol Ammunition',50)],
fixer:[C(I('Тяжёлый пистолет','Heavy Pistol'),I('Очень тяжёлый пистолет','Very Heavy Pistol')),C(I('Тяжёлый пистолет','Heavy Pistol'),I('Очень тяжёлый пистолет','Very Heavy Pistol')),I('Лёгкое оружие ближнего боя','Light Melee Weapon'),C(I('Базовые патроны H Pistol','Basic H Pistol Ammunition',100),I('Базовые патроны VH Pistol','Basic VH Pistol Ammunition',100))],
nomad:[C(I('Тяжёлый пистолет','Heavy Pistol'),I('Очень тяжёлый пистолет','Very Heavy Pistol')),C(I('Базовые патроны H Pistol','Basic H Pistol Ammunition',100),I('Базовые патроны VH Pistol','Basic VH Pistol Ammunition',100)),C(I('Тяжёлое оружие ближнего боя','Heavy Melee Weapon'),I('Тяжёлый пистолет','Heavy Pistol'))]
};
// Every listed Role receives Light Armorjack on body and head (SP 11 each).
for(const r of Object.keys(gear))gear[r].push(I('Лёгкий бронежилет — тело, SP 11','Light Armorjack Body Armor, SP 11'),I('Лёгкая броня — голова, SP 11','Light Armorjack Head Armor, SP 11'));
const fashion=(style,ru,en,quantity=1)=>({...I(ru,en,quantity),kind:'fashion',style});
const F=fashion;
const outfit={
rockerboy:[I('Агент','Agent'),I('Компьютер','Computer'),C(I('Электрогитара','Electric Guitar'),I('Детектор жучков','Bug Detector')),I('Светящаяся краска','Glow Paint',5),I('Карманный усилитель','Pocket Amp'),I('Радиосканер / музыкальный проигрыватель','Radio Scanner/Music Player'),I('Видеокамера','Video Camera'),F('Generic Chic','Куртка','Jacket'),F('Generic Chic','Украшение','Jewelry',3),F('Generic Chic','Верх','Top',4),F('Leisurewear','Украшение','Jewelry'),F('Leisurewear','Зеркальные очки','Mirrorshades'),F('Leisurewear','Обувь','Footwear'),F('Urban Flash','Низ','Bottoms'),F('Urban Flash','Верх','Top')],
solo:[I('Агент','Agent'),F('Leisurewear','Обувь','Footwear',2),F('Leisurewear','Куртка','Jacket',3),F('Leisurewear','Зеркальные очки','Mirrorshades'),F('Leisurewear','Низ','Bottoms',2),F('Leisurewear','Верх','Top',2)],
netrunner:[I('Агент','Agent'),I('Кибердека на 7 слотов','Cyberdeck (7 slots)'),I('Очки виртуальности','Virtuality Goggles'),I('Программа Armor','Program: Armor'),I('Программа Sword','Program: Sword'),C(I('Программа See Ya','Program: See Ya'),I('Программа Eraser','Program: Eraser')),C(I('Программа Sword','Program: Sword'),I('Программа Vrizzbolt','Program: Vrizzbolt')),C(I('Программа Worm','Program: Worm'),I('Программа Sword','Program: Sword')),F('Generic Chic','Верх','Top',10),F('Leisurewear','Обувь','Footwear',2),F('Leisurewear','Украшение','Jewelry'),F('Leisurewear','Низ','Bottoms',2),F('Urban Flash','Куртка','Jacket')],
tech:[I('Агент','Agent'),I('Противосмоговая дыхательная маска','Anti-Smog Breathing Mask'),I('Одноразовый телефон','Disposable Cell Phone'),I('Скотч','Duct Tape',5),I('Фонарик','Flashlight'),I('Дорожный фальшфейер','Road Flare',6),I('Сумка техника','Tech Bag'),F('Generic Chic','Низ','Bottoms',8),F('Generic Chic','Верх','Top',10),F('Leisurewear','Обувь','Footwear',2)],
medtech:[I('Агент','Agent'),I('Airhypo','Airhypo'),I('Наручники','Handcuffs'),I('Фонарик','Flashlight'),F('Generic Chic','Куртка','Jacket',3),I('Светящаяся краска','Glow Paint'),I('Сумка медтеха','Medtech Bag'),F('Leisurewear','Обувь','Footwear'),F('Leisurewear','Низ','Bottoms',3),F('Leisurewear','Верх','Top',5)],
media:[I('Агент','Agent'),I('Аудиорекордер','Audio Recorder'),I('Бинокль','Binoculars'),C(I('Одноразовый телефон','Disposable Cellphone',2),I('Гарпунное устройство','Grapple Gun')),I('Фонарик','Flashlight'),I('Компьютер','Computer'),I('Радиосканер / музыкальный проигрыватель','Radio Scanner/Music Player'),I('Скремблер / дескремблер','Scrambler/Descrambler'),I('Видеокамера','Video Camera'),F('Generic Chic','Обувь','Footwear'),F('Generic Chic','Низ','Bottoms'),F('Generic Chic','Верх','Top'),F('Leisurewear','Куртка','Jacket'),F('Urban Flash','Зеркальные очки','Mirrorshades')],
lawman:[I('Агент','Agent'),I('Фонарик','Flashlight'),I('Наручники','Handcuffs',2),I('Радиосвязь','Radio Communicator'),I('Дорожный фальшфейер','Road Flare',10),F('Generic Chic','Куртка','Jacket'),F('Generic Chic','Низ','Bottoms',2),F('Generic Chic','Верх','Top',3),F('Leisurewear','Обувь','Footwear',2),F('Leisurewear','Куртка','Jacket',2),F('Leisurewear','Низ','Bottoms',2),F('Leisurewear','Зеркальные очки','Mirrorshades'),F('Leisurewear','Верх','Top',2)],
exec:[I('Радиосвязь','Radio Communicator',4),I('Скремблер / дескремблер','Scrambler/Descrambler'),F('Businesswear','Обувь','Footwear'),F('Businesswear','Куртка','Jacket'),F('Businesswear','Низ','Bottoms'),F('Businesswear','Зеркальные очки','Mirrorshades'),F('Businesswear','Верх','Top'),F('Businesswear','Украшение','Jewelry',2)],
fixer:[I('Агент','Agent'),I('Детектор жучков','Bug Detector'),I('Компьютер','Computer'),I('Одноразовый телефон','Disposable Phone',2),F('Generic Chic','Контактные линзы','Contacts'),F('Generic Chic','Украшение','Jewelry'),F('Leisurewear','Зеркальные очки','Mirrorshades'),F('Urban Flash','Обувь','Footwear'),F('Urban Flash','Куртка','Jacket'),F('Urban Flash','Низ','Bottoms'),F('Urban Flash','Верх','Top')],
nomad:[I('Агент','Agent'),I('Противосмоговая дыхательная маска','Anti-Smog Breathing Mask'),I('Скотч','Duct Tape'),I('Фонарик','Flashlight'),I('Гарпунное устройство','Grapple Gun'),I('Надувная кровать и спальник','Inflatable Bed & Sleep-Bag'),I('Сумка медтеха','Medtech Bag'),I('Радиосвязь','Radio Communicator',2),I('Верёвка','Rope'),I('Techtool','Techtool'),I('Палатка и снаряжение для кемпинга','Tent and Camping Equipment'),F('Bohemian','Украшение','Jewelry'),F('Nomad Leathers','Верх','Top',4),F('Nomad Leathers','Низ','Bottoms',2),F('Nomad Leathers','Обувь','Footwear',2),F('Nomad Leathers','Куртка','Jacket'),F('Nomad Leathers','Головной убор','Hat')]
};
const cyber={
rockerboy:{loss:9,items:[I('Аудиорекордер','Audio Recorder'),I('Chemskin','Chemskin'),I('Кибераудиосистема','Cyberaudio Suite'),I('Tech Hair','Tech Hair')]},
solo:{loss:14,items:[I('Биомонитор','Biomonitor'),I('Neural Link','Neural Link'),C(I('Sandevistan Speedware','Sandevistan Speedware'),I('Wolvers','Wolvers'))]},
netrunner:{loss:14,items:[I('Interface Plugs','Interface Plugs'),I('Neural Link','Neural Link'),I('Shift Tacts','Shift Tacts')]},
tech:{loss:12,items:[I('Киберглаз','Cybereye'),I('MicroOptics','MicroOptics'),I('Skinwatch','Skinwatch'),I('Tool Hand','Tool Hand')]},
medtech:{loss:12,items:[I('Биомонитор','Biomonitor'),I('Киберглаз','Cybereye'),C(I('Носовые фильтры','Nasal Filters'),I('Toxin Binders','Toxin Binders')),I('TeleOptics','TeleOptics')]},
media:{loss:10,items:[C(I('Усиленный слух','Amplified Hearing'),I('Voice Stress Analyzer','Voice Stress Analyzer')),I('Кибераудиосистема','Cyberaudio Suite'),I('Светящаяся татуировка','Light Tattoo')]},
lawman:{loss:10,items:[I('Скрытая кобура','Hidden Holster'),I('Подкожный карман','Subdermal Pocket'),C(I('Биомонитор','Biomonitor'),I('Tech Hair','Tech Hair'))]},
exec:{loss:12,items:[I('Кибераудиосистема','Cyberaudio Suite'),I('Внутренний агент','Internal Agent'),C(I('Toxin Binders','Toxin Binders'),I('Носовые фильтры','Nasal Filters'))]},
fixer:{loss:16,items:[I('Кибераудиосистема','Cyberaudio Suite'),I('Внутренний агент','Internal Agent'),I('Подкожный карман','Subdermal Pocket'),C(I('Voice Stress Analyzer','Voice Stress Analyzer'),I('Усиленный слух','Amplified Hearing'))]},
nomad:{loss:14,items:[C(I('Interface Plugs','Interface Plugs'),I('Wolvers','Wolvers')),I('Neural Link','Neural Link')]}
};
const sources={stats:[74,75,76,77],streetratSkills:[86,87],edgerunnerSkills:[88,89],gear:98,outfit:103,lifestyle:105,cyberware:117,culturalLanguage:45,lifepath:[45,53],roleLifepath:[54,69]};
const notes={ru:[
'Оба метода начинают способность роли на ранге 4; Lifepath и родной язык выбираются или генерируются отдельно.',
'Родной язык культурного происхождения даёт 4 бесплатных уровня; он не включён в 20 профессиональных навыков.',
'Streetrat использует одну строку таблицы характеристик; Edgerunner бросает отдельно для каждого из десяти столбцов.',
'Оружие, броня, одежда и импланты на страницах 98, 103 и 117 одинаковы для двух методов; дополнительные 500 eb можно потратить или оставить.',
'Выборы оружия и соответствующих боеприпасов нужно согласовать; предметы и импланты не устанавливаются автоматически.',
'Для Science и Play Instrument выбери конкретную специализацию; их нельзя считать готовыми без этого выбора.',
'Первый месяц оплачены жильё и образ жизни; у Exec и Nomad действуют отдельные условия. См. стр. 105 и способность роли.',
'Humanity Loss здесь — фиксированное значение стартового набора из стр. 117, а не бросок кубиков для последующей установки.'
],en:[
'Both methods start the Role Ability at rank 4; Lifepath and native language are chosen or generated separately.',
'The cultural native language grants 4 free levels; it is not included among the 20 Role skills.',
'Streetrat uses one row from the STAT table; Edgerunner rolls separately for each of the ten STAT columns.',
'The weapons, armor, clothing, and cyberware on pp. 98, 103, and 117 are shared by the two methods; the extra 500 eb can be spent or kept.',
'Weapon and ammunition choices need to match; items and cyberware are not automatically installed.',
'Science and Play Instrument require a named specialization and are not complete until it is chosen.',
'The first month of housing and lifestyle is paid; Exec and Nomad have separate conditions. See p. 105 and the relevant Role Ability.',
'Humanity Loss here is the fixed starting-package value on p. 117, not the dice roll for installation after creation.'
]};
function assertRole(role){if(!Object.hasOwn(statTables,role))throw new Error('Unknown role');}
function getSkills(role){assertRole(role);const src=skillRows[role];return basic.map((name,i)=>({name,level:src.base[i],costMultiplier:doubleCost.has(name)?2:1,required:true,needsSpecialty:false})).concat(src.extra.map(([name,level,needs])=>({name,level,costMultiplier:doubleCost.has(name)?2:1,required:false,needsSpecialty:needs==='choose'})));}
function fromRolls(role,method,rolls){assertRole(role);if(!['streetrat','edgerunner'].includes(method))throw new Error('Unsupported method');if(!Array.isArray(rolls)||rolls.length!==(method==='streetrat'?1:10)||rolls.some(n=>!Number.isInteger(n)||n<1||n>10))throw new Error('Expected one d10 for Streetrat or ten d10 rolls for Edgerunner');let values=method==='streetrat'?statTables[role][rolls[0]-1]:ORDER.map((_,i)=>statTables[role][rolls[i]-1][i]);return {stats:Object.fromEntries(ORDER.map((k,i)=>[k,values[i]])),rolls:[...rolls],page:rp[role].stats};}
function rollStats(role,method,random=Math.random){if(typeof random!=='function')throw new Error('Invalid random source');let n=method==='streetrat'?1:method==='edgerunner'?10:0;if(!n)throw new Error('Unsupported method');return fromRolls(role,method,Array.from({length:n},()=>{let v=random();if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>=1)throw new Error('Random source must return [0, 1)');return Math.floor(v*10)+1}));}
function validateEdgerunner(role,levels){let expected=getSkills(role),errors=[],points=0;if(!levels||typeof levels!=='object'||Array.isArray(levels))return {ok:false,points:0,errors:['invalid_levels']};for(const s of expected){let n=Number(levels[s.name]);if(!Number.isInteger(n)||n<2||n>6)errors.push('level:'+s.name);else points+=n*s.costMultiplier;}for(const k of Object.keys(levels))if(!expected.some(s=>s.name===k)&&Number(levels[k])!==0)errors.push('not_role_skill:'+k);if(points!==86)errors.push('points');return {ok:errors.length===0,points,errors};}
function copy(data){return JSON.parse(JSON.stringify(data));}
function getTemplate(role){assertRole(role);return copy({role,names:{ru:rp[role].ru,en:rp[role].en},pages:{stats:rp[role].stats,skills:rp[role].skills,edgerunnerSkills:rp[role].skills===86?88:89,gear:98,outfit:103,cyberware:117,lifestyle:105},statRows:statTables[role],streetratSkills:getSkills(role),edgerunnerSkills:getSkills(role).map(({name,costMultiplier,needsSpecialty})=>({name,costMultiplier,needsSpecialty,min:2,max:6})),gear:gear[role],outfit:outfit[role],cyberware:cyber[role].items,startingHumanityLoss:cyber[role].loss,roleRank:4,nativeLanguageLevels:4,extraCash:500,lifestyle:role==='exec'?{ru:'Corporate Conapt и Good Prepak: первый месяц оплачен; последующие месяцы образ жизни 600 eb.',en:'Corporate Conapt and Good Prepak: first month paid; subsequent lifestyle costs 600 eb/month.'}:{ru:'Cargo Container и Kibble: первый месяц оплачен; далее 1 100 eb/месяц. У Nomad могут быть дополнительные варианты.',en:'Cargo Container and Kibble: first month paid; thereafter 1,100 eb/month. Nomads may have additional options.'},notes});}
window.Archetypes={ORDER,roleIds:Object.keys(rp),sources,notes,getTemplate,getSkills,fromRolls,rollStats,validateEdgerunner};
})();
