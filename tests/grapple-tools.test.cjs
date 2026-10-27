const {test}=require('node:test'),assert=require('node:assert/strict');
global.window={};require('../public/game/grapple-tools.js');
const g=window.GrappleTools;
test('BODY damage tiers and cyberarm minimum follow Corebook p. 176',()=>{
 for(const [body,normal,cyber] of [[0,1,2],[4,1,2],[5,2,2],[6,2,2],[7,3,3],[10,3,3],[11,4,4]]){assert.equal(g.brawlingDice(body,false),normal);assert.equal(g.brawlingDice(body,true),cyber)}
 assert.equal(g.brawlingDice('',false),null);assert.equal(g.brawlingDice(4,'yes'),null);
});
test('Brawling uses full SP, ablates on penetration and critical bonus bypasses armor',()=>{
 assert.deepEqual(g.strike(5,false,11,[6,6]),{raw:12,penetration:1,critical:true,bonus:5,total:6,spAfter:10});
 assert.deepEqual(g.strike(5,false,12,[6,6]),{raw:12,penetration:0,critical:true,bonus:5,total:5,spAfter:12});
 assert.equal(g.strike(5,false,10,[6]),null);assert.equal(g.strike(5,false,10,[0,6]),null);
});
test('grab requires strictly higher attacker total and rejects invalid values',()=>{
 assert.equal(g.compare(12,11).win,true);assert.equal(g.compare(12,12).win,false);assert.equal(g.compare(11,12).win,false);assert.equal(g.compare('',12),null);
});
test('choking uses exact 0 HP threshold and three successive rounds',()=>{
 assert.deepEqual(g.grappleDamage('choke',6,5,1),{damage:6,hpAfter:1,unconscious:true,clamped:true,prone:false});
 assert.deepEqual(g.grappleDamage('choke',6,6,1),{damage:6,hpAfter:0,unconscious:false,clamped:false,prone:false});
 assert.deepEqual(g.grappleDamage('choke',6,1,1),{damage:6,hpAfter:-5,unconscious:false,clamped:false,prone:false});
 assert.equal(g.grappleDamage('choke',6,20,3).unconscious,true);assert.equal(g.grappleDamage('choke',6,20,0),null);
});
test('throw deals direct BODY damage without armor, ends the grapple and leaves prone',()=>{
 assert.deepEqual(g.grappleDamage('throw',7,5,1),{damage:7,hpAfter:-2,unconscious:false,clamped:false,prone:true});assert.equal(g.grappleDamage('throw','',5,1),null);
});
test('both languages render the source and non-mutating controls',()=>{
 for(const lang of ['ru','en']){const html=g.render(lang);assert.match(html,/data-gr-action="choke"/);assert.match(html,/data-gr-action="throw"/);assert.match(html,/data-action="book-page" data-page="176"/)}
});
test('the actual UI handler shows choke at zero HP and rejects an invalid value in both languages',()=>{
 for(const lang of ['ru','en']){const inputs={'[data-gr-body]':{value:'6'},'[data-gr-hp]':{value:'6'},'[data-gr-rounds]':{value:'1'},'[data-gr-finish-result]':{textContent:''}},root={querySelector:s=>inputs[s]},button={dataset:{grAction:'choke'},closest:()=>root},event={type:'click',target:{closest:()=>button}};assert.equal(g.handle(event,lang),true);assert.match(inputs['[data-gr-finish-result]'].textContent,/: 0/);inputs['[data-gr-hp]'].value='';g.handle(event,lang);assert.match(inputs['[data-gr-finish-result]'].textContent,lang==='ru'?/Введите/:/Enter/)}
});
