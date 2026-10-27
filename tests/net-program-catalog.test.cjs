const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
function load(){const math=Object.create(Math);math.random=()=>0.5;const ctx={window:{confirm:()=>true},Math:math};vm.createContext(ctx);for(const f of ['catalog.js','catalog-extra.js','net-tools.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/game',f),'utf8'),ctx);return ctx.window}
const click=(op,extra={})=>({type:'click',target:{closest:()=>({dataset:{net:op,...extra}})}});
const edit=(key,value)=>({type:'change',target:{dataset:{netCombat:key},value,closest:()=>null}});
function setup(){const W=load(),N=W.NetTools;N.setScope('owner-a');const x={lang:'en',architectures:[]};N.handle(click('new'),x);return {W,N,x}}
test('catalog attack selection uses the actual Sword profile, effect and target without changing saved state',()=>{
 const {N,x}=setup(),before=JSON.stringify(x.architectures);let html=N.render(x);
 assert.match(html,/Program from catalog/);assert.match(html,/>Sword<\/option>/);assert.doesNotMatch(html,/>Armor<\/option>/);
 N.handle(edit('program','extra-program-sword'),x);html=N.render(x);
 assert.match(html,/Attacker class <strong>Anti-Program<\/strong>/);assert.match(html,/Program ATK <strong>1<\/strong>/);assert.match(html,/3d6 REZ to Black ICE/);
 assert.equal(N.handle(click('combat-roll'),x).dirty,undefined);html=N.render(x);
 assert.match(html,/Attack \/ ICE SPEED: 5 \+ \(6\) = 11/);assert.equal(JSON.stringify(x.architectures),before);
});
test('anti-personnel program automatically targets a netrunner and validates subsequent changes',()=>{
 const {N,x}=setup();N.handle(edit('program','extra-program-hellbolt'),x);let html=N.render(x);
 assert.match(html,/value="person" selected/);assert.match(html,/Attacker class <strong>Anti-Personnel<\/strong>/);assert.match(html,/Program ATK <strong>2<\/strong>/);assert.match(html,/2d6 directly to the brain/);
 N.handle(click('combat-roll'),x);assert.match(N.render(x),/Attack \/ ICE SPEED: 6 \+ \(6\) = 12/);
 N.handle(edit('target','program'),x);const r=N.handle(click('combat-roll'),x);assert.match(r.notify,/does not match/);assert.doesNotMatch(N.render(x),/Attacker wins|Defender wins/);
});
test('manual entry remains available and missing or duplicated catalog records are not silently used',()=>{
 const {W,N,x}=setup();N.handle(edit('program','extra-program-sword'),x);
 W.CATALOG.push(W.CATALOG.find(p=>p.id==='extra-program-sword'));assert.match(N.handle(click('combat-roll'),x).notify,/no longer available/);
 N.handle(edit('program',''),x);N.handle(edit('atk','7'),x);N.handle(edit('kind','antiProgram'),x);N.handle(edit('target','program'),x);
 N.handle(click('combat-roll'),x);assert.match(N.render(x),/Attack \/ ICE SPEED: 11 \+ \(6\) = 17/);
});
test('Russian effect is shown and catalog selection resets across owner scopes',()=>{
 const {N,x}=setup();x.lang='ru';N.handle(edit('program','extra-program-sword'),x);assert.match(N.render(x),/Эффект при попадании/);assert.match(N.render(x),/3d6 REZ программе Black ICE/);
 N.setScope('owner-b');N.handle(click('open',{id:x.architectures[0].id}),x);assert.doesNotMatch(N.render(x),/Эффект при попадании/);
});
test('ICE preset reference identifies itself as informational and does not replace editable ICE statistics or class',()=>{
 const {N,x}=setup(),a=x.architectures[0],e=N.newEntry();Object.assign(e,{type:'ice',name:'Custom',preset:'Hellhound',atk:3,spd:4});a.floors[0].entries.push(e);
 const id=encodeURIComponent(a.floors[0].id)+':'+encodeURIComponent(e.id);N.handle(edit('mode','ice'),x);N.handle(edit('ice',id),x);const html=N.render(x);
 assert.match(html,/Selected ICE preset reference/);assert.match(html,/Check that the preset has been applied/);assert.match(html,/ICE ATK <strong>3<\/strong>/);assert.match(html,/data-net-combat="kind"/);
 N.handle(click('combat-roll'),x);assert.match(N.render(x),/Attack \/ ICE SPEED: 3 \+ \(6\) = 9/);
});
