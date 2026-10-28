const {test}=require('node:test'),assert=require('node:assert/strict');
global.window={};require('../public/game/grapple-tools.js');
const g=window.GrappleTools;
const seq=values=>{let i=0;return ()=>{assert.ok(i<values.length,'unexpected die');return values[i++]}};
test('opposed Grab rolls both DEX + Brawling checks and ties favor the defender',()=>{
 const r=g.grabCheck({dex:6,skill:2,modifier:0},{dex:5,skill:3,modifier:0},seq([0.4,0.4]));
 assert.equal(r.initiator.total,13);assert.equal(r.opponent.total,13);assert.equal(r.win,false);
 assert.equal(g.grabCheck({dex:7,skill:2,modifier:0},{dex:5,skill:3,modifier:0},seq([0.4,0.4])).win,true);
});
test('natural 1 and 10 each roll one extra die and apply it with the correct sign',()=>{
 const r=g.grabCheck({dex:6,skill:2,modifier:-2},{dex:6,skill:2,modifier:-2},seq([0,0.9,0.99,0.4]));
 assert.deepEqual([r.initiator.first,r.initiator.extra,r.initiator.total],[1,10,-3]);
 assert.deepEqual([r.opponent.first,r.opponent.extra,r.opponent.total],[10,5,21]);assert.equal(r.win,false);
});
test('invalid input is rejected before any dice and invalid random draws fail safely',()=>{
 const good={dex:6,skill:2,modifier:0};let calls=0;
 for(const bad of [{dex:'',skill:2,modifier:0},{dex:6,skill:11,modifier:0},{dex:6,skill:2,modifier:100.5},{dex:6,skill:2,modifier:-101}]){
  assert.equal(g.grabCheck(good,bad,()=>{calls++;return 0.5}),null);
 }assert.equal(calls,0);assert.equal(g.grabCheck(good,good,seq([1])),null);
 const low=g.grabCheck({dex:0,skill:0,modifier:-100},good,seq([0,0.9,0.4]));assert.equal(low.initiator.total,-109);assert.equal(g.compare(-109,0).win,false);
});
test('both languages expose inputs and explain effects, then the handler shows both rolls without changing manual totals',()=>{
 for(const lang of ['ru','en']){
  const html=g.render(lang);assert.match(html,/data-gr-action="grab-roll"/);assert.match(html,/data-gr-grab-a-dex/);assert.match(html,/data-gr-grab-b-skill/);assert.match(html,lang==='ru'?/освободить кого-то/:/free someone/);
  const values={'a-dex':'6','a-skill':'2','a-mod':'0','b-dex':'6','b-skill':'2','b-mod':'0'};
  const els=Object.fromEntries(Object.entries(values).map(([k,v])=>[`[data-gr-grab-${k}]`,{value:v}]));
  els['[data-gr-grab-roll-result]']={textContent:''};els['[data-gr-attacker]']={value:'8'};els['[data-gr-defender]']={value:'9'};els['[data-gr-grab-result]']={textContent:'old'};
  const root={querySelector:s=>els[s]},button={dataset:{grAction:'grab-roll'},closest:()=>root},event={type:'click',target:{closest:()=>button}},original=Math.random;
  Math.random=seq([0.4,0.4]);try{assert.equal(g.handle(event,lang),true)}finally{Math.random=original}
  assert.equal(els['[data-gr-attacker]'].value,'8');assert.equal(els['[data-gr-defender]'].value,'9');assert.equal(els['[data-gr-grab-result]'].textContent,'old');
  assert.match(els['[data-gr-grab-roll-result]'].textContent,lang==='ru'?/Защитник выигрывает/:/defender wins/);
  els['[data-gr-grab-a-dex]'].value='';assert.equal(g.handle(event,lang),true);assert.match(els['[data-gr-grab-roll-result]'].textContent,lang==='ru'?/Введите целые/:/Enter whole/);
 }
});
