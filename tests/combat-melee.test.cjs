const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const sandbox={window:{},Math};vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(__dirname+'/../public/game/combat-tools.js','utf8'),sandbox);
const combat=sandbox.window.CombatTools;

test('melee weapons and martial arts halve SP rounded up, but ablate the original SP',()=>{
 let melee=combat.calcDamage(10,11,false,'melee');
 assert.equal(melee.effectiveSP,6);assert.equal(melee.penetrating,4);assert.equal(melee.total,4);assert.equal(melee.spAfter,10);assert.equal(melee.ablated,true);
 let blocked=combat.calcDamage(6,11,true,'melee');
 assert.equal(blocked.effectiveSP,6);assert.equal(blocked.penetrating,0);assert.equal(blocked.total,5);assert.equal(blocked.spAfter,11);assert.equal(blocked.ablated,false);
 assert.equal(combat.calcDamage(6,10,false,'melee').penetrating,1);
 assert.equal(combat.calcDamage(3,0,false,'melee').spAfter,0);
 assert.equal(combat.calcDamage(10,11,false,'standard').total,0);
 assert.equal(combat.calcDamage(10,11,false).total,0);
 assert.equal(combat.calcDamage(10,11,false,'unknown'),null);
});

test('bilingual combat UI passes attack selection into damage calculation',()=>{
 for(const lang of ['ru','en']){
  const html=combat.render(lang);
  assert.match(html,/data-ct-attack-type/);assert.match(html,/value="melee"/);
  const result={};const fields={'[data-ct-damage]':{value:'10'},'[data-ct-sp]':{value:'11'},'[data-ct-attack-type]':{value:'melee'},'[data-ct-critical]':{checked:false},'[data-ct-damage-result]':result};
  const root={querySelector:s=>fields[s]},button={dataset:{ctAction:'damage'}};
  const target={closest:s=>s==='[data-combat-tool]'?root:s==='[data-ct-action]'?button:null};
  assert.equal(combat.handle({type:'click',target},lang),true);assert.match(result.innerHTML,/<strong>4<\/strong>/);assert.match(result.innerHTML,/SP[^:]*: 6/);assert.match(result.innerHTML,/: 10/);
 }
});
