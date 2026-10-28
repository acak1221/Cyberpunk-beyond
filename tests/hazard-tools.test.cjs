const {test}=require('node:test'),assert=require('node:assert/strict');
global.window={};require('../public/game/hazard-tools.js');const H=window.HazardTools;
test('fire and drowning do direct damage by intensity and BODY',()=>{
 assert.equal(H.directFire('mild'),2);assert.equal(H.directFire('strong'),4);assert.equal(H.directFire('deadly'),6);assert.equal(H.directFire('constructor'),null);assert.equal(H.drowning(8),8);assert.equal(H.drowning(''),null);
});
test('electrocution and falling use full armor and ablate only on penetration',()=>{
 assert.deepEqual(H.armorDamage(18,11),{raw:18,damage:7,spAfter:10});assert.deepEqual(H.armorDamage(11,11),{raw:11,damage:0,spAfter:11});assert.deepEqual(H.armorDamage(1,0),{raw:1,damage:1,spAfter:0});assert.equal(H.armorDamage(-1,11),null);
});
test('fall thresholds and Cyberlegs match source, including 30m and 31m',()=>{
 assert.equal(H.falling(9,false,11,1,[]).mode,'small');assert.equal(H.falling(30,true,11,1,[]).mode,'protected');const r=H.falling(31,true,11,15,[3,3,3,3,3,3]);assert.equal(r.mode,'hit');assert.equal(r.raw,18);assert.equal(r.damage,7);assert.equal(r.injury,true);assert.equal(r.bonus,5);assert.equal(r.total,12);assert.equal(r.spAfter,10);
});
test('fall injury remains direct even when armor blocks damage, and a check above DV succeeds',()=>{
 const fail=H.falling(10,false,99,15,[1,1]);assert.equal(fail.damage,0);assert.equal(fail.bonus,5);assert.equal(fail.spAfter,99);const success=H.falling(10,false,99,16,[1,1]);assert.equal(success.injury,false);assert.equal(success.total,0);assert.equal(H.falling(20,false,0,16,[6]),null);
});
test('poison ties fail and damage ignores armor',()=>{
 assert.deepEqual(H.poison('mild',12,[]),{resisted:true,dv:11,damage:0});assert.deepEqual(H.poison('mild',11,[6]),{resisted:false,dv:11,damage:6});assert.deepEqual(H.poison('strong',13,[6,6]),{resisted:false,dv:13,damage:12});assert.deepEqual(H.poison('deadly',15,[1,2,3]),{resisted:false,dv:15,damage:6});assert.equal(H.poison('deadly','',[1,2,3]),null);assert.equal(H.poison('strong',13,[1]),null);
});
test('render is bilingual, names the source and does not offer state-changing operations',()=>{
 for(const lang of ['ru','en']){const html=H.render(lang);assert.match(html,/data-page="180"/);assert.match(html,/data-hz-action="fire"/);assert.match(html,/data-hz-action="fall"/);assert.match(html,/data-hz-action="poison"/);assert.doesNotMatch(html,/data-action="(save|apply|purchase)"/)}
});
test('live handler calculates direct and armor damage without mutating a character',()=>{
 const values={'[data-hz-fire]':{value:'strong'},'[data-hz-body]':{value:'8'},'[data-hz-shock-sp]':{value:'11'}},outputs={},root={querySelector(s){return values[s]||(outputs[s]??=( {textContent:''} ))}},button={dataset:{hzAction:'fire'},closest(){return root}},e={type:'click',target:{closest(){return button}}};assert.equal(H.handle(e,'en'),true);assert.match(outputs['[data-hz-result="fire"]'].textContent,/4/);button.dataset.hzAction='drowning';H.handle(e,'en');assert.match(outputs['[data-hz-result="drowning"]'].textContent,/8/);button.dataset.hzAction='shock';H.handle(e,'en');assert.match(outputs['[data-hz-result="shock"]'].textContent,/SP after damage/);
});
test('fully protected and short falls do not require irrelevant armor or Athletics values',()=>{
 assert.equal(window.HazardTools.falling(30,true,'','',[]).mode,'protected');
 assert.equal(window.HazardTools.falling(9,false,'','',[]).mode,'small');
 assert.equal(window.HazardTools.falling(31,true,'','',[]),null);
});
test('drug effects use the three corebook DVs, with ties failing',()=>{
 for(const [kind,dv,effect] of [['mild',11,'inebriation'],['strong',13,'suggestibility'],['deadly',15,'designed']]){assert.deepEqual(H.drug(kind,dv),{resisted:false,dv,effect});assert.deepEqual(H.drug(kind,dv+1),{resisted:true,dv,effect})}
 assert.equal(H.drug('constructor',20),null);assert.equal(H.drug('strong',''),null);
});
test('drug check is exposed and reports its effect in both languages without a sheet mutation',()=>{
 const values={'[data-hz-drug]':{value:'strong'},'[data-hz-drug-resist]':{value:'13'}},outputs={},character={hp:20};const root={querySelector(s){return values[s]||(outputs[s]??={textContent:''})}},button={dataset:{hzAction:'drug'},closest(){return root}},event={type:'click',target:{closest(){return button}}};
 assert.match(H.render('ru'),/пентотал натрия/);assert.match(H.render('en'),/sodium pentothal/);assert.equal(H.handle(event,'ru'),true);assert.match(outputs['[data-hz-result="drug"]'].textContent,/Внушаемость/);values['[data-hz-drug-resist]'].value='14';H.handle(event,'en');assert.match(outputs['[data-hz-result="drug"]'].textContent,/effect does not occur/);assert.equal(character.hp,20);
});

test('catching a fall uses a single DV15 check, including critical roll arithmetic and equipment',()=>{
 assert.deepEqual(H.catchFall('none'),{mode:'none'});assert.deepEqual(H.catchFall('gear'),{mode:'gear'});
 assert.equal(H.catchFall('edge',6,4,0,5).success,false);assert.equal(H.catchFall('edge',6,4,0,6).success,true);
 assert.equal(H.catchFall('edge',6,4,0,10,6).total,26);assert.equal(H.catchFall('edge',6,4,0,1,6).total,5);
 assert.equal(H.catchFall('edge',6,4,0,1,null),null);assert.equal(H.catchFall('edge','',4,0,5),null);assert.equal(H.catchFall('edge',6,11,0,5),null);assert.equal(H.catchFall('edge',6,4,0,10,0),null);assert.equal(H.catchFall('bad'),null);
});
test('the pre-fall check is separate from the Athletics check on impact and accessible in both languages',()=>{
 for(const lang of ['ru','en']){const html=H.render(lang);assert.match(html,/data-hz-action="ledge"/);assert.match(html,/data-hz-action="fall"/);assert.match(html,/40/)}
 const values={'[data-hz-ledge-situation]':{value:'edge'},'[data-hz-ledge-dex]':{value:'6'},'[data-hz-ledge-athletics]':{value:'4'},'[data-hz-ledge-mod]':{value:'0'}},outputs={},root={querySelector(s){return values[s]||(outputs[s]??={textContent:''})}},button={dataset:{hzAction:'ledge'},closest(){return root}},event={type:'click',target:{closest(){return button}}};const random=Math.random;try{Math.random=()=>.5;H.handle(event,'en');assert.match(outputs['[data-hz-result="ledge"]'].textContent,/16 > DV 15/);values['[data-hz-ledge-situation]'].value='gear';H.handle(event,'en');assert.match(outputs['[data-hz-result="ledge"]'].textContent,/No check is required/);values['[data-hz-ledge-situation]'].value='none';H.handle(event,'en');assert.match(outputs['[data-hz-result="ledge"]'].textContent,/unavailable/)}finally{Math.random=random}
});
test('impact Athletics fills the separate impact total and reflects failure at a tie',()=>{
 const values={'[data-hz-ledge-dex]':{value:'6'},'[data-hz-ledge-athletics]':{value:'4'},'[data-hz-ledge-mod]':{value:'0'},'[data-hz-athletics]':{value:'99'}},outputs={},root={querySelector(s){return values[s]||(outputs[s]??={textContent:''})}},button={dataset:{hzAction:'impact'},closest(){return root}},event={type:'click',target:{closest(){return button}}};const random=Math.random;try{Math.random=()=>.4;H.handle(event,'en');assert.equal(values['[data-hz-athletics]'].value,'15');assert.match(outputs['[data-hz-result="impact"]'].textContent,/15 ≤ DV 15/);assert.match(outputs['[data-hz-result="impact"]'].textContent,/Broken Leg/);values['[data-hz-ledge-dex]'].value='';H.handle(event,'en');assert.equal(values['[data-hz-athletics]'].value,'')}finally{Math.random=random}
});

test('the minimum legal critical failure can be applied to falling damage',()=>{
 const r=H.catchFall('edge',0,0,-100,1,10);assert.equal(r.total,-109);const f=H.falling(10,false,11,r.total,[2,3]);assert.equal(f.mode,'hit');assert.equal(f.injury,true);assert.equal(H.falling(10,false,11,-110,[2,3]),null);
});
