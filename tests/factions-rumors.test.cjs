// Factions (GM list in gmExtras) and rumors (per campaign, GM-only truth flag, publish as news through the agent feed).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const eq=(a,b,m)=>assert.deepEqual(plain(a),plain(b),m);

function load({lang='ru',state,withAgent=true}={}){
 const st=state||{lang,campaigns:[{id:'k1',name:'Job <i>'}]},notices=[],actions=[];let saves=0;
 const node={dataset:{},isConnected:true,outerHTML:'',contains:()=>true};
 const document={querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}};
 const window={document,App:{getState:()=>st,save:()=>{saves++},render:()=>{},lang:()=>st.lang,notify:m=>notices.push(m),notifyAction:(m,label,run)=>{notices.push(m);actions.push({label,run})}}};
 const ctx={window,document,Math,Number,String,Array,Object,Set,Map,Infinity,JSON,Date,Promise,RegExp,TextEncoder};
 for(const f of ['gm-extras.js','clock-triggers.js','factions.js','rumors.js',...(withAgent?['room-agent.js']:[])])vm.runInNewContext(read(f),ctx,{filename:f});
 const root=(extra={})=>({dataset:{lang,...extra},isConnected:true,outerHTML:'',querySelector:()=>null,contains:()=>true});
 const ev=(type,ds,{value,root:r,extra}={})=>{const rt=r||root(extra);const t={dataset:ds,value,closest:s=>s.startsWith('[data-fc-root]')||s.startsWith('[data-ru-root]')?rt:(s.startsWith('[data-fc-action]')||s.startsWith('[data-ru-action]'))?t:null};return {type,target:t}};
 return {window,F:window.Factions,R:window.Rumors,GX:window.GMExtras,RA:window.RoomAgent,st,notices,actions,root,ev,saves:()=>saves};
}

// ---------- factions ----------
test('a faction is rebuilt from known fields; bad ones are dropped',()=>{
 const {F}=load();
 eq(F.clean({id:'a',name:'  Ржавые\n голуби ',type:'gang',attitude:2,note:'  секрет  ',clock:'c1',camp:'k1',evil:'<x>'}),{id:'a',name:'Ржавые голуби',type:'gang',attitude:2,note:'секрет',clock:'c1',camp:'k1'});
 eq(F.clean({id:'a'}),{id:'a',name:'',type:'other',attitude:0});
 eq(F.clean({id:'a',name:'x',type:'alien',attitude:9}),{id:'a',name:'x',type:'other',attitude:3});
 eq(F.clean({id:'a',name:'x',attitude:-9.4}),{id:'a',name:'x',type:'other',attitude:-3});
 eq(F.clean({id:'a',name:'x',attitude:'abc'}),{id:'a',name:'x',type:'other',attitude:0});
 eq(F.clean({id:'a',name:'x',clock:'<b>',camp:7}),{id:'a',name:'x',type:'other',attitude:0});
 for(const bad of [null,5,'x',[],{},{id:'<x>'},{id:'x'.repeat(41)},{id:7}])assert.equal(F.clean(bad),null);
 assert.equal(F.clean({id:'a',name:'x'.repeat(200)}).name.length,60);assert.equal(F.clean({id:'a',note:'y'.repeat(900)}).note.length,500);
 assert.equal(F.clean({id:'a',note:'a\n\n\n\n\nb'}).note,'a\n\nb');
});
test('read and write: cap 40, duplicates dropped, old saves load, an empty list leaves no field',()=>{
 const {F}=load();
 eq(F.read({}),[]);eq(F.read({gmExtras:[]}),[]);eq(F.read({gmExtras:{factions:'x'}}),[]);
 eq(F.read({gmExtras:{clocks:[],rollTables:[]}}),[],'a save from before the feature');
 const many={gmExtras:{factions:Array.from({length:60},(_,i)=>({id:'f'+i,name:'n'+i}))}};
 assert.equal(F.read(many).length,40);
 assert.equal(F.read({gmExtras:{factions:[{id:'a',name:'1'},{id:'a',name:'2'},null,{id:'b',name:'3'}]}}).length,2);
 const st={gmExtras:{clocks:[{id:'c',name:'k',size:6,filled:0}]}};
 F.write(st,[{id:'a',name:'A'}]);eq(st.gmExtras.factions,[{id:'a',name:'A',type:'other',attitude:0}]);eq(st.gmExtras.clocks.length,1,'neighbours stay');
 F.write(st,[]);assert.equal('factions' in st.gmExtras,false);
 const fresh={};F.write(fresh,[{id:'a'}]);assert.ok(fresh.gmExtras.factions);
 assert.equal(F.write(null,[]),false);
});
test('pure operations: add, update, remove, restore, shift',()=>{
 const {F}=load();
 const a=F.add([],{name:' Арасака ',type:'corp',attitude:-2},'f1');
 assert.equal(a.ok,true);eq(a.list,[{id:'f1',name:'Арасака',type:'corp',attitude:-2}]);
 assert.equal(F.add([],{name:'  '},'f1').reason,'empty');
 assert.equal(F.add(Array.from({length:40},(_,i)=>({id:'f'+i,name:'n',type:'gang',attitude:0})),{name:'x'}).reason,'full');
 const u=F.update(a.list,'f1',f=>({...f,attitude:5,note:'n'}));eq(u.list[0].attitude,3);assert.equal(u.list[0].note,'n');
 assert.equal(F.update(a.list,'zz',f=>f).ok,false);
 eq(F.shift({attitude:3},1).attitude,3);eq(F.shift({attitude:-3},-1).attitude,-3);eq(F.shift({attitude:0},-1).attitude,-1);
 const r=F.remove(a.list,'f1');assert.equal(r.ok,true);assert.equal(r.list.length,0);assert.equal(F.remove(a.list,'q').ok,false);
 const b=F.restore(r.list,r.entry,r.index);eq(b.list,a.list);assert.equal(F.restore(a.list,r.entry,0).ok,false,'not twice');
 const two=F.add(F.add([],{name:'1'},'x1').list,{name:'2'},'x2').list;
 eq(F.restore(F.remove(two,'x1').list,two[0],0).list.map(f=>f.id),['x1','x2'],'back where it was');
});
test('faction card: fields, labels in both languages, escaped, link to a clock',()=>{
 const t=load();
 t.GX.writeClocks(t.st,[{id:'c1',name:'Погоня',size:6,filled:2,shared:false},{id:'p1',name:'Пул',size:5,filled:2,shared:false,pool:{sides:6,face:1}}]);
 t.F.write(t.st,[{id:'f1',name:'<b>Банда</b>',type:'gang',attitude:-2,note:'<script>x</script>',clock:'c1',camp:'k1'},{id:'f2',name:'Пулы',type:'law',attitude:3,clock:'p1'}]);
 const html=t.F.render('ru');
 assert.ok(html.includes('data-fc-root')&&html.includes('ФРАКЦИИ'));
 assert.ok(!html.includes('<b>Банда</b>')&&!html.includes('<script>'));
 assert.ok(html.includes('−2')&&html.includes('Недруг')&&html.includes('+3')&&html.includes('Союзник'));
 assert.ok(html.includes('Часы «Погоня»: 2/6')&&html.includes('Часы «Пул»: 3/5'),'a pool shows the dice that are left');
 assert.ok(html.includes('data-fc-action="worse"')&&html.includes('aria-label="Хуже отношение"'));
 assert.ok(html.includes('2 из 40'));
 assert.ok(html.includes('Job &lt;i&gt;'),'campaign names are escaped');
 const en=t.F.render('en');assert.ok(en.includes('FACTIONS')&&en.includes('Hostile')&&en.includes('Ally')&&en.includes('Corporation'));
 const ids=[...html.matchAll(/data-fc-field="([a-z]+)"/g)].map(m=>m[1]);for(const f of ['name','type','note','clock','camp','draft','newtype'])assert.ok(ids.includes(f),f);
 const empty=load();assert.ok(empty.F.render('ru').includes('Фракций пока нет'));
 empty.F.write(empty.st,Array.from({length:40},(_,i)=>({id:'f'+i,name:'n'})));assert.ok(empty.F.render('en').includes('Limit reached')&&empty.F.render('en').includes('aria-disabled="true"'));
});
test('faction events: add, step attitude, edit, delete with undo, stale ids',()=>{
 const t=load();
 const root=t.root(),add=draft=>{root.querySelector=s=>s.includes('"draft"')?{value:draft}:s.includes('"newtype"')?{value:'media'}:null;return t.F.handle(t.ev('click',{fcAction:'add'},{root}),'ru')};
 assert.equal(add('  '),true);assert.match(t.notices.at(-1),/Введите название/);assert.equal(t.F.read(t.st).length,0);
 assert.equal(add('Вестник'),true);const f=t.F.read(t.st)[0];assert.equal(f.type,'media');assert.equal(f.attitude,0);assert.match(t.notices.at(-1),/Фракция «Вестник» добавлена/);
 t.F.handle(t.ev('click',{fcAction:'better',fcId:f.id},{root}),'ru');t.F.handle(t.ev('click',{fcAction:'better',fcId:f.id},{root}),'ru');
 assert.equal(t.F.read(t.st)[0].attitude,2);assert.match(t.notices.at(-1),/Вестник: \+2 Друг/);
 for(let i=0;i<9;i++)t.F.handle(t.ev('click',{fcAction:'worse',fcId:f.id},{root}),'ru');assert.equal(t.F.read(t.st)[0].attitude,-3);
 t.F.handle(t.ev('change',{fcField:'name',fcId:f.id},{root,value:'  Новый\nнейм '}),'ru');assert.equal(t.F.read(t.st)[0].name,'Новый нейм');
 t.F.handle(t.ev('change',{fcField:'type',fcId:f.id},{root,value:'fixer'}),'ru');assert.equal(t.F.read(t.st)[0].type,'fixer');
 t.F.handle(t.ev('change',{fcField:'type',fcId:f.id},{root,value:'nonsense'}),'ru');assert.equal(t.F.read(t.st)[0].type,'other');
 t.F.handle(t.ev('change',{fcField:'note',fcId:f.id},{root,value:'тайна'}),'ru');assert.equal(t.F.read(t.st)[0].note,'тайна');
 t.F.handle(t.ev('change',{fcField:'clock',fcId:f.id},{root,value:'c9'}),'ru');assert.equal(t.F.read(t.st)[0].clock,'c9');
 t.F.handle(t.ev('change',{fcField:'clock',fcId:f.id},{root,value:''}),'ru');assert.equal(t.F.read(t.st)[0].clock,undefined);
 // delete asks twice, then can be undone
 t.F.handle(t.ev('click',{fcAction:'del',fcId:f.id},{root}),'ru');assert.equal(t.F.read(t.st).length,1);
 t.F.handle(t.ev('click',{fcAction:'del',fcId:f.id},{root}),'ru');assert.equal(t.F.read(t.st).length,0);assert.equal(t.actions.at(-1).label,'Отменить');
 t.actions.at(-1).run();assert.equal(t.F.read(t.st).length,1);assert.match(t.notices.at(-1),/Фракция возвращена/);
 t.actions.at(-1).run();assert.equal(t.F.read(t.st).length,1,'a second undo does not duplicate');assert.match(t.notices.at(-1),/Вернуть не удалось/);
 // a press on a faction that is gone answers instead of failing
 t.F.handle(t.ev('click',{fcAction:'better',fcId:'zz'},{root}),'ru');assert.match(t.notices.at(-1),/уже нет/);
 t.F.handle(t.ev('change',{fcField:'note',fcId:'zz'},{root,value:'x'}),'ru');assert.match(t.notices.at(-1),/уже нет/);
 // a detached card ignores late events
 const dead=t.root();dead.isConnected=false;assert.equal(t.F.handle(t.ev('click',{fcAction:'add'},{root:dead}),'ru'),false);
 assert.ok(t.saves()>5);
});
test('factions are in the backup (gmExtras) and never in the room payload',()=>{
 const t=load();t.F.write(t.st,[{id:'f1',name:'Секретная',note:'тайна',attitude:1}]);
 t.GX.writeClocks(t.st,[{id:'c1',name:'K',size:6,filled:1,shared:true}]);
 assert.equal(JSON.stringify(t.GX.sharedClocks(t.st)).includes('Секретная'),false);
 assert.ok(JSON.stringify(t.st.gmExtras).includes('Секретная'),'it travels with the rest of gmExtras');
 const src=read('factions.js');assert.ok(!/RoomAgent|Room\.|send\(/.test(src.replace(/\/\*[\s\S]*?\*\//,'')));
});

// ---------- rumors ----------
test('a rumor is rebuilt from known fields; one without text is dropped',()=>{
 const {R}=load();
 eq(R.clean({id:'r1',text:'  Говорят,\n что...  ',truth:'false',where:'  бар\nу эстакады ',at:5,news:'a1',evil:'x'}),{id:'r1',text:'Говорят,\n что...',truth:'false',where:'бар у эстакады',at:5,news:'a1'});
 eq(R.clean({id:'r1',text:'x'}),{id:'r1',text:'x',truth:'true',at:0});
 eq(R.clean({id:'r1',text:'x',truth:'maybe',at:-4,news:'<b>'}),{id:'r1',text:'x',truth:'true',at:0});
 for(const bad of [null,5,[],{},{id:'r1'},{id:'r1',text:'  '},{id:'<x>',text:'x'},{text:'x'}])assert.equal(R.clean(bad),null);
 assert.equal(R.clean({id:'r1',text:'x'.repeat(900)}).text.length,300);assert.equal(R.clean({id:'r1',text:'x',where:'w'.repeat(300)}).where.length,80);
});
test('rumors of a campaign: add, edit, remove, restore, cap 60, no field when empty',()=>{
 const {R}=load(),c={id:'k1',name:'K'};
 eq(R.read({}),[]);eq(R.read({rumors:'x'}),[]);eq(R.read(c),[]);
 assert.equal(R.add(c,{text:'  '}).reason,'empty');assert.equal('rumors' in c,false);
 const a=R.add(c,{text:'Первый',truth:'part',where:'порт'},10),b=R.add(c,{text:'Второй',truth:'nonsense'},20);
 assert.equal(a.ok&&b.ok,true);eq(R.read(c).map(r=>r.text),['Второй','Первый'],'newest first');assert.equal(R.read(c)[0].truth,'true');
 assert.equal(R.update(c,a.id,{truth:'false'}).ok,true);assert.equal(R.read(c).find(r=>r.id===a.id).truth,'false');
 assert.equal(R.update(c,a.id,{truth:'bogus'}).ok,true);assert.equal(R.read(c).find(r=>r.id===a.id).truth,'false');
 assert.equal(R.update(c,a.id,{text:' '}).reason,'empty');assert.equal(R.update(c,'zz',{text:'x'}).reason,'missing');
 R.update(c,a.id,{where:''});assert.equal(R.read(c).find(r=>r.id===a.id).where,undefined);
 const rem=R.remove(c,a.id);assert.equal(rem.ok,true);assert.equal(R.read(c).length,1);
 assert.equal(R.restore(c,rem.entry,rem.index).ok,true);assert.equal(R.read(c).length,2);assert.equal(R.restore(c,rem.entry,0).ok,false);
 R.remove(c,a.id);R.remove(c,b.id);assert.equal('rumors' in c,false,'an emptied list leaves no field');
 const big={id:'k',rumors:Array.from({length:70},(_,i)=>({id:'r'+i,text:'t'+i}))};assert.equal(R.read(big).length,60);
 for(let i=0;i<60;i++)R.add(big,{text:'n'},i);assert.equal(R.add(big,{text:'one more'}).reason,'full');
 assert.equal(R.add(null,{text:'x'}).ok,false);
 const ids=new Set();for(let i=0;i<30;i++){const k={id:'q'};ids.add(R.add(k,{text:'x'}).id)}assert.equal(ids.size,30);
});
test('title of the news entry: first sentence or line, never longer than the feed allows',()=>{
 const {R}=load();
 assert.equal(R.titleOf('Говорят, в порту пропал контейнер. Никто ничего не видел.'),'Говорят, в порту пропал контейнер.');
 assert.equal(R.titleOf('Короткий слух без точки'),'Короткий слух без точки');
 assert.equal(R.titleOf('Первая строка\nВторая'),'Первая строка');
 assert.equal(R.titleOf('Да. Нет.'),'Да. Нет.');
 assert.ok(R.titleOf('слово '.repeat(60)).length<=80);
});
test('publish as news: the text goes to the feed and is published; truth and place stay',()=>{
 const t=load(),c=t.st.campaigns[0];
 const a=t.R.add(c,{text:'В порту пропал контейнер. Никто не видел.',truth:'false',where:'бар у эстакады'});
 const r=t.R.publishAsNews(c,a.id);assert.equal(r.ok,true);
 const feed=t.RA.read(c);assert.equal(feed.length,1);
 assert.equal(feed[0].kind,'news');assert.equal(feed[0].pub,true);assert.equal(feed[0].title,'В порту пропал контейнер.');assert.equal(feed[0].text,'В порту пропал контейнер. Никто не видел.');
 const sent=JSON.stringify(t.RA.payload(c).data);
 assert.ok(sent.includes('контейнер'));assert.ok(!sent.includes('эстакады')&&!sent.includes('false')&&!sent.includes('truth'),'only the text reaches the room: '+sent);
 assert.equal(t.R.read(c)[0].news,feed[0].id);
 assert.equal(t.R.publishAsNews(c,a.id).reason,'already','twice is refused');assert.equal(t.RA.read(c).length,1);
 // hidden from players, then published again
 t.RA.setPublished(c,feed[0].id,false);assert.equal(t.R.publishAsNews(c,a.id).ok,true);assert.equal(t.RA.read(c).length,1,'the hidden entry is shown again, no copy');assert.equal(t.RA.read(c)[0].pub,true);assert.equal(t.R.read(c)[0].news,feed[0].id);
 assert.equal(t.R.publishAsNews(c,'zz').reason,'missing');
 assert.equal(t.R.publishAsNews(null,'x').reason,'missing');
});
test('publish as news: full feeds and a page without the feed are told apart, and nothing is left behind',()=>{
 const t=load(),c=t.st.campaigns[0];
 const a=t.R.add(c,{text:'Слух'});
 c.agentFeed=Array.from({length:60},(_,i)=>({id:'e'+i,kind:'news',title:'T'+i,text:''}));
 assert.equal(t.R.publishAsNews(c,a.id).reason,'feedfull');assert.equal(t.RA.read(c).length,60);
 c.agentFeed=Array.from({length:30},(_,i)=>({id:'e'+i,kind:'news',title:'T'+i,text:'',pub:true,pubAt:i+1}));
 assert.equal(t.R.publishAsNews(c,a.id).reason,'pubfull');assert.equal(t.RA.read(c).length,30,'the draft made for it is taken back');assert.equal(t.R.read(c)[0].news,undefined);
 assert.equal(t.R.publishAsNews(c,a.id,null).reason,'noagent');
 const lone=load({withAgent:false}),k=lone.st.campaigns[0],b=lone.R.add(k,{text:'x'});
 assert.equal(lone.R.publishAsNews(k,b.id).reason,'noagent');
});
test('rumor cards: GM-only note, truth as a word, escaped, picker only with several campaigns',()=>{
 const t=load();
 const c=t.st.campaigns[0];t.R.add(c,{text:'<b>Слух</b>',truth:'part',where:'<i>бар</i>'});
 let html=t.R.render('ru');
 assert.ok(html.includes('СЛУХИ')&&html.includes('data-ru-root')&&html.includes('data-ru-camp="k1"'));
 assert.ok(!html.includes('<b>Слух</b>')&&!html.includes('<i>бар</i>'));
 assert.ok(html.includes('Отчасти')&&html.includes('Опубликовать как новость')&&html.includes('ru-chip'));
 assert.ok(!html.includes('data-ru-field="camp"'),'one campaign, no picker');
 t.st.campaigns.push({id:'k2',name:'Второй'});html=t.R.render('en');
 assert.ok(html.includes('data-ru-field="camp"')&&html.includes('RUMORS')&&html.includes('Publish as news')&&html.includes('Partly'));
 assert.ok(t.R.card(c,'en').includes('data-ru-card="1"')&&!t.R.card(c,'en').includes('data-ru-field="camp"'));
 assert.equal(t.R.card(null,'ru'),'');
 const none=load({state:{lang:'ru',campaigns:[]}});assert.ok(none.R.render('ru').includes('создайте кампанию'));
 const pub=load(),pc=pub.st.campaigns[0],x=pub.R.add(pc,{text:'Что-то. Ещё'});pub.R.publishAsNews(pc,x.id);
 assert.ok(pub.R.render('ru').includes('Опубликовано как новость')&&pub.R.render('ru').includes('aria-disabled="true"'));
});
test('rumor events: add, edit, publish, delete with undo, stale ids, the other campaign',()=>{
 const t=load({state:{lang:'ru',campaigns:[{id:'k1',name:'A'},{id:'k2',name:'B'}]}});
 const k1=t.st.campaigns[0],k2=t.st.campaigns[1];
 const root=t.root({ruCamp:'k1'});
 const form=(text,truth='false',where='порт')=>{root.querySelector=s=>s.includes('"draft"')?{value:text}:s.includes('"newtruth"')?{value:truth}:s.includes('"newwhere"')?{value:where}:null};
 const go=(type,ds,value)=>t.R.handle(t.ev(type,ds,{root,value}),'ru');
 form(' ');go('click',{ruAction:'add'});assert.match(t.notices.at(-1),/Введите текст слуха/);assert.equal(t.R.read(k1).length,0);
 form('Слух один','false','порт');go('click',{ruAction:'add'});
 const r=t.R.read(k1)[0];assert.equal(r.text,'Слух один');assert.equal(r.truth,'false');assert.equal(r.where,'порт');assert.equal(t.R.read(k2).length,0,'the other campaign is untouched');
 go('change',{ruField:'text',ruId:r.id},'Слух. Один отредактированный');assert.equal(t.R.read(k1)[0].text,'Слух. Один отредактированный');
 go('change',{ruField:'truth',ruId:r.id},'true');assert.equal(t.R.read(k1)[0].truth,'true');
 go('change',{ruField:'where',ruId:r.id},'клиника');assert.equal(t.R.read(k1)[0].where,'клиника');
 go('change',{ruField:'text',ruId:r.id},'   ');assert.match(t.notices.at(-1),/Введите текст слуха/);assert.equal(t.R.read(k1)[0].text,'Слух. Один отредактированный');
 go('click',{ruAction:'news',ruId:r.id});assert.match(t.notices.at(-1),/опубликован как новость\. Правдивость игрокам не видна/);assert.equal(t.RA.read(k1)[0].title,'Слух. Один отредактированный');
 go('click',{ruAction:'news',ruId:r.id});assert.match(t.notices.at(-1),/уже опубликован/);
 go('click',{ruAction:'del',ruId:r.id});assert.equal(t.R.read(k1).length,1);go('click',{ruAction:'del',ruId:r.id});assert.equal(t.R.read(k1).length,0);
 t.actions.at(-1).run();assert.equal(t.R.read(k1).length,1);assert.equal(t.R.read(k1)[0].news!==undefined,true,'the link to the news stays');
 t.actions.at(-1).run();assert.match(t.notices.at(-1),/Вернуть не удалось/);assert.equal(t.R.read(k1).length,1);
 go('click',{ruAction:'news',ruId:'zz'});assert.match(t.notices.at(-1),/уже нет/);
 go('change',{ruField:'truth',ruId:'zz'},'false');assert.match(t.notices.at(-1),/уже нет/);
 // the picker changes the campaign shown; a campaign that is gone is not acted on
 const pick=t.R.handle(t.ev('change',{ruField:'camp'},{root,value:'k2'}),'ru');assert.equal(pick,true);assert.equal(t.R._test.ui().camp,'k2');
 t.st.campaigns.length=0;assert.equal(t.R.act('add',{dataset:{}},t.root({ruCamp:'k1'}),'ru'),false);
 // the English notices
 const en=load({lang:'en'}),er=en.root({ruCamp:'k1'});er.querySelector=s=>s.includes('"draft"')?{value:'Hello'}:s.includes('"newtruth"')?{value:'part'}:null;
 en.R.handle(en.ev('click',{ruAction:'add'},{root:er}),'en');assert.match(en.notices.at(-1),/Rumor added/);
});
test('rumors are GM-only: nothing of them is in a room payload, they are in the campaign and its file',()=>{
 const t=load(),c=t.st.campaigns[0];t.R.add(c,{text:'Тайный слух',truth:'false'});
 assert.ok(!JSON.stringify(t.RA.payload(c)).includes('Тайный слух'),'not published unless the GM publishes it');
 assert.ok(JSON.stringify(c).includes('Тайный слух'),'saved on the campaign, so it is in backups');
 const src=read('rumors.js').replace(/\/\*[\s\S]*?\*\//,'');assert.ok(!/Room\.send|publishState|\.send\(/.test(src));
});
test('the two languages have the same texts (factions, rumors)',()=>{
 for(const M of ['Factions','Rumors']){
  const t=load(),T=t[M==='Factions'?'F':'R'].T;
  const walk=(a,b,p='')=>{eq(Object.keys(a).sort(),Object.keys(b).sort(),p);for(const k of Object.keys(a))if(a[k]&&typeof a[k]==='object')walk(a[k],b[k],p+k+'.');else assert.equal(typeof a[k],typeof b[k],p+k)};
  walk(T.ru,T.en);
  for(const k of Object.keys(T.ru))if(typeof T.ru[k]==='string')assert.ok(T.ru[k]&&T.en[k],k);
 }
});
