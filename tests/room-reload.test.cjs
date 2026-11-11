// What a reload of the page keeps: the roll feed of the room, and the sheets the Game Master has not answered yet.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const storage=m=>({getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)});

// One load of the page; `local` and `tab` are the browser's localStorage and this tab's sessionStorage.
function loadRoom({local=new Map(),tab=new Map(),toasts=[]}={}){
 const listeners={},box={children:[],prepend(el){toasts.push(el.innerHTML)},lastChild:{remove(){}}};
 const document={addEventListener(type,f){(listeners[type]||=[]).push(f)},querySelector:sel=>sel==='.room-toasts'?box:null,querySelectorAll:()=>[],createElement:()=>({classList:{add(){}},remove(){}}),visibilityState:'visible'};
 const later=(f,ms)=>{const h=setTimeout(f,ms);if(ms>=1000)h.unref?.();return h};
 const window={document,localStorage:storage(local),sessionStorage:storage(tab),crypto:globalThis.crypto,location:{hash:'',origin:'https://example.test',pathname:'/'},addEventListener(){},confirm:()=>true,navigator:{},btoa,atob,Response,Blob,ReadableStream,ROLES:[]};
 const ctx={window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Error,setTimeout:later,clearTimeout,setInterval,clearInterval,console};
 vm.runInNewContext(read('room-transport.js')+'\n'+read('room.js'),ctx);
 const R=window.Room._test,notices=[];
 R.setApp({getState:()=>({lang:'ru',characters:[],campaigns:[]}),notify:m=>notices.push(m)});
 R.setTransport({publish:()=>1,close(){}});
 const press=async(action,data={})=>{for(const f of listeners.click||[])await f({target:{closest:sel=>sel==='[data-room-action]'?{dataset:{roomAction:action,...data}}:null}})};
 return {window,R,notices,toasts,press,local,tab};
}
const CODE='K7RQM2XAPZ9E',settle=()=>new Promise(ok=>setTimeout(ok,30));
async function table(){
 const maker=loadRoom().R,r=await maker.deriveRoom(CODE),keys={};
 for(const n of ['gm','ann']){const key=await maker.newIdentity();keys[n]={key,id:key.fp+'.0000000'+Object.keys(keys).length}}
 const seat=(p,n,role,code=CODE)=>{p.R.setKey(r.key);p.R.setIdentity(keys[n].key);p.R.setSession({code,role,name:n,memberId:keys[n].id,gmFp:keys.gm.key.fp,toasts:true},r.topic);return p};
 const msg=(from,t,d,sub='e')=>maker.signedEnvelope(keys[from].key,keys[from].id,r.topic,r.key,sub,t,d,Date.now(),Math.random().toString(16).slice(2,14));
 const give=async(to,bytes,sub='e',retain=false)=>{await to.R.receive({topic:r.topic+'/'+sub,retain,payload:bytes});await settle()};
 return {r,keys,seat,msg,give};
}

test('the roll feed comes back after a reload in the same room and is dropped with another room',async()=>{
 const {seat,msg,give}=await table(),local=new Map(),ann=seat(loadRoom({local}),'ann','player');
 await give(ann,await msg('gm','roll',{who:'Мастер',label:'Восприятие',detail:'1d10 7 + 8',total:15}));
 ann.window.Room.roll({label:'Уклонение',detail:'Критический успех',total:23,character:'Ви'});await settle();
 assert.equal(ann.R.state().feed.length,2);
 const again=seat(loadRoom({local}),'ann','player');again.R.restore();
 assert.deepEqual(plain(again.R.state().feed.map(r=>[r.who,r.label,r.total,r.crit,r.mine])),[['ann','Уклонение',23,'crit',true],['ann','Восприятие',15,'',false]].map((x,i)=>i?['Мастер',...x.slice(1)]:x));
 const other=seat(loadRoom({local}),'ann','player','ZZZZZZZZZZZZ');other.R.restore();assert.equal(other.R.state().feed.length,0);
 // Junk kept under the key is not shown.
 local.set('nightcity-red-room-feed',JSON.stringify({code:CODE,feed:[null,5,{who:{},label:'<b>x</b>'.repeat(50),total:'много',at:Date.now()},{who:'Старый',label:'x',total:1,at:Date.now()-13*3600*1000}]}));
 const junk=seat(loadRoom({local}),'ann','player');junk.R.restore();
 assert.equal(junk.R.state().feed.length,1);assert.equal(junk.R.state().feed[0].who,'');assert.equal(junk.R.state().feed[0].label.length,80);assert.equal(junk.R.state().feed[0].total,0);
});

test('a sheet the GM has not answered survives a reload of the GM page in the same tab',async()=>{
 const {keys,seat}=await table(),tab=new Map(),gm=seat(loadRoom({tab}),'gm','gm');
 gm.R.incoming().push({from:keys.ann.id,dev:'a'.repeat(16),who:'Аня',character:{id:'v1',name:'Ви',role:'solo'},ref:'abc',at:Date.now()});
 await gm.press('decline-sheet',{index:'5'}); // any change of the list writes it down
 assert.equal(JSON.parse(tab.get('nightcity-red-room-incoming')).list.length,1);
 const again=seat(loadRoom({tab}),'gm','gm');again.R.restore();
 assert.deepEqual(plain(again.R.incoming().map(x=>[x.from,x.dev,x.who,x.character.name,x.ref])),[[keys.ann.id,'a'.repeat(16),'Аня','Ви','abc']]);
 // A player's page, or another tab, gets nothing.
 const player=seat(loadRoom({tab}),'ann','player');player.R.restore();assert.equal(player.R.incoming().length,0);
 const fresh=seat(loadRoom(),'gm','gm');fresh.R.restore();assert.equal(fresh.R.incoming().length,0);
 // Declining it forgets it.
 await again.press('decline-sheet',{index:'0'});assert.equal(tab.has('nightcity-red-room-incoming'),false);
});

test('a clock the GM moves gets a toast; a copy kept by the broker and an unchanged heartbeat do not',async()=>{
 const {seat,msg,give}=await table(),ann=seat(loadRoom(),'ann','player');
 await give(ann,await msg('gm','clocks',{list:[{name:'Арасака идёт по следу',size:6,filled:0}]},'k'),'k',true);
 assert.equal(ann.toasts.length,0);
 await give(ann,await msg('gm','clocks',{list:[{name:'Арасака идёт по следу',size:6,filled:2}]},'k'),'k');
 assert.equal(ann.toasts.length,1);assert.match(ann.toasts[0],/<b>2\/6<\/b>/);assert.match(ann.toasts[0],/Счётчик/);assert.match(ann.toasts[0],/Арасака идёт по следу/);
 await give(ann,await msg('gm','clocks',{list:[{name:'Арасака идёт по следу',size:6,filled:2}]},'k'),'k');
 assert.equal(ann.toasts.length,1);
});

test('when the Game Master role comes back to a device, its unchanged journal is sent again at once',async()=>{
 const sent=[],document={addEventListener(){},querySelector:()=>null,visibilityState:'visible'};
 const state={lang:'ru',characters:[],campaigns:[{id:'c1',name:'Арасака',roster:[],journal:[{id:'j1',at:1000,text:'Первая',auto:false}],journalShared:['j1']}]};
 const window={document,App:{getState:()=>state,lang:()=>'ru',notify(){},save(){}},Room:{journalLink:{who:()=>({role:'gm',room:'t',campaignId:'c1',online:1}),send:d=>{sent.push(d);return Promise.resolve(1)}}}};
 vm.runInNewContext(read('room-journal.js'),{window,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Error,console,URL,Blob});
 const J=window.RoomJournal;
 assert.equal(J.publish(true),true);assert.equal(sent.length,1);
 assert.equal(J.publish(true),false,'unchanged and just sent: the heartbeat does not repeat it');
 J.forget();assert.equal(J.publish(true),true);assert.equal(sent.length,2);assert.equal(sent[1].list.length,1);
 assert.match(read('room.js'),/app\?\.notify\?\.\(ta\('nowGM'\)\);[^\n]*global\.RoomJournal\?\.forget\?\.\(\);/);
});

test('the team card names the wound state',()=>{
 const R=loadRoom().R;R.setSession({code:CODE,role:'player',name:'x',memberId:'0'.repeat(24)+'.00000000'},'t');
 const card=hp=>R.memberCard('id',{name:'Аня',role:'player',at:Date.now(),character:{name:'Ви',role:'solo',rank:4,hp,max:45,humanity:60,luck:6,luckMax:6,head:11,body:11,ref:7}});
 assert.match(card(15),/room-wound serious">тяжело ранен</);assert.match(card(0),/room-wound mortal">при смерти</);assert.doesNotMatch(card(30),/room-wound/);
});
