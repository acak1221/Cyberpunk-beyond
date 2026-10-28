const {test}=require('node:test'),assert=require('node:assert/strict');
global.window={};require('../public/game/combat-tools.js');require('../public/game/area-tools.js');const A=window.AreaTools,range=window.CombatTools.rangeDV;
function values(rng){let i=0;return ()=>{assert.ok(i<rng.length,'unexpected random draw');return rng[i++]}}
test('launchers and thrown grenades use the Corebook range table; shotgun shells use DV13',()=>{
 const b={type:'blast',method:'grenade',stat:6,skill:4,modifier:0,distance:10};
 assert.deepEqual(A.areaAttack(b,range,values([.9,.4])),{stat:6,skill:4,modifier:0,first:10,extra:5,total:25,dv:15,hit:true});
 assert.equal(A.areaAttack({...b,method:'thrown',distance:25},range,values([.4])).dv,15);
 assert.equal(A.areaAttack({...b,method:'rocket',distance:800},range,values([.4])).dv,30);
 assert.equal(A.areaAttack({...b,type:'shell',method:'shell',distance:''},range,values([.2])).dv,13);
 for(const bad of [{...b,method:'thrown',distance:26},{...b,method:'grenade',distance:401},{...b,type:'shell'},{...b,method:'shell'},{...b,skill:''}])assert.equal(A.areaAttack(bad,range,values([])),null);
});
test('natural 1 permits −109 and a tie misses; invalid rolls do not consume values',()=>{
 const b={type:'shell',method:'shell',stat:0,skill:0,modifier:-100,distance:''};
 assert.equal(A.areaAttack(b,range,values([0,.9])).total,-109);
 assert.equal(A.areaAttack({...b,stat:6,skill:4,modifier:0},range,values([.2])).hit,false);
 assert.equal(A.areaAttack(b,range,()=>1),null);
});
function ui(){const v={type:'blast','attack-method':'grenade','attack-stat':'6','attack-skill':'4','attack-mod':'0','attack-distance':'10',attack:'18',dv:'13',dice:'2,2,2'};const fields=Object.fromEntries(Object.entries(v).map(([k,value])=>[`[data-area-${k}]`,{value}])),result={textContent:''},output={textContent:'',innerHTML:''},container={querySelectorAll:()=>[]},root={isConnected:true,querySelector:s=>s==='[data-area-targets]'?container:s==='[data-area-result]'?output:s==='[data-area-attack-result]'?result:fields[s]||null};function click(action,connected=true){const b={isConnected:connected,dataset:{areaAction:action},closest:s=>s==='[data-area-root]'?root:null};return A.handle({type:'click',target:{closest:s=>s==='[data-area-action]'?b:null}},'en')}return {fields,result,output,click}}
test('generated attack fills attack and DV, and stale inputs require a new roll or manual override',()=>{
 const h=ui(),old=Math.random;Math.random=values([.4]);try{h.click('roll-attack')}finally{Math.random=old}
 assert.equal(h.fields['[data-area-attack]'].value,'15');assert.equal(h.fields['[data-area-dv]'].value,'15');assert.match(h.result.textContent,/= 15 ≤ DV 15/);
 h.fields['[data-area-attack-distance]'].value='30';h.click('calculate');assert.match(h.output.textContent,/Attack inputs changed/);
 h.click('manual-attack');h.click('calculate');assert.match(h.output.innerHTML,/GM chooses the impact point/);
});
test('manual attack edits remove generated provenance and invalid or detached operations do not roll',()=>{
 const h=ui(),old=Math.random;Math.random=values([.4]);try{h.click('roll-attack')}finally{Math.random=old}
 h.fields['[data-area-attack]'].value='20';h.fields['[data-area-attack-distance]'].value='20';h.click('calculate');assert.match(h.output.innerHTML,/Attack reached/);
 h.fields['[data-area-type]'].value='shell';Math.random=values([]);try{h.click('roll-attack');h.click('roll-attack',false)}finally{Math.random=old}
 assert.match(h.result.textContent,/Check the attack type/);assert.equal(h.fields['[data-area-attack]'].value,'20');
});
test('both languages expose all four attack methods and the manual path',()=>{for(const lang of ['ru','en']){const html=A.render(lang);for(const v of ['grenade','rocket','thrown','shell'])assert.match(html,new RegExp(`value="${v}"`));assert.match(html,/data-area-action="roll-attack"/);assert.match(html,/data-area-action="manual-attack"/)}});
