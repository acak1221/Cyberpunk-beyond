/* Online rooms: the waiting room. With it the room code opens only the door: the room itself is sealed with a second key that
   the Game Master gives, device by device, to those it lets in.
   The rule under test everywhere: a device that has the code but was not let in neither reads the room nor puts anything into it. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const CODE='K7RQM2XAPZ9E',SESSION='nightcity-red-room-v1';
// One browser tab with its own module state and its own signing key. Long timers are not allowed to keep node running.
function loadRoom({lang='ru',state,fields={},gate=true,confirm=()=>true}={}){
 const listeners={},store=new Map(),downloads=[],document={addEventListener(type,f){(listeners[type]||=[]).push(f)},querySelector:sel=>fields[sel]||null,querySelectorAll:()=>[],visibilityState:'visible'};
 const later=(f,ms)=>{const h=setTimeout(f,ms);if(ms>=500)h.unref?.();return h},every=(f,ms)=>{const h=setInterval(f,ms);h.unref?.();return h};
 const window={document,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},crypto:globalThis.crypto,location:{hash:'',origin:'https://example.test',pathname:'/'},addEventListener(){},confirm:(...a)=>confirm(...a),navigator:{},btoa,atob,scrollTo(){}};
 const ctx={window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Error,setTimeout:later,clearTimeout,setInterval:every,clearInterval,console};
 vm.runInNewContext(read('room-transport.js')+'\n'+read('room-auth.js')+'\n'+(gate?read('room-gate.js')+'\n':'')+read('room.js'),ctx);
 const R=window.Room._test,notices=[],sent=[],resubscribed=[],app={lang,characters:[],campaigns:[],...(state||{})};
 const api={getState:()=>app,notify:m=>notices.push(m)};R.setApp(api);
 const wire={publish:(sub,bytes,retain)=>{sent.push({sub,bytes,retain});return 1},close(){},resubscribe(){resubscribed.push(Date.now())}};
 R.setTransport(wire);window.RoomTransport={create:()=>wire};
 if(window.RoomAuth)window.RoomAuth.download=(name,text)=>downloads.push({name,text});
 const press=async(action,data={})=>{for(const f of listeners.click||[])await f({target:{closest:sel=>sel==='[data-room-action]'?{dataset:{roomAction:action,...data},disabled:false}:null}})};
 const change=async(field,target={})=>{for(const f of listeners.change||[])await f({target:{dataset:{roomField:field},closest:()=>null,...target}})};
 return {window,R,G:window.RoomGate,A:window.RoomAuth,notices,sent,resubscribed,store,press,change,app,api,downloads,fields};
}
const settle=(ms=40)=>new Promise(ok=>setTimeout(ok,ms));
const until=async(f,what='condition')=>{for(let i=0;i<200;i++){if(await f())return;await settle(10)}assert.fail('timed out: '+what)};
let serial=0;
// A tab that is in the room. pin: the Game Master key it trusts (a player), or nothing for the Game Master itself.
// identity: the signing key of a device that was here before (a reloaded page keeps it).
async function tab({role='player',pin='',name='V',identity,...opt}={}){
 const t=loadRoom(opt),R=t.R,room=await R.deriveRoom(CODE);R.setKey(room.key);
 if(identity)R.setIdentity(identity);
 const me=await R.ensureIdentity();R.resetGMKeys();await R.ensureGMKeys();
 const memberId=me.fp+'.'+(0x10000000+(serial++)).toString(16);
 R.setSession({code:CODE,role,name,memberId,gmFp:role==='gm'?me.fp:pin,gmPin:role==='gm'?'self':pin?'link':'',toasts:false},room.topic);
 return {...t,room,me,memberId};
}
// Everything one tab has published so far reaches the others, as a broker would relay it (kept: delivered as a copy the broker kept).
async function relay(from,to,{kept=false}={}){
 await settle(15);const batch=from.sent.splice(0);
 for(const m of batch)for(const t of [].concat(to))await t.R.receive({topic:t.room.topic+'/'+m.sub,retain:kept,payload:m.bytes});
 await settle(15);return batch;
}
// What a tab that holds the room key makes of a batch: «*type» was sealed with the room key, «type» with the code alone.
const kinds=async(reader,batch)=>Promise.all(batch.map(async m=>{const got=await reader.R.gate.openAny(m.bytes);return (got.deep?'*':'')+JSON.parse(got.outer.b).t}));
// What some other device (a bare key that has the room code) would send.
const forge=(t,who,sub,type,d,{at=Date.now(),from=who.fp+'.000000e1',key=t.room.key}={})=>t.R.signedEnvelope(who,from,t.room.topic,key,sub,type,d,at,'x'+(serial++));
const give=async(t,bytes,sub,{kept=false}={})=>{await t.R.receive({topic:t.room.topic+'/'+sub,retain:kept,payload:bytes});await settle(10)};
// A Game Master with the waiting room on, and players that were let in.
async function table({players=1}={}){
 const gm=await tab({role:'gm',name:'Мастер'}),inside=[];
 assert.equal(await gm.R.gate.setGate(true),true);const notice=await relay(gm,[]);
 for(let i=0;i<players;i++){const p=await tab({pin:gm.me.fp,name:'Игрок'+(i+1)});await enter(gm,p,notice);inside.push(p)}
 // everyone hears everyone once
 for(const p of inside){p.R.auth.publishMember(true);await relay(p,[gm,...inside.filter(x=>x!==p)])}
 gm.R.auth.publishMember(true);await relay(gm,inside);
 // what was said while the table sat down is not what a test is about
 for(const t of [gm,...inside])t.notices.length=0;
 return {gm,players:inside,notice};
}
// A new device reads the notice, asks, and is let in by hand.
async function enter(gm,p,notice){
 for(const m of notice)await give(p,m.bytes,m.sub,{kept:true});
 await relay(p,gm,{kept:true});assert.ok(gm.R.gate.waiting().has(p.memberId),'the request reached the Game Master');
 assert.equal(gm.R.gate.admitWaiting(p.memberId),true);
 await relay(gm,p);assert.equal(p.R.gate.inRoom(),true,'let in');
 await relay(p,gm);
}

/* ---------- Keys, checks and texts ---------- */

test('the room key has a short public name, and nothing but a real key and its own name is taken',async()=>{
 const {G}=loadRoom(),a=await G.newKey(),b=await G.newKey();
 assert.match(a.key,/^[A-Za-z0-9+/]{43}=$/);assert.match(a.kid,/^[0-9a-f]{16}$/);assert.notEqual(a.key,b.key);assert.notEqual(a.kid,b.kid);
 assert.equal(await G.kidOf(a.key),a.kid);
 assert.ok(await G.importKey(a.key));await assert.rejects(G.importKey('short'),/bad_key/);await assert.rejects(G.importKey(null),/bad_key/);
 assert.deepEqual(JSON.parse(JSON.stringify(await G.readAdmit({k:a.key,kid:a.kid}))),{key:a.key,kid:a.kid});
 assert.equal(await G.readAdmit({k:a.key,kid:b.kid}),null,'a name that belongs to another key');
 for(const junk of [null,'x',{},{k:a.key},{k:'x',kid:a.kid},{k:a.key,kid:'zz'}])assert.equal(await G.readAdmit(junk),null);
});

test('what arrives from other devices and what a saved session holds is rebuilt from known fields',()=>{
 const {G}=loadRoom(),fp='0123456789abcdef01234567',box={x:'A'.repeat(43),y:'B'.repeat(43)},key='A'.repeat(43)+'=',kid='0123456789abcdef';
 const plain=x=>JSON.parse(JSON.stringify(x));
 assert.deepEqual(plain(G.cleanKnock({name:'Ви',cname:'Сильверхенд',box,extra:1})),{name:'Ви',cname:'Сильверхенд',box});
 assert.equal(G.cleanKnock({name:'Ви'}),null);assert.equal(G.cleanKnock({box:{x:'short',y:box.y}}),null);assert.equal(G.cleanKnock(null),null);
 assert.equal(G.cleanKnock({name:'x'.repeat(200),box}).name.length,40);assert.equal(G.cleanKnock({name:{toString(){return 'obj'}},box}).name,'?');
 assert.deepEqual(plain(G.cleanNotice({on:true,kid,name:'Мастер',proof:'ignored here'})),{on:true,kid,name:'Мастер'});
 assert.deepEqual(plain(G.cleanNotice({on:false,kid})),{on:false,kid:'',name:''});
 assert.equal(G.cleanNotice({on:true}),null,'a waiting room without the name of its key');assert.equal(G.cleanNotice({on:true,kid:'nope'}),null);
 assert.deepEqual(plain(G.cleanAdmitted({[fp]:{name:'Ви',at:5},bad:{name:'x'},'ffffffffffffffffffffffff':null})),{[fp]:{name:'Ви',at:5},'ffffffffffffffffffffffff':{name:'',at:0}});
 const many={};for(let i=0;i<200;i++)many[i.toString(16).padStart(24,'0')]={name:'',at:1};assert.equal(Object.keys(G.cleanAdmitted(many)).length,G.MAX_ADMITTED);
 assert.deepEqual(plain(G.cleanDenied([fp,fp,'x',null,7])),[fp]);assert.deepEqual(plain(G.cleanDenied('x')),[]);
 // the Game Master keeps the key and the lists
 assert.deepEqual(plain(G.cleanGate({on:true,key,kid,admitted:{[fp]:{name:'Ви',at:5}},denied:[fp,'x'],at:9,junk:1},'gm')),{on:true,key,kid,admitted:{[fp]:{name:'Ви',at:5}},denied:[fp],at:9});
 assert.equal(G.cleanGate({on:true,key:'x',kid},'gm'),null,'a Game Master without a key has no waiting room to speak of');
 // a player keeps the key it was given and the name of the key in use
 assert.deepEqual(plain(G.cleanGate({on:true,want:kid,kid,key,at:9,admitted:{}},'player')),{on:true,want:kid,kid,key,at:9});
 assert.deepEqual(plain(G.cleanGate({on:true,want:kid,key:'broken',kid},'player')),{on:true,want:kid,kid:'',at:0});
 assert.equal(G.cleanGate({on:true},'player'),null);assert.deepEqual(plain(G.cleanGate({on:false,at:3,key},'player')),{on:false,at:3});
 for(const junk of [null,'x',[],7])assert.equal(G.cleanGate(junk,'gm'),null);
 // roles change with a handover
 assert.deepEqual(plain(G.asPlayer({on:true,key,kid,admitted:{},denied:[],at:9})),{on:true,want:kid,kid,key,at:9});
 assert.deepEqual(plain(G.asGM({on:true,want:kid,kid,key,at:1},{admitted:{[fp]:{name:'Ви',at:5}},denied:[fp]},7)),{on:true,key,kid,admitted:{[fp]:{name:'Ви',at:5}},denied:[fp],at:7});
 assert.equal(G.asGM({on:true,want:kid,kid:'',at:1},{},7),null,'a page that does not hold the key cannot keep the room closed with it');
});

test('every text exists in Russian and in English, and Russian addresses the reader formally',()=>{
 const {G}=loadRoom();
 assert.deepEqual(Object.keys(G.T.ru).sort(),Object.keys(G.T.en).sort());
 for(const [k,v] of Object.entries(G.T.ru)){assert.ok(v&&typeof v==='string',k);assert.doesNotMatch(v,/(^|[^а-яё])(ты|тебя|тебе|твой|твоя|твоё|твои)([^а-яё]|$)/i,k)}
 for(const [k,v] of Object.entries(G.T.en)){assert.ok(v&&typeof v==='string',k);assert.doesNotMatch(v,/[а-яё]/i,k)}
 assert.equal(G.t('admit','en'),'Let in');assert.equal(G.t('admit','ru'),'Впустить');assert.equal(G.t('nope','ru'),'nope');
});

/* ---------- A room without a waiting room is the room it always was ---------- */

test('a room without a waiting room sends no notice and seals everything with the code, as before',async()=>{
 const gm=await tab({role:'gm',name:'Мастер'}),eve=await tab({name:'Eve'});
 assert.equal(await gm.R.gate.publishGate(),0);gm.R.auth.publishMember(true);
 const batch=await relay(gm,[]);
 assert.deepEqual(await kinds(gm,batch),['member']);
 assert.equal(JSON.parse((await eve.R.open(batch[0].bytes)).b).t,'member','anybody with the code reads it');
 assert.equal(gm.R.gate.inRoom(),true);assert.equal(gm.R.gate.gateOn(),false);assert.equal(gm.R.gate.roomKey(),null);
 assert.doesNotMatch(gm.R.roomView(),/data-room-gate|🔒/);assert.match(gm.R.roomView(),/data-room-field="gate" >/,'the switch is there, off');
});

test('a page without the waiting room module keeps working and ignores what it does not know',async()=>{
 const gm=await tab({role:'gm',name:'Мастер'}),old=await tab({pin:gm.me.fp,gate:false});
 await gm.R.gate.setGate(true);const batch=await relay(gm,old);
 assert.ok((await kinds(gm,batch)).includes('gate'));
 assert.equal(old.R.session().gate,undefined);assert.equal(old.R.members().size,0);assert.equal(old.notices.length,0);
 old.R.auth.publishMember(true);assert.deepEqual(await kinds(gm,await relay(old,[])),['member']);
 assert.match(old.R.roomView(),/room-columns/);
});

/* ---------- Turning it on ---------- */

test('turning the waiting room on seals the room with a second key and keeps those already in',async()=>{
 const gm=await tab({role:'gm',name:'Мастер'}),p=await tab({pin:gm.me.fp,name:'Ви'}),eve=await tab({name:'Eve'});
 gm.R.auth.publishMember(true);await relay(gm,p);p.R.auth.publishMember(true);await relay(p,gm);
 assert.equal(gm.R.members().get(p.memberId).name,'Ви');
 assert.equal(await gm.R.gate.setGate(true),true);assert.equal(await gm.R.gate.setGate(true),false,'already on');
 const g=gm.R.session().gate;assert.equal(g.on,true);assert.ok(g.admitted[p.me.fp],'whoever was in the room stays');
 assert.equal(JSON.parse(gm.store.get(SESSION)).gate.kid,g.kid,'kept for a reload');
 const batch=await relay(gm,[]),got=await kinds(gm,batch);
 // the key for the one already in goes out before the notice, so their page never shows the waiting screen
 assert.deepEqual(got.slice(0,2),['admit','gate']);assert.ok(got.includes('*member'));
 assert.ok(got.filter(k=>k!=='admit'&&k!=='gate').every(k=>k.startsWith('*')),'everything else is sealed with the room key: '+got);
 // a stranger with the code reads the notice, and nothing of the room
 for(const [i,m] of batch.entries()){
  if(got[i].startsWith('*'))await assert.rejects(eve.R.open(m.bytes),'the code alone does not open '+got[i]);
  else assert.equal(JSON.parse((await eve.R.open(m.bytes)).b).t,got[i]);
 }
 const admit=batch[got.indexOf('admit')],sealed=JSON.parse((await eve.R.open(admit.bytes)).b).d;
 assert.equal(sealed.to,p.memberId);assert.equal(sealed.k,undefined,'the key is not in the open');
 assert.equal(await eve.R.openFromPeer(sealed).catch(()=>null),null,'and only the page it was sealed for can unseal it');
 const notice=JSON.parse((await eve.R.open(batch[got.indexOf('gate')].bytes)).b).d;
 assert.deepEqual(JSON.parse(JSON.stringify(notice)),{on:true,kid:g.kid,name:'Мастер'});
 // the player's page takes the key without a word and goes on
 for(const m of batch)await give(p,m.bytes,m.sub);
 assert.equal(p.R.gate.inRoom(),true);assert.equal(p.R.session().gate.kid,g.kid);assert.equal(p.notices.length,0,'nobody who was in is told they were «let in»');
 assert.equal(p.resubscribed.length,1,'what the brokers keep is asked for again');
 const mine=await relay(p,gm);assert.deepEqual(await kinds(gm,mine),['*member']);
 assert.equal(gm.R.members().get(p.memberId).name,'Ви');assert.equal(gm.R.gate.waiting().size,0);
 assert.match(gm.R.roomView(),/🔒<\/span> Зал ожидания включён/);assert.match(p.R.roomView(),/🔒<\/span> В комнате включён зал ожидания/);
 assert.match(gm.R.roomView(),/data-room-field="gate" checked>/);assert.match(gm.R.roomView(),/data-room-action="gate-remove" data-fp="[0-9a-f]{24}"/);
 assert.doesNotMatch(p.R.roomView(),/gate-remove|data-room-field="gate"/,'a player has neither the switch nor the button');
});

/* ---------- A new device at the door ---------- */

test('a new device waits at the door and sees nothing until the Game Master lets it in',async()=>{
 const {gm,players:[ann],notice}=await table(),n=await tab({pin:gm.me.fp,name:'Новичок',state:{characters:[{id:'c1',name:'Сильверхенд',role:'rockerboy',stats:{}}]}});
 n.R.session().characterId='c1';
 // the room goes on while the newcomer connects
 await gm.R.receive({topic:gm.room.topic+'/c',retain:false,payload:new Uint8Array(40)});
 const live=[{sub:'e',bytes:await forge(gm,ann.me,'e','roll',{who:'Игрок1',label:'Атлетика',detail:'1d10',total:14},{from:ann.memberId,key:gm.R.gate.roomKey()})}];
 for(const m of notice)await give(n,m.bytes,m.sub,{kept:true});
 assert.equal(n.R.gate.gateOn(),true);assert.equal(n.R.gate.inRoom(),false);
 for(const t of [gm,n])await give(t,live[0].bytes,'e');
 assert.equal(gm.R.state().feed[0].label,'Атлетика');assert.equal(n.R.state().feed.length,0,'a roll made in the room does not reach the door');assert.deepEqual(await kinds(gm,live),['*roll']);
 assert.deepEqual([...n.R.members().keys()],[n.memberId],'it sees only itself');
 const asked=await relay(n,[gm,ann]);
 // somebody is at the door right now: the Game Master's page says its notice again, so the newcomer knows it is there
 assert.deepEqual(await kinds(gm,await relay(gm,n)),['gate']);assert.ok(n.R.gate.state().gateHeard>0);assert.match(n.R.roomView(),/Ведущий: <b>Мастер<\/b> · в сети/);
 assert.deepEqual(await kinds(gm,asked),['knock'],'no status, only a request');assert.equal(asked[0].retain,true,'kept for a Game Master who is away');
 const knock=JSON.parse((await gm.R.open(asked[0].bytes)).b).d;
 assert.deepEqual(Object.keys(knock).sort(),['box','cname','name']);assert.equal(knock.name,'Новичок');assert.equal(knock.cname,'Сильверхенд');
 // the Game Master sees who waits; the other player sees nothing of it
 assert.equal(gm.R.gate.waiting().get(n.memberId).name,'Новичок');assert.equal(ann.R.gate.waiting().size,0);assert.equal(ann.R.members().has(n.memberId),false);
 assert.equal(gm.R.members().has(n.memberId),false,'not a member yet');
 assert.deepEqual(gm.notices.splice(0),['Новичок просит впустить в комнату']);
 const view=gm.R.roomView();
 assert.match(view,/data-room-gate>/);assert.match(view,new RegExp('<b>Новичок</b><small>Сильверхенд · ключ устройства <span class="room-gate-key">'+gm.R.keyLabel(n.me.fp)));
 assert.match(view,new RegExp('data-room-action="gate-admit" data-id="'+n.memberId+'"'));assert.match(gm.window.Room.pill(),/room-pill-gate" aria-label="Ждут в зале ожидания">⏳ 1</);
 // the door, as the newcomer sees it
 const door=n.R.roomView();
 assert.match(door,/data-room-lobby=""/);assert.match(door,/Ведущий увидит ваш запрос и впустит вас/);assert.match(door,new RegExp('Ключ этого устройства: <b class="room-gate-key">'+n.R.keyLabel(n.me.fp)));
 assert.doesNotMatch(door,/room-columns|room-team|room-feed|send-sheet|Ведущего пока нет в комнате/);assert.match(n.window.Room.pill(),/title="Ждём, когда ведущий впустит"/);
 // the same request again changes nothing
 n.R.auth.publishMember(true);await relay(n,gm);assert.equal(gm.R.gate.waiting().size,1);assert.equal(gm.notices.length,0);
 // let in: the key travels sealed for that page only
 await gm.press('gate-admit',{id:n.memberId});
 assert.equal(gm.R.gate.waiting().size,0);assert.ok(gm.R.session().gate.admitted[n.me.fp]);
 const answer=await relay(gm,[n,ann]);assert.deepEqual(await kinds(gm,answer),['admit']);
 assert.equal(n.R.gate.inRoom(),true);assert.deepEqual(n.notices.splice(0),['Ведущий впустил вас в комнату.']);assert.equal(n.resubscribed.length,1);
 assert.equal(ann.R.session().gate.kid,gm.R.session().gate.kid,'the answer to somebody else changes nothing for the others');assert.equal(ann.notices.length,0);
 assert.deepEqual(await kinds(gm,await relay(n,[gm,ann])),['*member']);
 assert.equal(gm.R.members().get(n.memberId).character.name,'Сильверхенд');assert.equal(ann.R.members().get(n.memberId).name,'Новичок');
 assert.match(n.R.roomView(),/room-columns/);assert.doesNotMatch(n.R.roomView(),/data-room-lobby/);assert.doesNotMatch(gm.window.Room.pill(),/room-pill-gate/);
});

test('a roll made at the door waits and goes out once the device is let in',async()=>{
 const {gm,notice}=await table({players:0}),n=await tab({pin:gm.me.fp,name:'Новичок'});
 for(const m of notice)await give(n,m.bytes,m.sub,{kept:true});await relay(n,gm);
 n.window.Room.roll({label:'Инициатива',detail:'1d10',total:9});await settle(20);
 assert.equal(n.sent.length,0,'nothing leaves the page');assert.equal(n.R.state().outbox.length,1);assert.equal(n.R.state().feed[0].pending,true);
 gm.R.gate.admitWaiting(n.memberId);await relay(gm,n);
 const out=await relay(n,gm);assert.ok((await kinds(gm,out)).includes('*roll'));
 assert.equal(gm.R.state().feed[0].label,'Инициатива');
});

test('a stranger who has the code neither reads the room nor puts anything into it',async()=>{
 const {gm,players:[ann]}=await table(),eve=await ann.R.newIdentity(),id=eve.fp+'.000000e1',before=ann.R.members().size;
 // sealed with the code alone: a status, a roll, initiative, clocks, a sheet, a whisper, a grant
 for(const [sub,type,d] of [['m/'+id,'member',{name:'Eve',role:'player'}],['e','roll',{who:'Eve',label:'x',total:99}],['c','combat',{campaign:'A',round:9,order:[]}],['k','clocks',{list:[{name:'x',size:4,filled:4}]}],['e','grant',{to:ann.memberId,kind:'damage',amount:99}],['e','whisper',{to:ann.memberId}]]){
  await give(ann,await forge(ann,eve,sub,type,d),sub);await give(gm,await forge(gm,eve,sub,type,d),sub);
 }
 assert.equal(ann.R.members().size,before);assert.equal(ann.R.members().has(id),false);assert.equal(ann.R.state().feed.length,0);assert.equal(ann.R.state().combat,null);assert.equal(ann.R.state().clocks.length,0);
 assert.equal(gm.R.members().has(id),false);assert.equal(gm.R.state().feed.length,0);
 // the Game Master sees her at the door (a page that speaks the old way), a player does not see her at all
 assert.equal(gm.R.gate.waiting().get(id).legacy,true);assert.match(gm.R.roomView(),/страница не обновлена или ещё подключается/);assert.equal(ann.R.gate.waiting().size,0);
 // she claims to be the Game Master and hands out a key of her own
 const fake=await ann.G.newKey(),box=ann.R.gmPub(),kid=ann.R.session().gate.kid;
 await give(ann,await forge(ann,eve,'g','gate',{on:false,name:'Eve'}),'g');
 await give(ann,await forge(ann,eve,'g','gate',{on:true,kid:fake.kid,name:'Eve'}),'g');
 await give(ann,await forge(ann,eve,'e','admit',{to:ann.memberId,...await ann.R.sealFor(box,{k:fake.key,kid:fake.kid})}),'e');
 assert.equal(ann.R.session().gate.kid,kid);assert.equal(ann.R.gate.inRoom(),true);assert.equal(ann.R.session().gmFp,gm.me.fp);
 // even a message she seals with a key of her own, as if it were the room key, opens nothing
 const k=await ann.G.importKey(fake.key);
 await give(ann,await forge(ann,eve,'e','roll',{who:'Eve',label:'x',total:99},{key:k}),'e');assert.equal(ann.R.state().feed.length,0);
});

test('a request to enter cannot be answered for somebody else, by somebody else, or later',async()=>{
 const {gm,notice}=await table({players:0}),n=await tab({pin:gm.me.fp,name:'Новичок'}),other=await tab({pin:gm.me.fp,name:'Сосед'}),eve=await n.R.newIdentity();
 for(const t of [n,other])for(const m of notice)await give(t,m.bytes,m.sub,{kept:true});
 await relay(n,gm);await relay(other,gm);assert.equal(gm.R.gate.waiting().size,2);
 await relay(gm,[]);gm.R.gate.admitWaiting(n.memberId);const [admit]=await relay(gm,[]);
 // the neighbour gets the same bytes: not addressed to it, and sealed for another page
 await give(other,admit.bytes,admit.sub);assert.equal(other.R.gate.inRoom(),false);
 // a copy kept by a broker, and a copy given too late, do not count
 const g=gm.R.session().gate,sealed=await n.R.sealFor(n.R.gmPub(),{k:g.key,kid:g.kid});
 await give(n,await forge(n,gm.me,'e','admit',{to:n.memberId,...sealed},{from:gm.memberId}),'e',{kept:true});assert.equal(n.R.gate.inRoom(),false,'a kept copy');
 await give(n,await forge(n,eve,'e','admit',{to:n.memberId,...sealed}),'e');assert.equal(n.R.gate.inRoom(),false,'not from the Game Master');
 await give(n,await forge(n,gm.me,'e','admit',{to:n.memberId,...sealed},{at:Date.now()-3600000,from:gm.memberId}),'e');assert.equal(n.R.gate.inRoom(),false,'an hour old');
 await give(n,await forge(n,gm.me,'e','admit',{to:n.memberId,...await n.R.sealFor(n.R.gmPub(),{k:g.key,kid:'0'.repeat(16)})},{from:gm.memberId}),'e');assert.equal(n.R.gate.inRoom(),false,'a name that is not this key’s');
 // the real one, live
 await give(n,admit.bytes,admit.sub);assert.equal(n.R.gate.inRoom(),true);
});

/* ---------- Declined, removed, let in again ---------- */

test('a declined device is told so and is not listed again until the Game Master allows it',async()=>{
 const {gm,notice}=await table({players:0}),n=await tab({pin:gm.me.fp,name:'Чужой'});
 for(const m of notice)await give(n,m.bytes,m.sub,{kept:true});await relay(n,gm);await relay(gm,[]);gm.notices.length=0;
 await gm.press('gate-deny',{id:n.memberId});
 assert.equal(gm.R.gate.waiting().size,0);assert.deepEqual(JSON.parse(JSON.stringify(gm.R.session().gate.denied)),[n.me.fp]);
 assert.deepEqual(await kinds(gm,await relay(gm,n)),['deny']);
 assert.equal(n.R.gate.state().knockState,'denied');assert.deepEqual(n.notices.splice(0),['Ведущий не впустил это устройство в комнату.']);
 assert.match(n.R.roomView(),/data-room-lobby="denied"/);assert.match(n.R.roomView(),/data-room-action="gate-again"/);
 // the request is taken back from the brokers
 assert.deepEqual(await kinds(gm,await relay(n,gm)),['left']);
 // asking again reaches nobody while refused
 await n.press('gate-again');assert.equal(n.R.gate.state().knockState,'');
 assert.deepEqual(await kinds(gm,await relay(n,gm)),['knock']);assert.equal(gm.R.gate.waiting().size,0);assert.equal(gm.notices.length,0);
 assert.match(gm.R.roomView(),/Отклонено устройств: 1 <button type="button" class="room-mute" data-room-action="gate-forgive">/);
 await gm.press('gate-forgive');assert.deepEqual(JSON.parse(JSON.stringify(gm.R.session().gate.denied)),[]);assert.doesNotMatch(gm.R.roomView(),/data-room-gate/);
 n.R.auth.publishMember(true);await relay(n,gm);assert.equal(gm.R.gate.waiting().size,1);assert.equal(gm.notices.length,1);
 // a refusal that is not the Game Master's is not one
 const eve=await n.R.newIdentity();await give(n,await forge(n,eve,'e','deny',{to:n.memberId}),'e');assert.equal(n.R.gate.state().knockState,'');
});

test('removing a member replaces the room key: the others get the new one, the removed one does not',async()=>{
 const {gm,players:[ann,bob]}=await table({players:2}),old=gm.R.session().gate.kid,oldKey=gm.R.gate.roomKey();
 assert.equal(gm.R.members().has(bob.memberId),true);assert.equal(ann.R.members().has(bob.memberId),true);
 await gm.press('gate-remove',{fp:bob.me.fp});
 const g=gm.R.session().gate;assert.notEqual(g.kid,old);assert.equal(g.admitted[bob.me.fp],undefined);assert.ok(g.admitted[ann.me.fp]);assert.deepEqual(JSON.parse(JSON.stringify(g.denied)),[bob.me.fp]);
 assert.equal(gm.R.members().has(bob.memberId),false);assert.match(gm.notices.at(-1),/Ключ комнаты сменён/);
 const batch=await relay(gm,[]),got=await kinds(gm,batch);
 assert.equal(got.filter(k=>k==='admit').length,1,'one key, for the one who stays');assert.ok(got.includes('gate'));assert.ok(got.includes('*member'));
 for(const m of batch){await give(ann,m.bytes,m.sub);await give(bob,m.bytes,m.sub)}
 // Ann goes on with the new key and no longer shows Bob
 assert.equal(ann.R.gate.inRoom(),true);assert.equal(ann.R.session().gate.kid,g.kid);assert.equal(ann.notices.length,0);assert.equal(ann.R.members().has(bob.memberId),false);
 await relay(ann,gm);assert.equal(gm.R.members().has(ann.memberId),true);
 // Bob is at the door: he holds no key that opens anything now
 assert.equal(bob.R.gate.inRoom(),false);assert.equal(bob.R.gate.roomKey(),null);assert.equal(bob.R.session().gate.kid,'');assert.equal(bob.R.gate.state().knockState,'rekey');
 assert.match(bob.R.roomView(),/data-room-lobby="rekey"/);assert.match(bob.R.roomView(),/Ключ комнаты сменился/);
 const status=batch[got.indexOf('*member')];
 await assert.rejects(globalThis.crypto.subtle.decrypt({name:'AES-GCM',iv:status.bytes.subarray(0,12)},oldKey,status.bytes.subarray(12)),'the key he was given opens nothing sent after he was removed');
 // his request is refused without a line in the list
 const asked=await relay(bob,[gm,ann]);assert.deepEqual(await kinds(gm,asked),['knock']);assert.equal(gm.R.gate.waiting().size,0);
 assert.deepEqual(await relay(gm,[]),[],'and gets no answer');
 // what he can still say, sealed with the old key, is heard by nobody
 const stale=await forge(ann,bob.me,'e','roll',{who:'Боб',label:'x',total:99},{from:bob.memberId,key:oldKey});
 await give(ann,stale,'e');await give(gm,stale,'e');assert.equal(ann.R.state().feed.length,0);assert.equal(gm.R.state().feed.length,0);
});

test('a page that did not hear the key change asks for the new key by itself and gets it without a question',async()=>{
 const {gm,players:[ann,bob]}=await table({players:2});
 await gm.R.gate.removeMember(bob.me.fp);const batch=await relay(gm,[]),got=await kinds(gm,batch);
 // Ann was away: all that reaches her later is the notice the brokers kept
 const notice=batch[got.indexOf('gate')];await give(ann,notice.bytes,notice.sub,{kept:true});
 assert.equal(ann.R.gate.inRoom(),false);assert.equal(ann.R.gate.state().knockState,'rekey');
 const asked=await relay(ann,gm);assert.deepEqual(await kinds(gm,asked),['knock']);
 assert.equal(gm.R.gate.waiting().size,0,'she is on the list: no question for the Game Master');
 const answer=await relay(gm,ann);assert.deepEqual(await kinds(gm,answer),['admit']);
 assert.equal(ann.R.gate.inRoom(),true);assert.deepEqual(ann.notices,[],"and no «you were let in» either");
 // the same request again, a moment later, is not answered twice
 await give(gm,asked[0].bytes,asked[0].sub,{kept:true});await give(gm,await forge(gm,ann.me,'m/'+ann.memberId,'knock',JSON.parse((await gm.R.open(asked[0].bytes)).b).d,{from:ann.memberId}),'m/'+ann.memberId);
 assert.deepEqual(await relay(gm,[]),[]);
});

test('a device let in once comes back after a reload without asking the Game Master again',async()=>{
 const {gm,players:[ann],notice}=await table();
 // the same browser, a new page: the same signing key, a new member id, a new key to seal answers to
 const again=await tab({pin:gm.me.fp,name:'Игрок1',identity:ann.me});
 assert.notEqual(again.memberId,ann.memberId);assert.notEqual(again.R.gmPub().x,ann.R.gmPub().x);
 for(const m of notice)await give(again,m.bytes,m.sub,{kept:true});
 await relay(again,gm);assert.equal(gm.R.gate.waiting().size,0);
 await relay(gm,again);assert.equal(again.R.gate.inRoom(),true);
 // and a page that kept its session does not even ask: it starts with the key it was given
 const saved=JSON.parse(ann.store.get(SESSION)||'null')||{...ann.R.session()},back=loadRoom();
 back.R.setIdentity(ann.me);back.store.set(SESSION,JSON.stringify({...saved,gate:ann.R.session().gate,memberId:ann.memberId}));
 back.window.Room.attach(back.api);await until(()=>back.sent.length>=1,'the reloaded page speaks');await settle(30);
 assert.equal(back.R.gate.inRoom(),true);assert.equal(back.R.session().gate.kid,gm.R.session().gate.kid);
 const first=back.sent.filter(m=>m.sub.startsWith('m/'));assert.deepEqual(await kinds(gm,first.slice(0,1)),['*member']);
 back.R.disconnect(false);
});

/* ---------- Old words do not come back ---------- */

test('an old notice sent again changes nothing, and a key older than the last notice is refused',async()=>{
 const gm=await tab({role:'gm',name:'Мастер'}),p=await tab({pin:gm.me.fp,name:'Ви'});
 gm.R.auth.publishMember(true);await relay(gm,p);p.R.auth.publishMember(true);await relay(p,gm);
 await gm.R.gate.setGate(true);const first=await relay(gm,p),k1=await kinds(gm,first),on1=first[k1.indexOf('gate')],admit1=first[k1.indexOf('admit')];
 await relay(p,gm);await settle(5);
 await gm.R.gate.setGate(false);const off=await relay(gm,p);assert.equal(p.R.gate.gateOn(),false);assert.equal(p.R.gate.roomKey(),null);
 // somebody who kept the first notice puts it back on the brokers
 await p.R.receive({topic:p.room.topic+'/g',retain:true,payload:on1.bytes});await settle(10);
 assert.equal(p.R.gate.gateOn(),false,'the notice is older than the one taken last');
 await settle(5);await gm.R.gate.setGate(true);const second=await relay(gm,[]),k2=await kinds(gm,second);
 await give(p,second[k2.indexOf('gate')].bytes,'g');assert.equal(p.R.gate.inRoom(),false);
 // the key of the first evening, sealed for this very page, is older than the notice now
 await give(p,admit1.bytes,admit1.sub);assert.equal(p.R.gate.inRoom(),false);assert.equal(p.R.session().gate.kid,'');
 // the key in use is taken although it was signed a moment before the notice that names it
 await give(p,second[k2.indexOf('admit')].bytes,'e');assert.equal(p.R.gate.inRoom(),true);assert.equal(p.R.session().gate.kid,gm.R.session().gate.kid);
 // and the «off» of before does not open the room again
 const k3=await kinds(gm,off);await p.R.receive({topic:p.room.topic+'/g',retain:false,payload:off[k3.indexOf('gate')].bytes});await settle(10);
 assert.equal(p.R.gate.gateOn(),true);
 assert.equal(JSON.parse(p.store.get(SESSION)).gate.at,p.R.gate.state().gateSeenAt,'the time of the last notice survives a reload');
});

test('turning the waiting room off opens the room to the code again',async()=>{
 const {gm,players:[ann]}=await table(),eve=await tab({name:'Eve'});
 assert.equal(await gm.R.gate.setGate(false),true);assert.equal(gm.R.gate.roomKey(),null);assert.equal(gm.R.session().gate.on,false);
 const batch=await relay(gm,ann),got=await kinds(gm,batch);
 assert.equal(got[0],'gate');assert.ok(got.every(k=>!k.startsWith('*')),'sealed with the code again: '+got);
 assert.deepEqual(JSON.parse(JSON.stringify(JSON.parse((await eve.R.open(batch[0].bytes)).b).d)),{on:false,name:'Мастер'});
 assert.equal(ann.R.gate.gateOn(),false);assert.equal(ann.R.gate.inRoom(),true);assert.equal(ann.R.gate.roomKey(),null);
 assert.deepEqual(await kinds(gm,await relay(ann,gm)),['member']);
 assert.doesNotMatch(ann.R.roomView(),/🔒/);assert.match(gm.R.roomView(),/data-room-field="gate" >/);
 // a room that had a waiting room keeps saying it has none, for the pages that were away
 assert.equal(await gm.R.gate.publishGate(),1);
});

/* ---------- The first words of a page ---------- */

test('a player’s first status waits for the notice, so it never leaves sealed with the code alone',async()=>{
 const {gm,notice}=await table({players:0}),n=await tab({pin:gm.me.fp,name:'Новичок'});
 n.R.gate.hold();n.R.auth.publishMember(true);n.R.auth.publishMember();await settle(20);
 assert.equal(n.sent.length,0,'nothing yet');assert.equal(n.R.members().get(n.memberId).me,true,'the page still shows itself');
 for(const m of notice)await give(n,m.bytes,m.sub,{kept:true});
 assert.equal(n.R.gate.state().gateSettled,true);assert.deepEqual(await kinds(gm,await relay(n,[])),['knock']);
 // a page that last heard «no waiting room» waits too, and goes on at once when the brokers still keep that very notice
 const gm2=await tab({role:'gm',name:'Мастер'});await gm2.R.gate.setGate(true);await relay(gm2,[]);await gm2.R.gate.setGate(false);const off=(await relay(gm2,[])).filter(m=>m.sub==='g');
 const was=await tab({pin:gm2.me.fp,name:'Бывалый'});await give(was,off[0].bytes,'g');assert.equal(was.R.session().gate.on,false);was.sent.length=0;
 was.R.gate.hold();was.R.auth.publishMember(true);await settle(20);assert.equal(was.sent.length,0);
 const same=await forge(was,gm2.me,'g','gate',{on:false,name:'Мастер'},{from:gm2.memberId,at:was.R.gate.state().gateSeenAt});
 await give(was,same,'g',{kept:true});assert.equal(was.R.gate.state().gateSettled,true);assert.deepEqual(await kinds(gm,await relay(was,[])),['member']);
 // no notice at all: the room has no waiting room, and the status goes out the usual way
 const free=await tab({pin:gm.me.fp,name:'Свободный'});free.R.gate.hold();free.R.auth.publishMember(true);await settle(20);assert.equal(free.sent.length,0);
 free.R.gate.settle();assert.deepEqual(await kinds(gm,await relay(free,[])),['member']);
});

test('a player who joins by the code alone takes the first Game Master from the notice',async()=>{
 const {gm,notice}=await table({players:0}),n=await tab({name:'Новичок'});
 assert.equal(n.R.session().gmFp,'');
 for(const m of notice)await give(n,m.bytes,m.sub,{kept:true});
 assert.equal(n.R.session().gmFp,gm.me.fp);assert.equal(n.R.session().gmPin,'first');assert.match(n.notices[0],/Ведущий комнаты: Мастер/);
 assert.equal(n.R.gate.inRoom(),false);await relay(n,gm);gm.R.gate.admitWaiting(n.memberId);await relay(gm,n);assert.equal(n.R.gate.inRoom(),true);
 assert.match(n.R.roomView(),/room-columns/);
});

/* ---------- The Game Master changes device ---------- */

test('a handover keeps the waiting room: the new Game Master holds the key and the lists',async()=>{
 const {gm,players:[ann,bob]}=await table({players:2}),stranger='f'.repeat(24);
 gm.R.session().gate.denied.push(stranger);const kid=gm.R.session().gate.kid;
 assert.equal(await gm.R.auth.startHandover(ann.me.fp),true);
 const hand=await relay(gm,[ann,bob]);assert.ok((await kinds(gm,hand)).includes('*handover'));
 const g=ann.R.session().gate;assert.equal(ann.R.session().role,'gm');
 assert.equal(g.kid,kid,'the same room key');assert.ok(g.key);assert.ok(g.admitted[bob.me.fp]);assert.ok(g.admitted[gm.me.fp],'the previous device stays let in');
 assert.equal(g.admitted[ann.me.fp],undefined);assert.deepEqual(JSON.parse(JSON.stringify(g.denied)),[stranger]);
 const said=await relay(ann,[gm,bob]),got=await kinds(ann,said);assert.ok(got.includes('gate'));assert.ok(got.includes('*member'));
 // the previous Game Master is a player who still holds the key; nobody is put back at the door
 assert.equal(gm.R.session().role,'player');assert.equal(gm.R.session().gmFp,ann.me.fp);assert.equal(gm.R.gate.inRoom(),true);assert.equal(gm.R.session().gate.admitted,undefined);
 assert.equal(bob.R.session().gmFp,ann.me.fp);assert.equal(bob.R.gate.inRoom(),true);
 assert.doesNotMatch(gm.R.roomView(),/data-room-field="gate"/);assert.match(ann.R.roomView(),/data-room-field="gate" checked>/);
 // a newcomer is let in by the new Game Master
 const n=await tab({pin:ann.me.fp,name:'Новичок'});await give(n,said[got.indexOf('gate')].bytes,'g',{kept:true});
 await relay(n,[ann,gm]);assert.equal(ann.R.gate.waiting().size,1);assert.equal(gm.R.gate.waiting().size,0,'the previous one no longer keeps the door');
 ann.R.gate.admitWaiting(n.memberId);await relay(ann,n);assert.equal(n.R.gate.inRoom(),true);
});

test('a Game Master file keeps the room closed: the new device makes a new key and lets players in again',async()=>{
 const {gm,players:[ann]}=await table(),kid=gm.R.session().gate.kid;
 await gm.press('gm-file');const file=JSON.parse(gm.downloads[0].text);
 assert.equal(file.gated,true);assert.equal(file.gate,undefined,'neither the key nor the lists are in the file');assert.doesNotMatch(gm.downloads[0].text,new RegExp(gm.R.session().gate.key.slice(0,20).replace(/[+/]/g,'.')));
 const next=loadRoom();assert.equal(await next.R.auth.openGMFile(gm.downloads[0].text,'Мастер'),true);
 const s=next.R.session(),g=s.gate;assert.equal(s.role,'gm');assert.equal(g.on,true);assert.notEqual(g.kid,kid);assert.deepEqual(Object.keys(g.admitted),[]);
 next.room=await next.R.deriveRoom(CODE);next.me=await next.R.ensureIdentity();
 await settle(30);const said=next.sent.splice(0),got=await kinds(next,said);
 assert.ok(got.includes('gate'));assert.ok(got.filter(k=>k!=='gate').every(k=>k.startsWith('*')),'nothing of the room is sealed with the code alone: '+got);
 // a player follows the signed handover and is at the door of the new device
 await give(ann,said[got.indexOf('gate')].bytes,'g');
 assert.equal(ann.R.session().gmFp,next.me.fp);assert.equal(ann.R.gate.inRoom(),false);assert.equal(ann.R.gate.state().knockState,'rekey');
 const asked=ann.sent.splice(0);await settle(20);for(const m of [...asked,...ann.sent.splice(0)])await next.R.receive({topic:next.room.topic+'/'+m.sub,retain:false,payload:m.bytes});await settle(20);
 assert.equal(next.R.gate.waiting().size,1,'asked again, by hand');
 next.R.disconnect(false);
});

test('a file saved before the waiting room was turned on does not open the room: the earlier device’s notice keeps it closed',async()=>{
 const gm=await tab({role:'gm',name:'Мастер'});
 await gm.press('gm-file');assert.equal(JSON.parse(gm.downloads[0].text).gated,undefined);
 await gm.R.gate.setGate(true);const notice=(await relay(gm,[])).filter(m=>m.sub==='g');
 const next=loadRoom();assert.equal(await next.R.auth.openGMFile(gm.downloads[0].text,'Мастер'),true);
 assert.equal(next.R.session().gate,undefined);next.room=await next.R.deriveRoom(CODE);await settle(30);
 const before=await Promise.all(next.sent.splice(0).map(async m=>JSON.parse((await next.R.open(m.bytes)).b).t));assert.ok(!before.includes('gate'),'no notice from a device that knows of no waiting room');
 // a notice signed by a stranger does nothing; the one signed by the device that handed the room on closes it
 const eve=await next.R.newIdentity();await give(next,await forge(next,eve,'g','gate',{on:true,kid:'0'.repeat(16),name:'Eve'}),'g',{kept:true});assert.equal(next.R.session().gate,undefined);
 await give(next,notice[0].bytes,'g',{kept:true});await until(()=>next.R.gate.gateOn(),'the room stays closed');
 assert.notEqual(next.R.session().gate.kid,gm.R.session().gate.kid);assert.match(next.notices.at(-1),/зал ожидания, он остался включённым/);
 next.R.disconnect(false);
});

/* ---------- The switch and the create form ---------- */

test('a room is created with a waiting room when the box is ticked, and only then',async()=>{
 const fields={'#room-gm-name':{value:'Мастер'},'#room-gate':{checked:true}},t=loadRoom({fields});
 assert.match(t.window.Room.render(),/<input type="checkbox" id="room-gate"> Зал ожидания: впускать игроков вручную/);
 await t.press('create');await until(()=>t.R.session(),'the room exists');await settle(30);
 const g=t.R.session().gate;assert.equal(g.on,true);assert.match(g.kid,/^[0-9a-f]{16}$/);assert.equal(t.R.gate.inRoom(),true);
 t.room=await t.R.deriveRoom(t.R.session().code);const got=await kinds(t,t.sent.splice(0));
 assert.ok(got.includes('gate'),'the notice goes out with the first words');assert.ok(got.filter(k=>k!=='gate').every(k=>k.startsWith('*')),'and nothing of the room is sealed with the code alone: '+got);
 t.R.disconnect(false);
 const plain=loadRoom({fields:{'#room-gm-name':{value:'Мастер'},'#room-gate':{checked:false}}});
 await plain.press('create');await until(()=>plain.R.session(),'the room exists');assert.equal(plain.R.session().gate,undefined);plain.R.disconnect(false);
});

test('the switch asks before it changes who can see the room',async()=>{
 let answer=false;const asked=[],gm=await tab({role:'gm',name:'Мастер',confirm:q=>{asked.push(q);return answer}});
 await gm.change('gate',{checked:true});await settle(30);
 assert.equal(gm.R.gate.gateOn(),false,'«no» leaves the room as it was');assert.match(asked[0],/Включить зал ожидания\?/);
 answer=true;await gm.change('gate',{checked:true});await until(()=>gm.R.gate.gateOn(),'on');
 answer=false;await gm.change('gate',{checked:false});await settle(30);assert.equal(gm.R.gate.gateOn(),true);assert.match(asked.at(-1),/Выключить зал ожидания\?/);
 answer=true;await gm.change('gate',{checked:false});await until(()=>!gm.R.gate.gateOn(),'off');
 // a player's page has no such switch, and pressing one changes nothing
 const p=await tab({pin:gm.me.fp});await p.change('gate',{checked:true});await settle(30);assert.equal(p.R.gate.gateOn(),false);assert.equal(await p.R.gate.setGate(true),false);
 await p.press('gate-admit',{id:'x'});await p.press('gate-remove',{fp:gm.me.fp});assert.equal(p.R.session().gate,undefined);
});

test('«let everyone in» admits the whole queue, and the texts follow the language',async()=>{
 const {gm,notice}=await table({players:0}),a=await tab({pin:gm.me.fp,name:'A'}),b=await tab({pin:gm.me.fp,name:'B',lang:'en'});
 for(const t of [a,b]){for(const m of notice)await give(t,m.bytes,m.sub,{kept:true});await relay(t,gm)}
 assert.match(gm.R.roomView(),/data-room-action="gate-admit-all">Впустить всех</);assert.match(b.R.roomView(),/The Game Master will see your request and let you in/);
 await gm.press('gate-admit-all');assert.equal(gm.R.gate.waiting().size,0);
 await relay(gm,[a,b]);assert.equal(a.R.gate.inRoom(),true);assert.equal(b.R.gate.inRoom(),true);assert.deepEqual(b.notices,['The Game Master let you into the room.']);
 // names from other devices are text, never markup
 const x=await tab({pin:gm.me.fp,name:'<img src=x onerror=1>'});for(const m of notice)await give(x,m.bytes,m.sub,{kept:true});await relay(x,gm);
 assert.doesNotMatch(gm.R.roomView(),/<img src=x/);assert.match(gm.R.roomView(),/&lt;img src=x onerror=1&gt;/);
});
