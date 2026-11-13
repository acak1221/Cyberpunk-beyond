const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const CODE='K7RQM2XAPZ9E',STORE='nightcity-red-room-whispers';
const SKILLS=[['Perception','awareness','INT',1,1,'Восприятие'],['Stealth','body','DEX',1,1,'Скрытность']];
const settle=(ms=30)=>new Promise(ok=>setTimeout(ok,ms));
// A fixed sequence of dice: each value is the face wanted (1..10).
const dice=(...faces)=>{let i=0;return ()=>((faces[i++]??5)-1)/10+0.01};

// One browser tab: room.js and room-whispers.js with their own module state. Tabs can share a localStorage (a reload).
function loadTab({store=new Map(),character=null}={}){
 const listeners={},document={addEventListener(type,f){(listeners[type]||=[]).push(f)},querySelector:()=>null,querySelectorAll:()=>[],visibilityState:'visible'};
 const later=(f,ms)=>{const h=setTimeout(f,ms);if(ms>=1000)h.unref?.();return h};
 const notices=[],actions=[],saves=[];
 const window={document,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},crypto:globalThis.crypto,location:{hash:'',origin:'https://example.test',pathname:'/'},addEventListener(){},confirm:()=>true,navigator:{},btoa,atob};
 const state={lang:'ru',characters:character?[character]:[],campaigns:[]};
 const app={getState:()=>state,notify:m=>notices.push(m),notifyAction:(m,label,f)=>actions.push({m,label,f}),save:()=>{saves.push(1);return Promise.resolve({ok:true})},render(){},
  checkBase:(c,stat,level)=>c.armorBlocked?null:(Number(c.stats?.[stat])||0)+(Number(level)||0)};
 window.App=app;window.SkillReference={SKILLS,DV:[[9,'Простая','Simple'],[13,'Обычная','Everyday'],[15,'Трудная','Difficult'],[17,'Профессиональная','Professional'],[21,'Героическая','Heroic'],[24,'Невероятная','Incredible'],[29,'Легендарная','Legendary']]};
 window.CharacterExtra={init:c=>{if(c.extra===undefined)c.extra={};if(c.extra.luck===undefined)c.extra.luck=c.stats?.LUCK??0;return c.extra}};
 const ctx={window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Error,setTimeout:later,clearTimeout,setInterval,clearInterval,console};
 vm.runInNewContext(read('room-transport.js')+'\n'+read('room.js')+'\n'+read('rolls.js')+'\n'+read('room-whispers.js'),ctx);
 const R=window.Room._test,RW=window.RoomWhispers,sent=[],log=[];
 R.setApp(app);
 R.setTransport({publish:(sub,bytes,retain)=>{const p={sub,bytes,retain};sent.push(p);log.push(p);return 1},close(){}});
 return {window,R,RW,W:RW._test,store,sent,log,notices,actions,saves,state,link:window.Room.whisperLink};
}
// A room: the Game Master, the player Аня and a second player Боб (and an outsider Ева when asked for).
async function table({eve=false,annStore,annChar}={}){
 const first=loadTab(),room=await first.R.deriveRoom(CODE);
 const tabs={gm:first,ann:loadTab({store:annStore,character:annChar||{id:'c-ann',name:'Ви',stats:{INT:7,DEX:6,LUCK:5},skills:{Perception:6},extra:{luck:3}}}),bob:loadTab()};
 if(eve)tabs.eve=loadTab();
 const gmKey=await tabs.gm.R.ensureIdentity();
 for(const [name,t] of Object.entries(tabs)){
  t.R.setKey(room.key);const me=await t.R.ensureIdentity();t.key=me;t.fp=me.fp;t.id=me.fp+'.'+(name==='gm'?'000000a1':name==='ann'?'000000b1':name==='bob'?'000000c1':'000000d1');
  t.R.setSession({code:CODE,role:name==='gm'?'gm':'player',name:{gm:'Мастер',ann:'Аня',bob:'Боб',eve:'Ева'}[name],memberId:t.id,gmFp:gmKey.fp,gmPin:name==='gm'?'self':'link',characterId:name==='ann'?'c-ann':'',toasts:false},room.topic);
  await t.R.ensureGMKeys();
 }
 const all=Object.values(tabs);
 // Everything one tab published reaches every other tab, live, as a broker would deliver it.
 const pump=async(only=all)=>{for(let round=0;round<12;round++){await settle(20);const out=[];for(const t of all){out.push(...t.sent.map(p=>[t,p]));t.sent.length=0}if(!out.length)break;for(const [from,p] of out)for(const t of only)if(t!==from)await t.R.receive({topic:room.topic+'/'+p.sub,retain:false,payload:p.bytes})}await settle(20)};
 const status=async(...who)=>{for(const t of who)t.R.auth.publishMember(true);await pump()};
 const decode=async(t,p)=>{const outer=await t.R.open(p.bytes);return JSON.parse(outer.b)};
 const types=async(t,type)=>{const out=[];for(const p of t.log){const m=await decode(t,p);if(!type||m.t===type)out.push(m)}return out};
 // A whisper made by hand: `inner` sealed to `box`, signed by `signer` as `from`, addressed to member `to`.
 const forge=async(signer,box,inner,to,{at=Date.now(),from=signer.id,mid}={})=>{const sealed=await signer.R.sealFor(box,inner);return signer.R.signedEnvelope(signer.key,from,room.topic,room.key,'e','whisper',{w:inner.w,...sealed,to},at,mid||'f'+Math.random().toString(16).slice(2,10))};
 const deliver=async(t,bytes,{retain=false}={})=>{await t.R.receive({topic:room.topic+'/e',retain,payload:bytes});await settle(20)};
 return {room,...tabs,all,pump,status,decode,types,forge,deliver};
}
const W16='0123456789abcdef',FA='a'.repeat(24),FB='b'.repeat(24);

test('cleanInner keeps known fields only, checks sender, recipient and kind, and never reads a DV',()=>{
 const {W}=loadTab(),now=Date.now(),base={v:1,w:W16,from:FA,to:FB,at:now};
 assert.deepEqual(plain(W.cleanInner({...base,kind:'text',text:'  тихо\u0000там\n ',junk:1},{from:FA,to:FB})),{w:W16,kind:'text',at:now,text:'тихо там'});
 assert.equal(W.cleanInner({...base,kind:'text',text:'x'.repeat(900)},{from:FA,to:FB}).text.length,500);
 const a=W.cleanInner({...base,kind:'ask',skill:'Perception',note:'n',dv:13},{from:FA,to:FB});
 assert.deepEqual(plain(a),{w:W16,kind:'ask',at:now,skill:'Perception',note:'n'});assert.equal('dv' in a,false);
 const r={...base,kind:'result',re:W16,skill:'Perception',base:13,luck:1,first:10,extra:4,total:28};
 assert.equal(W.cleanInner(r,{from:FA,to:FB}).total,28);
 assert.equal(W.cleanInner({...r,first:1,extra:4,total:11},{from:FA,to:FB}).total,11);
 assert.ok(W.cleanInner({...base,kind:'text',text:'x',at:now+3600000},{from:FA,to:FB}).at<=Date.now(),'a time from the future is clamped');
 for(const bad of [null,[],{...base,v:2,kind:'text',text:'x'},{...base,w:'nope',kind:'text',text:'x'},{...base,from:FB,kind:'text',text:'x'},{...base,to:FA,kind:'text',text:'x'},{...base,kind:'grant',text:'x'},{...base,kind:'text',text:'   '},{...base,kind:'text',text:{a:1}},{...base,at:0,kind:'text',text:'x'},{...base,at:'1',kind:'text',text:'x'},
  {...base,kind:'ask',skill:'Hacking'},{...r,total:27},{...r,first:5,extra:3,total:21},{...r,first:11,total:29},{...r,base:61,total:76},{...r,luck:21,total:48},{...r,re:'x'},{...r,first:1.5},{...r,skill:'Nope'}])
  assert.equal(W.cleanInner(bad,{from:FA,to:FB}),null,JSON.stringify(bad));
});

test('rollFor: STAT + Skill + 1d10 with the critical rule, LUCK clamped, the character untouched',()=>{
 const {W}=loadTab(),c={id:'c',stats:{INT:7,LUCK:5},skills:{Perception:6},extra:{luck:3}},copy=plain(c);
 assert.deepEqual(plain(W.rollFor(c,'Perception',0,dice(7))),{ok:true,skill:'Perception',base:13,luck:0,first:7,extra:0,total:20});
 assert.deepEqual(plain(W.rollFor(c,'Perception',0,dice(10,4))),{ok:true,skill:'Perception',base:13,luck:0,first:10,extra:4,total:27});
 assert.deepEqual(plain(W.rollFor(c,'Perception',0,dice(1,4))),{ok:true,skill:'Perception',base:13,luck:0,first:1,extra:4,total:10});
 assert.equal(W.rollFor(c,'Perception',9,dice(5)).luck,3,'no more than the pool');
 assert.equal(W.rollFor({...c,extra:{luck:40}},'Perception',30,dice(5)).luck,20,'no more than 20');
 assert.equal(W.rollFor({...c,extra:{}},'Perception',9,dice(5)).luck,5,'a sheet that never spent LUCK has its stat');
 assert.equal(W.rollFor(c,'Perception',-3,dice(5)).luck,0);
 assert.deepEqual(plain(W.rollFor({...c,armorBlocked:true},'Perception',0,dice(5))),{ok:false,why:'armor'});
 assert.deepEqual(plain(W.rollFor(null,'Perception',0,dice(5))),{ok:false,why:'nochar'});
 assert.deepEqual(plain(W.rollFor(c,'Hacking',0,dice(5))),{ok:false,why:'noskill'});
 assert.deepEqual(plain(c),copy,'the character is not changed');
 assert.equal(W.verdict(13,13),false,'a tie fails');assert.equal(W.verdict(14,13),true);assert.equal(W.verdict(14,0),null);
 assert.equal(W.describeResult({first:7,extra:0,base:7,luck:1,total:15},'ru'),'15 (1d10 7 + 7 · LUCK +1)');
 assert.equal(W.describeResult({first:10,extra:3,base:7,luck:0,total:20,dv:13},'ru',{gm:true}),'20 (1d10 10 + 3 + 7) > DV 13 — успех · крит. успех');
 assert.equal(W.describeResult({first:1,extra:3,base:7,luck:0,total:5,dv:13},'en',{gm:true}),'5 (1d10 1 − 3 + 7) ≤ DV 13 — failure · critical failure');
});

test('the Game Master whispers a player: only that player opens it, and the ack marks it delivered',async()=>{
 const s=await table();
 await s.status(s.gm,s.ann,s.bob);
 assert.ok(s.gm.R.members().get(s.ann.id).box,'the player announced a box');
 assert.ok(s.ann.R.auth.memberPayload().box&&!s.ann.R.auth.memberPayload().pub,'a player has a box but no sheet key');
 const it=s.gm.W.say(s.ann.fp,'тихо');assert.equal(it.state,'pending');
 await s.pump();
 const th=s.ann.W.state().threads[s.gm.fp];assert.equal(th.items.length,1);assert.equal(th.items[0].text,'тихо');assert.equal(th.items[0].dir,'in');
 assert.equal(s.gm.W.state().threads[s.ann.fp].items[0].state,'sent');
 assert.equal((await s.types(s.ann,'whisper-ack')).length,1);
 // Боб is in the room with the same room key: he gets the packet and keeps nothing, and his own key does not open it.
 assert.deepEqual(plain(s.bob.W.state()?.threads||{}),{});
 const packet=(await s.types(s.gm,'whisper'))[0];
 assert.equal(packet.d.to,s.ann.id);assert.ok(!JSON.stringify(packet.d).includes('тихо'),'the text is not in the room layer');
 await assert.rejects(()=>s.bob.R.openFromPeer(packet.d));
 // The notice says only that the GM whispered, never the text.
 assert.equal(s.ann.actions.length,1);assert.equal(s.ann.actions[0].m,'Ведущий шепнул вам');
 // The player answers; the GM's notice names the player.
 s.ann.W.say(s.gm.fp,'понял');await s.pump();
 assert.equal(s.gm.W.state().threads[s.ann.fp].items[1].text,'понял');assert.match(s.gm.actions[0].m,/Аня шепнул/);
 assert.equal(s.ann.W.state().threads[s.gm.fp].items[1].state,'sent');
 assert.equal(s.ann.R.state().feed.length+s.gm.R.state().feed.length,0,'nothing in the room feed');
});

test('only the trusted Game Master can whisper a player; a player cannot whisper another player',async()=>{
 const s=await table({eve:true});
 await s.status(s.gm,s.ann,s.bob,s.eve);
 const annBox=s.eve.R.members().get(s.ann.id).box,inner=x=>({v:1,w:'e'.repeat(16),from:s.eve.fp,to:s.ann.fp,at:Date.now(),kind:'text',text:'я ведущий',...x});
 await s.deliver(s.ann,await s.forge(s.eve,annBox,inner(),s.ann.id));
 assert.deepEqual(plain(s.ann.W.state().threads),{},'Ева is not the Game Master');
 // Ева writes the Game Master's id: the signature does not match it.
 await s.deliver(s.ann,await s.forge(s.eve,annBox,inner({from:s.gm.fp}),s.ann.id,{from:s.gm.id}));
 assert.deepEqual(plain(s.ann.W.state().threads),{});
 // The Game Master to another member id: room.js drops it before it is opened.
 await s.deliver(s.ann,await s.forge(s.gm,annBox,{v:1,w:'f'.repeat(16),from:s.gm.fp,to:s.ann.fp,at:Date.now(),kind:'text',text:'x'},s.bob.id));
 assert.deepEqual(plain(s.ann.W.state().threads),{});
 // Боб's page refuses to send a whisper to Аня at all.
 assert.equal(await s.bob.link.send(s.ann.id,'whisper',{w:W16}),0);
 assert.equal(s.bob.W.say(s.ann.fp,'привет'),null);
 assert.ok(await s.bob.link.send(s.gm.id,'whisper',{w:W16}),'to the Game Master it may');
});

test('a sealed box re-signed by another member is dropped',async()=>{
 const s=await table();
 await s.status(s.gm,s.ann,s.bob);
 s.ann.W.say(s.gm.fp,'секрет');await settle(60);
 const packet=(await s.types(s.ann,'whisper'))[0];
 s.ann.sent.length=0;
 const bytes=await s.bob.R.signedEnvelope(s.bob.key,s.bob.id,s.room.topic,s.room.key,'e','whisper',packet.d,Date.now(),'resign1');
 await s.deliver(s.gm,bytes);
 assert.equal(s.gm.W.state()?.threads?.[s.bob.fp],undefined,'not stored under Боб');
 assert.deepEqual(Object.keys(s.gm.W.state()?.threads||{}),[]);
});

test('a replay is stored once and acked again, also after a reload; old and retained packets are dropped',async()=>{
 const annStore=new Map(),s=await table({annStore});
 await s.status(s.gm,s.ann,s.bob);
 const annBox=s.gm.R.members().get(s.ann.id).box,inner={v:1,w:'1'.repeat(16),from:s.gm.fp,to:s.ann.fp,at:Date.now(),kind:'text',text:'раз'};
 const first=await s.forge(s.gm,annBox,inner,s.ann.id),again=await s.forge(s.gm,annBox,inner,s.ann.id);
 await s.deliver(s.ann,first);await s.deliver(s.ann,again);
 assert.equal(s.ann.W.state().threads[s.gm.fp].items.length,1);
 assert.equal((await s.types(s.ann,'whisper-ack')).length,2,'the second copy is acked again');
 // A reload: a new page with the same storage, the same signing key and a new box.
 const re=loadTab({store:annStore});re.R.setKey(s.room.key);re.R.setIdentity(s.ann.key);
 re.R.setSession({code:CODE,role:'player',name:'Аня',memberId:s.ann.id,gmFp:s.gm.fp,gmPin:'link',characterId:'c-ann'},s.room.topic);await re.R.ensureGMKeys();
 await re.R.receive({topic:s.room.topic+'/e',retain:false,payload:await s.forge(s.gm,annBox,inner,s.ann.id)});await settle(30);
 assert.equal(re.W.state().threads[s.gm.fp].items.length,1,'still once after the reload');
 // Too old for the event window, or a copy a broker kept.
 const late={...inner,w:'2'.repeat(16)};
 await s.deliver(s.ann,await s.forge(s.gm,annBox,late,s.ann.id,{at:Date.now()-11*60000}));
 await s.deliver(s.ann,await s.forge(s.gm,annBox,{...inner,w:'3'.repeat(16)},s.ann.id),{retain:true});
 assert.equal(s.ann.W.state().threads[s.gm.fp].items.length,1);
});

test('a secret check: the DV stays with the GM, the player rolls, the GM sees the verdict, nothing goes to the feed',async()=>{
 const s=await table();
 await s.status(s.gm,s.ann,s.bob);
 const ask=s.gm.W.ask(s.ann.fp,'Perception','13','за дверью');assert.equal(ask.dv,13);
 await settle(60);
 const packet=(await s.types(s.gm,'whisper')).at(-1),opened=await s.ann.R.openFromPeer(packet.d);
 assert.equal(opened.kind,'ask');assert.equal('dv' in opened,false,'the DV never leaves the GM');assert.deepEqual(Object.keys(opened).sort(),['at','from','kind','note','skill','to','v','w']);
 await s.pump();
 const got=s.ann.W.state().threads[s.gm.fp].items[0];assert.equal(got.kind,'ask');assert.equal(got.answered,false);
 assert.equal(s.ann.actions[0].m,'Ведущий просит тайную проверку');
 assert.match(s.ann.W.threadHTML(s.gm.fp),/Ведущий просит тайную проверку: Восприятие \(INT\)/);
 assert.match(s.ann.W.threadHTML(s.gm.fp),/data-rw-roll/);
 const res=await s.ann.W.roll(s.gm.fp,got.w,1,dice(7));
 assert.deepEqual([res.base,res.luck,res.first,res.total],[13,1,7,21]);
 assert.equal(s.ann.state.characters[0].extra.luck,2,'LUCK spent');assert.equal(s.ann.saves.length,1);
 assert.equal(got.answered,true);
 assert.match(s.ann.W.threadHTML(s.gm.fp),/Ваш бросок: 21 \(1d10 7 \+ 13 · LUCK \+1\)\. DV знает ведущий\./);
 assert.equal(await s.ann.W.roll(s.gm.fp,got.w,0,dice(9)),null,'one result per ask');
 await s.pump();
 const items=s.gm.W.state().threads[s.ann.fp].items,result=items.at(-1);
 assert.equal(result.kind,'result');assert.equal(result.dv,13);assert.equal(items[0].answered,true);
 assert.match(s.gm.W.threadHTML(s.ann.fp),/Аня · Восприятие:<\/b> 21 \(1d10 7 \+ 13 · LUCK \+1\) &gt; DV 13 — успех/);
 assert.match(s.gm.actions.at(-1).m,/Аня: тайная проверка — 21/);
 assert.equal(s.gm.R.state().feed.length+s.ann.R.state().feed.length,0,'not in either feed');
 // A second answer, an answer to nothing, and arithmetic that does not add up are all dropped.
 const gmBox=s.ann.R.members().get(s.gm.id).box,r=(w,x)=>({v:1,w,from:s.ann.fp,to:s.gm.fp,at:Date.now(),kind:'result',re:ask.w,skill:'Perception',base:13,luck:0,first:9,extra:0,total:22,...x});
 for(const [w,x] of [['4'.repeat(16),{}],['5'.repeat(16),{re:'9'.repeat(16)}],['6'.repeat(16),{total:23}],['7'.repeat(16),{skill:'Stealth'}]])await s.deliver(s.gm,await s.forge(s.ann,gmBox,r(w,x),s.gm.id));
 assert.equal(s.gm.W.state().threads[s.ann.fp].items.length,items.length);
});

test('a player cannot ask for a check, and the GM drops an ask from a player',async()=>{
 const s=await table();
 await s.status(s.gm,s.ann);
 assert.equal(s.ann.W.ask(s.gm.fp,'Perception',13,''),null);
 const gmBox=s.ann.R.members().get(s.gm.id).box;
 await s.deliver(s.gm,await s.forge(s.ann,gmBox,{v:1,w:'8'.repeat(16),from:s.ann.fp,to:s.gm.fp,at:Date.now(),kind:'ask',skill:'Perception',note:''},s.gm.id));
 assert.deepEqual(Object.keys(s.gm.W.state().threads),[]);
 assert.equal((await s.types(s.gm,'whisper-ack')).length,0);
});

test('the stored history: round trip, caps, expiry, another room, forget',()=>{
 const {W,RW,store,R}=loadTab(),now=Date.now();
 const item=(i,x)=>({w:i.toString(16).padStart(16,'0'),dir:'in',kind:'text',at:now-1000+i,got:now-1000+i,text:'m'+i,...x});
 const st={v:1,code:CODE,threads:{[FA]:{name:'Аня',read:0,items:Array.from({length:51},(_,i)=>item(i))}},seen:['0'.repeat(16),'bad']};
 const back=W.load(JSON.stringify(st),CODE);
 assert.equal(back.threads[FA].items.length,50);assert.equal(back.threads[FA].items[0].text,'m1','the oldest goes');
 assert.deepEqual(plain(back.seen),['0'.repeat(16)]);
 assert.deepEqual(plain(W.load(W.serialize(back),CODE)),plain(back));
 assert.deepEqual(plain(W.load(JSON.stringify(st),'OTHERCODE111')),{v:1,code:'OTHERCODE111',threads:{},seen:[]});
 assert.deepEqual(plain(W.load('{broken',CODE).threads),{});
 const old=W.load(JSON.stringify({v:1,code:CODE,threads:{[FB]:{name:'x',read:0,items:[{w:W16,dir:'out',kind:'text',at:now-W.PENDING_TTL-5000,text:'hi',state:'pending'},{w:'1'+W16.slice(1),dir:'out',kind:'ask',at:now,skill:'Perception',note:'',dv:14,state:'pending',junk:1}]}},seen:[]}),CODE);
 assert.equal(old.threads[FB].items[0].state,'failed');
 assert.equal(old.threads[FB].items[1].dv,undefined,'a DV off the ladder is dropped');assert.equal('junk' in old.threads[FB].items[1],false);
 const thirteen={v:1,code:CODE,threads:Object.fromEntries(Array.from({length:13},(_,i)=>[i.toString(16).padStart(24,'0'),{name:'p'+i,read:0,items:[item(i)]}])),seen:[]};
 assert.equal(Object.keys(W.load(JSON.stringify(thirteen),CODE).threads).length,12);
 // forget() removes the key.
 store.set(STORE,'x');R.setSession({code:CODE,role:'gm',name:'M',memberId:FA+'.00000001',gmFp:FA},'t');
 RW.forget();assert.equal(store.has(STORE),false);
});

test('a 13th conversation pushes out the oldest idle one, and is refused when none is idle',async()=>{
 const s=await table();
 await s.status(s.gm,s.ann);
 const now=Date.now(),fill=(read)=>({v:1,code:CODE,threads:Object.fromEntries(Array.from({length:12},(_,i)=>[(i+1).toString(16).padStart(24,'0'),{name:'p'+i,read,items:[{w:(i+1).toString(16).padStart(16,'0'),dir:'in',kind:'text',at:now-100000+i,got:now-100000+i,text:'t'}]}])),seen:[]});
 // A GM page whose storage already has twelve conversations, all read.
 s.gm.store.set(STORE,JSON.stringify(fill(now)));
 const reload=()=>{const t=loadTab({store:s.gm.store});t.R.setKey(s.room.key);t.R.setIdentity(s.gm.key);t.R.setSession({code:CODE,role:'gm',name:'Мастер',memberId:s.gm.id,gmFp:s.gm.fp,gmPin:'self'},s.room.topic);return t};
 let g=reload();await g.R.ensureGMKeys();g.R.auth.publishMember(true);await settle(30);
 for(const p of g.sent)await s.ann.R.receive({topic:s.room.topic+'/'+p.sub,retain:false,payload:p.bytes});g.sent.length=0;await settle(20);
 const gmBox=s.ann.R.members().get(s.gm.id).box,msg=w=>({v:1,w,from:s.ann.fp,to:s.gm.fp,at:Date.now(),kind:'text',text:'привет'});
 await g.R.receive({topic:s.room.topic+'/e',retain:false,payload:await s.forge(s.ann,gmBox,msg('a'.repeat(16)),s.gm.id)});await settle(30);
 const keys=Object.keys(g.W.state().threads);assert.equal(keys.length,12);assert.ok(keys.includes(s.ann.fp));assert.ok(!keys.includes((1).toString(16).padStart(24,'0')),'the oldest idle one went');
 // Now every conversation has something unread: the newcomer is refused and not acked.
 s.gm.store.set(STORE,JSON.stringify(fill(0)));g=reload();await g.R.ensureGMKeys();
 await g.R.receive({topic:s.room.topic+'/e',retain:false,payload:await s.forge(s.ann,gmBox,msg('b'.repeat(16)),s.gm.id)});await settle(30);
 assert.ok(!Object.keys(g.W.state().threads).includes(s.ann.fp));
 assert.equal(g.log.length,0,'no ack');
});

test('a whisper to someone offline waits, goes out once when they appear, and is not resent within 15 s',async()=>{
 const s=await table();
 await s.status(s.gm);
 s.gm.W.say(s.ann.fp,'когда будешь');await settle(40);
 assert.equal((await s.types(s.gm,'whisper')).length,0,'nothing published while Аня is away');
 assert.equal(s.gm.W.state().threads[s.ann.fp].items[0].state,'pending');
 assert.match(s.gm.W.threadHTML(s.ann.fp),/ждёт доставки/);
 // Only Аня's status reaches the Game Master (one hop, nothing delivered back yet).
 const hop=async(from,to)=>{await settle(30);const out=from.sent.splice(0);for(const p of out)await to.R.receive({topic:s.room.topic+'/'+p.sub,retain:false,payload:p.bytes});await settle(40)};
 s.ann.R.auth.publishMember(true);await hop(s.ann,s.gm);
 assert.equal((await s.types(s.gm,'whisper')).length,1,'sent once when her status came');
 await s.gm.RW.flush();await settle(30);
 assert.equal((await s.types(s.gm,'whisper')).length,1,'no second try within 15 s');
 // Her page reloads and announces a new box: the whisper is sealed again to it at once.
 s.gm.sent.length=0;s.ann.R.resetGMKeys();await s.ann.R.ensureGMKeys();s.ann.R.auth.publishMember(true);await hop(s.ann,s.gm);
 assert.equal((await s.types(s.gm,'whisper')).length,2);
 await s.pump();
 assert.equal(s.ann.W.state().threads[s.gm.fp].items[0].text,'когда будешь');
 assert.equal(s.gm.W.state().threads[s.ann.fp].items[0].state,'sent');
});

test('unread count, the room pill, and escaping',async()=>{
 const s=await table();
 await s.status(s.gm,s.ann);
 assert.doesNotMatch(s.ann.window.Room.pill(),/room-pill-unread/);
 s.gm.W.say(s.ann.fp,'<img src=x onerror=alert(1)>');await s.pump();
 assert.equal(s.ann.RW.unread(),1);
 assert.match(s.ann.window.Room.pill(),/room-pill-unread[^>]*>✉ 1</);
 assert.match(s.ann.RW.memberButton(s.gm.id),/Шёпот ведущему <span class="rw-badge"[^>]*>1</);
 assert.equal(s.ann.RW.memberButton(s.ann.id),'');
 assert.match(s.gm.RW.memberButton(s.ann.id),/data-rw-open="[0-9a-f]{24}">✉ Шёпот</);
 const html=s.ann.W.threadHTML(s.gm.fp);assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));assert.ok(!html.includes('<img'));
 assert.ok(!s.ann.actions.some(a=>a.m.includes('img')),'the notice never carries the text');
 s.ann.W.openFp(s.gm.fp);s.ann.RW.refresh();
 assert.equal(s.ann.RW.unread(),0,'opening the conversation reads it');
 assert.doesNotMatch(s.ann.window.Room.pill(),/room-pill-unread/);
 assert.match(s.ann.W.dialogHTML(s.gm.fp),/Текст видите только вы и ведущий/);
 assert.doesNotMatch(s.ann.W.dialogHTML(s.gm.fp),/rw-ask/,'no secret check block for a player');
 assert.match(s.gm.W.dialogHTML(s.ann.fp),/<details class="rw-ask">[\s\S]*name="dv"[\s\S]*value="13">13 — Обычная/);
});

test('an old app on the other side: the dialog says so and sending is off',async()=>{
 const s=await table();
 await s.status(s.gm);
 const old=await s.ann.R.signedEnvelope(s.ann.key,s.ann.id,s.room.topic,s.room.key,'m/'+s.ann.id,'member',{name:'Аня',role:'player',dev:'',cid:'',character:null},Date.now(),'old1');
 await s.gm.R.receive({topic:s.room.topic+'/m/'+s.ann.id,retain:false,payload:old});await settle(20);
 const html=s.gm.W.dialogHTML(s.ann.fp);
 assert.match(html,/<p class="rw-old" role="alert">/);assert.match(html,/type="submit" class="btn primary" disabled/);
});

test('room.js gives every page a box and the hooks stay in place',()=>{
 const src=read('room.js');
 assert.match(src,/\(\{topic:base,key\}=await deriveRoom\(session\.code\)\);await ensureGMKeys\(\);/);
 assert.match(src,/global\.RoomWhispers\?\.forget\?\.\(\)/);
 const html=read('index.html');assert.ok(html.indexOf('room-grants.js')<html.indexOf('room-whispers.js')&&html.indexOf('room-whispers.js')<html.indexOf('"app.js"'));
 assert.match(read('app.js'),/checkBase:\(c,stat,level,kind,skill\)=>checkBase\(c,stat,level,kind,skill\)/);
});

test('a failed whisper can be sent again; no character or a failed save keeps the ask open',async()=>{
 const s=await table();
 await s.status(s.gm,s.ann);
 const it=s.gm.W.say(s.bob.fp,'потом');it.at-=s.gm.W.PENDING_TTL+1000;
 await s.gm.RW.flush();assert.equal(it.state,'failed');
 assert.match(s.gm.W.threadHTML(s.bob.fp),/не доставлено[\s\S]*data-rw-retry/);
 const was=it.w;s.gm.W.retry(s.bob.fp,was);assert.equal(it.state,'pending');assert.notEqual(it.w,was,'a new id');
 // An ask reaches Аня; without a character the roll button is off and says why.
 s.gm.W.ask(s.ann.fp,'Perception','','');await s.pump();
 const ask=s.ann.W.state().threads[s.gm.fp].items.at(-1);
 s.ann.R.session().characterId='';
 assert.match(s.ann.W.threadHTML(s.gm.fp),/data-rw-roll="[0-9a-f]{16}" disabled>[\s\S]*Выберите персонажа/);
 assert.equal(await s.ann.W.roll(s.gm.fp,ask.w,0,dice(5)),null);assert.equal(ask.answered,false);
 // A save that fails gives the LUCK back and sends nothing.
 s.ann.R.session().characterId='c-ann';s.ann.window.App.save=()=>Promise.resolve({ok:false});
 assert.equal(await s.ann.W.roll(s.gm.fp,ask.w,2,dice(5)),null);
 assert.equal(s.ann.state.characters[0].extra.luck,3);assert.equal(ask.answered,false);
 assert.match(s.ann.notices.at(-1),/Не удалось сохранить LUCK/);
 // Without LUCK nothing needs saving and the roll goes out.
 assert.ok(await s.ann.W.roll(s.gm.fp,ask.w,0,dice(5)));assert.equal(ask.answered,true);
});
