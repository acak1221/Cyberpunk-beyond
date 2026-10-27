const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),test=require('node:test');
const ctx={window:{},console};vm.createContext(ctx);for(const f of ['catalog.js','catalog-extra.js','character-extra.js','equipment-tools.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..','public','game',f),'utf8'),ctx);const M=ctx.window.EquipmentTools,C=ctx.window.CATALOG;
const find=id=>C.find(x=>x.id===id);const character=()=>({id:'c1',name:'V',role:'solo',stats:{INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{Handgun:2},hp:45,humanity:60,head:0,bodyArmor:0,extra:{cash:10000,gearBudget:2550,fashionBudget:800,items:[],weapons:[]}});const copy=x=>JSON.stringify(x);
test('quote and explicit confirmation: no spend and no item before confirm',()=>{let c=character(),p=find('weapon-heavy-pistol'),before=copy(c),q=M.purchase(c,p,'gearBudget','ru');assert.equal(q.reason,'confirmNeeded');assert.equal(q.quote.total,100);assert.equal(copy(c),before);let r=M.purchase(c,p,'gearBudget','ru',{confirmed:true});assert.equal(r.ok,true);assert.equal(c.extra.gearBudget,2450);assert.equal(c.extra.weapons.length,1);assert.equal(c.extra.weapons[0].capacity,8);assert.equal(c.extra.weapons[0].ammo,0)});
test('unknown prices, unsupported units, services, insufficient funds and bad budgets fail without mutation',()=>{const c=character(),before=copy(c);let choices=[[find('extra-upgrade-security-upgrade'),'cash',{},'invalidPrice'],[find('extra-service-taxi'),'cash',{},'forbiddenType'],[find('extra-housing-rent-studio'),'cash',{},'forbiddenType'],[find('weapon-heavy-pistol'),'fashionBudget',{},'badBudget'],[{id:'custom',category:'gear',price:1,priceUnit:{en:'per mystery'}},'cash',{},'invalidUnit'],[{id:'bad',category:'gear',price:null},'cash',{},'invalidPrice'],[{id:'expensive',category:'gear',price:20000},'cash',{},'noFunds']];for(const [i,m,o,reason] of choices){assert.equal(M.purchase(c,i,m,'en',{...o,confirmed:true}).reason,reason);assert.equal(copy(c),before)}});
test('fashionware, regular fashion, quantities and per-room minimums are priced correctly',()=>{let c=character();assert.equal(M.purchase(c,find('cyberware-biomonitor'),'fashionBudget','ru',{confirmed:true}).ok,true);assert.equal(c.extra.fashionBudget,700);assert.equal(M.purchase(c,find('extra-fashion-bag-lady-bottoms'),'gearBudget','ru',{confirmed:true}).ok,true);assert.equal(c.extra.gearBudget,2530);let yacht=find('extra-vehicle-yacht');c.extra.cash=250000;assert.equal(M.purchase(c,yacht,'cash','ru',{confirmed:true,quantity:1}).reason,'badQuantity');assert.equal(M.purchase(c,yacht,'cash','ru',{confirmed:true,quantity:4}).ok,true);assert.equal(c.extra.cash,50000);assert.equal(c.extra.items.at(-1).purchase.rooms,4);assert.equal(c.extra.items.at(-1).quantity,1)});
test('armor tracks locations, retains damaged SP and prevents simultaneous use of a single piece',()=>{let c=character();M.purchase(c,find('armor-kevlar'),'cash','en',{confirmed:true});M.purchase(c,find('armor-light-armorjack'),'cash','en',{confirmed:true});const a=c.extra.items[0].id,b=c.extra.items[1].id;assert.equal(M.equip(c,a,'head','en',false).reason,'confirmNeeded');assert.equal(c.head,0);assert.equal(M.equip(c,a,'head','en',true).ok,true);assert.equal(c.head,7);assert.equal(M.equip(c,a,'body','en',true).reason,'inUse');assert.equal(M.setSP(c,'head',3).ok,true);assert.equal(M.equip(c,b,'head','en',true).ok,true);assert.equal(c.head,11);assert.equal(M.equip(c,a,'head','en',true).ok,true);assert.equal(c.head,3);assert.equal(M.unequip(c,'head','en',true).ok,true);assert.equal(c.head,0);assert.equal(M.equip(c,a,'head','en',true).ok,true);assert.equal(c.head,3)});
test('one suit covers both and cannot be partially replaced',()=>{let c=character();M.purchase(c,find('armor-bodyweight-suit'),'cash','en',{confirmed:true});M.purchase(c,find('armor-kevlar'),'cash','en',{confirmed:true});let a=c.extra.items[0].id,b=c.extra.items[1].id;assert.equal(M.equip(c,a,'both','en',true).ok,true);assert.equal(c.head,11);assert.equal(c.bodyArmor,11);M.setSP(c,'head',5);M.setSP(c,'body',8);assert.equal(M.equip(c,b,'head','en',true).reason,'removeSuit');assert.equal(M.unequip(c,'head','en',true).ok,true);assert.equal(c.head,0);assert.equal(c.bodyArmor,0);M.equip(c,a,'both','en',true);assert.equal(c.head,5);assert.equal(c.bodyArmor,8)});
test('cyberware creation fixed HL, gameplay dice rounding, zero HL, borgware maximum and found surgery fee',()=>{let c=character();for(const id of ['cyberware-neural-link','cyberware-anti-dazzle','cyberware-biomonitor','cyberware-artificial-shoulder-mount'])M.purchase(c,find(id),'cash','en',{confirmed:true});assert.equal(M.setMax(c,60,'en',true).ok,true);const [link,eye,bio,borg]=c.extra.items.map(x=>x.id);let p=M.prepare(c,link,'creation','included',true,'en',()=>6);assert.equal(p.draft.loss,7);assert.equal(p.draft.maxLoss,2);assert.equal(M.commit(c,p.draft,'en',true).ok,true);assert.equal(c.humanity,53);assert.equal(c.extra.equipment.maxHumanity,58);let p2=M.prepare(c,eye,'play','found',true,'en',()=>5);assert.equal(p2.draft.loss,3);assert.equal(p2.draft.fee,100);let cash=c.extra.cash;assert.equal(M.commit(c,p2.draft,'en',true).ok,true);assert.equal(c.humanity,50);assert.equal(c.extra.equipment.maxHumanity,56);assert.equal(c.extra.cash,cash-100);let p3=M.prepare(c,bio,'creation','included',true,'en');assert.equal(p3.draft.loss,0);assert.equal(p3.draft.maxLoss,0);M.commit(c,p3.draft,'en',true);assert.equal(c.extra.equipment.maxHumanity,56);let p4=M.prepare(c,borg,'creation','included',true,'en');assert.equal(p4.draft.maxLoss,4);M.commit(c,p4.draft,'en',true);assert.equal(c.extra.equipment.maxHumanity,52)});
test('cyberware must be verified, prerequisites acknowledged, max set and preview explicitly confirmed',()=>{let c=character();M.purchase(c,find('cyberware-neural-link'),'cash','en',{confirmed:true});let id=c.extra.items[0].id;assert.equal(M.prepare(c,id,'creation','included',true,'en').reason,'needsMax');assert.equal(M.setMax(c,60,'en',false).reason,'confirmNeeded');M.setMax(c,60,'en',true);assert.equal(M.prepare(c,id,'creation','included',false,'en').reason,'needInputs');let draft=M.prepare(c,id,'creation','included',true,'en').draft;assert.equal(M.commit(c,draft,'en',false).reason,'confirmNeeded');assert.equal(c.humanity,60);c.humanity=59;assert.equal(M.commit(c,draft,'en',true).reason,'stale');assert.equal(c.humanity,59);assert.equal(c.extra.equipment.installs.length,0);let next=M.prepare(c,id,'creation','included',true,'en').draft;M.commit(c,next,'en',true);assert.equal(M.prepare(c,id,'creation','included',true,'en').reason,'alreadyInstalled')});
test('surgery refuses insufficient funds and unclassified future ware',()=>{let c=character();M.purchase(c,find('cyberware-neural-link'),'cash','en',{confirmed:true});M.setMax(c,60,'en',true);let id=c.extra.items[0].id;c.extra.cash=0;assert.equal(M.prepare(c,id,'play','found',true,'en',()=>2).reason,'foundInsufficient');assert.equal(c.humanity,60);let future={id:'new-unknown-borgware',category:'cyberware',name:{en:'unknown',ru:'?'},price:10,stats:{humanityLoss:'1d6',humanityLossAtCreation:3,installation:'Clinic'}};C.push(future);ctx.window.CharacterExtra.addCatalog(c,future,'en');assert.equal(M.prepare(c,c.extra.items.at(-1).id,'play','included',true,'en').reason,'unverified')});
test('found cyberware with N/A installation has no assumed free hospital operation',()=>{let c=character();M.purchase(c,find('cyberware-skill-chip'),'cash','en',{confirmed:true});M.setMax(c,60,'en',true);let id=c.extra.items[0].id;assert.equal(M.prepare(c,id,'play','found',true,'en',()=>1).reason,'needInputs');assert.equal(c.humanity,60);assert.equal(c.extra.cash,9500)});
test('installation previews are isolated and cleared on account change even for identical character IDs',()=>{let a=character(),b=character();M.setScope('account-a');M.purchase(a,find('cyberware-neural-link'),'cash','en',{confirmed:true});M.setMax(a,60,'en',true);let draft=M.prepare(a,a.extra.items[0].id,'creation','included',true,'en').draft;assert(M.render(a,'en').includes('Current → after'));M.setScope('account-b');assert(!M.render(b,'en').includes('Current → after'));assert.equal(M.commit(b,draft,'en',true).reason,'stale');assert.equal(b.humanity,60);M.setScope('account-a');assert.equal(M.commit(a,draft,'en',true).reason,'stale');M.setScope(null);assert.equal(M.prepare(a,a.extra.items[0].id,'creation','included',true,'en').reason,'scopeMissing');M.setScope('local')});
test('inventory deletion is blocked for equipped armor and installed cyberware until explicitly removed',()=>{let c=character();M.purchase(c,find('armor-kevlar'),'cash','en',{confirmed:true});let a=c.extra.items[0].id;M.equip(c,a,'body','en',true);assert.equal(M.canRemove(c,a,'en').reason,'equippedItem');M.unequip(c,'body','en',true);assert.equal(M.canRemove(c,a,'en').ok,true);M.purchase(c,find('cyberware-neural-link'),'cash','en',{confirmed:true});let id=c.extra.items[1].id;M.setMax(c,60,'en',true);let p=M.prepare(c,id,'creation','included',true,'en');let i=M.commit(c,p.draft,'en',true).installation;assert.equal(M.canRemove(c,id,'en').reason,'installedItem');assert.equal(M.uninstall(c,i.id,false,true,'en').reason,'needsDependencies');assert.equal(M.uninstall(c,i.id,true,false,'en').reason,'confirmNeeded');assert.equal(c.extra.equipment.maxHumanity,58);let hum=c.humanity;assert.equal(M.uninstall(c,i.id,true,true,'en').ok,true);assert.equal(c.extra.equipment.maxHumanity,60);assert.equal(c.humanity,hum);assert.equal(M.canRemove(c,id,'en').ok,true);assert.equal(M.uninstall(c,i.id,true,true,'en').reason,'invalidItem');assert.equal(c.extra.equipment.installs.length,1);assert(c.extra.equipment.installs[0].removedAt)});
test('removal preserves Humanity and respects the original EMP cap; inconsistent caps are manual',()=>{let c=character();M.purchase(c,find('cyberware-artificial-shoulder-mount'),'cash','en',{confirmed:true});let id=c.extra.items[0].id;M.setMax(c,60,'en',true);let x=M.commit(c,M.prepare(c,id,'creation','included',true,'en').draft,'en',true).installation;let hum=c.humanity;c.extra.equipment.maxHumanity=59;let r=M.uninstall(c,x.id,true,false,'en');assert.equal(r.quote.maxAfter,60);assert.equal(M.uninstall(c,x.id,true,true,'en').ok,true);assert.equal(c.humanity,hum);assert.equal(c.extra.equipment.maxHumanity,60);let d=character();M.purchase(d,find('cyberware-neural-link'),'cash','en',{confirmed:true});M.setMax(d,80,'en',true);let z=M.commit(d,M.prepare(d,d.extra.items[0].id,'creation','included',true,'en').draft,'en',true).installation;assert.equal(M.uninstall(d,z.id,true,true,'en').reason,'maxConflict');assert(!d.extra.equipment.installs[0].removedAt)});
test('quantity cannot drop below occupied armor pieces or installed cyberware',()=>{let c=character();M.purchase(c,find('armor-kevlar'),'cash','en',{confirmed:true,quantity:2});let a=c.extra.items[0].id;M.equip(c,a,'head','en',true);M.equip(c,a,'body','en',true);assert.equal(M.canSetQuantity(c,a,1,'en').reason,'equippedItem');assert.equal(M.canSetQuantity(c,a,2,'en').ok,true);M.unequip(c,'body','en',true);assert.equal(M.canSetQuantity(c,a,1,'en').ok,true);M.purchase(c,find('cyberware-neural-link'),'cash','en',{confirmed:true});let id=c.extra.items[1].id;M.setMax(c,60,'en',true);let x=M.commit(c,M.prepare(c,id,'creation','included',true,'en').draft,'en',true).installation;assert.equal(M.canSetQuantity(c,id,0,'en').reason,'installedItem');M.uninstall(c,x.id,true,true,'en');assert.equal(M.canSetQuantity(c,id,0,'en').ok,true)});

test('general creation budget allows core purchasable categories; fashion-only budget remains restricted',()=>{let c=character();for(const id of ['weapon-heavy-pistol','armor-kevlar','gear-agent','cyberware-biomonitor','extra-program-eraser','extra-fashion-bag-lady-top','extra-drug-smash']){let result=M.purchase(c,find(id),'gearBudget','en',{confirmed:true});assert.equal(result.ok,true,id+': '+result.reason)}assert.equal(M.purchase(c,find('extra-service-taxi'),'gearBudget','en',{confirmed:true}).reason,'forbiddenType');assert.equal(M.purchase(c,find('extra-housing-rent-container'),'gearBudget','en',{confirmed:true}).reason,'forbiddenType');assert.equal(M.purchase(c,find('weapon-heavy-pistol'),'fashionBudget','en',{confirmed:true}).reason,'badBudget');assert.equal(M.purchase(c,find('extra-fashion-bag-lady-top'),'fashionBudget','en',{confirmed:true}).ok,true);assert.equal(M.purchase(c,find('cyberware-biomonitor'),'fashionBudget','en',{confirmed:true}).ok,true)});
test('historical orphaned installation remains visible and removable after dependency review',()=>{let c=character();M.purchase(c,find('cyberware-neural-link'),'cash','en',{confirmed:true});let id=c.extra.items[0].id;M.setMax(c,60,'en',true);let installed=M.commit(c,M.prepare(c,id,'creation','included',true,'en').draft,'en',true).installation;c.extra.items=[];assert(M.render(c,'en').includes('Installation has no inventory entry'));assert.equal(M.uninstall(c,installed.id,true,true,'en').ok,true);assert.equal(c.extra.equipment.maxHumanity,60);assert(!M.render(c,'en').includes('Installation has no inventory entry'))});
test('reasserting the same confirmed scope preserves its active preview',()=>{let c=character();M.setScope('same-account');M.purchase(c,find('cyberware-neural-link'),'cash','en',{confirmed:true});M.setMax(c,60,'en',true);let draft=M.prepare(c,c.extra.items[0].id,'creation','included',true,'en').draft;assert.equal(M.setScope('same-account'),true);assert.equal(M.commit(c,draft,'en',true).ok,true);M.setScope('local')});



test('ammunition purchase fails without mutation until a concrete ammo type and unit can be selected',()=>{
 const c=character(),before=copy(c);
 for(const id of ['ammo-basic-ammunition','ammo-armor-piercing-ammunition','ammo-flashbang-ammunition']){
  const item=find(id),quote=M.quote(c,item,'cash','en',{quantity:2}),purchase=M.purchase(c,item,'cash','en',{quantity:2,confirmed:true});
  assert.equal(quote.reason,'ammoManual');assert.equal(purchase.reason,'ammoManual');assert.match(purchase.message,/Select an eligible/);assert.equal(copy(c),before);
 }
 const added=ctx.window.CharacterExtra.addCatalog(c,find('ammo-basic-ammunition'),'en');
 assert(added.record);assert.equal(c.extra.cash,10000);assert.equal(c.extra.items.length,1);
});

test('ammunition combinations and pack sizes follow the Corebook, without conflating calibres',()=>{
 const cases=[
 ['ammo-basic-ammunition',10,['medium-pistol','heavy-pistol','very-heavy-pistol','rifle','slug','shell','arrow']],
 ['ammo-armor-piercing-ammunition',100,['medium-pistol','heavy-pistol','very-heavy-pistol','rifle','slug','arrow','grenade','rocket']],
 ['ammo-biotoxin-ammunition',500,['arrow','grenade']],['ammo-emp-ammunition',500,['grenade']],
 ['ammo-expansive-ammunition',100,['medium-pistol','heavy-pistol','very-heavy-pistol','rifle','slug','arrow']],
 ['ammo-flashbang-ammunition',100,['grenade']],
 ['ammo-incendiary-ammunition',100,['medium-pistol','heavy-pistol','very-heavy-pistol','rifle','slug','shell','arrow','grenade']],
 ['ammo-poison-ammunition',100,['arrow','grenade']],
 ['ammo-rubber-ammunition',10,['medium-pistol','heavy-pistol','very-heavy-pistol','rifle','slug','arrow']],
 ['ammo-sleep-ammunition',500,['arrow','grenade']],
 ['ammo-smart-ammunition',500,['medium-pistol','heavy-pistol','very-heavy-pistol','rifle','slug','arrow','rocket']],
 ['ammo-smoke-ammunition',50,['grenade']],['ammo-teargas-ammunition',50,['grenade']]];
 const all=['medium-pistol','heavy-pistol','very-heavy-pistol','rifle','slug','shell','arrow','grenade','rocket'];
 for(const [id,price,allowed] of cases){const item=find(id),c=character();assert.equal(item.price,price,id);assert.deepEqual(Array.from(M.ammoTypeOptions(item,'en'),x=>x.value),allowed,id);
  for(const type of all){const before=copy(c),q=M.quote(c,item,'cash','en',{quantity:2,ammoType:type});
   if(!allowed.includes(type)){assert.equal(q.reason,'ammoUnsupported',id+' '+type);assert.equal(copy(c),before);continue}
   assert.equal(q.ok,true,id+' '+type);assert.equal(q.total,2*price);assert.equal(q.ammoCount,['grenade','rocket'].includes(type)?2:20);assert.equal(q.perPack,['grenade','rocket'].includes(type)?1:10);assert.equal(copy(c),before);
  }
 }
});
test('confirmed ammunition purchase records individual rounds, pack cost and type atomically',()=>{
 const c=character(),item=find('ammo-basic-ammunition'),before=copy(c),preview=M.purchase(c,item,'cash','en',{quantity:3,ammoType:'heavy-pistol'});
 assert.equal(preview.reason,'confirmNeeded');assert.equal(preview.quote.ammoCount,30);assert.equal(copy(c),before);
 let p=M.purchase(c,item,'cash','en',{quantity:3,ammoType:'heavy-pistol',confirmed:true});assert.equal(p.ok,true);assert.equal(c.extra.cash,9970);
 let rec=c.extra.items[0];assert.equal(rec.quantity,30);assert.equal(rec.ammoType,'heavy-pistol');assert.equal(rec.purchase.quantity,3);assert.equal(rec.purchase.perPack,10);assert.equal(rec.purchase.ammoCount,30);assert.equal(rec.purchase.total,30);assert.match(rec.notes,/Heavy Pistol/);
 let grenade=M.purchase(c,find('ammo-flashbang-ammunition'),'cash','ru',{quantity:2,ammoType:'grenade',confirmed:true});assert.equal(grenade.ok,true);assert.equal(c.extra.items[1].quantity,2);assert.equal(c.extra.items[1].purchase.perPack,1);assert.equal(c.extra.cash,9770);
 assert.equal(M.ammoTypeName('heavy-pistol','ru'),'Тяжёлый пистолет');assert.equal(M.ammoTypeName('heavy-pistol','en'),'Heavy Pistol');
});
test('unsupported, altered or unaffordable ammunition fails closed without mutations',()=>{
 const c=character(),before=copy(c),basic=find('ammo-basic-ammunition');
 for(const [i,options,reason] of [[basic,{ammoType:'grenade'},'ammoUnsupported'],[basic,{ammoType:'constructor'},'ammoUnsupported'],[{...basic,price:1},{ammoType:'rifle'},'ammoUnsupported'],[{...basic,id:'unknown-ammo'},{ammoType:'rifle'},'ammoUnsupported'],[basic,{ammoType:'rifle',quantity:0},'badQuantity']]){assert.equal(M.purchase(c,i,'cash','en',{...options,confirmed:true}).reason,reason);assert.equal(copy(c),before)}
 assert.equal(M.purchase(c,basic,'fashionBudget','en',{ammoType:'rifle',confirmed:true}).reason,'badBudget');assert.equal(copy(c),before);
 c.extra.cash=0;const empty=copy(c);assert.equal(M.purchase(c,basic,'cash','en',{ammoType:'rifle',confirmed:true}).reason,'noFunds');assert.equal(copy(c),empty);
});


test('aggregated purchases record actual quantity and total while weapon purchases remain per copy',()=>{
 const c=character(),r=M.purchase(c,find('extra-drug-boost'),'cash','en',{quantity:3,confirmed:true});
 assert.equal(r.ok,true);assert.equal(c.extra.cash,9850);const item=c.extra.items[0];assert.equal(item.quantity,3);assert.equal(item.purchase.quantity,3);assert.equal(item.purchase.unitPrice,50);assert.equal(item.purchase.total,150);
 const w=M.purchase(c,find('weapon-heavy-pistol'),'cash','en',{quantity:2,confirmed:true});assert.equal(w.ok,true);assert.equal(c.extra.cash,9650);assert.equal(c.extra.weapons.length,2);for(const record of c.extra.weapons){assert.equal(record.purchase.quantity,1);assert.equal(record.purchase.total,100)}
});

test('bows use arrows without a magazine, legacy guns track ammo and manual weapons can opt in',()=>{
 const c=character(),x=ctx.window.CharacterExtra;
 M.purchase(c,find('weapon-bows-crossbows'),'cash','en',{confirmed:true});
 const bow=c.extra.weapons[0],fire=i=>x.handle({type:'click',target:{closest:()=>({dataset:{cxAction:'attack',cxIndex:String(i)}})}},c,'en');
 assert.equal(bow.capacity,0);assert.equal(bow.usesAmmo,true);assert.match(fire(0).notify,/Not enough ammunition/);
 bow.ammo=2;assert.equal(fire(0).dirty,true);assert.equal(bow.ammo,1);
 delete bow.usesAmmo;bow.ammo=0;assert.match(fire(0).notify,/Not enough ammunition/);
 c.extra.weapons.push({id:'old-gun',name:'old',capacity:8,ammo:1,ammoCost:1});assert.equal(fire(1).dirty,true);assert.equal(c.extra.weapons[1].ammo,0);assert.match(fire(1).notify,/Not enough ammunition/);
 c.extra.weapons.push({id:'manual',name:'manual',capacity:0,ammo:0,ammoCost:1,usesAmmo:false});assert.equal(fire(2).dirty,true);
 const checkbox={dataset:{cxList:'weapons',cxIndex:'2',cxKey:'usesAmmo'},checked:true};assert.equal(x.handle({type:'change',target:checkbox},c,'en').dirty,true);assert.equal(c.extra.weapons[2].usesAmmo,true);assert.match(fire(2).notify,/Not enough ammunition/);c.extra.weapons[2].ammo=1;assert.equal(fire(2).dirty,true);assert.equal(c.extra.weapons[2].ammo,0);
});


test('chipware with prior history is handled manually because copies cannot be distinguished',()=>{
 const c=character();M.setScope('chipware-test');M.purchase(c,find('cyberware-skill-chip'),'cash','en',{quantity:2,confirmed:true});M.setMax(c,60,'en',true);
 const id=c.extra.items[0].id,first=M.prepare(c,id,'creation','included',true,'en');assert.equal(first.ok,true);
 const installed=M.commit(c,first.draft,'en',true).installation,before=copy(c);
 let blocked=M.prepare(c,id,'play','included',true,'en',()=>6);assert.equal(blocked.reason,'chipwareManual');assert.match(blocked.message,/manually/);assert.equal(copy(c),before);
 assert.equal(M.uninstall(c,installed.id,true,true,'en').ok,true);const removed=copy(c);
 blocked=M.prepare(c,id,'play','included',true,'en',()=>6);assert.equal(blocked.reason,'chipwareManual');assert.equal(copy(c),removed);M.setScope('local');
});


test('home defenses cannot be purchased without separately pricing their deployment',()=>{
 const c=character(),before=copy(c),defense={id:'defense-test',category:'defenses',price:500,name:{en:'Defense',ru:'Защита'},details:{en:'Defense',ru:'Защита'},stats:{}};
 const quote=M.quote(c,defense,'cash','en'),result=M.purchase(c,defense,'cash','en',{confirmed:true});
 assert.equal(quote.reason,'forbiddenType');assert.equal(result.reason,'forbiddenType');assert.equal(copy(c),before);
 assert(ctx.window.CharacterExtra.addCatalog(c,defense,'en').record);assert.equal(c.extra.cash,10000);
});

test('reducing quantity discards only removed armor copies and never damages occupied copies',()=>{
 const c=character();M.purchase(c,find('armor-kevlar'),'cash','en',{confirmed:true,quantity:2});M.purchase(c,find('armor-kevlar'),'cash','en',{confirmed:true});
 const a=c.extra.items[0].id,b=c.extra.items[1].id;M.equip(c,a,'head','en',true);M.equip(c,a,'body','en',true);M.setSP(c,'head',6);M.setSP(c,'body',2);
 assert.equal(M.setQuantity(c,a,1,'en').reason,'equippedItem');assert.equal(c.extra.items[0].quantity,2);
 M.unequip(c,'body','en',true);const e=c.extra.equipment;e.armorHistory.push({recordId:b,piece:2,location:'head',sp:1});
 assert.equal(M.setQuantity(c,a,1,'en').ok,true);assert.equal(c.extra.items[0].quantity,1);
 assert(e.armorHistory.some(r=>r.recordId===a&&r.piece===0&&r.sp===6));assert(!e.armorHistory.some(r=>r.recordId===a&&r.piece>=1));assert(e.armorHistory.some(r=>r.recordId===b&&r.piece===2));
 assert.equal(M.setQuantity(c,a,2,'en').ok,true);assert.equal(M.equip(c,a,'body','en',true).ok,true);assert.equal(c.bodyArmor,7);
});

test('starting cyberware cannot charge Humanity a second time',()=>{
 const c=character(); M.setScope('starter-test'); M.purchase(c,find('cyberware-cybereye'),'cash','en',{confirmed:true});
 const rec=c.extra.items[0];rec.humanityLossIncluded=true;const before=copy(c);
 const out=M.prepare(c,rec.id,'creation','included',true,'en');
 assert.equal(out.reason,'alreadyInstalled'); assert.equal(copy(c),before);
 assert(M.render(c,'en').includes('Starting implant is already installed'));
 M.setScope('local');
});
