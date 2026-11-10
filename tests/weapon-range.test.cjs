const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
global.window={};require('../site/combat-tools.js');require('../site/character-extra.js');
const X=window.CharacterExtra,source=f=>fs.readFileSync(__dirname+'/../site/'+f,'utf8');
const weapon=(over={})=>({id:'w',name:'Test',skill:'Handgun',stat:'REF',modifier:0,damage:'3d6',rof:2,capacity:8,ammo:8,ammoCost:1,usesAmmo:true,...over});
const person=weapons=>({name:'Vi',role:'fixer',hp:45,humanity:60,stats:{REF:7,DEX:6,BODY:8,WILL:6,EMP:6,LUCK:6},skills:{Handgun:6,'Shoulder Arms':4,Archery:2,Autofire:5},extra:{luck:6,luckUse:0,modifier:0,specializations:[],weapons}});
const change=(c,index,value)=>X.handle({type:'change',target:{dataset:{cxRange:String(index)},value,hasAttribute:()=>false}},c,'ru',{isCurrent:()=>true});
const attack=(c,index=0)=>X.handle({type:'click',target:{closest:()=>({dataset:{cxAction:'attack',cxIndex:String(index)}})}},c,'ru',{isCurrent:()=>true});

test('a sheet weapon finds its range table by the catalog entry, else by the attack skill (p. 173)',()=>{
 const type=(catalogId,skill='Handgun')=>X.rangeType(weapon({catalogId,skill}));
 assert.equal(type('weapon-medium-pistol'),'pistol');assert.equal(type('weapon-very-heavy-pistol'),'pistol');
 assert.equal(type('weapon-smg'),'smg');assert.equal(type('weapon-heavy-smg'),'smg');
 assert.equal(type('weapon-shotgun','Shoulder Arms'),'shotgun');assert.equal(type('weapon-assault-rifle','Shoulder Arms'),'assault');assert.equal(type('weapon-sniper-rifle','Shoulder Arms'),'sniper');
 assert.equal(type('weapon-bows-crossbows','Archery'),'bow');assert.equal(type('weapon-grenade-launcher','Heavy Weapons'),'grenade');assert.equal(type('weapon-rocket-launcher','Heavy Weapons'),'rocket');
 assert.equal(type('weapon-medium-melee-weapon','Melee Weapon'),'');assert.equal(type('weapon-flamethrower','Heavy Weapons'),'','an exotic weapon without a table gets no guess');
 assert.equal(type(undefined,'Handgun'),'pistol');assert.equal(type(undefined,'Archery'),'bow');assert.equal(type(undefined,'Shoulder Arms'),'','a hand-made long gun could be any of three tables');
});

test('the bands list only the ranges the weapon can shoot at, with the DV from the table',()=>{
 const pistol=X.rangeBands(weapon({catalogId:'weapon-heavy-pistol'}));
 assert.deepEqual(pistol.map(b=>b.dv),[13,15,20,25,30,30]);assert.deepEqual([pistol[0].from,pistol[0].to,pistol.at(-1).from,pistol.at(-1).to],[0,6,101,200]);
 assert.deepEqual(X.rangeBands(weapon({catalogId:'weapon-sniper-rifle'})).map(b=>b.dv),[30,25,25,20,15,16,17,20]);
 assert.deepEqual(X.rangeBands(weapon({catalogId:'weapon-medium-melee-weapon',skill:'Melee Weapon'})),[]);
});

test('the weapon row shows what the attack adds, the range choice and autofire only where it applies',()=>{
 const c=person([weapon({catalogId:'weapon-heavy-pistol',modifier:1}),weapon({id:'r',catalogId:'weapon-assault-rifle',skill:'Shoulder Arms'}),weapon({id:'k',skill:'Melee Weapon',stat:'DEX',usesAmmo:false})]);
 const html=X.render(c,'ru'),rows=html.split('class="cx-entry cx-weapon"').slice(1);
 assert.equal(rows.length,3);
 assert.match(rows[0],/data-cx-attack-total="0">\+14</,'REF 7 + Handgun 6 + weapon 1');
 assert.match(rows[0],/<option value="2">13–25 м · DV 20<\/option>/);assert.doesNotMatch(rows[0],/data-sheet-autofire/);
 assert.match(rows[1],/data-sheet-autofire="assault"/);assert.match(rows[1],/data-cx-attack-total="1">\+11</);
 assert.doesNotMatch(rows[2],/data-cx-range/);
 for(const row of rows){assert.match(row,/<details class="cx-weapon-edit" data-cx-weapon-edit="\d">/,'a named weapon keeps its form folded');assert.match(row,/data-cx-key="damage"/,'every field is still there')}
 assert.equal(X.attackBonus(c,0),14);assert.equal(X.attackBonus(c,9),null);
});

test('a new, unnamed weapon opens its form at once',()=>{
 assert.match(X.render(person([weapon({name:''})]),'ru'),/<details class="cx-weapon-edit" data-cx-weapon-edit="0" open>/);
});

test('the chosen range gives the attack its DV and stays for the next shot',()=>{
 const c=person([weapon({catalogId:'weapon-heavy-pistol'})]);
 assert.equal(attack(c).roll.dv,0,'no range, no DV');
 assert.deepEqual(change(c,0,'2'),{handled:true},'choosing a range does not touch saved data');
 assert.equal(attack(c).roll.dv,20);assert.equal(attack(c).roll.dv,20);
 assert.match(X.render(c,'ru'),/<option value="2" selected>13–25 м · DV 20/);
 change(c,0,'7');assert.equal(attack(c).roll.dv,20,'a band the weapon cannot reach is ignored');
 change(c,0,'');assert.equal(attack(c).roll.dv,0);
 assert.equal(JSON.stringify(c).includes('rangeChoice'),false);
});

test('a check judged against a DV succeeds only above it',()=>{
 const app=source('app.js');
 assert.match(app,/beat=dv\?total>dv:null/);
 assert.match(app,/\$\{dv\?` = \$\{total\} \$\{beat\?'>':'≤'\} DV \$\{dv\} — /);
 assert.match(app,/\{dv:window\.SheetTabs\?\.takeDV\?\.\(\)\|\|0\}/,'a skill check takes the DV set for the next roll');
 assert.match(app,/dv:q\.dv\|\|window\.SheetTabs\?\.takeDV\?\.\(\)\|\|0/,'a weapon attack uses its range DV first');
});

test('the next-roll bar offers the book difficulty ladder and play mode locks STATs and Skills',()=>{
 const tabs=source('sheet-tabs.js');
 assert.match(tabs,/DVS=\[\[9,'Простая','Simple'\],\[13,'Обычная','Everyday'\],\[15,'Сложная','Difficult'\],\[17,'Профессиональная','Professional'\],\[21,'Героическая','Heroic'\],\[24,'Невероятная','Incredible'\],\[29,'Легендарная','Legendary'\]\]/);
 assert.match(tabs,/function takeDV\(\)\{const value=dv;if\(dv\)\{dv=0;/);
 assert.match(tabs,/querySelectorAll\('input\[data-stat\],input\[data-skill\]'\)\)el\.readOnly=locked/);
 assert.match(source('theme.css'),/\.sheet-locked :is\(input\[data-stat\], input\[data-skill\]\) \{ pointer-events: none;/);
});
