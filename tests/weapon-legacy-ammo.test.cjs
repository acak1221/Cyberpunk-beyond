const {test}=require('node:test'),assert=require('node:assert/strict');
global.window={};require('../public/game/character-extra.js');
const X=window.CharacterExtra;
function person(weapon){return {name:'Tester',role:'solo',stats:{REF:5,EMP:6,LUCK:6},skills:{Handgun:4},extra:{luck:3,luckUse:1,modifier:0,weapons:[{id:'w',name:'Pistol',skill:'Handgun',stat:'REF',capacity:10,usesAmmo:true,...weapon}]}}}
function attack(c,isCurrent=()=>true){return X.handle({type:'click',target:{closest:()=>({dataset:{cxAction:'attack',cxIndex:'0'}})}},c,'en',{isCurrent})}
test('missing or null ammunition cost displays and consumes one, and an empty magazine cannot be fired again',()=>{
 for(const cost of [undefined,null]){const c=person({ammo:1,ammoCost:cost});assert.match(X.render(c,'en'),/data-cx-key="ammoCost" value="1"/);const first=attack(c);assert.ok(first.roll);assert.equal(c.extra.weapons[0].ammo,0);const beforeLuck=c.extra.luck;const second=attack(c);assert.equal(second.roll,undefined);assert.match(second.notify,/not enough ammunition/i);assert.equal(c.extra.luck,beforeLuck);assert.equal(c.extra.weapons[0].ammo,0);}
});
test('an explicitly zero ammunition cost remains zero',()=>{
 const c=person({ammo:0,ammoCost:0});assert.match(X.render(c,'en'),/data-cx-key="ammoCost" value="0"/);assert.ok(attack(c).roll);assert.equal(c.extra.weapons[0].ammo,0);
});
test('a missing weapon modifier uses the displayed zero; negative modifiers remain supported',()=>{
 for(const [modifier,expected] of [[undefined,0],[null,0],[-3,-3]]){const c=person({ammo:1,ammoCost:1,modifier});c.extra.luckUse=0;const result=attack(c);assert.equal(result.roll.modifier,expected);}
});
test('a stale or failed scope check cannot spend ammunition or luck',()=>{
 for(const check of [()=>false,()=>{throw Error('stale')}]){const c=person({ammo:1,ammoCost:1});const result=attack(c,check);assert.equal(result.roll,undefined);assert.equal(c.extra.weapons[0].ammo,1);assert.equal(c.extra.luck,3);assert.equal(c.extra.luckUse,1);assert.match(result.notify,/no longer open/i);}
});
