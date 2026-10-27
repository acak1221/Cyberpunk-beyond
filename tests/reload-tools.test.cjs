const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const base=__dirname+'/../public/game/';
function setup(){const w={},ctx={window:w,console,Math,Date,globalThis:{crypto:{randomUUID:()=> 'uuid'}}};w.confirm=()=>true;vm.createContext(ctx);for(const f of ['catalog.js','catalog-extra.js','equipment-tools.js','reload-tools.js'])vm.runInContext(fs.readFileSync(base+f,'utf8'),ctx,{filename:f});w.ReloadTools.setScope('account-a');return w}
function character(){return {id:'person',extra:{cash:600,unrelated:{x:9},weapons:[{id:'pistol',catalogId:'weapon-medium-pistol',name:'Pistol',capacity:12,ammo:0,usesAmmo:true,other:'keep'}],items:[{id:'ammo',catalogId:'ammo-basic-ammunition',name:'Basic',quantity:30,ammoType:'medium-pistol',purchase:{itemId:'ammo-basic-ammunition',ammoType:'medium-pistol',perPack:10,quantity:3,ammoCount:30,total:30},other:'keep'}]}}}
const good={isCurrent:()=>true},clone=x=>JSON.parse(JSON.stringify(x));
function select(w,c,type,value){return w.ReloadTools.handle({type:'change',target:{dataset:{reloadField:type},value}},c,'en',good)}
function click(w,c,opts=good){return w.ReloadTools.handle({type:'click',target:{closest:s=>s==='[data-reload]'?{dataset:{reload:'load'}}:null}},c,'en',opts)}
test('reload consumes one full magazine and preserves all unrelated state atomically',()=>{
 const w=setup(),c=character();select(w,c,'weapon','pistol');select(w,c,'ammo','ammo');const r=click(w,c);assert.equal(r.dirty,true);assert.equal(c.extra.weapons[0].ammo,12);assert.equal(c.extra.items[0].quantity,18);assert.equal(c.extra.items[0].purchase.ammoCount,30);assert.deepEqual(clone(c.extra.weapons[0].lastReload),{version:1,ammoCatalogId:'ammo-basic-ammunition',ammoType:'medium-pistol',ammoRecordId:'ammo',units:12});assert.equal(c.extra.cash,600);assert.deepEqual(c.extra.unrelated,{x:9});assert.equal(c.extra.weapons[0].other,'keep');assert.equal(c.extra.items[0].other,'keep');assert.equal(click(w,c).dirty,undefined);
});
test('cancel, partial magazine, insufficient stock, incompatible or unknown ammunition make no mutations',()=>{
 const w=setup(),c=character();select(w,c,'weapon','pistol');select(w,c,'ammo','ammo');w.confirm=()=>false;let before=clone(c);assert(!click(w,c).dirty);assert.deepEqual(c,before);
 w.confirm=()=>true;c.extra.weapons[0].ammo=1;before=clone(c);assert.equal(w.ReloadTools.quote(c,'pistol','ammo','en').reason,'occupied');assert.deepEqual(c,before);
 c.extra.weapons[0].ammo=0;c.extra.items[0].quantity=11;before=clone(c);assert.equal(w.ReloadTools.quote(c,'pistol','ammo','en').reason,'need');assert.deepEqual(c,before);
 c.extra.items[0].quantity=30;c.extra.items[0].ammoType='heavy-pistol';c.extra.items[0].purchase.ammoType='heavy-pistol';before=clone(c);assert.equal(w.ReloadTools.quote(c,'pistol','ammo','en').reason,'invalid');assert.deepEqual(c,before);
 c.extra.items[0].ammoType='medium-pistol';delete c.extra.items[0].purchase;before=clone(c);assert.equal(w.ReloadTools.quote(c,'pistol','ammo','en').reason,'invalid');assert.deepEqual(c,before);
});
test('only standard weapon types, known capacities and valid purchase records qualify',()=>{
 const w=setup(),c=character();c.extra.weapons[0].catalogId='weapon-dartgun';assert.equal(w.ReloadTools.quote(c,'pistol','ammo','en').ok,false);c.extra.weapons[0].catalogId='weapon-medium-pistol';c.extra.weapons[0].capacity=13;assert.equal(w.ReloadTools.quote(c,'pistol','ammo','en').ok,false);
 c.extra.weapons[0].capacity=18;assert.equal(w.ReloadTools.quote(c,'pistol','ammo','en').ok,true);c.extra.weapons[0].usesAmmo=false;assert.equal(w.ReloadTools.quote(c,'pistol','ammo','en').ok,false);c.extra.weapons[0].usesAmmo=true;c.extra.items[0].purchase.perPack=1;assert.equal(w.ReloadTools.quote(c,'pistol','ammo','en').ok,false);
 c.extra.items[0].purchase.perPack=10;c.extra.items.push(clone(c.extra.items[0]));assert.equal(w.ReloadTools.quote(c,'pistol','ammo','en').ok,false);
});
test('shotgun accepts either slug or shell but never combines different ammunition entries',()=>{
 const w=setup(),c=character();c.extra.weapons[0]={id:'shotgun',catalogId:'weapon-shotgun',name:'Shotgun',capacity:4,ammo:0,usesAmmo:true};
 for(const type of ['slug','shell']){c.extra.items[0].ammoType=type;c.extra.items[0].purchase.ammoType=type;assert.equal(w.ReloadTools.quote(c,'shotgun','ammo','en').ok,true)}
 c.extra.items[0].quantity=2;c.extra.items.push({...clone(c.extra.items[0]),id:'other'});assert.equal(w.ReloadTools.quote(c,'shotgun','ammo','en').reason,'need');
});
test('scope change, detached character, and data changes during confirmation prevent all deductions',()=>{
 const w=setup(),c=character();select(w,c,'weapon','pistol');select(w,c,'ammo','ammo');let before=clone(c);w.confirm=()=>{w.ReloadTools.setScope('account-b');return true};assert(!click(w,c).dirty);assert.deepEqual(c,before);
 w.ReloadTools.setScope('account-a');w.confirm=()=>true;assert(!click(w,c,{isCurrent:()=>false}).dirty);assert.deepEqual(c,before);
 w.confirm=()=>{c.extra.items[0].quantity=24;return true};assert(!click(w,c).dirty);assert.equal(c.extra.items[0].quantity,24);assert.equal(c.extra.weapons[0].ammo,0);
});
test('different account drafts are isolated and custom names are escaped in both languages',()=>{
 const w=setup(),c=character();c.extra.weapons[0].name='<img src=x>';select(w,c,'weapon','pistol');select(w,c,'ammo','ammo');let ru=w.ReloadTools.render(c,'ru'),en=w.ReloadTools.render(c,'en');assert(ru.includes('&lt;img'));assert(!en.includes('<img'));assert(en.includes('12 units'));
 w.ReloadTools.setScope('account-b');assert(!w.ReloadTools.render(c,'en').includes('12 units'));w.ReloadTools.setScope(null);assert(w.ReloadTools.render(c,'en').includes('Wait until account'));w.ReloadTools.setScope('account-a');assert(w.ReloadTools.render(c,'en').includes('12 units'));
});
test('last confirmed reload is an explicit historical receipt, including after manual ammo edits',()=>{
 const w=setup(),c=character();select(w,c,'weapon','pistol');select(w,c,'ammo','ammo');assert.equal(click(w,c).dirty,true);
 c.extra.weapons[0].ammo=3;select(w,c,'weapon','');const ru=w.ReloadTools.render(c,'ru'),en=w.ReloadTools.render(c,'en');assert(ru.includes('Последняя подтверждённая перезарядка'));assert(ru.includes('а не гарантия текущего содержимого'));assert(en.includes('Last confirmed reload'));assert(en.includes('not the current magazine contents'));assert(en.includes('Medium Pistol'));c.extra.weapons[0].usesAmmo=false;assert(w.ReloadTools.render(c,'en').includes('Last confirmed reload'));
});
test('compatible receipts preserve unknown fields; incompatible future receipt is never overwritten',()=>{
 const w=setup(),c=character(),weapon=c.extra.weapons[0];weapon.lastReload={version:1,ammoCatalogId:'ammo-basic-ammunition',ammoType:'medium-pistol',ammoRecordId:'previous',units:12,future:{unmodified:true}};
 select(w,c,'weapon','pistol');select(w,c,'ammo','ammo');assert.equal(click(w,c).dirty,true);assert.deepEqual(clone(weapon.lastReload.future),{unmodified:true});assert.equal(weapon.lastReload.ammoRecordId,'ammo');
 weapon.ammo=0;weapon.lastReload={version:2,important:{future:true}};select(w,c,'weapon','pistol');select(w,c,'ammo','ammo');const before=clone(c);assert.equal(w.ReloadTools.quote(c,'pistol','ammo','en').reason,'unknownReceipt');assert(!click(w,c).dirty);assert.deepEqual(c,before);assert(w.ReloadTools.render(c,'en').includes('unsupported format'));
});
test('receipt changes during confirmation are detected before either count changes',()=>{
 const w=setup(),c=character();select(w,c,'weapon','pistol');select(w,c,'ammo','ammo');w.confirm=()=>{c.extra.weapons[0].lastReload={version:2,future:'keep'};return true};assert(!click(w,c).dirty);assert.equal(c.extra.weapons[0].ammo,0);assert.equal(c.extra.items[0].quantity,30);assert.equal(c.extra.weapons[0].lastReload.future,'keep');
});
test('module never uses independent storage, network or timers',()=>{const f=fs.readFileSync(base+'reload-tools.js','utf8');assert(!/localStorage|sessionStorage|\bfetch\s*\(|setTimeout/.test(f))});
