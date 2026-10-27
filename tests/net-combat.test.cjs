const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const math=Object.create(Math);math.random=()=>0.5;
const ctx={window:{confirm:()=>true},Math:math};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/game/net-tools.js'),'utf8'),ctx);
const N=ctx.window.NetTools;
const sequence=(...rolls)=>{let i=0;return ()=>{assert(i<rolls.length,'unexpected extra roll');return (rolls[i++]-1)/10+0.001}};
const base={rank:4,atk:2,def:6,opponent:5,spd:6,speed:2,attackMod:0,defendMod:0,kind:'antiProgram',target:'program'};
const click=(op,extra={})=>({type:'click',target:{closest:()=>({dataset:{net:op,...extra}})}});
const edit=(key,value,type='change')=>({type,target:{dataset:{netCombat:key},value,closest:()=>null}});
test('program attack adds Interface and ATK, target DEF only; defender wins ties',()=>{
 let r=N.combatCheck({...base,mode:'program'},sequence(5,5));assert.equal(r.attack,11);assert.equal(r.defend,11);assert.equal(r.hit,false);
 r=N.combatCheck({...base,mode:'program'},sequence(6,5));assert.equal(r.hit,true);
});
test('ICE attacks use ATK alone, netrunner defense uses Interface; Zap has no program ATK',()=>{
 let r=N.combatCheck({...base,mode:'ice',kind:'antiPersonnel',target:'person'},sequence(6,5));assert.equal(r.attack,8);assert.equal(r.defend,10);
 r=N.combatCheck({...base,mode:'zap',target:'person'},sequence(6,5));assert.equal(r.attack,10);assert.equal(r.defend,10);assert.equal(r.hit,false);
});
test('first encounter compares ICE SPD against Interface plus speed, strict ICE win only',()=>{
 let r=N.combatCheck({...base,mode:'encounter'},sequence(5,5));assert.equal(r.attack,11);assert.equal(r.defend,11);assert.equal(r.hit,false);
 r=N.combatCheck({...base,mode:'encounter',attackMod:1},sequence(5,5));assert.equal(r.hit,true);
});
test('each side gets its own nonrecursive critical die',()=>{
 let r=N.combatCheck({...base,mode:'program'},sequence(10,10,1,1));assert.equal(r.attackDie.value,20);assert.equal(r.defendDie.value,0);assert.equal(r.attack,26);assert.equal(r.defend,6);
 r=N.combatCheck({...base,mode:'program'},sequence(1,10,10,10));assert.equal(r.attackDie.value,-9);assert.equal(r.defendDie.value,20);
});
test('program and ICE attacks reject incompatible classes; Zap is unrestricted',()=>{
 assert.equal(N.combatCheck({...base,mode:'program',target:'person'},sequence(5,5)),null);
 assert.equal(N.combatCheck({...base,mode:'ice',kind:'antiPersonnel',target:'program'},sequence(5,5)),null);
 assert(N.combatCheck({...base,mode:'zap',target:'person'},sequence(5,5)));
});
test('UI picks ICE by stable id and uses its attacking ATK without adding Interface or using its DEF as target DEF',()=>{
 N.setScope('net-combat-test');const x={lang:'en',architectures:[]};N.handle(click('new'),x);const a=x.architectures[0];a.rank=9;
 const e=N.newEntry();Object.assign(e,{type:'ice',name:'Hellhound',atk:6,def:2,spd:6,rez:20,maxRez:20,state:'waiting'});a.floors[0].entries.push(e);
 const id=encodeURIComponent(a.floors[0].id)+':'+encodeURIComponent(e.id);
 N.handle(edit('mode','ice'),x);N.handle(edit('ice',id),x);N.handle(edit('def','3'),x);
 const before=JSON.stringify(x.architectures);const result=N.handle(click('combat-roll'),x);
 assert.equal(result.rerender,true);assert.equal(result.dirty,undefined);assert.equal(JSON.stringify(x.architectures),before);
 const html=N.render(x);assert(html.includes('Attack / ICE SPEED: 6 + (6) = 12'));assert(html.includes('Defense / Netrunner SPEED: 3 + (6) = 9'));
 assert(html.includes('random active program'));assert(html.includes('defender wins ties'));
});
test('encounter result explains initiative even when ICE loses; output is bilingual and ephemeral',()=>{
 N.setScope('encounter-test');const x={lang:'ru',architectures:[]};N.handle(click('new'),x);
 N.handle(edit('mode','encounter'),x);N.handle(edit('spd','4'),x);N.handle(click('combat-roll'),x);
 const html=N.render(x);assert(html.includes('Мгновенного эффекта нет'));assert(html.includes('начало инициативы'));assert(html.includes('Защищающийся побеждает'));
 N.setScope('different-account');assert(!N.render({...x,lang:'en'}).includes('NET COMBAT / CALCULATOR'));
});
test('editing or deleting a selected ICE clears the previous result and updates the displayed stats',()=>{
 N.setScope('ice-change-test');const x={lang:'en',architectures:[]};N.handle(click('new'),x);const a=x.architectures[0],e=N.newEntry();
 Object.assign(e,{type:'ice',name:'Hellhound',atk:6,def:2,spd:6});a.floors[0].entries.push(e);
 const id=encodeURIComponent(a.floors[0].id)+':'+encodeURIComponent(e.id);
 N.handle(edit('mode','ice'),x);N.handle(edit('ice',id),x);N.handle(click('combat-roll'),x);assert(N.render(x).includes('Attacker wins'));
 const changed=N.handle({type:'change',target:{dataset:{netEntry:'atk',index:'0',entry:'0'},value:'8',closest:()=>null}},x);
 assert.equal(changed.rerender,true);let html=N.render(x);assert(!html.includes('Attacker wins'));assert(html.includes('ICE ATK <strong>8</strong>'));
 N.handle(click('combat-roll'),x);assert(N.render(x).includes('Attacker wins'));
 N.handle(click('remove-entry',{index:'0',entry:'0'}),x);html=N.render(x);assert(!html.includes('Attacker wins'));assert(!html.includes('ICE ATK <strong>8</strong>'));
});
