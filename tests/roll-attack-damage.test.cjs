const {test}=require('node:test'),assert=require('node:assert/strict');
global.window={};require('../public/game/combat-tools.js');
const C=window.CombatTools,dice=(...pips)=>()=>{assert(pips.length,'unexpected die');return (pips.shift()-.5)/6};
const input={count:'3',sp:'11',type:'standard',location:'body'};
test('damage roll counts the dice, applies armor and ablates once when penetrated',()=>{
 const r=C.rollAttackDamage(input,dice(6,5,4));assert.deepEqual(r.dice,[6,5,4]);assert.equal(r.raw,15);assert.equal(r.penetrating,4);assert.equal(r.damage,4);assert.equal(r.critical,false);assert.equal(r.spAfter,10);
});
test('two sixes inflict +5 even through armor and do not themselves ablate it',()=>{
 const r=C.rollAttackDamage({...input,count:'2',sp:'20'},dice(6,6));assert.equal(r.critical,true);assert.equal(r.penetrating,0);assert.equal(r.bonus,5);assert.equal(r.damage,5);assert.equal(r.spAfter,20);
});
test('a head hit doubles penetration after half melee armor but never the injury bonus',()=>{
 const r=C.rollAttackDamage({...input,count:'2',type:'melee',location:'head'},dice(6,6));assert.equal(r.effectiveSP,6);assert.equal(r.penetrating,6);assert.equal(r.damage,17);assert.equal(r.spAfter,10);
});
test('brawling or thrown weapon full armor uses standard; one die cannot roll a natural injury',()=>{
 const r=C.rollAttackDamage({...input,count:'1',sp:'5',type:'standard'},dice(6));assert.equal(r.effectiveSP,5);assert.equal(r.damage,1);assert.equal(r.critical,false);assert.equal(r.spAfter,4);
});
test('malformed or out-of-range input never consumes random numbers',()=>{
 for(const patch of [{count:''},{count:'0'},{count:'21'},{count:'1.5'},{count:'-1'},{sp:''},{sp:'1001'},{sp:'1e2'},{type:'direct'},{location:'hand'}])assert.equal(C.rollAttackDamage({...input,...patch},()=>{throw Error('die used')}),null);
 assert.equal(C.rollAttackDamage(input,()=>1),null);assert.equal(C.rollAttackDamage(input,()=>NaN),null);
});
test('both languages render the roller, explain limitations and preserve entered values',()=>{
 for(const lang of ['ru','en']){
  const html=C.render(lang);assert.match(html,/data-ct-action="roll-damage"/);assert.match(html,/data-ct-roll-location/);assert.match(html,lang==='ru'?/Для автоматической очереди/:/separate Autofire tool/);
  const fields={'[data-ct-roll-count]':{value:'3'},'[data-ct-roll-sp]':{value:'7'},'[data-ct-roll-type]':{value:'standard'},'[data-ct-roll-location]':{value:'body'},'[data-ct-roll-result]':{}};
  const root={querySelector:s=>fields[s]},button={dataset:{ctAction:'roll-damage'}},target={closest:s=>s==='[data-combat-tool]'?root:s==='[data-ct-action]'?button:null};
  assert.equal(C.handle({type:'click',target},lang),true);assert.match(fields['[data-ct-roll-result]'].innerHTML,/<strong>\d+<\/strong>/);assert.equal(fields['[data-ct-roll-count]'].value,'3');assert.equal(fields['[data-ct-roll-sp]'].value,'7');const previous=fields['[data-ct-roll-result]'].innerHTML;assert.match(previous,/3d6/);assert.match(previous,/: 7/);assert.match(previous,lang==='ru'?/Тело/:/Body/);fields['[data-ct-roll-count]'].value='8';fields['[data-ct-roll-sp]'].value='15';fields['[data-ct-roll-location]'].value='head';assert.equal(fields['[data-ct-roll-result]'].innerHTML,previous);
 }
});
