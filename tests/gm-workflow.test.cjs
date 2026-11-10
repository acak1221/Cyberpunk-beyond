const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.join(__dirname,'../site'),read=f=>fs.readFileSync(path.join(dir,f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));

// ---------- NPC library ----------
function lib(state){let saves=0,notes=[];const context={window:{App:{getState:()=>state,save:()=>{saves++},lang:()=>'ru',notify:m=>notes.push(m)}},Math,Number,String,Array,Object,Set,JSON,Date,RegExp,globalThis:{crypto:{randomUUID:(()=>{let i=0;return()=>'u'+(++i)})()}}};vm.runInNewContext(read('npc-library.js'),context);return {L:context.window.NpcLibrary,saves:()=>saves,notes,context}}
const goon={name:'Ганк',ref:7,body:6,will:5,hp:40,head:7,torso:11,weapons:'Пистолет 2d6',notes:'Трусит'};

test('library: defensive read of bad storage and cap',()=>{
 const {L}=lib({});
 assert.deepEqual(plain(L.readLibrary({})),[]);
 assert.deepEqual(plain(L.readLibrary({gmExtras:{npcLibrary:'x'}})),[]);
 const many=Array.from({length:150},(_,i)=>({id:'n'+i,name:'N'+i}));
 assert.equal(L.readLibrary({gmExtras:{npcLibrary:many}}).length,100);
 const r=L.readLibrary({gmExtras:{npcLibrary:[null,{id:'a',name:'  '},{id:'bad id',name:'x'},{id:'a',name:'A\nB',ref:99,hp:-5,head:'7'},{id:'a',name:'dup'}]}});
 assert.equal(r.length,1);assert.equal(r[0].name,'A B');assert.equal(r[0].ref,20);assert.equal(r[0].hp,0);assert.equal(r[0].head,7);
});
test('library: add/update/remove/write keep other gmExtras',()=>{
 const {L}=lib({});const st={gmExtras:{clocks:[1]}};
 let r=L.addEntry([],goon,'a1');assert(r.ok);L.writeLibrary(st,r.list);
 assert.deepEqual(plain(st.gmExtras.clocks),[1]);assert.equal(st.gmExtras.npcLibrary[0].name,'Ганк');
 assert.equal(L.addEntry([],{name:'  '}).reason,'name');
 r=L.updateEntry(r.list,'a1',{...goon,name:'Босс',hp:99});assert.equal(r.list[0].name,'Босс');assert.equal(r.list[0].id,'a1');
 assert.equal(L.updateEntry(r.list,'zz',goon).reason,'missing');
 assert.equal(L.removeEntry(r.list,'a1').list.length,0);
 const full=Array.from({length:100},(_,i)=>({id:'n'+i,name:'N'}));
 assert.equal(L.addEntry(full,goon).reason,'full');
});
test('library: clone inserts after source with localized suffix and new id',()=>{
 const {L}=lib({});
 const list=L.addEntry(L.addEntry([],goon,'a').list,{name:'Другой'},'b').list;
 const r=L.cloneEntry(list,'a','ru','c');assert(r.ok);
 assert.deepEqual(plain(r.list.map(x=>x.id)),['a','c','b']);assert.equal(r.list[1].name,'Ганк (копия)');assert.equal(r.list[1].hp,40);
 assert.equal(L.cloneEntry(list,'a','en','d').list[1].name,'Ганк (copy)');
 assert.equal(L.cloneEntry(list,'nope','ru').reason,'missing');
 const long=L.addEntry([],{name:'x'.repeat(80)},'l').list;assert(L.cloneEntry(long,'l','en','m').list[1].name.length<=60);
});
test('library: HP from BODY/WILL',()=>{
 const {L}=lib({});
 assert.equal(L.hpFromStats(6,5),10+5*Math.ceil(11/2));
 assert.equal(L.hpFromStats('',5),null);
});
test('numbering: starts at 1, continues after the highest used number, ignores PCs and other names',()=>{
 const {L}=lib({});
 assert.deepEqual(plain(L.numberedNames('Ганк',3,[])),['Ганк 1','Ганк 2','Ганк 3']);
 const roster=[{kind:'npc',name:'Ганк 2'},{kind:'npc',name:'Ганк 5'},{kind:'pc',name:'Ганк 9'},{kind:'npc',name:'Ганкер 8'},{kind:'npc',name:'Ганк'}];
 assert.deepEqual(plain(L.numberedNames('Ганк',2,roster)),['Ганк 6','Ганк 7']);
 assert.equal(L.numberedNames('A.B',1,[{kind:'npc',name:'AxB 4'}])[0],'A.B 1');
 assert.equal(L.numberedNames('X',999,[]).length,L.MAX_COPIES);
 assert.equal(L.numberedNames('X',0,[]).length,1);
});
test('addToCampaign: pushes tracker-compatible npc entries with note',()=>{
 const {L}=lib({});let i=0;const c={roster:[{id:'p',kind:'pc',characterId:'x',initiative:3,order:1}]};
 const e=L.cleanEntry({id:'a',...goon});
 const r=L.addToCampaign(c,e,3,'ru',()=>'id'+(++i),1000);
 assert(r.ok);assert.equal(c.roster.length,4);
 const n=c.roster[1];
 assert.deepEqual(plain({...n,combatNote:undefined}),{id:'id1',kind:'npc',name:'Ганк 1',ref:7,hp:40,initiative:0,order:1000,sourceLibrary:'a',sp:{head:7,body:11},body:6});
 assert.deepEqual(plain(c.roster.map(x=>x.name).slice(1)),['Ганк 1','Ганк 2','Ганк 3']);
 assert.equal(n.combatNote.version,1);assert(n.combatNote.text.includes('7/11')&&n.combatNote.text.length<=300);
 assert.equal(new Set(c.roster.map(x=>x.id)).size,4);
 assert.equal(L.addToCampaign({roster:Array.from({length:2045},()=>({}))},e,1,'ru',()=>'z').ok,false);
 assert.equal(L.addToCampaign(null,e,1,'ru',()=>'z').ok,false);
});
test('library UI: escapes values, saves via click handler, adds to campaign',()=>{
 const state={gmExtras:{},campaigns:[{id:'c1',name:'<b>Job</b>',roster:[]}]};
 const {L,saves,notes}=lib(state);
 let html=L.render('en');assert(html.includes('data-gx-section="npcs"'));assert(!html.includes('<b>Job'));
 const root={isConnected:true,dataset:{lang:'en'},outerHTML:''};
 const click=(a,id,extra={})=>L.handle({type:'click',target:{dataset:{},closest:s=>s==='[data-nl-root]'?root:s==='[data-nl-action]'?{dataset:{nlAction:a,nlId:id},closest:s2=>s2==='[data-nl-entry]'?extra.box:null}:null}},'en');
 const input=(f,v)=>L.handle({type:'input',target:{dataset:{nlField:f},value:v,closest:s=>s==='[data-nl-root]'?root:null}},'en');
 click('new');input('name','<i>Thug</i>');input('hp','55');click('save');
 assert.equal(state.gmExtras.npcLibrary.length,1);assert.equal(state.gmExtras.npcLibrary[0].name,'<i>Thug</i>');assert.equal(state.gmExtras.npcLibrary[0].hp,55);assert.equal(saves(),1);
 html=L.render('en');assert(!html.includes('<i>Thug'));assert(html.includes('&lt;i&gt;Thug'));
 const id=state.gmExtras.npcLibrary[0].id;
 const box={querySelector:s=>s==='[data-nl-pick]'?{value:'c1'}:{value:'2'}};
 click('add',id,{box});
 assert.equal(state.campaigns[0].roster.length,2);assert.equal(state.campaigns[0].roster[1].name,'<i>Thug</i> 2');assert(notes.length===1);
 click('del',id);assert.equal(state.gmExtras.npcLibrary.length,1);click('del',id);assert.equal(state.gmExtras.npcLibrary.length,0);
 click('new');click('save');assert.equal(state.gmExtras.npcLibrary.length,0);assert(notes.length===2);
});

// ---------- campaign journal ----------
function camp(roster,over={}){
 const nodes={'#campaign-journal-text':{value:''},'#app':{appendChild(){}}};let saved=0;
 const scope={window:{},globalThis:{crypto:{randomUUID:(()=>{let i=0;return()=>'j'+(++i)})()}},document:{querySelector:s=>nodes[s]||null},setTimeout,confirm:()=>true,Math:Object.assign(Object.create(Math),{random:()=>0.5}),Date,Number,String,Array,Object,JSON,Set,WeakMap,Promise,isNaN};
 vm.createContext(scope);vm.runInContext(read('campaigns.js'),scope);
 const campaign={id:'c',name:'Работа / Job',notes:'',round:1,turnIndex:0,roster,...over},characters=[{id:'pc',name:'Nova',stats:{REF:6},hp:45}];
 const ctx={lang:'en',campaigns:[campaign],characters,save:()=>saved++,render(){},isCurrent:c=>c===campaign};
 const click=(action,data={})=>scope.window.Campaigns.handle({type:'click',target:{closest:s=>s==='[data-campaign-action]'?{dataset:{campaignAction:action,...data}}:null}},ctx);
 click('open',{id:'c'});
 return {scope,campaign,click,nodes,saved:()=>saved,C:scope.window.Campaigns,html:(l='en')=>scope.window.Campaigns.render([campaign],characters,l),ctx};
}
const two=()=>[{id:'a',kind:'npc',name:'A',ref:5,initiative:9,order:1},{id:'b',kind:'npc',name:'B',ref:5,initiative:3,order:2}];

test('journal: manual entries, newest first, trimmed, deletable',()=>{
 const h=camp(two());
 h.nodes['#campaign-journal-text'].value='   ';h.click('journal-add');assert.equal(h.campaign.journal,undefined);
 h.nodes['#campaign-journal-text'].value=' first ';h.click('journal-add');
 h.nodes['#campaign-journal-text'].value='second';h.click('journal-add');
 assert.deepEqual(plain(h.campaign.journal.map(e=>e.text)),['second','first']);
 assert(h.campaign.journal.every(e=>e.auto===false&&Number.isFinite(e.at)&&typeof e.id==='string'));
 assert(h.html().indexOf('second')<h.html().indexOf('first'));
 h.click('journal-del',{id:h.campaign.journal[0].id});
 assert.deepEqual(plain(h.campaign.journal.map(e=>e.text)),['first']);
});
test('journal: automatic entries for roll-all, new round and reset',()=>{
 const h=camp(two());
 h.click('roll-all');assert.equal(h.campaign.journal.length,1);assert.equal(h.campaign.journal[0].auto,true);assert(h.campaign.journal[0].text.includes('2'));
 h.click('next');assert.equal(h.campaign.journal.length,1);
 h.click('next');assert.equal(h.campaign.round,2);assert.equal(h.campaign.journal.length,2);assert.match(h.campaign.journal[0].text,/Round 2/);
 h.click('reset');assert.equal(h.campaign.journal[0].text,'Combat reset');assert.equal(h.campaign.journal.length,3);
 assert.equal(h.campaign.round,1);
});
test('journal: no auto entry for roll-all on empty roster; ru text',()=>{
 const h=camp([]);h.click('roll-all');assert.equal(h.campaign.journal,undefined);
 const r=camp(two());r.ctx.lang='ru';r.click('reset');assert.equal(r.campaign.journal[0].text,'Бой сброшен');
});
test('journal: cap 300 and defensive read of bad data',()=>{
 const {C}=camp([]);
 const c={journal:[null,{text:'ok',at:5,id:'x'},{text:'',at:1},{text:'t',at:'bad'},'s',{text:'nul\u0000l',at:2,auto:'yes'}]};
 const r=plain(C.readJournal(c));assert.equal(r.length,3);assert.equal(r[0].id,'x');assert.equal(r[1].at,0);assert.equal(r[2].text,'null');assert.equal(r[2].auto,false);
 const big={journal:Array.from({length:400},(_,i)=>({text:'e'+i,at:i,id:'i'+i}))};
 assert.equal(C.readJournal(big).length,300);
 assert(C.journalAdd(big,'new',false,1,'n'));assert.equal(big.journal.length,300);assert.equal(big.journal[0].text,'new');
 assert.equal(C.journalAdd(big,' ',false),false);
 const html=camp([],{journal:'garbage'}).html();assert(html.includes('data-campaign-journal'));
});
test('journal: markdown export is chronological and escapes nothing dangerous in header',()=>{
 const {C}=camp([]);
 const c={name:'Job\nX',journal:[{id:'2',at:2000,text:'later\nline2',auto:true},{id:'1',at:1000,text:'earlier',auto:false}]};
 const md=C.journalMarkdown(c,'en');
 assert(md.startsWith('# Job X — Journal\n'));
 assert(md.indexOf('earlier')<md.indexOf('later'));assert(md.includes('_(auto)_'));assert(md.includes('later\n  line2'));
 assert(C.journalMarkdown({name:'Q'},'ru').includes('Записей пока нет'));
});
test('cross-links: open sheet for PC rows only, GM shortcuts in both languages',()=>{
 const h=camp([{id:'r1',kind:'pc',characterId:'pc',initiative:5,order:1},{id:'r2',kind:'npc',name:'Thug',ref:5,hp:20,initiative:1,order:2}]);
 for(const l of ['en','ru']){
  const html=h.html(l);
  assert.equal((html.match(/data-action="open" data-id="pc"/g)||[]).length,1);
  for(const s of ['market','clocks','tables','weather','npcs'])assert(html.includes(`data-campaign-action="goto-gm" data-section="${s}"`));
 }
});
test('goto-gm navigates via the app navigate action then scrolls',async()=>{
 const h=camp([]);const log=[];
 h.nodes['#app']={appendChild:n=>log.push(['append',n.dataset.action,n.dataset.view])};
 h.nodes['[data-gx-section="clocks"]']={scrollIntoView:()=>log.push(['scroll'])};
 const mk=()=>({dataset:{},click(){log.push(['click'])},remove(){log.push(['remove'])}});
 h.scope.document.createElement=mk;
 assert.equal(h.click('goto-gm',{section:'clocks'}),true);
 assert.deepEqual(log.slice(0,3).map(x=>x[0]),['append','click','remove']);
 assert.deepEqual(log[0],['append','navigate','gm']);
 await new Promise(r=>setTimeout(r,120));
 assert(log.some(x=>x[0]==='scroll'));
});

test('wiring: index.html loads the new files in order; gm-extras renders the library',()=>{
 const html=read('index.html');
 assert(html.indexOf('npc-library.js')>html.indexOf('gm-extras.js')&&html.indexOf('npc-library.js')<html.indexOf('src="app.js"'));
 assert(html.indexOf('gm-workflow.css')>0&&html.indexOf('gm-workflow.css')<html.indexOf('theme.css'));
 assert(read('gm-extras.js').includes('NpcLibrary'));
});
