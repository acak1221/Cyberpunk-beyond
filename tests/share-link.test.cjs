const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const plain=x=>JSON.parse(JSON.stringify(x));
function load(hash='',{lang='ru',App,ROLES}={}){
 let replaced=null;const dialogs=[];
 // A <dialog> stand-in: tests choose a button by closing it with that button's value.
 const createElement=tag=>{const el={tag,className:'',innerHTML:'',returnValue:'',listeners:{},addEventListener(t,f){el.listeners[t]=f},showModal(){el.open=true},remove(){el.removed=true},dispatchEvent(){el.listeners.close?.()},close(v){el.returnValue=v;el.listeners.close()}};dialogs.push(el);return el};
 const document={documentElement:{lang},readyState:'complete',addEventListener(){},createElement,body:{appendChild(){}}};
 const window={document,location:{hash,pathname:'/app/',search:'',origin:'https://example.test'},history:{replaceState:(a,b,u)=>{replaced=u}},addEventListener(){},navigator:{},btoa,atob,Blob,Response,CompressionStream,DecompressionStream,matchMedia:()=>({matches:false}),App,ROLES};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','site','share-link.js'),'utf8'),{window,TextEncoder,TextDecoder,Uint8Array,JSON,String,Array,Object,Error,Promise,Number,Date,setTimeout,Event:class{}});
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
 assert.deepEqual(app.calls[1],['import',{sourceKey:'link:remote-id',open:true,replace:'local-id'}]);assert.deepEqual(app.notices,['Персонаж обновлён.']);
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
