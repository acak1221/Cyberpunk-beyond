const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const zipOK=(()=>{try{new CompressionStream('deflate-raw');new DecompressionStream('deflate-raw');return true}catch{return false}})();

// One browser tab: its own module state, optionally sharing localStorage with another tab of the same device.
function loadRoom({store=new Map(),timers=null,lang='ru'}={}){
 const document={addEventListener(){},querySelector:()=>null,visibilityState:'visible'};
 // Long timers (the 30 s wait for a GM receipt) are either collected to be fired by the test or do not keep node running.
 const later=(f,ms)=>{if(timers&&ms>=1000){timers.push(f);return timers.length}const h=setTimeout(f,ms);if(ms>=1000)h.unref?.();return h};
 const window={document,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},crypto:globalThis.crypto,location:{hash:'',origin:'https://example.test',pathname:'/'},addEventListener(){},navigator:{},btoa,atob,Response,Blob,CompressionStream,DecompressionStream,ROLES:[{id:'solo',name:{ru:'Соло',en:'Solo'}},{id:'fixer',name:{ru:'Фиксер',en:'Fixer'}}]};
 const ctx={window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Error,setTimeout:later,clearTimeout,setInterval,clearInterval,console};
 vm.runInNewContext(read('room-transport.js')+'\n'+read('room.js'),ctx);
 const R=window.Room._test,notices=[],sent=[];
 R.setApp({getState:()=>({lang,characters:window.chars||[],campaigns:window.camps||[]}),notify:m=>notices.push(m)});
 R.setTransport({publish:(sub,bytes)=>{sent.push({sub,bytes});return 1}});
 return {window,R,notices,sent,store};
}
const CODE='K7RQM2XAPZ9E';
async function room(){
 const r=await loadRoom().R.deriveRoom(CODE);
 const gm=loadRoom();gm.R.setKey(r.key);gm.R.setSession({code:CODE,role:'gm',name:'Мастер',memberId:'gm1',campaignId:'c1'},r.topic);await gm.R.ensureGMKeys();
 const imported=new Map();gm.window.camps=[{id:'c1',name:'A',roster:[]}];gm.window.chars=[];
 gm.window.App={save(){},render(){},importCharacter(c,{sourceKey}){const old=gm.window.chars.find(x=>x.extra?.sourceKey===sourceKey);const id=old?old.id:'gm-copy-'+(imported.size+1);const copy={...c,id,extra:{...(c.extra||{}),sourceKey}};if(old)gm.window.chars[gm.window.chars.indexOf(old)]=copy;else gm.window.chars.push(copy);imported.set(sourceKey,id);return {ok:true,id,updated:!!old}}};
 return {r,gm};
}
function player(r,{store,memberId='p1',character,sheets='zj',timers,gmPub}){
 const p=loadRoom({store,timers});p.R.setKey(r.key);p.R.setSession({code:CODE,role:'player',name:'Аня',memberId,characterId:character.id},r.topic);
 p.window.chars=[character];p.R.members().set('gm1',{name:'Мастер',role:'gm',pub:gmPub,sheets,at:Date.now()});
 return p;
}
// Replies (receipts) are sent without being awaited, so let them settle.
const settle=()=>new Promise(ok=>setTimeout(ok,30));
const deliver=async(to,r,msgs)=>{await settle();for(const m of msgs.splice(0))await to.R.receive({topic:r.topic+'/'+m.sub,retain:false,payload:m.bytes});await settle()};
const V={id:'v1',name:'Ви',role:'solo',rank:4,hp:40,stats:{BODY:8,WILL:6},notes:'Короткая заметка',extra:{portrait:'data:image/png;base64,AAAA',sourceKey:'mine'}};

test('the device id is kept on the device while member ids change per join',()=>{
 const store=new Map(),a=loadRoom({store}).R.deviceId(),b=loadRoom({store}).R.deviceId();
 assert.match(a,/^[0-9a-f]{16}$/);assert.equal(a,b);assert.equal(store.get('nightcity-red-room-device'),a);
 assert.notEqual(loadRoom().R.deviceId(),a); // another device
 store.set('nightcity-red-room-device','<junk>');assert.match(loadRoom({store}).R.deviceId(),/^[0-9a-f]{16}$/);
});

test('a sheet sent again after a rejoin updates the GM copy and its roster row instead of adding another',{skip:!zipOK},async()=>{
 const {r,gm}=await room(),store=new Map(),pub=plain(gm.R.gmPub());
 const p1=player(r,{store,memberId:'p1',character:V,gmPub:pub});
 await p1.R.sendSheet();assert.equal(p1.sent.length,1);
 await deliver(gm,r,p1.sent);
 assert.equal(gm.R.incoming().length,1);const item=gm.R.incoming()[0];
 assert.equal(item.dev,p1.R.deviceId());assert.equal(item.who,'Аня');assert.equal(item.character.extra.portrait,undefined);
 await gm.R.acceptSheet(0);
 assert.deepEqual(gm.window.chars.map(c=>c.extra.sourceKey),['room-dev:'+p1.R.deviceId()+':v1']);
 assert.equal(gm.window.camps[0].roster.length,1);
 // The player leaves and joins again: a new member id, the same device.
 const p2=player(r,{store,memberId:'p2',character:{...V,hp:12},gmPub:pub});
 await p2.R.sendSheet();await deliver(gm,r,p2.sent);
 const view=gm.R.roomView();
 assert.equal(gm.R.incoming().filter(x=>!x.saved).length,1);
 assert.match(view,/data-room-action="accept-sheet"[^>]*>Обновить</); // the GM sees that it replaces the sheet they have
 await gm.R.acceptSheet(gm.R.incoming().findIndex(x=>!x.saved));
 assert.equal(gm.window.chars.length,1);assert.equal(gm.window.chars[0].hp,12);assert.equal(gm.window.camps[0].roster.length,1);
 assert.ok(gm.notices.some(n=>n.startsWith('Лист обновлён')));
 // A different device with the same character id is a different sheet.
 const other=player(r,{memberId:'p3',character:V,gmPub:pub});await other.R.sendSheet();await deliver(gm,r,other.sent);
 await gm.R.acceptSheet(0);assert.equal(gm.window.chars.length,2);
});

test('a long sheet is compressed to fit; one that still does not fit is refused with sizes, never sent silently',{skip:!zipOK},async()=>{
 const {r,gm}=await room(),pub=plain(gm.R.gmPub());
 const words='город ночь дождь неон банда клинок пистолет друг враг память шрам корпорация улица крыша поезд деньги долг сестра брат отец мать имплант хром'.split(' ');
 let seed=7,story='';const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;while(story.length<70000)story+=words[Math.floor(rnd()*words.length)]+' ';
 const long={...V,notes:story};assert.ok(new TextEncoder().encode(JSON.stringify(long)).length>120000);
 const legacy=await player(r,{character:long,gmPub:pub,sheets:''}).R.sheetPacket('gm1',{pub,sheets:''},long,'x');
 assert.ok(legacy.length>160000,'uncompressed, the GM would drop this packet');
 const p=player(r,{character:long,gmPub:pub});
 await p.R.sendSheet();assert.equal(p.sent.length,1);assert.ok(p.sent[0].bytes.length<=160000);
 assert.equal(p.R.sheetState().state,'waiting');
 await deliver(gm,r,p.sent);assert.equal(gm.R.incoming()[0].character.notes,story);
 // Random data does not compress: the player is told, with sizes, and nothing goes out.
 let noise='';const abc='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';while(noise.length<260000)noise+=abc[Math.floor(Math.random()*abc.length)];
 const big=player(r,{character:{...V,notes:noise},gmPub:pub});
 await big.R.sendSheet();assert.equal(big.sent.length,0);
 assert.equal(big.R.sheetState().state,'big');assert.match(big.notices.at(-1),/^Лист слишком большой для отправки через комнату: \d+ КБ после сжатия, а можно не больше 156 КБ\./);
 // An older GM page (no compression) gets the old form only when it fits, otherwise the same clear refusal.
 const old=player(r,{character:long,gmPub:pub,sheets:''});await old.R.sendSheet();
 assert.equal(old.sent.length,0);assert.equal(old.R.sheetState().state,'big');
});

test('the player waits for the GM receipt, then the acceptance, and is told when no receipt comes',{skip:!zipOK},async()=>{
 const {r,gm}=await room(),pub=plain(gm.R.gmPub()),timers=[];
 const p=player(r,{character:V,gmPub:pub,timers});
 await p.R.sendSheet();
 assert.equal(p.R.sheetState().state,'waiting');assert.equal(p.notices.at(-1),'Лист отправлен — ждём подтверждения от ведущего…');
 assert.match(p.R.roomView(),/class="room-send-status" data-state="waiting"/);
 await deliver(gm,r,p.sent);
 assert.equal(gm.sent.length,1);await deliver(p,r,gm.sent); // the GM page confirms receipt by itself
 assert.equal(p.R.sheetState().state,'received');assert.equal(p.notices.at(-1),'Ведущий получил лист «Ви». Ждём, когда он его примет.');
 timers.forEach(f=>f());assert.equal(p.R.sheetState().state,'received'); // a late timeout does not undo the receipt
 await gm.R.acceptSheet(0);await deliver(p,r,gm.sent);
 assert.equal(p.R.sheetState().state,'accepted');assert.equal(p.notices.at(-1),'Ведущий принял ваш лист: Ви');
 // Nobody answers this time.
 timers.length=0;await p.R.sendSheet();p.sent.length=0;
 assert.equal(timers.length,1);timers[0]();
 assert.equal(p.R.sheetState().state,'timeout');assert.match(p.notices.at(-1),/^Ведущий пока не подтвердил получение листа\./);
 // An older GM page never sends receipts: no false alarm, its acceptance still counts.
 const q=player(r,{character:V,gmPub:pub,sheets:'',timers:[]});await q.R.sendSheet();
 assert.equal(q.R.sheetState().state,'sent');assert.equal(q.notices.at(-1),'Лист отправлен. Подтверждение придёт, когда ведущий его примет.');
 await q.R.receive({topic:r.topic+'/e',retain:false,payload:await gm.R.seal({v:2,id:'ack1',from:'gm1',t:'sheet-ack',at:Date.now(),d:{to:'p1',name:'Ви'}})});
 assert.equal(q.R.sheetState().state,'accepted');
});

test('GM pages still read sheets from older players and drop compressed bombs',{skip:!zipOK},async()=>{
 const {r,gm}=await room(),pub=plain(gm.R.gmPub());
 const legacy=await gm.R.seal({v:2,id:'old1',from:'oldp',t:'sheet',at:Date.now(),d:{to:'gm1',...await gm.R.sealFor(pub,{...V,role:'fixer'})}});
 await gm.R.receive({topic:r.topic+'/e',retain:false,payload:legacy});
 assert.equal(gm.R.incoming().length,1);assert.equal(gm.R.sheetSource(gm.R.incoming()[0]),'room:oldp:v1');
 assert.equal(gm.sent.length,0); // nothing to confirm to an old player
 const zeros=new Uint8Array(8000000),bomb=new Uint8Array(await new Response(new Blob([zeros]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
 assert.ok(bomb.length<160000);
 await gm.R.receive({topic:r.topic+'/e',retain:false,payload:await gm.R.seal({v:2,id:'bomb',from:'evil',t:'sheet',at:Date.now(),d:{to:'gm1',enc:'z',ref:'r',...await gm.R.sealFor(pub,bomb)}})});
 assert.equal(gm.R.incoming().length,1);
 // A forged device id is ignored rather than trusted as a key.
 const odd=await gm.R.packSheet({who:'X',dev:'../../etc',character:{...V,id:'v9'}},'j');
 await gm.R.receive({topic:r.topic+'/e',retain:false,payload:await gm.R.seal({v:2,id:'odd',from:'p9',t:'sheet',at:Date.now(),d:{to:'gm1',enc:odd.enc,ref:'r9',...await gm.R.sealFor(pub,odd.bytes)}})});
 assert.equal(gm.R.sheetSource(gm.R.incoming()[0]),'room:p9:v9');
});

test('a code from a newly opened room link replaces the old one in the join form; typed text survives other repaints',()=>{
 const {R}=loadRoom();
 const field=(id,defaultValue,value=defaultValue)=>({id,defaultValue,value});
 const page=fields=>({querySelectorAll:()=>fields,querySelector:sel=>fields.find(f=>'#'+f.id===sel)||null});
 // The join form was open with a code typed by hand; then a link to another room is opened in the same tab.
 let before=page([field('room-code','','AAAA-BBBB-CCCC'),field('room-player-name','','Аня')]),typed=R.typedInputs(before);
 let after=page([field('room-code','K7RQ-M2XA-PZ9E'),field('room-player-name','')]);R.restoreTyped(after,typed);
 assert.equal(after.querySelector('#room-code').value,'K7RQ-M2XA-PZ9E');assert.equal(after.querySelector('#room-player-name').value,'Аня');
 // An untouched field simply shows the new link's code.
 typed=R.typedInputs(page([field('room-code','K7RQ-M2XA-PZ9E')]));after=page([field('room-code','ABCD-EFGH-JKMN')]);R.restoreTyped(after,typed);
 assert.equal(after.querySelector('#room-code').value,'ABCD-EFGH-JKMN');
 // A live update that does not change the form keeps what is being typed.
 typed=R.typedInputs(page([field('room-code','K7RQ-M2XA-PZ9E','K7RQ-M2XA-PZ9')]));after=page([field('room-code','K7RQ-M2XA-PZ9E')]);R.restoreTyped(after,typed);
 assert.equal(after.querySelector('#room-code').value,'K7RQ-M2XA-PZ9');
});

test('room views show translated role names and no «?» for a missing character',async()=>{
 for(const [lang,solo,none] of [['ru','Соло','без персонажа'],['en','Solo','no character']]){
  const {R,window}=loadRoom({lang});const r=await R.deriveRoom(CODE);R.setKey(r.key);
  R.setSession({code:CODE,role:'gm',name:'GM',memberId:'gm1',campaignId:'c1'},r.topic);
  window.chars=[{id:'n1',name:'Нокс',role:'fixer'}];window.camps=[{id:'c1',name:'A',round:1,turnIndex:0,roster:[{id:'r1',kind:'pc',characterId:'deleted',initiative:15},{id:'r2',kind:'pc',characterId:'n1',initiative:12},{id:'r3',kind:'npc',name:'Бандит',initiative:9}]}];
  const order=R.combatPayload().order;assert.deepEqual(plain(order.map(x=>x.name)),['','Нокс','Бандит']);
  const card=R.memberCard('p1',{name:'Аня',role:'player',character:R.cleanSummary({name:'Ви',role:'solo',hp:10,max:40}),at:Date.now()});
  assert.ok(card.includes(`<span>${solo} · `)||card.includes(`<span>${solo}<`),card);assert.ok(!/>solo</.test(card));
  const empty=R.memberCard('p2',{name:'Боб',role:'player',character:null,at:Date.now()});
  assert.ok(empty.includes('<strong>Боб</strong>')&&empty.includes(none)&&!empty.includes('?'));
  await R.receive({topic:r.topic+'/c',retain:false,payload:await R.seal({v:2,id:'c'+lang,from:'gm0',t:'combat',at:Date.now(),d:{campaign:'A',round:1,order:[{name:'',pc:true,init:15,current:true},{name:'Нокс',pc:true,init:12}]}})});
  await R.ensureGMKeys();
  await R.receive({topic:r.topic+'/e',retain:false,payload:await R.seal({v:2,id:'s'+lang,from:'p1',t:'sheet',at:Date.now(),d:{to:'gm1',...await R.sealFor(plain(R.gmPub()),{id:'v1',name:'Ви',role:'solo'})}})});
  const view=R.roomView();
  assert.ok(view.includes(`<span class="room-none">${none}</span>`));assert.ok(!view.includes('<span>?</span>'));
  assert.ok(view.includes(` · ${solo}</small>`)&&!view.includes(' · solo</small>'));
 }
});
