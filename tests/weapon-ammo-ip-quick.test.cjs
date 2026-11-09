const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const base=__dirname+'/../site/';
function setup(){const w={SKILL_LABELS:{Handgun:{ru:'Пистолеты',en:'Handgun'},Autofire:{ru:'Автоматический огонь',en:'Autofire'}}},ctx={window:w,console,Math,Date,globalThis:{crypto:{randomUUID:()=>'uuid'}}};w.confirm=()=>true;vm.createContext(ctx);for(const f of ['catalog.js','catalog-extra.js','equipment-tools.js','character-extra.js','reload-tools.js','weapon-ammo.js','ip-quick.js'])vm.runInContext(fs.readFileSync(base+f,'utf8'),ctx,{filename:f});w.ReloadTools.setScope('account-a');return w}
const clone=x=>JSON.parse(JSON.stringify(x));
function character(){return {id:'p',role:'solo',rank:4,skills:{Handgun:2,Autofire:3},extra:{ipOpening:500,ipLog:[],weapons:[
 {id:'pistol',catalogId:'weapon-medium-pistol',name:'Pistol',skill:'Handgun',capacity:12,ammo:12,usesAmmo:true},
 {id:'ar',catalogId:'weapon-assault-rifle',name:'AR',skill:'Shoulder Arms',capacity:25,ammo:25,usesAmmo:true},
 {id:'knife',catalogId:'weapon-light-melee-weapon',name:'Knife',skill:'Melee Weapon',capacity:0,ammo:0,usesAmmo:false}],
 items:[{id:'ammo',catalogId:'ammo-basic-ammunition',name:'Basic',quantity:30,ammoType:'medium-pistol',purchase:{itemId:'ammo-basic-ammunition',ammoType:'medium-pistol',perPack:10,quantity:3,ammoCount:30,total:30}}]}}}

test('single shot and burst spend rounds and never go below zero',()=>{
 const w=setup(),A=w.WeaponAmmo,c=character(),ar=c.extra.weapons[1];
 assert.equal(A.spend(ar,1).ammo,24);assert.equal(A.spend(ar,A.BURST).ammo,14);
 ar.ammo=9;const r=A.spend(ar,A.BURST);assert.equal(r.ok,false);assert.equal(ar.ammo,9);
 ar.ammo=1;assert.equal(A.spend(ar,1).ammo,0);assert.equal(A.spend(ar,1).ok,false);assert.equal(ar.ammo,0);
});
test('melee and non-ammo weapons are untracked and render nothing',()=>{
 const w=setup(),A=w.WeaponAmmo,c=character(),knife=c.extra.weapons[2];
 assert.equal(A.tracks(knife),false);assert.equal(A.spend(knife,1).ok,false);assert.equal(A.row(c,knife,'en'),'');
 assert.equal(A.row(c,{...knife,usesAmmo:true,skill:'Melee Weapon',capacity:5,ammo:5},'en'),'');
});
test('burst button only for autofire-capable weapons; empty state warns; reload offered for standard weapons',()=>{
 const w=setup(),A=w.WeaponAmmo,c=character(),[pistol,ar]=c.extra.weapons;
 assert.equal(A.canAutofire(pistol),false);assert.equal(A.canAutofire(ar),true);
 assert(!A.row(c,pistol,'en').includes('data-wa="burst"'));assert(A.row(c,ar,'ru').includes('data-wa="burst"'));assert(A.row(c,ar,'ru').includes('Очередь'));
 pistol.ammo=0;const html=A.row(c,pistol,'en');assert(html.includes('data-wa-state="empty"'));assert(html.includes('Magazine empty'));assert(html.includes('data-reload="quick"'));
 assert(/data-wa="shot"[^>]*disabled/.test(html));
 c.extra.weapons.push({id:'custom',name:'Home <b>',skill:'Handgun',capacity:6,ammo:6,usesAmmo:true});assert(!A.row(c,c.extra.weapons[3],'en').includes('data-reload'));
});
test('row reload reuses the reload flow: consumes stock, fills magazine, refuses non-empty',()=>{
 const w=setup(),c=character(),ctx=w.ReloadTools;
 const mk=()=>{const b={dataset:{reload:'quick',weaponId:'pistol'},isConnected:true,closest:s=>s==='[data-reload]'?b:null};return {type:'click',target:{closest:s=>s==='[data-reload]'?b:null}}};
 let r=ctx.handle(mk(),c,'en',{isCurrent:()=>true});assert.equal(r.dirty,undefined);assert.equal(c.extra.weapons[0].ammo,12);
 c.extra.weapons[0].ammo=0;r=ctx.handle(mk(),c,'en',{isCurrent:()=>true});assert.equal(r.dirty,true);assert.equal(c.extra.weapons[0].ammo,12);assert.equal(c.extra.items[0].quantity,18);
 c.extra.weapons[0].ammo=0;c.extra.items[0].quantity=5;const before=clone(c);r=ctx.handle(mk(),c,'en',{isCurrent:()=>true});assert(!r.dirty);assert.deepEqual(clone(c),before);
 w.confirm=()=>false;c.extra.items[0].quantity=30;const b2=clone(c);r=ctx.handle(mk(),c,'en',{isCurrent:()=>true});assert(!r.dirty);assert.deepEqual(clone(c),b2);
 w.confirm=()=>true;r=ctx.handle(mk(),c,'en',{isCurrent:()=>false});assert(!r.dirty);assert.deepEqual(clone(c),b2);
});
test('IPQuick: hidden at max or for unknown skills, title shows cost and balance',()=>{
 const w=setup(),c=character(),Q=w.IPQuick;
 const html=Q.button(c,'Handgun','en');assert(html.includes('data-ipq="Handgun"'));assert(html.includes('60'));assert(html.includes('500'));
 assert(Q.button(c,'Autofire','ru').includes('160'));// hard skill: 40 x 4
 c.skills.Handgun=10;assert.equal(Q.button(c,'Handgun','en'),'');assert.equal(Q.button(c,'Nope','en'),'');assert.equal(Q.button(null,'Handgun','en'),'');
});
test('IPQuick spend raises level via the sheet logic, logs IP, and cancel/insufficient funds change nothing',()=>{
 const w=setup(),c=character(),Q=w.IPQuick,CX=w.CharacterExtra;CX.init(c);
 let before=clone(c);assert.equal(Q.spend(c,'Handgun','en',()=>false).cancelled,true);assert.deepEqual(clone(c),before);
 const r=Q.spend(c,'Handgun','en',()=>true);assert.equal(r.ok,true);assert.equal(c.skills.Handgun,3);assert.equal(CX.ipBalance(c),440);assert.equal(c.extra.ipLog.at(-1).delta,-60);
 c.extra.ipOpening=0;c.extra.ipLog=[];before=clone(c);const f=Q.spend(c,'Handgun','en',()=>true);assert.equal(f.ok,false);assert.deepEqual(clone(c),before);
 assert(Q.button(c,'Handgun','en').includes('is-short'));
});
