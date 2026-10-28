const {test}=require('node:test'),assert=require('node:assert/strict');
global.window={};require('../public/game/combat-tools.js');require('../public/game/equipment-tools.js');require('../public/game/damage-apply.js');
const D=window.DamageApply;
const make=(hp=40,sp=11)=>({id:'x',hp,head:sp,bodyArmor:sp,extra:{equipment:{armor:{body:{recordId:'v',piece:0,catalogId:'armor-light'}},armorHistory:[{recordId:'v',piece:0,location:'body',sp,other:'retain'}],unknown:{future:1}},medical:{version:1,stabilized:true,stabilizedHp:hp,future:'keep'}}});
const base={type:'standard',location:'body',raw:15,critical:false};
function harness(c){D.setScope(null);D.setScope('owner');D.render(c,'en');let onConfirm=()=>true,valid=true;const ctx={isCurrent:(x,s)=>valid&&x===c&&s==='owner'};window.confirm=(s)=>onConfirm(s);return {field(k,value){const r={isConnected:true},el={dataset:{daField:k},value,checked:value===true,closest:s=>s==='[data-da-root]'?r:null};return D.handle({type:'change',target:el},c,'en',ctx)},click(a){const r={isConnected:true},b={isConnected:true,dataset:{daAction:a},closest:s=>s==='[data-da-root]'?r:null},el={closest:s=>s==='[data-da-root]'?r:s==='[data-da-action]'?b:null};return D.handle({type:'click',target:el},c,'en',ctx)},confirm(fn){onConfirm=fn},stale(){valid=false}}}
test('armor piercing ablates two only when the shot penetrates; caps at zero',()=>{
 let q=D.quote(make(),{...base,ammo:'ap'});assert.deepEqual([q.hpAfter,q.spAfter,q.penetrating],[36,9,4]);
 q=D.quote(make(),{...base,raw:10,critical:true,ammo:'ap'});assert.deepEqual([q.hpAfter,q.spAfter,q.damage],[35,11,5]);
 q=D.quote(make(40,1),{...base,raw:2,ammo:'ap'});assert.equal(q.spAfter,0);
 q=D.quote(make(),{...base,location:'head',critical:true,ammo:'ap'});assert.deepEqual([q.damage,q.hpAfter,q.spAfter],[13,27,9]);
});
test('rubber never ablates and its special HP threshold uses the exact printed strict inequalities',()=>{
 let q=D.quote(make(40,11),{...base,ammo:'rubber'});assert.deepEqual([q.hpAfter,q.spAfter,q.rubberLimited],[36,11,false]);
 q=D.quote(make(2,0),{...base,raw:2,ammo:'rubber'});assert.deepEqual([q.hpAfter,q.damage,q.rubberLimited],[0,2,false]);
 q=D.quote(make(2,0),{...base,raw:3,ammo:'rubber'});assert.deepEqual([q.hpAfter,q.damage,q.rubberLimited],[1,1,true]);
 q=D.quote(make(1,0),{...base,raw:3,ammo:'rubber'});assert.deepEqual([q.hpAfter,q.rubberLimited],[-2,false]);
 q=D.quote(make(5,3),{...base,location:'head',raw:6,ammo:'rubber'});assert.deepEqual([q.hpAfter,q.spAfter,q.damage],[1,3,4]);
});
test('special ammunition is rejected for melee and direct damage, and rubber cannot roll critical injury',()=>{
 for(const type of ['melee','direct'])for(const ammo of ['ap','rubber'])assert.equal(D.quote(make(),{...base,type,ammo}),null);
 assert.equal(D.quote(make(),{...base,ammo:'rubber',critical:true}),null);assert.equal(D.quote(make(),{...base,ammo:'future'}),null);
});
test('existing callers without an ammo field retain standard and direct damage',()=>{
 let q=D.quote(make(),base);assert.deepEqual([q.hpAfter,q.spAfter,q.ammo],[36,10,'standard']);q=D.quote(make(),{...base,type:'direct',location:'head'});assert.deepEqual([q.hpAfter,q.spAfter],[25,11]);
});
test('confirmed AP updates the armor history atomically and leaves unrelated fields intact',()=>{
 const c=make(),h=harness(c);h.field('ammo','ap');h.field('raw','15');assert.equal(h.click('preview').rerender,true);assert.equal(c.bodyArmor,11);assert(h.click('apply').dirty);assert.deepEqual([c.hp,c.bodyArmor,c.extra.equipment.armorHistory[0].sp],[36,9,9]);assert.equal(c.extra.equipment.armorHistory[0].other,'retain');assert.equal(c.extra.equipment.unknown.future,1);assert.equal(c.extra.medical.stabilized,false);assert.equal(c.extra.medical.future,'keep');assert(!h.click('apply').dirty);
});
test('confirmed rubber displays cap, preserves armor and asks for confirmation',()=>{
 const c=make(5,0),h=harness(c);h.field('ammo','rubber');h.field('raw','6');h.click('preview');assert.match(D.render(c,'en'),/limited the HP reduction to 1/);let prompt='';h.confirm(x=>{prompt=x;return true});assert(h.click('apply').dirty);assert.match(prompt,/limited the HP reduction to 1/);assert.equal(c.hp,1);assert.equal(c.bodyArmor,0);assert.equal(c.extra.equipment.armorHistory[0].sp,0);
});
test('unsupported combinations and switched ammunition invalidate preview without touching data',()=>{
 const c=make(),h=harness(c),before=JSON.stringify(c);h.field('ammo','rubber');h.field('critical',true);assert.match(h.click('preview').notify,/cannot cause a Critical Injury/);assert.equal(JSON.stringify(c),before);h.field('critical',false);h.field('raw','15');h.click('preview');h.field('ammo','ap');assert(!h.click('apply').dirty);assert.equal(JSON.stringify(c),before);
});
test('account, data or selected ammo changed during confirmation cannot apply',()=>{
 for(const change of ['scope','data','ammo']){const c=make(),h=harness(c);h.field('ammo','ap');h.field('raw','15');h.click('preview');h.confirm(()=>{if(change==='scope')h.stale();if(change==='data')c.extra.equipment.unknown.future=2;if(change==='ammo')h.field('ammo','rubber');return true});assert(!h.click('apply').dirty);assert.equal(c.hp,40);assert.equal(c.bodyArmor,11);assert.equal(c.extra.equipment.armorHistory[0].sp,11)}
});
test('both languages describe no ammunition consumption and limits',()=>{
 const c=make(),h=harness(c);let html=D.render(c,'en');assert.match(html,/Armor-Piercing/);assert.match(html,/does not consume ammunition/);assert.match(html,/more than 1 HP/);html=D.render(c,'ru');assert.match(html,/Бронебойный/);assert.match(html,/не расходуются/);assert.match(html,/больше 1 HP/);
});
test('AP warns about both armor layers even when the selected armor is already at zero',()=>{
 const c=make(40,0),h=harness(c);h.field('ammo','ap');h.field('raw','5');h.click('preview');let prompt='';h.confirm(x=>{prompt=x;return false});h.click('apply');assert.match(prompt,/multiple SP sources.*by 2/i);assert.equal(c.hp,40);
});
test('typing into damage input immediately removes stale preview and apply controls without rerender or losing focus',()=>{
 const c=make();D.setScope(null);D.setScope('focus-test');D.render(c,'en');window.confirm=()=>true;
 const removed={apply:false,preview:false},apply={remove(){removed.apply=true}},preview={remove(){removed.preview=true}},root={isConnected:true,querySelector:s=>s==='[data-da-action="apply"]'?apply:s==='[data-da-preview]'?preview:null},ctx={isCurrent:(x,s)=>x===c&&s==='focus-test'};
 const button={dataset:{daAction:'preview'},isConnected:true,closest:s=>s==='[data-da-root]'?root:null};
 const click={type:'click',target:{closest:s=>s==='[data-da-root]'?root:s==='[data-da-action]'?button:null}};
 assert.equal(D.handle(click,c,'en',ctx).rerender,true);assert.match(D.render(c,'en'),/data-da-preview/);
 const input={dataset:{daField:'raw'},value:'12',closest:s=>s==='[data-da-root]'?root:null},documentMock={activeElement:input};
 const res=D.handle({type:'input',target:input},c,'en',ctx);assert.equal(res.rerender,false);assert.equal(documentMock.activeElement,input);assert.deepEqual(removed,{apply:true,preview:true});assert.doesNotMatch(D.render(c,'en'),/data-da-preview/);
 button.dataset.daAction='apply';assert.match(D.handle(click,c,'en',ctx).notify,/changed/i);assert.equal(c.hp,40);
});
