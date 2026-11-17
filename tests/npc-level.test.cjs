const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.join(__dirname,'../site');
const plain=x=>JSON.parse(JSON.stringify(x));
function load(extra={}){
 const win={...extra},ctx={window:win,Math,Number,String,Array,Object,Set,JSON,Date,Infinity,Map,RegExp};
 for(const f of ['gm-tools.js','npc-builder.js'])vm.runInNewContext(fs.readFileSync(path.join(dir,f),'utf8'),ctx);
 return win;
}
const W=load(),G=W.GMTools,B=W.NpcBuilder,tpl=id=>G.NPC_TEMPLATES.find(x=>x.id===id);

test('scale at the template\'s own level is an exact, independent copy',()=>{
 for(const t of G.NPC_TEMPLATES){
  const c=B.scale(t,t.tier);assert.deepEqual(plain(c),plain(t));assert.notEqual(c,t);
  c.stats.REF=99;c.armor.headSP=99;assert.notEqual(t.stats.REF,99);assert.notEqual(t.armor.headSP,99);
 }
});
test('scale up three steps moves stats by 1, HP by 5, skills by 2 and armor along the ladder',()=>{
 const t=tpl('bodyguard'),c=B.scale(t,'boss');
 assert.equal(c.tier,'boss');assert.equal(c.scaledFrom,'mook');
 assert.equal(c.stats.REF,9);assert.equal(c.stats.BODY,9);assert.equal(c.stats.WILL,7);assert.equal(c.stats.COOL,t.stats.COOL,'other stats stay');
 assert.equal(c.hp,50);assert.equal(c.serious,25);assert.equal(c.death,9);
 assert.equal(c.armor.headSP,13);assert.equal(c.armor.bodySP,13);
 assert.equal(c.skillBases.Athletics,t.skillBases.Athletics+6);
 assert.deepEqual(plain(c.weapons),plain(t.weapons));assert.equal(c.armor.name,'','a scaled armor drops the book name that would contradict the SP');
 assert.equal(t.hp,35,'the source template is not changed');
});
test('scale down is clamped and never gives a broken template',()=>{
 const t=tpl('cyberpsycho'),c=B.scale(t,'mook');
 assert.equal(c.hp,40);assert.ok(c.stats.REF>=1&&c.stats.BODY>=1&&c.stats.WILL>=1);
 for(const base of G.NPC_TEMPLATES)for(const level of B.TIERS){
  const s=B.scale(base,level);assert.ok(s,base.id+level);
  assert.ok(s.hp>=10&&s.hp<=999);assert.ok(s.armor.headSP>=0&&s.armor.bodySP>=0);
  for(const v of Object.values(s.skillBases)){const nums=v&&typeof v==='object'?[v.base,v.armored]:[v];for(const n of nums)if(n!==null)assert.ok(Number.isInteger(n)&&n>=0&&n<=40)}
 }
});
test('an armored REF is shifted together with the stat and the armored skill values',()=>{
 const t=tpl('security-officer'),c=B.scale(t,'boss');
 assert.equal(c.effectiveStats.REF,t.effectiveStats.REF+2);assert.equal(c.effectiveStats.DEX,t.effectiveStats.DEX,'only REF, BODY and WILL move');
 const raw=t.skillBases.Athletics;assert.equal(typeof raw,'object');
 assert.equal(c.skillBases.Athletics.base,raw.base+4);assert.equal(c.skillBases.Athletics.armored,raw.armored+4);
});
test('an unknown level gives a copy as it is; a malformed template gives null',()=>{
 const t=tpl('pyro');assert.deepEqual(plain(B.scale(t,'legend')),plain(t));assert.deepEqual(plain(B.scale(t,undefined)),plain(t));
 for(const bad of [null,undefined,{},{id:'x'},'pyro',7])assert.equal(B.scale(bad,'boss'),null);
});
test('tempOf follows the level of a roster row and ignores a level it does not know',()=>{
 const n={id:'1',template:'bodyguard',name:'G',hp:50,notes:''};
 assert.equal(G.tempOf(n),tpl('bodyguard'));
 assert.equal(G.tempOf({...n,level:'boss'}).hp,50);assert.equal(G.tempOf({...n,level:'mook'}),tpl('bodyguard'));assert.equal(G.tempOf({...n,level:'nope'}),tpl('bodyguard'));
 assert.equal(G.tempOf({...n,template:'missing'}),undefined);
});
test('old rosters stay valid, a good level is accepted and a bad one is refused',()=>{
 const w=G.initial();w.roster=[{id:'a',template:'bodyguard',name:'x',hp:3,notes:''}];assert.equal(G.validWorkspace(w),true);
 w.roster[0].level='boss';assert.equal(G.validWorkspace(w),true);
 for(const bad of ['legend',7,null,{}]){w.roster[0].level=bad;assert.equal(G.validWorkspace(w),false,String(bad))}
});
test('scaleRows puts the level numbers and a labelled note on new tracker rows',()=>{
 const rows=[{id:'1',kind:'npc',name:'Bodyguard 1',ref:6,hp:35,maxHp:35,sp:{head:7,body:7},body:6,combatNote:{version:1,text:'SP 7/7 · Poor Quality Shotgun 5d6; Very Heavy Pistol 4d6'}}];
 assert.equal(G.scaleRows(rows,'bodyguard','boss','en'),1);
 const r=rows[0];assert.equal(r.hp,50);assert.equal(r.maxHp,50);assert.equal(r.ref,9);assert.equal(r.body,9);assert.deepEqual(plain(r.sp),{head:13,body:13});
 assert.match(r.combatNote.text,/^Level: Boss \(app scaling\) · SP 13\/13 · Poor Quality Shotgun/);assert.doesNotMatch(r.combatNote.text,/SP 7\/7/);assert.ok(r.combatNote.text.length<=300);assert.equal(r.combatNote.version,1);
 const ru=[{id:'2',combatNote:{version:1,text:'x'.repeat(290)}}];G.scaleRows(ru,'bodyguard','lieutenant','ru');assert.match(ru[0].combatNote.text,/^Уровень: Лейтенант \(масштаб приложения\)/);assert.equal(ru[0].combatNote.text.length,300);
});
test('scaleRows leaves rows alone for the template\'s own level, no level or a bad template',()=>{
 const mk=()=>[{id:'1',hp:35,ref:6}],a=mk();
 assert.equal(G.scaleRows(a,'bodyguard','mook','en'),0);assert.equal(G.scaleRows(a,'bodyguard','','en'),0);assert.equal(G.scaleRows(a,'nobody','boss','en'),0);assert.equal(G.scaleRows(a,'bodyguard','legend','en'),0);
 assert.deepEqual(plain(a),[{id:'1',hp:35,ref:6}]);assert.equal(G.scaleRows(null,'bodyguard','boss','en'),0);assert.equal(G.scaleRows([null,7],'bodyguard','boss','en'),2-2+0);
});
test('addToCampaign scales what Campaigns.addTemplates added',()=>{
 const camp={roster:[]};
 const W2=load({Campaigns:{addTemplates:(c,id,n)=>{const added=Array.from({length:n},(_,i)=>({id:'r'+i,kind:'npc',name:'N '+i,ref:6,hp:35,maxHp:35}));c.roster.push(...added);return {ok:true,added,name:'Bodyguard'}}}});
 const r=W2.GMTools.addToCampaign(camp,'bodyguard',2,'en','boss');
 assert.equal(r.ok,true);assert.deepEqual(plain(camp.roster.map(x=>x.hp)),[50,50]);
 const r2=W2.GMTools.addToCampaign({roster:[]},'bodyguard',1,'en','');assert.equal(r2.added[0].hp,35);
 const W3=load({Campaigns:{addTemplates:()=>({ok:false,added:[]})}});assert.equal(W3.GMTools.addToCampaign({roster:[]},'bodyguard',1,'en','boss').ok,false);
 assert.equal(load().GMTools.addToCampaign({roster:[]},'bodyguard',1,'en','boss'),undefined,'without the tracker module nothing is made up');
});
test('the book card and the encounter form offer a level in both languages and the app\'s-own-scaling note',()=>{
 const w=G.initial();w.roll=1;
 for(const lang of ['ru','en']){
  const html=G.render({lang,workspace:w,campaigns:[{id:'c1',name:'Job',roster:[]}]});
  assert.match(html,/data-gm-tpl="bodyguard"/);assert.match(html,/<select data-gm-level="bodyguard">/);assert.match(html,/data-gm-enc-level/);
  assert.match(html,lang==='ru'?/собственная настройка приложения, а не правило книги/:/the app’s own setting, not a book rule/);
  assert.match(html,lang==='ru'?/Как в книге/:/As in the book/);assert.match(html,lang==='ru'?/Добавить в бой/:/Add to combat/);
 }
});
test('with panes the page header is left to the hub and the pieces are marked with their tab',()=>{
 const w=G.initial(),a=G.render({lang:'en',workspace:w,panes:true}),b=G.render({lang:'en',workspace:w});
 assert.doesNotMatch(a,/page-header/);assert.match(b,/page-header/);
 assert.match(a,/data-gm-pane="meeting"/);assert.match(a,/data-gm-pane="npc"/);
 assert.equal((a.match(/<div/g)||[]).length,(a.match(/<\/div>/g)||[]).length,'balanced markup');
});
function addSetup(level){
 const w=G.initial(),sel=level===undefined?null:{value:level},card={querySelector:s=>s==='[data-gm-level]'?sel:null};
 const b={dataset:{gm:'add',id:'bodyguard'},closest:s=>s==='[data-gm]'?b:s==='[data-gm-tpl]'?card:null};
 return {w,click:()=>G.handle({type:'click',target:b},{lang:'en',workspace:w})};
}
test('adding a template at a level stores the level and the scaled HP; no choice keeps the old shape',()=>{
 let h=addSetup('boss');assert.equal(h.click().handled,true);
 assert.equal(h.w.roster[0].hp,50);assert.equal(h.w.roster[0].level,'boss');assert.equal(G.validWorkspace(h.w),true);
 for(const level of ['','mook','legend',undefined]){h=addSetup(level);h.click();assert.equal(h.w.roster[0].hp,35);assert.equal('level' in h.w.roster[0],false,String(level))}
});
test('a scaled roster row shows its level and uses the scaled numbers in the card',()=>{
 const w=G.initial();w.roster=[{id:'a',template:'bodyguard',name:'Big',hp:50,notes:'',level:'boss'}];
 const html=G.render({lang:'en',workspace:w});
 assert.match(html,/Level: Boss \(app scaling\)/);assert.match(html,/HP 50 · Armor 13\/13/);
 const old=G.initial();old.roster=[{id:'a',template:'bodyguard',name:'Old',hp:20,notes:''}];assert.doesNotMatch(G.render({lang:'en',workspace:old}),/app scaling\)<\/p>/);
});
