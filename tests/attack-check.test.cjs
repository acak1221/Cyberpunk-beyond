const {test}=require('node:test'),assert=require('node:assert/strict');
global.window={};require('../public/game/combat-tools.js');
const combat=window.CombatTools;
const ranged={kind:'ranged',weapon:'assault',distance:'14',stat:'8',skill:'6',mod:'0',aim:false,defense:'range',ref:'8',dex:'6',evasion:'6',defmod:'0'};
const dice=(...pips)=>()=>{assert.ok(pips.length,'unexpected additional die');return (pips.shift()-0.5)/10};
test('single shot uses published range DV; defender wins ties',()=>{
 let r=combat.attackCheck(ranged,dice(7));assert.equal(r.attack,21);assert.equal(r.defense,15);assert.equal(r.hit,true);assert.equal(r.attackDice.first,7);
 r=combat.attackCheck({...ranged,stat:'6',skill:'6'},dice(3));assert.equal(r.defense,15);assert.equal(r.attack,15);assert.equal(r.hit,false);
});
test('aiming applies -8 and respects modifier; natural 10 adds only one die',()=>{
 let r=combat.attackCheck({...ranged,aim:true,mod:'1'},dice(10,10));assert.equal(r.attack,27);assert.equal(r.attackDice.extra,10);
});
test('natural 1 subtracts one die, including on an opposed evasion roll',()=>{
 let r=combat.attackCheck({...ranged,defense:'evade',dex:'8',evasion:'6'},dice(1,3,1,2));assert.equal(r.attack,12);assert.equal(r.defense,13);assert.equal(r.hit,false);
});
test('ranged dodge requires REF 8, while melee is always opposed and ignores REF',()=>{
 assert.equal(combat.attackCheck({...ranged,defense:'evade',ref:'7'},dice(4)).error,'badDefense');
 let r=combat.attackCheck({...ranged,kind:'melee',defense:'evade',ref:'0'},dice(5,5));assert.equal(r.attack,19);assert.equal(r.defense,17);assert.equal(r.hit,true);
 assert.equal(combat.attackCheck({...ranged,kind:'melee'},dice(4)).error,'badDefense');
});
test('invalid and out-of-range inputs fail before consuming dice',()=>{
 for(const patch of [{stat:''},{distance:'3.5'},{skill:'-1'},{mod:'Infinity'},{weapon:'rocket'},{defense:'invalid'}]) assert.equal(combat.attackCheck({...ranged,...patch},dice()).error,'bad');
 assert.equal(combat.attackCheck({...ranged,weapon:'pistol',distance:'201'},dice()).error,'badRange');
});
test('UI works in both languages and changes no inputs',()=>{
 for(const lang of ['ru','en']){
  const html=combat.render(lang);assert.match(html,/data-ct-action="check"/);assert.match(html,/data-ct-check-aim/);assert.match(html,/data-ct-check-defense/);
  const fields={};for(const [key,value] of Object.entries(ranged))fields[`[data-ct-check-${key}]`]={value};fields['[data-ct-check-aim]']={checked:false};const result={};fields['[data-ct-check-result]']=result;
  const root={querySelector:s=>fields[s]},button={dataset:{ctAction:'check'}},target={closest:s=>s==='[data-combat-tool]'?root:s==='[data-ct-action]'?button:null};
  assert.equal(combat.handle({type:'click',target},lang),true);assert.match(result.innerHTML,/<strong>\d+ vs 15<\/strong>/);for(const [key,value] of Object.entries(ranged))if(key!=='aim')assert.equal(fields[`[data-ct-check-${key}]`].value,value);
 }
});
