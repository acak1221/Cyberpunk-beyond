const {test}=require('node:test'),assert=require('node:assert/strict');
global.window={confirm:()=>true};require('../public/game/drug-tools.js');const D=window.DrugTools;
const person=()=>({id:'p',hp:30,humanity:55,stats:{WILL:6},skills:{'Resist Torture/Drugs':6},extra:{notes:'keep',cash:100,other:{future:true}}});
function setup(c){D.setScope(null);D.setScope('scope-a');D.render(c,'en');const root={isConnected:true},current={yes:true};return {root,current,field(key,value){const target={dataset:{drugField:key},value,closest:s=>s==='[data-drug-root]'?root:null};return D.handle({type:'change',target},c,'en',{isCurrent:()=>current.yes})},act(op){const b={isConnected:true,dataset:{drugAction:op},closest:s=>s==='[data-drug-root]'?root:null},target={closest:s=>s==='[data-drug-root]'?root:s==='[data-drug-action]'?b:null};return D.handle({type:'click',target},c,'en',{isCurrent:()=>current.yes})}}}
test('doses extend game duration and never change unrelated character resources',()=>{
 const c=person(),h=setup(c),before={hp:c.hp,humanity:c.humanity,cash:c.extra.cash,stats:JSON.stringify(c.stats)};assert.equal(h.act('dose').dirty,true);assert.equal(h.act('dose').dirty,true);let r=c.extra.streetDrugs.records['black-lace'];assert.equal(r.remainingHours,48);assert.equal(r.status,'active');assert.equal(c.hp,before.hp);assert.equal(c.humanity,before.humanity);assert.equal(c.extra.cash,before.cash);assert.equal(JSON.stringify(c.stats),before.stats);assert.deepEqual(c.extra.other,{future:true});
});
test('strict DV, critical dice and dose duration match the source',()=>{
 const c=person();assert.equal(D.DRUGS.boost.hours,24);assert.equal(D.DRUGS.smash.hours,4);assert.equal(D.DRUGS.synthcoke.dv,15);
 let p=D.proposal(c,'black-lace','dose');c.extra.streetDrugs={version:1,records:{'black-lace':p.record}};p=D.proposal(c,'black-lace','advance',{hours:'24'});c.extra.streetDrugs.records['black-lace']=p.record;assert.equal(p.record.status,'awaiting');let q=D.proposal(c,'black-lace','resolve',{modifier:'0'},()=>0.4);assert.equal(q.record.lastCheck.total,17);assert.equal(q.record.lastCheck.success,false);assert.equal(q.record.addicted,true);assert.equal(D.check(c,0,false,()=>0).total,12);
});
test('completed check is one-use, therapy records vulnerability, which expires only explicitly',()=>{
 const c=person(),h=setup(c);h.field('drug','smash');h.act('dose');h.field('hours','4');h.act('advance');const old=Math.random;Math.random=()=>0.1;try{h.act('resolve')}finally{Math.random=old}let r=c.extra.streetDrugs.records.smash;assert.equal(r.addicted,true);assert.equal(r.status,'resolved');assert.equal(h.act('resolve').dirty,undefined);assert.equal(h.act('therapy').dirty,true);assert.equal(r.addicted,true);r=c.extra.streetDrugs.records.smash;assert.equal(r.addicted,false);assert.equal(r.yearVulnerability,true);h.act('dose');h.field('hours','4');h.act('advance');const saved=Math.random;Math.random=()=>{throw Error('forced failure should not roll')};try{assert.equal(h.act('resolve').dirty,true)}finally{Math.random=saved}assert.equal(c.extra.streetDrugs.records.smash.lastCheck.forced,true);assert.equal(c.extra.streetDrugs.records.smash.addicted,true);assert.equal(h.act('year').dirty,true);assert.equal(c.extra.streetDrugs.records.smash.yearVulnerability,false);
});
test('an existing addiction can be recorded without giving a dose or changing old notes',()=>{
 const c=person(),h=setup(c);h.field('drug','boost');assert.equal(h.act('mark').dirty,true);const r=c.extra.streetDrugs.records.boost;assert.equal(r.addicted,true);assert.equal(r.status,'resolved');assert.equal(r.remainingHours,0);assert.equal(c.extra.notes,'keep');assert.equal(h.act('mark').dirty,undefined);
});
test('unknown formats and invalid intervals remain untouched',()=>{
 const c=person();c.extra.streetDrugs={version:2,records:{future:'data'},other:'keep'};const before=JSON.stringify(c),h=setup(c);assert.equal(h.act('dose').dirty,undefined);assert.equal(JSON.stringify(c),before);
 const c2=person(),h2=setup(c2);h2.act('dose');const saved=JSON.stringify(c2);h2.field('hours','25');assert.equal(h2.act('advance').dirty,undefined);assert.equal(JSON.stringify(c2),saved);
});
test('a future last-check payload is preserved instead of being overwritten',()=>{
 const c=person();c.extra.streetDrugs={version:1,records:{boost:{status:'resolved',remainingHours:0,addicted:false,yearVulnerability:false,lastCheck:{forced:false,die:5,extra:0,total:17,dv:17,success:false,future:{evidence:'keep'}}}}};const before=JSON.stringify(c),h=setup(c);h.field('drug','boost');assert.equal(D.state(c).kind,'invalid');assert.equal(h.act('dose').dirty,undefined);assert.equal(JSON.stringify(c),before);
});
test('switching account, detaching form or changing the character during confirmation stops mutation',()=>{
 for(const which of ['scope','detach','character']){const c=person(),h=setup(c);window.confirm=()=>{if(which==='scope')h.current.yes=false;else if(which==='detach')h.root.isConnected=false;else c.hp--;return true};const r=h.act('dose');assert.equal(r.dirty,undefined);assert.equal(c.extra.streetDrugs,undefined)}window.confirm=()=>true;
});
test('both languages describe manual effects and the book source',()=>{
 const c=person();D.setScope(null);D.setScope('scope-a');for(const l of ['ru','en']){const html=D.render(c,l);assert.match(html,/data-page="227"/);assert.match(html,/Black Lace/);assert.match(html,/Humanity/)}
});
