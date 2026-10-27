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
