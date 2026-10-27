'use strict';
const assert=require('node:assert/strict');
global.window={};require('node:vm').runInThisContext(require('node:fs').readFileSync(require('node:path').join(__dirname,'../public/game/archetypes.js'),'utf8'));const a=window.Archetypes;
assert.equal(a.roleIds.length,10);
const losses={rockerboy:9,solo:14,netrunner:14,tech:12,medtech:12,media:10,lawman:10,exec:12,fixer:16,nomad:14};
for(const role of a.roleIds){
 const t=a.getTemplate(role);assert.equal(t.statRows.length,10,role+' 10 STAT rows');assert(t.statRows.every(x=>x.length===10&&x.every(v=>Number.isInteger(v)&&v>=1&&v<=8)),role+' valid STAT columns');
 assert.equal(t.streetratSkills.length,20,role+' 20 skills');assert.equal(t.streetratSkills.filter(x=>x.required).length,13,role+' 13 basic');
 assert.equal(t.streetratSkills.reduce((n,s)=>n+s.level*s.costMultiplier,0),86,role+' skill cost');assert.equal(t.nativeLanguageLevels,4);assert.equal(t.extraCash,500);assert.equal(t.roleRank,4);assert.equal(t.startingHumanityLoss,losses[role]);
 assert(t.gear.some(x=>x.name?.en==='Light Armorjack Body Armor, SP 11'));assert(t.gear.some(x=>x.name?.en==='Light Armorjack Head Armor, SP 11'));
 assert(t.gear.length>0&&t.outfit.length>0&&t.cyberware.length>0);for(const item of [...t.gear,...t.outfit,...t.cyberware])if(item.type==='choice'){assert.equal(item.choose,1);assert(item.options.length>=2);assert(item.options.every(o=>o.type==='item'&&o.name.ru&&o.name.en))}else assert(item.name.ru&&item.name.en);
 const preset=Object.fromEntries(t.streetratSkills.map(s=>[s.name,s.level]));assert.deepEqual(a.validateEdgerunner(role,preset),{ok:true,points:86,errors:[]},role+' role-restricted edgerunner skills');
 assert.equal(a.getSkills(role).length,20);assert.equal(a.fromRolls(role,'streetrat',[1]).stats.INT,t.statRows[0][0]);
 const rolling=a.fromRolls(role,'edgerunner',[1,2,3,4,5,6,7,8,9,10]);a.ORDER.forEach((name,i)=>assert.equal(rolling.stats[name],t.statRows[i][i]));
 let n=0,rr=a.rollStats(role,'edgerunner',()=>{n++;return .4});assert.equal(n,10);assert.deepEqual(rr.rolls,Array(10).fill(5));
 const altered=a.getTemplate(role);altered.statRows[0][0]=999;assert.notEqual(a.getTemplate(role).statRows[0][0],999,'defensive copy');
}
assert.equal(a.getTemplate('fixer').gear.filter(v=>v.type==='choice'&&v.options.some(x=>x.name.en==='Heavy Pistol')).length,2,'two independent pistol choices printed for Fixer');
assert.equal(a.getTemplate('tech').streetratSkills.find(s=>s.name==='Science').needsSpecialty,true);
assert.equal(a.getTemplate('rockerboy').streetratSkills.find(s=>s.name==='Play Instrument').needsSpecialty,true);
assert.throws(()=>a.fromRolls('solo','streetrat',[0]));assert.throws(()=>a.fromRolls('solo','edgerunner',[1]));assert.throws(()=>a.fromRolls('solo','complete',[1]));assert.throws(()=>a.getTemplate('not-a-role'));
const bad=Object.fromEntries(a.getSkills('solo').map(s=>[s.name,s.level]));bad.Autofire=7;assert.equal(a.validateEdgerunner('solo',bad).ok,false);bad.Autofire=6;bad.Science=1;assert(a.validateEdgerunner('solo',bad).errors.includes('not_role_skill:Science'));
console.log('PASS: 10 templates, 100 STAT rows, 200 skills, choices, costs, both random methods, and isolation.');
