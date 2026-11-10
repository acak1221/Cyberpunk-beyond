const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const zipOK=(()=>{try{new CompressionStream('deflate-raw');new DecompressionStream('deflate-raw');return true}catch{return false}})();

// One browser tab: its own module state, optionally sharing localStorage with another tab of the same device.
function loadRoom({store=new Map(),timers=null,lang='ru'}={}){
 const listeners={},document={addEventListener(type,f){(listeners[type]||=[]).push(f)},querySelector:()=>null,visibilityState:'visible'};
 // Long timers (the 30 s wait for a GM receipt) are either collected to be fired by the test or do not keep node running.
 const later=(f,ms)=>{if(timers&&ms>=1000){timers.push(f);return timers.length}const h=setTimeout(f,ms);if(ms>=1000)h.unref?.();return h};
 const window={document,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},crypto:globalThis.crypto,location:{hash:'',origin:'https://example.test',pathname:'/'},addEventListener(){},confirm:()=>true,navigator:{},btoa,atob,Response,Blob,ReadableStream,CompressionStream,DecompressionStream,ROLES:[{id:'solo',name:{ru:'Соло',en:'Solo'}},{id:'fixer',name:{ru:'Фиксер',en:'Fixer'}}]};
 const ctx={window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Error,setTimeout:later,clearTimeout,setInterval,clearInterval,console};
 vm.runInNewContext(read('room-transport.js')+'\n'+read('room.js'),ctx);
 const R=window.Room._test,notices=[],sent=[];
 R.setApp({getState:()=>({lang,characters:window.chars||[],campaigns:window.camps||[]}),notify:m=>notices.push(m)});
 R.setTransport({publish:(sub,bytes)=>{sent.push({sub,bytes});return 1},close(){}});
 // Presses a room button the way a click on the page does.
 const press=async(action,data={})=>{for(const f of listeners.click||[])await f({target:{closest:sel=>sel==='[data-room-action]'?{dataset:{roomAction:action,...data}}:null}})};
 return {window,R,notices,sent,store,press};
}
const CODE='K7RQM2XAPZ9E';
async function room(){
 const r=await loadRoom().R.deriveRoom(CODE);
 const gm=loadRoom();gm.R.setKey(r.key);gm.R.setSession({code:CODE,role:'gm',name:'Мастер',memberId:'gm1',campaignId:'c1'},r.topic);await gm.R.ensureGMKeys();
 const imported=new Map();gm.window.camps=[{id:'c1',name:'A',roster:[]}];gm.window.chars=[];
 gm.window.App={save(){},render(){},importCharacter(c,{sourceKey}){const old=gm.window.chars.find(x=>x.extra?.sourceKey===sourceKey);const id=old?old.id:'gm-copy-'+(imported.size+1);const copy={...c,id,extra:{...(c.extra||{}),sourceKey}};if(old)gm.window.chars[gm.window.chars.indexOf(old)]=copy;else gm.window.chars.push(copy);imported.set(sourceKey,id);return {ok:true,id,updated:!!old}}};
 return {r,gm};
}
function player(r,{store,memberId='p1',character,sheets='zj',timers,gmPub,lang}){
 const p=loadRoom({store,timers,lang});p.R.setKey(r.key);p.R.setSession({code:CODE,role:'player',name:'Аня',memberId,characterId:character.id},r.topic);
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
 assert.equal(legacy.enc,'');assert.ok(legacy.bytes.length>160000,'uncompressed, the GM would drop this packet');
 const p=player(r,{character:long,gmPub:pub});
 await p.R.sendSheet();assert.equal(p.sent.length,1);assert.ok(p.sent[0].bytes.length<=160000);
 assert.equal(p.R.sheetState().state,'waiting');
 await deliver(gm,r,p.sent);assert.equal(gm.R.incoming()[0].character.notes,story);
 // Random data does not compress: the player is told, with sizes, and nothing goes out.
 let noise='';const abc='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';while(noise.length<260000)noise+=abc[Math.floor(Math.random()*abc.length)];
 const big=player(r,{character:{...V,notes:noise},gmPub:pub});
 await big.R.sendSheet();assert.equal(big.sent.length,0);
 assert.equal(big.R.sheetState().state,'big');assert.match(big.notices.at(-1),/^Лист слишком большой для отправки через комнату: \d+ КБ после сжатия, а можно не больше 156 КБ\./);
 // An older GM page (no compression) gets the old form only when it fits; otherwise the player is told the GM's page is the obstacle,
 // not asked to cut notes that would fit once the GM reloads.
 for(const [lang,gmMsg,hereMsg] of [['ru',/^Лист слишком большой для приложения ведущего: \d+ КБ, а можно не больше 156 КБ\. Его страница не принимает сжатые листы — попросите ведущего обновить страницу/,/^Лист слишком большой для отправки без сжатия: \d+ КБ, а можно не больше 156 КБ\. Этот браузер не умеет сжимать листы/],['en',/^The sheet is too big for the GM's app: \d+ KB, the limit is 156 KB\. Their page does not accept compressed sheets — ask the GM to reload the page/,/^The sheet is too big to send uncompressed: \d+ KB, the limit is 156 KB\. This browser cannot compress sheets/]]){
  for(const sheets of ['','j']){ // an old GM page, or a GM browser that cannot decompress
   const old=player(r,{character:long,gmPub:pub,sheets,lang});
   await old.R.sendSheet();
   assert.equal(old.sent.length,0);assert.equal(old.R.sheetState().state,'big');assert.equal(old.R.sheetState().why,'gm');
   assert.match(old.notices.at(-1),gmMsg);assert.ok(!/после сжатия|after compression/.test(old.notices.at(-1)));
   assert.match(old.R.roomView(),/class="room-send-status" data-state="big"/);
  }
  // A current GM page, but this browser cannot compress.
  const here=player(r,{character:long,gmPub:pub,lang});delete here.window.CompressionStream;
  await here.R.sendSheet();assert.equal(here.sent.length,0);assert.equal(here.R.sheetState().why,'here');assert.match(here.notices.at(-1),hereMsg);
 }
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
 // Leaving the room while still waiting ends the wait: no warning later, wherever the player is by then.
 const wt=[],lw=player(r,{character:V,gmPub:pub,timers:wt});
 await lw.R.sendSheet();assert.equal(lw.R.sheetState().state,'waiting');assert.equal(wt.length,1);
 await lw.press('leave');assert.equal(lw.window.Room.active(),false);assert.equal(lw.R.sheetState(),null);
 const before=lw.notices.length;wt.forEach(f=>f());
 assert.equal(lw.notices.length,before);assert.ok(!lw.notices.some(n=>n.startsWith('Ведущий пока не подтвердил')));
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
  // The deleted character's row keeps a visible name for older pages (they show the name as is) and is flagged for newer ones.
  const order=R.combatPayload().order;assert.deepEqual(plain(order.map(x=>x.name)),['—','Нокс','Бандит']);assert.deepEqual(plain(order.map(x=>!!x.none)),[true,false,false]);
  const card=R.memberCard('p1',{name:'Аня',role:'player',character:R.cleanSummary({name:'Ви',role:'solo',hp:10,max:40}),at:Date.now()});
  assert.ok(card.includes(`<span>${solo} · `)||card.includes(`<span>${solo}<`),card);assert.ok(!/>solo</.test(card));
  const empty=R.memberCard('p2',{name:'Боб',role:'player',character:null,at:Date.now()});
  assert.ok(empty.includes('<strong>Боб</strong>')&&empty.includes(none)&&!empty.includes('?'));
  await R.receive({topic:r.topic+'/c',retain:false,payload:await R.seal({v:2,id:'c'+lang,from:'gm0',t:'combat',at:Date.now(),d:{campaign:'A',round:1,order:[{name:'—',pc:true,none:true,init:15,current:true},{name:'Нокс',pc:true,init:12},{name:'Бандит',none:true,init:9}]}})});
  await R.ensureGMKeys();
  await R.receive({topic:r.topic+'/e',retain:false,payload:await R.seal({v:2,id:'s'+lang,from:'p1',t:'sheet',at:Date.now(),d:{to:'gm1',...await R.sealFor(plain(R.gmPub()),{id:'v1',name:'Ви',role:'solo'})}})});
  const view=R.roomView();
  assert.ok(view.includes(`<span class="room-none">${none}</span>`));assert.ok(!view.includes('<span>?</span>')&&!view.includes('<span>—</span>'));
  assert.equal(view.split('room-none').length,2);assert.ok(view.includes('<span>Нокс</span>')&&view.includes('<span>Бандит</span>')); // only a player row can be «no character»
  assert.ok(view.includes(` · ${solo}</small>`)&&!view.includes(' · solo</small>'));
  // Counts in card headings are not page references, so the clean look must not turn them into «стр. N».
  assert.ok(view.includes('<span data-nx>1</span></div><ul>')&&/<span data-nx>\d+<\/span>/.test(view.split('room-team')[1]));
 }
});

test('accepting asks first when the same character is here another way, or the GM copy was edited later',{skip:!zipOK},async()=>{
 const {r,gm}=await room(),pub=plain(gm.R.gmPub()),calls=[],offers=[];let match=null,side='incoming',answer=null;
 const save=gm.window.App.importCharacter;
 Object.assign(gm.window.App,{findImport:()=>match,importCharacter:(c,o)=>{calls.push(plain(o));return save(c,o)}});
 gm.window.ShareLink={compare:()=>side,offer:async(c,o)=>{offers.push(plain(o));return answer}};
 const p=player(r,{character:V,gmPub:pub}),src='room-dev:'+p.R.deviceId()+':v1';
 const arrive=async()=>{await p.R.sendSheet();await deliver(gm,r,p.sent);gm.sent.length=0};
 // Nothing like it here yet: saved without a question.
 await arrive();assert.match(gm.R.roomView(),/data-room-action="accept-sheet"[^>]*>Принять</);
 await gm.R.acceptSheet(0);await settle();
 assert.deepEqual(calls,[{sourceKey:src}]);assert.equal(offers.length,0);assert.equal(gm.sent.length,1);
 assert.equal(gm.notices.at(-1),'Лист сохранён: Ви и добавлен в кампанию');
 // Sent before by this player and not edited here since: updated in place and tied to this source.
 match={id:'gm-copy-1',by:'source'};await arrive();
 assert.equal(gm.R.incoming().length,1); // the newer sheet takes the place of the one already saved
 assert.match(gm.R.roomView(),/data-room-action="accept-sheet"[^>]*>Обновить</);
 await gm.R.acceptSheet(0);
 assert.deepEqual(calls.at(-1),{sourceKey:src,replace:'gm-copy-1',rebind:true});assert.equal(offers.length,0);
 assert.equal(gm.notices.at(-1),'Лист обновлён: Ви');
 // The GM edited that copy later: the GM decides. Closing the question keeps the sheet in the list and tells the player nothing.
 side='local';await arrive();
 const quiet=gm.notices.length;await gm.R.acceptSheet(0);await settle();
 assert.deepEqual(offers,[{kind:'room',sourceKey:src}]);assert.equal(calls.length,2);
 assert.equal(gm.R.incoming().filter(x=>!x.saved).length,1);assert.equal(gm.sent.length,0);assert.equal(gm.notices.length,quiet);
 assert.ok(gm.R.roomView().includes('accept-sheet'));
 // «Оставить оба»: a separate character, said in words, and only now the player hears that the sheet was accepted.
 answer={ok:true,id:'gm-copy-9',updated:false,how:'copy'};gm.window.chars.push({id:'gm-copy-9',name:'Ви'});
 await gm.R.acceptSheet(0);await settle();
 assert.equal(gm.notices.at(-1),'Лист добавлен отдельным персонажем: Ви и добавлен в кампанию');assert.equal(gm.sent.length,1);
 assert.deepEqual(plain(gm.window.camps[0].roster.map(x=>x.characterId)),['gm-copy-1','gm-copy-9']);
 // The same character came by a link or a file: asked as well, and the version that was replaced is said to be kept.
 match={id:'gm-copy-1',by:'uid'};side='incoming';answer={ok:true,id:'gm-copy-1',updated:true,kept:true};await arrive();
 assert.match(gm.R.roomView(),/data-room-action="accept-sheet"[^>]*>Принять</);
 await gm.R.acceptSheet(0);
 assert.equal(offers.length,3);assert.equal(calls.length,2);
 assert.equal(gm.notices.at(-1),'Лист обновлён: Ви. Прежняя версия сохранена на 30 дней: «Персонажи» → «Удалённые персонажи».');
});

test('a sheet that could not be saved says why, and stays in the list while accepting it again can work',{skip:!zipOK},async()=>{
 for(const lang of ['ru','en']){
  const {r,gm}=await room(),pub=plain(gm.R.gmPub());let res;
  gm.R.setApp({getState:()=>({lang,characters:gm.window.chars,campaigns:gm.window.camps}),notify:m=>gm.notices.push(m)});
  const save=gm.window.App.importCharacter;gm.window.App.importCharacter=(c,o)=>{if(res==='throw')throw Error('boom');return res||save(c,o)};
  const p=player(r,{character:V,gmPub:pub}),arrive=async()=>{await p.R.sendSheet();await deliver(gm,r,p.sent);gm.sent.length=0};
  const RU=[['storage',true,/^Лист не сохранён: в браузере не хватает места\..* он остаётся в списке\.$/],['paused',true,/^Лист не сохранён: редактирование приостановлено\. Он остаётся в списке/],['missing',true,/^Лист не сохранён: персонаж, которого он обновлял, удалён\. Лист остаётся в списке/],['too_big',false,/^Лист слишком большой, чтобы его сохранить\.$/],['invalid',false,/^Не удалось прочитать лист\.$/],['unknown',false,/^Не удалось прочитать лист\.$/],['throw',false,/^Не удалось прочитать лист\.$/]];
  const EN=[['storage',true,/^The sheet was not saved: the browser is out of storage\..* it stays in the list\.$/],['paused',true,/^The sheet was not saved: editing is paused\. It stays in the list/],['missing',true,/^The sheet was not saved: the character it was updating has been deleted\. It stays in the list/],['too_big',false,/^The sheet is too big to save\.$/],['invalid',false,/^Could not read the sheet\.$/],['unknown',false,/^Could not read the sheet\.$/],['throw',false,/^Could not read the sheet\.$/]];
  for(const [reason,stays,text] of lang==='ru'?RU:EN){
   await arrive();res=reason==='throw'?'throw':{ok:false,reason};
   await gm.R.acceptSheet(0);await settle();
   assert.match(gm.notices.at(-1),text,reason);assert.equal(gm.R.incoming().length,stays?1:0,reason);
   assert.equal(gm.sent.length,0,reason); // the player is not told the sheet was accepted
   assert.equal(gm.window.camps[0].roster.length,0,reason);assert.equal(gm.window.chars.length,0,reason);
  }
  // The very same item goes through once there is room again.
  await arrive();res={ok:false,reason:'storage'};await gm.R.acceptSheet(0);
  res=null;await gm.R.acceptSheet(0);await settle();
  assert.equal(gm.window.chars.length,1);assert.equal(gm.sent.length,1);assert.equal(gm.R.incoming()[0].saved,'gm-copy-1');
 }
});

test('an accepted sheet stays in the list with «Открыть» while its character exists; a second press while the question is open does nothing',{skip:!zipOK},async()=>{
 const {r,gm}=await room(),pub=plain(gm.R.gmPub()),opened=[];let asked=0,answer;
 gm.window.App.open=id=>opened.push(id);gm.window.App.findImport=()=>({id:'elsewhere',by:'uid'});
 gm.window.ShareLink={compare:()=>'incoming',offer:(c,o)=>new Promise(ok=>{asked++;answer=()=>ok(gm.window.App.importCharacter(c,{sourceKey:o.sourceKey}))})};
 const p=player(r,{character:V,gmPub:pub});await p.R.sendSheet();await deliver(gm,r,p.sent);
 const first=gm.R.acceptSheet(0);await gm.R.acceptSheet(0);await gm.press('accept-sheet',{index:'0'});
 assert.equal(asked,1);answer();await first;
 assert.equal(gm.window.chars.length,1);assert.equal(gm.window.camps[0].roster.length,1);
 const view=gm.R.roomView();
 assert.match(view,/data-room-action="open-sheet" data-id="gm-copy-1">Открыть</);assert.ok(!view.includes('accept-sheet')&&!view.includes('decline-sheet'));
 await gm.press('open-sheet',{id:'gm-copy-1'});assert.deepEqual(opened,['gm-copy-1']);
 // Deleted since: the button would open nothing, so the sheet is offered again instead.
 gm.window.chars.length=0;gm.window.App.findImport=()=>null;
 await gm.press('open-sheet',{id:'gm-copy-1'});assert.deepEqual(opened,['gm-copy-1']);
 assert.match(gm.R.roomView(),/data-room-action="accept-sheet"[^>]*>Принять</);
 await gm.press('decline-sheet',{index:'0'});assert.equal(gm.R.incoming().length,0);
});

test('only something shaped like a sheet is listed',{skip:!zipOK},async()=>{
 const {r,gm}=await room(),pub=plain(gm.R.gmPub());let n=0;
 const post=async d=>gm.R.receive({topic:r.topic+'/e',retain:false,payload:await gm.R.seal({v:2,id:'bad'+(n++),from:'p9',t:'sheet',at:Date.now(),d:{to:'gm1',...d}})});
 for(const character of [null,'text',7,[],[V],{id:'x',name:{length:2},role:'solo'},{id:'x',name:['Ви'],role:'solo'},{id:'x',name:'Ви'},{id:'x',name:'Ви',role:null},{id:'x',name:'Ви',role:{id:'solo'}},{id:'x',role:'solo'}]){
  for(const enc of ['j','z']){
   const packed=await gm.R.packSheet({who:'X',dev:'0123456789abcdef',character},enc);assert.equal(packed.enc,enc);
   await post({enc,ref:'r'+n,...await gm.R.sealFor(pub,packed.bytes)});
  }
  await post(await gm.R.sealFor(pub,character)); // the older form: a bare character
 }
 // Not a packet at all.
 await post({enc:'z',ref:'r',...await gm.R.sealFor(pub,new Uint8Array([1,2,3,4,5]))});
 await post({enc:'j',ref:'r',...await gm.R.sealFor(pub,new TextEncoder().encode('{"character":'))});
 await post({enc:'j',ref:'r',...await gm.R.sealFor(pub,new TextEncoder().encode('7'))});
 await settle();
 assert.equal(gm.R.incoming().length,0);assert.equal(gm.sent.length,0);assert.equal(gm.notices.length,0);
 assert.ok(!gm.R.roomView().includes('accept-sheet'));
 // A well-formed one right after is still read.
 const ok=await gm.R.packSheet({who:'X',dev:'0123456789abcdef',character:{id:'x',name:'',role:''}},'z');
 await post({enc:'z',ref:'good',...await gm.R.sealFor(pub,ok.bytes)});await settle();
 assert.equal(gm.R.incoming().length,1);assert.equal(gm.sent.length,1);assert.match(gm.R.roomView(),/<b>—<\/b>/);
});

test('a receipt counts only from a GM the sheet went to, with the reference sent along',{skip:!zipOK},async()=>{
 const {r,gm}=await room(),pub=plain(gm.R.gmPub());let n=0;
 const tell=async(to,from,t,d)=>{const before=to.notices.length;await to.R.receive({topic:r.topic+'/e',retain:false,payload:await gm.R.seal({v:2,id:'m'+(n++),from,t,at:Date.now(),d:{to:'p1',...d}})});return to.notices.slice(before)};
 const p=player(r,{character:V,gmPub:pub,timers:[]});p.R.members().set('p2',{name:'Боб',role:'player',at:Date.now()});p.R.members().set('gm2',{name:'Второй',role:'gm',at:Date.now()});
 await p.R.sendSheet();const ref=p.R.sheetState().ref;assert.match(ref,/^[0-9a-f]{16}$/);
 // Another player, or anyone who knows the room code, cannot make the sheet look received or accepted.
 assert.deepEqual(await tell(p,'p2','sheet-got',{ref}),[]);assert.deepEqual(await tell(p,'p2','sheet-ack',{ref,name:'Ви'}),[]);
 assert.deepEqual(await tell(p,'ghost','sheet-got',{ref}),[]);assert.deepEqual(await tell(p,'ghost','sheet-ack',{ref,name:'Ви'}),[]);
 assert.equal(p.R.sheetState().state,'waiting');
 // A GM answering about another sheet (an earlier one, or one sent to them alone) is heard, but this sheet's status stays.
 assert.deepEqual(await tell(p,'gm1','sheet-got',{ref:'0000'}),[]);assert.deepEqual(await tell(p,'gm1','sheet-got',{}),[]);assert.deepEqual(await tell(p,'gm1','sheet-got',{ref:[ref]}),[]);
 assert.deepEqual(await tell(p,'gm1','sheet-ack',{ref:'0000',name:'Прежний'}),['Ведущий принял ваш лист: Прежний']);
 assert.deepEqual(await tell(p,'gm2','sheet-ack',{ref,name:'Ви'}),['Ведущий принял ваш лист: Ви']); // a GM this sheet did not go to
 assert.equal(p.R.sheetState().state,'waiting');
 // A message for someone else is not ours.
 await p.R.receive({topic:r.topic+'/e',retain:false,payload:await gm.R.seal({v:2,id:'else',from:'gm1',t:'sheet-ack',at:Date.now(),d:{to:'p7',ref,name:'Ви'}})});
 assert.equal(p.R.sheetState().state,'waiting');
 // The real ones, each said once; nothing moves back.
 assert.deepEqual(await tell(p,'gm1','sheet-got',{ref}),['Ведущий получил лист «Ви». Ждём, когда он его примет.']);
 assert.deepEqual(await tell(p,'gm1','sheet-got',{ref}),[]);
 assert.deepEqual(await tell(p,'gm1','sheet-ack',{ref,name:'Ви'}),['Ведущий принял ваш лист: Ви']);
 assert.deepEqual(await tell(p,'gm1','sheet-ack',{ref,name:'Ви'}),[]);assert.deepEqual(await tell(p,'gm1','sheet-got',{ref}),[]);
 assert.equal(p.R.sheetState().state,'accepted');
 // A GM page too old to be given a reference sends none back and answers only on accepting: a receipt from it is not its own.
 const q=player(r,{character:V,gmPub:pub,sheets:'',timers:[]});await q.R.sendSheet();const qref=q.R.sheetState().ref;
 assert.deepEqual(await tell(q,'gm1','sheet-got',{}),[]);assert.deepEqual(await tell(q,'gm1','sheet-got',{ref:qref}),[]);
 await tell(q,'gm1','sheet-ack',{ref:qref,name:'Ви'});assert.equal(q.R.sheetState().state,'sent');
 assert.deepEqual(await tell(q,'gm1','sheet-ack',{name:'Ви'}),['Ведущий принял ваш лист: Ви']);assert.equal(q.R.sheetState().state,'accepted');
});
