// The shared session journal: the Game Master marks entries, players read them, nobody else can write them,
// and a page that does not know the new message type carries on as before.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const eq=(a,b)=>assert.deepEqual(plain(a),plain(b));
const CODE='K7RQM2XAPZ9E';
const settle=(ms=40)=>new Promise(ok=>setTimeout(ok,ms));
const BRANCH=" }else if(m.t==='journal'&&sub==='j'){\n  if(fromGM&&global.RoomJournal?.receive?.(m.d,at,p.retain))repaint();\n";
// One browser tab. `old` is a page from before the shared journal: no module and no branch for the new message type.
function loadTab({old=false,state}={}){
 const listeners={},store=new Map(),document={addEventListener(type,f){(listeners[type]||=[]).push(f)},querySelector:()=>null,visibilityState:'visible'};
 const later=(f,ms)=>{const h=setTimeout(f,ms);if(ms>=1000)h.unref?.();return h};
 const window={document,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},crypto:globalThis.crypto,location:{hash:'',origin:'https://example.test',pathname:'/'},addEventListener(){},confirm:()=>true,navigator:{},btoa,atob};
 const ctx={window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Error,setTimeout:later,clearTimeout,setInterval,clearInterval,console,URL,Blob};
 let room=read('room.js');
 if(old){assert.equal(room.split(BRANCH).length,2);room=room.replace(BRANCH,'')}
 vm.runInNewContext(read('room-transport.js')+'\n'+room+(old?'':'\n'+read('room-journal.js')),ctx);
 const R=window.Room._test,notices=[],sent=[],st=state||{lang:'ru',characters:[],campaigns:[]};let saves=0;
 window.App={getState:()=>st,lang:()=>st.lang,notify:m=>notices.push(m),save:()=>{saves++}};
 R.setApp(window.App);R.setTransport({publish:(sub,bytes,retain)=>{sent.push({sub,bytes,retain});return 1},close(){}});
 return {window,R,J:window.RoomJournal,notices,sent,st,listeners,saves:()=>saves};
}
async function scene({role='player',old=false,state,campaignId=''}={}){
 const tab=loadTab({old,state}),R=tab.R,room=await R.deriveRoom(CODE);R.setKey(room.key);
 const me=await R.ensureIdentity(),gm=await R.newIdentity(),bob=await R.newIdentity(),eve=await R.newIdentity(),id=(who,sid='000000a1')=>who.fp+'.'+sid;
 R.setSession({code:CODE,role,name:'V',memberId:id(me,'000000b1'),gmFp:role==='gm'?me.fp:gm.fp,gmPin:role==='gm'?'self':'link',toasts:false,...(campaignId?{campaignId}:{})},room.topic);
 let n=0;
 const bytes=(who,sub,t,d,{at=Date.now(),from=id(who)}={})=>R.signedEnvelope(who,from,room.topic,room.key,sub,t,d,at,'m'+(n++));
 const give=async(who,sub,t,d,opt={})=>{await R.receive({topic:room.topic+'/'+sub,retain:!!opt.retain,payload:await bytes(who,sub,t,d,opt)});await settle(5)};
 return {...tab,room,me,gm,bob,eve,id,bytes,give};
}
const campaign=()=>({id:'c1',name:'Арасака',notes:'Секрет ведущего',roster:[],journal:[{id:'j3',at:3000,text:'Третья',auto:false},{id:'j2',at:2000,text:'Вторая <b>запись</b>',auto:true},{id:'j1',at:1000,text:'Первая',auto:false}]});
const LIST={campaign:'Арасака',list:[{at:2000,text:'Вторая'},{at:1000,text:'Первая'}]};

test('the Game Master marks entries by id; marks follow the journal and stop at the limit',()=>{
 const {J}=loadTab(),c=campaign();
 eq(J.sharedIds(c),[]);eq(J.payload(c).data,{campaign:'Арасака',list:[]});
 eq(J.setShared(c,'j1',true),{ok:true,count:1});eq(J.setShared(c,'j1',true),{ok:true,count:1});eq(J.setShared(c,'j3',true),{ok:true,count:2});
 eq(c.journalShared,['j1','j3']);
 eq(J.payload(c).data,{campaign:'Арасака',list:[{at:3000,text:'Третья'},{at:1000,text:'Первая'}]}); // journal order, newest first; only text and time leave the device
 assert.equal(JSON.stringify(J.payload(c).data).includes('Секрет'),false);
 assert.equal(J.setShared(c,'ghost',true).reason,'missing');
 c.journal=c.journal.filter(e=>e.id!=='j3');eq(J.sharedIds(c),['j1']); // a deleted entry is no longer shared
 eq(J.setShared(c,'j1',false),{ok:true,count:0});assert.equal('journalShared' in c,false); // an unused field is not left in the save
 const big={id:'b',name:'B',roster:[],journal:Array.from({length:30},(_,i)=>({id:'e'+i,at:i+1,text:'t'+i}))};
 for(let i=0;i<J.MAX_SHARED;i++)assert.equal(J.setShared(big,'e'+i,true).ok,true);
 assert.equal(J.setShared(big,'e25',true).reason,'full');assert.equal(big.journalShared.length,J.MAX_SHARED);
 big.journalShared=['e1','e1',5,null,'nope',{}];eq(J.sharedIds(big),['e1']);
 for(const bad of [null,undefined,7,'x',[]])eq(J.payload(bad).data,{campaign:'',list:[]});
});

test('what is sent stays within the size budget: the newest entries win',()=>{
 const {J}=loadTab(),c={id:'c',name:'N',roster:[],journal:Array.from({length:20},(_,i)=>({id:'e'+i,at:100-i,text:'Я'.repeat(2000)}))};
 c.journalShared=c.journal.map(e=>e.id);
 const p=J.payload(c);assert.equal(p.total,20);assert.ok(p.fit>0&&p.fit<20);assert.ok(new TextEncoder().encode(JSON.stringify(p.data)).length<=J.MAX_BYTES);
 eq(p.data.list.map(e=>e.at),Array.from({length:p.fit},(_,i)=>100-i));
});

test('anything received is rebuilt as time and text only',()=>{
 const {J}=loadTab();
 eq(J.clean({campaign:'К'.repeat(200),list:[{at:5,text:'ok',html:'<script>',id:'x'},{at:'soon',text:'no time'},{text:''},{text:{a:1}},null,'x',[1]],extra:1}),{campaign:'К'.repeat(80),list:[{at:5,text:'ok'},{at:0,text:'no time'}]});
 eq(J.clean({list:Array.from({length:50},()=>({at:1,text:'x'.repeat(5000)}))}).list.map(e=>e.text.length),Array(J.MAX_SHARED).fill(2000));
 for(const bad of [null,7,'x',[],{list:'x'}])eq(J.clean(bad),{campaign:'',list:[]});
});

test('the Game Master page publishes the marked entries as one signed retained message; the protocol number is unchanged',async()=>{
 const c=campaign();c.journalShared=['j2','j1'];
 const s=await scene({role:'gm',campaignId:'c1',state:{lang:'ru',characters:[],campaigns:[c]}});
 assert.match(read('room.js'),/PROTOCOL=3\b/);
 assert.equal(s.J.publish(false),true);await settle();
 const out=s.sent.filter(x=>x.sub==='j');assert.equal(out.length,1);assert.equal(out[0].retain,true);
 const outer=await s.R.open(out[0].bytes),m=JSON.parse(outer.b);
 assert.equal(outer.v,3);assert.equal(typeof outer.s,'string');assert.equal(m.t,'journal');assert.equal(m.from,s.id(s.me,'000000b1'));
 eq(m.d,{campaign:'Арасака',list:[{at:2000,text:'Вторая <b>запись</b>'},{at:1000,text:'Первая'}]});
 assert.equal(s.J.publish(false),false);assert.equal(s.J.publish(true),false); // nothing changed: nothing is sent again at once
 s.J.setShared(c,'j1',false);assert.equal(s.J.publish(false),true);await settle();
 eq(JSON.parse((await s.R.open(s.sent.filter(x=>x.sub==='j')[1].bytes)).b).d.list,[{at:2000,text:'Вторая <b>запись</b>'}]);
 assert.equal(s.J.publish(true,Date.now()+200000),true);await settle(); // a later heartbeat repeats it for relays that lost their copy
 // The room's own save path reaches it: a change is published together with the clocks.
 s.J.setShared(c,'j3',true);const before=s.sent.filter(x=>x.sub==='j').length;s.window.Room.changed();await settle(520);
 assert.equal(s.sent.filter(x=>x.sub==='j').length,before+1);
 // The GM's own page shows what players see and takes nothing from the wire.
 await s.give(s.gm,'j','journal',LIST);assert.ok(s.J.card().includes('Третья'));assert.ok(!s.J.card().includes('data-rj-action'));eq(s.J._test.shown().list,[]);
});

test('a player page shows the entries of the trusted Game Master, read-only, and says when they change',async()=>{
 const s=await scene();
 assert.equal(s.J.card(),''); // nothing shared: no card
 await s.give(s.gm,'j','journal',{campaign:'Арасака',list:[{at:2000,text:'<img src=x onerror=alert(1)> & "цитата"'}]},{retain:true});
 const card=s.J.card();
 assert.ok(card.includes('ЖУРНАЛ СЕССИИ'));assert.ok(card.includes('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;цитата&quot;'));assert.ok(!card.includes('<img'));
 assert.ok(!/<(input|textarea|select)\b/.test(card));assert.ok(card.includes('data-rj-action="download"'));assert.ok(card.includes('Изменить их здесь нельзя'));
 assert.ok(s.R.roomView().includes('data-rj-card')); // the room page carries the card
 assert.equal(s.notices.length,0); // a copy kept by a relay is not news
 await s.give(s.gm,'j','journal',LIST);assert.equal(s.notices.at(-1),'Ведущий обновил журнал сессии.');eq(s.J._test.shown(),LIST);
 const n=s.notices.length;await s.give(s.gm,'j','journal',LIST);assert.equal(s.notices.length,n); // the same again is not announced
 await s.give(s.gm,'j','journal',{campaign:'',list:[]});assert.equal(s.J.card(),''); // the GM took everything back
 s.st.lang='en';await s.give(s.gm,'j','journal',LIST);assert.ok(s.J.card().includes('SESSION JOURNAL'));assert.equal(s.notices.at(-1),'The Game Master updated the session journal.');
 assert.match(s.J.markdown(LIST,'en'),/^# Арасака — session journal\n\n- \*\*.+\*\* — Первая\n- \*\*.+\*\* — Вторая\n$/);
});

test('only the Game Master named for this room can write the journal; old and moved messages are dropped',async()=>{
 const s=await scene();
 await s.give(s.eve,'j','journal',LIST);await s.give(s.bob,'j','journal',LIST);eq(s.J._test.shown().list,[]);
 await s.give(s.eve,'j','journal',LIST,{from:s.id(s.gm)});eq(s.J._test.shown().list,[]); // the GM's id, somebody else's key
 await s.R.receive({topic:s.room.topic+'/k',retain:false,payload:await s.bytes(s.gm,'j','journal',LIST)});await settle(5);eq(s.J._test.shown().list,[]); // moved to another subtopic
 await s.R.receive({topic:s.room.topic+'/j',retain:false,payload:await s.bytes(s.gm,'k','journal',LIST)});await settle(5);eq(s.J._test.shown().list,[]);
 await s.give(s.gm,'j','journal',LIST,{at:Date.now()-13*3600*1000,retain:true});eq(s.J._test.shown().list,[]); // too old
 await s.give(s.gm,'j','journal',LIST);eq(s.J._test.shown(),LIST);
 await s.give(s.gm,'j','journal',{campaign:'Старое',list:[{at:1,text:'старое'}]},{at:Date.now()-60000,retain:true});eq(s.J._test.shown(),LIST); // an older copy does not replace a newer one
 await s.give(s.gm,'j','journal',{campaign:7,list:'x'});eq(s.J._test.shown(),{campaign:'',list:[]}); // junk from the GM is still only text
 await s.give(s.gm,'j','clocks',{list:[{name:'x',size:4,filled:1}]});assert.equal(s.R.state().clocks.length,0); // the journal subtopic sets nothing else
});

test('a page that does not know the new message ignores it and keeps working',async()=>{
 const s=await scene({old:true});
 assert.equal(s.window.RoomJournal,undefined);
 await s.give(s.gm,'j','journal',LIST,{retain:true});await s.give(s.gm,'j','journal',LIST);
 assert.equal(s.notices.length,0);eq(s.R.state(),{combat:null,clocks:[],combatAt:0,clocksAt:0,outbox:[],feed:[]});assert.ok(!s.R.roomView().includes('rj-'));
 await s.give(s.gm,'c','combat',{campaign:'A',round:2,order:[{name:'Ганг',init:12,current:true}]});assert.equal(s.R.state().combat.round,2);
 await s.give(s.gm,'k','clocks',{list:[{name:'x',size:4,filled:1}]});assert.equal(s.R.state().clocks.length,1);
 // And a page that has the branch but not the module (a partial update) does not throw either.
 const half=loadTab();delete half.window.RoomJournal;const room=await half.R.deriveRoom(CODE);half.R.setKey(room.key);
 const me=await half.R.ensureIdentity(),gm=await half.R.newIdentity();half.R.setSession({code:CODE,role:'player',name:'V',memberId:me.fp+'.000000b1',gmFp:gm.fp,gmPin:'link',toasts:false},room.topic);
 await half.R.receive({topic:room.topic+'/j',retain:false,payload:await half.R.signedEnvelope(gm,gm.fp+'.000000a1',room.topic,room.key,'j','journal',LIST,Date.now(),'x1')});await settle(5);
 assert.ok(half.R.roomView().includes('room-combat'));
});

test('leaving for another room forgets the journal of the previous one',async()=>{
 const s=await scene();await s.give(s.gm,'j','journal',LIST);assert.notEqual(s.J.card(),'');
 s.R.setSession({...s.R.session()},'ncred/v2/ffffffffffffffffffffffff');assert.equal(s.J.card(),'');
 s.R.setSession(null,'');assert.equal(s.J.card(),'');assert.equal(s.J.publish(true),false);assert.equal(s.J.receive(LIST,Date.now()),false);
});

test('the card under a campaign: ticking an entry saves it, tells the state of the room, and refuses the 21st',async()=>{
 const c=campaign(),s=await scene({role:'gm',campaignId:'c1',state:{lang:'ru',characters:[],campaigns:[c]}});
 let html=s.J.panel(c,'ru');
 assert.match(html,/data-rj-pick="c1"/);assert.equal((html.match(/data-rj-share=/g)||[]).length,3);assert.ok(!html.includes(' checked'));assert.ok(html.includes('0 / 20'));
 assert.ok(html.includes('Вторая &lt;b&gt;запись&lt;/b&gt;'));assert.ok(html.includes('Комната открыта: игроки видят отмеченные записи (0).'));
 assert.ok(s.J.panel(c,'en').includes('JOURNAL FOR PLAYERS'));assert.equal(s.J.panel(null,'ru'),'');
 const count={textContent:''},status={textContent:''},root={dataset:{rjPick:'c1'},querySelector:q=>q==='[data-rj-count]'?count:status};
 const tick=(id,checked)=>{const box={dataset:{rjShare:id},checked,closest:()=>root};s.listeners.change.forEach(f=>f({target:box}));return box};
 tick('j2',true);eq(c.journalShared,['j2']);assert.equal(s.saves(),1);assert.equal(count.textContent,'1 / 20');assert.equal(status.textContent,'Комната открыта: игроки видят отмеченные записи (1).');
 assert.ok(s.J.panel(c,'ru').includes('data-rj-share="j2" checked'));
 tick('j2',false);assert.equal('journalShared' in c,false);assert.equal(s.saves(),2);
 c.journal=Array.from({length:25},(_,i)=>({id:'e'+i,at:i+1,text:'t'+i}));for(let i=0;i<20;i++)tick('e'+i,true);
 const refused=tick('e22',true);assert.equal(refused.checked,false);assert.equal(c.journalShared.length,20);assert.match(s.notices.at(-1),/не больше 20/);
 // Other rooms and roles say so instead of pretending to publish.
 const other=await scene({role:'gm',campaignId:'zz'});assert.ok(other.J.panel(c,'ru').includes('В комнате выбрана другая кампания'));
 const player=await scene();assert.ok(player.J.panel(c,'ru').includes('Вы в комнате как игрок'));
 const alone=loadTab();assert.ok(alone.J.panel(c,'en').includes('No room is open'));
});
