/* The one table of Critical Injuries (Corebook pp. 187–188, 223): body and head, 2d6 score 2..12.
   Every other part of the app reads it from here instead of keeping a copy:
     - combat-tools.js  INJURIES  (names, effect text, Quick Fix / Treatment DVs)  <- CritInjuries.table()
     - effects.js       INJURY    (numbers added to checks, MOVE, Death Save; reminders) <- CritInjuries.effects()
     - critical-injury-tools.js   reads the effect text through CombatTools.INJURIES
     - medical-tools.js keeps its own list of names and treatment rules; tests/crit-injuries.test.cjs pins its names to this table.
   A row: {score, en, ru, effect:{en,ru}, quick, treatment, mods:{all,melee,ranged,move,death}, note:[ru,en]|null}.
   mods are numbers (all = every check, melee/ranged = attacks of that kind, move = MOVE, death = Base Death Save Penalty).
   Sets window.CritInjuries; a test that loads one of the tools on its own loads this file first. */
(function(global){
'use strict';
const ROWS={body:[
 {"score":2,"en":"Dismembered Arm","ru":"Потеря руки","effect":{"en":"Arm lost; drop held items. Base Death Save Penalty +1.","ru":"Рука потеряна; предметы из неё выпадают. Базовый штраф Death Save +1."},"quick":"—","treatment":"Surgery DV17","mods":{"death":1},"note":null},
 {"score":3,"en":"Dismembered Hand","ru":"Потеря кисти","effect":{"en":"Hand lost; drop held items. Base Death Save Penalty +1.","ru":"Кисть потеряна; предметы из неё выпадают. Базовый штраф Death Save +1."},"quick":"—","treatment":"Surgery DV17","mods":{"death":1},"note":null},
 {"score":4,"en":"Collapsed Lung","ru":"Коллапс лёгкого","effect":{"en":"MOVE −2 (minimum 1); base Death Save Penalty +1.","ru":"MOVE −2 (минимум 1); базовый штраф Death Save +1."},"quick":"Paramedic DV15","treatment":"Surgery DV15","mods":{"move":-2,"death":1},"note":null},
 {"score":5,"en":"Broken Ribs","ru":"Сломанные рёбра","effect":{"en":"At the end of a turn moving over 4 m/yd on foot, suffer 5 direct HP damage again.","ru":"В конце хода при перемещении пешком более 4 м/ярдов снова теряете 5 HP."},"quick":"Paramedic DV13","treatment":"Paramedic DV15 / Surgery DV13","mods":{},"note":["Более 4 м пешком за ход: снова 5 урона","Over 4 m on foot in a turn: 5 damage again"]},
 {"score":6,"en":"Broken Arm","ru":"Сломанная рука","effect":{"en":"Cannot use the arm; drop items held in that hand.","ru":"Рука недоступна; предметы из неё выпадают."},"quick":"Paramedic DV13","treatment":"Paramedic DV15 / Surgery DV13","mods":{},"note":["Рука не действует","The arm cannot be used"]},
 {"score":7,"en":"Foreign Object","ru":"Инородный предмет","effect":{"en":"At the end of a turn moving over 4 m/yd on foot, suffer 5 direct HP damage again.","ru":"В конце хода при перемещении пешком более 4 м/ярдов снова теряете 5 HP."},"quick":"First Aid / Paramedic DV13","treatment":"Quick Fix","mods":{},"note":["Более 4 м пешком за ход: снова 5 урона","Over 4 m on foot in a turn: 5 damage again"]},
 {"score":8,"en":"Broken Leg","ru":"Сломанная нога","effect":{"en":"MOVE −4 (minimum 1).","ru":"MOVE −4 (минимум 1)."},"quick":"Paramedic DV13","treatment":"Paramedic DV15 / Surgery DV13","mods":{"move":-4},"note":null},
 {"score":9,"en":"Torn Muscle","ru":"Разрыв мышцы","effect":{"en":"−2 to melee attacks.","ru":"−2 к атакам ближнего боя."},"quick":"First Aid / Paramedic DV13","treatment":"Quick Fix","mods":{"melee":-2},"note":null},
 {"score":10,"en":"Spinal Injury","ru":"Травма позвоночника","effect":{"en":"No Action next turn; a Move Action is still possible. Base Death Save Penalty +1.","ru":"В следующий ход нельзя совершать Action, но можно двигаться. Базовый штраф Death Save +1."},"quick":"Paramedic DV15","treatment":"Surgery DV15","mods":{"death":1},"note":["Следующий ход без Action","No Action next turn"]},
 {"score":11,"en":"Crushed Fingers","ru":"Раздробленные пальцы","effect":{"en":"−4 to Actions involving the hand.","ru":"−4 к действиям этой кистью."},"quick":"Paramedic DV13","treatment":"Surgery DV15","mods":{},"note":["−4 к действиям этой кистью","−4 to Actions with that hand"]},
 {"score":12,"en":"Dismembered Leg","ru":"Потеря ноги","effect":{"en":"MOVE −6 (minimum 1); cannot dodge; base Death Save Penalty +1.","ru":"MOVE −6 (минимум 1); нельзя уклоняться; базовый штраф Death Save +1."},"quick":"—","treatment":"Surgery DV17","mods":{"move":-6,"death":1},"note":["Уклоняться нельзя","Cannot dodge"]}
],head:[
 {"score":2,"en":"Lost Eye","ru":"Потеря глаза","effect":{"en":"−4 ranged attacks and vision-based Perception; base Death Save Penalty +1.","ru":"−4 к дальним атакам и визуальному восприятию; базовый штраф Death Save +1."},"quick":"—","treatment":"Surgery DV17","mods":{"ranged":-4,"death":1},"note":["−4 к зрительному Восприятию","−4 to Perception by sight"]},
 {"score":3,"en":"Brain Injury","ru":"Травма мозга","effect":{"en":"−2 to all Actions; base Death Save Penalty +1.","ru":"−2 ко всем действиям; базовый штраф Death Save +1."},"quick":"—","treatment":"Surgery DV17","mods":{"all":-2,"death":1},"note":null},
 {"score":4,"en":"Damaged Eye","ru":"Повреждённый глаз","effect":{"en":"−2 ranged attacks and vision-based Perception.","ru":"−2 к дальним атакам и визуальному восприятию."},"quick":"Paramedic DV15","treatment":"Surgery DV13","mods":{"ranged":-2},"note":["−2 к зрительному Восприятию","−2 to Perception by sight"]},
 {"score":5,"en":"Concussion","ru":"Сотрясение","effect":{"en":"−2 to all Actions.","ru":"−2 ко всем действиям."},"quick":"First Aid / Paramedic DV13","treatment":"Quick Fix","mods":{"all":-2},"note":null},
 {"score":6,"en":"Broken Jaw","ru":"Сломанная челюсть","effect":{"en":"−4 to Actions involving speech.","ru":"−4 к действиям, требующим речи."},"quick":"Paramedic DV13","treatment":"Paramedic / Surgery DV13","mods":{},"note":["−4 к действиям, требующим речи","−4 to Actions that need speech"]},
 {"score":7,"en":"Foreign Object","ru":"Инородный предмет","effect":{"en":"At the end of a turn moving over 4 m/yd on foot, suffer 5 direct HP damage again.","ru":"В конце хода при перемещении пешком более 4 м/ярдов снова теряете 5 HP."},"quick":"First Aid / Paramedic DV13","treatment":"Quick Fix","mods":{},"note":["Более 4 м пешком за ход: снова 5 урона","Over 4 m on foot in a turn: 5 damage again"]},
 {"score":8,"en":"Whiplash","ru":"Хлыстовая травма шеи","effect":{"en":"Base Death Save Penalty +1.","ru":"Базовый штраф Death Save +1."},"quick":"Paramedic DV13","treatment":"Paramedic / Surgery DV13","mods":{"death":1},"note":null},
 {"score":9,"en":"Cracked Skull","ru":"Трещина черепа","effect":{"en":"Penetrating Aimed Shot damage to head ×3 instead of ×2; base Death Save Penalty +1.","ru":"Прицельный урон в голову после брони ×3 вместо ×2; базовый штраф Death Save +1."},"quick":"Paramedic DV15","treatment":"Paramedic / Surgery DV15","mods":{"death":1},"note":["Прицельный урон в голову сквозь броню ×3","Aimed head damage through armor ×3"]},
 {"score":10,"en":"Damaged Ear","ru":"Повреждённое ухо","effect":{"en":"If you move over 4 m/yd on foot, no Move Action next turn; −2 hearing-based Perception.","ru":"После перемещения пешком более 4 м/ярдов нельзя двигаться в следующий ход; −2 к восприятию на слух."},"quick":"Paramedic DV13","treatment":"Surgery DV13","mods":{},"note":["−2 к Восприятию на слух; после 4 м пешком — ход без движения","−2 to Perception by hearing; after 4 m on foot, no Move next turn"]},
 {"score":11,"en":"Crushed Windpipe","ru":"Повреждённая трахея","effect":{"en":"Cannot speak; base Death Save Penalty +1.","ru":"Нельзя говорить; базовый штраф Death Save +1."},"quick":"—","treatment":"Surgery DV15","mods":{"death":1},"note":["Говорить нельзя","Cannot speak"]},
 {"score":12,"en":"Lost Ear","ru":"Потеря уха","effect":{"en":"If you move over 4 m/yd on foot, no Move Action next turn; −4 hearing-based Perception; base Death Save Penalty +1.","ru":"После перемещения пешком более 4 м/ярдов нельзя двигаться в следующий ход; −4 к восприятию на слух; базовый штраф Death Save +1."},"quick":"—","treatment":"Surgery DV17","mods":{"death":1},"note":["−4 к Восприятию на слух; после 4 м пешком — ход без движения","−4 to Perception by hearing; after 4 m on foot, no Move next turn"]}
]};
const LOCATIONS=['body','head'];
const clone=x=>JSON.parse(JSON.stringify(x));
// The row for a location and a 2d6 total, or null.
function row(location,score){const list=ROWS[location];return list&&Number.isInteger(score)&&score>=2&&score<=12?list[score-2]:null}
// What combat-tools.js has always shown: {body:[{en,ru,effect,quick,treatment}, ...11], head:[...]}, indexed by score-2.
function table(){const out={};for(const loc of LOCATIONS)out[loc]=ROWS[loc].map(r=>({en:r.en,ru:r.ru,effect:{en:r.effect.en,ru:r.effect.ru},quick:r.quick,treatment:r.treatment}));return out}
// What effects.js has always used: {body:{score:{move,death,note}}, head:{...}}; scores without a number or a reminder are left out.
function effects(){const out={body:{},head:{}};for(const loc of LOCATIONS)for(const r of ROWS[loc]){const e={...r.mods};if(r.note)e.note=[r.note[0],r.note[1]];if(Object.keys(e).length)out[loc][r.score]=e}return out}
function name(location,score,lang){const r=row(location,score);return r?r[lang==='en'?'en':'ru']:''}
const api={ROWS,LOCATIONS,row,table,effects,name,all:()=>clone(ROWS)};
if(global)global.CritInjuries=api;
})(typeof window==='object'?window:typeof globalThis==='object'?globalThis:null);
