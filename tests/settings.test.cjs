// The settings page: what it gathers, the storage figures, and the two-step erase that removes only this app's keys.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'..','site','settings.js'),'utf8');
const NOW=Date.UTC(2026,5,10,12,0,0);

function load({store={},status,extra={},lang='ru'}={}){
 const map=new Map(Object.entries(store)),listeners={},nodes={},calls={deleted:[],replaced:[],renders:0,notes:[],days:[],intro:0,mini:[]};
 const localStorage={get length(){return map.size},key:i=>[...map.keys()][i]??null,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
 const document={documentElement:{dataset:{build:'abc123'}},addEventListener:(t,f)=>{(listeners[t]||=[]).push(f)},querySelector:s=>nodes[s]||null,createElement:()=>({setAttribute(){},after(){}})};
 const window={document,localStorage,indexedDB:{deleteDatabase:n=>calls.deleted.push(n)},location:{pathname:'/app/',search:'?x=1',hash:'#/settings',replace:u=>calls.replaced.push(u)},
  setTimeout:f=>{f();return 1},addEventListener(){},
  App:{lang:()=>lang,render:()=>{calls.renders++},notify:m=>calls.notes.push(m)},
  Transfer:{status:()=>status??{at:null,days:null,changes:0,due:false,hasData:true,meta:{days:14}},setDays:d=>{calls.days.push(d)}},
  ShellUI:{isMini:()=>false,setMini:v=>calls.mini.push(v)},
  Onboarding:{showAgain:()=>{calls.intro++}},WhatsNew:{APP_VERSION:'2.0'},
  ...extra};
 vm.runInNewContext(code,{window,Promise,Date,Math,Number,String});
 const fire=(type,target)=>{for(const f of listeners[type]||[])f({target})};
 // A target that answers closest() for the selectors given.
 const on=(selector,props)=>({...props,closest:s=>s===selector?target:null});
 let target;
 const el=(selector,props)=>(target=on(selector,props));
 return {S:window.Settings,window,map,calls,nodes,fire,el};
}

test('appKeys picks only the keys this app writes',()=>{
 const {S,window}=load({store:{'nc-ui-theme':'dark','nightcity-red-v1':'{}','nightcity-red-v1:recovery:5':'x','nc-pref-tab':'"a"','theme':'x','other-site':'1','xnc-role':'1'}});
 assert.deepEqual([...S.appKeys(window.localStorage)].sort(),['nc-pref-tab','nc-ui-theme','nightcity-red-v1','nightcity-red-v1:recovery:5']);
});

test('appBytes counts two bytes per character of the app keys and ignores the rest',()=>{
 const {S,window}=load({store:{'nc-role':'gm','other':'x'.repeat(1000)}});
 assert.equal(S.appBytes(window.localStorage),('nc-role'.length+2)*2);
 assert.equal(S.appBytes({length:1,key(){throw new Error('x')},getItem(){}}),0);
});

test('sizes are written in the language of the page',()=>{
 const {S}=load();
 assert.equal(S.formatBytes(0,'ru'),'0 Б');assert.equal(S.formatBytes(1536,'ru'),'1,5 КБ');assert.equal(S.formatBytes(1536,'en'),'1.5 KB');
 assert.equal(S.formatBytes(5*1024*1024,'en'),'5 MB');assert.equal(S.formatBytes(-4,'en'),'0 B');assert.equal(S.formatBytes('x','ru'),'0 Б');
 assert.equal(S.percent(1,100,'ru'),'1 %'.replace('1 %','1,0 %'));
 assert.equal(S.percent(50,100,'en'),'50 %');assert.equal(S.percent(1,0,'en'),'0 %');
});

test('the storage warning comes at 80 percent of the room and not before',()=>{
 const {S}=load();
 assert.equal(S.WARN_AT,0.8);
 assert.equal(S.storageLevel(79,100),'ok');assert.equal(S.storageLevel(80,100),'warn');assert.equal(S.storageLevel(100,100),'warn');
 assert.equal(S.storageLevel(5,0),'ok');
});

test('storageText reports use, room, the app share and the persistence promise; it survives a browser without the API',async()=>{
 const {S,window}=load({store:{'nc-role':'gm'}});
 const nav={storage:{estimate:async()=>({usage:2*1024*1024,quota:10*1024*1024}),persisted:async()=>true}};
 const r=await S.storageText('en',nav,window.localStorage);
 assert.equal(r.level,'ok');assert.match(r.text,/Used 2 MB of 10 MB \(20 %\)\./);assert.match(r.text,/App data: about \d+ B\./);assert.equal(r.persist,true);
 const warn=await S.storageText('ru',{storage:{estimate:async()=>({usage:90,quota:100})}},window.localStorage);
 assert.equal(warn.level,'warn');assert.equal(warn.persist,null);
 for(const bad of [undefined,{},{storage:{estimate:async()=>{throw new Error('no')}}},{storage:{estimate:async()=>({usage:'a',quota:null})}}]){
  const r2=await S.storageText('ru',bad,window.localStorage);
  assert.equal(r2.level,'ok');assert.match(r2.text,/не сообщает/);
 }
});

test('the erase gate: a backup from the last day with no changes since is fresh; otherwise a tick is required',()=>{
 const {S}=load(),h=3600e3;
 assert.deepEqual({...S.eraseGate({at:NOW-h,changes:0,now:NOW})},{fresh:true,allowed:true});
 assert.deepEqual({...S.eraseGate({at:NOW-25*h,changes:0,now:NOW})},{fresh:false,allowed:false});
 assert.deepEqual({...S.eraseGate({at:NOW-h,changes:3,now:NOW})},{fresh:false,allowed:false});
 assert.deepEqual({...S.eraseGate({at:null,now:NOW})},{fresh:false,allowed:false});
 assert.deepEqual({...S.eraseGate({at:null,now:NOW,tick:true})},{fresh:false,allowed:true});
 assert.deepEqual({...S.eraseGate({at:NOW-25*h,now:NOW,tick:'yes'})},{fresh:false,allowed:false},'only a real tick counts');
 assert.equal(S.eraseGate({at:NOW+h,changes:0,now:NOW}).fresh,false,'a date in the future is not a backup');
 assert.equal(S.eraseGate().allowed,false);
});

test('the typed confirmation is the word in either language, any case, trimmed',()=>{
 const {S}=load();
 assert.equal(S.confirmWord('ru'),'СТЕРЕТЬ');assert.equal(S.confirmWord('en'),'ERASE');
 for(const ok of ['СТЕРЕТЬ','стереть','  Стереть ','ERASE','erase'])assert.equal(S.confirmOk(ok),true,ok);
 for(const bad of ['','стер','erase it','СТЕРЕТЬ!',null,undefined,0])assert.equal(S.confirmOk(bad),false,String(bad));
});

test('erase removes only the keys of this app and asks for its two databases to go',()=>{
 const {S,window,map,calls}=load({store:{'nightcity-red-v1':'{}','nightcity-red-last-backup-v1':'x','nc-ui-style':'cyber','nc-pref-tab':'"x"','another-app':'keep','theme':'keep'}});
 const r=S.erase({storage:window.localStorage,indexedDB:window.indexedDB});
 assert.equal(r.removed,4);
 assert.deepEqual([...map.keys()].sort(),['another-app','theme']);
 assert.deepEqual(calls.deleted.sort(),['nc-room-identity','nightcity-red-citymap']);
 assert.deepEqual([...S.erase({storage:window.localStorage,indexedDB:null}).databases],[]);
 assert.equal(S.erase({storage:{length:0,key(){return null},removeItem(){}},indexedDB:{deleteDatabase(){throw new Error('x')}}}).removed,0);
});

test('the page gathers look, theme, language, role, dice feedback, install, backups, storage, news and the erase',()=>{
 const diceFeel={controls:(lang,opts)=>`<div data-dice-feel data-haptics-opt="${!!opts?.haptics}"></div>`};
 const {S}=load({extra:{DiceFeel:diceFeel,
  RoleMode:{switchHTML:()=>'<div class="role-switch"></div>',t:()=> 'Роль'},
  ThemeSwitch:{get:()=>'black',note:()=>''},NativeUI:{currentStyle:()=>'board'},
  KeepAwake:{supported:()=>true,button:()=> '<button data-keep-awake></button>'},PWA:{canInstall:()=>true,isStandalone:()=>false,isIOS:()=>false}}});
 const html=S.render('ru');
 for(const m of ['data-ui-style="native"','data-ui-style="board"','data-ui-style="cyber"','data-ui-theme="auto"','data-ui-theme="dark"','data-ui-theme="light"','data-ui-theme="black"','data-action="lang" data-lang="ru"','data-action="lang" data-lang="en"','role-switch','data-dice-feel','data-haptics-opt="true"','data-keep-awake','data-shell="install"','data-action="export-backup"','data-xfer-open','data-set-input="days"','data-set-storage','data-action="navigate" data-view="news"','data-set="intro"','data-set="erase-open"','data-set-version','data-set-input="mini"'])
  assert.ok(html.includes(m),m);
 assert.match(html,/data-ui-theme="black" aria-pressed="true" class="active"/);
 assert.match(html,/data-ui-style="board" aria-pressed="true" class="active"/);
 assert.match(html,/Версия 2\.0 · сборка abc123/);
 // Every section is a labelled region whose label exists.
 const ids=[...html.matchAll(/aria-labelledby="([^"]+)"/g)].map(m=>m[1]);
 assert.ok(ids.length>=6);for(const id of ids)assert.ok(html.includes(`id="${id}"`),id);
 // Only one h1, and the page does not show the erase panel before it is asked for.
 assert.equal((html.match(/<h1/g)||[]).length,1);assert.ok(!html.includes('data-set-erase>'));
});

test('without the optional modules the page still renders and offers what cannot be done as text',()=>{
 const {S}=load();
 const html=S.render('en');
 assert.match(html,/Settings/);assert.match(html,/cannot keep the screen on/);assert.match(html,/Installing is not available/);
 assert.ok(!html.includes('data-dice-feel'));
 assert.match(S.render('ru'),/Установка недоступна|Сейчас установка недоступна/);
});

test('in the cyberpunk look a light or black theme says plainly that it has no effect',()=>{
 const note='В «Киберпанке» своя палитра';
 const {S}=load({extra:{ThemeSwitch:{get:()=>'light',note:()=>note+': светлая и чёрная темы там не действуют.'}}});
 const html=S.render('ru');
 assert.match(html,/data-set-theme-note/);assert.ok(html.includes(note));
 const quiet=load({extra:{ThemeSwitch:{get:()=>'light',note:()=>''}}}).S.render('ru');
 assert.match(quiet,/data-set-theme-note hidden/);assert.ok(!quiet.includes(note));
});

test('install: installed, iOS hint and unavailable are told apart',()=>{
 const pwa=p=>load({extra:{PWA:{canInstall:()=>false,isStandalone:()=>false,isIOS:()=>false,...p}}}).S.render('en');
 assert.match(pwa({isStandalone:()=>true}),/already installed/);
 assert.match(pwa({isIOS:()=>true}),/Add to Home Screen/);
 assert.match(pwa({}),/not available right now/);
 assert.match(pwa({canInstall:()=>true}),/data-shell="install"/);
});

test('backup lines: never, last date with age, due, and nothing to save',()=>{
 const {S}=load(),b=S._test.backupLine;
 assert.match(b('ru',{at:null,hasData:true,due:false}),/ещё не делалась/);
 assert.match(b('ru',{at:null,hasData:false,due:false}),/нечего сохранять/);
 assert.match(b('en',{at:NOW,days:0,hasData:true,due:false}),/Last backup: .*\(today\)/);
 assert.match(b('en',{at:NOW,days:1,hasData:true,due:true}),/1 day ago\)\. Time for a fresh backup/);
 assert.match(b('en',{at:NOW,days:5,hasData:true,due:false}),/5 days ago/);
 assert.equal(b('ru',null),'');
});

test('the reminder select lists the choices of the transfer module and marks the current one',()=>{
 const html=load({status:{at:null,days:null,changes:0,due:false,hasData:true,meta:{days:30}}}).S.render('ru');
 for(const d of [7,14,30,0])assert.ok(html.includes(`<option value="${d}"`),String(d));
 assert.match(html,/<option value="30" selected>/);
 const h=load();h.fire('change',h.el('[data-set-input]',{dataset:{setInput:'days'},value:'7'}));
 assert.deepEqual(h.calls.days,['7']);
});

test('the erase is two steps: a button, then a panel; the final button waits for the gate and the word',()=>{
 const closed=load().S.render('ru');
 assert.ok(closed.includes('data-set="erase-open"'));assert.ok(!closed.includes('data-set="erase-go"'));
 const h=load({status:{at:Date.now()-1000,days:0,changes:0,due:false,hasData:true,meta:{days:14}}});
 h.fire('click',h.el('[data-set]',{dataset:{set:'erase-open'}}));
 assert.equal(h.calls.renders,1);assert.equal(h.S._test.ui.erase,true);
 let html=h.S.render('ru');
 assert.ok(html.includes('data-set="erase-go" disabled'),'no word typed yet');
 assert.match(html,/Свежая копия есть/);assert.ok(!html.includes('data-set-input="tick"'),'a fresh backup needs no tick');
 assert.match(html,/id="set-erase-title" tabindex="-1"/);
 assert.match(html,/Введите слово «СТЕРЕТЬ»/);
 // Typing the word turns the final button on, in place.
 const go={disabled:true};h.nodes['[data-set="erase-go"]']=go;
 h.fire('input',h.el('[data-set-input="typed"]',{value:'стереть'}));assert.equal(go.disabled,false);
 h.fire('input',h.el('[data-set-input="typed"]',{value:'сте'}));assert.equal(go.disabled,true);
 html=h.S.render('en');assert.match(html,/Type the word “ERASE”/);
});

test('without a fresh backup the tick is needed, and without it nothing is erased',async()=>{
 const h=load({store:{'nightcity-red-v1':'{}','nc-role':'gm','keep':'1'}});
 h.fire('click',h.el('[data-set]',{dataset:{set:'erase-open'}}));
 let html=h.S.render('ru');
 assert.match(html,/Свежей копии нет/);assert.ok(html.includes('data-set-input="tick"'));
 const msg={textContent:'',hidden:true};h.nodes['[data-set-erase-msg]']=msg;
 h.fire('input',h.el('[data-set-input="typed"]',{value:'СТЕРЕТЬ'}));
 const go={disabled:true};h.nodes['[data-set="erase-go"]']=go;
 assert.equal(await h.S._test.runErase(),false);
 assert.equal(msg.textContent,h.S.T.ru.refuse);assert.equal(msg.hidden,false);
 assert.ok(h.map.has('nightcity-red-v1'));assert.deepEqual(h.calls.replaced,[]);
 // Ticking the box opens the gate.
 h.fire('change',h.el('[data-set-input]',{dataset:{setInput:'tick'},checked:true}));
 assert.equal(go.disabled,false);
 assert.equal(await h.S._test.runErase(),true);
 assert.deepEqual([...h.map.keys()],['keep'],'only this app\'s keys went');
 assert.deepEqual(h.calls.replaced,['/app/?x=1']);
 assert.deepEqual(h.calls.deleted.sort(),['nc-room-identity','nightcity-red-citymap']);
 assert.equal(h.S._test.ui.erase,false);
});

test('a wrong word erases nothing even with the gate open',async()=>{
 const h=load({store:{'nc-role':'gm'},status:{at:Date.now(),days:0,changes:0,due:false,hasData:true,meta:{days:14}}});
 h.fire('click',h.el('[data-set]',{dataset:{set:'erase-open'}}));
 h.fire('input',h.el('[data-set-input="typed"]',{value:'почти'}));
 assert.equal(await h.S._test.runErase(),false);assert.ok(h.map.has('nc-role'));
});

test('cancel closes the panel and forgets the tick and the word; leaving the page does too',()=>{
 const h=load();
 h.fire('click',h.el('[data-set]',{dataset:{set:'erase-open'}}));
 h.fire('input',h.el('[data-set-input="typed"]',{value:'СТЕРЕТЬ'}));
 h.fire('change',h.el('[data-set-input]',{dataset:{setInput:'tick'},checked:true}));
 h.fire('click',h.el('[data-set]',{dataset:{set:'erase-cancel'}}));
 assert.deepEqual({...h.S._test.ui},{erase:false,tick:false,typed:'',busy:false});
 h.fire('click',h.el('[data-set]',{dataset:{set:'erase-open'}}));
 h.S._test.closeErase();assert.equal(h.S._test.ui.erase,false);
});

test('«Показать знакомство снова» and the compact menu call the modules that own them',()=>{
 const h=load();
 h.fire('click',h.el('[data-set]',{dataset:{set:'intro'}}));assert.equal(h.calls.intro,1);
 h.fire('change',h.el('[data-set-input]',{dataset:{setInput:'mini'},checked:true}));assert.deepEqual(h.calls.mini,[true]);
});

test('both languages have the same keys, plain «вы», and every text is filled in',()=>{
 const {S}=load();
 const walk=(o,p='')=>Object.entries(o).flatMap(([k,v])=>v&&typeof v==='object'?walk(v,p+k+'.'):[p+k]);
 assert.deepEqual(walk(S.T.ru).sort(),walk(S.T.en).sort());
 for(const lang of ['ru','en'])for(const [k,v] of Object.entries(S.T[lang])){
  if(typeof v==='string')assert.ok(v.trim().length>0,lang+'.'+k);
 }
 const ruText=JSON.stringify(S.T.ru,(k,v)=>typeof v==='function'?v('1','2','3'):v);
 assert.doesNotMatch(ruText,/\b(тебе|тебя|твой|твои|твоё|ты)\b/i);
});

test('markup is escaped: a hostile build id or browser name cannot break out',()=>{
 const h=load({extra:{}});
 h.window.document.documentElement.dataset.build='"><img src=x onerror=1>';
 const html=h.S.render('en');
 assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));
});

test('the page is wired into the shell: route, gear, title, script order, no inline handlers',()=>{
 const app=fs.readFileSync(path.join(__dirname,'..','site','app.js'),'utf8'),index=fs.readFileSync(path.join(__dirname,'..','site','index.html'),'utf8');
 assert.match(app,/ROUTE_VIEWS=new Set\(\[[^\]]*'settings'/);
 assert.match(app,/state\.view==='settings'\?\(window\.Settings\?\.render\?\.\(state\.lang\)/);
 assert.match(app,/T\.ru\.settings='Настройки';T\.en\.settings='Settings'/);
 assert.match(app,/class="top-gear/);
 assert.ok(index.indexOf('settings.js')>0&&index.indexOf('settings.js')<index.indexOf('app.js'));
 assert.match(index,/<link rel="stylesheet" href="settings\.css">/);
 assert.doesNotMatch(code,/\bon(click|change|input)=/);
});

test('appKeys ignores keys that are not strings',()=>{
 const {S}=load();
 const odd={length:3,key:i=>[null,42,'nc-ok'][i]};
 assert.deepEqual([...S.appKeys(odd)],['nc-ok']);
 // A key that coerces to a matching string must not count as a key either.
 const sneaky={length:1,key:()=>({toString:()=>'nc-x'})};
 assert.deepEqual([...S.appKeys(sneaky)],[]);
});

test('erase also clears the unsaved drafts of the tab (session storage), and nothing else there',()=>{
 const {S,window}=load({store:{'nightcity-red-v1':'{}'}});
 const sm=new Map([['nightcity-red-campaign-drafts','{}'],['nc-rtb-draft-v1','{}'],['nightcity-red-room-sent','{}'],['other','keep']]);
 const session={get length(){return sm.size},key:i=>[...sm.keys()][i]??null,getItem:k=>sm.get(k)??null,setItem:(k,v)=>sm.set(k,v),removeItem:k=>sm.delete(k)};
 const r=S.erase({storage:window.localStorage,indexedDB:null,session});
 assert.equal(r.sessionRemoved,3);assert.deepEqual([...sm.keys()],['other']);
});

test('after the erase this app\'s keys are no longer written (a late flush cannot bring the archive back)',()=>{
 const {S}=load();
 const written=[];
 const proto={setItem(k,v){written.push(k)}};
 assert.equal(S.isFrozen(),false);
 S.freezeWrites(proto);
 assert.equal(S.isFrozen(),true);
 proto.setItem('nightcity-red-v1','{}');proto.setItem('nc-ui-theme','dark');proto.setItem('other-site-key','1');
 assert.deepEqual(written,['other-site-key']);
 S.freezeWrites(proto);proto.setItem('nc-x','1');assert.deepEqual(written,['other-site-key'],'a second call does not wrap twice');
});

test('runErase freezes the store before it removes anything, then reloads',async()=>{
 const {S,window,map,calls}=load({store:{'nightcity-red-v1':'{}'}});
 S._test.ui.tick=true;S._test.ui.typed='ERASE';
 assert.equal(await S._test.runErase(),true);
 assert.equal(S.isFrozen(),true);assert.equal(map.size,0);assert.equal(calls.replaced.length,1);
});

test('the theme note exists on the page at all times, and the install row follows a late install offer',()=>{
 const {S}=load();
 const html=S.render('ru');
 assert.match(html,/id="set-theme-note"[^>]*data-set-theme-note[^>]*hidden/);
 assert.match(code,/beforeinstallprompt/);
});
