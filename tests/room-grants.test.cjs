const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));

// The pure part with the sheet's real tools: armor rules from combat-tools + damage-apply, the ledger from wallet.
function load({state=null,link=null}={}){
 const store=new Map(),notices=[],listeners={};
 const document={addEventListener(type,f){(listeners[type]||=[]).push(f)},querySelector:()=>null,querySelectorAll:()=>[]};
 const sess=new Map(),window={document,sessionStorage:{getItem:k=>sess.has(k)?sess.get(k):null,setItem:(k,v)=>sess.set(k,String(v)),removeItem:k=>sess.delete(k)},localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},crypto:globalThis.crypto,navigator:{},confirm:()=>true,addEventListener(){}};
 window.window=window;
 const ctx={window,document,globalThis:window,crypto:globalThis.crypto,console,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Error,Uint8Array,setTimeout,clearTimeout};
 vm.createContext(ctx);
 for(const f of ['wallet.js','combat-tools.js','equipment-tools.js','damage-apply.js','room-grants.js'])vm.runInContext(read(f),ctx,{filename:f});
 let saves=0;
 if(state)window.App={getState:()=>state,lang:()=>state.lang||'ru',save(){saves++},render(){},notify:m=>notices.push(m)};
 if(link)window.Room={grantLink:link,changed(){}};
 return {G:window.RoomGrants,window,store,sess,notices,saves:()=>saves};
}
const V=()=>({id:'v1',name:'Ви',role:'solo',stats:{BODY:8,WILL:6},hp:45,head:11,bodyArmor:11,extra:{cash:700}});
const GID='0123456789abcdef',grant=(x={})=>({gid:GID,kind:'damage',n:14,cid:'v1',loc:'body',via:'armor',note:'',...x});

test('a grant is rebuilt from known fields and refused when anything is out of range',()=>{
 const {G}=load();
 assert.deepEqual(plain(G.clean({...grant(),to:'x',junk:{a:1},name:'ignored'})),{gid:GID,kind:'damage',n:14,cid:'v1',note:'',loc:'body',via:'armor'});
 for(const bad of [null,[],'x',{},grant({kind:'kill'}),grant({n:0}),grant({n:-5}),grant({n:1000}),grant({n:1.5}),grant({n:'1e3'}),grant({n:{}}),grant({gid:'nope'}),grant({gid:GID+'0'}),grant({cid:''}),grant({cid:5}),grant({cid:'x'.repeat(61)}),grant({loc:'leg'}),grant({via:'ap'}),grant({kind:'heal',n:1000}),grant({kind:'ip',n:10000}),grant({kind:'cash',n:0}),grant({kind:'cash',n:1000001}),grant({kind:'cash',n:-1000001}),grant({kind:'item',n:2}),grant({kind:'item',n:2,name:'   '}),grant({kind:'item',n:100,name:'Нож'})])
  assert.equal(G.clean(bad),null,JSON.stringify(bad));
 assert.equal(G.clean(grant({kind:'cash',n:-300})).n,-300);
 assert.equal(G.clean(grant({kind:'item',n:2,name:'  Медпак\u0000 '})).name,'Медпак');
 assert.equal(G.clean(grant({note:'x'.repeat(500)})).note.length,120);
 assert.equal(G.clean(grant({note:{a:1}})).note,'');
});

test('damage goes through the armor of the hit location and wears it down',()=>{
 const {G}=load(),c=V(),g=G.clean(grant());
 const seen=G.preview(c,g,'ru');assert.deepEqual(plain(seen),{ok:true,lines:['HP 45 → 42','SP тела 11 → 10']});
 assert.equal(c.hp,45,'a preview changes nothing');
 const r=G.apply(c,g,'ru');assert.equal(r.ok,true);assert.equal(c.hp,42);assert.equal(c.bodyArmor,10);assert.equal(c.head,11);
 assert.match(r.text,/^Урон 14 · тело · через броню · HP 45 → 42/);
 // The head doubles what gets through.
 const h=V();G.apply(h,G.clean(grant({loc:'head'})),'ru');assert.equal(h.hp,39);assert.equal(h.head,10);
 // Armor that stops the hit is not worn down.
 const s=V(),stopped=G.preview(s,G.clean(grant({n:9})),'en');assert.deepEqual(plain(stopped.lines),['HP 45 → 45','Armor stopped the damage.']);
 // Straight to HP ignores armor.
 const d=V();G.apply(d,G.clean(grant({via:'direct',n:20})),'ru');assert.equal(d.hp,25);assert.equal(d.bodyArmor,11);
});

test('healing stops at the maximum; money goes through the wallet with a ledger entry',()=>{
 const {G}=load(),c={...V(),hp:20};
 assert.equal(G.hpMax(c),45);
 G.apply(c,G.clean(grant({kind:'heal',n:10})),'ru');assert.equal(c.hp,30);
 G.apply(c,G.clean(grant({kind:'heal',n:999})),'ru');assert.equal(c.hp,45);
 assert.equal(G.preview(c,G.clean(grant({kind:'heal',n:5})),'ru').ok,false);
 const r=G.apply(c,G.clean(grant({kind:'cash',n:500,note:'За заказ'})),'ru',{at:'2045-01-01T00:00:00.000Z'});
 assert.equal(r.ok,true);assert.equal(c.extra.cash,1200);
 assert.deepEqual(plain(c.extra.walletLog[0]),{at:'2045-01-01T00:00:00.000Z',delta:500,balance:1200,note:'От ведущего: За заказ'});
 // Taking more than the player has is refused and changes nothing.
 const short=G.apply(c,G.clean(grant({kind:'cash',n:-5000})),'ru');assert.equal(short.ok,false);assert.match(short.why,/Не хватает 3 800 eb/);assert.equal(c.extra.cash,1200);
 G.apply(c,G.clean(grant({kind:'cash',n:-200})),'en');assert.equal(c.extra.cash,1000);assert.equal(c.extra.walletLog[0].delta,-200);
});

test('IP lands in the IP log and an item in the inventory; an old sheet without those lists still works',()=>{
 const {G}=load(),c={id:'v1',name:'Старый',stats:{BODY:6,WILL:6},hp:40,head:0,bodyArmor:0};
 assert.equal(G.apply(c,G.clean(grant({kind:'ip',n:60,note:'Сессия 3'})),'ru',{at:'2045-02-03T10:00:00.000Z'}).ok,true);
 assert.deepEqual(plain(c.extra.ipLog),[{id:'g'+GID,date:'2045-02-03',reason:'От ведущего: Сессия 3',delta:60}]);
 assert.equal(G.apply(c,G.clean(grant({kind:'item',n:2,name:'Медпак'})),'ru').ok,true);
 assert.deepEqual(plain(c.extra.items.map(i=>({name:i.name,quantity:i.quantity,category:i.category}))),[{name:'Медпак',quantity:2,category:'equipment'}]);
 assert.equal(G.apply(c,G.clean(grant({kind:'cash',n:100})),'ru').ok,true);assert.equal(c.extra.cash,100);
 // A sheet whose lists are not lists is left alone.
 const odd={id:'v1',stats:{},hp:10,extra:{ipLog:'x',items:{}}};
 assert.equal(G.apply(odd,G.clean(grant({kind:'ip',n:5})),'ru').ok,false);assert.equal(G.apply(odd,G.clean(grant({kind:'item',n:1,name:'Нож'})),'ru').ok,false);
 assert.deepEqual(plain(odd.extra),{ipLog:'x',items:{}});
});

test('the GM form makes one clean grant per player and says what is wrong',()=>{
 const {G}=load();
 assert.deepEqual(plain(G.fromForm({kind:'cash',n:'500',take:true,note:' штраф '},'v1',GID,'ru').grant),{gid:GID,kind:'cash',n:-500,cid:'v1',note:'штраф'});
 assert.equal(G.fromForm({kind:'damage',n:'',loc:'body',via:'armor'},'v1',GID,'ru').error,'Введите целое число больше нуля.');
 assert.equal(G.fromForm({kind:'damage',n:'-4',loc:'body',via:'armor'},'v1',GID,'en').error,'Enter a whole number above zero.');
 assert.equal(G.fromForm({kind:'item',n:'1',name:''},'v1',GID,'ru').error,'Введите название предмета.');
 assert.equal(G.describe(G.fromForm({kind:'item',n:'3',name:'Граната'},'v1',GID,'ru').grant,'ru'),'Предмет: Граната × 3');
 assert.equal(G.describe(G.clean(grant({kind:'cash',n:-1500})),'en'),'Money −1 500 eb');
});

test('an offer waits for the player: nothing changes until «Применить», a repeat is ignored, the GM gets the answer',()=>{
 const c=V(),replies=[],state={lang:'ru',characters:[c]};
 const p=load({state,link:{who:()=>({role:'player',code:'K7RQM2XAPZ9E',memberId:'me',characterId:'v1'}),reply:(to,d)=>{replies.push({to,...d});return Promise.resolve(1)}}});
 assert.equal(p.G.receive({...grant(),to:'me'},{from:'gm-id',gm:'Мастер'}),true);
 assert.equal(c.hp,45);assert.equal(p.saves(),0);assert.equal(p.G._test.pending().length,1);
 assert.equal(p.G.receive({...grant(),to:'me'},{from:'gm-id',gm:'Мастер'}),false,'the same grant twice');
 assert.equal(p.G.receive({kind:'damage',n:99999,gid:'ffffffffffffffff',cid:'v1',loc:'body',via:'armor'},{from:'gm-id'}),false,'out of range');
 assert.match(p.G._test.trayHTML(),/Урон 14 · тело · через броню/);assert.match(p.G._test.trayHTML(),/HP 45 → 42 · SP тела 11 → 10/);
 // It survives a reload of the page in the same room.
 assert.equal(JSON.parse(p.store.get('nightcity-red-room-grants')).pending.length,1);
 p.G._test.answer(GID,true);
 assert.equal(c.hp,42);assert.equal(c.bodyArmor,10);assert.equal(p.saves(),1);assert.equal(p.G._test.pending().length,0);
 assert.deepEqual(replies,[{to:'gm-id',gid:GID,state:'applied',text:'Урон 14 · тело · через броню · HP 45 → 42 · SP тела 11 → 10'}]);
 assert.match(p.notices.at(-1),/^Применено: Урон 14/);
 // Sent again after it was answered (a replay): ignored.
 assert.equal(p.G.receive({...grant(),to:'me'},{from:'gm-id'}),false);assert.equal(c.hp,42);
 // Declining changes nothing and tells the GM.
 p.G.receive({...grant({gid:'aaaaaaaaaaaaaaaa',kind:'cash',n:-100}),to:'me'},{from:'gm-id'});p.G._test.answer('aaaaaaaaaaaaaaaa',false);
 assert.equal(c.extra.cash,700);assert.equal(replies.at(-1).state,'declined');
 // A grant for a character that is not on this device can only be declined.
 p.G.receive({...grant({gid:'bbbbbbbbbbbbbbbb',cid:'other'}),to:'me'},{from:'gm-id'});
 assert.match(p.G._test.trayHTML(),/data-rg-apply="bbbbbbbbbbbbbbbb" disabled/);p.G._test.answer('bbbbbbbbbbbbbbbb',true);assert.equal(p.G._test.pending().length,1);
});

test('the answer counts only from the member the grant went to',()=>{
 const g=load({state:{lang:'ru',characters:[]},link:{who:()=>({role:'gm',code:'K7RQM2XAPZ9E'})}});
 g.G._test.sentTo.set(GID,{to:'p1',name:'Аня',character:'Ви'});
 assert.equal(g.G.acked({gid:GID,state:'applied',text:'x'},{from:'p2'}),false);
 assert.equal(g.G.acked({gid:GID,state:'won',text:'x'},{from:'p1'}),false);
 assert.equal(g.G.acked({gid:GID,state:'applied',text:'HP 45 → 42'},{from:'p1'}),true);
 assert.equal(g.notices.at(-1),'Ви применил(а): HP 45 → 42');
 assert.equal(g.G.acked({gid:GID,state:'applied',text:'again'},{from:'p1'}),false);
});

test('both languages have the same texts',()=>{
 const src=read('room-grants.js'),ru=/\n    ru: \{([\s\S]*?)\n    \},\n    en: \{/.exec(src)[1],en=/\n    en: \{([\s\S]*?)\n    \},\n  \};/.exec(src)[1];
 const keys=b=>[...b.matchAll(/(?:^|[ ,{])([A-Za-z]+): (?=['{])/g)].map(m=>m[1]).sort().join();
 assert.equal(keys(ru),keys(en));assert.ok(keys(ru).split(',').length>40);
});

/* ---------- room.js: who may send a grant ---------- */
function loadRoom(){
 const store=new Map(),document={addEventListener(){},querySelector:()=>null,visibilityState:'visible'};
 const later=(f,ms)=>{const h=setTimeout(f,ms);if(ms>=1000)h.unref?.();return h};
 const window={document,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},crypto:globalThis.crypto,location:{hash:'',origin:'https://example.test',pathname:'/'},addEventListener(){},confirm:()=>true,navigator:{},btoa,atob,Response,Blob,ReadableStream};
 const ctx={window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Error,setTimeout:later,clearTimeout,setInterval,clearInterval,console};
 vm.runInNewContext(read('room-transport.js')+'\n'+read('room.js'),ctx);
 const R=window.Room._test,sent=[],got=[],acks=[];
 R.setApp({getState:()=>({lang:'ru',characters:[],campaigns:[]}),notify(){}});
 R.setTransport({publish:(sub,bytes)=>{sent.push({sub,bytes});return 1},close(){}});
 window.RoomGrants={receive:(d,meta)=>{got.push({d:plain(d),meta});return true},acked:(d,meta)=>{acks.push({d:plain(d),meta});return true}};
 return {window,R,sent,got,acks};
}
const CODE='K7RQM2XAPZ9E';
async function table(){
 const maker=loadRoom().R,r=await maker.deriveRoom(CODE),keys={};
 for(const n of ['gm','ann','bob','eve']){const key=await maker.newIdentity();keys[n]={key,id:key.fp+'.0000000'+Object.keys(keys).length}}
 const page=(n,role)=>{const p=loadRoom();p.R.setKey(r.key);p.R.setIdentity(keys[n].key);p.R.setSession({code:CODE,role,name:n,memberId:keys[n].id,gmFp:keys.gm.key.fp,characterId:'v1'},r.topic);return p};
 const msg=(from,t,d,at=Date.now(),sub='e')=>maker.signedEnvelope(keys[from].key,keys[from].id,r.topic,r.key,sub,t,d,at,Math.random().toString(16).slice(2,14));
 const give=async(to,bytes,retain=false,sub='e')=>{await to.R.receive({topic:r.topic+'/'+sub,retain,payload:bytes});await new Promise(ok=>setTimeout(ok,10))};
 return {r,keys,page,msg,give};
}

test('a grant is taken only from the trusted Game Master, only fresh and only when addressed to this member',async()=>{
 const {keys,page,msg,give}=await table(),ann=page('ann','player'),d={to:keys.ann.id,...grant()};
 await give(ann,await msg('eve','grant',d));assert.equal(ann.got.length,0,'another player');
 await give(ann,await msg('bob','grant',d));assert.equal(ann.got.length,0);
 await give(ann,await msg('gm','grant',{...d,to:keys.bob.id}));assert.equal(ann.got.length,0,'addressed to someone else');
 await give(ann,await msg('gm','grant',d,Date.now()-11*60000));assert.equal(ann.got.length,0,'an old one sent again');
 await give(ann,await msg('gm','grant',d,Date.now(),'c'),false,'c');assert.equal(ann.got.length,0,'another subtopic');
 const real=await msg('gm','grant',d);
 await give(ann,real);assert.equal(ann.got.length,1);assert.equal(ann.got[0].meta.from,keys.gm.id);assert.equal(ann.got[0].d.n,14);
 await give(ann,real);assert.equal(ann.got.length,1,'the very same message again');
 // Someone who only claims to be the GM in their status is still a player.
 await give(ann,await msg('eve','member',{name:'Eve',role:'gm',dev:'0'.repeat(16),cid:'',character:null},Date.now(),'m/'+keys.eve.id),false,'m/'+keys.eve.id);
 await give(ann,await msg('eve','grant',d));assert.equal(ann.got.length,1);
 // A Game Master's own page does not take grants.
 const gm=page('gm','gm');await give(gm,await msg('gm','grant',{...d,to:keys.gm.id}));assert.equal(gm.got.length,0);
});

test('only the Game Master\'s device sends a grant; a player\'s device sends only the answer',async()=>{
 const {keys,page,msg,give}=await table(),ann=page('ann','player'),gm=page('gm','gm');
 ann.R.members().set(keys.bob.id,{name:'bob',role:'player',at:Date.now()});
 assert.equal(await ann.window.Room.grantLink.send(keys.bob.id,grant()),0);assert.equal(ann.sent.length,0);
 assert.deepEqual(plain(ann.window.Room.grantLink.targets()),[]);
 assert.equal(await gm.window.Room.grantLink.send(keys.ann.id,grant()),0,'not a member of the room');
 gm.R.members().set(keys.ann.id,{name:'Аня',role:'player',fp:keys.ann.key.fp,dev:'a'.repeat(16),cid:'v1',character:{name:'Ви',hp:45,max:45},at:Date.now()});
 gm.R.members().set(keys.bob.id,{name:'Боб',role:'player',fp:keys.bob.key.fp,dev:'b'.repeat(16),cid:'',character:null,at:Date.now()});
 assert.deepEqual(plain(gm.window.Room.grantLink.targets()),[{id:keys.ann.id,name:'Аня',cid:'v1',character:'Ви'}]);
 assert.equal(await gm.window.Room.grantLink.send(keys.ann.id,grant()),1);assert.equal(gm.sent.length,1);
 await give(ann,gm.sent[0].bytes);assert.equal(ann.got.length,1);assert.equal(ann.got[0].d.to,keys.ann.id);
 assert.equal(await gm.window.Room.grantLink.reply(keys.ann.id,{gid:GID,state:'applied'}),0,'a GM does not answer grants');
 // The answer reaches the GM only when addressed to it.
 await give(gm,await msg('ann','grant-ack',{to:keys.gm.id,gid:GID,state:'applied',text:'ok'}));assert.equal(gm.acks.length,1);assert.equal(gm.acks[0].meta.from,keys.ann.id);
 await give(gm,await msg('ann','grant-ack',{to:keys.bob.id,gid:GID,state:'applied',text:'ok'}));assert.equal(gm.acks.length,1);
 await give(ann,await msg('bob','grant-ack',{to:keys.ann.id,gid:GID,state:'applied',text:'ok'}));assert.equal(ann.acks.length,0);
});

test('the GM keeps the player answer after a page reload',()=>{
 const link={who:()=>({role:'gm',code:'K7RQM2XAPZ9E'})};
 const a=load({state:{lang:'ru',characters:[]},link});a.G.refresh();
 a.G._test.sentTo.set(GID,{to:'p1',name:'Аня',character:'Ви'});
 // a new page shares the tab storage
 const saved=a.sess.get('nightcity-red-room-sent');assert.ok(saved);
 const c=load({state:{lang:'ru',characters:[]},link});c.sess.set('nightcity-red-room-sent',saved);c.G.refresh();
 assert.equal(c.G.acked({gid:GID,state:'applied',text:'HP 45 → 42'},{from:'p2'}),false);
 assert.equal(c.G.acked({gid:GID,state:'applied',text:'HP 45 → 42'},{from:'p1'}),true);
 assert.equal(c.sess.get('nightcity-red-room-sent'),undefined);
 // another room: nothing restored
 const d=load({state:{lang:'ru',characters:[]},link:{who:()=>({role:'gm',code:'ZZZZZZZZZZZZ'})}});d.sess.set('nightcity-red-room-sent',saved);d.G.refresh();
 assert.equal(d.G.acked({gid:GID,state:'applied',text:'x'},{from:'p1'}),false);
});
