const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const CODE='K7RQM2XAPZ9E';
// One browser tab with its own module state. Long timers are not allowed to keep node running.
function loadRoom({hash=''}={}){
 const listeners={},store=new Map(),document={addEventListener(type,f){(listeners[type]||=[]).push(f)},querySelector:()=>null,visibilityState:'visible'};
 const later=(f,ms)=>{const h=setTimeout(f,ms);if(ms>=1000)h.unref?.();return h};
 const window={document,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},crypto:globalThis.crypto,location:{hash,origin:'https://example.test',pathname:'/'},addEventListener(){},confirm:()=>true,navigator:{},btoa,atob};
 const ctx={window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Error,setTimeout:later,clearTimeout,setInterval,clearInterval,console};
 vm.runInNewContext(read('room-transport.js')+'\n'+read('room.js'),ctx);
 const R=window.Room._test,notices=[],sent=[];
 R.setApp({getState:()=>({lang:'ru',characters:[],campaigns:[]}),notify:m=>notices.push(m)});
 R.setTransport({publish:(sub,bytes,retain)=>{sent.push({sub,bytes,retain});return 1},close(){}});
 const press=async(action,data={})=>{for(const f of listeners.click||[])await f({target:{closest:sel=>sel==='[data-room-action]'?{dataset:{roomAction:action,...data}}:null}})};
 return {window,R,notices,sent,store,press};
}
const settle=(ms=40)=>new Promise(ok=>setTimeout(ok,ms));
// A room seen by a player, plus other devices that can sign: the trusted Game Master, a second player and an outsider with the code.
async function scene({role='player',pinned=true}={}){
 const tab=loadRoom(),R=tab.R,room=await R.deriveRoom(CODE);R.setKey(room.key);
 const me=await R.ensureIdentity(),gm=await R.newIdentity(),bob=await R.newIdentity(),eve=await R.newIdentity();
 const id=(who,sid='000000a1')=>who.fp+'.'+sid;
 R.setSession({code:CODE,role,name:'V',memberId:id(me,'000000b1'),gmFp:role==='gm'?me.fp:pinned?gm.fp:'',gmPin:role==='gm'?'self':pinned?'link':'',toasts:false},room.topic);
 let n=0;
 const bytes=(who,sub,t,d,{at=Date.now(),mid,from=id(who),topic=room.topic,key=room.key}={})=>R.signedEnvelope(who,from,topic,key,sub,t,d,at,mid||'m'+(n++));
 const give=async(who,sub,t,d,opt={})=>{await R.receive({topic:room.topic+'/'+(opt.onto||sub),retain:!!opt.retain,payload:await bytes(who,sub,t,d,opt)});await settle(5)};
 return {...tab,room,me,gm,bob,eve,id,bytes,give};
}
const ORDER={campaign:'A',round:2,order:[{name:'Ганг',init:12,current:true}]};

test('a member id is the fingerprint of the signing key plus a short suffix',async()=>{
 const {R}=loadRoom(),a=await R.newIdentity(),b=await R.newIdentity();
 assert.match(a.fp,/^[0-9a-f]{24}$/);assert.notEqual(a.fp,b.fp);assert.equal(await R.fingerprint(a.pub),a.fp);
 assert.equal((await R.ensureIdentity()).fp,(await R.ensureIdentity()).fp,'one key per page');
 assert.equal(R.keyLabel('0123456789abcdef01234567'),'0123-4567-89AB');assert.equal(R.keyLabel('nope'),'—');
});

test('nobody can speak as someone else: the id must match the key that signed',async()=>{
 const s=await scene();
 await s.give(s.gm,'c','combat',ORDER);assert.equal(s.R.state().combat.round,2,'the Game Master is heard');
 // An outsider who knows the room code signs with their own key but writes the Game Master's id.
 await s.give(s.eve,'c','combat',{...ORDER,round:9},{from:s.id(s.gm)});assert.equal(s.R.state().combat.round,2);
 await s.give(s.eve,'m/'+s.id(s.bob),'member',{name:'Fake Bob',role:'player'},{from:s.id(s.bob)});assert.equal(s.R.members().has(s.id(s.bob)),false);
 // Their own id is fine, but they are not the Game Master.
 await s.give(s.eve,'c','combat',{...ORDER,round:9});assert.equal(s.R.state().combat.round,2);
 await s.give(s.eve,'k','clocks',{list:[{name:'x',size:4,filled:4}]});assert.equal(s.R.state().clocks.length,0);
});

test('a changed message, a message moved to another subtopic or taken from another room is dropped',async()=>{
 const s=await scene(),good=await s.bytes(s.gm,'c','combat',ORDER);
 // moved: signed for the clocks subtopic, delivered as initiative
 await s.give(s.gm,'k','combat',ORDER,{onto:'c'});assert.equal(s.R.state().combat,null);
 // another room: signed for a different topic, sealed with this room's key
 await s.R.receive({topic:s.room.topic+'/c',retain:false,payload:await s.bytes(s.gm,'c','combat',ORDER,{topic:'ncred/v2/ffffffffffffffffffffffff'})});await settle(5);assert.equal(s.R.state().combat,null);
 // changed after signing: re-seal a body with one digit altered
 const outer=await s.R.open(good),forged={...outer,b:outer.b.replace('"round":2','"round":7')};assert.notEqual(forged.b,outer.b);
 await s.R.receive({topic:s.room.topic+'/c',retain:false,payload:await s.R.seal(forged)});await settle(5);assert.equal(s.R.state().combat,null);
 await s.R.receive({topic:s.room.topic+'/c',retain:false,payload:good});await settle(5);assert.equal(s.R.state().combat.round,2,'the untouched one is accepted');
 // unsigned or half-made envelopes
 for(const junk of [{v:3,b:outer.b},{v:3,s:outer.s},{v:3,b:'{',s:outer.s},{v:3,b:JSON.stringify({id:'x',from:'short',t:'combat',at:Date.now(),d:{},pk:{}}),s:outer.s}])await s.R.receive({topic:s.room.topic+'/c',retain:false,payload:await s.R.seal(junk)});
 await settle(5);assert.equal(s.R.state().combat.round,2);
});

test('only the Game Master named by the link is the Game Master',async()=>{
 const s=await scene();
 await s.give(s.eve,'m/'+s.id(s.eve),'member',{name:'Eve',role:'gm',pub:{x:'A'.repeat(43),y:'B'.repeat(43)}});
 const eve=s.R.members().get(s.id(s.eve));assert.equal(eve.role,'player');assert.equal(eve.impostor,true);assert.equal(eve.pub,null,'her sheet key is not taken');
 await s.give(s.gm,'m/'+s.id(s.gm),'member',{name:'Мастер',role:'gm'});
 const gm=s.R.members().get(s.id(s.gm));assert.equal(gm.role,'gm');assert.equal(gm.impostor,false);
 const view=s.R.roomView();assert.match(view,/называет себя ведущим/);assert.match(view,/Кто-то ещё называет себя ведущим/);
 assert.match(view,new RegExp('его ключ: <b>'+s.R.keyLabel(s.gm.fp)+'</b>'));
 // a second tab of the Game Master's own browser has the same key and is accepted too
 await s.give(s.gm,'m/'+s.id(s.gm,'000000a2'),'member',{name:'Мастер 2',role:'gm'},{from:s.id(s.gm,'000000a2')});assert.equal(s.R.members().get(s.id(s.gm,'000000a2')).role,'gm');
});

test('joining by code alone remembers the first Game Master met, and says so',async()=>{
 const s=await scene({pinned:false});
 await s.give(s.bob,'c','combat',ORDER);assert.equal(s.R.state().combat,null,'nobody is trusted yet');
 await s.give(s.gm,'m/'+s.id(s.gm),'member',{name:'Мастер',role:'gm'});
 assert.equal(s.R.session().gmFp,s.gm.fp);assert.equal(s.R.session().gmPin,'first');
 assert.equal(s.notices.length,1);assert.match(s.notices[0],new RegExp('Ведущий комнаты: Мастер\\. Его ключ '+s.R.keyLabel(s.gm.fp)+' запомнен'));
 await s.give(s.eve,'m/'+s.id(s.eve),'member',{name:'Eve',role:'gm'});
 assert.equal(s.R.members().get(s.id(s.eve)).impostor,true);assert.equal(s.R.session().gmFp,s.gm.fp,'the first one stays');assert.equal(s.notices.length,1);
 assert.match(s.R.roomView(),/Ключ ведущего запомнен при входе/);
});

test('the room link names the Game Master key; an invitation can be a code, a code with the key, or a link',async()=>{
 const s=await scene({role:'gm'});
 assert.equal(s.R.roomLink(CODE),'https://example.test/#/room/K7RQ-M2XA-PZ9E.'+s.me.fp);
 assert.match(s.R.roomView(),new RegExp('Ваш ключ ведущего: <b>'+s.R.keyLabel(s.me.fp)+'</b>'));
 const pin='0123456789abcdef01234567';
 assert.deepEqual(plain(s.R.parseInvite('K7RQ-M2XA-PZ9E')),{code:CODE,pin:''});assert.deepEqual(plain(s.R.parseInvite(' k7rq m2xa pz9e ')),{code:CODE,pin:''});
 assert.deepEqual(plain(s.R.parseInvite('K7RQ-M2XA-PZ9E.'+pin)),{code:CODE,pin});
 assert.deepEqual(plain(s.R.parseInvite('https://example.test/#/room/K7RQ-M2XA-PZ9E.'+pin)),{code:CODE,pin});
 for(const bad of ['','K7RQ','K7RQ-M2XA-PZ9E.zzzz','.'+pin])assert.equal(s.R.parseInvite(bad),null,bad);
 // opening the link fills the join form and keeps the key for the join
 const tab=loadRoom({hash:'#/room/K7RQ-M2XA-PZ9E.'+pin});
 assert.match(tab.window.Room.render(),/value="K7RQ-M2XA-PZ9E"/);assert.match(tab.window.Room.render(),/Ссылка называет ключ ведущего: <b>0123-4567-89AB<\/b>/);
});

test('old events and repeats are dropped; a leave marker cannot be older than the last status',async()=>{
 const s=await scene(),roll={who:'Bob',label:'Evasion',detail:'1d10 5 + 6',total:11};
 await s.give(s.bob,'m/'+s.id(s.bob),'member',{name:'Bob',role:'player'});
 await s.give(s.bob,'e','roll',roll,{mid:'r1'});assert.equal(s.R.state().feed.length,1);
 await s.give(s.bob,'e','roll',roll,{mid:'r1'});assert.equal(s.R.state().feed.length,1,'the same message twice');
 await s.give(s.bob,'e','roll',roll,{at:Date.now()-11*60000});assert.equal(s.R.state().feed.length,1,'a roll from eleven minutes ago');
 await s.give(s.bob,'e','roll',roll,{at:Date.now()+11*60000});assert.equal(s.R.state().feed.length,1,'a roll from the future');
 await s.give(s.bob,'e','roll',roll,{at:Date.now()-5*60000});assert.equal(s.R.state().feed.length,2,'a late one within the window');
 await s.give(s.bob,'m/'+s.id(s.bob),'left',{},{at:Date.now()-60000});assert.equal(s.R.members().has(s.id(s.bob)),true,'an old goodbye replayed');
 await s.give(s.bob,'m/'+s.id(s.bob),'left',{});assert.equal(s.R.members().has(s.id(s.bob)),false);
});

test('a flood from one sender is cut off without hurting the others',async()=>{
 const s=await scene(),roll={who:'x',label:'spam',detail:'',total:1};
 for(let i=0;i<60;i++)await s.R.receive({topic:s.room.topic+'/e',retain:false,payload:await s.bytes(s.eve,'e','roll',roll)});
 await settle();const got=s.R.state().feed.length;assert.ok(got>=25&&got<=35,`about thirty get through, got ${got}`);
 await s.give(s.bob,'e','roll',{...roll,label:'Bob'});assert.equal(s.R.state().feed[0].label,'Bob','another sender is still heard');
 // everything at once: a cap before any decryption
 s.R.flood().at=Date.now();s.R.flood().n=120;const before=s.R.state().feed.length;
 await s.R.receive({topic:s.room.topic+'/e',retain:false,payload:await s.bytes(s.bob,'e','roll',roll)});assert.equal(s.R.state().feed.length,before);
});

test('a hidden member is dropped until shown again; the Game Master cannot be hidden',async()=>{
 const s=await scene();
 await s.give(s.gm,'m/'+s.id(s.gm),'member',{name:'Мастер',role:'gm'});await s.give(s.eve,'m/'+s.id(s.eve),'member',{name:'Eve',role:'player'});
 assert.match(s.R.memberCard(s.id(s.eve),s.R.members().get(s.id(s.eve))),/data-room-action="mute" data-fp="[0-9a-f]{24}"/);
 assert.doesNotMatch(s.R.memberCard(s.id(s.gm),s.R.members().get(s.id(s.gm))),/data-room-action="mute"/);
 await s.press('mute',{fp:s.eve.fp});
 assert.equal(s.R.members().has(s.id(s.eve)),false);assert.deepEqual(plain(s.R.session().muted),[s.eve.fp]);
 await s.give(s.eve,'e','roll',{who:'Eve',label:'x',detail:'',total:1});await s.give(s.eve,'m/'+s.id(s.eve),'member',{name:'Eve',role:'player'});
 assert.equal(s.R.state().feed.length,0);assert.equal(s.R.members().has(s.id(s.eve)),false);assert.match(s.R.roomView(),/Скрыто участников: 1/);
 await s.press('mute',{fp:s.gm.fp});assert.equal(s.R.muted().has(s.gm.fp),false);
 await s.press('unmute-all');await s.give(s.eve,'m/'+s.id(s.eve),'member',{name:'Eve',role:'player'});assert.equal(s.R.members().has(s.id(s.eve)),true);
});

test('a page on the previous protocol is named instead of being silently invisible',async()=>{
 const s=await scene();
 const old=await s.R.seal({v:2,id:'o1',from:'abc',t:'member',at:Date.now(),d:{name:'Old'}});
 await s.R.receive({topic:s.room.topic+'/m/abc',retain:true,payload:old});await s.R.receive({topic:s.room.topic+'/m/abc',retain:true,payload:old});
 assert.equal(s.notices.length,1);assert.match(s.notices[0],/старая версия приложения/);assert.equal(s.R.members().size,0);assert.match(s.R.roomView(),/старая версия приложения/);
});

test('messages are padded to a few fixed sizes',async()=>{
 const s=await scene(),sizes=new Set();
 // 28 bytes are the nonce and the tag of the room encryption.
 for(const d of [{},{who:'B',label:'Evasion',total:5},{name:'N'.repeat(40),role:'player',character:{name:'Ви',hp:40}}])sizes.add((await s.bytes(s.bob,'e','roll',d)).length-28);
 assert.deepEqual([...sizes],[512],'an empty message, a roll and a status look the same');
 assert.equal((await s.bytes(s.bob,'e','roll',{detail:'z'.repeat(400)})).length-28,1024);
 assert.equal((await s.bytes(s.bob,'e','roll',{detail:'z'.repeat(1500)})).length-28,2048);
 assert.equal(s.R.padded('{"a":1}').length,512);assert.equal(new TextEncoder().encode(s.R.padded('{"a":"'+'я'.repeat(300)+'"}')).length,1024,'sizes are counted in bytes');
 assert.deepEqual(JSON.parse(s.R.padded('{"a":1}')),{a:1});
});

test('leaving a room still sends the goodbye although the key is cleared at once',async()=>{
 const s=await scene();s.sent.length=0;
 await s.press('leave');await settle(80);
 const bye=s.sent.find(x=>x.sub==='m/'+s.id(s.me,'000000b1'));assert.ok(bye,'a leave marker was published');assert.equal(bye.retain,true);
 // another page of the room reads it as a signed goodbye from that member
 const other=await scene();other.R.members().set(s.id(s.me,'000000b1'),{name:'V',role:'player',sentAt:0,at:Date.now()});
 other.R.setSession({...other.R.session(),gmFp:''},other.room.topic);
 await other.R.receive({topic:other.room.topic+'/'+bye.sub,retain:true,payload:bye.bytes});await settle(5);
 assert.equal(other.R.members().has(s.id(s.me,'000000b1')),false);
});

test('a dropped connection is announced by the broker, and a member who is still there answers',async()=>{
 const T=loadRoom().window.RoomTransport,payload=new Uint8Array([1,2,3,4]);
 const withWill=T.encode.connect({clientId:'c1',username:'u',password:'p',will:{topic:'room/m/x',payload}}),without=T.encode.connect({clientId:'c1',username:'u',password:'p'});
 // fixed header (2 bytes), protocol name (6), level (1), then the connect flags
 assert.equal(without[9],0xC2);assert.equal(withWill[9],0xC6,'the will flag is set, QoS 0, not retained');
 const text=Buffer.from(withWill).toString('latin1');assert.ok(text.indexOf('c1')<text.indexOf('room/m/x')&&text.indexOf('room/m/x')<text.indexOf('\x00\x04\x01\x02\x03\x04')&&text.indexOf('\x01\x02\x03\x04')<text.lastIndexOf('u'),'client id, will topic, will message, then the login');
 assert.equal(T.encode.connect({clientId:'c1',will:{topic:'t',payload:'not bytes'}})[9],0x02,'a malformed will is left out');

 const s=await scene();
 await s.give(s.bob,'m/'+s.id(s.bob),'member',{name:'Bob',role:'player'});const bob=s.R.members().get(s.id(s.bob));
 assert.equal(s.R.isOnline(bob),true);
 const dropped=Date.now()-3600000; // a will is made when the connection opens, so it can be old
 await s.give(s.bob,'m/'+s.id(s.bob),'gone',{},{at:dropped});
 assert.equal(s.R.isOnline(bob),true,'for a few seconds the member may still answer');
 bob.suspectAt=Date.now()-9000;bob.at=bob.suspectAt-1000;assert.equal(s.R.isOnline(bob),false,'no newer status: offline at once, not after two minutes');
 await s.give(s.bob,'m/'+s.id(s.bob),'member',{name:'Bob',role:'player'});assert.equal(s.R.isOnline(s.R.members().get(s.id(s.bob))),true,'a newer status clears it');
 await s.give(s.bob,'m/'+s.id(s.bob),'gone',{},{at:dropped,mid:'again'});assert.equal(s.R.members().get(s.id(s.bob)).suspectAt,undefined,'the same old notice replayed does nothing');
 // this page's own notice arriving through another broker: it says at once that it is still here
 s.sent.length=0;await s.R.receive({topic:s.room.topic+'/m/'+s.id(s.me,'000000b1'),retain:false,payload:await s.bytes(s.me,'m/'+s.id(s.me,'000000b1'),'gone',{},{from:s.id(s.me,'000000b1')})});await settle();
 assert.ok(s.sent.some(x=>x.sub==='m/'+s.id(s.me,'000000b1')&&x.retain),'the member status is published again');
});
