/* Online rooms: the Game Master changes device (a signed handover, live or through a file) and appoints a co-GM.
   The rule under test everywhere: nothing but a signature of the key a page already trusts moves that trust. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const CODE='K7RQM2XAPZ9E';
// One browser tab with its own module state and its own signing key. Long timers are not allowed to keep node running.
function loadRoom({auth=true,lang='ru',state}={}){
 const listeners={},store=new Map(),downloads=[],document={addEventListener(type,f){(listeners[type]||=[]).push(f)},querySelector:()=>null,visibilityState:'visible'};
 const later=(f,ms)=>{const h=setTimeout(f,ms);if(ms>=1000)h.unref?.();return h},every=(f,ms)=>{const h=setInterval(f,ms);h.unref?.();return h};
 const window={document,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},crypto:globalThis.crypto,location:{hash:'',origin:'https://example.test',pathname:'/'},addEventListener(){},confirm:()=>true,navigator:{},btoa,atob,scrollTo(){}};
 const ctx={window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Error,setTimeout:later,clearTimeout,setInterval:every,clearInterval,console};
 vm.runInNewContext(read('room-transport.js')+'\n'+(auth?read('room-auth.js')+'\n':'')+read('room.js'),ctx);
 const R=window.Room._test,notices=[],sent=[],app={lang,characters:[],campaigns:[],...(state||{})};
 R.setApp({getState:()=>app,notify:m=>notices.push(m)});
 const wire={publish:(sub,bytes,retain)=>{sent.push({sub,bytes,retain});return 1},close(){}};
 R.setTransport(wire);
 // A session started for real (the Game Master file) connects through this instead of public brokers.
 window.RoomTransport={create:()=>wire};
 if(window.RoomAuth)window.RoomAuth.download=(name,text)=>downloads.push({name,text});
 const press=async(action,data={})=>{for(const f of listeners.click||[])await f({target:{closest:sel=>sel==='[data-room-action]'?{dataset:{roomAction:action,...data},disabled:false}:null}})};
 return {window,R,A:window.RoomAuth,notices,sent,store,press,app,downloads};
}
const settle=(ms=40)=>new Promise(ok=>setTimeout(ok,ms));
const until=async(f,what='condition')=>{for(let i=0;i<200;i++){if(await f())return;await settle(10)}assert.fail('timed out: '+what)};
const id=(who,sid='000000a1')=>who.fp+'.'+sid;
// A tab that is in the room. pin: the Game Master key it trusts (a player), or nothing for the Game Master itself.
async function tab({role='player',pin='',name='V',state,lang}={}){
 const t=loadRoom({state,lang}),R=t.R,room=await R.deriveRoom(CODE);R.setKey(room.key);
 const me=await R.ensureIdentity();
 R.setSession({code:CODE,role,name,memberId:id(me,'000000b1'),gmFp:role==='gm'?me.fp:pin,gmPin:role==='gm'?'self':pin?'link':'',toasts:false},room.topic);
 let n=0;
 // What some other device (a bare key) would send.
 const bytes=(who,sub,type,d,{at=Date.now(),from=id(who)}={})=>R.signedEnvelope(who,from,room.topic,room.key,sub,type,d,at,'x'+(n++)+Math.random().toString(16).slice(2,8));
 const give=async(who,sub,type,d,opt={})=>{await R.receive({topic:room.topic+'/'+sub,retain:!!opt.retain,payload:await bytes(who,sub,type,d,opt)});await settle(5)};
 return {...t,room,me,bytes,give};
}
// Everything one tab has published so far reaches the others, as a broker would relay it.
// (Signing is asynchronous, so what was just published is given a moment to reach the wire.)
async function relay(from,...to){await settle(15);const batch=from.sent.splice(0);for(const m of batch)for(const t of to)await t.R.receive({topic:t.room.topic+'/'+m.sub,retain:false,payload:m.bytes});await settle(10)}
const ORDER={campaign:'A',round:2,order:[{name:'Ганг',init:12,current:true}]};
const CLOCKS={list:[{name:'Облава',size:4,filled:1}]};
const GM={name:'Мастер',role:'gm'};

/* ---------- The chain of handovers ---------- */

test('a chain of handovers is accepted only whole, signed, for this room and from the trusted key to the key that shows it',async()=>{
 const {R,A}=loadRoom(),a=await R.newIdentity(),b=await R.newIdentity(),c=await R.newIdentity(),eve=await R.newIdentity(),room='ncred/v2/aaaaaaaaaaaaaaaaaaaaaaaa';
 const ab=await A.extend(null,a,b.pub,room),abc=await A.extend(ab,b,c.pub,room);
 assert.deepEqual(JSON.parse(JSON.stringify(await A.verifyChain(ab,{room,root:a.fp,leaf:b.fp}))),{at:JSON.parse(ab[0].b).at,links:1});
 assert.equal((await A.verifyChain(abc,{room,root:a.fp,leaf:c.fp})).links,2,'two handovers in a row');
 assert.equal((await A.verifyChain(abc,{room,root:b.fp,leaf:c.fp})).links,1,'a page that already trusts the middle key needs only the rest');
 assert.equal(await A.leafOf(abc),c.fp);assert.equal(await A.leafOf([{b:'{}',s:''}]),'');
 const no=async(chain,opt,why)=>assert.equal(await A.verifyChain(chain,{room,root:a.fp,leaf:b.fp,...opt}),null,why);
 await no(ab,{room:'ncred/v2/bbbbbbbbbbbbbbbbbbbbbbbb'},'made for another room');
 await no(ab,{root:eve.fp},'does not start at the trusted key');
 await no(ab,{leaf:eve.fp},'does not end at the key that shows it');
 await no(abc,{},'a longer chain ends at somebody else');
 await no(ab,{after:JSON.parse(ab[0].b).at},'not newer than the handover accepted last');
 await no([],{},'empty');await no('x',{},'not a list');await no([{b:'{',s:'AA'}],{},'junk');await no([null],{},'junk');
 // signed by somebody who is not the «from» key
 const forged=await A.signHandover(eve.privateKey,a.pub,b.pub,room,Date.now());await no([forged],{},'signature of another key');
 // changed after signing: the room or the receiver replaced
 const o=JSON.parse(ab[0].b);await no([{b:JSON.stringify({...o,to:eve.pub}),s:ab[0].s}],{leaf:eve.fp},'receiver replaced');
 await no([{b:ab[0].b,s:ab[0].s.slice(0,-4)+'AAAA'}],{},'signature damaged');
 // a gap: a→b followed by c→eve
 const ce=await A.extend(null,c,eve.pub,room);await no([ab[0],ce[0]],{leaf:eve.fp},'links do not join');
 // a later link must be newer than the one before it
 const early=await A.signHandover(b.privateKey,b.pub,c.pub,room,JSON.parse(ab[0].b).at-5);await no([ab[0],early],{leaf:c.fp},'time runs backwards');
 // a valid tail does not make up for an unsigned start: the part from the trusted key on is what is checked
 const fakeStart=await A.signHandover(eve.privateKey,a.pub,eve.pub,room,Date.now()),tail=await A.extend(null,eve,b.pub,room);
 await no([fakeStart,{...tail[0],b:tail[0].b}],{},'forged first link');
 let chain=null,who=a;for(let i=0;i<A.MAX_CHAIN;i++){const next=await R.newIdentity();chain=await A.extend(chain,who,next.pub,room);who=next}
 assert.equal(chain.length,A.MAX_CHAIN);assert.ok(await A.verifyChain(chain,{room,root:a.fp,leaf:who.fp}));
 await assert.rejects(A.extend(chain,who,eve.pub,room),/chain_full/);
 assert.equal(await A.verifyChain([...chain,...ab],{room,root:a.fp,leaf:b.fp}),null,'too long');
});

/* ---------- A player meets a new Game Master device ---------- */

test('a new device is the Game Master only with a handover signed by the key from the link',async()=>{
 const old=await loadRoom().R.newIdentity(),s=await tab({pin:old.fp}),A=s.A,R=s.R,next=await R.newIdentity(),eve=await R.newIdentity();
 await s.give(old,'m/'+id(old),'member',GM);await s.give(old,'c','combat',ORDER);
 assert.equal(R.members().get(id(old)).role,'gm');assert.equal(R.state().combat.round,2);
 const impostor=()=>{const m=R.members().get(id(eve));assert.equal(m.role,'player');assert.equal(m.impostor,true);assert.equal(R.session().gmFp,old.fp)};
 // no proof at all
 await s.give(eve,'m/'+id(eve),'member',{...GM,name:'Eve'});impostor();
 // a chain she signed herself: from her own key, or «from the Game Master» with her signature
 await s.give(eve,'m/'+id(eve),'member',{...GM,proof:await A.extend(null,eve,eve.pub,s.room.topic)});impostor();
 await s.give(eve,'m/'+id(eve),'member',{...GM,proof:[await A.signHandover(eve.privateKey,old.pub,eve.pub,s.room.topic,Date.now())]});impostor();
 // a real handover, but made for another room, or made for another device and copied
 await s.give(eve,'m/'+id(eve),'member',{...GM,proof:await A.extend(null,old,eve.pub,'ncred/v2/ffffffffffffffffffffffff')});impostor();
 const real=await A.extend(null,old,next.pub,s.room.topic);
 await s.give(eve,'m/'+id(eve),'member',{...GM,proof:real});impostor();
 for(const junk of ['x',{},[1,2],[{b:'x',s:'y'}],new Array(50).fill(real[0])]){await s.give(eve,'m/'+id(eve),'member',{...GM,proof:junk});impostor()}
 await s.give(eve,'c','combat',{...ORDER,round:9});await s.give(eve,'k','clocks',CLOCKS);assert.equal(R.state().combat.round,2);assert.equal(R.state().clocks.length,0);
 assert.equal(s.notices.length,0);
 // the device the Game Master really signed for
 await s.give(next,'m/'+id(next),'member',{...GM,name:'Мастер (ноутбук)',proof:real});
 assert.equal(R.session().gmFp,next.fp);assert.equal(R.session().gmPin,'handover');assert.equal(R.session().gmAt,JSON.parse(real[0].b).at);
 assert.equal(R.members().get(id(next)).role,'gm');assert.equal(R.members().get(id(next)).impostor,false);
 assert.equal(R.members().get(id(old)).role,'player','the previous device is no longer shown as the Game Master');
 assert.equal(s.notices.length,1);assert.match(s.notices[0],new RegExp('Новый ключ '+R.keyLabel(next.fp)+' подтверждён'));
 assert.match(R.roomView(),new RegExp('Ведущий сменил устройство; его новый ключ: <b>'+R.keyLabel(next.fp)+'</b>'));
 assert.equal(JSON.parse(s.store.get('nightcity-red-room-v1')).gmFp,next.fp,'remembered after a reload');
 // initiative and clocks now come from the new key, and no longer from the old one
 await s.give(next,'c','combat',{...ORDER,round:3});assert.equal(R.state().combat.round,3);
 await s.give(next,'k','clocks',CLOCKS);assert.equal(R.state().clocks.length,1);
 await s.give(old,'c','combat',{...ORDER,round:7});assert.equal(R.state().combat.round,3);
 await s.give(old,'m/'+id(old),'member',GM);assert.equal(R.members().get(id(old)).impostor,true,'the old key alone proves nothing any more');
});

test('an old handover cannot be shown again to take the role back',async()=>{
 const a=await loadRoom().R.newIdentity(),s=await tab({pin:a.fp}),A=s.A,R=s.R,b=await R.newIdentity();
 const ab=await A.extend(null,a,b.pub,s.room.topic),aba=await A.extend(ab,b,a.pub,s.room.topic);
 await s.give(b,'m/'+id(b),'member',{...GM,proof:ab});assert.equal(R.session().gmFp,b.fp);
 // b hands the room back to a
 await s.give(a,'m/'+id(a),'member',{...GM,proof:aba});assert.equal(R.session().gmFp,a.fp);
 // b tries the first handover again
 await s.give(b,'m/'+id(b),'member',{...GM,proof:ab});
 assert.equal(R.session().gmFp,a.fp);assert.equal(R.members().get(id(b)).impostor,true);
 await s.give(b,'c','combat',ORDER);assert.equal(R.state().combat,null);
 // a hands over to b once more: a new signature is accepted
 await s.give(b,'m/'+id(b),'member',{...GM,proof:await A.extend(aba,a,b.pub,s.room.topic)});assert.equal(R.session().gmFp,b.fp);
});

test('a player who joined by code alone and has met nobody yet is not moved by a chain',async()=>{
 const s=await tab({pin:''}),R=s.R,a=await R.newIdentity(),b=await R.newIdentity();
 await s.give(b,'m/'+id(b),'member',{...GM,proof:await s.A.extend(null,a,b.pub,s.room.topic)});
 assert.equal(R.session().gmFp,b.fp);assert.equal(R.session().gmPin,'first','the first one met is remembered as before; the chain adds nothing');
});

test('without room-auth.js the room works as before and ignores proofs',async()=>{
 const t=loadRoom({auth:false}),R=t.R,room=await R.deriveRoom(CODE);R.setKey(room.key);
 const me=await R.ensureIdentity(),gm=await R.newIdentity(),eve=await R.newIdentity();
 R.setSession({code:CODE,role:'player',name:'V',memberId:id(me),gmFp:gm.fp,gmPin:'link',toasts:false},room.topic);
 await R.receive({topic:room.topic+'/m/'+id(eve),retain:false,payload:await R.signedEnvelope(eve,id(eve),room.topic,room.key,'m/'+id(eve),'member',{...GM,proof:[{b:'{}',s:''}],deputy:eve.fp},Date.now(),'q1')});await settle(5);
 assert.equal(R.members().get(id(eve)).impostor,true);assert.equal(R.session().gmFp,gm.fp);assert.doesNotThrow(()=>R.roomView());
});

/* ---------- Handing over live, device to device ---------- */

test('the Game Master hands the room to a device in it; players follow without a new link and the old device steps down',async()=>{
 const gm=await tab({role:'gm',name:'Мастер'}),phone=await tab({pin:gm.me.fp,name:'Телефон мастера'}),player=await tab({pin:gm.me.fp,name:'Игрок'});
 gm.R.auth.publishMember(true);phone.R.auth.publishMember(true);player.R.auth.publishMember(true);
 await relay(gm,phone,player);await relay(phone,gm,player);await relay(player,gm,phone);
 assert.match(phone.R.roomView(),new RegExp('Ключ этого устройства: <b>'+phone.R.keyLabel(phone.me.fp)+'</b>'),'the device shows the key the Game Master compares');
 assert.match(gm.R.memberCard(id(phone.me,'000000b1'),gm.R.members().get(id(phone.me,'000000b1'))),/data-room-action="handover" data-fp="[0-9a-f]{24}"/);
 assert.doesNotMatch(player.R.roomView(),/data-room-action="(handover|co-grant)"/,'players get no such buttons');
 await gm.press('handover',{fp:phone.me.fp});
 assert.equal(gm.R.session().role,'gm','still the Game Master until the new device answers');assert.equal(gm.R.session().handoverTo.fp,phone.me.fp);
 assert.match(gm.R.roomView(),/Ведение передаётся устройству «Телефон мастера»/);assert.match(gm.R.roomView(),/data-room-action="handover-cancel"/);
 const offer=gm.sent.filter(m=>m.sub==='e');assert.equal(offer.length,1);
 // the other player gets the same message and must not take the role
 await relay(gm,phone,player);
 assert.equal(player.R.session().role,'player');
 await until(()=>phone.R.session().role==='gm','the phone takes over');
 assert.equal(phone.R.session().gmFp,phone.me.fp);assert.equal(phone.R.session().gmChain.length,1);assert.match(phone.notices.join('|'),/теперь вы ведущий/);
 assert.equal(phone.R.roomLink(CODE),'https://example.test/#/room/K7RQ-M2XA-PZ9E.'+phone.me.fp,'new invitations name the new key');
 assert.ok(phone.R.auth.memberPayload().pub,'it can receive sheets');
 await relay(phone,gm,player);
 assert.equal(player.R.session().gmFp,phone.me.fp);assert.equal(player.R.members().get(id(phone.me,'000000b1')).role,'gm');
 assert.equal(gm.R.session().role,'player');assert.equal(gm.R.session().gmFp,phone.me.fp);assert.equal(gm.R.session().handoverTo,undefined);assert.equal(gm.R.session().gmChain,undefined);
 assert.match(gm.notices.join('|'),/Здесь вы теперь игрок/);
 await relay(gm,phone,player);
 assert.equal(player.R.members().get(id(gm.me,'000000b1')).role,'player');assert.equal(player.R.members().get(id(gm.me,'000000b1')).impostor,false);
 // the old device no longer sets anything
 gm.R.auth.publishCombat(true);assert.equal(gm.sent.filter(m=>m.sub==='c').length,0);
 // and the role can travel on: phone → the first device again, with a longer chain
 await phone.press('handover',{fp:gm.me.fp});await relay(phone,gm,player);
 await until(()=>gm.R.session().role==='gm','back on the first device');assert.equal(gm.R.session().gmChain.length,2);
 await relay(gm,phone,player);assert.equal(player.R.session().gmFp,gm.me.fp);assert.equal(phone.R.session().role,'player');
});

test('a handover message counts only from the trusted Game Master and only for the device it names',async()=>{
 const gmKey=await loadRoom().R.newIdentity(),s=await tab({pin:gmKey.fp}),A=s.A,R=s.R,eve=await R.newIdentity(),other=await R.newIdentity();
 const mine=await A.extend(null,gmKey,s.me.pub,s.room.topic);
 // somebody else relays a real chain, or sends one she signed
 await s.give(eve,'e','handover',{to:s.me.fp,chain:await A.extend(null,eve,s.me.pub,s.room.topic)});
 await s.give(eve,'e','handover',{to:s.me.fp,chain:[await A.signHandover(eve.privateKey,gmKey.pub,s.me.pub,s.room.topic,Date.now())]});
 // the Game Master's message for another device, or with a chain that ends elsewhere
 await s.give(gmKey,'e','handover',{to:other.fp,chain:await A.extend(null,gmKey,other.pub,s.room.topic)});
 await s.give(gmKey,'e','handover',{to:s.me.fp,chain:await A.extend(null,gmKey,other.pub,s.room.topic)});
 await s.give(gmKey,'e','handover',{to:s.me.fp,chain:'junk'});
 // too old to act on
 await s.give(gmKey,'e','handover',{to:s.me.fp,chain:mine},{at:Date.now()-3600000});
 await settle(30);assert.equal(R.session().role,'player');assert.equal(s.sent.length,0);
 await s.give(gmKey,'e','handover',{to:s.me.fp,chain:mine});
 await until(()=>R.session().role==='gm','the real one works');
 assert.ok(s.sent.some(m=>m.sub.startsWith('m/')),'and the new Game Master announces itself');
});

test('a handover that nobody answered can be cancelled; the Game Master stays',async()=>{
 const gm=await tab({role:'gm'}),bobKey=await gm.R.newIdentity();
 await gm.give(bobKey,'m/'+id(bobKey),'member',{name:'Боб',role:'player'});
 await gm.press('handover',{fp:bobKey.fp});assert.ok(gm.R.session().handoverTo);
 assert.doesNotMatch(gm.R.roomView(),/data-room-action="handover" /,'one handover at a time');
 gm.sent.length=0;await gm.R.auth.sendHandover();assert.equal(gm.sent.length,1,'repeated on the heartbeat');
 await gm.press('handover-cancel');assert.equal(gm.R.session().handoverTo,undefined);assert.equal(gm.R.session().role,'gm');
 gm.sent.length=0;await gm.R.auth.sendHandover();assert.equal(gm.sent.length,0);
 // nobody can be handed the room who is not in it, and not oneself
 assert.equal(await gm.R.auth.startHandover('0123456789abcdef01234567'),false);assert.equal(await gm.R.auth.startHandover(gm.me.fp),false);
 const player=await tab({pin:gm.me.fp});assert.equal(await player.R.auth.startHandover(bobKey.fp),false,'a player cannot hand over anything');
});

/* ---------- The Game Master file ---------- */

test('the Game Master file opens the room as the Game Master in another browser; players accept it',async()=>{
 const gm=await tab({role:'gm',name:'Мастер'}),player=await tab({pin:gm.me.fp});
 await gm.press('gm-file');
 assert.equal(gm.downloads.length,1);assert.match(gm.downloads[0].name,/^night-city-room-K7RQ-gm\.json$/);assert.match(gm.notices.join('|'),/Храните его как пароль/);
 const text=gm.downloads[0].text,file=JSON.parse(text);
 assert.equal(file.format,'nightcity-red-room-gm');assert.equal(file.code,CODE);assert.equal(file.chain.length,1);assert.equal(typeof file.key.d,'string');
 assert.match(gm.R.roomView(),/data-room-action="gm-file"/);assert.doesNotMatch(player.R.roomView(),/data-room-action="gm-file"/);
 // another browser: no session, its own key
 const fresh=loadRoom(),R=fresh.R;R.setApp({getState:()=>fresh.app,notify:m=>fresh.notices.push(m)});
 assert.match(fresh.window.Room.render(),/data-room-action="gm-file-open"/);
 assert.equal(await R.auth.openGMFile(text,'Мастер дома'),true);
 const s=R.session(),me=await R.ensureIdentity();
 assert.equal(s.role,'gm');assert.equal(s.code,CODE);assert.equal(s.name,'Мастер дома');assert.equal(s.gmFp,me.fp);assert.equal(s.gmChain.length,2);
 assert.ok(!JSON.stringify(s).includes(file.key.d),'the spare secret is not kept');
 assert.equal(JSON.parse(fresh.store.get('nightcity-red-room-v1')).gmChain.length,2,'the proof survives a reload');
 await until(()=>fresh.sent.some(m=>m.sub.startsWith('m/')),'announces itself');
 const freshTab={...fresh,room:player.room};
 await relay(freshTab,player,gm);
 assert.equal(player.R.session().gmFp,me.fp);assert.equal(player.R.session().gmPin,'handover');
 assert.equal(gm.R.session().role,'player','the previous device steps down when it is still open');
 // the same file again, on a third device: players who follow the new Game Master do not accept it any more
 const third=loadRoom();assert.equal(await third.R.auth.openGMFile(text,''),true);assert.equal(third.R.session().name,'Мастер','the name saved in the file');
 await until(()=>third.sent.some(m=>m.sub.startsWith('m/')),'announces itself');
 await relay({...third,room:player.room},player);
 assert.equal(player.R.session().gmFp,me.fp);assert.equal([...player.R.members().values()].filter(m=>m.impostor).length,1);
 fresh.window.Room._test.setTransport(null);third.window.Room._test.setTransport(null);
});

test('a damaged, foreign or made-up Game Master file is refused',async()=>{
 const gm=await tab({role:'gm'}),file=await gm.R.auth.saveGMFile(),A=gm.A,eve=await gm.R.newIdentity();
 assert.ok(A.parseFile(JSON.stringify(file)));
 const bad=[
  '','{','[]','null',JSON.stringify({...file,format:'other'}),JSON.stringify({...file,v:2}),JSON.stringify({...file,code:'short'}),JSON.stringify({...file,code:'K7RQM2XAPZ9O'}),
  JSON.stringify({...file,chain:[]}),JSON.stringify({...file,chain:'x'}),JSON.stringify({...file,key:{...file.key,d:undefined}}),JSON.stringify({...file,key:{...file.key,crv:'P-384'}}),
  JSON.stringify(file)+' '.repeat(30000),
 ];
 for(const text of bad)assert.equal(A.parseFile(text),null,text.slice(0,40));
 const open=async o=>{const t=loadRoom();const ok=await t.R.auth.openGMFile(JSON.stringify(o),'X');return {ok,t}};
 // a spare key that the chain does not end at (somebody put their own key into a copied file)
 const pair=await globalThis.crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),j=await globalThis.crypto.subtle.exportKey('jwk',pair.privateKey);
 let r=await open({...file,key:{kty:'EC',crv:'P-256',x:j.x,y:j.y,d:j.d}});assert.equal(r.ok,false);assert.equal(r.t.R.session(),null);assert.match(r.t.notices.join('|'),/не файл ведущего комнаты/);
 // a secret that does not belong to the public half named in the file
 r=await open({...file,key:{...file.key,d:j.d}});assert.equal(r.ok,false);
 // a file for another room code: the chain was signed for the first room
 r=await open({...file,code:'K7RQM2XAPZ9F'});assert.equal(r.ok,false);
 // a file somebody made up from their own keys works only as their own room: the pinned players do not follow
 const forged=await A.makeFile({chain:null,me:eve,room:gm.room.topic,code:CODE,name:'Eve'});
 r=await open(forged);assert.equal(r.ok,true);
 const player=await tab({pin:gm.me.fp});
 await until(()=>r.t.sent.some(m=>m.sub.startsWith('m/')),'announces itself');await relay({...r.t,room:player.room},player);
 assert.equal(player.R.session().gmFp,gm.me.fp);assert.equal([...player.R.members().values()][0].impostor,true);
 r.t.R.setTransport(null);
});

test('a saved proof that does not belong to this browser key is dropped, and the file respects the chain limit',async()=>{
 const gm=await tab({role:'gm'}),A=gm.A,other=await gm.R.newIdentity();
 assert.equal(await A.leafOf(await A.extend(null,other,gm.me.pub,gm.room.topic)),gm.me.fp);
 let chain=null,who=other;for(let i=0;i<A.MAX_CHAIN-1;i++){const next=await gm.R.newIdentity();chain=await A.extend(chain,who,next.pub,gm.room.topic);who=next}
 chain=await A.extend(chain,who,gm.me.pub,gm.room.topic);gm.R.session().gmChain=chain;
 assert.equal(await gm.R.auth.saveGMFile(),null);assert.match(gm.notices.join('|'),/слишком много раз/);assert.equal(gm.downloads.length,0);
});

/* ---------- A co-GM ---------- */

test('initiative and clocks are accepted from the co-GM the Game Master named, and from nobody who names themselves',async()=>{
 const gm=await loadRoom().R.newIdentity(),s=await tab({pin:gm.fp}),R=s.R,bob=await R.newIdentity(),eve=await R.newIdentity(),t0=Date.now()-60000;
 await s.give(gm,'m/'+id(gm),'member',GM,{at:t0});
 await s.give(bob,'m/'+id(bob),'member',{name:'Боб',role:'player'});
 await s.give(bob,'c','combat',ORDER);await s.give(bob,'k','clocks',CLOCKS);assert.equal(R.state().combat,null);assert.equal(R.state().clocks.length,0);
 // claims that do not come from the Game Master
 await s.give(eve,'m/'+id(eve),'member',{name:'Eve',role:'player',deputy:eve.fp});
 await s.give(eve,'m/'+id(eve),'member',{name:'Eve',role:'gm',deputy:eve.fp});
 await s.give(eve,'c','combat',ORDER);assert.equal(R.state().combat,null);assert.equal(R.auth.deputyFp(),'');
 // the Game Master names Bob
 await s.give(gm,'m/'+id(gm),'member',{...GM,deputy:bob.fp},{at:t0+1000});
 assert.equal(R.auth.deputyFp(),bob.fp);assert.match(R.memberCard(id(bob),R.members().get(id(bob))),/room-badge co">Со-ведущий/);
 await s.give(bob,'c','combat',ORDER);assert.equal(R.state().combat.round,2);
 await s.give(bob,'k','clocks',CLOCKS);assert.equal(R.state().clocks.length,1);
 await s.give(eve,'c','combat',{...ORDER,round:9});assert.equal(R.state().combat.round,2,'others still are not heard');
 await s.give(gm,'c','combat',{...ORDER,round:3});assert.equal(R.state().combat.round,3,'the Game Master still is');
 // sheets and their answers stay with the Game Master: a co-GM's «accepted» is not believed
 await s.give(bob,'e','sheet-ack',{to:R.session().memberId,name:'X'});assert.equal(s.notices.length,0);
 assert.equal(R.members().get(id(bob)).role,'player');assert.equal(R.members().get(id(bob)).pub,null);
 // rights taken back
 await s.give(gm,'m/'+id(gm),'member',GM,{at:t0+2000});
 assert.equal(R.auth.deputyFp(),'');
 await s.give(bob,'c','combat',{...ORDER,round:8});await s.give(bob,'k','cleared',{});assert.equal(R.state().combat.round,3);assert.equal(R.state().clocks.length,1);
 // Bob sends the Game Master's earlier status again (he knows the room code, so he can re-seal the signed text)
 await s.give(gm,'m/'+id(gm),'member',{...GM,deputy:bob.fp},{at:t0+1000});
 assert.equal(R.auth.deputyFp(),'','an older status changes nothing');
 // even after the Game Master left the room and their entry is gone
 await s.give(gm,'m/'+id(gm),'left',{},{at:t0+3000});assert.equal(R.members().has(id(gm)),false);
 await s.give(gm,'m/'+id(gm),'member',{...GM,deputy:bob.fp},{at:t0+1000});
 assert.equal(R.auth.deputyFp(),'');await s.give(bob,'c','combat',{...ORDER,round:8});assert.equal(R.state().combat.round,3);
 assert.equal(JSON.parse(s.store.get('nightcity-red-room-v1')).deputyFp,'');
});

test('a change of Game Master ends the co-GM appointment',async()=>{
 const gm=await loadRoom().R.newIdentity(),s=await tab({pin:gm.fp}),R=s.R,bob=await R.newIdentity(),next=await R.newIdentity();
 await s.give(gm,'m/'+id(gm),'member',{...GM,deputy:bob.fp});assert.equal(R.auth.deputyFp(),bob.fp);
 await s.give(next,'m/'+id(next),'member',{...GM,proof:await s.A.extend(null,gm,next.pub,s.room.topic)});
 assert.equal(R.session().gmFp,next.fp);assert.equal(R.auth.deputyFp(),'');
 await s.give(bob,'c','combat',ORDER);assert.equal(R.state().combat,null);
 // the old key can no longer name anyone
 await s.give(gm,'m/'+id(gm),'member',{...GM,deputy:bob.fp});assert.equal(R.auth.deputyFp(),'');
 // the new one can
 await s.give(next,'m/'+id(next),'member',{...GM,deputy:bob.fp});assert.equal(R.auth.deputyFp(),bob.fp);
 // a pin replaced by hand (another link) also drops the appointment
 R.session().gmFp=gm.fp;assert.equal(R.auth.deputyFp(),'');
});

test('the Game Master grants and revokes; the co-GM runs initiative and clocks from their own campaign',async()=>{
 const camp={id:'c1',name:'Ночь',round:4,turnIndex:0,roster:[{kind:'npc',name:'Бозо',initiative:15,order:1}]};
 const gm=await tab({role:'gm',name:'Мастер'}),co=await tab({pin:gm.me.fp,name:'Помощник',state:{campaigns:[camp]}}),player=await tab({pin:gm.me.fp,name:'Игрок'});
 co.window.GMExtras={sharedClocks:()=>[{name:'Тревога',size:6,filled:2}]};
 for(const t of [gm,co,player])t.R.auth.publishMember(true);
 await relay(gm,co,player);await relay(co,gm,player);await relay(player,gm,co);
 const coCard=()=>gm.R.memberCard(id(co.me,'000000b1'),gm.R.members().get(id(co.me,'000000b1')));
 assert.match(coCard(),/data-room-action="co-grant"[^>]*aria-pressed="false">Сделать со-ведущим/);
 assert.equal(co.R.auth.drives(),false);co.R.session().campaignId='c1';co.R.auth.publishCombat(true);co.R.auth.publishClocks(true);assert.equal(co.sent.length,0,'a player publishes neither');
 assert.doesNotMatch(co.R.roomView(),/data-room-field="campaign"/);
 await gm.press('co-grant',{fp:co.me.fp});
 assert.equal(gm.R.auth.deputyFp(),co.me.fp);assert.match(coCard(),/data-room-action="co-revoke"[^>]*aria-pressed="true">Забрать права со-ведущего/);assert.match(gm.R.roomView(),/Со-ведущий назначен/);
 await settle(20);assert.equal(gm.sent.filter(m=>m.sub==='c'||m.sub==='k').length,0,'granting does not wipe the table');
 await relay(gm,co,player);
 assert.equal(co.R.auth.amDeputy(),true);assert.match(co.notices.join('|'),/права со-ведущего/);assert.equal(player.R.auth.deputyFp(),co.me.fp);assert.equal(player.notices.length,0);
 assert.match(co.R.roomView(),/data-room-field="campaign"/);assert.match(co.R.roomView(),/Вы со-ведущий/);assert.match(co.R.roomView(),/игрок · Со-ведущий/);
 // right after the grant nothing is pushed over the Game Master's table; the first change is
 await settle(20);assert.equal(co.sent.length,0);
 camp.round=5;co.window.Room.changed();await until(()=>co.sent.some(m=>m.sub==='c'),'the co-GM publishes a change');
 co.window.GMExtras={sharedClocks:()=>[{name:'Тревога',size:6,filled:3}]};co.R.auth.publishClocks();await settle(20);
 await relay(co,gm,player);
 assert.equal(player.R.state().combat.round,5);assert.equal(player.R.state().combat.order[0].name,'Бозо');assert.equal(player.R.state().clocks[0].filled,3);
 assert.equal(gm.R.state().combat.round,5,'the Game Master sees the co-GM table too');
 // heartbeats: the one who changed last repeats, the other keeps quiet
 co.R.auth.publishCombat(true);await settle(20);assert.equal(co.sent.filter(m=>m.sub==='c').length,1);co.sent.length=0;
 gm.R.auth.publishCombat(true);gm.R.auth.publishClocks(true);await settle(20);assert.equal(gm.sent.filter(m=>m.sub==='c'||m.sub==='k').length,0,'no «cleared» over the co-GM');
 // revoke: the Game Master's own (empty) table replaces the co-GM's, and the co-GM is no longer heard
 await gm.press('co-revoke');await settle(20);
 assert.equal(gm.R.auth.deputyFp(),'');assert.equal(gm.sent.filter(m=>m.sub==='c').length,1);
 await relay(gm,co,player);
 assert.equal(player.R.auth.deputyFp(),'');assert.equal(player.R.state().combat,null);assert.equal(player.R.state().clocks.length,0);
 assert.equal(co.R.auth.amDeputy(),false);assert.match(co.notices.join('|'),/забрал у вас права/);
 camp.round=6;co.R.auth.publishCombat(true);await settle(20);assert.equal(co.sent.filter(m=>m.sub==='c').length,0,'no rights, nothing sent');
 // what the co-GM signed while it had the rights does not come back afterwards
 await player.give(co.me,'c','combat',{...ORDER,round:9},{from:id(co.me,'000000b1')});assert.equal(player.R.state().combat,null);
 // a player cannot grant
 await player.press('co-grant',{fp:co.me.fp});assert.equal(player.R.auth.deputyFp(),'');
});

/* ---------- Old signed messages sent again, clocks that disagree, old links ---------- */

const raw=(t,sub,payload,retain=false)=>t.R.receive({topic:t.room.topic+'/'+sub,retain,payload}).then(()=>settle(5));

test('a revoked co-GM cannot bring the rights back with the Game Master\'s old status, even when the Game Master clock runs ahead',async()=>{
 const gm=await loadRoom().R.newIdentity(),s=await tab({pin:gm.fp}),R=s.R,bob=await R.newIdentity(),AHEAD=5*60000;
 const grant=await s.bytes(gm,'m/'+id(gm),'member',{...GM,deputy:bob.fp},{at:Date.now()+AHEAD});
 await raw(s,'m/'+id(gm),grant);assert.equal(R.auth.deputyFp(),bob.fp);
 await settle(20);
 await s.give(gm,'m/'+id(gm),'member',GM,{at:Date.now()+AHEAD});assert.equal(R.auth.deputyFp(),'');
 await s.give(bob,'c','combat',{...ORDER,round:7});assert.equal(R.state().combat,null);
 await raw(s,'m/'+id(gm),grant);assert.equal(R.auth.deputyFp(),'','the same message again');
 // Bob floods the room with messages of his own until the page forgets the ids it has seen, then sends the grant once more
 for(let i=0;i<2001;i++){R.flood().n=0;await R.receive({topic:s.room.topic+'/e',retain:false,payload:await s.bytes(bob,'e','roll',{total:1},{from:bob.fp+'.'+(i%7).toString(16).padStart(8,'0')})})}
 await raw(s,'m/'+id(gm),grant);
 assert.equal(R.auth.deputyFp(),'','an older status of the Game Master is older by the Game Master\'s own clock');
 R.buckets().clear();await s.give(bob,'c','combat',{...ORDER,round:7});assert.equal(R.state().combat,null);
 // the Game Master's old initiative cannot be sent again either
 const first=await s.bytes(gm,'c','combat',{...ORDER,round:3},{at:Date.now()+AHEAD});await raw(s,'c',first);
 await settle(10);await s.give(gm,'c','combat',{...ORDER,round:4},{at:Date.now()+AHEAD});assert.equal(R.state().combat.round,4);
 for(let i=0;i<2001;i++){R.flood().n=0;await R.receive({topic:s.room.topic+'/e',retain:false,payload:await s.bytes(bob,'e','roll',{total:1},{from:bob.fp+'.'+(i%7).toString(16).padStart(8,'0')})})}
 await raw(s,'c',first);assert.equal(R.state().combat.round,4);
});

test('a page that has just joined takes a co-GM only from a status the Game Master signed just now',async()=>{
 const gm=await loadRoom().R.newIdentity(),s=await tab({pin:gm.fp}),R=s.R,bob=await R.newIdentity();
 // the rights were taken back since; Bob put the Game Master's earlier status back on the broker
 await s.give(gm,'m/'+id(gm),'member',{...GM,deputy:bob.fp},{at:Date.now()-11*60000,retain:true});
 assert.equal(R.members().get(id(gm)).role,'gm');assert.equal(R.auth.deputyFp(),'');
 await s.give(bob,'c','combat',{...ORDER,round:7});assert.equal(R.state().combat,null);
 await s.give(gm,'c','combat',{...ORDER,round:1},{at:Date.now()-30000,retain:true});assert.equal(R.state().combat.round,1,'the Game Master\'s own table is shown');
 // a status from the Game Master that is online names the co-GM as usual, and a stale copy naming somebody else ends the appointment
 await s.give(gm,'m/'+id(gm),'member',{...GM,deputy:bob.fp},{at:Date.now()-20000});assert.equal(R.auth.deputyFp(),bob.fp);
 const t=await tab({pin:gm.fp}),eve=await t.R.newIdentity();
 await t.give(gm,'m/'+id(gm),'member',{...GM,deputy:bob.fp},{at:Date.now()-900000+1000});assert.equal(t.R.auth.deputyFp(),'');
 await t.give(gm,'m/'+id(gm),'member',{...GM,deputy:bob.fp},{at:Date.now()-60000});assert.equal(t.R.auth.deputyFp(),bob.fp);
 t.R.auth.noteDeputy(eve.fp,Date.now()-50000,false);assert.equal(t.R.auth.deputyFp(),'','a newer status that is not live takes the rights from Bob and gives them to nobody');
});

test('with clocks that disagree the Game Master is still heard after a co-GM, and a revoke removes the co-GM table',async()=>{
 const gm=await loadRoom().R.newIdentity(),s=await tab({pin:gm.fp}),R=s.R,bob=await R.newIdentity(),BEHIND=120000,late=()=>({at:Date.now()-BEHIND});
 await s.give(gm,'m/'+id(gm),'member',{...GM,deputy:bob.fp},late());
 await s.give(bob,'c','combat',{...ORDER,round:7});await s.give(bob,'k','clocks',CLOCKS);assert.equal(R.state().combat.round,7);assert.equal(R.state().clocks.length,1);
 // a change made at the same moment: every page must pick the same one, so the times decide
 await s.give(gm,'c','combat',{...ORDER,round:1},late());assert.equal(R.state().combat.round,7);
 // a change that comes well after the co-GM's is a new one, whatever the Game Master's clock says
 R.auth.age(6000);
 await s.give(gm,'c','combat',{...ORDER,round:2},late());assert.equal(R.state().combat.round,2);
 await s.give(gm,'k','cleared',{},late());assert.equal(R.state().clocks.length,0);
 // …but not a copy a broker kept, and not the co-GM's earlier message sent again
 const old=await s.bytes(bob,'c','combat',{...ORDER,round:8});await raw(s,'c',old);assert.equal(R.state().combat.round,8);
 R.auth.age(6000);await s.give(gm,'c','combat',{...ORDER,round:3},{at:Date.now()-BEHIND,retain:true});assert.equal(R.state().combat.round,8);
 await s.give(gm,'c','combat',{...ORDER,round:4},late());assert.equal(R.state().combat.round,4);
 R.auth.age(6000);for(let i=0;i<2001;i++){R.flood().n=0;await R.receive({topic:s.room.topic+'/e',retain:false,payload:await s.bytes(bob,'e','roll',{total:1},{from:bob.fp+'.'+(i%7).toString(16).padStart(8,'0')})})}
 await raw(s,'c',old);assert.equal(R.state().combat.round,4,'the co-GM cannot put an earlier table back');
 R.buckets().clear();
 // the symmetric case: the co-GM's clock is the one behind
 const u=await tab({pin:gm.fp});
 await u.give(gm,'m/'+id(gm),'member',{...GM,deputy:bob.fp});await u.give(gm,'c','combat',{...ORDER,round:4});
 await u.give(bob,'c','combat',{...ORDER,round:5},late());assert.equal(u.R.state().combat.round,4);
 u.R.auth.age(6000);await u.give(bob,'c','combat',{...ORDER,round:6},late());assert.equal(u.R.state().combat.round,6);
 // revoke right after a co-GM change: the Game Master's table replaces it at once
 await s.give(bob,'c','combat',{...ORDER,round:9});await s.give(bob,'k','clocks',CLOCKS);assert.equal(R.state().combat.round,9);
 await s.give(gm,'m/'+id(gm),'member',GM,late());assert.equal(R.auth.deputyFp(),'');
 await s.give(gm,'c','cleared',{},late());assert.equal(R.state().combat,null);
 await s.give(gm,'k','cleared',{},late());assert.equal(R.state().clocks.length,0);
 await s.give(gm,'c','combat',{...ORDER,round:1},late());assert.equal(R.state().combat.round,1);
});

test('after a handover the earlier invitation link changes nothing; a link to another key starts from a clean slate',async()=>{
 const a=await loadRoom().R.newIdentity(),s=await tab({pin:a.fp}),A=s.A,R=s.R,b=await R.newIdentity(),c=await R.newIdentity();
 const asked=[];s.window.confirm=m=>{asked.push(m);return true};
 const ab=await A.extend(null,a,b.pub,s.room.topic);
 await s.give(b,'m/'+id(b),'member',{...GM,proof:ab});assert.equal(R.session().gmFp,b.fp);
 // the player opens the first invitation again: it names the key the handover led away from
 assert.equal(R.auth.adoptPin(a.fp),false);
 assert.equal(asked.length,0,'nothing to ask');assert.equal(R.session().gmFp,b.fp);assert.equal(R.session().gmPin,'handover');
 await s.give(b,'m/'+id(b),'member',{...GM,proof:ab});assert.equal(R.members().get(id(b)).role,'gm');assert.equal(R.members().get(id(b)).impostor,false);
 // also after the role went further, and after a reload
 const abc=await A.extend(ab,b,c.pub,s.room.topic);
 await s.give(c,'m/'+id(c),'member',{...GM,proof:abc});assert.equal(R.session().gmFp,c.fp);
 assert.deepEqual([...JSON.parse(s.store.get('nightcity-red-room-v1')).gmWas],[a.fp,b.fp]);
 assert.equal(R.auth.adoptPin(a.fp),false);assert.equal(R.auth.adoptPin(b.fp),false);assert.equal(asked.length,0);assert.equal(R.session().gmFp,c.fp);
 // a link that names a key this page never followed is still a question, and a yes forgets the old handover time
 const d=await R.newIdentity(),e=await R.newIdentity();
 assert.equal(R.auth.adoptPin(d.fp),true);assert.equal(asked.length,1);
 assert.equal(R.session().gmFp,d.fp);assert.equal(R.session().gmPin,'link');assert.equal(R.session().gmAt,undefined);assert.equal(R.session().gmWas,undefined);
 // …so a handover the new key signed at any time is accepted (its clock may be behind the old Game Master's)
 await s.give(e,'m/'+id(e),'member',{...GM,proof:[await A.signHandover(d.privateKey,d.pub,e.pub,s.room.topic,JSON.parse(ab[0].b).at-60000)]});
 assert.equal(R.session().gmFp,e.fp);
});

test('a page that joins later learns from the Game Master which handovers are spent',async()=>{
 const a=await tab({role:'gm',name:'A'}),A=a.A,bobKey=await a.R.newIdentity(),topic=a.room.topic;
 assert.equal(a.R.auth.memberPayload().since,undefined,'nothing to say in a room that was never handed over');
 // a handover that was cancelled: the device it was signed for keeps the signed chain
 await a.give(bobKey,'m/'+id(bobKey),'member',{name:'Боб',role:'player'});
 await a.press('handover',{fp:bobKey.fp});const kept=a.R.session().handoverTo.chain,keptAt=JSON.parse(kept[0].b).at;
 await a.press('handover-cancel');
 assert.equal(a.R.session().handoverTo,undefined);assert.equal(a.R.session().gmVoid,keptAt);assert.equal(a.R.auth.memberPayload().since,keptAt);
 assert.match(a.notices.join('|'),/Передача отменена/);
 // the Game Master's own page does not step down for it
 await a.give(bobKey,'m/'+id(bobKey),'member',{...GM,proof:kept});assert.equal(a.R.session().role,'gm');
 // a player who was there, and one who joins by the first link afterwards
 const player=await tab({pin:a.me.fp});a.sent.length=0;a.R.auth.publishMember(true);await relay(a,player);
 assert.equal(player.R.session().gmAt,keptAt);
 await player.give(bobKey,'m/'+id(bobKey),'member',{...GM,proof:kept});
 assert.equal(player.R.session().gmFp,a.me.fp);assert.equal(player.R.members().get(id(bobKey)).impostor,true);
 // a new handover to the same device is a new signature and works
 await settle(5);await a.press('handover',{fp:bobKey.fp});
 await player.give(bobKey,'m/'+id(bobKey),'member',{...GM,proof:a.R.session().handoverTo.chain});assert.equal(player.R.session().gmFp,bobKey.fp);
 // the role went a → b → a: the earlier a → b is spent for somebody who joins by the first link now
 const x=await loadRoom().R.newIdentity(),late=await tab({pin:x.fp}),y=await late.R.newIdentity();
 const xy=await A.extend(null,x,y.pub,topic),xyx=await A.extend(xy,y,x.pub,topic),backAt=JSON.parse(xyx[1].b).at;
 await late.give(x,'m/'+id(x),'member',{...GM,proof:xyx,since:backAt});assert.equal(late.R.session().gmAt,backAt);
 await late.give(y,'m/'+id(y),'member',{...GM,proof:xy});
 assert.equal(late.R.session().gmFp,x.fp);assert.equal(late.R.members().get(id(y)).impostor,true);
 await late.give(y,'c','combat',{...ORDER,round:9});assert.equal(late.R.state().combat,null);
 // only the trusted Game Master is believed about it
 const other=await tab({pin:x.fp});await other.give(y,'m/'+id(y),'member',{name:'Y',role:'player',since:backAt+1});await other.give(y,'m/'+id(y),'member',{...GM,since:backAt+1});
 assert.equal(other.R.session().gmAt,undefined);
 // and a device that is the Game Master by a chain says since when
 const dev=await tab({pin:x.fp}),toDev=await A.extend(null,x,dev.me.pub,topic);
 await dev.give(x,'e','handover',{to:dev.me.fp,chain:toDev});await until(()=>dev.R.session().role==='gm','takes over');
 assert.equal(dev.R.auth.memberPayload().since,JSON.parse(toDev[0].b).at);assert.match(dev.notices.join('|'),/приглашайте новой ссылкой/);
});

test('two devices that both hold a signed handover of the room are told so',async()=>{
 const gm=await tab({role:'gm',name:'Мастер'});await gm.press('gm-file');const text=gm.downloads[0].text;
 const open=async()=>{const t=loadRoom();assert.equal(await t.R.auth.openGMFile(text,''),true);await until(()=>t.sent.some(m=>m.sub.startsWith('m/')),'announces itself');return {...t,room:gm.room,me:await t.R.ensureIdentity()}};
 const first=await open();await settle(5);const second=await open();
 await relay(first,second);await relay(second,first);await settle(60);
 for(const [t,other] of [[first,second],[second,first]]){
  assert.equal(t.R.session().role,'gm');
  assert.equal(t.notices.filter(n=>n.includes('показывает подписанную передачу')&&n.includes(t.R.keyLabel(other.me.fp))).length,1,'told about the other device');
 }
 // said once, not with every heartbeat
 second.R.auth.publishMember(true);await relay(second,first);await settle(60);
 assert.equal(first.notices.filter(n=>n.includes('показывает подписанную передачу')).length,1);
 // the room was handed over live after the file was saved: the device that opens the file later is told as well
 const gm2=await tab({role:'gm'}),q=await gm2.R.newIdentity();await gm2.press('gm-file');
 await settle(5);const live=await gm2.A.extend(null,gm2.me,q.pub,gm2.room.topic);
 const dev=loadRoom();assert.equal(await dev.R.auth.openGMFile(gm2.downloads[0].text,''),true);await until(()=>dev.sent.some(m=>m.sub.startsWith('m/')),'announces itself');
 const d={...dev,room:gm2.room},from=id(q);
 await dev.R.receive({topic:gm2.room.topic+'/m/'+from,retain:false,payload:await dev.R.signedEnvelope(q,from,gm2.room.topic,gm2.room.key,'m/'+from,'member',{...GM,proof:live},Date.now(),'rv1')});await settle(60);
 assert.equal(d.notices.filter(n=>n.includes('показывает подписанную передачу')).length,1);
 // a stranger with a chain of their own is just an impostor, and the help text of the file says it stays valid
 const eve=await dev.R.newIdentity(),own=await gm2.A.extend(null,eve,eve.pub,gm2.room.topic),ef=id(eve);
 await dev.R.receive({topic:gm2.room.topic+'/m/'+ef,retain:false,payload:await dev.R.signedEnvelope(eve,ef,gm2.room.topic,gm2.room.key,'m/'+ef,'member',{...GM,proof:own},Date.now(),'rv2')});await settle(60);
 assert.equal(d.notices.filter(n=>n.includes('показывает подписанную передачу')).length,1);
 assert.match(gm.R.roomView(),/Файл не одноразовый/);assert.match(gm.A.t('fileHelp','en'),/not single-use/);
 for(const t of [first,second,dev])t.window.Room._test.setTransport(null);
});

test('texts exist in Russian and English, and old saved sessions still load',async()=>{
 const en=await tab({role:'gm',lang:'en'}),bob=await en.R.newIdentity();
 await en.give(bob,'m/'+id(bob),'member',{name:'Bob',role:'player'});
 const view=en.R.roomView();assert.match(view,/Make co-GM/);assert.match(view,/Hand over GM role/);assert.match(view,/Save the Game Master file/);
 const ru=loadRoom().window.RoomAuth,keys=k=>Object.keys(k).sort();
 const src=read('room-auth.js').split('\nconst T={')[1],ruKeys=[...src.split('\n en:{')[0].matchAll(/([A-Za-z]+):'/g)].map(m=>m[1]),enKeys=[...src.split('\n en:{')[1].split('\n};')[0].matchAll(/([A-Za-z]+):['‘“]/g)].map(m=>m[1]);
 assert.deepEqual(keys(Object.fromEntries(ruKeys.map(k=>[k,1]))),keys(Object.fromEntries(enKeys.map(k=>[k,1]))));
 for(const k of ruKeys){assert.notEqual(ru.t(k,'ru'),k);assert.notEqual(ru.t(k,'en'),k);assert.notEqual(ru.t(k,'ru'),ru.t(k,'en'),k)}
 // a session saved before this feature has none of the new fields
 const old=await tab({pin:'0123456789abcdef01234567'});
 assert.equal(old.R.auth.deputyFp(),'');assert.equal(old.R.auth.drives(),false);assert.doesNotThrow(()=>old.R.roomView());
 old.R.session().deputyFp={evil:1};old.R.session().gmChain='x';old.R.session().handoverTo={fp:'zz'};
 assert.equal(old.R.auth.deputyFp(),'');assert.doesNotThrow(()=>old.R.roomView());assert.equal(await old.R.auth.sendHandover(),0);
});
