// The city map in an online room: the Game Master shows chosen pins and the crew mark, players only look at them,
// nobody else can write them, the picture and the notes never leave the device, and a page that does not know the
// new message type carries on as before.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const eq=(a,b)=>assert.deepEqual(plain(a),plain(b));
const CODE='K7RQM2XAPZ9E';
const settle=(ms=40)=>new Promise(ok=>setTimeout(ok,ms));
const BRANCH=" }else if(m.t==='citymap'&&sub==='p'){\n  if(fromGM&&global.CityMap?.receive?.(m.d,at,p.retain))repaint();\n";
// One browser tab. `old` is a page from before the city map: no module and no branch for the new message type.
// `gate` adds the waiting room modules.
function loadTab({old=false,gate=false,state}={}){
 const listeners={},store=new Map(),document={addEventListener(type,f){(listeners[type]||=[]).push(f)},querySelector:()=>null,querySelectorAll:()=>[],visibilityState:'visible'};
 const later=(f,ms)=>{const h=setTimeout(f,ms);if(ms>=500)h.unref?.();return h},every=(f,ms)=>{const h=setInterval(f,ms);h.unref?.();return h};
 const window={document,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},crypto:globalThis.crypto,location:{hash:'',origin:'https://example.test',pathname:'/'},addEventListener(){},confirm:()=>true,navigator:{},btoa,atob,scrollTo(){}};
 const ctx={window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Error,RegExp,setTimeout:later,clearTimeout,setInterval:every,clearInterval,console,URL,Blob};
 let room=read('room.js');
 if(old){assert.equal(room.split(BRANCH).length,2,'the branch is in room.js exactly once');room=room.replace(BRANCH,'')}
 vm.runInNewContext(read('room-transport.js')+'\n'+(gate?read('room-auth.js')+'\n'+read('room-gate.js')+'\n':'')+room+(old?'':'\n'+read('city-map.js')),ctx);
 const R=window.Room._test,notices=[],sent=[],st=state||{lang:'ru',characters:[],campaigns:[]};
 window.App={getState:()=>st,lang:()=>st.lang,notify:m=>notices.push(m),save(){}};
 const wire={publish:(sub,bytes,retain)=>{sent.push({sub,bytes,retain});return 1},close(){},resubscribe(){}};
 R.setApp(window.App);R.setTransport(wire);if(gate)window.RoomTransport={create:()=>wire};
 return {window,R,M:window.CityMap,G:window.RoomGate,notices,sent,st,listeners};
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
const pin=(id,t,x,y,name,more={})=>({id,t,x,y,name,...more});
const campaign=()=>({id:'c1',name:'Арасака',notes:'Секрет ведущего',roster:[],cityMap:{v:1,ratio:1.333,
 pins:[pin('a','bar',100,200,'Бар «Тихий час»',{note:'Хозяин — информатор',shown:true}),pin('b','safehouse',500,500,'Тайник группы',{note:'Код от двери 4471'}),pin('c','gang',900,800,'Стая <b>',{shown:true})],
 route:['a','b','c'],crew:'b',crewShown:true}});
const SHOWN={campaign:'Арасака',ratio:1.333,pins:[['bar',100,200,'Бар «Тихий час»'],['gang',900,800,'Стая <b>']],crew:[500,500]};

test('what leaves the device: the chosen pins as type, place and name, and the place of the crew — nothing else',()=>{
 const {M}=loadTab(),c=campaign(),p=M.payload(c);
 eq(p,{data:SHOWN,fit:2,total:2});
 eq(Object.keys(p.data).sort(),['campaign','crew','pins','ratio']);
 const wire=JSON.stringify(p.data);
 for(const secret of ['информатор','4471','Тайник','Секрет','route','note','"a"','"b"','"id"','data:','shown'])assert.equal(wire.includes(secret),false,secret);
 // The crew stands on a pin that is not shown: only the point is sent, not the pin.
 assert.equal(p.data.pins.some(x=>x[1]===500&&x[2]===500),false);
 delete c.cityMap.crewShown;eq(M.payload(c).data.crew,null);
 c.cityMap.crewShown=true;delete c.cityMap.crew;eq(M.payload(c).data.crew,null);
 c.cityMap.pins.forEach(x=>delete x.shown);eq(M.payload(c).data,{campaign:'Арасака',ratio:1.333,pins:[],crew:null});
 for(const bad of [null,undefined,7,'x',[],{id:'x',name:'N'},{id:'x',name:'N',cityMap:{v:9}}])eq(M.payload(bad).data,{campaign:'',ratio:1.5,pins:[],crew:null});
 // The size budget: pins that do not fit are left out from the end.
 const big={id:'b',name:'N',roster:[],cityMap:{v:1,ratio:1.5,pins:Array.from({length:60},(_,i)=>pin('p'+i,'job',i,i,'Я'.repeat(59)+(i%10),{shown:true}))}};
 const cut=M.payload(big);assert.equal(cut.total,M.MAX_SHARED);assert.ok(cut.fit<=M.MAX_SHARED);assert.ok(new TextEncoder().encode(JSON.stringify(cut.data)).length<=M.MAX_BYTES);
 eq(cut.data.pins.map(x=>x[1]),Array.from({length:cut.fit},(_,i)=>i));
});

test('anything received is rebuilt: known types, whole numbers on the stage, clipped names',()=>{
 const {M}=loadTab();
 for(const bad of [null,7,'x',[],{pins:'x'},{crew:'here'}])eq(M.cleanShared(bad),{campaign:'',ratio:1.5,pins:[],crew:null});
 const got=M.cleanShared({campaign:'К'.repeat(200)+'\u0000',ratio:99,extra:'<script>',src:'data:image/png;base64,AAAA',
  pins:[['bar',1,2,'ok',{note:'x'},'more'],['castle',3,4,'unknown type'],['bar','5',6,'text as a number'],['bar',7,1001,'outside'],['bar',1.5,2,'half'],['bar',8,9,''],['bar',8,9,{a:1}],{t:'bar',x:1,y:1,name:'object'},null,'x',['gang',10,11,'<img src=x onerror=alert(1)>'+'я'.repeat(200)]],
  crew:[1000,0,'extra'],route:['a'],note:'secret'});
 eq(got,{campaign:'К'.repeat(80),ratio:2,pins:[['bar',1,2,'ok'],['other',3,4,'unknown type'],['gang',10,11,('<img src=x onerror=alert(1)>'+'я'.repeat(200)).slice(0,60)]],crew:[1000,0]});
 eq(M.cleanShared({crew:[1,'2']}).crew,null);eq(M.cleanShared({crew:[-1,2]}).crew,null);
 assert.equal(M.cleanShared({pins:Array.from({length:500},(_,i)=>['bar',i%1000,1,'p'+i])}).pins.length,M.MAX_SHARED);
});

test('the Game Master page publishes the map as one signed retained message; the protocol number is unchanged',async()=>{
 const c=campaign(),s=await scene({role:'gm',campaignId:'c1',state:{lang:'ru',characters:[],campaigns:[c]}});
 assert.match(read('room.js'),/PROTOCOL=3\b/);
 assert.equal(s.M.publish(false),true);await settle();
 const out=s.sent.filter(x=>x.sub==='p');assert.equal(out.length,1);assert.equal(out[0].retain,true);
 const outer=await s.R.open(out[0].bytes),m=JSON.parse(outer.b);
 assert.equal(outer.v,3);assert.equal(typeof outer.s,'string');assert.equal(m.t,'citymap');assert.equal(m.from,s.id(s.me,'000000b1'));eq(m.d,SHOWN);
 assert.equal(s.M.publish(false),false);assert.equal(s.M.publish(true),false); // nothing changed: nothing is sent again at once
 c.cityMap.pins[1].shown=true;assert.equal(s.M.publish(false),true);await settle();
 eq(JSON.parse((await s.R.open(s.sent.filter(x=>x.sub==='p')[1].bytes)).b).d.pins.map(x=>x[3]),['Бар «Тихий час»','Тайник группы','Стая <b>']);
 assert.equal(s.M.publish(true,Date.now()+200000),true); // a later heartbeat repeats it for relays that lost their copy
 // The Game Master role came back to this device: the next publish goes out although nothing changed here.
 assert.equal(s.M.publish(false,Date.now()+200001),false);s.M.forget();assert.equal(s.M.publish(false,Date.now()+200002),true);await settle();
 // room.js does exactly that at the moment the role arrives, next to the journal and the agent card.
 assert.match(read('room.js'),/app\?\.notify\?\.\(ta\('nowGM'\)\);[^\n]*global\.CityMap\?\.forget\?\.\(\);/);
 // The room's own save path reaches it: a change is published together with the clocks.
 c.cityMap.pins[0].name='Новое имя';const before=s.sent.filter(x=>x.sub==='p').length;s.window.Room.changed();await settle(520);
 assert.equal(s.sent.filter(x=>x.sub==='p').length,before+1);
 // The Game Master's own page says what players see and takes nothing from the wire.
 await s.give(s.gm,'p','citymap',{campaign:'X',pins:[['bar',1,1,'чужое']]});eq(s.M._test.shown().pins,[]);
 const card=s.M.roomCard();assert.match(card,/Игроки видят меток: 3\. Место группы показано\./);assert.equal(card.includes('cm-stage'),false);assert.ok(s.R.roomView().includes('data-cm-room'));
 // A player or a page without a room publishes nothing.
 const p=await scene();assert.equal(p.M.publish(true),false);assert.equal(loadTab().M.publish(true),false);
});

test('an empty map is repeated on every heartbeat, a map with pins only now and then, and a new member gets it at once',async()=>{
 const c=campaign(),g=await scene({role:'gm',campaignId:'c1',state:{lang:'ru',characters:[],campaigns:[c]}}),t0=Date.now();
 assert.equal(g.M.publish(false,t0),true);
 assert.equal(g.M.publish(true,t0+45000),false);assert.equal(g.M.publish(true,t0+180000),true);
 c.cityMap.pins.forEach(x=>delete x.shown);delete c.cityMap.crewShown;assert.equal(g.M.publish(false,t0+181000),true);
 let again=0;for(let i=1;i<=4;i++)if(g.M.publish(true,t0+181000+i*45000))again++;
 assert.equal(again,4);assert.equal(g.M.publish(false,t0+900000),false);await settle();
 eq(JSON.parse((await g.R.open(g.sent.filter(x=>x.sub==='p').at(-1).bytes)).b).d,{campaign:'Арасака',ratio:1.333,pins:[],crew:null});
});

test('a player page shows the pins and the crew mark of the trusted Game Master, read-only, and says when they change',async()=>{
 const s=await scene();
 assert.equal(s.M.roomCard(),''); // nothing shown: no card
 await s.give(s.gm,'p','citymap',SHOWN,{retain:true});
 const card=s.M.roomCard();
 assert.match(card,/КАРТА ГОРОДА/);assert.match(card,/class="cm-stage cm-grid cm-shared" style="aspect-ratio:1\.333" role="img" aria-label="Схема города, меток: 2, отмечено место группы"/);
 assert.match(card,/style="--x:10%;--y:20%"/);assert.match(card,/style="--x:50%;--y:50%"/);assert.match(card,/Стая &lt;b&gt;/);assert.equal(card.includes('<b>Стая <b>'),false);
 assert.match(card,/Группа отмечена на карте\./);assert.match(card,/Картинка карты остаётся у него/);
 assert.equal(/<(img|button|input|textarea|select|a)\b/.test(card),false,'nothing to press and no picture');
 assert.ok(s.R.roomView().includes('data-cm-room'));
 assert.equal(s.notices.length,0); // a copy kept by a relay is not news
 const moved={...SHOWN,crew:[100,200]};
 await s.give(s.gm,'p','citymap',moved);assert.equal(s.notices.at(-1),'Ведущий обновил карту города.');eq(s.M._test.shown(),moved);
 assert.match(s.M.roomCard(),/Группа здесь: Бар «Тихий час»/);
 const n=s.notices.length;await s.give(s.gm,'p','citymap',moved);assert.equal(s.notices.length,n); // the same again is not announced
 await s.give(s.gm,'p','citymap',{campaign:'',pins:[]});assert.equal(s.M.roomCard(),'');assert.equal(s.notices.length,n); // the Game Master took everything back
 await s.give(s.gm,'p','citymap',{campaign:'A',pins:[],crew:[5,5]});assert.match(s.M.roomCard(),/cm-t-crew/); // the crew alone is still a map
 s.st.lang='en';await s.give(s.gm,'p','citymap',SHOWN);assert.match(s.M.roomCard(),/CITY MAP/);assert.equal(s.notices.at(-1),'The Game Master updated the city map.');
 assert.equal(/[А-Яа-яЁё]/.test(s.M.roomCard().replace(/Арасака|Бар «Тихий час»|Стая/g,'')),false);
});

test('a hostile map from the Game Master key is still only pins: clipped, escaped, placed by checked numbers',async()=>{
 const s=await scene();
 await s.give(s.gm,'p','citymap',{campaign:'<script>alert(1)</script>',ratio:'1;position:fixed',src:'data:image/png;base64,AAAA',
  pins:[['bar','10%;background:url(//evil)',5,'style'],['"><script>',10,20,'"><img src=x onerror=alert(1)>'],...Array.from({length:500},(_,i)=>['job',i,i,'p'+i])],crew:['1',2]});
 const card=s.M.roomCard(),got=s.M._test.shown();
 assert.equal(got.pins.length,s.M.MAX_SHARED-1,'only the first 40 are looked at, and one of them is refused');eq(got.pins[0],['other',10,20,'"><img src=x onerror=alert(1)>']);assert.equal(got.ratio,1.5);assert.equal(got.crew,null);
 assert.equal(/<script|<img|evil|position:fixed|data:image/.test(card),false);assert.match(card,/&quot;&gt;&lt;img src=x onerror=alert\(1\)&gt;/);
 for(const style of card.match(/style="[^"]*"/g))assert.match(style,/^style="(?:aspect-ratio:[\d.]+|--x:[\d.]+%;--y:[\d.]+%)"$/);
});

test('only the Game Master named for this room can write the map; old and moved messages are dropped',async()=>{
 const s=await scene(),none={campaign:'',ratio:1.5,pins:[],crew:null};
 await s.give(s.eve,'p','citymap',SHOWN);await s.give(s.bob,'p','citymap',SHOWN);eq(s.M._test.shown(),none);
 await s.give(s.eve,'p','citymap',SHOWN,{from:s.id(s.gm)});eq(s.M._test.shown(),none); // the Game Master's id, somebody else's key
 await s.R.receive({topic:s.room.topic+'/k',retain:false,payload:await s.bytes(s.gm,'p','citymap',SHOWN)});await settle(5);eq(s.M._test.shown(),none); // moved to another subtopic
 await s.R.receive({topic:s.room.topic+'/p',retain:false,payload:await s.bytes(s.gm,'j','citymap',SHOWN)});await settle(5);eq(s.M._test.shown(),none);
 await s.give(s.gm,'j','citymap',SHOWN);eq(s.M._test.shown(),none); // the right type on a subtopic that is not its own
 await s.give(s.gm,'p','citymap',SHOWN,{at:Date.now()-13*3600*1000,retain:true});eq(s.M._test.shown(),none); // too old
 await s.give(s.gm,'p','citymap',SHOWN);eq(s.M._test.shown(),SHOWN);
 await s.give(s.gm,'p','citymap',{campaign:'Старое',pins:[['bar',1,1,'старое']]},{at:Date.now()-60000,retain:true});eq(s.M._test.shown(),SHOWN); // an older copy does not replace a newer one
 await s.give(s.gm,'p','clocks',{list:[{name:'x',size:4,filled:1}]});assert.equal(s.R.state().clocks.length,0); // the map subtopic sets nothing else
 await s.give(s.gm,'p','journal',{campaign:'A',list:[{at:1,text:'x'}]});eq(s.M._test.shown(),SHOWN);
});

test('a page that does not know the new message ignores it and keeps working',async()=>{
 const s=await scene({old:true});
 assert.equal(s.window.CityMap,undefined);
 await s.give(s.gm,'p','citymap',SHOWN,{retain:true});await s.give(s.gm,'p','citymap',SHOWN);
 assert.equal(s.notices.length,0);eq(s.R.state(),{combat:null,clocks:[],combatAt:0,clocksAt:0,outbox:[],feed:[]});assert.ok(!s.R.roomView().includes('cm-'));
 await s.give(s.gm,'c','combat',{campaign:'A',round:2,order:[{name:'Ганг',init:12,current:true}]});assert.equal(s.R.state().combat.round,2);
 // A page that has the branch but not the module (a partial update) does not throw either, as a player or as the Game Master.
 const half=loadTab();delete half.window.CityMap;const room=await half.R.deriveRoom(CODE);half.R.setKey(room.key);
 const me=await half.R.ensureIdentity(),gm=await half.R.newIdentity();half.R.setSession({code:CODE,role:'player',name:'V',memberId:me.fp+'.000000b1',gmFp:gm.fp,gmPin:'link',toasts:false},room.topic);
 await half.R.receive({topic:room.topic+'/p',retain:false,payload:await half.R.signedEnvelope(gm,gm.fp+'.000000a1',room.topic,room.key,'p','citymap',SHOWN,Date.now(),'x1')});await settle(5);
 assert.ok(half.R.roomView().includes('room-combat'));
 half.R.setSession({code:CODE,role:'gm',name:'V',memberId:me.fp+'.000000b1',gmFp:me.fp,gmPin:'self',toasts:false},room.topic);half.window.Room.changed();await settle(520);
 assert.equal(half.sent.filter(m=>m.sub==='p').length,0);
});

test('leaving for another room forgets the map of the previous one',async()=>{
 const s=await scene();await s.give(s.gm,'p','citymap',SHOWN);assert.notEqual(s.M.roomCard(),'');
 s.R.setSession({...s.R.session()},'ncred/v2/ffffffffffffffffffffffff');assert.equal(s.M.roomCard(),'');
 s.R.setSession(null,'');assert.equal(s.M.roomCard(),'');assert.equal(s.M.publish(true),false);assert.equal(s.M.receive(SHOWN,Date.now()),false);
});

test('the Game Master leaving the room takes the map down together with the initiative and the clocks',async()=>{
 const c=campaign(),g=await scene({role:'gm',campaignId:'c1',state:{lang:'ru',characters:[],campaigns:[c]}});
 assert.equal(g.M.publish(false),true);await settle();
 g.R.disconnect(true);await settle();g.R.setKey(g.room.key); // leaving forgets the room key; the test needs it to read what was sent
 const x=g.sent.filter(m=>m.sub==='p').at(-1);assert.equal(x.retain,true);
 const m=JSON.parse((await g.R.open(x.bytes)).b);assert.equal(m.t,'citymap');eq(m.d,{campaign:'',pins:[]});
 // A player sees the card go, and a page that opens the link later gets no map either.
 const p=await scene();await p.give(p.gm,'p','citymap',SHOWN,{at:Date.now()-5000,retain:true});assert.notEqual(p.M.roomCard(),'');
 await p.give(p.gm,'p',m.t,m.d);assert.equal(p.M.roomCard(),'');
 const late=await scene();await late.give(late.gm,'p',m.t,m.d,{retain:true});assert.equal(late.M.roomCard(),'');assert.equal(late.notices.length,0);
 // A player who leaves publishes nothing on the map subtopic.
 const q=await scene();q.R.disconnect(true);await settle();assert.equal(q.sent.filter(k=>k.sub==='p').length,0);
});

test('the «Игрокам в комнате» block of the map page tells the state of the room',async()=>{
 const c=campaign(),g=await scene({role:'gm',campaignId:'c1',state:{lang:'ru',characters:[],campaigns:[c]}});
 assert.match(g.M.page(c,[],'ru'),/Комната открыта\. Игроки видят меток: 2\. Место группы показано\./);assert.match(g.M.page(c,[],'ru'),/2 \/ 40/);
 assert.match(g.M.page(c,[],'en'),/The room is open. Players see pins: 2\. The place of the crew is shown\./);
 const other=await scene({role:'gm',campaignId:'zz'});assert.match(other.M.page(c,[],'ru'),/В комнате выбрана другая кампания/);assert.match(other.M.roomCard(),/выберите выше кампанию/);
 const player=await scene();assert.match(player.M.page(c,[],'ru'),/Вы в комнате как игрок/);
 const alone=loadTab();assert.match(alone.M.page(c,[],'en'),/No room is open/);assert.equal(alone.M.roomCard(),'');
 const bare={id:'c1',name:'Арасака',roster:[]},none=await scene({role:'gm',campaignId:'c1',state:{lang:'ru',characters:[],campaigns:[bare]}});
 assert.match(none.M.roomCard(),/Игроки пока не видят карту/);
 for(const html of [g.M.page(c,[],'ru'),g.M.roomCard()])assert.match(html,/остаётся только в этом браузере|Игроки видят/);
});

/* ---------- With the waiting room: the map is part of what the door keeps closed ---------- */
let serial=0;
async function tab({role='player',pin='',name='V',state}={}){
 const t=loadTab({gate:true,state}),R=t.R,room=await R.deriveRoom(CODE);R.setKey(room.key);
 const me=await R.ensureIdentity();R.resetGMKeys();await R.ensureGMKeys();
 const memberId=me.fp+'.'+(0x10000000+(serial++)).toString(16);
 R.setSession({code:CODE,role,name,memberId,gmFp:role==='gm'?me.fp:pin,gmPin:role==='gm'?'self':pin?'link':'',toasts:false,...(role==='gm'?{campaignId:'c1'}:{})},room.topic);
 return {...t,room,me,memberId};
}
async function relay(from,to,{kept=false}={}){
 await settle(15);const batch=from.sent.splice(0);
 for(const m of batch)for(const t of [].concat(to))await t.R.receive({topic:t.room.topic+'/'+m.sub,retain:kept,payload:m.bytes});
 await settle(15);return batch;
}
const give=async(t,bytes,sub,{kept=false}={})=>{await t.R.receive({topic:t.room.topic+'/'+sub,retain:kept,payload:bytes});await settle(10)};

test('with the waiting room on, a device at the door neither reads the map nor can put one in',async()=>{
 const c=campaign(),gm=await tab({role:'gm',name:'Мастер',state:{lang:'ru',characters:[],campaigns:[c]}});
 assert.equal(await gm.R.gate.setGate(true),true);const notice=await relay(gm,[]);
 const ann=await tab({pin:gm.me.fp,name:'Аня'}),door=await tab({pin:gm.me.fp,name:'Чужой'});
 // Ann asks and is let in; the other device only reads the notice and waits.
 for(const m of notice){await give(ann,m.bytes,m.sub,{kept:true});await give(door,m.bytes,m.sub,{kept:true})}
 await relay(ann,gm,{kept:true});assert.equal(gm.R.gate.admitWaiting(ann.memberId),true);await relay(gm,ann);assert.equal(ann.R.gate.inRoom(),true);await relay(ann,gm);
 assert.equal(door.R.gate.gateOn(),true);assert.equal(door.R.gate.inRoom(),false);
 // The map went out when the door was closed; here it is sent once more, so the test holds exactly one copy.
 gm.sent.length=0;gm.M.forget();assert.equal(gm.M.publish(true),true);await settle();
 const out=gm.sent.filter(m=>m.sub==='p');assert.equal(out.length,1);
 const got=await gm.R.gate.openAny(out[0].bytes);assert.equal(got.deep,true,'the map is sealed with the room key, not with the code');
 await give(ann,out[0].bytes,'p');await give(door,out[0].bytes,'p');
 eq(ann.M._test.shown(),SHOWN);assert.notEqual(ann.M.roomCard(),'');
 eq(door.M._test.shown().pins,[]);assert.equal(door.M.roomCard(),'');
 // A map sealed with the code alone is dropped by those inside, whoever signed it — also a copy the Game Master sent before the door was closed.
 const fake={campaign:'X',ratio:1.5,pins:[['danger',1,1,'ловушка']],crew:null};
 const eve=await ann.R.newIdentity();
 await give(ann,await ann.R.signedEnvelope(eve,eve.fp+'.000000e1',ann.room.topic,ann.room.key,'p','citymap',fake,Date.now(),'x'+(serial++)),'p');
 await give(ann,await gm.R.signedEnvelope(gm.me,gm.memberId,gm.room.topic,gm.room.key,'p','citymap',fake,Date.now()+1000,'x'+(serial++)),'p');
 eq(ann.M._test.shown(),SHOWN);
});

test('the player card: labels near an edge hang inwards, and its name for a screen reader is plain English',async()=>{
 const s=await scene({role:'player'});
 await s.give(s.gm,'p','citymap',{campaign:'A',ratio:1.5,pins:[['bar',0,0,'Левая'],['bar',500,500,'Средняя'],['gang',1000,1000,'Правая']],crew:[990,10]});
 const card=s.M.roomCard(),cls=name=>new RegExp('class="([^"]*)" style="[^"]*">(?:<span[^>]*>[^<]*</span>)?<span class="cm-pin-name">'+name+'<').exec(card)[1];
 assert.match(cls('Левая'),/cm-edge-l/);assert.match(cls('Правая'),/cm-edge-r/);assert.doesNotMatch(cls('Средняя'),/cm-edge/);
 assert.match(card,/class="cm-pin cm-static cm-crew cm-edge-r" style="--x:99%;--y:1%"/);
 s.st.lang='en';assert.match(s.M.roomCard(),/aria-label="City layout, pins: 3, the place of the crew is marked"/);
 assert.equal(/scheme/i.test(JSON.stringify(Object.values(s.M._test.T.en).map(v=>typeof v==='function'?v(1,2):v))),false);
});
