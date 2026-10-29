const {test}=require('node:test');
const assert=require('node:assert/strict');
global.window={};require('../public/game/check-modifiers.js');
const {conditions,calculate,render,handle}=window.CheckModifiers;
test('the Corebook examples have their printed modifier values',()=>{
 assert.deepEqual(Object.fromEntries(Object.entries(conditions).map(([k,v])=>[k,v.value])),{lowLight:-1,firstTime:-1,complex:-2,tools:-2,poorSleep:-2,stress:-2,exhausted:-4,sedated:-4,secret:-4,obscured:-4});
});
test('selected conditions stack and approved bonuses apply once',()=>{
 assert.equal(calculate([],false,false,0),0);
 assert.equal(calculate(['lowLight','complex','stress'],true,true,0),-3);
 assert.equal(calculate(['exhausted','sedated','secret','obscured'],false,false,3),-13);
 assert.equal(calculate([],true,true,-1),1);
});
test('invalid and repeated selections are rejected',()=>{
 for(const args of [[['lowLight','lowLight'],false,false,0],[['unknown'],false,false,0],[[],1,false,0],[[],false,false,0.1],[[],false,false,101],[[],false,false,NaN]])assert.equal(calculate(...args),null);
});
test('both languages offer explicit GM approval and link to the source',()=>{
 for(const lang of ['ru','en']){const s=render(lang);assert.match(s,/data-page="130"/);assert.match(s,/data-cm-complementary/);assert.match(s,/data-cm-time/);assert.match(s,/data-cm-result role="status"/);assert.match(s,lang==='ru'?/ведущий/i:/GM/)}
});
test('interactive totals show a result, reset after editing, and do not intercept other controls',()=>{
 const result={textContent:''},manual={value:'0'},boxes=[{dataset:{cmCondition:'stress'}},{dataset:{cmCondition:'lowLight'}}],comp={checked:true},time={checked:false};
 const root={querySelector:s=>({'[data-cm-result]':result,'[data-cm-manual]':manual,'[data-cm-complementary]':comp,'[data-cm-time]':time}[s]),querySelectorAll:()=>boxes},button={dataset:{cmAction:'calculate'},closest:()=>root};
 assert.equal(handle({type:'click',target:{closest:()=>button}},'en'),true);assert.equal(result.textContent,'Total modifier: -2');
 manual.value='';handle({type:'click',target:{closest:()=>button}},'en');assert.match(result.textContent,/Enter a whole/);
 const edited={matches:()=>true,closest:()=>root};assert.equal(handle({type:'input',target:edited},'en'),false);assert.match(result.textContent,/Select conditions/);
 assert.equal(handle({type:'click',target:{closest:()=>null}},'en'),false);
});
