/* Corebook NET defenses and weapon reference. Sources: print pp. 342–344, 372–375.
   Loaded after catalog.js. Descriptions and prices are reference data, not automatic combat rules. */
(function(){
'use strict';
if(!Array.isArray(window.CATALOG))throw Error('catalog.js must load before defenses-extra.js');
const priceByDV={9:500,13:1000,17:5000,21:10000};
const tr=(ru,en)=>({ru,en});
const known=new Set(window.CATALOG.map(x=>x.id));
function defense(id,ru,en,page,dv,minutes,dr,de,triggerRu,triggerEn,stats={}){
 const item={id:'extra-defense-'+id,category:'defenses',name:tr(ru,en),price:priceByDV[dv],priceUnit:tr('за защиту','per defense'),page,
 details:tr(`${dr} Обход: Electronics/Security Tech DV${dv}, ${minutes} мин. Цена только за защиту; NET-архитектура и Control Node оплачиваются отдельно.`,`${de} Counter: Electronics/Security Tech DV${dv}, ${minutes} min. Price covers the defense only; NET architecture and Control Node are separate.`),
 stats:{type:'net-defense-example',counterDV:dv,counterMinutes:minutes,trigger:tr(triggerRu,triggerEn),...stats}};
 if(!Number.isInteger(item.price)||known.has(item.id))throw Error('Invalid or duplicate defense '+item.id);
 known.add(item.id);window.CATALOG.push(item);
}
const unauthRu='Вход в защищённую область без нужного пропуска.',unauthEn='Enters the defended area without the required badge.';
// Active defenses (p. 373).
defense('air-swarm','Рой воздушных дронов','Air Swarm Drone Cloud',373,17,5,'Единая группа атакует как очень тяжёлое оружие ближнего боя; MOVE 8, HP 15.','A single cloud attacks as a Very Heavy Melee Weapon; MOVE 8, HP 15.',unauthRu,unauthEn,{kind:'active',move:8,hp:15});
defense('ground-drone','Наземный дрон','Ground Drone',373,21,5,'MOVE 4, HP 30; две опции из пистолета, SMG и камеры.','MOVE 4, HP 30; choose two of pistol, SMG and camera.',unauthRu,unauthEn,{kind:'active',move:4,hp:30});
defense('large-air-drone','Большой воздушный дрон','Large Air Drone',373,21,5,'MOVE 6, HP 20; две опции из дротикомёта, пистолета и камеры.','MOVE 6, HP 20; choose two of dartgun, pistol and camera.',unauthRu,unauthEn,{kind:'active',move:6,hp:20});
defense('mini-air-drone','Мини-дрон','Mini Air Drone',373,17,5,'MOVE 6, HP 15; одна опция из дротикомёта, пистолета и камеры.','MOVE 6, HP 15; choose one of dartgun, pistol and camera.',unauthRu,unauthEn,{kind:'active',move:6,hp:15});
defense('spider-drone','Шагающий паук-дрон','Spider Walking Drone',373,21,5,'MOVE 4, HP 40; две опции из гранатомёта, оружия ближнего боя, тяжёлого SMG и камеры.','MOVE 4, HP 40; choose two of grenade launcher, melee weapon, heavy SMG and camera.',unauthRu,unauthEn,{kind:'active',move:4,hp:40});
// Emplaced defenses (p. 374).
defense('blood-swarm','Автоматический кровавый рой','Automated Blood Swarm',374,21,5,'Проверка Resist Torture/Drugs против DV15; при провале 3d6 напрямую к HP без истощения брони. Фильтрация газа блокирует эффект.','Resist Torture/Drugs against DV15; on failure 3d6 direct HP damage without armor ablation. Gas filtration blocks the effect.',unauthRu,unauthEn,{kind:'emplaced',resistDV:15,damage:'3d6',damageDirect:true});
defense('melee-weapon','Автоматическое оружие ближнего боя','Automated Melee Weapon',374,17,5,'Очень тяжёлое оружие ближнего боя; Combat Number 14, HP 25.','Very Heavy Melee Weapon; Combat Number 14, HP 25.',unauthRu,unauthEn,{kind:'emplaced',combatNumber:14,hp:25});
defense('turret','Автоматическая турель','Automated Turret',374,17,5,'Оборудуется дальнобойным оружием; Combat Number 14, HP 25.','Can be equipped with a ranged weapon; Combat Number 14, HP 25.',unauthRu,unauthEn,{kind:'emplaced',combatNumber:14,hp:25});
// Environmental defenses (pp. 374–375).
defense('observation-cameras','Камеры наблюдения','Observation Cameras',374,9,1,'Видят при слабом свете, в инфракрасном и ультрафиолетовом диапазонах; HP 5, обнаружение DV17.','See low light, infrared and UV; HP 5, Perception DV17 to spot.', 'Вход в комнату.','A target enters the room.',{kind:'environmental',hp:5,detectDV:17});
defense('tanglefoot-flooring','Пол-ловушка Tanglefoot','Tanglefoot Flooring',374,13,1,'Снижает MOVE на 1d6 до выхода из ловушки или её уничтожения; HP 20, обнаружение DV17.','Reduces MOVE by 1d6 until escape or destruction; HP 20, Perception DV17 to spot.','Наступают на покрытие.','A target steps onto the flooring.',{kind:'environmental',hp:20,detectDV:17,movePenalty:'1d6'});
defense('electrical-flooring','Электрический пол','Electrical Flooring',374,13,1,'Наносит 6d6 урона телу; броня уменьшает урон, но не истощается. Повторяет удар в конце следующих ходов, пока цель не уйдёт.','Deals 6d6 body damage reduced by armor without ablating it; repeats at the end of subsequent turns until the target leaves.','Наступают на сетку.','A target steps onto the grid.',{kind:'environmental',hp:20,detectDV:17,damage:'6d6'});
defense('laser-grid','Лазерная сетка','Laser Grid',375,17,5,'Касание как удар очень тяжёлым оружием ближнего боя; замеченную сетку можно пройти с Contortionist DV17.','Touching a beam is a Very Heavy Melee Weapon hit; if spotted, cross with Contortionist DV17.','Вход или перемещение на 2 м/ярда в защищённой области.','Entering or moving 2 m/yd within the defended area.',{kind:'environmental',detectDV:17,avoidDV:17,avoidSkill:'Contortionist'});
defense('tip-floor','Опрокидывающийся пол','Tip-floor',375,13,1,'Яма; Athletics DV15 для спасения. На дне могут быть шипы с уроном 6d6 телу.','A pit trap; Athletics DV15 to save oneself. The pit may contain spikes dealing 6d6 body damage.','Наступают на ловушку.','A target steps onto the tip-floor.',{kind:'environmental',detectDV:17,avoidDV:15,avoidSkill:'Athletics'});
defense('goop','Липкая пена','Goop',375,13,1,'Снижает MOVE на 2d6 до уничтожения или выхода из области; HP 10, обнаружение DV17.','Reduces MOVE by 2d6 until destroyed or the target escapes; HP 10, Perception DV17 to spot.','Вход в область распыления.','A target enters the spray area.',{kind:'environmental',hp:10,detectDV:17,movePenalty:'2d6'});
defense('punchers','Потолочные или настенные ударники','Ceiling / Wall Punchers',375,13,5,'Стальные стержни наносят 6d6 урона телу с учётом брони; HP 20, обнаружение DV17.','Steel rods deal 6d6 body damage reduced by armor; HP 20, Perception DV17 to spot.','Наступают на область сетки.','A target steps onto the grid area.',{kind:'environmental',hp:20,detectDV:17,damage:'6d6'});
defense('slip-floor','Скользкий пол','Slip-floor',375,13,1,'Перемещение в области требует Athletics DV15, иначе цель падает ничком; HP 10, обнаружение DV17.','Movement requires Athletics DV15 or the target falls Prone; HP 10, Perception DV17 to spot.','Вход в область распыления.','A target enters the spray area.',{kind:'environmental',hp:10,detectDV:17,avoidDV:15,avoidSkill:'Athletics'});
defense('stun-panels','Ослепляющие панели','Stun Panels',375,13,1,'Resist Torture/Drugs DV15; при провале повреждение глаза и уха на минуту без бонусного урона; HP 5.','Resist Torture/Drugs DV15; failure causes Damaged Eye and Damaged Ear for one minute without bonus damage; HP 5.','Цель подходит на 2 м/ярда к панели.','A target moves within 2 m/yd of a panel.',{kind:'environmental',hp:5,detectDV:17,resistDV:15});
defense('sleep-gas-elevator','Лифт с усыпляющим газом','Sleep Gas Elevator',375,17,5,'В запертом помещении Resist Torture/Drugs DV13, иначе потеря сознания до пробуждения; HP 60.','In the sealed space, Resist Torture/Drugs DV13 or become Unconscious until awakened; HP 60.','Вход в закрытую область.','A target enters the enclosed area.',{kind:'environmental',hp:60,detectDV:17,resistDV:13});
// Data only: prices are a discrete table, never an assumed multiplier.
window.WEAPON_MODIFIERS={
 sourcePages:[342,343,344],
 quality:{
  poor:{name:tr('Низкое качество','Poor quality'),attackModifier:0,description:tr('При натуральной 1 на проверке атаки оружие выходит из строя; на устранение тратится действие без проверки.','On a natural 1 on an attack check, the weapon malfunctions; clearing it takes an Action and no check.'),naturalOneMalfunction:true},
  standard:{name:tr('Обычное качество','Standard quality'),attackModifier:0,description:tr('Базовая стоимость и параметры.','Base cost and properties.')},
  excellent:{name:tr('Отличное качество','Excellent quality'),attackModifier:1,description:tr('+1 к проверке атаки этим оружием.','+1 to attack checks with this weapon.')},
  costs:[{standard:50,poor:20,excellent:100},{standard:100,poor:50,excellent:500},{standard:500,poor:100,excellent:1000}],
  restriction:tr('Экзотическое оружие обычно имеет обычное качество, если в его описании не указано иначе.','Exotic weapons are normally Average Quality unless their description says otherwise.')
 },
 magazines:{page:344,oneAttached:true,restriction:tr('Магазины подходят неэкзотическому дальнобойному оружию, кроме луков и арбалетов. При расширенном или барабанном магазине оружие нельзя скрыть под одеждой.','Magazines fit non-exotic ranged weapons except bows and crossbows. Extended or drum magazines prevent concealment under clothing.'),rows:[
  {id:'weapon-medium-pistol',type:tr('Средний пистолет','Medium Pistol'),standard:12,extended:18,drum:36},
  {id:'weapon-heavy-pistol',type:tr('Тяжёлый пистолет','Heavy Pistol'),standard:8,extended:14,drum:28},
  {id:'weapon-very-heavy-pistol',type:tr('Очень тяжёлый пистолет','Very Heavy Pistol'),standard:8,extended:14,drum:28},
  {id:'weapon-smg',type:tr('Пистолет-пулемёт','SMG'),standard:30,extended:40,drum:50},
  {id:'weapon-heavy-smg',type:tr('Тяжёлый пистолет-пулемёт','Heavy SMG'),standard:40,extended:50,drum:60},
  {id:'weapon-shotgun',type:tr('Дробовик','Shotgun'),standard:4,extended:8,drum:16},
  {id:'weapon-assault-rifle',type:tr('Штурмовая винтовка','Assault Rifle'),standard:25,extended:35,drum:45},
  {id:'weapon-sniper-rifle',type:tr('Снайперская винтовка','Sniper Rifle'),standard:4,extended:8,drum:12},
  {id:'weapon-grenade-launcher',type:tr('Гранатомёт','Grenade Launcher'),standard:2,extended:4,drum:6},
  {id:'weapon-rocket-launcher',type:tr('Ракетная установка','Rocket Launcher'),standard:1,extended:2,drum:3}
 ]},
 attachmentRule:tr('Обычное неэкзотическое дальнобойное оружие имеет три слота модификаций; дубли одной модификации не дают дополнительного эффекта. Совместимость зависит от типа оружия.','A non-exotic ranged weapon has three attachment slots; duplicate attachments provide no additional effect. Eligibility depends on weapon type.'),
 attachments:[
  {id:'bayonet',name:tr('Штык','Bayonet'),price:100,slots:1,page:343,eligibility:tr('Неэкзотическое оружие навыка Shoulder Arms','Non-exotic Shoulder Arms weapons'),effect:tr('Можно применять как лёгкое оружие ближнего боя; под одеждой не скрывается.','Can be used as a Light Melee Weapon; cannot be concealed.')},
  {id:'drum-magazine',name:tr('Барабанный магазин','Drum Magazine'),price:500,slots:1,page:343,eligibility:tr('Неэкзотическое дальнобойное оружие, кроме лука/арбалета','Non-exotic ranged weapons except bows/crossbows'),effect:tr('Ёмкость по таблице Drum; только один магазин.','Capacity uses the Drum column; only one magazine.')},
  {id:'extended-magazine',name:tr('Расширенный магазин','Extended Magazine'),price:100,slots:1,page:343,eligibility:tr('Неэкзотическое дальнобойное оружие, кроме лука/арбалета','Non-exotic ranged weapons except bows/crossbows'),effect:tr('Ёмкость по таблице Extended; только один магазин.','Capacity uses the Extended column; only one magazine.')},
  {id:'grenade-underbarrel',name:tr('Подствольный гранатомёт','Grenade Launcher Underbarrel'),price:500,slots:2,page:343,eligibility:tr('Неэкзотическое оружие навыка Shoulder Arms','Non-exotic Shoulder Arms weapons'),effect:tr('При удержании двумя руками действует как гранатомёт с одной гранатой; не скрывается.','When wielded in two hands, works as a grenade launcher holding one grenade; cannot be concealed.')},
  {id:'nightvision-scope',name:tr('Инфракрасный ночной прицел','Infrared Nightvision Scope'),price:500,slots:1,page:343,eligibility:tr('Неэкзотическое дальнобойное оружие','Non-exotic ranged weapons'),effect:tr('Убирает штрафы к стрельбе из-за тьмы, дыма или тумана; различает тепло и холод.','Removes firing penalties from darkness, smoke or fog; distinguishes heat from cold.')},
  {id:'shotgun-underbarrel',name:tr('Подствольный дробовик','Shotgun Underbarrel'),price:500,slots:2,page:343,eligibility:tr('Неэкзотическое оружие навыка Shoulder Arms','Non-exotic Shoulder Arms weapons'),effect:tr('При удержании двумя руками действует как дробовик с двумя патронами; не скрывается.','When wielded in two hands, works as a shotgun holding two shots; cannot be concealed.')},
  {id:'smartgun-link',name:tr('Smartgun Link','Smartgun Link'),price:500,slots:2,page:344,eligibility:tr('Неэкзотическое дальнобойное оружие; требуется Neural Link и Interface Plugs или Subdermal Grip','Non-exotic ranged weapon; requires Neural Link plus Interface Plugs or Subdermal Grip'),effect:tr('+1 к проверке дальней атаки при подключении.','+1 to ranged attack checks when connected.')},
  {id:'sniping-scope',name:tr('Снайперский прицел','Sniping Scope'),price:100,slots:1,page:344,eligibility:tr('Неэкзотическое дальнобойное оружие','Non-exotic ranged weapons'),effect:tr('+1 при одиночном или прицельном выстреле на 51 м/ярд и дальше; не складывается с TeleOptics.','+1 on single-shot or Aimed Shot attacks at 51 m/yd or more; does not stack with TeleOptics.')}
 ],
 brandExamples:[
  {type:'Medium Pistol',poor:'Dai Lung Streetmaster',standard:'Federated Arms X-9mm',excellent:'Militech Avenger'},
  {type:'Heavy Pistol',poor:'Dai Lung Magnum',standard:'Mustang Arms Mark III',excellent:'Nova Cityhunter'},
  {type:'Very Heavy Pistol',poor:'Federated Arms Super Chief',standard:'Sternmeyer P-35',excellent:'Militech Boomer Buster'},
  {type:'Bow',poor:'GunMart Sherwood',standard:'Eagletech Tomcat',excellent:'Eagletech Bearcat'},
  {type:'Crossbow',poor:'GunMart Hunter',standard:'Eagletech Striker',excellent:'Eagletech Scorpion'},
  {type:'SMG',poor:'Federated Arms Tech-Assault III',standard:'Militech Mini-Gat',excellent:'Arasaka Minami 10'},
  {type:'Heavy SMG',poor:'Chadran Arms City Reaper',standard:'Sternmeyer SMG-21',excellent:'Militech Viper'},
  {type:'Shotgun',poor:'GunMart Home Defender',standard:'Arasaka Rapid Assault',excellent:'Militech Bulldog'},
  {type:'Assault Rifle',poor:'Chadran Arms Jungle Reaper',standard:'Militech Ronin',excellent:'Militech Dragon'},
  {type:'Sniper Rifle',poor:'GunMart Snipe-Star',standard:'Nomad Long Rifle',excellent:'Arasaka WSSA Sniper System'},
  {type:'Grenade Launcher',poor:'Towa Manufacturing Type-G',standard:'Militech Mini-Grenade',excellent:'Tsunami Arms Type-18'},
  {type:'Rocket Launcher',poor:'Towa Manufacturing Type-R',standard:'Militech Urban',excellent:'Militech Hotshot'}
 ]
};
window.DEFENSES_EXTRA_COUNT=18;
})();
