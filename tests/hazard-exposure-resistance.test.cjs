const { test }=require('node:test'),assert=require('node:assert/strict');
global.window={};require('../public/game/hazard-tools.js');const H=window.HazardTools;

test('exposure roll is available in both languages and applies only to the result',()=>{
 for(const lang of ['ru','en']){const html=H.render(lang);assert.match(html,/data-hz-action="exposure"/);assert.match(html,/1d6/)}
 const out={textContent:''},character={hp:18,bodyArmor:11},root={querySelector(s){return s==='[data-hz-result="exposure"]'?out:null}},button={dataset:{hzAction:'exposure'},closest(){return root}},original=Math.random;
 try{Math.random=()=>.999;assert.equal(H.handle({type:'click',target:{closest(){return button}}},'en'),true);assert.match(out.textContent,/1d6: 6.*Direct HP damage: 6/);assert.deepEqual(character,{hp:18,bodyArmor:11})}finally{Math.random=original}
});

test('resistance check handles critical rolls, boundaries and invalid input',()=>{
 assert.equal(H.resistanceCheck(6,4,0,5,0).total,15);assert.equal(H.resistanceCheck(6,4,0,10,5).total,25);assert.equal(H.resistanceCheck(6,4,0,1,5).total,6);assert.equal(H.resistanceCheck(0,0,-100,1,10).total,-109);
 assert.equal(H.resistanceCheck('',4,0,5,0),null);assert.equal(H.resistanceCheck(6,11,0,5,0),null);assert.equal(H.resistanceCheck(6,4,0,10,0),null);
 assert.deepEqual(H.poison('mild',-109,[1]),{resisted:false,dv:11,damage:1});assert.equal(H.drug('mild',-109).resisted,false);
});

test('resistance roll fills the correct total and preserves manual input on invalid values',()=>{
 for(const lang of ['ru','en'])for(const kind of ['poison','drug'])assert.match(H.render(lang),new RegExp(`data-hz-action="${kind}-resist-roll"`));
 const fields={'[data-hz-poison-will]':{value:'6'},'[data-hz-poison-skill]':{value:'4'},'[data-hz-poison-mod]':{value:'-1'},'[data-hz-resist]':{value:'42',dataset:{}},'[data-hz-result="poison"]':{textContent:'old result'},'[data-hz-result="poison-resist-roll"]':{textContent:''}},root={querySelector(s){return fields[s]||null}},button={dataset:{hzAction:'poison-resist-roll'},closest(){return root}},event={type:'click',target:{closest(){return button}}},original=Math.random;
 try{let sequence=[.99,.49];Math.random=()=>sequence.shift();assert.equal(H.handle(event,'en'),true);assert.equal(fields['[data-hz-resist]'].value,'24');assert.equal(fields['[data-hz-resist]'].dataset.hzRollValue,'24');assert.match(fields['[data-hz-result="poison-resist-roll"]'].textContent,/10 \+ 5 = 24/);assert.equal(fields['[data-hz-result="poison"]'].textContent,'');fields['[data-hz-poison-will]'].value='';fields['[data-hz-resist]'].value='12';H.handle(event,'en');assert.equal(fields['[data-hz-resist]'].value,'12');assert.match(fields['[data-hz-result="poison-resist-roll"]'].textContent,/Enter whole/)}finally{Math.random=original}
});

test('editing relevant inputs clears stale results but preserves manually entered totals',()=>{
 const fields={'[data-hz-resist]':{value:'17',dataset:{hzRollValue:'17'}},'[data-hz-result="poison"]':{textContent:'old outcome'},'[data-hz-result="poison-resist-roll"]':{textContent:'old roll'}},root={querySelector(s){return fields[s]||null}},field={matches(s){return s.split(',').includes('[data-hz-poison-will]')},closest(){return root}};
 assert.equal(H.handle({type:'input',target:field},'en'),true);assert.equal(fields['[data-hz-resist]'].value,'');assert.equal(fields['[data-hz-result="poison"]'].textContent,'');assert.equal(fields['[data-hz-result="poison-resist-roll"]'].textContent,'');
 fields['[data-hz-resist]'].value='19';fields['[data-hz-result="poison"]'].textContent='old';assert.equal(H.handle({type:'change',target:field},'en'),true);assert.equal(fields['[data-hz-resist]'].value,'19');assert.equal(fields['[data-hz-result="poison"]'].textContent,'');
 assert.equal(H.handle({type:'input',target:{matches(){return false}}},'en'),false);assert.equal(H.handle({type:'change',target:{matches(){return true},closest(){return null}}},'en'),false);
});
