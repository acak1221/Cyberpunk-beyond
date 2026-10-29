const {test}=require('node:test');
const assert=require('node:assert/strict');
global.window={};require('../public/game/vehicle-tools.js');
const {dodgeRam,ramDamage,render,handle}=window.VehicleTools;
test('a pedestrian dodges at DV 13, ties fail, and critical dice modify the total once',()=>{
 assert.deepEqual(dodgeRam({dex:6,evasion:4,modifier:0},()=>3),{first:3,extra:0,total:13,dv:13,success:false});
 assert.equal(dodgeRam({dex:6,evasion:4,modifier:0},()=>4).success,true);
 let seq=[10,2];assert.deepEqual(dodgeRam({dex:0,evasion:1,modifier:0},()=>seq.shift()),{first:10,extra:2,total:13,dv:13,success:false});
 seq=[1,10];assert.equal(dodgeRam({dex:10,evasion:10,modifier:0},()=>seq.shift()).total,11);
});
test('rejects invalid dodge values without rolling and invalid die results',()=>{
 for(const values of [{dex:NaN,evasion:1,modifier:0},{dex:1,evasion:1.2,modifier:0},{dex:1,evasion:1,modifier:-101}])assert.equal(dodgeRam(values,()=>{throw Error('must not roll')}),null);
 assert.equal(dodgeRam({dex:1,evasion:1,modifier:0},()=>0),null);
 let seq=[1,11];assert.equal(dodgeRam({dex:1,evasion:1,modifier:0},()=>seq.shift()),null);
});
test('ram damage supports a GM-selected shared or separate roll without inferring extra injuries',()=>{
 let seq=[1,2,3,4,5,6];assert.deepEqual(ramDamage('shared',()=>seq.shift()),{mode:'shared',first:[1,2,3,4,5,6],second:[1,2,3,4,5,6],firstTotal:21,secondTotal:21});
 seq=[1,1,1,1,1,1,6,6,6,6,6,6];const r=ramDamage('separate',()=>seq.shift());assert.equal(r.firstTotal,6);assert.equal(r.secondTotal,36);assert.equal(seq.length,0);assert.equal(Object.hasOwn(r,'critical'),false);
 assert.equal(ramDamage('bad',()=>{throw Error('must not roll')}),null);assert.equal(ramDamage('shared',()=>7),null);
});
test('collision controls and consequences appear in both languages without writing character data',()=>{
 for(const lang of ['ru','en']){const h=render(lang);for(const key of ['ram-dodge','ram-damage','data-vt-ram-target','data-vt-ram-mode'])assert.ok(h.includes(key));assert.match(h,/Whiplash/);assert.match(h,/\+5/);assert.match(h,/DV 13/);assert.match(h,/6d6/);assert.match(h,lang==='ru'?/объектом с HP/:/something with HP/);}
});
test('interactive pedestrian dodge and collision damage identify the selected scenario',()=>{
 const fields={'[data-vt-ram-target]':{value:'pedestrian'},'[data-vt-ram-mode]':{value:'shared'},'[data-vt-ram-dex]':{value:'6'},'[data-vt-ram-evasion]':{value:'4'},'[data-vt-ram-mod]':{value:'0'},'[data-vt-ram-dodge-result]':{textContent:''},'[data-vt-ram-damage-result]':{textContent:''}};
 const root={querySelector:s=>fields[s]},button={dataset:{vtAction:'ram-dodge'},closest:()=>root},event={type:'click',target:{closest:()=>button}},old=Math.random;
 try{Math.random=()=>0.3;assert.equal(handle(event,'en'),true);assert.match(fields['[data-vt-ram-dodge-result]'].textContent,/Pedestrian.*14 > DV 13.*success/);button.dataset.vtAction='ram-damage';assert.equal(handle(event,'en'),true);assert.match(fields['[data-vt-ram-damage-result]'].textContent,/Pedestrian.*Both sides.*6d6.*= 12/);fields['[data-vt-ram-target]'].value='cover';fields['[data-vt-ram-mode]'].value='separate';assert.equal(handle(event,'ru'),true);assert.match(fields['[data-vt-ram-damage-result]'].textContent,/Укрытие.*Транспорт.*Цель/);button.dataset.vtAction='ram-dodge';assert.equal(handle(event,'en'),true);assert.match(fields['[data-vt-ram-dodge-result]'].textContent,/only for a pedestrian/)}finally{Math.random=old}
});
test('editing collision fields clears stale outcomes without changing saved state',()=>{
 const outputs={'[data-vt-ram-dodge-result]':{textContent:'prior dodge'},'[data-vt-ram-damage-result]':{textContent:'prior damage'}};
 const root={querySelector:s=>outputs[s]},target={matches:()=>true,closest:()=>root};
 assert.equal(handle({type:'input',target},'en'),true);assert.equal(outputs['[data-vt-ram-dodge-result]'].textContent,'');assert.equal(outputs['[data-vt-ram-damage-result]'].textContent,'');
 assert.equal(handle({type:'change',target:{matches:()=>false}},'en'),false);
});
test('other objects with HP leave movement consequences to the GM',()=>{
 const fields={'[data-vt-ram-target]':{value:'object'},'[data-vt-ram-mode]':{value:'shared'},'[data-vt-ram-damage-result]':{textContent:''}};
 const root={querySelector:s=>fields[s]},button={dataset:{vtAction:'ram-damage'},closest:()=>root};
 assert.equal(handle({type:'click',target:{closest:()=>button}},'en'),true);
 assert.match(fields['[data-vt-ram-damage-result]'].textContent,/Another object with HP.*GM decides whether movement stops/);
});
