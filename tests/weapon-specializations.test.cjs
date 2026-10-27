const {test}=require('node:test'),assert=require('node:assert/strict');
global.window={};require('../public/game/character-extra.js');
const X=window.CharacterExtra;
function person(){return {name:'Tester',role:'solo',stats:{DEX:7,REF:5,EMP:6,LUCK:6},skills:{'Martial Arts':0,Handgun:4},humanity:60,extra:{luck:5,luckUse:2,modifier:0,specializations:[{id:'karate',name:'Martial Arts (Karate)',stat:'DEX',level:6,cost:2}],weapons:[{id:'w1',name:'Karate strike',skill:'Martial Arts',stat:'REF',modifier:0,ammo:5,ammoCost:1,capacity:5,usesAmmo:true,skillSpecializationId:'karate',future:{untouched:true}}]}}}
function attack(c){return X.handle({type:'click',target:{closest:()=>({dataset:{cxAction:'attack',cxIndex:'0'}})}},c,'en',{isCurrent:()=>true})}
function select(c,value,current=()=>true){return X.handle({type:'change',target:{dataset:{cxIndex:'0'},value,hasAttribute:k=>k==='data-cx-weapon-spec'}},c,'en',{isCurrent:current})}
test('weapon attack uses the selected specialization level and STAT',()=>{
 const c=person(),result=attack(c);assert.equal(result.roll.stat,7);assert.equal(result.roll.skill,6);assert.equal(result.roll.luckSpent,2);assert.equal(c.extra.weapons[0].ammo,4);assert.equal(c.extra.luck,3);assert.deepEqual(c.extra.weapons[0].future,{untouched:true});
});
test('legacy weapons retain their selected base skill and STAT',()=>{
 const c=person(),w=c.extra.weapons[0];delete w.skillSpecializationId;w.skill='Handgun';const result=attack(c);assert.equal(result.roll.stat,5);assert.equal(result.roll.skill,4);
});
test('untrained base Martial Arts cannot attack or spend ammo and luck; an old trained level remains usable',()=>{
 const c=person(),w=c.extra.weapons[0];delete w.skillSpecializationId;const denied=attack(c);assert.equal(denied.roll,undefined);assert.equal(w.ammo,5);assert.equal(c.extra.luck,5);assert.equal(c.extra.luckUse,2);assert.match(denied.notify,/at least one rank/i);c.skills['Martial Arts']=4;const allowed=attack(c);assert.equal(allowed.roll.skill,4);assert.equal(w.ammo,4);
});
test('missing, duplicate, malformed or untrained martial arts references cannot spend resources',()=>{
 for(const configure of [c=>c.extra.specializations=[],c=>c.extra.specializations.push({...c.extra.specializations[0]}),c=>c.extra.weapons[0].skillSpecializationId=null,c=>c.extra.weapons[0].skillSpecializationId={version:2},c=>c.extra.specializations[0].level=0,c=>c.extra.specializations[0].stat='?']){const c=person();configure(c);X.init(c);const before=JSON.stringify(c.extra.weapons[0]);const r=attack(c);assert.equal(r.roll,undefined);assert.equal(c.extra.weapons[0].ammo,5);assert.equal(c.extra.luck,5);assert.equal(c.extra.luckUse,2);assert.equal(JSON.stringify(c.extra.weapons[0]),before);}
});
test('selection is explicit, rejects stale and ambiguous choices, and follows later edits',()=>{
 const c=person(),w=c.extra.weapons[0];delete w.skillSpecializationId;assert.equal(select(c,'s:karate',()=>false).dirty,undefined);assert.equal(w.skillSpecializationId,undefined);assert.equal(select(c,'s:karate').dirty,true);c.extra.specializations[0].name='Martial Arts (Judo)';c.extra.specializations[0].level=3;assert.equal(attack(c).roll.skill,3);assert.equal(select(c,'').dirty,true);assert.equal(w.skillSpecializationId,undefined);c.extra.specializations.push({...c.extra.specializations[0]});assert.equal(select(c,'s:karate').dirty,undefined);
});
test('both sheet languages expose specialization labels without changing old data',()=>{
 for(const lang of ['ru','en']){const c=person();X.init(c);const before=JSON.stringify(c);const out=X.render(c,lang);assert.match(out,/data-cx-weapon-spec/);assert.match(out,/Martial Arts \(Karate\)/);assert.match(out,/DEX 6/);assert.equal(JSON.stringify(c),before);}
});
test('large sheet indexes specialization IDs once instead of rescanning per weapon',()=>{
 const c=person(),specializationCount=150,weaponCount=120;let idReads=0;
 c.extra.specializations=Array.from({length:specializationCount},(_,i)=>({get id(){idReads++;return 'spec-'+i},name:'Martial Arts (Style '+i+')',stat:'DEX',level:2,cost:2}));
 c.extra.weapons=Array.from({length:weaponCount},(_,i)=>({id:'w-'+i,name:'Test '+i,skill:'Handgun',stat:'REF',modifier:0,ammo:0,capacity:0,usesAmmo:false,skillSpecializationId:'spec-'+(i%specializationCount)}));
 const html=X.render(c,'en');assert.equal((html.match(/data-cx-weapon-spec/g)||[]).length,weaponCount);assert.match(html,/s:spec-119/);
 // Counting source-ID accesses checks algorithmic behavior, independent of machine speed.
 assert.ok(idReads<20*(specializationCount+weaponCount),`expected near-linear indexing; read ${idReads} IDs`);
});
