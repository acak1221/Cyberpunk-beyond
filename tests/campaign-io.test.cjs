// Campaign transfer: one file out, a checked file in, a preview first, and nothing replaced.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
// Values made inside the vm belong to another realm: compare them as plain data.
const eq=(a,b)=>assert.deepEqual(plain(a),plain(b));

// One page: the real modules the transfer leans on, and an app stub with a state, a save and a sheet import.
function load({state,saveResult={ok:true}}={}){
 const listeners={},notices=[];let saves=0,renders=0,n=0;
 const document={addEventListener(t,f){(listeners[t]||=[]).push(f)},querySelector:()=>null,querySelectorAll:()=>[]};
 const store=new Map(),storage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
 const window={document,crypto:{randomUUID:()=>'u-'+(++n)},confirm:()=>true,sessionStorage:storage,localStorage:storage};
 const ctx={window,document,globalThis:window,sessionStorage:storage,localStorage:storage,Math,Number,String,Array,Object,Set,Map,WeakMap,JSON,Date,Promise,RegExp,Error,Infinity,setTimeout,clearTimeout,console,TextEncoder,URL,Blob};
 for(const f of ['beat-chart.js','campaigns.js','gm-tools.js','gm-extras.js','npc-library.js','room-journal.js','campaign-io.js'])vm.runInNewContext(read(f),ctx,{filename:f});
 const st=state||{lang:'ru',characters:[],campaigns:[],gmExtras:undefined,gmWorkspace:window.GMTools.initial()};
 window.App={getState:()=>st,lang:()=>st.lang,save:()=>{saves++;return Promise.resolve(saveResult)},render:()=>{renders++},notify:m=>notices.push(m),
  findImport:obj=>{const c=st.characters.find(x=>x.extra?.uid&&x.extra.uid===obj?.extra?.uid);return c?{id:c.id,name:c.name}:null},
  importCharacter:obj=>{if(obj.role!=='solo')return {ok:false,reason:'invalid'};const id='new-'+(++n);st.characters=[{...plain(obj),id},...st.characters];return {ok:true,id}}};
 return {window,IO:window.CampaignIO,st,notices,listeners,saves:()=>saves,renders:()=>renders};
}
const sheet=(id,name,uid)=>({id,name,role:'solo',rank:4,stats:{},skills:{},hp:40,extra:{uid}});
function sample(){
 return {lang:'ru',characters:[sheet('pc-1','Ви','uid-v'),sheet('pc-2','Джеки','uid-j')],
  campaigns:[{id:'camp-1',name:'Арасака',notes:'Секрет ведущего',round:3,turnIndex:1,
   roster:[{id:'r1',kind:'pc',characterId:'pc-1',initiative:14,order:1},{id:'r2',kind:'npc',name:'Ганк 1',ref:6,hp:20,maxHp:25,initiative:9,order:2,sp:{head:4,body:4},body:5,combatNote:{version:1,text:'Нож'},sourceLibrary:'npc-lib1',hidden:true}],
   journal:[{id:'j2',at:2000,text:'Вторая запись',auto:false},{id:'j1',at:1000,text:'Первая запись',auto:true}],journalShared:['j2'],
   beats:[{id:'b1',kind:'hook',type:'crisis',note:'Звонок фиксера',done:true},{id:'b2',kind:'climax',type:'',note:'',done:false}]},
   {id:'camp-2',name:'Пустоши',notes:'',roster:[],round:1,turnIndex:0}],
  gmExtras:{clocks:[{id:'clk-1',name:'Погоня',size:6,filled:2,shared:true}],npcLibrary:[{id:'npc-lib1',name:'Ганк',ref:6,hp:25,head:4,torso:4,weapons:'Нож 1d6',notes:''}]},
  gmWorkspace:{time:'day',zone:'moderate',party:4,roll:null,roster:[{id:'g1',template:'bodyguard',name:'Телохранитель',hp:35,notes:'Ждёт у двери'}]}};
}

test('one file holds the whole campaign: roster, notes, Beat Chart, journal, clocks, NPC library, GM NPCs and the linked sheets',()=>{
 const {IO}=load(),st=sample(),file=IO.buildExport(st,{},Date.UTC(2046,0,2));
 assert.equal(file.format,'nightcity-red-campaign');assert.equal(file.version,1);assert.equal(file.exportedAt,'2046-01-02T00:00:00.000Z');
 eq(plain(file.campaigns),plain(st.campaigns));
 eq(plain(file.clocks),[{id:'clk-1',name:'Погоня',size:6,filled:2,shared:true}]);
 assert.equal(file.library[0].name,'Ганк');assert.equal(file.gmNpcs[0].notes,'Ждёт у двери');
 eq(file.sheets.map(s=>s.id),['pc-1']); // only the sheets the roster names
 file.campaigns[0].name='changed';assert.equal(st.campaigns[0].name,'Арасака'); // a copy, not the live data
 const one=IO.buildExport(st,{campaignIds:['camp-2'],clocks:false,library:false,gmNpcs:false,sheets:false});
 eq(Object.keys(one),['format','version','exportedAt','campaigns']);assert.equal(one.campaigns.length,1);
 assert.equal(IO.fileName(one.campaigns,Date.UTC(2046,0,2,12)),'nc-red-campaign-Пустоши-2046-01-02.json');
 assert.match(IO.fileName(st.campaigns,Date.UTC(2046,0,2,12)),/^nc-red-campaigns-2046-01-02\.json$/);
});

test('an exported file survives the round trip through a fresh browser',()=>{
 const from=load(),file=JSON.stringify(from.IO.buildExport(sample()));
 const to=load(),r=to.IO.parse(file);assert.equal(r.ok,true);
 const done=to.IO.apply(r.bundle,to.IO.defaultSelect(r.bundle),{lang:'ru',getState:()=>to.st,findImport:to.window.App.findImport,importCharacter:to.window.App.importCharacter});
 assert.equal(done.ok,true);eq(plain(done.counts),{campaigns:2,clocks:1,library:1,gmNpcs:1,sheets:1});
 const [a,b]=to.st.campaigns,src=sample().campaigns[0];
 assert.equal(a.name,'Арасака');assert.equal(a.notes,src.notes);assert.equal(a.round,3);assert.equal(a.turnIndex,1);assert.notEqual(a.id,'camp-1');
 eq(plain(a.journal),src.journal);eq(plain(a.beats),src.beats);eq(plain(a.journalShared),['j2']);
 // The player character came with its sheet and the roster place follows the sheet's new id.
 assert.equal(to.st.characters.length,1);assert.equal(a.roster[0].characterId,to.st.characters[0].id);assert.equal(to.st.characters[0].name,'Ви');
 const npc=a.roster[1];eq(plain({...npc,sourceLibrary:undefined}),plain({...src.roster[1],sourceLibrary:undefined}));
 assert.equal(npc.sourceLibrary,to.st.gmExtras.npcLibrary[0].id); // the NPC still points at its preset, under the preset's new id
 assert.equal(b.name,'Пустоши');
 eq(plain(to.st.gmExtras.clocks.map(c=>[c.name,c.size,c.filled,c.shared])),[['Погоня',6,2,false]]); // a clock never arrives already shown to players
 assert.equal(to.st.gmWorkspace.roster[0].notes,'Ждёт у двери');assert.ok(to.window.GMTools.validWorkspace(to.st.gmWorkspace));
 assert.ok(to.st.campaigns.every(to.IO.validCampaign));
});

test('nothing is overwritten: a taken name gets a number, an identical clock or preset is skipped, existing records stay',()=>{
 const {IO,st,window}=load({state:sample()}),before=plain(st),r=IO.parse(JSON.stringify(IO.buildExport(sample())));
 const deps={lang:'en',getState:()=>st,findImport:window.App.findImport,importCharacter:window.App.importCharacter},p=IO.plan(r.bundle,st,IO.defaultSelect(r.bundle),deps);
 eq(p.campaigns.map(c=>[c.name,c.finalName,c.renamed]),[['Арасака','Арасака (2)',true],['Пустоши','Пустоши (2)',true]]);
 eq(p.clocks.map(c=>c.status),['same']);eq(p.library.map(c=>c.status),['same']);eq(p.gmNpcs.map(c=>c.status),['same']);
 eq(p.sheets.map(s=>[s.status,s.target]),[['have','pc-1']]);assert.equal(p.campaigns[0].pcHave,1);
 eq(plain(st),before); // a plan changes nothing
 const done=IO.apply(r.bundle,IO.defaultSelect(r.bundle),deps);
 eq(plain(done.counts),{campaigns:2,clocks:0,library:0,gmNpcs:0,sheets:0});
 eq(plain(st.campaigns.slice(0,2)),before.campaigns);eq(plain(st.characters),before.characters);eq(plain(st.gmExtras),before.gmExtras);eq(plain(st.gmWorkspace),before.gmWorkspace);
 eq(st.campaigns.map(c=>c.name),['Арасака','Пустоши','Арасака (2)','Пустоши (2)']);assert.equal(new Set(st.campaigns.map(c=>c.id)).size,4);
 assert.equal(st.campaigns[2].roster[0].characterId,'pc-1');assert.equal(st.campaigns[2].roster[1].sourceLibrary,'npc-lib1');
 // A third time: the next free number.
 IO.apply(r.bundle,{...IO.defaultSelect(r.bundle),campaigns:[true,false]},deps);assert.equal(st.campaigns.at(-1).name,'Арасака (3)');assert.equal(st.campaigns.length,5);
});

test('a clock or preset that differs is added next to the old one under a numbered name; limits are respected',()=>{
 const {IO,st,window}=load({state:sample()}),file=IO.buildExport(sample());
 file.clocks[0].filled=5;file.library[0].hp=40;file.gmNpcs[0].hp=12;file.campaigns=[];
 for(let i=0;i<40;i++)file.clocks.push({id:'x'+i,name:'Часы '+i,size:4,filled:0});
 const r=IO.parse(JSON.stringify(file));assert.equal(r.ok,true);assert.equal(r.bundle.clocks.length,30);
 const done=IO.apply(r.bundle,IO.defaultSelect(r.bundle),{getState:()=>st});
 eq(plain(done.counts),{campaigns:0,clocks:29,library:1,gmNpcs:1,sheets:0});
 const clocks=window.GMExtras.readClocks(st);assert.equal(clocks.length,30);eq([clocks[0].name,clocks[0].filled,clocks[1].name,clocks[1].filled],['Погоня',2,'Погоня (2)',5]);assert.equal(new Set(clocks.map(c=>c.id)).size,30);
 eq(window.NpcLibrary.readLibrary(st).map(e=>[e.name,e.hp]),[['Ганк',25],['Ганк (2)',40]]);
 eq(st.gmWorkspace.roster.map(n=>[n.name,n.hp]),[['Телохранитель',35],['Телохранитель (2)',12]]);
 const p=IO.plan(r.bundle,st,IO.defaultSelect(r.bundle),{});assert.ok(p.clocks.every(c=>c.status==='same'||c.status==='limit'));assert.equal(p.total,0);
 assert.equal(IO.apply(r.bundle,IO.defaultSelect(r.bundle),{getState:()=>st}).reason,'nothing');
});

test('files that are not campaign files are refused with a reason',()=>{
 const {IO}=load();
 assert.equal(IO.parse('{oops').reason,'json');assert.equal(IO.parse('[1,2]').reason,'format');assert.equal(IO.parse('null').reason,'format');assert.equal(IO.parse(42).reason,'read');
 assert.equal(IO.parse(JSON.stringify({characters:[],campaigns:[],schemaVersion:3})).reason,'backup');
 assert.equal(IO.parse(JSON.stringify({format:'something-else',version:1,campaigns:[{}]})).reason,'format');
 assert.equal(IO.parse(JSON.stringify({format:IO.FORMAT,version:2,campaigns:[{name:'x'}]})).reason,'newer');
 for(const v of [0,-1,1.5,'1',null])assert.equal(IO.parse(JSON.stringify({format:IO.FORMAT,version:v,campaigns:[{name:'x'}]})).reason,'format');
 assert.equal(IO.parse(JSON.stringify({format:IO.FORMAT,version:1,campaigns:[],sheets:[{id:'a',name:'b',role:'solo'}]})).reason,'empty');
 assert.equal(IO.parse(JSON.stringify({format:IO.FORMAT,version:1,campaigns:'nope',clocks:{},library:7})).reason,'empty');
 assert.equal(IO.parse(' '.repeat(IO.MAX_FILE+1)).reason,'big');
});

test('a hostile file is rebuilt field by field: wrong types, huge values, markup and prototype keys do no harm',()=>{
 const {IO,st,window}=load();
 const evil=`{"format":"nightcity-red-campaign","version":1,"campaigns":[
  {"id":{"x":1},"name":"<img src=x onerror=alert(1)>\\u0000\\n  второй ряд","notes":123,"round":"много","turnIndex":999,"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},
   "roster":[null,7,"x",{"kind":"robot","id":"a"},{"kind":"npc"},{"id":"dup","kind":"npc","name":"${'Я'.repeat(500)}","ref":99,"hp":-5000,"maxHp":1e9,"initiative":"NaN","bonus":1e308,"ties":[1,"2",1e9,null],"held":"yes","out":true,"sp":{"head":"7","body":999},"body":0,"sourcePage":5000,"combatNote":{"version":9,"text":"${'z'.repeat(900)}"},"sourceLibrary":"../../etc","__proto__":{"polluted":true},"future":{"deep":{"deeper":{"deepest":{"lost":{"x":1}}}}},"fn":"javascript:alert(1)"},
     {"id":"dup","kind":"pc","characterId":["a"]},{"id":"${'i'.repeat(400)}","kind":"pc","characterId":"pc-9"}],
   "journal":[{"id":"j","at":"when","text":"ok"},{"id":"j","at":5,"text":"again"},{"text":""},"nope",{"text":{"a":1}}],"journalShared":["j","j","ghost",5],
   "beats":[{"kind":"hook","type":"not-a-type","note":7,"done":"yes"},{"kind":"explosion"},null]},
  "not a campaign",null,[]],
  "clocks":[{"id":"ok","name":"<b>bold</b>","size":6,"filled":99,"shared":true},{"id":"bad id!","name":"x","size":6},{"id":"s","name":"x","size":7}],
  "library":[{"id":"e1","name":"  Preset  ","ref":"12","hp":1e9,"skills":[{"name":"A","base":"x"}]},{"id":"e2","name":""}],
  "gmNpcs":[{"id":"n","template":"bodyguard","name":"Guard","hp":30,"notes":""},{"id":"n2","template":"dragon","name":"x","hp":1,"notes":""},{"template":"bodyguard","name":"x","hp":"30","notes":""}],
  "sheets":[{"id":"pc-9","name":"V","role":"wizard"},{"id":5,"name":"x","role":"solo"},"x"]}`;
 const r=IO.parse(evil);assert.equal(r.ok,true);
 const b=r.bundle,c=b.campaigns[0];assert.equal(b.campaigns.length,1);
 assert.equal(c.name,'<img src=x onerror=alert(1)> второй ряд');assert.equal(c.notes,'');assert.equal(c.round,1);assert.equal(c.turnIndex,3);assert.equal(typeof c.id,'string');
 assert.equal(({}).polluted,undefined);assert.equal(Object.prototype.hasOwnProperty.call(c,'__proto__'),false);assert.equal(Object.prototype.hasOwnProperty.call(c,'constructor'),false);
 eq(c.roster.map(x=>x.kind),['npc','npc','pc','pc']);assert.equal(new Set(c.roster.map(x=>x.id)).size,4);assert.ok(c.roster.every(x=>x.id.length<=160));
 const n=c.roster[1];
 assert.equal(c.roster[0].name,'NPC');assert.equal(n.name.length,100);assert.equal(n.ref,20);assert.equal(n.hp,-999);assert.equal(n.maxHp,999);assert.equal(n.initiative,0);assert.equal(n.bonus,99);
 eq(plain(n.ties),[1]);assert.equal(n.held,undefined);assert.equal(n.out,true);eq(plain(n.sp),{head:7,body:30});assert.equal(n.body,1);assert.equal(n.sourcePage,999);
 eq(plain(n.combatNote),{version:1,text:'z'.repeat(300)});assert.equal(n.sourceLibrary,undefined);
 assert.equal(Object.prototype.hasOwnProperty.call(n,'__proto__'),false);eq(plain(n.future),{deep:{deeper:{}}});assert.equal(n.fn,'javascript:alert(1)'); // unknown fields stay only as inert, bounded data
 assert.equal(c.roster[2].characterId,'');assert.equal(c.roster[3].characterId,'pc-9');
 eq(c.journal.map(e=>e.text),['ok','again']);assert.equal(new Set(c.journal.map(e=>e.id)).size,2);eq(plain(c.journalShared),['j']);
 eq(plain(c.beats.map(x=>[x.kind,x.type,x.note,x.done])),[['hook','','',false]]);
 eq(plain(b.clocks),[{name:'<b>bold</b>',size:6,filled:6}]);
 eq(b.library.map(e=>[e.name,e.ref,e.hp,e.skills]),[['Preset',12,999,undefined]]);
 eq(b.gmNpcs.map(x=>x.name),['Guard']);assert.equal(b.sheets.length,1);
 assert.ok(b.dropped>=12);
 // The app refuses the sheet (not a Role of the game): the roster place stays, without a sheet.
 const done=IO.apply(b,IO.defaultSelect(b),{lang:'ru',getState:()=>st,findImport:window.App.findImport,importCharacter:window.App.importCharacter});
 assert.equal(done.ok,true);assert.equal(done.sheetFailed,1);assert.equal(st.characters.length,0);assert.equal(st.campaigns[0].roster[3].characterId,'');
 assert.ok(IO.validCampaign(st.campaigns[0]));assert.ok(window.GMTools.validWorkspace(st.gmWorkspace));
 // What is drawn from it is escaped.
 const html=window.Campaigns.render(st.campaigns,st.characters,'ru',st.gmWorkspace);assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img src=x'));
});

test('only what is ticked in the preview is added',()=>{
 const {IO,st}=load(),r=IO.parse(JSON.stringify(IO.buildExport(sample())));
 const select={campaigns:[false,true],clocks:false,library:true,gmNpcs:false,sheets:false},p=IO.plan(r.bundle,st,select,{});
 eq(p.campaigns.map(c=>c.selected),[false,true]);eq(p.clocks.map(c=>c.status),['off']);eq(plain(p.counts),{campaigns:1,clocks:0,library:1,gmNpcs:0,sheets:0});
 IO.apply(r.bundle,select,{getState:()=>st});
 eq(st.campaigns.map(c=>c.name),['Пустоши']);assert.equal(st.gmExtras.clocks,undefined);assert.equal(st.gmExtras.npcLibrary.length,1);assert.equal(st.gmWorkspace.roster.length,0);
});

test('undo takes back exactly what an import added',()=>{
 const {IO,st}=load({state:sample()}),before=plain(st),file=IO.buildExport(sample());file.clocks[0].name='Другие';file.library[0].name='Другой';file.gmNpcs[0].name='Другой';file.sheets=[];
 const r=IO.parse(JSON.stringify(file)),done=IO.apply(r.bundle,IO.defaultSelect(r.bundle),{getState:()=>st});
 eq(plain(done.counts),{campaigns:2,clocks:1,library:1,gmNpcs:1,sheets:0});assert.notDeepEqual(plain(st),before);
 done.undo();eq(plain(st),before);
 const empty=load(),r2=empty.IO.parse(JSON.stringify(file)),d2=empty.IO.apply(r2.bundle,empty.IO.defaultSelect(r2.bundle),{getState:()=>empty.st}),was=plain(load().st);
 d2.undo();eq(plain(empty.st),was);assert.equal(empty.st.gmExtras,undefined);
});

test('the campaigns page gets the transfer card; a chosen file shows a preview and is added only on confirmation',async()=>{
 const page=load({state:sample()}),{IO,st,window}=page,list=window.Campaigns.render(st.campaigns,st.characters,'ru',st.gmWorkspace);
 let html=IO.decorate(list,st);
 assert.ok(html.startsWith(list));assert.match(html,/data-cio-action="export-all"/);assert.match(html,/data-cio-action="choose"/);assert.ok(!html.includes('data-cio-preview'));
 assert.equal(IO.decorate(list,{...st,lang:'en'}).includes('Export all campaigns'),true);
 assert.equal(IO.load('{"format":"x"}','bad.json'),false);assert.match(IO.decorate(list,st),/role="alert">Это не файл кампании/);assert.equal(st.campaigns.length,2);
 assert.equal(IO.load(JSON.stringify(IO.buildExport(sample())),'<b>my</b>.json'),true);
 html=IO.decorate(list,st);
 assert.match(html,/data-cio-preview/);assert.ok(html.includes('&lt;b&gt;my&lt;/b&gt;.json'));assert.ok(html.includes('будет добавлена как <b>«Арасака (2)»</b>'));assert.ok(html.includes('уже есть у вас, пропущено'));assert.ok(!html.includes('role="alert"'));
 assert.equal(st.campaigns.length,2); // a preview adds nothing
 const press=(type,target)=>page.listeners[type].forEach(f=>f({target}));
 press('change',{dataset:{cioPick:'c1'},checked:false});assert.ok(!IO.decorate(list,st).includes('Пустоши (2)'));
 press('click',{closest:s=>s==='[data-cio-action]'?{dataset:{cioAction:'apply'}}:null});await Promise.resolve();
 eq(st.campaigns.map(c=>c.name),['Арасака','Пустоши','Арасака (2)']);assert.equal(page.saves(),1);assert.match(page.notices.at(-1),/Импорт завершён\. Кампаний: 1/);
 assert.ok(!IO.decorate(list,st).includes('data-cio-preview'));
 // Cancel drops the preview without touching the data.
 IO.load(JSON.stringify(IO.buildExport(sample())),'again.json');press('click',{closest:s=>s==='[data-cio-action]'?{dataset:{cioAction:'cancel'}}:null});
 assert.ok(!IO.decorate(list,st).includes('data-cio-preview'));assert.equal(st.campaigns.length,3);
});

test('when the write does not fit, everything the import added is taken back',async()=>{
 const page=load({state:sample(),saveResult:{ok:false,reason:'storage'}}),{IO,st}=page,before=plain(st),file=IO.buildExport(sample());file.sheets=[];file.clocks[0].name='Новые';
 IO.load(JSON.stringify(file),'c.json');assert.equal(IO._test.applyNow(),true);assert.equal(st.campaigns.length,4);
 await new Promise(ok=>setTimeout(ok,0));
 eq(plain(st),before);assert.match(page.notices.at(-1),/Не удалось сохранить импорт/);
});

test('an open campaign gets its own file card and the journal for players, in both languages',()=>{
 const {IO,st,window}=load({state:sample()});
 window.Campaigns.handle({type:'click',target:{closest:s=>s==='[data-campaign-action]'?{dataset:{campaignAction:'open',id:'camp-1'}}:null}},{campaigns:st.campaigns,characters:st.characters,lang:'ru',save(){},render(){},notify(){}});
 const view=window.Campaigns.render(st.campaigns,st.characters,'ru',st.gmWorkspace);assert.match(view,/data-campaign-view="camp-1"/);
 const ru=IO.decorate(view,st),en=IO.decorate(view,{...st,lang:'en'});
 assert.match(ru,/data-cio-action="export-one" data-id="camp-1"/);assert.ok(!ru.includes('data-cio-action="choose"'));assert.match(ru,/data-rj-pick="camp-1"/);assert.ok(ru.includes('ЖУРНАЛ ДЛЯ ИГРОКОВ'));assert.ok(ru.includes('Экспорт этой кампании'));
 assert.ok(en.includes('JOURNAL FOR PLAYERS'));assert.ok(en.includes('Export this campaign'));
 assert.equal(IO.decorate('<p>other page</p>',null),'<p>other page</p>');
});

test('every text exists in Russian and in English, and Russian addresses the reader formally',()=>{
 const src=read('campaign-io.js')+read('room-journal.js'),keys=block=>[...block.matchAll(/[,{]([A-Za-z]+):/g)].map(m=>m[1]).sort().join();
 for(const file of ['campaign-io.js','room-journal.js']){const s=read(file),ru=/\n ru:\{([\s\S]*?)\},\n en:\{/.exec(s)[1],en=/\n en:\{([\s\S]*?)\},\n\};/.exec(s)[1];assert.equal(keys(ru),keys(en),file)}
 assert.ok(!/(^|[^А-Яа-яЁё])(ты|тебя|тебе|твой|твои|твоя)([^А-Яа-яЁё]|$)/i.test(src));
});
