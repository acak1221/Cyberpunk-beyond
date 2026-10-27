const {test}=require('node:test'),assert=require('node:assert/strict');
global.window={};require('../public/game/therapy-tools.js');const M=window.TherapyTools;
const person=()=>({id:'a',name:'V',humanity:30,stats:{EMP:6},extra:{equipment:{maxHumanity:38,unknown:{keep:true}},other:'untouched'}});
const sequence=values=>()=>values.shift();
function setup(){M.setScope(null);M.setScope('account-test');const c=person(),ctx={lang:'en',characters:[c],isCurrent:(x,s)=>x===c&&s==='account-test'},root={isConnected:true},button={isConnected:true,dataset:{therapyAction:'roll'},closest:s=>s==='[data-therapy-root]'?root:null},event={type:'click',target:{closest:s=>s==='[data-therapy-action]'?button:null}};M.render(ctx);return {c,ctx,root,button,event,field(key,value){return M.handle({type:'change',target:{dataset:{therapyField:key},value,checked:value===true}},ctx)}}}
test('prices, treatment DVs and recovery dice match the book',()=>{
 assert.deepEqual(M.THERAPIES.addiction,{dv:15,dice:0,price:1000,materials:500});assert.deepEqual(M.THERAPIES.standard,{dv:15,dice:2,price:500,materials:100});assert.deepEqual(M.THERAPIES.extreme,{dv:17,dice:4,price:1000,materials:500});
 const r=M.check(8,6,0,'standard',sequence([.9,.4,.5,.99]));assert.equal(r.die,10);assert.equal(r.extra,5);assert.equal(r.total,29);assert.deepEqual(r.dice,[4,6]);assert.equal(r.gain,10);
 const fail=M.check(5,4,0,'extreme',sequence([.5]));assert.equal(fail.total,15);assert.equal(fail.success,false);assert.deepEqual(fail.dice,[]);
});
test('maximum must be explicitly verified; compatible equipment data is not changed',()=>{
 const c=person();assert.deepEqual(M.humanInfo(c),{humanity:30,max:38});delete c.extra.equipment.maxHumanity;assert.equal(M.humanInfo(c),null);c.extra.equipment.maxHumanity=61;assert.equal(M.humanInfo(c),null);c.extra.equipment.maxHumanity=20;assert.equal(M.humanInfo(c),null);
});
test('completed therapy applies once, capped at maximum without changing equipment or money',()=>{
 const x=setup(),oldRandom=Math.random;window.confirm=()=>true;Math.random=()=>.99;try{x.field('tech','8');x.field('skill','6');x.field('ack',true);assert.equal(M.handle(x.event,x.ctx).rerender,true);const html=M.render(x.ctx);assert.match(html,/To be restored: 8/);x.button.dataset.therapyAction='apply';assert.equal(M.handle(x.event,x.ctx).dirty,true);assert.equal(x.c.humanity,38);assert.deepEqual(x.c.extra.equipment.unknown,{keep:true});assert.equal(x.c.extra.other,'untouched');assert.equal(M.handle(x.event,x.ctx).dirty,undefined);assert.equal(x.c.humanity,38);}finally{Math.random=oldRandom}
});
test('the completed week and non-self treatment must be acknowledged',()=>{
 const x=setup();window.confirm=()=>true;assert.equal(M.handle(x.event,x.ctx).dirty,undefined);assert.equal(x.c.humanity,30);assert.match(M.handle(x.event,x.ctx).notify,/Check/);
});
test('Medical Tech requires at least one level and identifies the Medtech restriction',()=>{
 assert.equal(M.check(8,0,0,'standard',()=>.99),null);const x=setup();window.confirm=()=>true;x.field('skill','0');x.field('ack',true);assert.match(M.handle(x.event,x.ctx).notify,/Check/);assert.equal(x.c.humanity,30);assert.match(M.render(x.ctx),/Medical Tech is available to Medtechs/);
});
test('replaced patient, changed humanity, switched account or detached form cannot apply a pending result',()=>{
 for(const mode of ['patient','humanity','scope','detached']){const x=setup(),oldRandom=Math.random;Math.random=()=>.99;try{window.confirm=()=>true;x.field('tech','8');x.field('skill','6');x.field('ack',true);M.handle(x.event,x.ctx);x.button.dataset.therapyAction='apply';window.confirm=()=>{if(mode==='patient')x.ctx.characters[0]=JSON.parse(JSON.stringify(x.c));if(mode==='humanity')x.c.humanity=31;if(mode==='scope')M.setScope('account-other');if(mode==='detached')x.root.isConnected=false;return true};const r=M.handle(x.event,x.ctx);assert.equal(r.dirty,undefined);assert.equal(x.c.humanity,mode==='humanity'?31:30);}finally{Math.random=oldRandom}}
});
test('duplicate patient IDs are not actionable',()=>{
 const x=setup();x.ctx.characters.push({...x.c});x.field('ack',true);window.confirm=()=>true;assert.equal(M.handle(x.event,x.ctx).dirty,undefined);assert.equal(x.c.humanity,30);
});
test('an altered maximum during confirmation prevents recovery',()=>{
 const x=setup(),oldRandom=Math.random;Math.random=()=>.99;try{window.confirm=()=>true;x.field('tech','8');x.field('skill','6');x.field('ack',true);M.handle(x.event,x.ctx);x.button.dataset.therapyAction='apply';window.confirm=()=>{x.c.extra.equipment.maxHumanity=35;return true};assert.equal(M.handle(x.event,x.ctx).dirty,undefined);assert.equal(x.c.humanity,30);assert.equal(x.c.extra.equipment.maxHumanity,35);}finally{Math.random=oldRandom}
});
test('addiction treatment has no automatic changes to character data',()=>{
 const x=setup(),oldRandom=Math.random,before=JSON.stringify(x.c);Math.random=()=>.99;try{window.confirm=()=>true;x.field('type','addiction');x.field('tech','8');x.field('skill','6');x.field('ack',true);const r=M.handle(x.event,x.ctx);assert.equal(r.dirty,undefined);assert.equal(JSON.stringify(x.c),before);const html=M.render(x.ctx);assert.match(html,/one addiction/);assert.doesNotMatch(html,/data-therapy-action="apply"/);}finally{Math.random=oldRandom}
});
