/* «Что нового» and «Сообщить об ошибке»: a list of releases in two languages, a mark of what was seen that lives in the
   browser only, and a report that carries the version, look, language and browser, and nothing about the player. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const SITE=path.join(__dirname,'..','site');
const code=fs.readFileSync(path.join(SITE,'whats-new.js'),'utf8');
const CHROME_ANDROID='Mozilla/5.0 (Linux; Android 14; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
// A page: storage, <html> with classes and data-build, a navigator, and a document that remembers its listeners and
// hands out simple elements for the dialog.
function load({store={},classes=['ui-native'],build,nav={userAgent:CHROME_ANDROID},hash='',broken=false,clipboard,otherScreen=false}={}){
 const map=new Map(Object.entries(store)),listeners={},winListeners={},made=[],writes=[],copied=[];
 const el=tag=>{const on={},node={tag,attrs:{},dataset:{},children:[],removed:false,open:false,hidden:true,
  setAttribute(k,v){node.attrs[k]=String(v)},addEventListener(k,f){(on[k]||=[]).push(f)},
  showModal(){node.open=true},close(){node.open=false;for(const f of on.close||[])f()},remove(){node.removed=true},
  querySelector:s=>s==='[data-wn-status]'?node.status:null,status:{hidden:true,textContent:''}};made.push(node);return node};
 const focused=[];
 const document={documentElement:{lang:'ru',classList:{contains:c=>classes.includes(c)},dataset:build===undefined?{}:{build}},body:{appendChild:n=>{n.attached=true}},
  createElement:el,querySelectorAll:()=>made.filter(n=>!n.removed&&/wn-dialog/.test(n.className||'')),
  // On another screen there is no report button to give the focus back to.
  querySelector:s=>otherScreen&&/data-wn-report/.test(s)?null:({focus:()=>focused.push(s)}),addEventListener:(k,f)=>{(listeners[k]||=[]).push(f)}};
 const localStorage=broken?{getItem(){throw new Error('no storage')},setItem(){throw new Error('no storage')}}
  :{getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>{writes.push([k,String(v)]);map.set(k,String(v))}};
 const navigator={...nav,clipboard:clipboard===undefined?{writeText:async x=>{copied.push(x)}}:clipboard};
 const window={document,localStorage,navigator,location:{hash,href:'https://example.test/'+hash},setTimeout:f=>f(),addEventListener:(k,f)=>{(winListeners[k]||=[]).push(f)}};
 const fire=type=>{for(const f of winListeners[type]||[])f({type})};
 vm.runInNewContext(code,{window,Object,Array,Number,String,Math,parseInt,encodeURIComponent,Promise});
 // The copy finishes a moment after the click, as in a browser.
 const click=async target=>{for(const f of listeners.click||[])f({target});await new Promise(r=>setImmediate(r))};
 const button=(attr,dataset={})=>({closest:()=>({matches:s=>s===`[${attr}]`,dataset})});
 return {W:window.WhatsNew,map,writes,made,copied,focused,click,button,window,fire};
}
const CYR=/[А-Яа-яЁё]/;
const count=(s,re)=>(s.match(re)||[]).length;

test('releases run newest first with unbroken numbers, and every line exists in both languages',()=>{
 const {W}=load(),R=W.RELEASES;
 assert.ok(R.length>=2);assert.equal(R.at(-1).n,1);assert.equal(W.latest(),R[0].n);
 R.forEach((r,i)=>{
  assert.equal(r.n,R.length-i,'numbers go down by one');
  assert.match(r.date,/^20\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
  if(i)assert.ok(r.date<=R[i-1].date,'dates do not go up');
  for(const lang of ['ru','en']){assert.ok(r.title[lang].length>=1&&r.title[lang].length<=70,r.title[lang])}
  assert.ok(r.items.length>=1&&r.items.length<=8);
  for(const it of r.items){for(const lang of ['ru','en'])assert.ok(it[lang].length>=1&&it[lang].length<=220,it[lang]);assert.doesNotMatch(it.en,CYR);assert.match(it.ru,CYR)}
  assert.doesNotMatch(r.title.en,CYR);
 });
 assert.deepEqual(Object.keys(W.T.ru).sort(),Object.keys(W.T.en).sort());
 for(const v of Object.values(W.T.en))assert.doesNotMatch(v,CYR);
});

test('every feature that shipped after release 10 was written up is on the page, under the name the README gives it',()=>{
 const {W}=load(),r=W.RELEASES.find(x=>x.n===11),ru=r.items.map(i=>i.ru).join(' '),en=r.items.map(i=>i.en).join(' ');
 // Release 10 keeps its number and its lines: the number is what browsers stored as «seen».
 assert.equal(W.RELEASES.find(x=>x.n===10).items.length,5);assert.ok(r.date>=W.RELEASES.find(x=>x.n===10).date);
 for(const re of [/Папки и метки персонажей/,/Именованные модификаторы/,/Группы предметов/,/свои таблицы бросков/,/NPC по шагам/,/Часы с триггерами/,/Редактор NET-архитектуры/,/видят в списке инициативы/,/«Агент»/,/Карта города/])assert.match(ru,re);
 for(const re of [/Folders and tags/,/Named modifiers/,/Item groups/,/roll tables/,/step-by-step NPC/,/Clocks with triggers/,/NET architecture editor/,/initiative list/,/Agent feed/,/city map/i])assert.match(en,re);
 // The README names the same things, each as a bullet that opens the way the others do: a bold name and a colon.
 const readme=fs.readFileSync(path.join(SITE,'..','README.md'),'utf8');
 for(const name of ['Папки и метки персонажей','Именованные модификаторы','Группы предметов','Свои таблицы бросков','NPC по шагам','Часы с триггерами','Редактор NET-архитектуры','Видимость участников боя в комнате','«Агент»','Карта города'])assert.ok(readme.includes('\n- **'+name+':** '),'README: '+name);
 // A player who had read release 10 gets the mark again.
 const back=load({store:{'nightcity-red-v1':'{}','nc-news-seen':'10'}});assert.equal(back.W.unread(),1);assert.notEqual(back.W.dot(),'');
});

test('release 10 names what it added: the waiting room, inventory cards, dice sound and shaking, names, this page',()=>{
 const {W}=load(),top=W.RELEASES.find(x=>x.n===10),ru=top.items.map(i=>i.ru).join(' '),en=top.items.map(i=>i.en).join(' ');
 for(const re of [/Зал ожидания/,/Инвентарь карточками/,/Звук кубиков/,/встряхиванием/,/Генератор имён/,/Сообщить об ошибке/])assert.match(ru,re);
 for(const re of [/waiting room/i,/Inventory as cards/,/Dice sound/,/shaking/,/name and handle generator/,/Report a problem/])assert.match(en,re);
});

test('a new player gets no dot; a returning player gets the newest release pointed out, once',()=>{
 const fresh=load();
 assert.equal(fresh.W.seen(),fresh.W.latest());assert.equal(fresh.W.unread(),0);assert.equal(fresh.W.marker('ru'),'');assert.equal(fresh.W.dot(),'');assert.equal(fresh.W.note('ru'),'');
 assert.equal(fresh.map.get('nc-news-seen'),String(fresh.W.latest()));
 const back=load({store:{'nightcity-red-v1':'{"characters":[]}'}}),n=back.W.latest();
 assert.equal(back.W.seen(),n-1);assert.equal(back.W.unread(),1);
 assert.equal(back.map.get('nc-news-seen'),String(n-1),'the starting point is remembered');
 assert.match(back.W.marker('ru'),/class="wn-dot" aria-hidden="true"/);assert.match(back.W.marker('ru'),/class="wn-sr"> \(есть новое\)</);
 assert.match(back.W.marker('en'),/\(new\)/);assert.doesNotMatch(back.W.marker('en'),CYR);
 assert.equal(back.W.dot(),'<span class="wn-dot" aria-hidden="true"></span>','the bare dot carries no words: it goes into an icon hidden from screen readers');
 assert.equal(back.W.markSeen(),true);assert.equal(back.W.marker('ru'),'');assert.equal(back.map.get('nc-news-seen'),String(n));
 assert.equal(back.W.markSeen(),false,'nothing is written twice');
 // an older mark from an earlier visit: several releases unread
 const old=load({store:{'nc-news-seen':'3'}});assert.equal(old.W.unread(),old.W.latest()-3);
});

test('a broken mark never breaks the page: it is read as no mark or held within range, and storage that throws is survived',()=>{
 for(const raw of ['abc','-3','1e9','','99999',' 4','4.5','0x4']){
  const p=load({store:{'nc-news-seen':raw,'nightcity-red-v1':'{}'}});
  assert.equal(p.W.seen(),p.W.latest()-1,JSON.stringify(raw)+' counts as no mark');
 }
 const ahead=load({store:{'nc-news-seen':'9999','nightcity-red-v1':'{}'}});
 assert.equal(ahead.W.unread(),0,'a mark from a newer copy of the app means nothing unread');assert.equal(ahead.W.seen(),ahead.W.latest());
 const zero=load({store:{'nc-news-seen':'0'}});assert.equal(zero.W.unread(),zero.W.latest());
 const dead=load({broken:true});
 assert.equal(dead.W.unread(),0);assert.equal(dead.W.marker('ru'),'');
 assert.match(dead.W.page('ru'),/<h1>Что нового<\/h1>/);assert.equal(dead.W.markSeen(),false);
});

test('the page lists every release, tags the unread ones for this visit, and opening it is what removes the dot',()=>{
 const p=load({store:{'nc-news-seen':'8'}}),W=p.W,n=W.latest();
 assert.equal(W.unread(),n-8);
 const html=W.page('ru');
 assert.equal(count(html,/<h1>/g),1);assert.match(html,/<h1>Что нового<\/h1>/);assert.match(html,/версия 2\.0/);
 assert.equal(count(html,/class="card wn-release"/g),W.RELEASES.length);
 assert.equal(count(html,/class="wn-new"/g),n-8,'only the releases after the last visit are tagged');
 assert.match(html,new RegExp(`data-wn-release="${n}"[^]*?class="wn-new">Новое<`));
 assert.equal(count(html,/data-wn-report="(top|bottom)"/g),2,'the action is at the top and again under the list');
 assert.match(html,/<time datetime="2026-11-14">14\.11\.2026<\/time>/);
 assert.equal(W.unread(),0);assert.equal(W.marker('ru'),'');assert.equal(p.map.get('nc-news-seen'),String(n));
 const writes=p.writes.length;
 const again=W.page('en');
 assert.equal(count(again,/class="wn-new">New</g),n-8,'the tags stay until the page is reloaded');
 assert.equal(p.writes.length,writes,'a second draw writes nothing');
 assert.doesNotMatch(again,CYR);assert.match(again,/<time datetime="2026-11-14">14\/11\/2026<\/time>/);
 assert.match(again,/<h1>What’s new<\/h1>/);
 // after a reload nothing is tagged
 assert.equal(count(load({store:{'nc-news-seen':String(n)}}).W.page('ru'),/class="wn-new"/g),0);
});

test('the browser is named by a short known name and a major version; the device model and odd strings never pass',()=>{
 const {W}=load();
 const cases=[
  [{userAgent:CHROME_ANDROID},'Chrome 130','Android'],
  [{userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'},'Chrome 131','Windows'],
  [{userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.2849.68'},'Edge 130','Windows'],
  [{userAgent:'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0'},'Firefox 132','Linux'],
  [{userAgent:'Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0'},'Firefox 132','Android'],
  [{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'},'Safari 18','iOS'],
  [{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',platform:'MacIntel',maxTouchPoints:0},'Safari 17','macOS'],
  [{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',platform:'MacIntel',maxTouchPoints:5},'Safari 18','iOS'],
  [{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1'},'Chrome 130','iOS'],
  [{userAgent:'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36'},'Samsung Internet 26','Android'],
  [{userAgent:'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'},'Chrome 129','ChromeOS'],
  [{userAgent:CHROME_ANDROID,userAgentData:{brands:[{brand:'Not A(Brand',version:'99'},{brand:'Chromium',version:'130'},{brand:'Microsoft Edge',version:'130'}]}},'Edge 130','Android'],
  [{userAgent:CHROME_ANDROID,userAgentData:{brands:[{brand:'Not?A_Brand',version:'8'},{brand:'Chromium',version:'128'}]}},'Chromium 128','Android'],
  // a brand nobody listed, or one with markup, falls back to the user agent
  [{userAgent:CHROME_ANDROID,userAgentData:{brands:[{brand:'<script>alert(1)</script>',version:'1'},{brand:'Secret Phone Browser',version:'7'}]}},'Chrome 130','Android'],
  [{userAgent:CHROME_ANDROID,userAgentData:{brands:[{brand:'Google Chrome',version:'<b>'}]}},'Chrome 130','Android'],
  [{userAgent:''},'unknown','unknown'],[{},'unknown','unknown'],[null,'unknown','unknown'],
  [{userAgent:'<script>alert(1)</script> SM-G991B'},'unknown','unknown'],
  [{userAgent:'Chrome/<img src=x>'},'unknown','unknown'],
 ];
 for(const [nav,browser,os] of cases){assert.equal(W.browserName(nav),browser,nav?.userAgent);assert.equal(W.osName(nav),os,nav?.userAgent)}
 const body=load({nav:{userAgent:CHROME_ANDROID}}).W.draft('en').body;
 assert.match(body,/- Browser: Chrome 130, Android$/);assert.doesNotMatch(body,/SM-G991B|Mozilla|AppleWebKit/,'the raw user agent and the phone model stay on the device');
});

test('the look and theme come from what the page shows, the build from the stamp, and anything odd falls back',()=>{
 const e=(o,lang='ru')=>load(o).W.env(lang);
 assert.deepEqual([e({classes:['ui-native']}).look,e({classes:['ui-native']}).theme],['native','dark']);
 assert.deepEqual([e({classes:['ui-native','ui-board']}).look,e({classes:['ui-native','ui-board','ui-light']}).theme],['board','light']);
 assert.deepEqual([e({classes:['ui-native','ui-light']}).look,e({classes:['ui-native','ui-light']}).theme],['native','light']);
 assert.deepEqual([e({classes:[]}).look,e({classes:['ui-light']}).theme],['cyber','dark'],'the cyber look is always dark');
 assert.equal(e({build:'a1b2c3d4e5'}).build,'a1b2c3d4e5');
 for(const bad of ['','dev','XYZ','a1b2c','a1b2c3d4e5f6a7b8c9','<b>abcdef</b>','abcdef;rm'])assert.equal(e({build:bad}).build,'dev',bad);
 assert.equal(e({}).build,'dev');
 assert.equal(e({},'en').lang,'en');assert.equal(e({},'de').lang,'ru');assert.equal(e({},undefined).lang,'ru');
 assert.equal(e({}).version,'2.0');assert.equal(e({}).release,load().W.latest());
 // a caller cannot push its own text through the draft
 const {W}=load(),d=W.draft('en',{look:'<img>',theme:'pink',build:'../../x',browser:'Evil <b> 1',os:'Vee’s phone',lang:'xx',extra:'secret'});
 assert.match(d.body,/build dev\n- Look: Clean, dark theme\n- Language: ru\n- Browser: unknown, unknown$/);assert.doesNotMatch(d.body,/img|pink|Evil|Vee|secret|\.\./);
});

test('privacy: nothing of the player reaches the report — no names, no page address, no stored values',()=>{
 const secret='Секретное Имя',archive=JSON.stringify({characters:[{id:'abc-123',name:secret,notes:'private note'}],campaigns:[{name:'Hidden Job'}],lang:'ru'});
 for(const lang of ['ru','en']){
  const p=load({store:{'nightcity-red-v1':archive,'nightcity-red-room':'ROOMCODE42','nc-ui-style':'"><script>hostile()</script>','nc-ui-theme':'hostile-theme'},hash:'#/sheet/abc-123',classes:['ui-native','ui-board'],build:'0123abcd',nav:{userAgent:CHROME_ANDROID,language:'xx-SECRET',platform:'Secret Platform'}});
  const W=p.W,d=W.draft(lang),url=W.issueUrl(d),view=W.reportView(lang),all=[d.title,d.body,url,decodeURIComponent(url),view.html,view.preview].join('\n');
  for(const leak of [secret,'Секретное','abc-123','sheet','private note','Hidden Job','ROOMCODE42','hostile','SECRET','Secret Platform','example.test','SM-G991B','nightcity'])assert.equal(all.includes(leak),false,leak);
  const lines=d.body.split('\n'),at=lines.findIndex(l=>/^\*\*(Окружение|Environment)\*\*/.test(l));
  assert.ok(at>0);
  const envLines=lines.slice(at+1);
  assert.equal(envLines.length,4,'four lines about the device, and the body ends there');
  assert.deepEqual(envLines,lang==='ru'
   ?[`- Версия: 2.0, выпуск ${W.latest()}, сборка 0123abcd`,'- Оформление: Досье, тёмная тема','- Язык: ru','- Браузер: Chrome 130, Android']
   :[`- Version: 2.0, release ${W.latest()}, build 0123abcd`,'- Look: Dossier, dark theme','- Language: en','- Browser: Chrome 130, Android']);
 }
 // The module has no way to see them: it never names the page address, the app state or another storage key.
 assert.doesNotMatch(code,/\blocation\b|\.hash\b|\.href\b|getState|\.characters|\.campaigns|sessionStorage|indexedDB|\.cookie|\.referrer|\bfetch\(|XMLHttpRequest|sendBeacon/);
 assert.deepEqual([...code.matchAll(/read\(([A-Z_]+)\)/g)].map(m=>m[1]).sort(),['ARCHIVE_KEY','KEY','KEY'],'two storage keys are read: its own mark, and whether an archive exists');
 assert.match(code,/read\(ARCHIVE_KEY\)===null\?/,'the archive is only checked for presence');
});

test('the link is a GitHub new-issue address that carries exactly the title and the body shown, within what a link can hold',()=>{
 for(const lang of ['ru','en'])for(const classes of [['ui-native'],['ui-native','ui-board','ui-light'],[]]){
  const {W}=load({classes,build:'0123456789abcdef',nav:{userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/9999.0 Chrome/122.0.0.0 Mobile Safari/537.36'}}),d=W.draft(lang),url=W.issueUrl(d),u=new URL(url);
  assert.ok(url.startsWith('https://github.com/acak1221/Cyberpunk-beyond/issues/new?'));
  assert.equal(u.origin+u.pathname,'https://github.com/acak1221/Cyberpunk-beyond/issues/new');
  assert.deepEqual([...u.searchParams.keys()],['title','body']);
  assert.equal(u.searchParams.get('title'),d.title);assert.equal(u.searchParams.get('body'),d.body);
  assert.equal(u.hash,'');
  assert.ok(d.body.length<=W.LIMITS.BODY,`body ${d.body.length}`);assert.ok(url.length<=W.LIMITS.URL,`url ${url.length}`);
  assert.equal(d.title,lang==='ru'?'Ошибка: ':'Bug: ');
 }
 const {W}=load();
 assert.equal(W.issueUrl({title:'x',body:'y'.repeat(W.LIMITS.BODY+1)}),'https://github.com/acak1221/Cyberpunk-beyond/issues/new','too long a text opens the plain page');
 assert.equal(W.issueUrl({title:'x',body:'я'.repeat(400)}),'https://github.com/acak1221/Cyberpunk-beyond/issues/new','so does an address that would be too long once encoded');
 assert.equal(W.issueUrl(null),'https://github.com/acak1221/Cyberpunk-beyond/issues/new?title=&body=');
});

test('the dialog shows the same text the link carries, opens GitHub in a new tab without a referrer, and warns when offline',()=>{
 for(const lang of ['ru','en']){
  const {W}=load(),v=W.reportView(lang),d=W.draft(lang);
  assert.equal(v.preview,d.title+'\n\n'+d.body);assert.equal(v.url,W.issueUrl(d));
  const un=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
  const pre=/<pre class="wn-preview" tabindex="0" role="group" aria-labelledby="wn-preview-label">([^]*?)<\/pre>/.exec(v.html);
  assert.ok(pre,'a scrollable block a keyboard can reach, with a name');assert.equal(un(pre[1]),v.preview);
  const link=/<a class="btn primary" data-wn-go href="([^"]+)" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">/.exec(v.html);
  assert.ok(link);assert.equal(un(link[1]),v.url);
  const u=new URL(un(link[1]));assert.equal(u.searchParams.get('title')+'\n\n'+u.searchParams.get('body'),v.preview);
  assert.match(v.html,/<h2 id="wn-report-title">/);assert.match(v.html,/data-wn-copy/);assert.match(v.html,/data-wn-close/);
  assert.match(v.html,lang==='ru'?/Понадобится вход на GitHub/:/sign in to GitHub/);
  assert.match(v.html,lang==='ru'?/Обращения на GitHub видны всем/:/GitHub issues are public/);
  assert.doesNotMatch(v.html,lang==='ru'?/Сейчас нет сети/:/no network/);
  if(lang==='en')assert.doesNotMatch(v.html,CYR);
  const off=load({nav:{userAgent:CHROME_ANDROID,onLine:false}}).W.reportView(lang).html;
  assert.match(off,lang==='ru'?/Сейчас нет сети\. Скопируйте текст/:/no network right now\. Copy the text/);
 }
});

test('the buttons: the report opens as a modal dialog, copies the shown text, and closing gives the focus back',async()=>{
 const p=load({store:{'nightcity-red-v1':'{}'}});
 await p.click(p.button('data-wn-report',{wnReport:'bottom'}));
 const dlg=p.made.at(-1),cur=p.W._test.current();
 assert.equal(dlg.tag,'dialog');assert.equal(dlg.open,true);assert.equal(dlg.attached,true);assert.equal(dlg.className,'share-import wn-dialog');
 assert.equal(dlg.attrs['aria-labelledby'],'wn-report-title');assert.equal(dlg.dataset.lang,'ru');
 assert.equal(dlg.innerHTML,p.W.reportView('ru').html);assert.equal(cur.preview,p.W.reportView('ru').preview);
 await p.click(p.button('data-wn-copy'));
 assert.deepEqual(p.copied,[cur.preview],'exactly the text on the screen is copied');
 assert.equal(dlg.status.textContent,'Текст скопирован.');assert.equal(dlg.status.hidden,false);
 await p.click(p.button('data-wn-close'));
 assert.equal(dlg.open,false);assert.equal(dlg.removed,true);assert.equal(p.W._test.current(),null);
 assert.deepEqual(p.focused,['[data-wn-report="bottom"]'],'the focus returns to the button that opened the dialog');
 // opening twice leaves one dialog; following the link closes it
 await p.click(p.button('data-wn-report',{wnReport:'top'}));const first=p.made.at(-1);
 await p.click(p.button('data-wn-report',{wnReport:'top'}));const second=p.made.at(-1);
 assert.notEqual(first,second);assert.equal(first.removed,true);assert.equal(second.open,true);
 await p.click(p.button('data-wn-go'));assert.equal(second.open,false);
 // a click elsewhere is not ours
 const before=p.made.length;await p.click({closest:()=>null});assert.equal(p.made.length,before);
 // no clipboard: the player is told to copy by hand, and nothing throws
 const q=load({clipboard:null});await q.click(q.button('data-wn-report',{wnReport:'top'}));
 assert.equal(await q.W.copyReport(),false);assert.equal(q.made.at(-1).status.textContent,'Выделите текст и скопируйте его вручную.');
 assert.equal(await load().W.copyReport(),false,'nothing to copy while no dialog is open');
});

test('wiring: the page has a route, a title, a menu item with an icon, and the app survives without the module',()=>{
 const app=fs.readFileSync(path.join(SITE,'app.js'),'utf8'),index=fs.readFileSync(path.join(SITE,'index.html'),'utf8'),icons=fs.readFileSync(path.join(SITE,'icons.js'),'utf8');
 const views=/VIEWS=new Set\((\[[^\]]*\])\)/.exec(app);
 assert.ok(views,'the list keeps the shape the build script reads');assert.ok(JSON.parse(views[1].replace(/'/g,'"')).includes('news'));
 assert.match(app,/T\.ru\.news='Что нового';T\.en\.news='What’s new';/);
 assert.match(app,/\.\.\.\(window\.WhatsNew\?\[\[ru\?'Приложение':'App',\['news'\]\]\]:\[\]\)/,'no menu item without the module');
 assert.match(app,/state\.view==='news'\?\(window\.WhatsNew\?\.page\?\.\(state\.lang\)\|\|characters\(\)\)/);
 for(const m of app.matchAll(/WhatsNew(.)/g))assert.ok(m[1]==='?',`the app reaches the module only through optional chaining, found «WhatsNew${m[1]}»`);
 assert.match(icons,/\n news:svg\(/);
 assert.ok(index.includes('<link rel="stylesheet" href="whats-new.css">'));
 const at=index.indexOf('<script src="whats-new.js"></script>');
 assert.ok(at>0&&at<index.indexOf('<script src="app.js"></script>'),'the module loads before app.js');
 assert.match(code,/\}\)\(typeof window!=='undefined'\?window:globalThis\);\s*$/);
 const css=fs.readFileSync(path.join(SITE,'whats-new.css'),'utf8');
 assert.doesNotMatch(css,/@import|url\(/);assert.match(css,/@media print/);assert.match(css,/min-height: 44px/);
 assert.ok(app.includes(`<div class="top-actions">\${window.WhatsNew?.pill?.(state.lang)||''}`),'the top bar asks for the link through optional chaining');
 const readme=fs.readFileSync(path.join(SITE,'..','README.md'),'utf8');assert.match(readme,/\*\*Что нового и сообщения об ошибках:\*\*/);
});

test('a visit in another tab clears the dot here on the next draw, and the mark never moves back',()=>{
 const p=load({store:{'nightcity-red-v1':'{}'}}),W=p.W,n=W.latest();
 assert.equal(W.unread(),1);assert.notEqual(W.marker('ru'),'');
 // the other tab opened «Что нового» and wrote its mark
 p.map.set('nc-news-seen',String(n));
 assert.equal(W.unread(),0);assert.equal(W.seen(),n);assert.equal(W.marker('ru'),'');assert.equal(W.dot(),'');assert.equal(W.pill('ru'),'');
 assert.equal(W.markSeen(),false,'nothing left to write');
 assert.equal(count(W.page('ru'),/class="wn-new"/g),0,'and nothing is tagged as new: it was read in the other tab');
 // a lower, broken or missing value later does not bring the dot back
 for(const raw of ['3','abc','',' 4']){p.map.set('nc-news-seen',raw);assert.equal(W.unread(),0,JSON.stringify(raw))}
 p.map.delete('nc-news-seen');assert.equal(W.unread(),0);
 // a mark from a newer copy of the app is held within range
 const q=load({store:{'nc-news-seen':'3'}});q.map.set('nc-news-seen','9999');assert.equal(q.W.seen(),q.W.latest());assert.equal(q.W.unread(),0);
});

test('the release notes use the names the app itself uses',()=>{
 const {W}=load(),ru=W.RELEASES.flatMap(r=>[r.title.ru,...r.items.map(i=>i.ru)]).join('\n'),en=W.RELEASES.flatMap(r=>[r.title.en,...r.items.map(i=>i.en)]).join('\n');
 // Words that appear in no other screen: a reader could not find the thing by that name.
 for(const re of [/НИП/,/(^|[^А-Яа-яЁё])ОУ([^А-Яа-яЁё]|$)/,/Схема боя/,/помощник ведущего/i,/карантин/i,/диктор/i])assert.doesNotMatch(ru,re);
 for(const re of [/GM assistant/i,/quarantine/i,/\btrash\b/i])assert.doesNotMatch(en,re);
 for(const re of [/в формах NPC/,/деньги, IP или предмет/,/Карта боя/,/со-ведущий/,/откладываются/,/Facedown/])assert.match(ru,re);
 for(const re of [/co-GM/,/set aside/,/30-day bin/,/Facedown/,/battle map/i])assert.match(en,re);
 // and the other files really do use them
 const has=(file,text)=>assert.ok(fs.readFileSync(path.join(SITE,file),'utf8').includes(text),file+' has «'+text+'»');
 has('battle-map.js','Карта боя');has('room-auth.js','co-GM');has('npc-library.js','NPC');has('room-grants.js','IP');has('app.js','отложенные данные');has('character-extra.js','Facedown');
});

test('a link in the top bar while something is unread: a wide screen has no «Ещё» button and the menu item can be out of sight',()=>{
 const back=load({store:{'nightcity-red-v1':'{}'}}),W=back.W;
 const ru=W.pill('ru'),en=W.pill('en');
 assert.match(ru,/^<button type="button" class="wn-pill" data-action="navigate" data-view="news"><span class="wn-dot" aria-hidden="true"><\/span><span>Что нового<\/span><span class="wn-sr"> \(есть новое\)<\/span><\/button>$/);
 assert.match(en,/<span>What’s new<\/span><span class="wn-sr"> \(new\)<\/span>/);assert.doesNotMatch(en,CYR);
 W.page('ru');assert.equal(W.pill('ru'),'','gone once the page was opened');
 assert.equal(load().W.pill('ru'),'','a new player gets none');assert.equal(load({broken:true}).W.pill('ru'),'');
 const css=fs.readFileSync(path.join(SITE,'whats-new.css'),'utf8');
 assert.match(css,/@media \(max-width: 820px\) \{ \.wn-pill \{ display: none; \} \}/,'a phone has the dot on «Ещё» instead');
 assert.match(css,/@media print \{[^}]*\.wn-pill/);
});

test('the dialog closes when the screen changes under it, and the focus then goes to the content',async()=>{
 for(const type of ['hashchange','popstate']){
  const p=load({otherScreen:true});
  await p.click(p.button('data-wn-report',{wnReport:'top'}));
  const dlg=p.made.at(-1);assert.equal(dlg.open,true);
  p.fire(type);
  assert.equal(dlg.open,false,type);assert.equal(dlg.removed,true);assert.equal(p.W._test.current(),null);
  assert.deepEqual(p.focused,['#main-content'],'no report button on the new screen, so the content takes the focus');
  p.fire(type);assert.deepEqual(p.focused,['#main-content'],'with no dialog open a change of screen does nothing');
 }
 // on the page itself the button still gets the focus back
 const q=load();await q.click(q.button('data-wn-report',{wnReport:'top'}));q.fire('popstate');assert.deepEqual(q.focused,['[data-wn-report="top"]']);
 assert.ok(fs.readFileSync(path.join(SITE,'app.js'),'utf8').includes('id="main-content" tabindex="-1"'),'the content can take the focus');
});

test('the stylesheet: 44px controls on a phone in the «Досье» look too, and a dot that reads on its dark bars in the light theme',()=>{
 const css=fs.readFileSync(path.join(SITE,'whats-new.css'),'utf8'),board=fs.readFileSync(path.join(SITE,'board.css'),'utf8');
 // The look sets 40px with this selector; ours has to carry one more class to win.
 assert.match(board,/html\.ui-native\.ui-board :is\(\.btn, [^)]*\) \{\s*min-height: 40px/);
 const phone=/@media \(max-width: 650px\) \{([^]*?)\n\}/.exec(css)[1];
 for(const sel of ['html.ui-native.ui-board .wn-report-card .btn','html.ui-native.ui-board .page-header [data-wn-report]','html.ui-native.ui-board .wn-actions .btn'])assert.ok(phone.includes(sel),sel);
 assert.match(phone,/\.wn-actions \.btn \{ min-height: 44px; \}/);
 assert.match(css,/html\.ui-native\.ui-board\.ui-light :is\(\.sidebar, \.bottom-nav\) \.wn-dot \{ background: #f2635a; \}/);
});
