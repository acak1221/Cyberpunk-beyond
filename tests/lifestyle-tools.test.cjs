const {test}=require('node:test');
const assert=require('node:assert/strict');
global.window={};
require('../public/game/lifestyle-tools.js');
const L=window.LifestyleTools;
const character=()=>({extra:{cash:2000,other:{preserve:true}}});
test('prices and separate monthly payments follow the corebook',()=>{
 const c=character(),life=L.quote(c,'2045-03','life','kibble');
 assert.equal(life.amount,100);assert.equal(L.pay(c,life).ok,true);assert.equal(c.extra.cash,1900);
 assert.equal(L.quote(c,'2045-03','life','fresh').reason,'duplicate');
 const rent=L.quote(c,'2045-03','home','cargo');assert.equal(rent.amount,1000);assert.equal(L.pay(c,rent).ok,true);assert.equal(c.extra.cash,900);
 assert.deepEqual(c.extra.other,{preserve:true});assert.equal(L.quote(c,'2045-03','home','cube').reason,'duplicate');
});
test('invalid and unsupported state or insufficient funds never modify the character',()=>{
 const c=character();assert.equal(L.quote(c,'2045-13','life','kibble').reason,'bad');assert.equal(L.quote(c,'2045-03','home','penthouse').reason,'cash');
 c.extra.living={version:2,data:'future'};const before=JSON.stringify(c);assert.equal(L.quote(c,'2045-03','life','kibble').reason,'bad');assert.equal(JSON.stringify(c),before);
});
test('reversal refunds exactly once, preserves history and permits a corrected payment',()=>{
 const c=character(),q=L.quote(c,'2045-03','life','kibble');L.pay(c,q);const old=JSON.stringify(c.extra.living.log[0]);assert.equal(L.undo(c,0,old).ok,true);assert.equal(c.extra.cash,2000);assert.equal(L.undo(c,0,old).ok,false);assert.equal(c.extra.cash,2000);assert.equal(L.pay(c,L.quote(c,'2045-03','life','generic')).ok,true);assert.equal(c.extra.cash,1700);assert.equal(c.extra.living.log.length,2);
});
test('a malformed historical amount cannot be refunded',()=>{
 const c=character();c.extra.living={version:1,log:[{period:'2045-03',type:'life',choice:'kibble',amount:999999}]};const before=JSON.stringify(c);assert.equal(L.state(c).kind,'invalid');assert.equal(L.undo(c,0,JSON.stringify(c.extra.living.log[0])).ok,false);assert.equal(JSON.stringify(c),before);
});
test('a stale quote cannot spend cash after a concurrent change',()=>{
 const c=character(),q=L.quote(c,'2045-03','home','cargo');c.extra.cash=1500;assert.equal(L.pay(c,q).reason,'stale');assert.equal(c.extra.cash,1500);assert.equal(c.extra.living,undefined);
});
test('a disconnected form or switched scope cannot commit after confirmation',()=>{
 for(const mode of ['disconnect','scope']){const c=character(),root={isConnected:true,querySelector(s){return {value:s.includes('period')?'2045-03':'kibble'}}},button={dataset:{livingPay:'life'},closest(){return root}},event={type:'click',target:{closest(){return button}}};let current=true;window.confirm=()=>{if(mode==='disconnect')root.isConnected=false;else current=false;return true};const r=L.handle(event,c,'en',{isCurrent:()=>current});assert.equal(r.dirty,undefined);assert.equal(c.extra.cash,2000);assert.equal(c.extra.living,undefined);}
});
