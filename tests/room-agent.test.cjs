// «Агент», the Game Master's feed for a room: entries are drafted on the campaign, published one by one, read by players,
// written by nobody else, and a page that does not know the new message type carries on as before.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const eq=(a,b)=>assert.deepEqual(plain(a),plain(b));
const CODE='K7RQM2XAPZ9E';
const settle=(ms=40)=>new Promise(ok=>setTimeout(ok,ms));
const BRANCH=" }else if(m.t==='agent'&&sub==='a'){\n  if(fromGM&&global.RoomAgent?.receive?.(m.d,at,p.retain))repaint();\n";
const JOURNAL_BRANCH=" }else if(m.t==='journal'&&sub==='j'){\n  if(fromGM&&global.RoomJournal?.receive?.(m.d,at,p.retain))repaint();\n";
// One browser tab. `old` is a page from before the feed: no module and no branch for the new message type.
function loadTab({old=false,state}={}){
 const listeners={},store=new Map(),focused=[],document={addEventListener(type,f){(listeners[type]||=[]).push(f)},querySelector:q=>q.startsWith('#ra-')||q.startsWith('[data-ra-edit]')?{focus:()=>focused.push(q)}:null,visibilityState:'visible'};
 const later=(f,ms)=>{const h=setTimeout(f,ms);if(ms>=1000)h.unref?.();return h};
 const window={document,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},crypto:globalThis.crypto,location:{hash:'',origin:'https://example.test',pathname:'/'},addEventListener(){},confirm:()=>true,navigator:{},btoa,atob};
 const ctx={window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Error,setTimeout:later,clearTimeout,setInterval,clearInterval,console,URL,Blob};
 let room=read('room.js');
 if(old){assert.equal(room.split(BRANCH).length,2);room=room.replace(BRANCH,'')}
 vm.runInNewContext(read('room-transport.js')+'\n'+room+'\n'+read('room-journal.js')+(old?'':'\n'+read('room-agent.js')),ctx);
 const R=window.Room._test,notices=[],actions=[],sent=[],st=state||{lang:'ru',characters:[],campaigns:[]};let saves=0,renders=0;
 window.App={getState:()=>st,lang:()=>st.lang,notify:m=>notices.push(m),notifyAction:(m,label,run)=>actions.push({m,label,run}),save:()=>{saves++},render:()=>{renders++}};
 R.setApp(window.App);R.setTransport({publish:(sub,bytes,retain)=>{sent.push({sub,bytes,retain});return 1},close(){}});
 return {window,R,A:window.RoomAgent,notices,actions,sent,st,listeners,focused,saves:()=>saves,renders:()=>renders};
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
const campaign=()=>({id:'c1',name:'Арасака',notes:'Секрет ведущего',roster:[],agentFeed:[
 {id:'e3',kind:'place',title:'Бар «Тихий час»',text:'Наливают без вопросов.',rating:4,at:3000,pub:true,pubAt:5000},
 {id:'e2',kind:'job',title:'Нужен водитель',text:'Черновик: оплата <b>вдвое</b>',at:2000},
 {id:'e1',kind:'wanted',title:'Ищут курьера',text:'Видели у доков.',at:1000,pub:true,pubAt:4000}]});
const WIRE={campaign:'Арасака',list:[{id:'e3',k:'place',title:'Бар «Тихий час»',text:'Наливают без вопросов.',at:5000,r:4},{id:'e1',k:'wanted',title:'Ищут курьера',text:'Видели у доков.',at:4000}]};
const gmScene=(c=campaign())=>scene({role:'gm',campaignId:'c1',state:{lang:'ru',characters:[],campaigns:[c]}});

test('the stored feed is rebuilt from the known fields; a campaign without the field has no feed',()=>{
 const {A}=loadTab();
 for(const bad of [null,undefined,7,'x',[],{},{agentFeed:'x'},{agentFeed:{0:{title:'a'}}}])eq(A.read(bad),[]);
 const got=A.read({agentFeed:[null,7,'x',[1],{title:''},{title:'   \n '},
  {id:'ok_1-A',kind:'job',title:'  Две\nстроки\tзаголовка  ',text:'a\r\nb\u0000\u0007c',at:5,extra:'x',__proto__:{evil:1}},
  {id:'ok_1-A',kind:'place',title:'T'.repeat(200),text:'я'.repeat(900),rating:99,at:-4,pub:true,pubAt:'x'},
  {id:'bad id!',kind:'x',title:'Без вида',rating:5,pub:'yes'},
  {id:'p',kind:'place',title:'P',rating:1.4},{id:'q',kind:'place',title:'Q',rating:0},{id:'r',kind:'place',title:'R'}]});
 eq(got[0],{id:'ok_1-A',kind:'job',title:'Две строки заголовка',text:'a\nbc',at:5});
 assert.equal(got[1].id,'fix-1');assert.equal(got[1].title.length,A.MAX_TITLE);assert.equal(got[1].text.length,A.MAX_TEXT);assert.equal(got[1].rating,3);assert.equal(got[1].at,0);eq([got[1].pub,got[1].pubAt],[true,0]);
 eq(got[2],{id:'fix-2',kind:'news',title:'Без вида',text:'',at:0}); // an unknown kind is news, a rating belongs to places only, `pub` must be exactly true
 eq(got.slice(3).map(e=>e.rating),[1,3,3]);
 // The same broken save reads the same way twice, so a button drawn from one reading finds its entry in the next.
 const broken={agentFeed:[{title:'a'},{id:'fix-0',title:'b'},{id:'',title:'c'}]};eq(A.read(broken).map(e=>e.id),A.read(broken).map(e=>e.id));assert.equal(new Set(A.read(broken).map(e=>e.id)).size,3);
 assert.equal(A.read({agentFeed:Array.from({length:200},(_,i)=>({id:'i'+i,title:'t'+i}))}).length,A.MAX_ENTRIES);
});

test('drafting, changing, publishing, hiding, deleting and putting back',()=>{
 const {A}=loadTab(),c={id:'c',name:'N',roster:[]};
 assert.equal(A.add(c,{kind:'job',title:'  '}).reason,'empty');assert.equal('agentFeed' in c,false);
 const a=A.add(c,{kind:'job',title:'Первая',text:'т',rating:5},1000),b=A.add(c,{kind:'place',title:'Вторая',rating:2},2000);
 assert.equal(a.ok,true);assert.match(a.id,/^[A-Za-z0-9_-]{1,40}$/);assert.notEqual(a.id,b.id);
 eq(c.agentFeed,[{id:b.id,kind:'place',title:'Вторая',text:'',rating:2,at:2000},{id:a.id,kind:'job',title:'Первая',text:'т',at:1000}]); // the newest draft first; no rating on a job
 eq(A.setPublished(c,a.id,true,3000),{ok:true,count:1});eq(c.agentFeed[1],{id:a.id,kind:'job',title:'Первая',text:'т',at:1000,pub:true,pubAt:3000});
 eq(A.setPublished(c,a.id,true,9000),{ok:true,count:1});assert.equal(c.agentFeed[1].pubAt,3000); // publishing twice does not move it up
 eq(A.update(c,a.id,{kind:'place',title:'Первая, новая',text:'',rating:5},4000),{ok:true,id:a.id});
 eq(c.agentFeed[1],{id:a.id,kind:'place',title:'Первая, новая',text:'',rating:5,at:4000,pub:true,pubAt:3000}); // still published
 A.update(c,a.id,{kind:'event',title:'Первая',text:''},4500);assert.equal('rating' in c.agentFeed[1],false);
 assert.equal(A.update(c,a.id,{title:''}).reason,'empty');assert.equal(A.update(c,'ghost',{title:'x'}).reason,'missing');assert.equal(A.setPublished(c,'ghost',true).reason,'missing');
 eq(A.setPublished(c,a.id,false),{ok:true,count:0});assert.equal('pub' in c.agentFeed[1],false);assert.equal('pubAt' in c.agentFeed[1],false);
 const gone=A.remove(c,b.id);assert.equal(gone.ok,true);assert.equal(gone.index,0);assert.equal(gone.entry.title,'Вторая');eq(c.agentFeed.map(e=>e.id),[a.id]);
 eq(A.restore(c,gone.entry,gone.index),{ok:true,id:b.id});eq(c.agentFeed.map(e=>e.id),[b.id,a.id]);
 assert.equal(A.restore(c,gone.entry,0).ok,false); // not twice
 assert.equal(A.remove(c,'ghost').reason,'missing');
 A.remove(c,a.id);A.remove(c,b.id);assert.equal('agentFeed' in c,false); // an emptied feed leaves no field in the save
 // The limits: 60 entries, 30 of them open to players.
 const big={id:'b',name:'B',roster:[]};for(let i=0;i<A.MAX_ENTRIES;i++)assert.equal(A.add(big,{title:'t'+i},i+1).ok,true);
 assert.equal(A.add(big,{title:'one more'}).reason,'full');assert.equal(big.agentFeed.length,A.MAX_ENTRIES);
 for(let i=0;i<A.MAX_PUBLISHED;i++)assert.equal(A.setPublished(big,big.agentFeed[i].id,true,100+i).ok,true);
 assert.equal(A.setPublished(big,big.agentFeed[40].id,true).reason,'full');
 const x=A.remove(big,big.agentFeed[59].id);A.add(big,{title:'took the place'});assert.equal(A.restore(big,x.entry,x.index).reason,'full');
 for(const bad of [null,7,'x',[]]){assert.equal(A.add(bad,{title:'x'}).ok,false);assert.equal(A.remove(bad,'x').ok,false);assert.equal(A.setPublished(bad,'x',true).ok,false);assert.equal(A.update(bad,'x',{title:'x'}).ok,false);assert.equal(A.restore(bad,{id:'x',title:'x'},0).ok,false)}
});

test('only published entries leave the device, newest publication first, within the size budget',()=>{
 const {A}=loadTab(),c=campaign();
 eq(A.payload(c),{data:WIRE,fit:2,total:2});
 const s=JSON.stringify(A.payload(c).data);for(const secret of ['Секрет','водитель','Черновик','notes','pub'])assert.equal(s.includes(secret),false,secret);
 eq(A.payload({id:'x',name:'  Длинное\nимя  '+'я'.repeat(200),roster:[]}).data,{campaign:('Длинное имя '+'я'.repeat(200)).slice(0,80),list:[]});
 for(const bad of [null,undefined,7,'x',[]])eq(A.payload(bad),{data:{campaign:'',list:[]},fit:0,total:0});
 const big={id:'b',name:'B',roster:[],agentFeed:Array.from({length:30},(_,i)=>({id:'e'+i,kind:'news',title:'語'.repeat(80),text:'語'.repeat(500),at:1,pub:true,pubAt:1000-i}))};
 const p=A.payload(big);assert.equal(p.total,30);assert.ok(p.fit>0&&p.fit<30);assert.ok(new TextEncoder().encode(JSON.stringify(p.data)).length<=A.MAX_BYTES);
 eq(p.data.list.map(e=>e.id),Array.from({length:p.fit},(_,i)=>'e'+i)); // the oldest publications are the ones left out
 // A hand-made save with more published entries than allowed still sends no more than the limit.
 assert.equal(A.payload({id:'m',name:'M',agentFeed:Array.from({length:50},(_,i)=>({id:'e'+i,title:'t',pub:true,pubAt:i+1}))}).total,A.MAX_PUBLISHED);
});

test('a save with more published entries than the limit: the newest stay published, the rest are drafts the Game Master sees',async()=>{
 // e0..e29 are the newest publications, e30..e59 older ones that the editor would not show among the published.
 const feed=()=>Array.from({length:60},(_,i)=>({id:'e'+i,kind:'news',title:(i<30?'SEEN ':'UNSEEN ')+i,text:'',at:1,pub:true,pubAt:i<30?1000+i:10+i}));
 const {A}=loadTab(),got=A.read({agentFeed:feed()});
 assert.equal(got.length,60);eq(got.map(e=>e.id),feed().map(e=>e.id)); // nothing is lost and the order is kept
 eq(got.filter(e=>e.pub).map(e=>e.id),Array.from({length:30},(_,i)=>'e'+i));
 for(const e of got.slice(30)){assert.equal('pub' in e,false);assert.equal('pubAt' in e,false)}
 // Ties and missing times do not let more through either.
 assert.equal(A.read({agentFeed:Array.from({length:45},(_,i)=>({id:'t'+i,title:'t',pub:true}))}).filter(e=>e.pub).length,A.MAX_PUBLISHED);
 eq(A.read({agentFeed:feed().slice(0,30)}).filter(e=>e.pub).length,30); // a feed at the limit is left alone
 // The editor draws every entry, so each one can be read, hidden or deleted; hiding one brings nothing unseen to the players.
 const c={id:'c1',name:'Арасака',roster:[],agentFeed:feed()},s=await gmScene(c),html=s.A.panel(c,'ru');
 assert.equal((html.match(/data-ra-item="/g)||[]).length,60);assert.ok(html.includes('Черновики (30)'));assert.ok(html.includes('Опубликовано (30)'));
 assert.ok(html.indexOf('UNSEEN 59')>0&&html.indexOf('UNSEEN 59')<html.indexOf('data-ra-group="published"'));
 assert.ok(!JSON.stringify(s.A.payload(c).data).includes('UNSEEN'));
 eq(s.A.setPublished(c,'e0',false),{ok:true,count:29});
 assert.equal(c.agentFeed.filter(e=>e.pub).length,29);assert.ok(!JSON.stringify(s.A.payload(c).data).includes('UNSEEN'));assert.equal(s.A.payload(c).total,29);
 eq(s.A.setPublished(c,'e0',true),{ok:true,count:30}); // and the hidden one can be opened again
});

test('anything received is rebuilt as a bounded list of known fields',()=>{
 const {A}=loadTab();
 const got=A.clean({campaign:'К'.repeat(200),extra:1,list:[
  {id:'a1',k:'place',title:'<img src=x onerror=alert(1)>',text:'x'.repeat(10000),r:99,at:5,html:'<script>',pub:true},
  {id:'a1',k:'job',title:'the same id again'},{id:'bad id',title:'x'},{id:'"><b>',title:'x'},{id:7,title:'x'},{id:'a2',title:''},{id:'a3',title:{a:1}},null,'x',[1],
  {id:'a4',k:'x',title:'kind',r:5,at:NaN},{id:'a5',k:'job',title:'neg',at:-5},{id:'a6',k:'place',title:'huge',at:1e300,r:-2},{id:'a7',k:'place',title:'round',r:'4',at:'77'},
  JSON.parse('{"id":"a8","title":"proto","__proto__":{"k":"place","r":5}}')]});
 eq(got,{campaign:'К'.repeat(80),list:[{id:'a1',k:'place',title:'<img src=x onerror=alert(1)>',text:'x'.repeat(500),at:5,r:3},{id:'a4',k:'news',title:'kind',text:'',at:0},{id:'a5',k:'job',title:'neg',text:'',at:0},
  {id:'a6',k:'place',title:'huge',text:'',at:0,r:3},{id:'a7',k:'place',title:'round',text:'',at:77,r:4},{id:'a8',k:'news',title:'proto',text:'',at:0}]});
 for(const e of got.list)assert.ok(Object.keys(e).every(k=>['id','k','title','text','at','r'].includes(k)));
 assert.equal(A.clean({list:Array.from({length:100},(_,i)=>({id:'i'+i,title:'t'}))}).list.length,A.MAX_PUBLISHED);
 for(const bad of [null,7,'x',[],{list:'x'},{campaign:7,list:{length:3}}])eq(A.clean(bad),{campaign:'',list:[]});
});

test('the Game Master page publishes the feed as one signed retained message; the protocol number is unchanged',async()=>{
 const c=campaign(),s=await gmScene(c);
 assert.match(read('room.js'),/PROTOCOL=3\b/);
 assert.equal(s.A.publish(false),true);await settle();
 const out=()=>s.sent.filter(x=>x.sub==='a');assert.equal(out().length,1);assert.equal(out()[0].retain,true);
 const outer=await s.R.open(out()[0].bytes),m=JSON.parse(outer.b);
 assert.equal(outer.v,3);assert.equal(typeof outer.s,'string');assert.equal(m.t,'agent');assert.equal(m.from,s.id(s.me,'000000b1'));eq(m.d,WIRE);
 assert.equal(s.A.publish(false),false);assert.equal(s.A.publish(true),false); // nothing changed: nothing is sent again at once
 s.A.setPublished(c,'e2',true,6000);assert.equal(s.A.publish(false),true);await settle();
 eq(JSON.parse((await s.R.open(out()[1].bytes)).b).d.list.map(e=>e.id),['e2','e3','e1']);
 assert.equal(s.A.publish(true,Date.now()+s.A.RESEND+1000),true);await settle(); // a later heartbeat repeats it for relays that lost their copy
 // The room's own save path reaches it: a change is published together with the clocks.
 s.A.setPublished(c,'e2',false);const before=out().length;s.window.Room.changed();await settle(520);assert.equal(out().length,before+1);
 // After a handover of the role the feed goes out again even though it has not changed here.
 assert.equal(s.A.publish(false),false);s.A.forget();assert.equal(s.A.publish(false),true);
 // The GM's own page takes nothing from the wire.
 await s.give(s.gm,'a','agent',{campaign:'X',list:[{id:'zz',k:'news',title:'чужое'}]});eq(s.A._test.shown().list,[]);assert.ok(!s.A.card().includes('чужое'));assert.equal(s.notices.length,0);
});

test('a send that did not go out is tried again; a player and a co-GM never send',async()=>{
 const s=await gmScene();let ok=0;
 s.R.setTransport({publish:(sub,bytes,retain)=>{if(sub==='a'&&!ok)return 0;s.sent.push({sub,bytes,retain});return 1},close(){}});
 assert.equal(s.A.publish(false),true);await settle();assert.equal(s.sent.filter(x=>x.sub==='a').length,0);
 ok=1;assert.equal(s.A.publish(false),true);await settle();assert.equal(s.sent.filter(x=>x.sub==='a').length,1);
 for(const role of ['player','cogm']){
  const p=await scene({role,campaignId:'c1',state:{lang:'ru',characters:[],campaigns:[campaign()]}});
  assert.equal(p.A.publish(true),false);assert.equal(await p.window.Room.agentLink.send(WIRE,Date.now()),0);await settle();assert.equal(p.sent.filter(x=>x.sub==='a').length,0);
 }
 const alone=loadTab();assert.equal(alone.A.publish(true),false);assert.equal(alone.window.Room.agentLink.who(),null);
});

test('an empty feed is repeated on every heartbeat, a feed with entries only now and then',async()=>{
 const c=campaign(),g=await gmScene(c),t0=Date.now();
 assert.equal(g.A.publish(false,t0),true);g.A.setPublished(c,'e3',false);g.A.setPublished(c,'e1',false);assert.equal(g.A.publish(false,t0+1000),true);
 let again=0;for(let i=1;i<=4;i++)if(g.A.publish(true,t0+1000+i*45000))again++;
 assert.equal(again,4);assert.equal(g.A.publish(false,t0+200000),false);await settle();
 const out=g.sent.filter(x=>x.sub==='a');assert.equal(out.length,6);eq(JSON.parse((await g.R.open(out.at(-1).bytes)).b).d,{campaign:'Арасака',list:[]});
 g.A.setPublished(c,'e1',true);const t1=t0+300000;assert.equal(g.A.publish(false,t1),true);
 assert.equal(g.A.publish(true,t1+45000),false);assert.equal(g.A.publish(true,t1+g.A.RESEND),true);
});

test('a player page shows the feed of the trusted Game Master, read-only, and announces a new entry',async()=>{
 const s=await scene();
 assert.equal(s.A.card(),''); // nothing published: no card
 await s.give(s.gm,'a','agent',{campaign:'Арасака & Ко',list:[{id:'x1',k:'place',title:'<img src=x onerror=alert(1)>',text:'"цитата" & <b>',r:4,at:2000}]},{retain:true});
 const card=s.A.card();
 assert.ok(card.includes('data-ra-card'));assert.ok(card.includes('АГЕНТ'));assert.ok(card.includes('&lt;img src=x onerror=alert(1)&gt;'));assert.ok(card.includes('&quot;цитата&quot; &amp; &lt;b&gt;'));assert.ok(!card.includes('<img'));assert.ok(!card.includes('<b>'));
 assert.ok(card.includes('Арасака &amp; Ко'));assert.ok(card.includes('>Место<'));assert.ok(card.includes('role="img" aria-label="Оценка: 4 из 5">★★★★☆'));
 assert.ok(!/<(input|textarea|select|button)\b/.test(card));assert.ok(card.includes('Изменить записи здесь нельзя'));
 assert.ok(s.R.roomView().includes('data-ra-card')); // the room page carries the card
 assert.ok(s.R.roomView().indexOf('data-ra-card')<s.R.roomView().indexOf('room-feed'));
 assert.equal(s.notices.length,0); // a copy kept by a relay is not news
 await s.give(s.gm,'a','agent',WIRE);eq(s.A._test.shown(),WIRE);assert.equal(s.notices.at(-1),'Агент: новых записей — 2');
 let n=s.notices.length;await s.give(s.gm,'a','agent',WIRE);assert.equal(s.notices.length,n); // the same again is not announced
 const edited=plain(WIRE);edited.list[1].title='Ищут курьера, срочно';await s.give(s.gm,'a','agent',edited);assert.equal(s.notices.length,n);assert.ok(s.A.card().includes('срочно')); // a reworded entry changes quietly
 const more=plain(edited);more.list.unshift({id:'e9',k:'job',title:'<i>Нужен</i> техник',text:'',at:9000});await s.give(s.gm,'a','agent',more);
 assert.equal(s.notices.length,n+1);assert.equal(s.notices.at(-1),'Агент · Заказ: <i>Нужен</i> техник'); // plain text; the notice box escapes it
 assert.equal((s.A.card().match(/role="img"/g)||[]).length,1); // stars for the place only
 n=s.notices.length;await s.give(s.gm,'a','agent',{campaign:'',list:[]});assert.equal(s.A.card(),'');assert.equal(s.notices.length,n); // everything hidden: the card goes, quietly
 s.st.lang='en';await s.give(s.gm,'a','agent',{campaign:'A',list:[WIRE.list[0]]});
 assert.ok(s.A.card().includes('AGENT'));assert.ok(s.A.card().includes('>Place<'));assert.ok(s.A.card().includes('Rating: 4 out of 5'));assert.equal(s.notices.at(-1),'Agent · Place: Бар «Тихий час»');
});

test('older entries fold away after the first five',async()=>{
 const s=await scene(),list=Array.from({length:8},(_,i)=>({id:'n'+i,k:'news',title:'Запись '+i,text:'',at:100-i}));
 await s.give(s.gm,'a','agent',{campaign:'A',list},{retain:true});
 const card=s.A.card(),at=card.indexOf('<details');
 assert.ok(at>0);assert.ok(card.includes('Ещё записей: 3'));assert.ok(card.indexOf('Запись 4')<at&&card.indexOf('Запись 5')>at);assert.ok(!card.includes('<details class="ra-more" data-ra-more open'));
 s.listeners.toggle.forEach(f=>f({target:{dataset:{raMore:''},open:true}}));assert.ok(s.A.card().includes('data-ra-more open')); // stays open across live repaints
 // The room page is repainted whole on every message and gives the keyboard focus back only to an element with an id.
 assert.equal((s.A.card().match(/<summary id="ra-more-toggle">/g)||[]).length,1);assert.ok(read('room.js').includes("root.querySelector('#'+focusId)"));
 // The summary is a flex row, which drops the browser's triangle, so the styles draw a marker that turns when it is open.
 const css=read('room-agent.css');assert.match(css,/\.ra-more summary::before\s*\{[^}]*content:/);assert.match(css,/\.ra-more\[open\] > summary::before\s*\{[^}]*transform:/);
});

test('only the Game Master named for this room can write the feed; old and moved messages are dropped',async()=>{
 const s=await scene();
 await s.give(s.eve,'a','agent',WIRE);await s.give(s.bob,'a','agent',WIRE);eq(s.A._test.shown().list,[]);
 await s.give(s.eve,'a','agent',WIRE,{from:s.id(s.gm)});eq(s.A._test.shown().list,[]); // the GM's id, somebody else's key
 await s.R.receive({topic:s.room.topic+'/j',retain:false,payload:await s.bytes(s.gm,'a','agent',WIRE)});await settle(5);eq(s.A._test.shown().list,[]); // moved to another subtopic
 await s.R.receive({topic:s.room.topic+'/a',retain:false,payload:await s.bytes(s.gm,'j','agent',WIRE)});await settle(5);eq(s.A._test.shown().list,[]);
 await s.give(s.gm,'j','agent',WIRE);await s.give(s.gm,'k','agent',WIRE);eq(s.A._test.shown().list,[]); // the right type on the wrong subtopic
 await s.give(s.gm,'a','journal',{campaign:'A',list:[{at:1,text:'x'}]});eq(s.A._test.shown().list,[]);assert.equal(s.window.RoomJournal._test.shown().list.length,0);
 await s.give(s.gm,'a','agent',WIRE,{at:Date.now()-13*3600*1000,retain:true});eq(s.A._test.shown().list,[]); // too old
 assert.equal(s.notices.length,0);
 await s.give(s.gm,'a','agent',WIRE);eq(s.A._test.shown(),WIRE);
 await s.give(s.gm,'a','agent',{campaign:'Старое',list:[{id:'o',k:'news',title:'старое'}]},{at:Date.now()-60000,retain:true});eq(s.A._test.shown(),WIRE); // an older copy does not replace a newer one
 await s.give(s.gm,'a','agent',{campaign:7,list:'x'});eq(s.A._test.shown(),{campaign:'',list:[]}); // junk from the GM is still only an empty feed
 // A deputy (co-GM) is not the Game Master: their feed is not shown.
 const d=await scene();d.R.setSession({...d.R.session(),deputyFp:d.bob.fp,deputyBy:d.gm.fp,deputyAt:Date.now()},d.room.topic);
 await d.give(d.bob,'a','agent',WIRE);eq(d.A._test.shown().list,[]);
});

test('a page that does not know the new message ignores it and keeps working',async()=>{
 const s=await scene({old:true});
 assert.equal(s.window.RoomAgent,undefined);
 await s.give(s.gm,'a','agent',WIRE,{retain:true});await s.give(s.gm,'a','agent',WIRE);
 assert.equal(s.notices.length,0);eq(s.R.state(),{combat:null,clocks:[],combatAt:0,clocksAt:0,outbox:[],feed:[]});assert.ok(!s.R.roomView().includes('ra-'));
 await s.give(s.gm,'c','combat',{campaign:'A',round:2,order:[{name:'Ганг',init:12,current:true}]});assert.equal(s.R.state().combat.round,2);
 await s.give(s.gm,'k','clocks',{list:[{name:'x',size:4,filled:1}]});assert.equal(s.R.state().clocks.length,1);
 await s.give(s.gm,'j','journal',{campaign:'A',list:[{at:1,text:'запись'}]});assert.ok(s.R.roomView().includes('запись'));
 // A page that has the branch but not the module (a partial update) does not throw either, and leaving as GM still works.
 const half=await scene();delete half.window.RoomAgent;await half.give(half.gm,'a','agent',WIRE);assert.ok(half.R.roomView().includes('room-combat'));assert.ok(!half.R.roomView().includes('ra-card'));
 // A new page in a room whose Game Master never sends a feed shows no card.
 const quiet=await scene();await quiet.give(quiet.gm,'k','clocks',{list:[{name:'x',size:4,filled:1}]});assert.equal(quiet.A.card(),'');assert.ok(!quiet.R.roomView().includes('ra-card'));
 // The journal's own branch is still the exact text its test cuts out.
 assert.equal(read('room.js').split(JOURNAL_BRANCH+BRANCH).length,2);
});

test('leaving the room as Game Master takes the feed down; another room starts empty',async()=>{
 const g=await gmScene();assert.equal(g.A.publish(false),true);await settle();
 g.R.disconnect(true);await settle();g.R.setKey(g.room.key); // leaving forgets the room key; the test needs it to read what was sent
 const x=g.sent.filter(m=>m.sub==='a').at(-1),last=JSON.parse((await g.R.open(x.bytes)).b);
 assert.equal(x.retain,true);assert.equal(last.t,'agent');eq(last.d,{campaign:'',list:[]});
 const p=await scene();await p.give(p.gm,'a','agent',WIRE,{at:Date.now()-5000,retain:true});assert.notEqual(p.A.card(),'');
 await p.give(p.gm,'a',last.t,last.d);assert.equal(p.A.card(),'');
 const late=await scene();await late.give(late.gm,'a',last.t,last.d,{retain:true});assert.equal(late.A.card(),'');assert.equal(late.notices.length,0);
 const q=await scene();q.R.disconnect(true);await settle();assert.equal(q.sent.filter(m=>m.sub==='a').length,0); // a player who leaves publishes nothing there
 const s=await scene();await s.give(s.gm,'a','agent',WIRE);assert.notEqual(s.A.card(),'');
 s.R.setSession({...s.R.session()},'ncred/v2/ffffffffffffffffffffffff');assert.equal(s.A.card(),'');
 s.R.setSession(null,'');assert.equal(s.A.card(),'');assert.equal(s.A.publish(true),false);assert.equal(s.A.receive(WIRE,Date.now()),false);
});

test('the Game Master sees on the room page what players see, and where to write',async()=>{
 const c=campaign(),s=await gmScene(c);
 let card=s.A.card();
 assert.ok(card.includes('Игроки видят записей: 2. Черновиков: 1.'));assert.ok(card.includes('Ищут курьера'));assert.ok(!card.includes('водитель'));assert.ok(!/<(input|textarea|select|button)\b/.test(card));
 assert.ok(card.indexOf('Тихий час')<card.indexOf('Ищут курьера')); // newest publication first
 s.A.setPublished(c,'e3',false);s.A.setPublished(c,'e1',false);assert.ok(s.A.card().includes('опубликуйте запись в разделе «Агент»'));
 const none=await scene({role:'gm'});assert.ok(none.A.card().includes('выберите выше кампанию'));
 none.st.lang='en';assert.ok(none.A.card().includes('choose a campaign for the room above'));
 assert.equal(loadTab().A.card(),'');
});

test('the editor under a campaign: both groups, labelled fields, the counter and the state of the room',async()=>{
 const c=campaign(),s=await gmScene(c),html=s.A.panel(c,'ru');
 assert.match(html,/data-ra-edit="c1"/);assert.ok(html.includes('АГЕНТ: ЛЕНТА ДЛЯ ИГРОКОВ'));assert.ok(html.includes('опубликовано 2 / 30'));
 assert.ok(html.includes('Черновики (1)'));assert.ok(html.includes('Опубликовано (2)'));assert.ok(html.includes('Комната открыта: игроки видят записей — 2.'));
 assert.ok(html.includes('Черновик: оплата &lt;b&gt;вдвое&lt;/b&gt;'));assert.ok(!html.includes('<b>вдвое'));
 assert.ok(html.includes('data-ra-action="publish" data-id="e2" aria-label="Опубликовать: Нужен водитель"'));
 assert.ok(html.includes('data-ra-action="unpublish" data-id="e3" aria-label="Скрыть от игроков: Бар «Тихий час»"'));
 assert.equal((html.match(/data-ra-action="edit"/g)||[]).length,3);assert.equal((html.match(/data-ra-action="delete"/g)||[]).length,3);
 assert.ok(html.indexOf('data-id="e2"')<html.indexOf('data-ra-group="published"')&&html.indexOf('data-ra-group="published"')<html.indexOf('data-id="e3"'));
 // Every field sits inside its label, so it has a name; the rating is offered for places only.
 for(const id of ['ra-kind','ra-rating','ra-title','ra-text'])assert.match(html,new RegExp(`<label class="field[^"]*"[^>]*>[^<]+<(select|input|textarea) id="${id}"`));
 assert.ok(html.includes('data-ra-rating hidden'));assert.ok(html.includes(`maxlength="${s.A.MAX_TITLE}"`));assert.ok(html.includes(`maxlength="${s.A.MAX_TEXT}"`));
 assert.ok(html.includes('data-ra-action="save">Добавить в черновики'));assert.ok(!html.includes('data-ra-action="cancel"'));
 // The help is never a bare `p.muted`: the native look folds long ones to two lines behind a small «Подробнее» button.
 assert.ok(html.includes(`<p class="ra-help">${s.A.T.ru.help}</p>`));assert.ok(s.A.T.ru.help.length>170);
 for(const m of html.matchAll(/<p class="muted">([^<]*)<\/p>/g))assert.ok(m[1].length<=170,m[1]);
 assert.match(read('room-agent.css'),/\.ra-help\s*\{[^}]*color:\s*var\(--muted\)/);
 // The groups are h2: the campaign page has only an h1 above them, so no heading level is skipped.
 assert.equal((html.match(/<h2 class="ra-sub" tabindex="-1" data-ra-group="(drafts|published)">/g)||[]).length,2);assert.ok(!/<h[3-6]\b/.test(html));
 assert.equal((read('campaigns.js').match(/<h1 data-camp-title>/g)||[]).length,1);
 const en=s.A.panel(c,'en');assert.ok(en.includes('AGENT: FEED FOR PLAYERS'));assert.ok(en.includes('aria-label="Publish: Нужен водитель"'));assert.ok(en.includes('>Wanted<'));
 const bare={id:'c2',name:'Пусто',roster:[]},empty=s.A.panel(bare,'ru');
 assert.ok(empty.includes('Черновиков нет.'));assert.ok(empty.includes('Игрокам пока ничего не открыто.'));assert.ok(empty.includes('В комнате выбрана другая кампания'));assert.equal('agentFeed' in bare,false);
 for(const bad of [null,7,[],{},{id:''}])assert.equal(s.A.panel(bad,'ru'),'');
 const player=await scene();assert.ok(player.A.panel(c,'ru').includes('Вы в комнате как игрок'));
 const alone=loadTab();assert.ok(alone.A.panel(c,'en').includes('No room is open'));
 // When the size limit cuts the list, the editor says how many reach the players.
 const big={id:'c1',name:'B',roster:[],agentFeed:Array.from({length:30},(_,i)=>({id:'e'+i,kind:'news',title:'語'.repeat(80),text:'語'.repeat(500),at:1,pub:true,pubAt:1000-i}))};
 const cut=await gmScene(big);assert.match(cut.A.panel(big,'ru'),/Из-за объёма игрокам уйдут только \d+ самых новых записей из 30\./);
});

test('the editor buttons: draft, publish, hide, edit in place, delete and take it back',async()=>{
 const c={id:'c1',name:'Арасака',roster:[]},s=await gmScene(c),A=s.A;
 const fields={kind:{dataset:{raField:'kind'},value:'job'},rating:{dataset:{raField:'rating'},value:'3'},title:{dataset:{raField:'title'},value:''},text:{dataset:{raField:'text'},value:''}};
 const ratingBox={hidden:true},root={dataset:{raEdit:'c1'},querySelector:q=>q==='[data-ra-rating]'?ratingBox:(/data-ra-field="(\w+)"/.exec(q)?fields[/data-ra-field="(\w+)"/.exec(q)[1]]:null)};
 for(const f of Object.values(fields))f.closest=()=>root;
 const type=(name,value)=>{fields[name].value=value;s.listeners.input.forEach(f=>f({target:fields[name]}))};
 const click=(act,id)=>{const b={dataset:{raAction:act,...(id?{id}:{})},closest:q=>q==='[data-ra-action]'?b:root};s.listeners.click.forEach(f=>f({target:b}))};
 click('save');assert.equal(s.notices.at(-1),'Введите заголовок записи.');assert.equal(s.saves(),0);assert.equal(s.focused.at(-1),'#ra-title');assert.equal('agentFeed' in c,false);
 // Typing is kept without a repaint, and what is typed survives one.
 type('kind','place');assert.equal(ratingBox.hidden,false);type('rating','4');type('title','Бар <Тихий час>');type('text','Первая строка\nвторая');
 assert.equal(s.renders(),0);
 let html=A.panel(c,'ru');assert.ok(html.includes('value="Бар &lt;Тихий час&gt;"'));assert.ok(html.includes('Первая строка\nвторая</textarea>'));assert.ok(html.includes('<option value="place" selected>'));assert.ok(html.includes('<option value="4" selected>'));assert.ok(!html.includes('data-ra-rating hidden'));
 click('save');assert.equal(s.saves(),1);assert.equal(s.renders(),1);
 const id=c.agentFeed[0].id;eq({...c.agentFeed[0],at:0},{id,kind:'place',title:'Бар <Тихий час>',text:'Первая строка\nвторая',rating:4,at:0});
 eq(A._test.form(),{campaignId:'c1',editId:'',kind:'job',title:'',text:'',rating:3}); // the form is empty again
 type('kind','job');assert.equal(ratingBox.hidden,true);
 // Nothing went to the players yet; publishing sends it with the next save of the room.
 assert.equal(A.payload(c).fit,0);click('publish',id);assert.equal(c.agentFeed[0].pub,true);assert.equal(s.saves(),2);assert.equal(A.payload(c).data.list[0].r,4);
 assert.equal(s.focused.at(-1),`[data-ra-edit] [data-ra-item="${id}"] button`);
 click('unpublish',id);assert.equal('pub' in c.agentFeed[0],false);assert.equal(s.saves(),3);
 // Edit loads the entry into the form; saving changes it in place and keeps its id.
 click('edit',id);eq(A._test.form(),{campaignId:'c1',editId:id,kind:'place',title:'Бар <Тихий час>',text:'Первая строка\nвторая',rating:4});assert.equal(s.saves(),3);
 html=A.panel(c,'ru');assert.ok(html.includes('data-ra-action="save">Сохранить изменения'));assert.ok(html.includes('data-ra-action="cancel"'));assert.ok(html.includes('Вы изменяете запись.'));
 for(const [k,v] of Object.entries({kind:'place',rating:'4',title:'Бар <Тихий час>',text:'Первая строка\nвторая'}))fields[k].value=v;
 type('title','Бар «Громкий час»');type('rating','2');click('save');
 assert.equal(c.agentFeed.length,1);assert.equal(c.agentFeed[0].id,id);assert.equal(c.agentFeed[0].title,'Бар «Громкий час»');assert.equal(c.agentFeed[0].rating,2);assert.equal(s.saves(),4);
 click('edit',id);click('cancel');assert.equal(A._test.form().editId,'');assert.equal(s.saves(),4);
 // Delete can be taken back from the notice.
 for(const [k,v] of Object.entries({kind:'news',rating:'3',title:'Вторая',text:''}))type(k,v);
 click('save');assert.equal(c.agentFeed.length,2);
 click('delete',id);eq(c.agentFeed.map(e=>e.title),['Вторая']);assert.equal(s.actions.length,1);eq([s.actions[0].m,s.actions[0].label],['Запись удалена.','Отменить']);assert.equal(s.saves(),6);
 s.actions[0].run();eq(c.agentFeed.map(e=>e.title),['Вторая','Бар «Громкий час»']);assert.equal(s.saves(),7);
 s.actions[0].run();assert.equal(c.agentFeed.length,2);assert.equal(s.notices.at(-1),'Вернуть запись не получилось: лента изменилась.'); // not twice
 // The limits are said in words.
 for(let i=0;i<A.MAX_ENTRIES;i++)A.add(c,{title:'t'+i});type('title','ещё');click('save');assert.match(s.notices.at(-1),/не больше 60 записей/);assert.equal(A._test.form().title,'ещё'); // what was typed is not lost
 for(const e of c.agentFeed.slice(0,A.MAX_PUBLISHED))A.setPublished(c,e.id,true);click('publish',c.agentFeed[40].id);assert.match(s.notices.at(-1),/не больше 30 записей/);
 click('publish','ghost');assert.equal(s.notices.at(-1),'Этой записи уже нет.');
 // A click elsewhere, or under a campaign that is gone, is not ours.
 assert.equal(A.onClick({target:{closest:()=>null}}),false);
 const stray={dataset:{raAction:'save'},closest:q=>q==='[data-ra-action]'?stray:{dataset:{raEdit:'nope'},querySelector:()=>null}};assert.equal(A.onClick({target:stray}),false);
 assert.equal(A.onInput({target:{dataset:{}}}),false);
});

test('a campaign file carries the feed, and what comes back from a file is rebuilt',()=>{
 const listeners={},document={addEventListener(t,f){(listeners[t]||=[]).push(f)},querySelector:()=>null,querySelectorAll:()=>[]};
 const store=new Map(),storage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};let n=0;
 const load=withAgent=>{const window={document,crypto:{randomUUID:()=>'u-'+(++n)},confirm:()=>true,sessionStorage:storage,localStorage:storage};
  const ctx={window,document,globalThis:window,sessionStorage:storage,localStorage:storage,Math,Number,String,Array,Object,Set,Map,WeakMap,JSON,Date,Promise,RegExp,Error,Infinity,setTimeout,clearTimeout,console,TextEncoder,URL,Blob};
  for(const f of ['beat-chart.js','campaigns.js','gm-tools.js','gm-extras.js','npc-library.js','room-journal.js',...(withAgent?['room-agent.js']:[]),'campaign-io.js'])vm.runInNewContext(read(f),ctx,{filename:f});
  return window};
 const w=load(true),IO=w.CampaignIO,c=campaign(),st={lang:'ru',characters:[],campaigns:[c,{id:'c2',name:'Пустоши',roster:[]}]};
 const file=IO.buildExport(st,{},Date.UTC(2046,0,2));eq(file.campaigns[0].agentFeed,c.agentFeed);
 const back=IO.parse(JSON.stringify(file));assert.equal(back.ok,true);
 eq(back.bundle.campaigns[0].agentFeed,c.agentFeed);assert.equal('agentFeed' in back.bundle.campaigns[1],false); // drafts and published flags come back; no field where there was none
 const dirty={...plain(c),agentFeed:[...plain(c.agentFeed),null,{title:''},{id:'e1',kind:'zzz',title:'<script>alert(1)</script>',text:'x'.repeat(9000),html:'<b>',pub:1},'junk']};
 const got=IO.cleanCampaign(dirty);assert.equal(got.dropped,3);assert.equal(got.campaign.agentFeed.length,4);
 const odd=got.campaign.agentFeed[3];eq(Object.keys(odd).sort(),['at','id','kind','text','title']);assert.notEqual(odd.id,'e1');assert.equal(odd.kind,'news');assert.equal(odd.text.length,500);
 assert.equal(IO.cleanCampaign({...plain(c),agentFeed:'x'}).campaign.agentFeed,undefined);
 // A file that flags more entries as published than the limit is stored with the limit already applied.
 const many=IO.cleanCampaign({...plain(c),agentFeed:Array.from({length:60},(_,i)=>({id:'e'+i,kind:'news',title:'t'+i,pub:true,pubAt:i<30?1000+i:10+i}))}).campaign.agentFeed;
 assert.equal(many.length,60);eq(many.filter(e=>e.pub).map(e=>e.id),Array.from({length:30},(_,i)=>'e'+i));
 // The preview names the feed only when the file has one.
 const pend=IO.plan(back.bundle,st,IO.defaultSelect?.(back.bundle));assert.equal(pend.campaigns[0].agent,3);assert.equal(pend.campaigns[1].agent,0);
 // The editor is part of the page of an open campaign.
 const page=IO.decorate('<div data-campaign-view="c1"></div>',st);assert.ok(page.includes('data-ra-edit="c1"'));assert.ok(page.indexOf('data-rj-pick')<page.indexOf('data-ra-edit'));
 assert.ok(!IO.decorate('<div>list</div>',st).includes('data-ra-edit'));
 // Without the module the field is left out, not kept as it came.
 const bare=load(false).CampaignIO;assert.equal('agentFeed' in bare.cleanCampaign(dirty).campaign,false);assert.ok(!bare.decorate('<div data-campaign-view="c1"></div>',st).includes('data-ra-'));
});

test('the module is registered in the page in the right order, and both languages have the same strings',()=>{
 const html=read('index.html'),at=s=>{const i=html.indexOf(s);assert.ok(i>=0,s);return i};
 assert.ok(at('src="room.js"')<at('src="room-agent.js"'));assert.ok(at('src="room-agent.js"')<at('src="campaign-io.js"'));assert.ok(at('src="campaign-io.js"')<at('src="app.js"'));
 at('<link rel="stylesheet" href="room-agent.css">');
 const {A}=loadTab(),keys=o=>Object.keys(o).sort();
 eq(keys(A.T.ru),keys(A.T.en));eq(keys(A.T.ru.kinds),[...A.KINDS].sort());eq(keys(A.T.en.kinds),[...A.KINDS].sort());
 for(const k of keys(A.T.ru))assert.equal(typeof A.T.ru[k],typeof A.T.en[k],k);
 // The styles use theme variables only, so every look and the light theme are followed.
 assert.equal(/#[0-9a-f]{3,8}\b|rgba?\(/i.test(read('room-agent.css')),false);
});
