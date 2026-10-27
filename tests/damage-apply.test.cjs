const {test}=require('node:test'),assert=require('node:assert/strict');
global.window={};require('../public/game/combat-tools.js');require('../public/game/equipment-tools.js');require('../public/game/damage-apply.js');
const D=window.DamageApply,E=window.EquipmentTools;
const make=()=>({id:'a',hp:40,head:11,bodyArmor:11,extra:{equipment:{armor:{body:{recordId:'vest',piece:0,catalogId:'armor-light'}},armorHistory:[{recordId:'vest',piece:0,location:'body',sp:11,unknown:'keep'}],future:{x:1}},injuries:'old'}});
const args=(type='standard',location='body',raw=15,critical=false)=>({type,location,raw,critical});
function harness(c){D.setScope(null);D.setScope('owner-a');D.render(c,'en');let current=true,confirm=()=>true;const ctx={isCurrent:(candidate,scope)=>current&&candidate===c&&scope==='owner-a'};window.confirm=message=>confirm(message);return {field(k,value){const root={isConnected:true},el={dataset:{daField:k},value,checked:value===true,closest:s=>s==='[data-da-root]'?root:null};return D.handle({type:'change',target:el},c,'en',ctx)},click(action,opts={}){const root={isConnected:true},b={isConnected:true,dataset:{daAction:action},closest:s=>s==='[data-da-root]'?root:null},el={closest:s=>s==='[data-da-root]'?root:s==='[data-da-action]'?b:null};if(opts.detach)confirm=()=>{root.isConnected=false;return true};return D.handle({type:'click',target:el},c,'en',ctx)},setConfirm(fn){confirm=fn},setCurrent(v){current=v}}}
test('body, aimed head, melee and direct damage use the correct armor and bonus order',()=>{
 let c=make(),q=D.quote(c,args());assert.deepEqual([q.damage,q.hpAfter,q.spAfter],[4,36,10]);
 q=D.quote(c,args('standard','head',15,true));assert.deepEqual([q.penetrating,q.damage,q.spAfter],[4,13,10]);
 q=D.quote(c,args('melee','body',10,false));assert.deepEqual([q.effective,q.damage,q.spAfter],[6,4,10]);
 q=D.quote(c,args('direct','head',10,true));assert.deepEqual([q.damage,q.spAfter],[15,11]);
});
test('blocked damage does not ablate armor and the critical bonus bypasses it',()=>{const q=D.quote(make(),args('standard','body',10,true));assert.equal(q.penetrating,0);assert.equal(q.damage,5);assert.equal(q.spAfter,11)});
test('preview and confirmation update HP and equipped armor history once',()=>{
 const c=make(),h=harness(c);h.field('raw','15');assert.equal(h.click('preview').rerender,true);assert.equal(c.hp,40);assert.equal(h.click('apply').dirty,true);assert.equal(c.hp,36);assert.equal(c.bodyArmor,10);assert.equal(c.extra.equipment.armorHistory[0].sp,10);assert.equal(c.extra.equipment.armorHistory[0].unknown,'keep');assert.deepEqual(c.extra.equipment.future,{x:1});assert.equal(c.extra.injuries,'old');assert.equal(h.click('apply').dirty,undefined);assert.equal(c.hp,36);
});
test('head and direct damage preserve unrelated armor and data',()=>{
 let c=make(),h=harness(c);h.field('location','head');h.field('raw','15');h.field('critical',true);h.click('preview');h.click('apply');assert.equal(c.hp,27);assert.equal(c.head,10);assert.equal(c.bodyArmor,11);assert.equal(c.extra.equipment.armorHistory[0].sp,11);
 c=make();h=harness(c);h.field('type','direct');h.click('preview');h.click('apply');assert.equal(c.hp,30);assert.equal(c.bodyArmor,11);assert.equal(c.extra.equipment.armorHistory[0].sp,11);
});
test('unknown or ambiguous equipped-armor history is rejected without partial mutation',()=>{
 for(const history of [null,'future',[{recordId:'vest',piece:0,location:'body',sp:11},{recordId:'vest',piece:0,location:'body',sp:9}]]){const c=make();c.extra.equipment.armorHistory=history;const before=JSON.stringify(c),h=harness(c);h.field('raw','15');assert.match(h.click('preview').notify,/incompatible/i);assert.equal(JSON.stringify(c),before);assert.equal(E.setSP(c,'body',5).ok,false);assert.equal(JSON.stringify(c),before)}
});
test('legacy missing armor history is created only on confirmed application',()=>{
 const c=make();delete c.extra.equipment.armorHistory;const before=JSON.stringify(c),h=harness(c);h.field('raw','15');h.click('preview');assert.equal(JSON.stringify(c),before);h.click('apply');assert.equal(c.bodyArmor,10);assert.deepEqual(c.extra.equipment.armorHistory,[{recordId:'vest',piece:0,location:'body',sp:10}]);
});
test('standalone armor updates preserve a missing history and reject invalid history atomically',()=>{
 let c=make();delete c.extra.equipment.armorHistory;assert.equal(E.setSP(c,'body',7).ok,true);assert.equal(c.bodyArmor,7);assert.equal(c.extra.equipment.armorHistory[0].sp,7);
 c=make();c.extra.equipment.armorHistory={future:true};const before=JSON.stringify(c);assert.equal(E.setSP(c,'body',6).ok,false);assert.equal(JSON.stringify(c),before);
});
test('scope, data and detached form changes while confirming block damage',()=>{
 for(const kind of ['scope','data','detached']){const c=make(),h=harness(c);h.field('raw','15');h.click('preview');if(kind==='scope')h.setConfirm(()=>{h.setCurrent(false);return true});if(kind==='data')h.setConfirm(()=>{c.hp=39;return true});const result=h.click('apply',{detach:kind==='detached'});assert.equal(result.dirty,undefined);assert.equal(c.hp,kind==='data'?39:40);assert.equal(c.bodyArmor,11);assert.equal(c.extra.equipment.armorHistory[0].sp,11)}
});
test('layered armor is explicitly explained in both interface languages and in confirmation',()=>{
 const c=make(),h=harness(c);for(const l of ['ru','en']){const html=D.render(c,l);assert.match(html,/Skin Weave/);assert.match(html,/Subdermal Armor/)}h.field('raw','15');h.click('preview');let prompt='';h.setConfirm(text=>{prompt=text;return false});h.click('apply');assert.match(prompt,/multiple SP sources/i);assert.equal(c.hp,40);
});
test('unsupported extra container never changes the character',()=>{
 const c=make();c.extra='future';const before=JSON.stringify(c),h=harness(c);h.field('type','direct');assert.match(h.click('preview').notify,/incompatible/i);assert.equal(JSON.stringify(c),before);assert.equal(E.setSP(c,'body',4).ok,false);assert.equal(JSON.stringify(c),before);
});
test('malformed numbers, unsupported attack types and out-of-bounds HP do not produce a quote',()=>{
 const c=make();for(const a of [args('x'),args('standard','bad'),args('standard','body',-1),args('standard','body',1.5)])assert.equal(D.quote(c,a),null);c.hp=-999;assert.equal(D.quote(c,args()),null);
});
test('legacy numeric strings work and direct damage does not require armor values',()=>{
 const c=make();c.hp='40';c.bodyArmor='11';let q=D.quote(c,args());assert.equal(q.hpAfter,36);assert.equal(q.spAfter,10);delete c.bodyArmor;q=D.quote(c,args('direct'));assert.equal(q.hpAfter,25);assert.equal(q.sp,null);assert.equal(D.quote(c,args()),null);assert.equal(D.armorClone(c,q).hp,'40');
});
