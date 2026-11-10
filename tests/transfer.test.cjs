const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=n=>fs.readFileSync(path.join(__dirname,'..','site',n),'utf8'),plain=x=>JSON.parse(JSON.stringify(x));
const te=new TextEncoder(),td=new TextDecoder();
const character=(id,extra={})=>({id,name:id,role:'solo',rank:4,stats:{INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{Handgun:2},hp:45,humanity:60,head:0,bodyArmor:0,...extra});
const pc=(id,characterId)=>({id,kind:'pc',characterId,initiative:10,order:0});

// Transfer on its own: a window with storage, crypto and (optionally) the app's archive API.
function load({store=new Map(),app=null}={}){
 const listeners={};
 const document={addEventListener(t,f){(listeners[t]||(listeners[t]=[])).push(f)},querySelector:()=>null,visibilityState:'visible'};
 const window={document,App:app,crypto:globalThis.crypto,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>{store.set(k,String(v))},removeItem:k=>store.delete(k)},addEventListener(){},navigator:{},setTimeout,clearTimeout,CompressionStream,DecompressionStream,Response,Blob};
 vm.runInNewContext(source('transfer.js'),{window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Error,console});
 return {T:window.Transfer,window,store,listeners};
}
const T=load().T;

test('the plan tells new, identical, updated and locally newer sheets apart without touching either archive',()=>{
 const local={characters:[character('a',{extra:{uid:'ua',updatedAt:100}}),character('b',{extra:{uid:'ub',updatedAt:500}}),character('c',{extra:{uid:'uc'}}),character('only',{name:'Only here',extra:{uid:'uo'}})],campaigns:[]};
 const incoming={characters:[
  character('x1',{name:'a',extra:{uid:'ua',updatedAt:100,sourceKey:'link:ua'}}), // same sheet under another local id
  character('x2',{name:'b',hp:10,extra:{uid:'ub',updatedAt:300}}),             // older than the local one
  character('x3',{name:'c',hp:11,extra:{uid:'uc',updatedAt:50}}),              // local has no edit time: the archive wins
  character('x4',{name:'New one',extra:{uid:'un'}})],campaigns:[]};
 const before=JSON.stringify([local,incoming]),p=T.plan(local,incoming);
 assert.equal(JSON.stringify([local,incoming]),before);
 assert.deepEqual(plain(p.characters.map(c=>[c.name,c.kind,c.localId||null])),[['a','same','a'],['b','keep','b'],['c','update','c'],['New one','new',null]]);
 assert.deepEqual(plain(p.localOnly),['Only here']);
 assert.deepEqual(plain([p.counts.add,p.counts.update,p.counts.same,p.counts.keep,p.counts.localOnly,p.changes]),[1,1,1,1,1,2]);
});

test('the plan is the same whatever order the fields were written in, and its signature follows the data',()=>{
 const a=character('a',{extra:{uid:'u',gear:[{n:1,q:2}]}}),b={extra:{gear:[{q:2,n:1}],uid:'u'}};for(const k of Object.keys(a).reverse())if(k!=='extra')b[k]=a[k];
 const p=T.plan({characters:[a],campaigns:[]},{characters:[b],campaigns:[]});
 assert.equal(p.characters[0].kind,'same');assert.equal(p.changes,0);
 const q=T.plan({characters:[character('a',{hp:1,extra:{uid:'u'}})],campaigns:[]},{characters:[b],campaigns:[]});
 assert.equal(q.characters[0].kind,'update');assert.notEqual(q.sig,p.sig);
 // Two archive sheets with one uid never both claim the same local sheet.
 const twice=T.plan({characters:[a],campaigns:[]},{characters:[a,{...a,id:'dup'}],campaigns:[]});
 assert.deepEqual(plain(twice.characters.map(c=>c.kind)),['same','new']);
});

test('campaigns match by content with player characters named by uid; a changed one with a known name is added as a copy',()=>{
 const local={characters:[character('mine',{extra:{uid:'u1'}})],campaigns:[{id:'k1',name:'Night',notes:'',roster:[pc('r1','mine')]},{id:'k2',name:'Other',notes:'old',roster:[]}]};
 const incoming={characters:[character('theirs',{name:'mine',extra:{uid:'u1'}})],campaigns:[
  {id:'z1',name:'Night',roster:[pc('q9','theirs')]},{id:'z2',name:'Other',notes:'new',roster:[]},{id:'z3',name:'Fresh',roster:[]},{id:'z4',name:'Broken'}]};
 const p=T.plan(local,incoming,{campaignOk:k=>Array.isArray(k.roster)});
 assert.deepEqual(plain(p.campaigns.map(c=>[c.name,c.kind])),[['Night','same'],['Other','copy'],['Fresh','new'],['Broken','skip']]);
 assert.deepEqual(plain([p.counts.campaignsAdd,p.counts.campaignsCopy,p.counts.campaignsSame,p.counts.campaignsSkip]),[2,1,1,1]);
});

test('sections are filled only where this device has nothing of its own',()=>{
 const p=T.plan({characters:[],campaigns:[],netArchitectures:[],gmExtras:{clocks:[1]}},{characters:[],campaigns:[],netArchitectures:[{id:'n'}],gmExtras:{clocks:[2]},gmWorkspace:{}});
 assert.deepEqual(plain(p.sections),[{key:'netArchitectures',kind:'fill'},{key:'gmExtras',kind:'keep'}]);assert.equal(p.changes,1);
 const same=T.plan({characters:[],campaigns:[],gmExtras:{clocks:[2]}},{characters:[],campaigns:[],gmExtras:{clocks:[2]}});
 assert.deepEqual(plain(same.sections),[{key:'gmExtras',kind:'same'}]);assert.equal(same.changes,0);
});

test('the reminder is due with no backup, after N days or N changes, and can wait or be switched off',()=>{
 const now=Date.parse('2026-05-20T12:00:00Z'),ago=d=>new Date(now-d*864e5).toISOString(),meta=x=>T._test.cleanMeta(x),R=o=>plain(T.reminder({now,...o}));
 assert.equal(R({last:null}).reason,'never');assert.equal(R({last:null}).due,true);
 assert.equal(R({last:null,hasData:false}).due,false,'an empty archive needs no backup');
 assert.equal(R({last:ago(3)}).due,false);assert.equal(R({last:ago(3)}).days,3);
 assert.equal(R({last:ago(14)}).reason,'days');
 assert.equal(R({last:ago(8),risk:true}).reason,'days','a browser that may evict data is asked after a week');
 assert.equal(R({last:ago(8),meta:meta({days:30}),risk:false}).due,false);
 assert.equal(R({last:ago(1),meta:meta({changes:T._test.CHANGES_DUE-1})}).due,false);
 assert.equal(R({last:ago(1),meta:meta({changes:T._test.CHANGES_DUE})}).reason,'changes');
 const waiting=R({last:ago(20),meta:meta({snoozeUntil:now+1000})});assert.equal(waiting.due,false);assert.equal(waiting.snoozed,true);assert.equal(waiting.reason,'days');
 assert.equal(R({last:ago(20),meta:meta({snoozeUntil:now-1})}).due,true);
 assert.equal(R({last:ago(400),meta:meta({days:0,changes:999})}).due,false,'switched off');
 assert.equal(R({last:'not a date'}).reason,'never');
});

test('stored reminder settings are validated: junk falls back to the defaults',()=>{
 const d=plain(T._test.cleanMeta(null));
 assert.deepEqual(d,{changes:0,sig:'',backupSeen:'',snoozeUntil:0,days:14,sentAt:0,receivedAt:0});
 for(const junk of ['x',[],{changes:-1,days:5,sig:7,snoozeUntil:'soon',backupSeen:{}},{changes:1.5,days:'14'}])assert.deepEqual(plain(T._test.cleanMeta(junk)),d);
 assert.deepEqual(plain(T._test.cleanMeta({changes:3,days:30,snoozeUntil:9,extra:1})),{...d,changes:3,days:30,snoozeUntil:9});
 const {T:broken,store}=load();store.set(T._test.META_KEY,'{not json');assert.equal(broken.status().changes,0);
});

test('changes are counted per saved difference, dice rolls do not count, and a new backup file starts the count again',()=>{
 const store=new Map(),{T:X}=load({store}),snap=(hp,history=[])=>({characters:[character('a',{hp})],campaigns:[],history,lang:'ru'});
 assert.equal(X.noteChange(snap(45)),false,'the first write seen is the starting point');
 assert.equal(X.noteChange(snap(45)),false);
 assert.equal(X.noteChange(snap(45,[{total:7}])),false,'history is not part of the count');
 assert.equal(X.noteChange(snap(44)),true);assert.equal(X.noteChange(snap(43)),true);
 assert.equal(X.status().changes,2);assert.equal(X.status().reason,'never');
 store.set('nightcity-red-last-backup-v1',new Date().toISOString());
 assert.equal(X.status().changes,0);assert.equal(X.status().due,false);
 assert.equal(X.noteChange(snap(42)),true);assert.equal(X.status().changes,1);
 // Settings survive, and a snooze ends with the next backup.
 assert.equal(X.setDays(30),true);assert.equal(X.setDays(5),false);assert.equal(X.snooze(),true);assert.ok(X.status().snoozed);
 store.set('nightcity-red-last-backup-v1',new Date(Date.now()+1000).toISOString());
 const s=X.status();assert.equal(s.snoozed,false);assert.equal(s.meta.days,30);
 assert.equal(X.noteChange({characters:{toJSON(){throw Error('x')}}}),false,'a snapshot that cannot be read is ignored');
});

test('the overview strip keeps the download action, warns only when due and offers to wait',()=>{
 const store=new Map(),app={lang:()=>'en',getState:()=>({characters:[character('a')],campaigns:[]}),archive:{lastBackup:()=>store.get('nightcity-red-last-backup-v1')||null,atRisk:()=>false}},{T:X}=load({store,app});
 let html=X.strip('en','<p class="storage-hint">hint</p>');
 assert.match(html,/backup-strip warn/);assert.match(html,/data-action="export-backup"/);assert.match(html,/No backup file has been made yet/);assert.match(html,/data-xfer="snooze"/);assert.match(html,/storage-hint/);
 assert.match(html,/data-action="navigate" data-view="characters" data-xfer-open/);
 X.snooze();html=X.strip('ru');assert.match(html,/backup-strip "/);assert.doesNotMatch(html,/data-xfer="snooze"/);assert.match(html,/Копия в файл ещё не делалась/);
 store.set('nightcity-red-last-backup-v1',new Date(Date.now()-2*864e5).toISOString());
 html=X.strip('en');assert.match(html,/backup-strip "/);assert.match(html,/2 days ago/);
 app.getState=()=>({characters:[],campaigns:[]});assert.equal(X.strip('en'),'');
});

test('pairing codes are 12 unambiguous characters and survive formatting',()=>{
 const C=T._test;
 for(let i=0;i<50;i++){const c=C.newCode();assert.match(c,/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{12}$/);assert.equal(C.formatCode(c).length,14);assert.equal(C.normalizeCode(C.formatCode(c).toLowerCase()+' '),c)}
 for(const bad of ['','ABCD','O0OO-1111-IIII','ABCD-EFGH-JKMNP',null,123456789012])assert.equal(C.normalizeCode(bad),null);
});

test('one code gives a stable mailbox and key; another code or the wrong direction cannot open a message',async()=>{
 const C=T._test,a=await C.derive('K7RQM2XAPZ9E',1000),b=await C.derive('K7RQM2XAPZ9E',1000),c=await C.derive('K7RQM2XAPZ9F',1000);
 assert.equal(a.topic,b.topic);assert.notEqual(a.topic,c.topic);assert.match(a.topic,/^ncred\/x1\/[0-9a-f]{32}$/);assert.ok(!a.topic.includes('K7RQ'));
 const sealed=await C.seal(a.key,'s',te.encode('привет'));
 assert.ok(!Buffer.from(sealed).includes(Buffer.from('привет')));
 assert.equal(td.decode(await C.unseal(b.key,'s',sealed)),'привет');
 await assert.rejects(()=>C.unseal(c.key,'s',sealed));
 await assert.rejects(()=>C.unseal(a.key,'r',sealed),'a message cannot be replayed in the other direction');
 const bent=sealed.slice();bent[20]^=1;await assert.rejects(()=>C.unseal(a.key,'s',bent));
});

// An in-memory broker: every client on a topic gets every message (its own too), with optional loss, like the public MQTT mailboxes.
function hub({lose=()=>false}={}){
 const clients=new Set(),log=[];
 const transport=({topic,onMessage,onStatus})=>{
  const me={topic,onMessage,open:true};clients.add(me);
  setTimeout(()=>{if(me.open)onStatus({total:1,online:1})},1);
  return {publish(sub,bytes){if(!me.open)return 0;const full=topic+'/'+sub,copy=bytes.slice();log.push({topic:full,bytes:copy});if(lose(full,copy,log.length))return 1;for(const c of clients)if(c.open&&c.topic===topic)setTimeout(()=>{if(c.open)c.onMessage({type:3,topic:full,payload:copy.slice()})},0);return 1},close(){me.open=false;clients.delete(me)},wake(){},status:()=>({total:1,online:1})};
 };
 return {transport,log,clients};
}
const FAST={iterations:1000,helloEvery:20,helloLimit:400,retryEvery:25,stallLimit:8,idleLimit:1500,waitLimit:1500};
function run(X,options){
 return new Promise(resolve=>{const states=[];const s=X.createSession({...FAST,...options,onState:st=>{states.push(st);if(['done','failed','cancelled'].includes(st.phase))setTimeout(()=>resolve({session:s,states,last:st}),5)}})});
}
const archive=n=>te.encode(JSON.stringify({format:'nightcity-red-backup',version:1,_completeSnapshot:{characters:Array.from({length:n},(_,i)=>character('c'+i,{notes:'заметка '+'x'.repeat(200)+i})),campaigns:[]}}));

test('an archive crosses between two devices in chunks, compressed, and arrives byte for byte',async()=>{
 const h=hub(),code=T._test.newCode(),payload=archive(120),a=load().T,b=load().T;
 const [sent,got]=await Promise.all([run(a,{role:'send',code,payload,transport:h.transport,chunkSize:120,summary:{characters:120,campaigns:0}}),run(b,{role:'receive',code,transport:h.transport})]);
 assert.equal(sent.last.phase,'done');assert.equal(got.last.phase,'done');
 assert.deepEqual(Buffer.from(got.session.result()),Buffer.from(payload));
 assert.ok(got.last.total>3,'sent in several chunks');assert.equal(got.last.done,got.last.total);
 assert.ok(got.states.some(s=>s.phase==='transferring'&&s.summary?.characters===120));
 const wire=Buffer.concat(h.log.map(m=>Buffer.from(m.bytes)));
 assert.ok(!wire.includes(Buffer.from('nightcity-red-backup'))&&!wire.includes(Buffer.from(code)),'the broker sees neither the data nor the code');
 assert.ok(wire.length<payload.length,'compressed on the way');
 assert.ok(h.log.every(m=>/^ncred\/x1\/[0-9a-f]{32}\/[sr]$/.test(m.topic)));
 assert.equal(h.clients.size,0,'both sides hang up');
});

test('lost messages are asked for again: the transfer still completes over a mailbox that drops a third of them',async()=>{
 let n=0;const h=hub({lose:()=>(++n%3)===0}),code=T._test.newCode(),payload=archive(40);
 const [sent,got]=await Promise.all([run(load().T,{role:'send',code,payload,transport:h.transport,chunkSize:500}),run(load().T,{role:'receive',code,transport:h.transport})]);
 assert.equal(got.last.phase,'done');assert.deepEqual(Buffer.from(got.session.result()),Buffer.from(payload));
 assert.ok(['done','failed'].includes(sent.last.phase)); // the final "done" itself may be among the lost ones
});

test('a wrong code finds nobody and nothing arrives',async()=>{
 const h=hub(),payload=archive(3),sender=load().T.createSession({...FAST,role:'send',code:'K7RQM2XAPZ9E',payload,transport:h.transport});
 const got=await run(load().T,{role:'receive',code:'K7RQM2XAPZ9F',transport:h.transport});
 assert.equal(got.last.phase,'failed');assert.equal(got.last.reason,'nopeer');assert.equal(got.session.result(),null);
 assert.equal(sender.state().phase,'waiting');sender.cancel();assert.equal(sender.state().phase,'cancelled');
 const bad=await run(load().T,{role:'receive',code:'nope',transport:h.transport});assert.equal(bad.last.reason,'code');
});

test('a transfer that breaks half-way fails without a result: there is nothing to import',async()=>{
 // The sender disappears after the first window.
 let fromSender=0;const h=hub({lose:topic=>topic.endsWith('/s')&&++fromSender>4}),code=T._test.newCode();
 const sending=run(load().T,{role:'send',code,payload:archive(60),transport:h.transport,chunkSize:100,idleLimit:300});
 const got=await run(load().T,{role:'receive',code,transport:h.transport});
 assert.equal(got.last.phase,'failed');assert.equal(got.last.reason,'stalled');assert.equal(got.session.result(),null);
 assert.ok(got.last.done<got.last.total);
 assert.equal((await sending).last.phase,'failed');
});

test('cancelling on either side stops the other, and a code serves only the first receiver',async()=>{
 const h=hub(),code=T._test.newCode(),payload=archive(200);
 let receiver;const sending=run(load().T,{role:'send',code,payload,transport:h.transport,chunkSize:300});
 const receiving=new Promise(resolve=>{receiver=load().T.createSession({...FAST,role:'receive',code,transport:h.transport,onState:s=>{if(s.phase==='transferring'&&s.done>=2)receiver.cancel();if(s.phase==='cancelled')resolve(s)}})});
 await receiving;const sent=await sending;
 assert.equal(sent.last.phase,'failed');assert.equal(sent.last.reason,'peer');assert.equal(receiver.result(),null);

 const h2=hub(),code2=T._test.newCode(),small=archive(30);
 const s2=run(load().T,{role:'send',code:code2,payload:small,transport:h2.transport,chunkSize:400});
 const first=run(load().T,{role:'receive',code:code2,transport:h2.transport});
 await new Promise(r=>setTimeout(r,60));
 const second=run(load().T,{role:'receive',code:code2,transport:h2.transport});
 assert.equal((await first).last.phase,'done');assert.equal((await s2).last.phase,'done');
 const late=await second;assert.equal(late.last.phase,'failed');assert.equal(late.session.result(),null);
});

test('without a transport or with a silent sender the session fails cleanly',async()=>{
 const none=await run(load().T,{role:'receive',code:T._test.newCode(),transport:null});
 assert.equal(none.last.phase,'failed');assert.equal(none.last.reason,'offline');
 const h=hub(),alone=await run(load().T,{role:'send',code:T._test.newCode(),payload:archive(1),transport:h.transport,waitLimit:120});
 assert.equal(alone.last.phase,'failed');assert.equal(alone.last.reason,'timeout');
 const dead=()=>({publish:()=>0,close(){},wake(){}});
 for(const role of ['send','receive']){const r=await run(load().T,{role,code:T._test.newCode(),payload:archive(1),transport:dead,helloLimit:80});assert.equal(r.last.reason,'offline',role+' with no broker')}
});

/* ---------- with app.js: what the import really writes ---------- */
function harness(saved,{lang='en'}={}){
 const raw=JSON.stringify(saved),events={},notices=[],confirms=[],el=()=>({innerHTML:'',setAttribute(){},addEventListener(t,fn){events[t]=fn}}),nodes={'#app':el(),'#sync-root':el(),'#sync-adapter-status':el(),'#app-notice':{set textContent(v){notices.push(v)},classList:{add(){},remove(){}}}};
 let uid=0,reply=true;const store=new Map(),kept=[],writes=[],ls=new Map();
 const adapter={stateLabel:()=>'',start(){},canEdit:()=>true,getScope:()=>'local',hasQueued:()=>false,save(s){writes.push(plain(s));return Promise.resolve({ok:true})},copies:()=>[...store.keys()].map(id=>({id,kind:'before-restore',at:null,size:store.get(id).length})),readCopy:id=>store.has(id)?store.get(id):null,removeCopy:id=>store.delete(id),keepBeforeRestore(snapshot){if(adapter.full)return false;const id='nightcity-red-v1:before-restore:'+(kept.length+1);store.set(id,snapshot);kept.push(id);return id},dropOlderBeforeRestore(id){for(const k of [...store.keys()])if(k!==id)store.delete(k)},forget(){},lastBackup:()=>null,persistence:()=>'granted'};
 const ask=m=>{confirms.push(m);return typeof reply==='function'?reply(m):reply};
 const document={querySelector:s=>nodes[s]||null,documentElement:{},title:'',createElement:()=>({click(){},remove(){}}),body:{appendChild(){}},addEventListener(){}};
 const w={document,ROLES:[{id:'solo',name:{en:'Solo',ru:'Соло'},description:{en:'',ru:''}}],CombatTools:{handle:()=>false},Book:{handle:()=>false},Campaigns:{handle:()=>false,render:()=>''},NetTools:{setScope(){},validArchitectures:Array.isArray},RoleTools:{render:()=>'',handle:()=>({handled:false}),refresh(){}},LocalStore:{create(){return adapter}},confirm:ask,scrollTo(){},crypto:globalThis.crypto,localStorage:{getItem:k=>ls.has(k)?ls.get(k):null,setItem:(k,v)=>{ls.set(k,String(v))}},addEventListener(){},setTimeout,clearTimeout};
 const ctx={window:w,document,Blob:class{},URL:{createObjectURL:()=>'blob:x',revokeObjectURL(){}},localStorage:{getItem:k=>k==='nightcity-red-v1'?raw:null,setItem(){}},globalThis:{crypto:{randomUUID:()=>'id-'+(++uid)}},confirm:ask,setTimeout:()=>0,clearTimeout(){},console,Math,Date,JSON,Set,Map,Number,String,Array,Object,Promise,WeakMap,TextEncoder,TextDecoder,Uint8Array,Error};
 vm.createContext(ctx);for(const f of ['character-extra.js','equipment-tools.js','transfer.js'])vm.runInContext(source(f),ctx);
 vm.runInContext(source('app.js')+`\nrender=()=>{};state.lang=${JSON.stringify(lang)};window.qa={state:()=>state,snapshot:snapshotAppState,validate:validateSnapshot,page:()=>characters(),overview:()=>overview(),go:v=>{state.view=v}};`,ctx);
 return {w,api:w.App.archive,T:w.Transfer,qa:w.qa,adapter,store,kept,notices,confirms,answer:a=>reply=a,state:()=>w.qa.state(),snap:()=>plain(w.qa.snapshot())};
}
const backup=snapshot=>({format:'nightcity-red-backup',version:1,_completeSnapshot:snapshot});

test('adding an archive adds new sheets, updates older ones in place and keeps campaign places — in one write that can be undone',()=>{
 const mine={schemaVersion:1,characters:[character('a',{name:'Alpha',hp:40,extra:{uid:'ua',updatedAt:100}}),character('b',{name:'Beta',extra:{uid:'ub',updatedAt:900}})],campaigns:[{id:'k',name:'Home',notes:'',roster:[pc('r1','a')]}]};
 const h=harness(mine),before=h.snap();
 const file=backup({schemaVersion:1,characters:[character('p',{name:'Alpha',hp:12,extra:{uid:'ua',updatedAt:500}}),character('q',{name:'Beta',hp:1,extra:{uid:'ub',updatedAt:200}}),character('n',{name:'Nova',extra:{uid:'un',updatedAt:300}})],campaigns:[{id:'z',name:'Away',notes:'',roster:[pc('r9','p'),pc('r8','n')]}],netArchitectures:[{id:'net1',name:'Tower',floors:[]}]});
 const plan=h.T.plan(h.api.snapshot(),h.api.read(file).snapshot,h.api.helpers());
 assert.deepEqual(plain(plan.characters.map(c=>c.kind)),['update','keep','new']);
 assert.equal(h.api.merge(file,'not the plan the user saw').reason,'stale');assert.deepEqual(h.snap(),before,'a stale preview writes nothing');
 const r=h.api.merge(file,plan.sig);assert.equal(r.ok,true);assert.equal(r.undo,h.kept[0]);
 const s=h.state(),byName=n=>s.characters.find(c=>c.name===n);
 assert.equal(s.characters.length,3);
 assert.equal(byName('Alpha').id,'a','an updated sheet keeps its id');assert.equal(byName('Alpha').hp,12);assert.equal(byName('Alpha').extra.updatedAt,500,'and the edit time of the version it now holds');
 assert.equal(byName('Beta').hp,45,'the sheet edited later on this device stays');
 const nova=byName('Nova');assert.ok(nova&&nova.id!=='n');assert.equal(nova.extra.uid,'un');
 const away=s.campaigns.find(k=>k.name==='Away');assert.deepEqual(plain(away.roster.map(x=>x.characterId)),['a',nova.id],'places point at the local sheets');
 assert.equal(s.campaigns.find(k=>k.name==='Home').roster[0].characterId,'a');
 assert.equal(s.netArchitectures.length,1,'an empty section is filled');
 assert.equal(h.qa.validate(h.snap()),true,'the result passes the store validation');
 assert.deepEqual(JSON.parse(h.store.get(h.kept[0])),before,'the snapshot kept for undo is the data as it was');
 // The same archive again: nothing left to do.
 const again=h.T.plan(h.api.snapshot(),h.api.read(file).snapshot,h.api.helpers());
 assert.equal(again.changes,0);assert.deepEqual(plain(again.campaigns.map(c=>c.kind)),['same']);assert.equal(h.api.merge(file,again.sig).reason,'empty');
 // Undo puts everything back.
 assert.equal(h.api.undo(r.undo),true);assert.deepEqual(plain(h.snap().characters),before.characters);assert.deepEqual(plain(h.snap().campaigns),before.campaigns);
});

test('when the browser has no room the import is not half-done: the data goes back to what it was',()=>{
 const mine={schemaVersion:1,characters:[character('a',{extra:{uid:'ua',updatedAt:1}})],campaigns:[]},file=backup({schemaVersion:1,characters:[character('a',{hp:3,extra:{uid:'ua',updatedAt:9}}),character('n',{extra:{uid:'un'}})],campaigns:[{id:'z',name:'Away',roster:[]}]});
 for(const mode of ['merge','replace']){
  const h=harness(mine),before=h.snap();h.adapter.flush=()=>({ok:false,reason:'storage'});h.adapter.hasRoom=()=>false;
  const r=h.api[mode](file);assert.equal(r.ok,false,mode);assert.equal(r.reason,'storage');
  assert.deepEqual(h.snap(),before,mode+' left the data untouched');assert.equal(h.store.size,0,'no snapshot is left behind');
 }
});

test('replacing everything keeps a snapshot, refuses empty, newer and foreign files, and asks when no snapshot fits',()=>{
 const mine={schemaVersion:1,characters:[character('a')],campaigns:[]},file=backup({schemaVersion:1,characters:[character('x',{name:'From file'})],campaigns:[],lang:'ru'});
 const h=harness(mine),before=h.snap();
 assert.equal(h.api.replace(backup({schemaVersion:1,characters:[],campaigns:[]})).reason,'empty');
 assert.equal(h.api.replace({format:'nightcity-red-backup',version:2,characters:[]}).reason,'newer');
 assert.equal(h.api.replace({hello:'world'}).reason,'invalid');assert.equal(h.api.merge('text').reason,'invalid');
 assert.deepEqual(h.snap(),before);assert.equal(h.store.size,0);
 h.adapter.full=true;h.answer(false);assert.equal(h.api.replace(file).reason,'cancelled');assert.match(h.confirms[0],/cannot be undone/);assert.deepEqual(h.snap(),before);
 h.adapter.full=false;const r=h.api.replace(file);assert.equal(r.ok,true);assert.equal(r.undo,h.kept[0]);
 assert.deepEqual(plain(h.state().characters.map(c=>c.name)),['From file']);assert.equal(h.qa.validate(h.snap()),true);
 h.adapter.canEdit=()=>false;assert.equal(h.api.replace(file).reason,'paused');assert.equal(h.api.merge(file).reason,'paused');
});

test('the block shows on the Characters page in both languages, and the overview strip comes from it',()=>{
 for(const lang of ['ru','en']){
  const h=harness({schemaVersion:1,characters:[character('a')],campaigns:[]},{lang});h.qa.go('characters');
  const html=h.qa.page();
  assert.match(html,/data-transfer-root/);assert.match(html,lang==='ru'?/Перенос и копии/:/Transfer and backups/);
  assert.match(html,/data-xfer-file/);assert.match(html,/data-xfer="send"/);assert.match(html,/data-xfer="receive"/);assert.match(html,/data-xfer-days/);
  assert.ok(html.indexOf('data-transfer-root')>html.indexOf('character-grid'));
  assert.match(h.qa.overview(),/data-xfer-strip/);
 }
});

test('a file is previewed before anything is written, and odd files are explained instead of imported',()=>{
 const h=harness({schemaVersion:1,characters:[character('a',{name:'Alpha',extra:{uid:'ua'}})],campaigns:[]}),before=h.snap(),I=h.T._test.inspect;
 const ok=I(backup({schemaVersion:1,characters:[character('n',{name:'Nova',extra:{uid:'un'}}),{name:'broken'}],campaigns:[]}),'file','b.json');
 assert.equal(ok.error,undefined);assert.equal(ok.plan.counts.add,1);assert.equal(ok.skipped,1);assert.deepEqual(plain(ok.plan.localOnly),['Alpha']);
 assert.match(I({format:'nightcity-red-character',version:1,character:character('z')},'file','c.json').error,/single character/);
 assert.match(I({format:'nightcity-red-backup',version:9},'file','n.json').error,/newer version/);
 for(const junk of [null,[],'x',{a:1}])assert.match(I(junk,'file','j.json').error,/not a Night City/);
 assert.deepEqual(h.snap(),before);
});

test('the store reports every write that reached the browser, and a failing listener or a full browser never breaks saving',()=>{
 const data=new Map();let full=false;const seen=[];
 const win={localStorage:{getItem:k=>data.has(k)?data.get(k):null,setItem(k,v){if(full)throw Error('quota');data.set(k,String(v))},removeItem:k=>data.delete(k),get length(){return data.size},key:i=>[...data.keys()][i]??null},addEventListener(){},navigator:{},Transfer:{noteChange:s=>{seen.push(plain(s));throw Error('listener bug')}}};
 vm.runInNewContext(source('local-store.js'),{window:win,document:{querySelector:()=>null,addEventListener(){},visibilityState:'visible'},setTimeout:()=>1,clearTimeout(){},JSON,Promise,Error,Date,URL,Blob});
 const store=win.LocalStore.create({app:null,status:null,language:()=>'ru'});store.start();
 store.save({characters:[{id:'a'}]});assert.equal(store.flush().ok,true);assert.deepEqual(seen,[{characters:[{id:'a'}]}]);
 full=true;store.save({characters:[]});assert.equal(store.flush().ok,false);assert.equal(seen.length,1,'a write that did not fit is not a saved change');
});

test('three brokers deliver every message three times: a chunk is still sent once per request, not once per copy',async()=>{
 // Every message reaches every client three times, as when all three public brokers are online.
 const clients=new Set(),log=[];
 const transport=({topic,onMessage,onStatus})=>{
  const me={topic,onMessage,open:true};clients.add(me);setTimeout(()=>{if(me.open)onStatus({total:3,online:3})},1);
  return {publish(sub,bytes){if(!me.open)return 0;const full=topic+'/'+sub,copy=bytes.slice();log.push(full);for(const c of clients)if(c.open&&c.topic===topic)for(let k=0;k<3;k++)setTimeout(()=>{if(c.open)c.onMessage({type:3,topic:full,payload:copy.slice()})},0);return 3},close(){me.open=false;clients.delete(me)},wake(){},status:()=>({total:3,online:3})};
 };
 const code=T._test.newCode(),payload=archive(60);
 const [sent,got]=await Promise.all([run(load().T,{role:'send',code,payload,transport,chunkSize:60}),run(load().T,{role:'receive',code,transport})]);
 assert.equal(got.last.phase,'done');assert.deepEqual(Buffer.from(got.session.result()),Buffer.from(payload));
 const chunks=got.last.total,fromSender=log.filter(t=>t.endsWith('/s')).length;
 assert.ok(chunks>5,'chunks: '+chunks);assert.ok(fromSender<chunks*2,`the sender published ${fromSender} messages for ${chunks} chunks`);
});
