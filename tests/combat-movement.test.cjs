const {test}=require('node:test'),assert=require('node:assert/strict');
global.window={};require('../public/game/combat-tools.js');const C=window.CombatTools;
test('normal Move and Run provide separate Move Actions with correct per-action distances',()=>{
 const normal=C.movementPlan({move:'6',prone:false,action:'none'}),run=C.movementPlan({move:6,prone:false,action:'run'});
 assert.equal(normal.first,12);assert.equal(normal.extra,0);assert.equal(normal.total,12);assert.equal(normal.swim,6);assert.equal(normal.runningJump,6);assert.equal(normal.standingJump,3);
 assert.equal(run.first,12);assert.equal(run.extra,12);assert.equal(run.total,24);assert.equal(run.runningJump,6);assert.equal(run.standingJump,3);
});
test('prone blocks movement until Get Up and neither Run nor Get Up can be combined',()=>{
 const prone=C.movementPlan({move:5,prone:true,action:'none'}),stand=C.movementPlan({move:5,prone:true,action:'getup'});
 assert.equal(prone.total,0);assert.equal(stand.total,10);assert.equal(stand.runningJump,5);assert.equal(stand.standingJump,2.5);assert.equal(C.movementPlan({move:5,prone:true,action:'run'}),null);assert.equal(C.movementPlan({move:5,prone:false,action:'getup'}),null);
});
test('validates input without silently rounding, falling back, or inventing movement',()=>{
 for(const v of ['',-1,21,1.5,'2.5','1e1',null,{},'  '])assert.equal(C.movementPlan({move:v,prone:false,action:'none'}),null,String(v));
 assert.equal(C.movementPlan({move:0,prone:false,action:'run'}).total,0);assert.equal(C.movementPlan({move:6,prone:'false',action:'run'}),null);assert.equal(C.movementPlan({move:6,prone:false,action:'unknown'}),null);
});
test('both languages explain movement, Run, terrain, and rule source',()=>{
 const ru=C.render('ru'),en=C.render('en');assert.match(ru,/ПЕРЕМЕЩЕНИЕ ЗА ХОД/);assert.match(ru,/плавании, лазании/);assert.match(en,/MOVEMENT PER TURN/);assert.match(en,/standing jump/);assert.match(en,/data-page="169"/);
});
test('interactive result uses entered values and input changes clear the old result',()=>{
 const fields={'[data-ct-move]':{value:'5'},'[data-ct-move-prone]':{checked:false},'[data-ct-move-action]':{value:'run'},'[data-ct-move-result]':{innerHTML:'',textContent:''}};
 const root={querySelector:s=>fields[s]},button={dataset:{ctAction:'movement'}},target={closest:s=>s==='[data-combat-tool]'?root:s==='[data-ct-action]'?button:null};
 assert(C.handle({type:'click',target},'en'));assert.match(fields['[data-ct-move-result]'].innerHTML,/Total ordinary movement: 20/);assert.match(fields['[data-ct-move-result]'].innerHTML,/Standing jump 2.5/);
 const change={closest:s=>s==='[data-combat-tool]'?root:null,matches:()=>true};assert(C.handle({type:'input',target:change},'en'));assert.equal(fields['[data-ct-move-result]'].textContent,'Enter MOVE, position and Action.');
});
