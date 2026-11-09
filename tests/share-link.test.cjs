const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const plain=x=>JSON.parse(JSON.stringify(x));
function load(hash='',{lang='ru',App,ROLES,now=Date.UTC(2026,10,10,12,0),modal=true,win={}}={}){
 let replaced=null;const dialogs=[];
 // The module reads this device's clock; tests pin it so their dates stay valid on any day.
 class Clock extends Date{static now(){return now}}
 // A <dialog> stand-in: tests choose a button by closing it with that button's value.
 const createElement=tag=>{const el={tag,className:'',innerHTML:'',returnValue:'',listeners:{},addEventListener(t,f){el.listeners[t]=f},showModal(){el.open=true},remove(){el.removed=true},dispatchEvent(){el.listeners.close?.()},close(v){el.returnValue=v;el.listeners.close()}};if(!modal)delete el.showModal;dialogs.push(el);return el};
 const document={documentElement:{lang},readyState:'complete',addEventListener(){},createElement,body:{appendChild(){}}};
 const window={document,location:{hash,pathname:'/app/',search:'',origin:'https://example.test'},history:{replaceState:(a,b,u)=>{replaced=u}},addEventListener(){},navigator:{},btoa,atob,Blob,Response,ReadableStream,CompressionStream,DecompressionStream,matchMedia:()=>({matches:false}),App,ROLES,...win};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','site','share-link.js'),'utf8'),{window,TextEncoder,TextDecoder,Uint8Array,JSON,String,Array,Object,Error,Promise,Number,Date:Clock,setTimeout,Event:class{}});
 return {S:window.ShareLink,replaced:()=>replaced,dialogs};
}
// An App stand-in that records imports and notices; `match` is what findImport reports for any sheet.
function fakeApp({match=null,result={ok:true,id:'new-id',updated:false}}={}){
 const calls=[],notices=[];
 return {calls,notices,notify:m=>notices.push(m),findImport:(c,o)=>(calls.push(['find',plain(o)]),match),importCharacter:(c,o)=>(calls.push(['import',plain(o)]),typeof result==='function'?result(o):result)};
}
const ROLES=[{id:'solo',name:{ru:'Соло',en:'Solo'}}];
const sheet={id:'remote-id',name:'Ви',role:'solo',rank:4,stats:{INT:6,REF:7,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},extra:{uid:'U',updatedAt:Date.UTC(2026,10,9,17,20)}};
const tick=()=>new Promise(r=>setTimeout(r,20));

test('a shared character survives the link round trip without pictures or private keys',async()=>{
 const {S}=load();
 const c={id:'v1',name:'Ви «Соло»',role:'solo',notes:'заметки '.repeat(50),extra:{portrait:'data:image/png;base64,AAAA',portraitThumb:'x',sourceKey:'room:1',luck:3}};
 const url=await S.link(c);
 assert.match(url,/^https:\/\/example\.test\/app\/#\/import\/z[A-Za-z0-9_-]+$/);
 assert.ok(url.length<500,'compressed link should be short: '+url.length);
 const back=await S.unpack(url.split('#/import/')[1]);
 assert.equal(back.format,'nightcity-red-character');
 assert.deepEqual(plain(back.character),{id:'v1',name:'Ви «Соло»',role:'solo',notes:c.notes,extra:{luck:3}});
 assert.equal(c.extra.portrait,'data:image/png;base64,AAAA'); // the original sheet is untouched
 await assert.rejects(()=>S.unpack('zAAAA'));
 await assert.rejects(()=>S.unpack('q123'));
});

test('opening an import link removes the sheet from the address bar before the app routes',()=>{
 const {replaced}=load('#/import/zABC');
 assert.equal(replaced(),'/app/#/characters');
});

test('a short crafted link cannot unpack into megabytes: reading stops at the limit',async()=>{
 const {S}=load(),limit=S._test.MAX_SHEET;
 const bomb=await S.pack({format:'nightcity-red-character',version:1,character:{name:'Подарок',role:'solo',notes:'a'.repeat(6e6)}});
 assert.ok(bomb.length<20000,'the link itself is small: '+bomb.length);
 await assert.rejects(()=>S.unpack(bomb),/too_big/);
 await assert.rejects(()=>S.unpack('j'+S._test.b64u(new TextEncoder().encode(JSON.stringify({notes:'b'.repeat(limit)})))),/too_big/);
 await assert.rejects(()=>S.unpack('z'+'A'.repeat(limit*2)),/too_big/,'an overlong link is refused before decoding');
 const fits=await S.unpack(await S.pack({notes:'c'.repeat(limit-1000)}));assert.equal(fits.notes.length,limit-1000);
});

test('an incoming link that is too big says so instead of calling the link damaged',async()=>{
 const {S}=load(),bomb=await S.pack({format:'nightcity-red-character',version:1,character:{name:'x',role:'solo',notes:'a'.repeat(1e6)}});
 const app=fakeApp(),{dialogs}=load('#/import/'+bomb,{App:app});await tick();await tick();
 assert.deepEqual(app.notices,['Лист персонажа слишком большой для импорта.']);assert.equal(dialogs.length,0);assert.equal(app.calls.length,0);
 const app2=fakeApp();load('#/import/zAAAA',{App:app2});await tick();assert.deepEqual(app2.notices,['Ссылка на персонажа повреждена или обрезана.']);
});

test('sharing refuses a sheet the other side could not open',async()=>{
 const app=fakeApp();const {S}=load('',{App:app});
 await S.share({id:'v1',name:'Ви',role:'solo',notes:'x'.repeat(S._test.MAX_SHEET)});
 assert.match(app.notices[0],/слишком большой для ссылки/);
});

test('which copy is newer: a sheet without an edit time counts as the older one',()=>{
 const {S}=load(),v=S._test.verdict;
 assert.equal(v(200,100),'incoming');assert.equal(v(100,200),'local');assert.equal(v(100,100),'same');
 assert.equal(v(null,100),'local');assert.equal(v(100,null),'incoming');assert.equal(v(null,null),'unknown');
});

test('the dialog names the role as the sheet does, in both languages',()=>{
 assert.equal(load('',{ROLES}).S._test.roleName('solo'),'Соло');
 assert.equal(load('',{ROLES,lang:'en'}).S._test.roleName('solo'),'Solo');
 assert.equal(load('',{ROLES}).S._test.roleName('future-role'),'future-role');
});

test('a new character from a link is imported after confirming, with its role name shown',async()=>{
 const app=fakeApp(),{S,dialogs}=load('',{App:app,ROLES}),done=S.offer(sheet,{kind:'link'});
 const d=dialogs[0];assert.equal(d.className,'share-import');assert.equal(d.open,true);
 assert.match(d.innerHTML,/Импортировать персонажа\?/);assert.match(d.innerHTML,/<b>Ви<\/b> · Соло · ранг 4/);assert.doesNotMatch(d.innerHTML,/· solo/);
 assert.match(d.innerHTML,/value="new" class="btn primary"/);assert.doesNotMatch(d.innerHTML,/value="update"/);
 d.close('new');const res=await done;
 assert.equal(res.ok,true);assert.deepEqual(app.calls,[['find',{sourceKey:'link:remote-id'}],['import',{sourceKey:'link:remote-id',open:true}]]);
 assert.deepEqual(app.notices,['Персонаж импортирован.']);assert.equal(d.removed,true);
});

test('the same character with a newer link: the dialog says so and Update replaces the local sheet',async()=>{
 const app=fakeApp({match:{id:'local-id',name:'Ви',updatedAt:Date.UTC(2026,10,2,10,0)},result:{ok:true,id:'local-id',updated:true}}),{S,dialogs}=load('',{App:app,ROLES}),done=S.offer(sheet,{kind:'link'});
 const html=dialogs[0].innerHTML;
 assert.match(html,/Этот персонаж уже есть на устройстве/);assert.match(html,/share-import-version is-newer"><span>В ссылке<\/span>.*<em>новее<\/em>/);
 assert.match(html,/Версия в ссылке новее/);assert.match(html,/value="update" class="btn primary">Обновить/);assert.match(html,/value="copy" class="btn ghost">Оставить обе/);
 dialogs[0].close('update');await done;
 assert.deepEqual(app.calls[1],['import',{sourceKey:'link:remote-id',open:true,replace:'local-id',rebind:false}]);assert.deepEqual(app.notices,['Персонаж обновлён.']);
 // When the sheet it replaced differed, the notice says where the previous version went.
 for(const [lang,text] of [['ru','Персонаж обновлён. Прежняя версия сохранена на 30 дней: «Персонажи» → «Удалённые персонажи».'],['en','Character updated. The previous version is kept for 30 days: Characters → Deleted characters.']]){
  const kept=fakeApp({match:{id:'local-id',name:'Ви',updatedAt:Date.UTC(2026,10,2,10,0)},result:{ok:true,id:'local-id',updated:true,kept:true}}),l=load('',{App:kept,ROLES,lang}),end=l.S.offer(sheet,{kind:'link'});
  l.dialogs[0].close('update');await end;assert.deepEqual(kept.notices,[text]);
 }
});

test('an old link for a sheet edited here since: the dialog warns, and Keep both or Cancel never touch the local sheet',async()=>{
 const match={id:'local-id',name:'Ви (сессия 3)',updatedAt:Date.UTC(2026,10,9,20,0)};
 let app=fakeApp({match}),{S,dialogs}=load('',{App:app,ROLES,lang:'en'}),done=S.offer({...sheet,extra:{uid:'U'}},{kind:'link'});
 const html=dialogs[0].innerHTML;
 assert.match(html,/This character is already on this device/);assert.match(html,/<span>In the link<\/span><b>edit time unknown<\/b>/);
 assert.match(html,/is-newer"><span>On this device · “Ви \(сессия 3\)”<\/span>/);assert.match(html,/share-import-verdict warn">The version on this device is newer/);
 assert.match(html,/value="update" class="btn ghost">Update/);
 dialogs[0].close('copy');await done;
 assert.deepEqual(app.calls[1],['import',{open:true,copy:true}]);assert.deepEqual(app.notices,['The character was added as a separate sheet.']);
 app=fakeApp({match});({S,dialogs}=load('',{App:app,ROLES}));done=S.offer(sheet,{kind:'link'});dialogs[0].close('cancel');
 assert.equal(await done,null);assert.equal(app.calls.length,1);assert.deepEqual(app.notices,[]);
});

test('a link time more than five minutes ahead of this clock is not believed: it reads as unknown and is never marked newer',async()=>{
 const now=Date.UTC(2026,10,10,12,0),match={id:'local-id',name:'Ви',updatedAt:Date.UTC(2026,10,9,20,0)};
 let {S,dialogs}=load('',{App:fakeApp({match}),ROLES,now}),done=S.offer({...sheet,extra:{uid:'U',updatedAt:1e15}},{kind:'link'});
 const html=dialogs[0].innerHTML;
 assert.match(html,/<span>В ссылке<\/span><b>время изменения неизвестно<\/b>/);assert.doesNotMatch(html,/33658/);
 assert.match(html,/share-import-verdict warn">Версия на этом устройстве новее/);assert.match(html,/value="update" class="btn ghost"/);
 dialogs[0].close('cancel');await done;
 // A clock a few minutes ahead is normal: that time is shown and compared.
 ({S,dialogs}=load('',{App:fakeApp({match}),ROLES,now}));done=S.offer({...sheet,extra:{uid:'U',updatedAt:now+4*60000}},{kind:'link'});
 assert.match(dialogs[0].innerHTML,/share-import-version is-newer"><span>В ссылке<\/span>/);assert.match(dialogs[0].innerHTML,/value="update" class="btn primary"/);
 dialogs[0].close('cancel');await done;
 // The edge is five minutes, the same as the app uses when it saves a sheet; a later time, or one that is not a number, is unknown.
 const time=S._test.editTime;
 assert.equal(time({extra:{updatedAt:now+3e5}}),now+3e5);assert.equal(time({extra:{updatedAt:now+3e5+1}}),null);
 for(const bad of [0,-5,'1762770000000',NaN,Infinity,null,undefined,{},[now]])assert.equal(time({extra:{updatedAt:bad}}),null,String(bad));
 assert.equal(time(null),null);assert.equal(time({}),null);
 assert.equal(S.compare({extra:{updatedAt:now+6*60000}},{updatedAt:now-1000}),'local');assert.equal(S.compare({extra:{updatedAt:now}},{updatedAt:now-1000}),'incoming');assert.equal(S.compare({extra:{updatedAt:now}},null),'incoming');
});

test('a character file asks only when the character is already here, and failures are explained',async()=>{
 let app=fakeApp(),{S,dialogs}=load('',{App:app,ROLES});
 const res=await S.offer(sheet,{kind:'file'});
 assert.equal(res.ok,true);assert.equal(dialogs.length,0);assert.deepEqual(app.calls,[['find',{sourceKey:''}],['import',{open:true}]]);assert.deepEqual(app.notices,[]);
 app=fakeApp({match:{id:'local-id',name:'Ви',updatedAt:sheet.extra.updatedAt}});({S,dialogs}=load('',{App:app,ROLES}));const done=S.offer(sheet,{kind:'file'});
 assert.match(dialogs[0].innerHTML,/<span>В файле<\/span>/);assert.match(dialogs[0].innerHTML,/Это та же версия листа/);dialogs[0].close('cancel');await done;
 for(const [reason,text] of [['storage',/Не хватает места в браузере/],['too_big',/слишком большой для импорта/],['paused',/приостановлено/],['invalid',/Не удалось прочитать/]]){
  app=fakeApp({result:{ok:false,reason}});({S}=load('',{App:app}));await S.offer(sheet,{kind:'file'});assert.match(app.notices[0],text,reason);
 }
});

test('a sheet from a room: saved without a question when new, asked about when the character is already here; the room reports the result',async()=>{
 const key='room-dev:0123456789abcdef:remote-id';
 // New to this device: straight in, under the room's key, not opened, and nothing said here (the room page says it).
 let app=fakeApp(),{S,dialogs}=load('',{App:app,ROLES});
 assert.deepEqual(plain(await S.offer(sheet,{kind:'room',sourceKey:key})),{ok:true,id:'new-id',updated:false,how:'new'});
 assert.equal(dialogs.length,0);assert.deepEqual(app.calls,[['find',{sourceKey:key}],['import',{sourceKey:key}]]);assert.deepEqual(app.notices,[]);
 // The same character came by a link before: the GM is asked, in the room's words, and the updated sheet answers to the room from then on.
 const byUid={id:'local-id',name:'Ви',by:'uid',updatedAt:Date.UTC(2026,10,2,10,0)};
 app=fakeApp({match:byUid,result:{ok:true,id:'local-id',updated:true,kept:true}});({S,dialogs}=load('',{App:app,ROLES}));let done=S.offer(sheet,{kind:'room',sourceKey:key});
 assert.match(dialogs[0].innerHTML,/is-newer"><span>От игрока<\/span>/);assert.match(dialogs[0].innerHTML,/Версия от игрока новее: «Обновить» заменит ею лист на этом устройстве\./);
 dialogs[0].close('update');
 assert.deepEqual(plain(await done),{ok:true,id:'local-id',updated:true,kept:true,how:'update'});
 assert.deepEqual(app.calls[1],['import',{sourceKey:key,open:false,replace:'local-id',rebind:true}]);assert.deepEqual(app.notices,[]);
 // «Оставить обе» for a sheet that is not this player's: the new copy is the one that answers to the room.
 app=fakeApp({match:byUid});({S,dialogs}=load('',{App:app,ROLES,lang:'en'}));done=S.offer({...sheet,extra:{uid:'U'}},{kind:'room',sourceKey:key});
 assert.match(dialogs[0].innerHTML,/<span>From the player<\/span><b>edit time unknown<\/b>/);assert.match(dialogs[0].innerHTML,/roll the sheet back to the older version from the player\./);
 dialogs[0].close('copy');assert.equal((await done).how,'copy');
 assert.deepEqual(app.calls[1],['import',{open:false,copy:true,sourceKey:key,rebind:true}]);
 // …and for this player's own sheet edited here since: the GM's copy keeps the key, the other one is just a copy.
 app=fakeApp({match:{...byUid,by:'source'}});({S,dialogs}=load('',{App:app,ROLES,lang:'en'}));done=S.offer(sheet,{kind:'room',sourceKey:key});
 assert.match(dialogs[0].innerHTML,/The version from the player is newer: “Update” replaces the sheet on this device with it\./);
 dialogs[0].close('copy');await done;assert.deepEqual(app.calls[1],['import',{open:false,copy:true}]);
 // Closing the question changes nothing; a failed save comes back with its reason for the room to explain.
 app=fakeApp({match:byUid});({S,dialogs}=load('',{App:app,ROLES}));done=S.offer(sheet,{kind:'room',sourceKey:key});dialogs[0].close('');
 assert.equal(await done,null);assert.equal(app.calls.length,1);assert.equal(dialogs[0].removed,true);
 app=fakeApp({match:byUid,result:{ok:false,reason:'storage'}});({S,dialogs}=load('',{App:app,ROLES}));done=S.offer(sheet,{kind:'room',sourceKey:key});dialogs[0].close('update');
 assert.deepEqual(plain(await done),{ok:false,reason:'storage',how:'update'});assert.deepEqual(app.notices,[]);
 // A key that is not text is no key.
 app=fakeApp();({S}=load('',{App:app}));await S.offer(sheet,{kind:'room',sourceKey:{toString:()=>'x'}});assert.deepEqual(app.calls[1],['import',{sourceKey:''}]);
});

test('a sheet with fields that are not what they should be is shown as text or refused, never run or left hanging',async()=>{
 let app=fakeApp(),{S,dialogs}=load('',{App:app,ROLES});
 const evil='<img src=x onerror=alert(1)>';
 let done=S.offer({id:evil.repeat(9),name:evil.repeat(9),role:evil,rank:evil,stats:{INT:evil,REF:{valueOf:()=>9},DEX:'7',BODY:[8],EMP:1e99}},{kind:'link'});
 let html=dialogs[0].innerHTML;
 assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
 assert.match(html,/<small>INT<\/small>0</);assert.match(html,/<small>REF<\/small>0</);assert.match(html,/<small>DEX<\/small>7</);assert.match(html,/<small>BODY<\/small>0</);assert.doesNotMatch(html,/ранг/);
 assert.ok(html.split('share-import-name')[1].split('</p>')[0].length<700,'a long name is cut');
 dialogs[0].close('cancel');await done;assert.equal(app.calls[0][1].sourceKey.length,'link:'.length+80);
 // Objects where text belongs read as empty: no «[object Object]», and nothing of theirs is called.
 let called=0;const sly={toString(){called++;return evil},valueOf(){called++;return 5}};
 app=fakeApp({match:{id:'local-id',name:sly,updatedAt:5}});({S,dialogs}=load('',{App:app,ROLES}));done=S.offer({id:sly,name:sly,role:sly,rank:sly,stats:{INT:sly},extra:{updatedAt:sly}},{kind:'file'});
 html=dialogs[0].innerHTML;assert.equal(called,0);assert.ok(!html.includes('[object')&&!html.includes('<img'));
 assert.match(html,/<p class="share-import-name"><b>—<\/b> · <\/p>/);assert.match(html,/<span>На этом устройстве<\/span>/);
 dialogs[0].close('cancel');await done;
 // The name of the sheet already here is text from this device, shown as text.
 app=fakeApp({match:{id:'local-id',name:evil,updatedAt:5}});({S,dialogs}=load('',{App:app,ROLES}));done=S.offer(sheet,{kind:'file'});
 assert.ok(dialogs[0].innerHTML.includes('На этом устройстве · «&lt;img src=x onerror=alert(1)&gt;»')&&!dialogs[0].innerHTML.includes('<img'));dialogs[0].close('cancel');await done;
 // A sheet that cannot even be read ends in a notice, not in a dialog that never opens.
 app=fakeApp();({S,dialogs}=load('',{App:app,ROLES}));
 const broken={name:'Ви',role:'solo',get stats(){throw Error('boom')}};
 assert.deepEqual(plain(await S.offer(broken,{kind:'link'})),{ok:false,reason:'invalid'});assert.equal(dialogs.length,0);assert.deepEqual(app.notices,['Не удалось прочитать лист персонажа.']);
 assert.deepEqual(plain(await S.offer(Object.assign(Object.create(broken),{}),{kind:'room',sourceKey:'k'})),{ok:true,id:'new-id',updated:false,how:'new'}); // no dialog needed, the app checks the sheet itself
 for(const junk of [null,undefined,'text',7])assert.equal(await S.offer(junk,{kind:'link'}),null);
});

test('without <dialog> the question is a plain confirm: OK never rolls a newer local sheet back',async()=>{
 const asked=[],ask=answer=>({confirm:m=>(asked.push(m),answer)});
 const older={id:'local-id',name:'Ви',updatedAt:Date.UTC(2026,10,2,10,0)},newer={...older,updatedAt:Date.UTC(2026,10,9,20,0)};
 // A new character.
 let app=fakeApp(),{S}=load('',{App:app,ROLES,modal:false,win:ask(true)});
 await S.offer(sheet,{kind:'link'});assert.deepEqual(asked,['Импортировать персонажа?']);assert.deepEqual(app.calls[1],['import',{sourceKey:'link:remote-id',open:true}]);
 // The incoming one is newer: OK updates.
 app=fakeApp({match:older,result:{ok:true,id:'local-id',updated:true}});({S}=load('',{App:app,ROLES,modal:false,win:ask(true)}));await S.offer(sheet,{kind:'link'});
 assert.equal(asked.at(-1),'Этот персонаж уже есть на устройстве\nВерсия в ссылке новее: «Обновить» заменит ею лист на этом устройстве.');assert.equal(app.calls[1][1].replace,'local-id');
 // The local one is newer: OK keeps both.
 app=fakeApp({match:newer});({S}=load('',{App:app,ROLES,modal:false,win:ask(true)}));await S.offer({...sheet,extra:{uid:'U',updatedAt:Date.UTC(2026,10,1)}},{kind:'file'});
 assert.match(asked.at(-1),/Версия на этом устройстве новее\. «Обновить» вернёт лист к более старой версии из файла\./);assert.deepEqual(app.calls[1],['import',{open:true,copy:true}]);
 // Cancel imports nothing.
 app=fakeApp({match:older});({S}=load('',{App:app,ROLES,modal:false,win:ask(false)}));assert.equal(await S.offer(sheet,{kind:'room',sourceKey:'k'}),null);
 assert.match(asked.at(-1),/Версия от игрока новее/);assert.equal(app.calls.length,1);
});

test('unpacking reads up to the limit whole and refuses anything past it',async()=>{
 const {S}=load('');
 const deflate=async bytes=>new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
 const bomb=await deflate(new Uint8Array(2e7));
 assert.ok(bomb.length<40000,'20 MB of zeros pack into '+bomb.length+' bytes');
 await assert.rejects(()=>S.inflate(bomb,200000),/too_big/);await assert.rejects(()=>S.inflate(bomb),/too_big/);
 const text=new TextEncoder().encode('Найт-Сити '.repeat(3000)),packed=await deflate(text);
 assert.deepEqual([...await S.inflate(packed,text.length)],[...text]);
 await assert.rejects(()=>S.inflate(packed,text.length-1),/too_big/);
 assert.equal((await S.inflate(await deflate(new Uint8Array(0)),10)).length,0);
 await assert.rejects(()=>S.inflate(new Uint8Array([255,255,255,255]),10));
});
