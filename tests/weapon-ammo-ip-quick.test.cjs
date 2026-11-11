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
test('row reload: fills an empty magazine, tops up a used one, takes what is left, and never asks a browser dialog',()=>{
 const w=setup(),c=character(),ctx=w.ReloadTools,gun=c.extra.weapons[0],box=c.extra.items[0];
 w.confirm=()=>{throw new Error('the weapon-card reload asks nothing')};
 const mk=()=>{const b={dataset:{reload:'quick',weaponId:'pistol'},isConnected:true,closest:s=>s==='[data-reload]'?b:null};return {type:'click',target:{closest:s=>s==='[data-reload]'?b:null}}};
 let r=ctx.handle(mk(),c,'en',{isCurrent:()=>true});assert.equal(r.dirty,undefined);assert.equal(r.notify,'The magazine is full.');assert.equal(gun.ammo,12);
 gun.ammo=0;r=ctx.handle(mk(),c,'en',{isCurrent:()=>true});assert.equal(r.dirty,true);assert.equal(gun.ammo,12);assert.equal(box.quantity,18);assert.equal(gun.lastReload.units,12);
 assert.equal(r.notify,'Loaded +12: Basic Ammunition · Medium Pistol. Magazine 12/12, in stock 18.');
 // a partly used magazine is topped up with the same rounds
 gun.ammo=5;r=ctx.handle(mk(),c,'en',{isCurrent:()=>true});assert.equal(r.dirty,true);assert.equal(gun.ammo,12);assert.equal(box.quantity,11);assert.equal(gun.lastReload.units,12);
 // fewer rounds in stock than the magazine holds: load what there is
 gun.ammo=0;box.quantity=5;r=ctx.handle(mk(),c,'en',{isCurrent:()=>true});assert.equal(r.dirty,true);assert.equal(gun.ammo,5);assert.equal(box.quantity,0);assert.equal(gun.lastReload.units,5);
 assert.match(r.notify,/Magazine 5\/12, in stock 0\. The magazine is not full: nothing more in stock\./);
 const empty=clone(c);r=ctx.handle(mk(),c,'en',{isCurrent:()=>true});assert(!r.dirty);assert.equal(r.notify,'No matching ammunition in stock.');assert.deepEqual(clone(c),empty);
 // a part-filled magazine can go back to stock
 assert.equal(ctx.quoteUnload(c,'pistol','en').ok,true);
 box.quantity=30;const b2=clone(c);r=ctx.handle(mk(),c,'en',{isCurrent:()=>false});assert(!r.dirty);assert.deepEqual(clone(c),b2);
});
test('row reload: rounds of another kind — the rest goes back to its own stock first; hand-typed rounds are never returned',()=>{
 const w=setup(),c=character(),ctx=w.ReloadTools,gun=c.extra.weapons[0],basic=c.extra.items[0];
 c.extra.items.push({id:'ap',catalogId:'ammo-armor-piercing-ammunition',name:'AP',quantity:20,ammoType:'medium-pistol',purchase:{itemId:'ammo-armor-piercing-ammunition',ammoType:'medium-pistol',perPack:10,quantity:2,ammoCount:20,total:200}});
 const ap=c.extra.items[1],opt={isCurrent:()=>true};
 gun.ammo=0;let p=ctx.quickPlan(c,'pistol','en');assert.equal(p.quote.mode,'fill');assert.equal(ctx.quickCommit(c,p,'en',opt).ok,true);assert.equal(gun.lastReload.ammoRecordId,'ammo');
 assert.equal(ctx.loadedName(gun,'en'),'Basic Ammunition');assert.equal(ctx.loadedName(gun,'ru'),'Базовые боеприпасы');
 gun.ammo=4;basic.quantity=0;p=ctx.quickPlan(c,'pistol','en');
 assert.deepEqual([p.quote.mode,p.quote.back,p.quote.load,p.quote.after],['swap',4,12,12]);
 const stale=ctx.quickPlan(c,'pistol','en');ap.quantity=19;assert.equal(ctx.quickCommit(c,stale,'en',opt).reason,'stale');ap.quantity=20;
 assert.equal(ctx.quickCommit(c,p,'en',opt).ok,true);assert.deepEqual([gun.ammo,basic.quantity,ap.quantity,gun.lastReload.ammoRecordId,gun.lastReload.units],[12,4,8,'ap',12]);
 assert.match(ctx.quickMessage(p.quote,'ru'),/Заряжено \+12: .*Магазин 12\/12, в запасе 8\. Остаток возвращён в запас: 4\./);
 // rounds typed in by hand have no receipt: topping up is allowed, but they cannot be «returned» to stock
 delete gun.lastReload;gun.ammo=3;p=ctx.quickPlan(c,'pistol','en');assert.deepEqual([p.quote.mode,p.quote.back,p.quote.load,p.quote.units],['topup',0,4,4]);
 assert.equal(ctx.quickCommit(c,p,'en',opt).ok,true);assert.equal(gun.ammo,7);assert.equal(basic.quantity,0);assert.equal(ctx.quoteUnload(c,'pistol','en').ok,false);assert.equal(ctx.loadedName(gun,'en'),'');
 gun.lastReload={version:2};assert.equal(ctx.quickPlan(c,'pistol','en').reason,'unknownReceipt');
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
