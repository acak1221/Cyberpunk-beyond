const {test}=require('node:test');
const assert=require('node:assert/strict');
global.window={};require('../public/game/vehicle-tools.js');
const {MANEUVERS,check,render,handle}=window.VehicleTools;
test('driving threshold uses REF plus skill, independent of modifiers',()=>{
 let rolls=0;const die=()=>{rolls++;return 5};
 assert.deepEqual(check({ref:6,skill:4,modifier:-100,task:'basic'},die),{auto:true,task:'basic'});assert.equal(rolls,0);
 assert.deepEqual(check({ref:5,skill:4,modifier:0,task:'basic'},die),{auto:false,task:'basic',first:5,extra:0,total:14,dv:10,success:true});assert.equal(rolls,1);
});
test('all maneuver DVs and opposed threshold match corebook p. 192',()=>{
 assert.deepEqual(Object.fromEntries(Object.entries(MANEUVERS).map(([k,v])=>[k,v.dv])),{basic:10,swerve:13,sharp:13,stop:13,bootleg:17,jump:17,landing:13,aerobatic:17});
 const tied=check({ref:5,skill:5,modifier:0,task:'swerve'},()=>3);assert.equal(tied.total,13);assert.equal(tied.success,false);
 assert.equal(check({ref:5,skill:5,modifier:0,task:'swerve'},()=>4).success,true);
});
test('critical dice modify checks once and do not guarantee success or failure',()=>{
 let seq=[10,10];let r=check({ref:0,skill:0,modifier:-10,task:'jump'},()=>seq.shift());assert.equal(r.total,10);assert.equal(r.success,false);assert.equal(seq.length,0);
 seq=[1,10];r=check({ref:10,skill:10,modifier:0,task:'jump'},()=>seq.shift());assert.equal(r.total,11);assert.equal(r.success,false);
 seq=[1,1];r=check({ref:10,skill:10,modifier:0,task:'jump'},()=>seq.shift());assert.equal(r.total,20);assert.equal(r.success,true);
});
test('rejects invalid inputs and unknown actions without rolling',()=>{
 for(const data of [{ref:NaN,skill:1,modifier:0,task:'basic'},{ref:1.1,skill:1,modifier:0,task:'basic'},{ref:1,skill:1,modifier:101,task:'basic'},{ref:1,skill:1,modifier:0,task:'ghost'}])assert.equal(check(data,()=>{throw Error('must not roll')}),null);
});
test('bilingual rendering links to vehicle rules and no state storage',()=>{
 for(const lang of ['ru','en']){const html=render(lang);assert.match(html,/data-page="189"/);assert.match(html,/DV 13/);assert.match(html,/DV 17/);assert.match(html,/6d6/);assert.match(html,/Whiplash/);assert.match(html,/0 SDP/);}
 assert.equal(handle({type:'click',target:{closest:()=>null}},'en'),false);
});
test('interactive checks show action cost and loss of control in either language',()=>{
 const values={'[data-vt-ref]':{value:'5'},'[data-vt-skill]':{value:'5'},'[data-vt-mod]':{value:'0'},'[data-vt-task]':{value:'swerve'},'[data-vt-result]':{textContent:''}};
 const root={querySelector:s=>values[s]},button={closest:()=>root},event={type:'click',target:{closest:()=>button}};
 const old=Math.random;Math.random=()=>0.2;
 try{assert.equal(handle(event,'en'),true);assert.match(values['[data-vt-result]'].textContent,/Action and a Move Action/);assert.match(values['[data-vt-result]'].textContent,/Lose control/);assert.equal(handle(event,'ru'),true);assert.match(values['[data-vt-result]'].textContent,/Потеря управления/);}
 finally{Math.random=old}
});
