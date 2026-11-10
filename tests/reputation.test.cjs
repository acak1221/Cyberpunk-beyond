const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
global.window={};require('../site/character-extra.js');
const X=window.CharacterExtra,source=f=>fs.readFileSync(__dirname+'/../site/'+f,'utf8');
const person=extra=>({name:'Vi',role:'solo',hp:45,humanity:60,stats:{COOL:6,REF:7,BODY:8,WILL:6,EMP:6,LUCK:6},skills:{},extra:{luck:6,luckUse:2,modifier:-3,...extra}});
const facedown=c=>X.handle({type:'click',target:{closest:()=>({dataset:{cxAction:'facedown'}})}},c,'en',{isCurrent:()=>true});
const edit=(c,field,el)=>X.handle({type:'change',target:{dataset:{cxField:field},hasAttribute:()=>false,...el}},c,'en',{isCurrent:()=>true});

test('a Facedown is COOL + Reputation + 1d10 and nothing else (p. 194)',()=>{
 const c=person({reputation:4}),r=facedown(c).roll;
 assert.equal(r.type,'check');assert.equal(r.plain,true);assert.equal(r.stat,6);assert.equal(r.skill,4);assert.equal(r.modifier,0);assert.match(r.label,/^Facedown · Reputation 4$/);
 assert.equal(c.extra.modifier,-3,'the check modifier is not used up');assert.equal(c.extra.luckUse,2,'nor is LUCK');
 assert.equal(facedown(person({})).roll.skill,0,'no Reputation yet');
});

test('a known coward subtracts the Reputation',()=>{
 const r=facedown(person({reputation:5,reputationCoward:true})).roll;
 assert.equal(r.skill,0);assert.equal(r.modifier,-5);assert.match(r.label,/Reputation −5/);
 assert.equal(facedown(person({reputation:0,reputationCoward:true})).roll.modifier,0);
});

test('Reputation is kept within 0–10, the reason within 200 characters, the coward mark as a boolean',()=>{
 const c=person({});
 edit(c,'reputation',{type:'number',value:'25'});assert.equal(c.extra.reputation,10);edit(c,'reputation',{type:'number',value:'-3'});assert.equal(c.extra.reputation,0);
 edit(c,'reputationNote',{type:'text',value:'x'.repeat(500)});assert.equal(c.extra.reputationNote.length,200);
 edit(c,'reputationCoward',{type:'checkbox',checked:true,value:'on'});assert.equal(c.extra.reputationCoward,true);edit(c,'reputationCoward',{type:'checkbox',checked:false,value:'on'});assert.equal(c.extra.reputationCoward,false);
 const html=X.render(person({reputation:3,reputationNote:'<b>x</b>',reputationCoward:true}),'ru');
 assert.match(html,/data-cx-field="reputation" value="3"/);assert.match(html,/data-cx-field="reputationCoward" checked/);assert.match(html,/value="&lt;b&gt;x&lt;\/b&gt;"/);assert.match(html,/data-cx-action="facedown"/);
});

test('the app rolls a plain check without wound or effect modifiers, and the combat tab offers it',()=>{
 const app=source('app.js'),tabs=source('sheet-tabs.js');
 assert.match(app,/q\.plain\?q\.modifier:q\.modifier\+\(applied\?0:woundPenalty\(c\)\)\+effectModifier\(/);
 assert.match(app,/\(q\.plain\?'':effectLabel\(/);
 assert.match(tabs,/\['\[data-cx-action="facedown"\]'/);assert.match(tabs,/reputationCoward===true\?-1:1/);
 assert.equal(X.rollStatKey(person({}),'facedown'),'COOL');
});
