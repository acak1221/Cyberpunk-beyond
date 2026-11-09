const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=n=>fs.readFileSync(__dirname+'/../site/'+n,'utf8'),plain=x=>JSON.parse(JSON.stringify(x)),eq=(a,b,m)=>assert.deepEqual(plain(a),plain(b),m);
const character=(id,extra={})=>({id,name:id,role:'solo',rank:4,stats:{INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{Handgun:2},hp:45,humanity:60,head:0,bodyArmor:0,...extra});
const broken=(id,extra={})=>character(id,{skills:{Evasion:11},...extra});
const pc=(id,characterId,initiative)=>({id,kind:'pc',characterId,initiative,order:0});
// Loads app.js with the given saved archive and a LocalStore stub that keeps set-aside copies in a Map.
function harness(archive,{copies={},answer=true,lang='en'}={}){
 const raw=archive===null||typeof archive==='string'?archive:JSON.stringify(archive);
 const events={},saved=[],notices=[],confirms=[],downloads=[],el=()=>({innerHTML:'',setAttribute(){},addEventListener(t,fn){events[t]=fn}}),nodes={'#app':el(),'#sync-root':el(),'#sync-adapter-status':el(),'#app-notice':{set textContent(v){notices.push(v)},classList:{add(){},remove(){}}}};
 let opts,uid=0,reply=answer;const store=new Map(Object.entries(copies)),kept=[];
 const adapter={stateLabel:()=>'',start(){},canEdit:()=>true,getScope:()=>'local',hasQueued:()=>false,save(s){saved.push(plain(s));return Promise.resolve({ok:true})},copies:()=>[...store.keys()].map(id=>({id,kind:id.includes('before-restore')?'before-restore':'recovery',at:null,size:store.get(id).length})),readCopy:id=>store.has(id)?store.get(id):null,removeCopy:id=>store.delete(id),keepBeforeRestore(snapshot){if(adapter.full)return false;for(const k of [...store.keys()])if(k.includes('before-restore'))store.delete(k);const id='nightcity-red-v1:before-restore:'+(kept.length+1);store.set(id,snapshot);kept.push(id);return id}};
 const ask=m=>{confirms.push(m);return typeof reply==='function'?reply(m):reply};
 const w={ROLES:[{id:'solo',name:{en:'Solo',ru:'Соло'},description:{en:'',ru:''}}],CombatTools:{handle:()=>false},Book:{handle:()=>false},Campaigns:{handle:()=>false,render:()=>''},NetTools:{setScope(){},validArchitectures:Array.isArray},RoleTools:{render:()=>'',handle:()=>({handled:false}),refresh(){}},LocalStore:{create(o){opts=o;return adapter}},confirm:ask,scrollTo(){}};
 const ctx={window:w,document:{querySelector:s=>nodes[s]||null,documentElement:{},title:'',createElement:()=>({click(){},remove(){}}),body:{appendChild(){}}},Blob:class{constructor(parts){this.text=parts.join('')}},URL:{createObjectURL:b=>{downloads.push(b.text);return 'blob:x'},revokeObjectURL(){}},localStorage:{getItem:k=>k==='nightcity-red-v1'?raw:null,setItem(){}},globalThis:{crypto:{randomUUID:()=>'id-'+(++uid)}},confirm:ask,setTimeout:()=>0,clearTimeout(){},console,Math,Date,JSON,Set,Map,Number,String,Array,Object,Promise,WeakMap};
 vm.createContext(ctx);for(const f of ['character-extra.js','equipment-tools.js'])vm.runInContext(source(f),ctx);
 vm.runInContext(source('app.js')+`\nrender=()=>{};state.lang=${JSON.stringify(lang)};window.qa={state:()=>state,snapshot:snapshotAppState,validate:validateSnapshot,salvage:salvageArchive,restoreFromBin,setAside:handleSetAside,charactersPage:()=>characters(),backupStrip:()=>backupStrip(),go:(v,id)=>{state.view=v;state.active=id}};`,ctx);
 const fileTarget=(id,data)=>{const target={id,files:[{text:async()=>typeof data==='string'?data:JSON.stringify(data)}],value:'x',isConnected:true,dataset:{}};nodes['#'+id]=target;w.qa.go('characters',null);return target};
 return {w,qa:w.qa,opts:()=>opts,adapter,saved,notices,confirms,store,kept,downloads,html:()=>w.qa.charactersPage(),strip:()=>w.qa.backupStrip(),answer:a=>reply=a,
  click:action=>events.click({type:'click',target:{closest:s=>s==='[data-action]'?{dataset:{action}}:null}}),
  change:(id,data)=>events.change({type:'change',target:fileTarget(id,data)}),
  setAside:(action,id='')=>w.qa.setAside({dataset:{setAside:action,id}})};
}

test('one unreadable character no longer hides the archive: the rest opens and the broken one is set aside verbatim',()=>{
 const bad=broken('c',{name:'Third',future:{keep:[1]}}),archive={characters:[character('a'),bad,character('b')],campaigns:[{id:'k',name:'Camp',roster:[pc('r1','a',10)]}],lang:'en',history:[{total:7}]};
 const h=harness(archive),issue=h.opts().initialIssue;
 assert.equal(issue.kind,'partial');assert.equal(issue.raw,JSON.stringify(archive));eq(plain(issue.summary),{characters:['Third'],campaigns:[],sections:0});
 const state=h.qa.state();eq(state.characters.map(c=>c.id),['a','b']);assert.equal(state.campaigns.length,1);assert.equal(state.history[0].total,7);
 assert.equal(state.quarantine.length,1);assert.equal(state.quarantine[0].kind,'character');eq(plain(state.quarantine[0].data),bad);
 assert.equal(h.saved.length,0,'loading never writes');
 const snap=plain(h.qa.snapshot());assert.equal(snap.schemaVersion,1);eq(snap.quarantine[0].data,bad);assert.equal(h.qa.validate(snap),true);
});

test('every record of a damaged archive ends up either open or set aside',()=>{
 const archive={characters:[character('a'),broken('b'),character('a',{name:'Same id'}),{name:'No id',role:'solo',stats:character('x').stats,skills:{}},'junk'],campaigns:[{id:'k1',name:'Fine',roster:[]},{id:'k2',name:'No roster'},{id:'k1',name:'Same id',roster:[]}],history:'not a list',diceValues:[1],gmExtras:{ok:true},future:{kept:true}};
 const h=harness(archive),s=h.qa.state(),snap=plain(h.qa.snapshot());
 eq(s.characters.map(c=>c.name),['a','Same id','No id']);assert.equal(new Set(s.characters.map(c=>c.id)).size,3);assert.equal(s.characters[0].id,'a');
 eq(s.campaigns.map(c=>c.name),['Fine','Same id']);assert.notEqual(s.campaigns[1].id,'k1');
 const held=Object.fromEntries(s.quarantine.map(q=>[q.kind+':'+(q.key||q.name||typeof q.data),q.data]));
 eq(plain(held['character:b']),broken('b'));assert.equal(held['character:string'],'junk');eq(plain(held['campaign:No roster']),{id:'k2',name:'No roster'});
 assert.equal(held['section:history'],'not a list');eq(held['section:diceValues'],[1]);
 assert.equal(s.quarantine.length,5);eq(snap.history,[]);eq(snap.gmExtras,{ok:true});eq(snap.future,{kept:true});
 assert.equal(h.qa.validate(snap),true);
 // Reading the saved result again is stable: nothing new is set aside and nothing comes back by mistake.
 const again=h.qa.salvage(snap);assert.equal(again.items.length,0);assert.equal(again.snapshot.quarantine.length,5);assert.equal(again.snapshot.characters.length,3);
});

test('a downloaded original that cannot be parsed, or is not an archive, still fails closed',()=>{
 for(const raw of ['{broken','null','[]','"text"',JSON.stringify({campaigns:[]}),JSON.stringify({characters:{}}),JSON.stringify({characters:[],schemaVersion:-1})]){const h=harness(raw);assert.equal(h.opts().initialIssue.kind,'unreadable',raw);assert.equal(h.opts().initialIssue.raw,raw);assert.equal(h.qa.state().characters.length,0)}
});

test('an archive from a newer app version is left alone and editing is paused',()=>{
 const raw=JSON.stringify({schemaVersion:2,characters:[character('a')],campaigns:[]}),h=harness(raw);
 assert.equal(h.opts().initialIssue.kind,'newer');assert.equal(h.qa.state().characters.length,0);
 assert.equal(h.opts().isNewer(JSON.parse(raw)),true);assert.equal(h.opts().isNewer({schemaVersion:1}),false);assert.equal(h.qa.validate(JSON.parse(raw)),false);
});

test('schema 0 → 1 migration drops initiative entries of characters deleted earlier and keeps the current turn',()=>{
 const roster=[pc('r1','a',20),pc('gone','deleted-long-ago',15),pc('r3','b',10),{id:'n1',kind:'npc',name:'Goon',ref:5,initiative:5}];
 const h=harness({characters:[character('a'),broken('b')],campaigns:[{id:'k',name:'K',round:2,turnIndex:2,roster}]}),k=h.qa.state().campaigns[0];
 eq(k.roster.map(r=>r.id),['r1','r3','n1'],'the set-aside character keeps its place');assert.equal(k.turnIndex,1);assert.equal(h.qa.snapshot().schemaVersion,1);
 const current=h.qa.salvage({schemaVersion:1,characters:[character('a')],campaigns:[{id:'k',name:'K',roster:[pc('x','missing',1)]}]});
 assert.equal(current.snapshot.campaigns[0].roster.length,1,'migrations run only for older data');
});

test('records set aside earlier come back once they read correctly',()=>{
 const archive={schemaVersion:1,characters:[character('a')],campaigns:[],quarantine:[{id:'q1',kind:'character',name:'b',at:1,data:character('b')},{id:'q2',kind:'character',name:'a again',at:1,data:character('a')},{id:'q3',kind:'section',key:'history',at:1,data:'x'}]};
 const h=harness(archive),s=h.qa.state();
 assert.equal(h.opts().initialIssue,null);eq(s.characters.map(c=>c.id),['a','b']);eq(s.quarantine.map(q=>q.id),['q2','q3']);
});

test('deleting moves the character to the bin, clears it from every roster and keeps the turn order sane',async()=>{
 const campaigns=[{id:'k1',name:'One',round:3,turnIndex:1,roster:[pc('r1','a',20),pc('r2','b',15),pc('r3','c',10)]},{id:'k2',name:'Two',turnIndex:0,roster:[pc('s1','b',9),{id:'s2',kind:'npc',name:'Goon',initiative:12}]},{id:'k3',name:'Three',turnIndex:1,roster:[pc('t1','a',5),pc('t2','c',4)]}];
 const h=harness({characters:[character('a'),character('b'),character('c')],campaigns});
 h.qa.go('sheet','b');await h.click('delete');
 const s=h.qa.state();assert.match(h.confirms[0],/bin/);eq(s.characters.map(c=>c.id),['a','c']);assert.equal(s.view,'characters');
 eq(s.campaigns[0].roster.map(r=>r.id),['r1','r3']);assert.equal(s.campaigns[0].turnIndex,1,'the turn passes to the next participant');
 eq(s.campaigns[1].roster.map(r=>r.id),['s2']);assert.equal(s.campaigns[1].turnIndex,0,'the current NPC keeps the turn');
 assert.equal(s.campaigns[2].turnIndex,1,'campaigns without the character are untouched');
 assert.equal(s.bin.length,1);assert.equal(s.bin[0].character.id,'b');assert.equal(s.bin[0].roster.length,2);
 const saved=h.saved.at(-1);assert.equal(saved.bin[0].character.id,'b');assert.ok(saved.campaigns.every(k=>k.roster.every(r=>r.characterId!=='b')));assert.match(h.notices.at(-1),/“b” was moved to the bin/);
 // Undo puts the character and its initiative places back; b held the turn and r3 that inherited it still has it, so the turn goes back to b.
 const r=h.qa.restoreFromBin(s.bin[0].id);assert.equal(r.ok,true);
 const back=h.qa.state();eq(back.characters.map(c=>c.id),['a','b','c']);eq(back.campaigns[0].roster.map(r=>r.id),['r1','r2','r3']);assert.equal(back.campaigns[0].roster[1].characterId,'b');
 assert.equal(back.campaigns[0].turnIndex,1,'the turn goes back to b');eq(back.campaigns[1].roster.map(r=>r.id),['s1','s2']);assert.equal(back.campaigns[1].turnIndex,0);
 assert.equal(back.bin.length,0);assert.equal(h.qa.restoreFromBin('nope').reason,'missing');
});

test('the bin is restorable from the characters page, survives a reload and expires after 30 days',()=>{
 const now=Date.now(),old=now-31*864e5,entry=(id,at)=>({id:'bin-'+id,at,index:0,character:character(id),roster:[]});
 const h=harness({schemaVersion:1,characters:[character('a',{id:'live'})],campaigns:[],bin:[entry('fresh',now-864e5),entry('stale',old)]});
 eq(h.qa.state().bin.map(e=>e.id),['bin-fresh']);
 h.qa.go('characters',null);assert.match(h.html(),/data-set-aside="bin-restore" data-id="bin-fresh"/);assert.match(h.html(),/days left: 29/);
 h.setAside('bin-restore','bin-fresh');eq(h.qa.state().characters.map(c=>c.id),['fresh','live']);assert.equal(h.saved.at(-1).bin,undefined);
 // A restored character whose id is now taken gets a new one together with its roster entries.
 const clash=harness({schemaVersion:1,characters:[character('a')],campaigns:[{id:'k',name:'K',roster:[]}],bin:[{id:'e',at:now,index:5,character:character('a',{name:'Old A'}),roster:[{campaignId:'k',index:0,entry:pc('r','a',3)},{campaignId:'gone',index:0,entry:pc('r9','a',1)}]}]});
 const r=clash.qa.restoreFromBin('e'),s=clash.qa.state();assert.notEqual(r.id,'a');assert.equal(s.characters[1].id,r.id);assert.equal(s.campaigns[0].roster[0].characterId,r.id);
 // Permanent deletion asks first.
 const purge=harness({schemaVersion:1,characters:[],campaigns:[],bin:[entry('x',now)]});purge.answer(false);purge.setAside('bin-purge','bin-x');assert.equal(purge.qa.state().bin.length,1);
 purge.answer(true);purge.setAside('bin-purge','bin-x');assert.equal(purge.qa.state().bin.length,0);assert.equal(purge.saved.length,1);
});

test('the downloaded original archive can be restored: what is readable opens, the rest is set aside, and undo is offered',async()=>{
 const original={characters:[character('a',{name:'First'}),character('b',{name:'Second'}),broken('c',{name:'Third'})],campaigns:[],lang:'en'};
 const h=harness({schemaVersion:1,characters:[character('mine')],campaigns:[],lang:'en'});
 await h.change('restore-backup',original);
 assert.match(h.confirms[0],/Restore the complete backup/);assert.match(h.confirms[0],/cannot be read \(characters: 1\)/);
 const s=h.qa.state();eq(s.characters.map(c=>c.name),['First','Second']);assert.equal(s.quarantine[0].name,'Third');
 assert.equal(h.kept.length,1);eq(JSON.parse(h.store.get(h.kept[0])).characters.map(c=>c.id),['mine']);assert.equal(h.saved.length,1);
 // Undo of the restore (the notice button and the Characters page do the same) brings the old data back and keeps the restored data as the new snapshot.
 h.setAside('copy-revert',h.kept[0]);assert.match(h.confirms.at(-1),/Replace the current data/);
 eq(h.qa.state().characters.map(c=>c.id),['mine']);assert.equal(h.kept.length,2);eq(JSON.parse(h.store.get(h.kept[1])).characters.map(c=>c.name),['First','Second']);
});

test('a full restore without room for the snapshot asks before continuing',async()=>{
 const h=harness({schemaVersion:1,characters:[character('mine')],campaigns:[]});h.adapter.full=true;h.answer(m=>!/storage is full/.test(m));
 await h.change('restore-backup',{format:'nightcity-red-backup',version:1,characters:[character('x')],campaigns:[]});
 assert.match(h.confirms.at(-1),/storage is full/);eq(h.qa.state().characters.map(c=>c.id),['mine']);assert.equal(h.saved.length,0);
 const newer=harness({schemaVersion:1,characters:[character('mine')],campaigns:[]});await newer.change('restore-backup',{format:'nightcity-red-backup',version:2,characters:[]});
 assert.match(newer.notices.at(-1),/newer version/);assert.equal(newer.confirms.length,0);
});

test('the downloaded original archive can be added with Import backup and with Import',async()=>{
 const original={characters:[character('a',{name:'First'}),broken('c',{name:'Third'})],campaigns:[{id:'k',name:'Camp',roster:[pc('r1','a',5),pc('r2','c',4)]}],lang:'en'};
 for(const input of ['import-backup','import-file']){
  const h=harness({schemaVersion:1,characters:[character('mine')],campaigns:[]});await h.change(input,original);
  const s=h.qa.state();eq(s.characters.map(c=>c.name),['First','mine'],input);assert.equal(s.campaigns.length,1);
  eq(s.campaigns[0].roster.map(r=>r.characterId),[s.characters[0].id],'entries of characters that were not imported are dropped');
  assert.match(h.notices.at(-1),/Added characters: 1, campaigns: 1\. Skipped unreadable records: 1/);assert.equal(h.saved.length,1);
 }
 const nothing=harness({schemaVersion:1,characters:[],campaigns:[]});await nothing.change('import-backup',{characters:[broken('c')],campaigns:[]});
 assert.match(nothing.notices.at(-1),/Nothing in the file can be read/);assert.equal(nothing.saved.length,0);
});

test('recovery copies offer “recover what is readable” and add it next to the current data',()=>{
 const legacy=JSON.stringify({characters:[character('a',{name:'Lost one'}),broken('b')],campaigns:[]});
 const h=harness({schemaVersion:1,characters:[character('mine')],campaigns:[]},{copies:{'nightcity-red-v1:recovery':legacy,'nightcity-red-v1:recovery:2':'{broken'}});
 h.qa.go('characters',null);assert.match(h.html(),/Recover what is readable/);assert.match(h.html(),/Copy from an earlier app version/);
 h.setAside('copy-recover','nightcity-red-v1:recovery');assert.match(h.confirms.at(-1),/characters: 1, campaigns: 0/);
 eq(h.qa.state().characters.map(c=>c.name),['Lost one','mine']);assert.equal(h.store.has('nightcity-red-v1:recovery'),true,'the copy stays until the user deletes it');
 h.setAside('copy-recover','nightcity-red-v1:recovery:2');assert.match(h.notices.at(-1),/Nothing in this copy can be read/);
 h.answer(false);h.setAside('copy-drop','nightcity-red-v1:recovery:2');assert.equal(h.store.has('nightcity-red-v1:recovery:2'),true);
 h.answer(true);h.setAside('copy-drop','nightcity-red-v1:recovery:2');assert.equal(h.store.has('nightcity-red-v1:recovery:2'),false);
});

test('set-aside records are listed and can be deleted after confirmation',()=>{
 const h=harness({characters:[character('a'),broken('b',{name:'<b>x</b>'})],campaigns:[]},{lang:'ru'});
 h.qa.go('characters',null);const html=h.html();assert.match(html,/Нечитаемые записи/);assert.match(html,/Персонаж «&lt;b&gt;x&lt;\/b&gt;»/);assert.doesNotMatch(html,/<b>x<\/b>/);
 const id=h.qa.state().quarantine[0].id;h.answer(false);h.setAside('held-drop',id);assert.equal(h.qa.state().quarantine.length,1);
 h.answer(true);h.setAside('held-drop',id);assert.equal(h.qa.state().quarantine.length,0);assert.equal(h.saved.at(-1).quarantine,undefined);
});

test('the overview reminder comes after 7 days instead of 14 while the browser may evict data',()=>{
 const h=harness({schemaVersion:1,characters:[character('a')],campaigns:[]});const eightDays=new Date(Date.now()-8*864e5).toISOString();
 h.adapter.lastBackup=()=>eightDays;h.adapter.persistence=()=>'granted';assert.match(h.strip(),/backup-strip "/);assert.doesNotMatch(h.strip(),/storage-hint/);
 h.adapter.persistence=()=>'denied';assert.match(h.strip(),/backup-strip warn/);assert.match(h.strip(),/may clear site data/);assert.match(h.strip(),/data-set-aside="hint-dismiss"/);
 h.w.PWA={isStandalone:()=>false,isIOS:()=>true,canInstall:()=>false};assert.match(h.strip(),/Add the app to the Home Screen/);
 h.w.PWA.isStandalone=()=>true;assert.doesNotMatch(h.strip(),/storage-hint/);assert.match(h.strip(),/backup-strip "/);
});

test('undo gives the turn back only while the participant that inherited it still has it in the same round',async()=>{
 const make=(turnIndex,roster=[pc('r1','a',20),pc('r2','b',15),pc('r3','c',10)])=>harness({schemaVersion:1,characters:[character('a'),character('b'),character('c')],campaigns:[{id:'k',name:'K',round:2,turnIndex,roster}]});
 const current=h=>{const k=h.qa.state().campaigns[0];return [...k.roster].sort((x,y)=>y.initiative-x.initiative)[k.turnIndex]?.characterId},del=async(h,id)=>{h.qa.go('sheet',id);await h.click('delete');return h.qa.state().bin[0].id};
 // The GM moved on after the delete: the turn stays where it is now.
 let h=make(1),id=await del(h,'b');assert.equal(current(h),'c');Object.assign(h.qa.state().campaigns[0],{turnIndex:0,round:3});
 h.qa.restoreFromBin(id);assert.equal(current(h),'a');
 // The heir has the turn again, but in a later round: it keeps it.
 h=make(1);id=await del(h,'b');h.qa.state().campaigns[0].round=3;h.qa.restoreFromBin(id);assert.equal(current(h),'c');
 // The last in order held the turn: deleting passes it back to b, undo gives it to c again.
 h=make(2);id=await del(h,'c');assert.equal(current(h),'b');h.qa.restoreFromBin(id);assert.equal(current(h),'c');assert.equal(h.qa.state().campaigns[0].turnIndex,2);
 // The only participant: the roster is empty until undo.
 h=make(0,[pc('r1','a',5)]);id=await del(h,'a');eq(h.qa.state().campaigns[0].roster,[]);h.qa.restoreFromBin(id);assert.equal(current(h),'a');
 // The bin entry keeps this across a reload, and the Characters page restores it the same way.
 h=make(1);await del(h,'b');const reloaded=harness(h.saved.at(-1));assert.equal(current(reloaded),'c');
 reloaded.setAside('bin-restore',reloaded.qa.state().bin[0].id);assert.equal(current(reloaded),'b');eq(reloaded.saved.at(-1).campaigns[0].roster.map(r=>r.id),['r1','r2','r3']);
});

test('a full restore that does not fit next to its snapshot asks, then gives up the snapshot or keeps the data as it was',async()=>{
 const file={format:'nightcity-red-backup',version:1,characters:[character('x',{name:'From file'})],campaigns:[]},mine=()=>harness({schemaVersion:1,characters:[character('mine')],campaigns:[]});
 // Normal case: written at once, undo offered.
 const fine=mine();let writes=0;fine.adapter.flush=()=>{writes++;return {ok:true}};await fine.change('restore-backup',file);
 assert.equal(writes,1);assert.equal(fine.store.size,1);assert.match(fine.notices.at(-1),/Backup restored/);
 // It fits only without the snapshot and the user agrees to lose undo.
 const yes=mine();yes.adapter.flush=()=>({ok:yes.store.size===0,reason:'storage'});await yes.change('restore-backup',file);
 assert.match(yes.confirms.at(-1),/storage is full/);assert.equal(yes.store.size,0,'the snapshot is given up');eq(yes.qa.state().characters.map(c=>c.name),['From file']);
 eq(yes.saved.at(-1).characters.map(c=>c.id),['x']);assert.doesNotMatch(yes.notices.at(-1),/Backup restored|Nothing was replaced/);
 // The user declines: the snapshot is removed and the data in memory goes back to what is stored.
 const no=mine();no.adapter.flush=()=>({ok:no.store.size===0,reason:'storage'});no.answer(m=>!/storage is full/.test(m));await no.change('restore-backup',file);
 eq(no.qa.state().characters.map(c=>c.id),['mine']);assert.equal(no.store.size,0);eq(no.saved.at(-1).characters.map(c=>c.id),['mine']);assert.match(no.notices.at(-1),/Nothing was replaced: browser storage is full/);
 // Nothing fits even without the snapshot.
 const never=mine();never.adapter.flush=()=>({ok:false,reason:'storage'});await never.change('restore-backup',file);
 eq(never.qa.state().characters.map(c=>c.id),['mine']);assert.equal(never.store.size,0);assert.match(never.notices.at(-1),/Nothing was replaced/);
 // Undo of a restore is written the same way.
 fine.adapter.flush=()=>({ok:fine.store.size===0,reason:'storage'});fine.setAside('copy-revert',fine.kept[0]);
 eq(fine.qa.state().characters.map(c=>c.id),['mine']);assert.equal(fine.store.size,0);assert.match(fine.notices.at(-1),/snapshot data is back/);
});

test('set-aside data sections are listed by name in both languages',()=>{
 for(const [lang,re] of [['ru',/Раздел данных «История бросков»/],['en',/Data section “Roll history”/]]){const h=harness({characters:[character('a')],campaigns:[],history:'x'},{lang});h.qa.go('characters',null);assert.match(h.html(),re,lang);assert.doesNotMatch(h.html(),/«history»|“history”/,lang)}
 const h=harness({schemaVersion:1,characters:[],campaigns:[],quarantine:[{id:'q1',kind:'section',key:'futureThing',at:1,data:1},{id:'q2',kind:'section',key:'constructor',at:1,data:1},{id:'q3',kind:'section',at:1,data:1}]});
 h.qa.go('characters',null);const html=h.html();assert.match(html,/Data section “futureThing”/);assert.match(html,/Data section “constructor”/);assert.match(html,/Data section “—”/);
});

test('set-aside sections come back through Import backup once fixed, asking before they replace data',async()=>{
 const h=harness({characters:[character('a')],campaigns:[],history:'x',netArchitectures:7,gmExtras:[1],lang:'en'}),keys=()=>h.qa.state().quarantine.map(q=>q.key).sort();
 eq(keys(),['gmExtras','history','netArchitectures']);
 h.setAside('held-download');const file=JSON.parse(h.downloads.at(-1));eq(file.setAside.map(q=>q.key).sort(),keys());
 // The download as it is: nothing reads, so nothing is added and nothing is written.
 await h.change('import-backup',file);assert.match(h.notices.at(-1),/Nothing in the file can be read/);eq(keys(),['gmExtras','history','netArchitectures']);assert.equal(h.saved.length,0);
 // Fixed history goes back without a question (it is empty now); NET architectures already hold data, so the user is asked.
 h.qa.state().netArchitectures.push({id:'mine'});const fixed={...file,setAside:file.setAside.map(q=>q.key==='history'?{...q,data:[{total:5}]}:q.key==='netArchitectures'?{...q,data:[{id:'fixed'}]}:q)};
 h.answer(false);await h.change('import-backup',fixed);
 assert.match(h.confirms.at(-1),/Replace “NET architectures” with the data from the file/);eq(h.qa.state().history,[{total:5}]);eq(h.qa.state().netArchitectures,[{id:'mine'}]);eq(keys(),['gmExtras','netArchitectures']);
 assert.match(h.notices.at(-1),/Skipped unreadable records: 1 .*Data sections brought back: 1\./);
 h.answer(true);await h.change('import-file',fixed);
 eq(h.qa.state().netArchitectures,[{id:'fixed'}]);eq(keys(),['gmExtras']);eq(h.saved.at(-1).netArchitectures,[{id:'fixed'}]);eq(h.saved.at(-1).history,[{total:5}]);assert.equal(h.saved.at(-1).quarantine.length,1);
 // Restoring the download completely keeps its sections set aside instead of saving them under an unknown key.
 const r=harness({schemaVersion:1,characters:[character('mine')],campaigns:[]});await r.change('restore-backup',file);
 assert.equal('setAside' in r.saved.at(-1),false);eq(r.saved.at(-1).quarantine.map(q=>q.key).sort(),['gmExtras','history','netArchitectures']);
});

test('a set-aside campaign imported back after a fix keeps its links to characters in this browser',async()=>{
 const h=harness({characters:[character('a')],campaigns:[{id:'k',name:'Camp',roster:[pc('r1','a',5),{kind:'npc',name:'Goon'}]}],lang:'en'});
 assert.equal(h.qa.state().quarantine[0].kind,'campaign');h.setAside('held-download');const file=JSON.parse(h.downloads.at(-1));
 file.campaigns[0].roster[1].id='r2';await h.change('import-backup',file);
 const k=h.qa.state().campaigns[0];eq(k.roster.map(r=>r.kind==='pc'?r.characterId:r.name),['a','Goon']);assert.match(h.notices.at(-1),/Backup added/);
});
