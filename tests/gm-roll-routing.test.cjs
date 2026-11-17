const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.join(__dirname,'../site');
const plain=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const base={Math,Number,String,Array,Object,Set,Infinity,JSON,Date,Map,RegExp};
function load(files,win){const ctx={window:win,...base};for(const f of files)vm.runInNewContext(fs.readFileSync(path.join(dir,f),'utf8'),ctx);return win}
function emitter(mode){const calls=[];return {calls,GmRolls:{emit:(label,detail,total,faces)=>{calls.push({label,detail,total,faces:plain(faces)});return {mode,ok:true}}}}}
function rng(...v){let i=0;return ()=>v[i++%v.length]}

// ---- gm-tools: NPC skill, weapon, encounter d100, face down ----
function skillHarness(win){
 const G=win.GMTools,w=G.initial(),n={id:'npc-1',name:'Guard',template:'security-officer',hp:19,notes:''};w.roster=[n];
 const inputs={key:{value:'Athletics'},mode:{value:'armored'},modifier:{value:'0'},wound:{checked:true}},out={textContent:''};
 const root={isConnected:true,dataset:{npcId:n.id},querySelector(s){if(s==='[data-npc-skill-result]')return out;const m=s.match(/^\[data-npc-skill="(\w+)"\]$/);return m?inputs[m[1]]:null}};
 const b={isConnected:true,dataset:{gm:'npc-skill-roll'},closest:s=>s==='[data-gm-skill]'?root:s==='[data-gm]'?b:null};
 const ctx={lang:'en',workspace:w,scope:'a',isCurrent:x=>x===w};
 return {w,out,click:()=>G.handle({type:'click',target:b},ctx),ctx};
}
test('an NPC skill roll is sent through GmRolls with its faces and says so when hidden',()=>{
 for(const mode of ['open','hidden']){
  const e=emitter(mode),win=load(['gm-tools.js'],{...e}),h=skillHarness(win),old=Math.random;Math.random=rng(0.4);
  try{
   assert.equal(h.click().handled,true);
   assert.equal(e.calls.length,1);assert.equal(e.calls[0].label,'Guard · Athletics');assert.equal(e.calls[0].total,11);assert.deepEqual(e.calls[0].faces,[{v:5,s:10}]);
   assert.match(e.calls[0].detail,/8 \+ 0 − 2 \(wound\) \+ 1d10 5 = 11/);
   assert.match(h.out.textContent,/Athletics: 8 .* = 11/);assert.equal(/ · hidden$/.test(h.out.textContent),mode==='hidden');
  }finally{Math.random=old}
 }
});
test('a critical skill roll reports both dice',()=>{
 const e=emitter('open'),win=load(['gm-tools.js'],{...e}),h=skillHarness(win),old=Math.random;Math.random=rng(0.95,0.2);
 try{h.click();assert.deepEqual(e.calls[0].faces,[{v:10,s:10},{v:3,s:10}])}finally{Math.random=old}
});
test('without GmRolls the NPC roll works exactly as before',()=>{
 const win=load(['gm-tools.js'],{}),h=skillHarness(win),old=Math.random;Math.random=rng(0.4);
 try{assert.equal(h.click().handled,true);assert.match(h.out.textContent,/= 11$/)}finally{Math.random=old}
});
test('a refused roll (stale form) is not sent anywhere',()=>{
 const e=emitter('open'),win=load(['gm-tools.js'],{...e}),h=skillHarness(win);h.ctx.isCurrent=()=>false;
 h.click();assert.equal(e.calls.length,0);
});
test('an NPC weapon roll is sent as d6 dice with the total',()=>{
 const e=emitter('hidden'),win=load(['gm-tools.js'],{...e}),G=win.GMTools,w=G.initial(),n={id:'n',name:'Guard',template:'bodyguard',hp:20,notes:''};w.roster=[n];
 const field={value:'0'},out={textContent:''},root={isConnected:true,dataset:{npcId:'n'},querySelector:s=>s==='[data-npc-weapon="index"]'?field:s==='[data-npc-weapon-result]'?out:null};
 const b={isConnected:true,dataset:{gm:'npc-weapon-roll'},closest:s=>s==='[data-gm-weapon]'?root:s==='[data-gm]'?b:null},old=Math.random;Math.random=rng(0,0.2,0.4,0.6,0.99);
 try{G.handle({type:'click',target:b},{lang:'en',workspace:w,scope:'a',isCurrent:x=>x===w})}finally{Math.random=old}
 assert.equal(e.calls.length,1);assert.equal(e.calls[0].label,'Guard · Poor Quality Shotgun');assert.deepEqual(e.calls[0].faces,[1,2,3,4,6].map(v=>({v,s:6})));assert.equal(e.calls[0].total,16);assert.match(out.textContent,/ · hidden$/);
});
test('the encounter d100 and the face-down check are rolls of the GM too',()=>{
 const e=emitter('open'),win=load(['gm-tools.js'],{...e}),G=win.GMTools,w=G.initial(),old=Math.random;Math.random=rng(0.42);
 try{const b={dataset:{gm:'roll'},closest:s=>s==='[data-gm]'?b:null};const r=G.handle({type:'click',target:b},{lang:'en',workspace:w});assert.equal(r.dirty,true);assert.equal(w.roll,43)}finally{Math.random=old}
 assert.equal(e.calls.length,1);assert.equal(e.calls[0].label,'Random encounter · 1d100');assert.equal(e.calls[0].total,43);assert.deepEqual(e.calls[0].faces,[{v:43,s:100}]);
 const ru=emitter('open'),w2=load(['gm-tools.js'],{...ru}),Old=Math.random;Math.random=rng(0.0);
 try{const b={dataset:{gm:'roll'},closest:s=>s==='[data-gm]'?b:null};w2.GMTools.handle({type:'click',target:b},{lang:'ru',workspace:w2.GMTools.initial()})}finally{Math.random=Old}
 assert.equal(ru.calls[0].label,'Случайная встреча · 1d100');
});
test('a face-down roll is sent with the first side as the total',()=>{
 const e=emitter('open'),win=load(['gm-tools.js'],{...e}),G=win.GMTools,old=Math.random;Math.random=rng(0.4,0.8);
 const vals={'[data-face-name-a]':'Vega','[data-face-cool-a]':'6','[data-face-rep-a]':'0','[data-face-modifier-a]':'0','[data-face-name-b]':'Kurt','[data-face-cool-b]':'5','[data-face-rep-b]':'0','[data-face-modifier-b]':'0'};
 const out={textContent:''},root={querySelector:s=>s==='[data-face-result]'?out:(s in vals?{value:vals[s],checked:false}:{value:'',checked:false})};
 const b={dataset:{faceAction:'roll'},closest:s=>s==='[data-face-action]'?b:s==='[data-face-root]'?root:null};
 try{G.handle({type:'click',target:b},{lang:'en',workspace:G.initial()})}finally{Math.random=old}
 assert.equal(e.calls.length,1);assert.equal(e.calls[0].label,'Vega · Kurt');assert.ok(Number.isInteger(e.calls[0].total));assert.ok(e.calls[0].faces.length>=1);
});

// ---- gm-extras: oracle, loot, weather, book tables ----
function gx(mode){
 const e=emitter(mode),state={gmExtras:{}},win={...e,App:{getState:()=>state,save(){},lang:()=>'en'}};
 load(['catalog.js','catalog-extra.js','book-tables.js','gm-extras.js'],win);
 const GX=win.GMExtras;GX.reset();
 const root={dataset:{lang:'en'},querySelector:()=>null,isConnected:true,outerHTML:''};
 const click=(a,r)=>{const b={dataset:{gxAction:a},closest:s=>s==='[data-gx-root]'?root:b};return GX.handle({type:'click',target:b},'en',r||Math.random)};
 return {e,GX,click,win};
}
test('the oracle, loot, a gig, weather and the book tables are sent through GmRolls',()=>{
 const g=gx('open');
 g.click('oracle',rng(0.7));
 assert.equal(g.e.calls.length,1);assert.equal(g.e.calls[0].label,'Yes/No oracle');assert.equal(g.e.calls[0].total,8);assert.deepEqual(g.e.calls[0].faces,[{v:8,s:10}]);assert.match(g.e.calls[0].detail,/^d10 8 \(needs ≥ \d+\) — /);
 g.click('weather',rng(0.35,0.5,0.5,0.5));
 const wx=g.e.calls[1];assert.equal(wx.label,'Weather');assert.equal(wx.total,4);assert.match(wx.detail,/°C/);
 g.click('loot-pockets',rng(0.1,0.3,0.5,0.7,0.2,0.4,0.6,0.8));
 const lt=g.e.calls[2];assert.equal(lt.label,'Loot');assert.match(lt.detail,/eb$/);assert.ok(Number.isInteger(lt.total));
 g.click('gig',rng(0.1,0.2,0.3,0.4,0.5,0.6,0.7));assert.equal(g.e.calls[3].label,'Gig');
 for(const [a,title] of [['book-headline','Screamsheet headline'],['book-vendit','Vendit'],['book-bodega','bodega']]){
  const n=g.e.calls.length;g.click(a,rng(0.2,0.4,0.6,0.8));assert.equal(g.e.calls.length,n+1);assert.match(g.e.calls[n].label,new RegExp(title,'i'));assert.ok(g.e.calls[n].faces.every(f=>f.s===6||f.s===10));
 }
});
test('the tool still keeps its own recent results when GmRolls is missing',()=>{
 const state={gmExtras:{}},win={App:{getState:()=>state,save(){},lang:()=>'en'}};load(['catalog.js','catalog-extra.js','book-tables.js','gm-extras.js'],win);
 const GX=win.GMExtras;GX.reset();const root={dataset:{lang:'en'},querySelector:()=>null,isConnected:true,outerHTML:''};
 const b={dataset:{gxAction:'oracle'},closest:s=>s==='[data-gx-root]'?root:b};assert.equal(GX.handle({type:'click',target:b},'en',rng(0.5)),true);
 assert.match(GX.render('en'),/Yes\/No oracle/);
});
test('the render groups the cards into the hub panes and keeps every card',()=>{
 const g=gx('open'),html=g.GX.render('en');
 for(const p of ['clocks','tables','world','npc'])assert.match(html,new RegExp(`data-gm-pane="${p}"`));
 assert.match(html,/data-gx-section="clocks"/);assert.match(html,/data-gx-section="tables"/);assert.match(html,/data-gx-section="weather"/);
 assert.ok(html.indexOf('data-gm-pane="clocks"')<html.indexOf('data-gx-section="clocks"')&&html.indexOf('data-gx-section="clocks"')<html.indexOf('data-gm-pane="tables"'));
 assert.equal((html.match(/<div/g)||[]).length,(html.match(/<\/div>/g)||[]).length);
});

// ---- roll tables ----
test('a roll table goes through GmRolls when it is there and through App.report otherwise',()=>{
 const src=fs.readFileSync(path.join(dir,'roll-tables.js'),'utf8');
 assert.match(src,/global\.GmRolls\.emit\(lab,det,r\.total/);assert.match(src,/else global\.App\?\.report\?\.\(lab,det/);
});

// ---- npc-library: optional tier ----
test('a library entry keeps an optional threat level and drops a bad one; old entries are unchanged',()=>{
 const win=load(['npc-library.js'],{}),N=win.NpcLibrary;
 assert.equal(N.cleanEntry({id:'a',name:'Goon',tier:'boss'}).tier,'boss');
 for(const bad of ['legend',7,null,{},'BOSS'])assert.equal('tier' in N.cleanEntry({id:'a',name:'Goon',tier:bad}),false,String(bad));
 assert.deepEqual(plain(N.cleanEntry({id:'a',name:'Goon'})),{id:'a',name:'Goon',ref:6,hp:30,head:0,torso:0,weapons:'',notes:''});
 const r=N.addEntry([],{name:'Goon',tier:'lieutenant'},'x1');assert.equal(r.entry.tier,'lieutenant');
 const u=N.updateEntry(r.list,'x1',{name:'Goon',tier:'mini'});assert.equal('tier' in u.entry,false);
 assert.equal(N.cloneEntry(r.list,'x1','en','x2').entry.tier,'lieutenant');
});
test('library cards are marked for the filter row and the form offers the level in both languages',()=>{
 const state={gmExtras:{npcLibrary:[{id:'a',name:'Goon',tier:'mook',notes:'Tiger Claw gang'}]},campaigns:[]};
 const attrs=[];const win=load(['npc-library.js'],{App:{getState:()=>state,save(){},lang:()=>'en'},NpcFilter:{attrs:i=>{attrs.push(i);return ' data-nf-item'}}});
 const html=win.NpcLibrary.render('en');
 assert.match(html,/data-nl-entry="a" data-nf-item/);assert.deepEqual(plain(attrs[0]),{name:'Goon',tier:'mook',source:'library',extra:'Tiger Claw gang'});assert.match(html,/Mook · REF 6/);
 const ru=win.NpcLibrary.render('ru');assert.match(ru,/Рядовой · /);
 const none=load(['npc-library.js'],{App:{getState:()=>state,save(){},lang:()=>'en'}}).NpcLibrary.render('en');assert.doesNotMatch(none,/data-nf-item/);
});
