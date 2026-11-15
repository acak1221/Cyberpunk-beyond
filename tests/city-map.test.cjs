// The city map of a campaign: pins, a route and the crew mark live in the campaign and are rebuilt on every read;
// the picture lives only in this browser and never gets into the campaign.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const eq=(a,b)=>assert.deepEqual(plain(a),plain(b));
const settle=(ms=15)=>new Promise(ok=>setTimeout(ok,ms));
const PIC={v:1,w:4,h:2,src:'data:image/png;base64,iVBORw0KGgo=',at:1};
// The browser's picture storage, as the module sees it. `fail` is a browser that refuses (private mode).
function fakeStore({fail=false}={}){
 const m=new Map();
 return {m,get:async k=>{if(fail)throw Error('refused');return m.get(k)},put:async(k,v)=>{if(fail)throw Error('refused');m.set(k,plain(v))},del:async k=>{m.delete(k)},keys:async()=>[...m.keys()]};
}
// One page: the module alone, an app stub with a state, and a notice with an action button whose action a test can press.
function load({confirm=()=>true,store=fakeStore(),files=['city-map.js']}={}){
 const notices=[],actions=[];let saves=0,renders=0;const st={lang:'ru',characters:[],campaigns:[]};
 const window={confirm};
 const ctx={window,TextEncoder,Date,Math,JSON,Number,String,Array,Object,Map,Set,Promise,Error,Uint8Array,RegExp,setTimeout,clearTimeout,console,crypto:globalThis.crypto};
 for(const f of files)vm.runInNewContext(read(f),ctx,{filename:f});
 window.App={getState:()=>st,lang:()=>st.lang,save:()=>{saves++},render:()=>{renders++},notify:m=>notices.push(m),notifyAction:(m,label,run)=>actions.push({m,label,run})};
 window.CityMap._test.setStore(store);
 return {window,C:window.CityMap,st,notices,actions,store,saves:()=>saves,renders:()=>renders};
}
const W=load(),C=W.C;
let seq=0;
const camp=(cityMap)=>({id:'k'+(++seq),name:'Job',notes:'',round:1,turnIndex:0,roster:[],...(cityMap?{cityMap}:{})});
const pin=(id,t,x,y,name,more={})=>({id,t,x,y,name,...more});
const three=()=>({v:1,ratio:1.5,pins:[pin('a','bar',100,200,'Бар'),pin('b','clinic',500,500,'Клиника',{note:'Врач берёт дорого',shown:true}),pin('c','gang',900,800,'Стая')],route:['a','b'],crew:'b'});
// A stand-in for the map page: closest() answers by selector, the body records what is drawn into it.
function scene(campaign,{page=W,lang='ru'}={}){
 const body={innerHTML:''},root={querySelector:s=>s==='[data-cm-body]'?body:null,contains:()=>false};
 const ctx={lang,characters:[],notify:m=>page.notices.push(m)};
 const el=(data,sel,more={})=>({dataset:data,closest:s=>s==='[data-cm-root]'?root:s===sel?{dataset:data,...more}:null,...more});
 const fire=(type,target,extra={})=>page.C.handle({type,target,...extra},campaign,ctx);
 return {body,root,
  act:(a,value)=>fire('click',el({cmAct:a,...(value!==undefined?{cmValue:value}:{})},'[data-cm-act]')),
  pin:id=>fire('click',el({cmPin:id},'[data-cm-pin]')),
  row:id=>fire('click',el({cmRow:id},'[data-cm-row]')),
  stage:(clientX,clientY,rect={left:100,top:50,width:800,height:400})=>fire('click',el({},'[data-cm-stage]',{getBoundingClientRect:()=>rect}),{clientX,clientY}),
  input:(field,value)=>fire('input',{...el({cmField:field},null),value}),
  // The field itself is the target, so a test sees what the page wrote back into it.
  change:(data,more={})=>fire('change',Object.assign(more,el(data,null))),
  view:()=>page.C._view(campaign)};
}

test('a saved map is rebuilt: only known fields, checked numbers, clipped text',()=>{
 for(const bad of [undefined,null,7,'x',[],{},{v:2,pins:[]},{v:'1'}])assert.equal(C.clean(bad),null);
 eq(C.clean({v:1}),{v:1,ratio:1.5,pins:[]});
 const raw={v:1,ratio:9,src:'data:image/png;base64,AAAA',picture:{src:'data:image/png;base64,AAAA'},extra:1,
  pins:[pin('a','bar',0,1000,'  Бар\u0000 <b>\n«Тихий час»  ',{note:'  строка 1\r\nстрока 2\u0007 ',shown:true,src:'data:image/png;base64,AAAA',html:'<script>'}),
   pin('a','bar',1,1,'дубль'),pin('bad id','bar',1,1,'x'),pin('','bar',1,1,'x'),pin('t','castle',1,1,'x'),pin('x1','bar',1.5,1,'x'),pin('x2','bar',-1,1,'x'),pin('x3','bar',1,1001,'x'),pin('x4','bar','1',1,'x'),
   pin('e','gang',5,5,'   '),pin('n','gang',5,5,7),null,'x',[1],pin('long','job',10,10,'Я'.repeat(200),{note:'н'.repeat(900),shown:'yes'})],
  route:['a','a','ghost',5,'long','a'],crew:'ghost',crewShown:true};
 const m=C.clean(raw);
 eq(m,{v:1,ratio:2,pins:[{id:'a',t:'bar',x:0,y:1000,name:'Бар <b> «Тихий час»',note:'  строка 1\nстрока 2 ',shown:true},{id:'long',t:'job',x:10,y:10,name:'Я'.repeat(60),note:'н'.repeat(300)}],route:['a','long','a'],crewShown:true});
 assert.equal(JSON.stringify(m).includes('data:'),false,'nothing of a picture survives inside the campaign field');
 assert.equal(C.clean({v:1,ratio:.1}).ratio,.5);assert.equal(C.clean({v:1,ratio:'2'}).ratio,1.5);assert.equal(C.clean({v:1,ratio:1.23456}).ratio,1.235);assert.equal(C.clean({v:1,ratio:NaN}).ratio,1.5);
 const many=C.clean({v:1,pins:Array.from({length:200},(_,i)=>pin('p'+i,'other',i,i,'M'+i,{shown:true})),route:Array.from({length:60},(_,i)=>'p'+i)});
 assert.equal(many.pins.length,C.MAX_PINS);assert.equal(many.pins.filter(p=>p.shown).length,C.MAX_SHARED);assert.equal(many.route.length,C.MAX_ROUTE);
 eq(C.clean({v:1,pins:[pin('a','bar',1,1,'A')],crew:'a'}),{v:1,ratio:1.5,pins:[{id:'a',t:'bar',x:1,y:1,name:'A'}],crew:'a'});
 // Characters that turn the direction of text around do not get into a name.
 assert.equal(C.clean({v:1,pins:[pin('a','bar',1,1,'safe\u202egnp.exe')]}).pins[0].name,'safe gnp.exe');
});

test('old data: a campaign without a map is not touched, a foreign value is shown as a notice and never rewritten',()=>{
 const c=camp(),before=JSON.stringify(c);
 assert.equal(C.read(c),null);assert.equal(C.foreign(c),false);
 assert.match(C.card(c,'ru'),/Карты города пока нет/);assert.match(C.card(c,'ru'),/data-cm-act="open"/);
 const html=C.page(c,[],'ru');
 assert.match(html,/^<div class="cm-page" data-cm-root data-cm-page="k\d+">/);assert.match(html,/<h1>Карта города<\/h1>/);
 assert.match(html,/cm-stage cm-grid/);assert.match(html,/Меток пока нет/);assert.equal(html.includes('<img'),false);
 assert.equal(JSON.stringify(c),before,'drawing does not create the field');
 for(const odd of [{v:2,pins:[{id:'z'}]},'text',[1,2]]){
  const f=camp(odd),was=JSON.stringify(f),s=scene(f);
  assert.equal(C.foreign(f),true);assert.match(C.page(f,[],'ru'),/неизвестном формате/);assert.match(C.page(f,[],'en'),/unknown format/);assert.match(C.card(f,'ru'),/неизвестном формате/);
  assert.equal(C.page(f,[],'ru').includes('data-cm-stage'),false);
  for(const r of [s.act('add-centre'),s.act('mode','add'),s.stage(500,250),s.change({cmField:'crewShown'},{checked:true}),s.change({cmDrop:''},{value:'z|1,1'})])assert.equal(r.dirty,false);
  assert.equal(JSON.stringify(f),was);
 }
 assert.equal(C.card(null,'ru'),'');assert.equal(C.page(null,[],'ru'),'');
});

test('pins: add, change, move within the stage, delete with its route stops and the crew mark, and take the deletion back',()=>{
 const m=C.blank(),a=C.addPin(m,{t:'bar',x:-50,y:1500.4,name:' Бар '}),b=C.addPin(m,{t:'nope',x:499.6,y:10,name:'Б'});
 eq([a.x,a.y,a.name,a.t,b.x,b.t],[0,1000,'Бар','bar',500,'other']);assert.match(a.id,/^[A-Za-z0-9_-]{1,40}$/);assert.notEqual(a.id,b.id);
 assert.equal(C.addPin(m,{t:'bar',x:1,y:1,name:'  '}),null);
 assert.equal(C.updatePin(m,a.id,{name:'Новый',t:'clinic',note:'текст'}),true);eq(m.pins[0],{id:a.id,t:'clinic',x:0,y:1000,name:'Новый',note:'текст'});
 assert.equal(C.updatePin(m,a.id,{name:''}),false);assert.equal(C.updatePin(m,a.id,{t:'castle'}),false);assert.equal(C.updatePin(m,'ghost',{name:'x'}),false);
 C.updatePin(m,a.id,{note:'   '});assert.equal('note' in m.pins[0],false);
 assert.equal(C.movePin(m,a.id,2000,-3),true);eq([m.pins[0].x,m.pins[0].y],[1000,0]);assert.equal(C.movePin(m,'ghost',1,1),false);
 const full=C.blank();for(let i=0;i<C.MAX_PINS;i++)assert.ok(C.addPin(full,{t:'bar',x:i,y:i,name:'n'+i}));
 assert.equal(C.addPin(full,{t:'bar',x:1,y:1,name:'too many'}),null);
 const map=C.clean(three());map.route=['a','b','c','b'];
 const snap=C.removePin(map,'b');
 eq(map,{v:1,ratio:1.5,pins:[three().pins[0],three().pins[2]],route:['a','c']});assert.equal(C.removePin(map,'b'),null);
 assert.equal(C.restorePin(map,snap),true);
 eq(map,{...three(),route:['a','b','c','b']});assert.equal(C.restorePin(map,snap),false,'a pin is not put back twice');
});

test('route, crew mark and the limit of pins shown to players',()=>{
 const map=C.clean(three());delete map.route;
 eq(C.toggleRoute(map,'a'),{ok:true,added:true,stops:1});eq(C.toggleRoute(map,'c'),{ok:true,added:true,stops:2});eq(C.toggleRoute(map,'a'),{ok:true,added:true,stops:3});
 eq(map.route,['a','c','a']);eq(C.toggleRoute(map,'a'),{ok:true,added:false,stops:2});eq(map.route,['a','c']);
 assert.equal(C.toggleRoute(map,'ghost').reason,'missing');
 const long=C.clean({v:1,pins:[pin('a','bar',1,1,'A'),pin('b','bar',2,2,'B')]});
 for(let i=0;i<C.MAX_ROUTE;i++)assert.equal(C.toggleRoute(long,i%2?'b':'a').ok,true);
 assert.equal(C.toggleRoute(long,'a').reason,'full');assert.equal(long.route.length,C.MAX_ROUTE);
 eq(C.clearRoute(map),['a','c']);assert.equal('route' in map,false);eq(C.clearRoute(map),[]);
 assert.equal(C.setCrew(map,'c'),true);assert.equal(map.crew,'c');assert.equal(C.setCrew(map,'ghost'),false);assert.equal(C.setCrew(map,null),true);assert.equal('crew' in map,false);
 const big=C.clean({v:1,pins:Array.from({length:45},(_,i)=>pin('p'+i,'bar',i,i,'P'+i))});
 for(let i=0;i<C.MAX_SHARED;i++)eq(C.setShown(big,'p'+i,true),{ok:true,count:i+1});
 eq(C.setShown(big,'p40',true),{ok:false,reason:'full'});eq(C.setShown(big,'p0',true),{ok:true,count:40});
 eq(C.setShown(big,'p0',false),{ok:true,count:39});assert.equal('shown' in big.pins[0],false);eq(C.setShown(big,'p40',true),{ok:true,count:40});
 assert.equal(C.setShown(big,'ghost',true).reason,'missing');
});

test('the filter by type hides other pins on the stage and in the list, and the route stays',()=>{
 const map=C.clean(three());
 eq(C.typesUsed(map),[['bar',1],['clinic',1],['gang',1]]);
 eq(C.filterPins(map,new Set()).map(p=>p.id),['a','b','c']);eq(C.filterPins(map,new Set(['gang','bar'])).map(p=>p.id),['a','c']);eq(C.filterPins(map,null).length,3);
 const c=camp(three()),s=scene(c);
 s.act('filter','gang');
 const html=s.body.innerHTML;
 assert.equal((html.match(/data-cm-pin="/g)||[]).length,1);assert.match(html,/data-cm-pin="c"/);
 assert.equal((html.match(/data-cm-row="/g)||[]).length,1);assert.match(html,/<polyline points="100,200 500,500"/);assert.match(html,/Маршрут: Бар → Клиника \(остановок: 2\)/);
 assert.match(html,/data-cm-value="gang" aria-pressed="true"/);assert.match(html,/data-cm-value="" aria-pressed="false"/);
 s.act('filter','bar');assert.equal((s.body.innerHTML.match(/data-cm-pin="/g)||[]).length,2);
 s.act('filter','');assert.equal((s.body.innerHTML.match(/data-cm-pin="/g)||[]).length,3);
 // A pin that the filter hides is not left selected behind it.
 s.pin('a');assert.equal(s.view().sel,'a');s.act('filter','gang');assert.equal(s.view().sel,null);
});

test('user text is only ever shown escaped, also inside attributes',()=>{
 const evil='<img src=x onerror=alert(1)>"\'&',c=camp({v:1,ratio:1.5,pins:[pin('a','bar',1,1,evil,{note:'</textarea><script>x</script>',shown:true})],route:['a'],crew:'a'});
 c.name='<b>Кампания</b>';
 const s=scene(c);s.pin('a');
 for(const html of [C.page(c,[],'ru'),s.body.innerHTML,C.card(c,'ru')]){
  assert.equal(/<img src=x|<script>|<b>Кампания/.test(html),false);
  assert.equal(html.includes('onerror=alert(1)>"'),false);
 }
 assert.match(s.body.innerHTML,/aria-label="Бар: &lt;img src=x onerror=alert\(1\)&gt;&quot;&#39;&amp;, группа здесь, видна игрокам, остановка 1"/);
 assert.match(s.body.innerHTML,/value="&lt;img src=x onerror=alert\(1\)&gt;&quot;&#39;&amp;"/);assert.match(s.body.innerHTML,/&lt;\/textarea&gt;&lt;script&gt;/);
 // Positions in the markup are numbers made from checked whole numbers.
 assert.match(s.body.innerHTML,/style="--x:0\.1%;--y:0\.1%"/);
});

test('both languages have every string; the English page has no Russian in it; Russian is formal',()=>{
 const T=C._test.T,keys=o=>Object.keys(o).sort();
 eq(keys(T.ru),keys(T.en));eq(keys(T.ru.types),keys(T.en.types));eq(keys(T.ru.types),[...C.TYPES].sort());eq(keys(C.GLYPH),[...C.TYPES].sort());
 assert.equal(new Set(Object.values(C.GLYPH)).size,C.TYPES.length,'every type has a sign of its own');
 const said=o=>Object.values(o).flatMap(v=>typeof v==='function'?[String(v('N','M'))]:typeof v==='string'?[v]:said(v));
 for(const k of keys(T.ru))assert.equal(typeof T.ru[k],typeof T.en[k],k);
 for(const s of said(T.en))assert.equal(/[А-Яа-яЁё]/.test(s),false,s);
 for(const s of said(T.ru))assert.equal(/(^|[^а-яё])(ты|тебя|тебе|тобой|твой|твоя|твоё|твои|твоего|нажми|выбери|открой|загрузи)([^а-яё]|$)/i.test(s),false,s);
 const c=camp(three());c.name='Job';c.cityMap.pins.forEach((p,i)=>{p.name='Pin '+i;delete p.note});
 const s=scene(c,{lang:'en'});s.pin('b');
 for(const html of [C.page(c,[],'en'),s.body.innerHTML,C.card(c,'en')])assert.equal(/[А-Яа-яЁё]/.test(html),false);
 assert.match(C.page(c,[],'en'),/<h1>City map<\/h1>/);
});

test('the page: opening and closing ask for a redraw of the whole page; modes, zoom and labels only redraw the map',()=>{
 const P=load(),c=camp(three()),s=scene(c,{page:P});P.st.campaigns.push(c);
 assert.equal(P.C.isOpen(c.id),false);
 eq(s.act('open'),{handled:true,dirty:false,rerender:true});assert.equal(P.C.isOpen(c.id),true);assert.equal(P.C.isOpen('other'),false);
 eq(s.act('mode','route'),{handled:true,dirty:false});assert.match(s.body.innerHTML,/data-cm-mode="route"/);assert.match(s.body.innerHTML,/data-cm-value="route" aria-pressed="true"/);
 s.act('mode','nonsense');assert.equal(s.view().mode,'select');
 s.act('zoom-in');s.act('zoom-in');s.act('zoom-in');assert.equal(s.view().zoom,3);assert.match(s.body.innerHTML,/aspect-ratio:1\.5;width:300%/);assert.match(s.body.innerHTML,/data-cm-act="zoom-in"[^>]* disabled/);
 s.act('zoom-out');assert.equal(s.view().zoom,2);
 assert.match(s.body.innerHTML,/class="cm-pin-name"/);s.act('labels');assert.equal(s.body.innerHTML.includes('class="cm-pin-name"'),false);
 eq(s.act('close'),{handled:true,dirty:false,rerender:true});assert.equal(P.C.isOpen(c.id),false);
 assert.equal(P.saves(),0);
 eq(P.C.handle({type:'click',target:{closest:()=>null}},c,{}),{handled:false,dirty:false});
});

test('placing: a tap on the stage puts a pin at that share of the stage; «Метку в центр» works without a pointer',()=>{
 const c=camp(),s=scene(c);
 assert.equal(s.stage(500,250).dirty,false,'a tap in «Выбор» places nothing');assert.equal(c.cityMap,undefined);
 s.act('mode','add');s.change({cmNewtype:''},{value:'fixer'});
 eq(s.stage(300,150),{handled:true,dirty:true});
 eq(c.cityMap.pins.map(p=>[p.t,p.x,p.y,p.name]),[['fixer',250,250,'Метка 1']]);
 assert.equal(s.view().mode,'select');assert.equal(s.view().sel,c.cityMap.pins[0].id);
 assert.match(s.body.innerHTML,/data-cm-field="name"[^>]*value="Метка 1"/);assert.match(s.body.innerHTML,/role="status" aria-live="polite" data-cm-say>Метка «Метка 1» поставлена\.</);
 s.act('mode','add');s.stage(5000,-90);eq([c.cityMap.pins[1].x,c.cityMap.pins[1].y],[1000,0]);
 s.act('mode','add');assert.equal(s.stage(300,150,{left:0,top:0,width:0,height:0}).dirty,false);assert.equal(s.stage(NaN,1).dirty,false);
 s.act('mode','select');
 assert.equal(s.act('add-centre').dirty,true);assert.equal(s.act('add-centre').dirty,true);
 eq(c.cityMap.pins.slice(2).map(p=>[p.x,p.y]),[[500,500],[530,530]]);
 const full=camp({v:1,ratio:1.5,pins:Array.from({length:C.MAX_PINS},(_,i)=>pin('p'+i,'bar',i,i,'P'+i))}),f=scene(full),n=W.notices.length;
 assert.equal(f.act('add-centre').dirty,false);assert.match(W.notices[n],/не больше 80 меток/);assert.equal(full.cityMap.pins.length,C.MAX_PINS);
});

test('editing: text is saved as it is typed without a redraw; type, «показать игрокам» and the crew mark redraw the map',()=>{
 const c=camp(three()),s=scene(c);
 assert.equal(s.input('name','x').dirty,false,'nothing is selected');
 s.row('a');assert.equal(s.view().sel,'a');const drawn=s.body.innerHTML;
 eq(s.input('name','  Бар «Афтерлайф» '),{handled:true,dirty:true});assert.equal(c.cityMap.pins[0].name,'Бар «Афтерлайф»');assert.equal(s.body.innerHTML,drawn,'the field being typed in is not replaced');
 assert.equal(s.input('name','   ').dirty,false);assert.equal(c.cityMap.pins[0].name,'Бар «Афтерлайф»','an empty name is not saved');
 const field={value:'  '};s.change({cmField:'name'},field);assert.equal(field.value,'Бар «Афтерлайф»','leaving the field empty brings the name back');
 eq(s.input('note','Хозяин должен денег\nВход со двора'),{handled:true,dirty:true});assert.equal(c.cityMap.pins[0].note,'Хозяин должен денег\nВход со двора');
 s.input('note','');assert.equal('note' in c.cityMap.pins[0],false);
 assert.equal(s.input('shown','x').dirty,false);assert.equal(s.input('t','gang').dirty,false,'only text arrives as it is typed');
 eq(s.change({cmField:'t'},{value:'job'}),{handled:true,dirty:true});assert.equal(c.cityMap.pins[0].t,'job');
 assert.equal(s.change({cmField:'t'},{value:'castle'}).dirty,false);
 assert.equal(s.change({cmField:'shown'},{checked:true}).dirty,true);assert.equal(c.cityMap.pins[0].shown,true);
 assert.equal(s.change({cmField:'shown'},{checked:false}).dirty,true);assert.equal('shown' in c.cityMap.pins[0],false);
 assert.equal(s.act('crew').dirty,true);assert.equal(c.cityMap.crew,'a');assert.match(s.body.innerHTML,/Группа отмечена на метке «Бар «Афтерлайф»»/);assert.match(s.body.innerHTML,/Группа ушла отсюда/);
 assert.equal(s.act('crew').dirty,true);assert.equal('crew' in c.cityMap,false);
 assert.equal(s.change({cmField:'crewShown'},{checked:true}).dirty,true);assert.equal(c.cityMap.crewShown,true);
 s.change({cmField:'crewShown'},{checked:false});assert.equal('crewShown' in c.cityMap,false);
 const big=camp({v:1,ratio:1.5,pins:Array.from({length:41},(_,i)=>pin('p'+i,'bar',i,i,'P'+i,i<40?{shown:true}:{}))}),b=scene(big),box={checked:true},n=W.notices.length;
 b.row('p40');assert.equal(b.change({cmField:'shown'},box).dirty,false);assert.equal(box.checked,false);assert.match(W.notices[n],/не больше 40 меток/);
});

test('moving: the drop field moves a pin, arrow keys step by 1% and with Shift by 5%, never past the edge',()=>{
 eq(C.nudge(500,500,'ArrowLeft',false),{x:490,y:500});eq(C.nudge(500,500,'ArrowDown',true),{x:500,y:550});eq(C.nudge(5,995,'ArrowLeft',false),{x:0,y:995});eq(C.nudge(990,30,'ArrowUp',true),{x:990,y:0});eq(C.nudge(990,30,'ArrowRight',true),{x:1000,y:30});
 assert.equal(C.nudge(1,1,'Enter',false),null);
 const c=camp(three()),s=scene(c),field={value:'c|120,340'};
 eq(s.change({cmDrop:''},field),{handled:true,dirty:true});assert.equal(field.value,'');eq([c.cityMap.pins[2].x,c.cityMap.pins[2].y],[120,340]);assert.equal(s.view().sel,'c');
 assert.match(s.body.innerHTML,/Метка «Стая» передвинута/);
 for(const bad of ['ghost|1,1','c|1','c|a,b','c|1,1;x','<b>|1,1',''])assert.equal(s.change({cmDrop:''},{value:bad}).dirty,false,bad);
 s.change({cmDrop:''},{value:'c|9999,0'});eq([c.cityMap.pins[2].x,c.cityMap.pins[2].y],[1000,0]);
 s.act('mode','route');assert.equal(s.change({cmDrop:''},{value:'c|1,1'}).dirty,false,'pins are not moved while a route is drawn');
});

test('route mode: taps add stops in order, a tap on the last stop removes it, clearing can be taken back',()=>{
 const P=load(),c=camp(three()),s=scene(c,{page:P});P.st.campaigns.push(c);delete c.cityMap.route;
 s.pin('c');assert.equal(s.view().sel,'c');assert.equal(c.cityMap.route,undefined,'a tap in «Выбор» only selects');
 s.act('mode','route');
 assert.equal(s.pin('a').dirty,true);assert.equal(s.pin('c').dirty,true);assert.equal(s.pin('b').dirty,true);eq(c.cityMap.route,['a','c','b']);
 assert.match(s.body.innerHTML,/«Клиника» — остановка 3/);assert.match(s.body.innerHTML,/<polyline points="100,200 900,800 500,500"/);assert.match(s.body.innerHTML,/Маршрут: Бар → Стая → Клиника \(остановок: 3\)/);
 s.pin('b');eq(c.cityMap.route,['a','c']);assert.match(s.body.innerHTML,/«Клиника» убрана из маршрута/);
 assert.equal(s.act('route-clear').dirty,true);assert.equal('route' in c.cityMap,false);assert.match(s.body.innerHTML,/Маршрут не проложен/);
 assert.equal(P.actions.length,1);assert.equal(P.actions[0].label,'Вернуть');
 P.actions[0].run();eq(c.cityMap.route,['a','c']);assert.equal(P.saves(),1);
 assert.equal(s.act('route-clear').dirty,true);assert.equal(s.act('route-clear').dirty,false,'there is nothing to clear twice');
});

test('deleting a pin is undone with one press: the pin, its route stops and the crew mark come back',()=>{
 const P=load(),c=camp(three()),s=scene(c,{page:P});P.st.campaigns.push(c);c.cityMap.route=['a','b','c'];
 assert.equal(s.act('pin-remove').dirty,false,'nothing is selected');
 s.pin('b');assert.equal(s.act('pin-remove').dirty,true);
 eq(c.cityMap,{v:1,ratio:1.5,pins:[three().pins[0],three().pins[2]],route:['a','c']});assert.equal(s.view().sel,null);
 assert.match(P.actions[0].m,/Метка «Клиника» удалена/);
 P.actions[0].run();eq(c.cityMap,{...three(),route:['a','b','c']});assert.equal(P.saves(),1);
 // The Delete key goes the same way, through the drop field.
 assert.equal(s.change({cmDrop:''},{value:'del|a'}).dirty,true);eq(c.cityMap.pins.map(p=>p.id),['b','c']);
 // An undo for a campaign that is gone does nothing.
 P.st.campaigns.length=0;P.actions[1].run();eq(c.cityMap.pins.map(p=>p.id),['b','c']);
});

test('the picture: sizes are brought down, only an inline raster image of a known size is accepted',()=>{
 eq(C.fit(4000,2000),{w:1600,h:800});eq(C.fit(900,3000),{w:480,h:1600});eq(C.fit(800,600),{w:800,h:600});eq(C.fit(5000,1,1024),{w:1024,h:1});
 for(const [w,h] of [[1601,1600],[9999,7],[1,9999],[3000,3000]]){const d=C.fit(w,h);assert.ok(Math.max(d.w,d.h)<=C.PIC_SIDE);assert.ok(Math.abs(d.w/d.h-w/h)<w/h*.5||Math.min(d.w,d.h)===1)}
 assert.equal(C.fit(0,10),null);assert.equal(C.fit(NaN,10),null);
 assert.equal(C.validPic(PIC),true);assert.equal(C.validPic({...PIC,src:'data:image/jpeg;base64,/9j/4AAQ'}),true);assert.equal(C.validPic({...PIC,src:'data:image/webp;base64,UklGRg=='}),true);
 for(const bad of [null,[],'x',{...PIC,v:2},{...PIC,w:0},{...PIC,h:1601},{...PIC,w:1.5},{...PIC,src:'javascript:alert(1)'},{...PIC,src:'data:image/svg+xml;base64,PHN2Zz4='},{...PIC,src:'data:text/html;base64,PGI+'},{...PIC,src:'data:image/png;base64,AA"onerror="x'},{...PIC,src:'https://example.test/a.png'},{...PIC,src:'data:image/png;base64,'+'A'.repeat(1200001)},{...PIC,src:7}])assert.equal(C.validPic(bad),false);
});

test('the picture is kept in the browser only: it shows on the page and never gets into the campaign or the save',async()=>{
 const P=load(),c=camp(three()),s=scene(c,{page:P});P.st.campaigns.push(c);
 assert.equal(P.C.page(c,[],'ru').includes('<img'),false);await settle();
 assert.equal(await P.C.savePic(c.id,PIC),'saved');eq(P.store.m.get(c.id),PIC);
 const html=P.C.page(c,[],'ru');
 assert.match(html,/<img class="cm-pic" src="data:image\/png;base64,iVBORw0KGgo=" alt="" draggable="false">/);assert.match(html,/Сменить картинку/);assert.match(html,/data-cm-act="pic-remove"/);assert.equal(html.includes('cm-stage cm-grid'),false);
 assert.equal(JSON.stringify(c).includes('data:image'),false);assert.equal(JSON.stringify(P.st).includes('data:image'),false);
 // A page opened later finds the picture in the storage.
 const Q=load({store:P.store}),again=plain(c);Q.st.campaigns.push(again);
 assert.equal(Q.C.page(again,[],'ru').includes('<img'),false,'the first paint does not wait for the storage');await settle();
 assert.match(Q.C.page(again,[],'ru'),/<img class="cm-pic"/);
 // Removing asks first, and can be taken back.
 const no=load({confirm:()=>false,store:P.store}),nc=plain(c);no.st.campaigns.push(nc);no.C.page(nc,[],'ru');await settle();
 scene(nc,{page:no}).act('pic-remove');await settle();assert.equal(P.store.m.has(c.id),true,'not removed without a yes');
 s.act('pic-remove');await settle();
 assert.equal(P.store.m.has(c.id),false);assert.equal(P.C.page(c,[],'ru').includes('<img'),false);assert.equal(c.cityMap.ratio,1.5,'the proportions stay, so the pins keep their places');
 assert.equal(P.actions.at(-1).m,'Картинка карты убрана.');P.actions.at(-1).run();await settle();
 eq(P.store.m.get(c.id),PIC);assert.match(P.C.page(c,[],'ru'),/<img class="cm-pic"/);
 // What is refused.
 assert.equal(await P.C.savePic(c.id,{...PIC,src:'javascript:alert(1)'}),'bad');assert.equal(await P.C.savePic(c.id,{...PIC,src:'data:image/png;base64,'+'A'.repeat(C.PIC_CHARS)}),'bad');assert.equal(await P.C.savePic('',PIC),'bad');
 // A record in the storage that is not a picture is not shown.
 const odd=fakeStore();odd.m.set('z1',{v:1,w:4,h:2,src:'data:text/html;base64,PGI+'});
 const O=load({store:odd}),oc={id:'z1',name:'Z',roster:[]};O.C.page(oc,[],'ru');await settle();assert.equal(O.C.page(oc,[],'ru').includes('<img'),false);
});

test('a browser that refuses to store: the picture stays for this visit, the page says so, pins work as before',async()=>{
 const P=load({store:fakeStore({fail:true})}),c=camp(three());P.st.campaigns.push(c);
 P.C.page(c,[],'ru');await settle();assert.match(P.C.page(c,[],'ru'),/cm-stage cm-grid/);
 assert.equal(await P.C.savePic(c.id,PIC),'session');
 const html=P.C.page(c,[],'ru');assert.match(html,/<img class="cm-pic"/);assert.match(html,/она пропадёт, когда вы закроете страницу/);
 assert.equal(scene(c,{page:P}).act('add-centre').dirty,true);assert.equal(c.cityMap.pins.length,4);
 const none=load({store:null}),n=camp();none.C.page(n,[],'ru');await settle();assert.match(none.C.page(n,[],'ru'),/cm-stage cm-grid/);assert.equal(await none.C.savePic(n.id,PIC),'session');
});

test('pictures of campaigns that are gone are marked first and removed only after a week; a campaign that came back keeps its picture',async()=>{
 const P=load(),live=camp(),gone='old-campaign';P.st.campaigns.push(live);
 P.store.m.set(live.id,plain(PIC));P.store.m.set(gone,plain(PIC));P.store.m.set('junk',{v:1,src:'x'});
 const now=Date.now();
 assert.equal(await P.C.sweep(P.store,now),1);assert.equal(P.store.m.has('junk'),false);
 eq(P.store.m.get(live.id),PIC);eq(P.store.m.get(gone),{...PIC,gone:now});
 assert.equal(await P.C.sweep(P.store,now+6*24*3600*1000),0);assert.equal(P.store.m.has(gone),true);
 // The campaign is restored: reading the picture lifts the mark.
 const back={id:gone,name:'Back',roster:[]};P.st.campaigns.push(back);P.C.page(back,[],'ru');await settle();
 eq(P.store.m.get(gone),PIC);assert.match(P.C.page(back,[],'ru'),/<img class="cm-pic"/);
 P.st.campaigns.pop();await P.C.sweep(P.store,now);
 assert.equal(await P.C.sweep(P.store,now+8*24*3600*1000),1);assert.equal(P.store.m.has(gone),false);eq(P.store.m.get(live.id),PIC);
 // Without a list of campaigns to compare with, nothing is removed.
 const Q=load();Q.store.m.set('x',plain(PIC));Q.window.App.getState=()=>null;assert.equal(await Q.C.sweep(Q.store,now+99*24*3600*1000),0);assert.equal(Q.store.m.has('x'),true);
});

test('the campaign page: the card leads to the map, the map page replaces the tracker, clicks reach the map and are saved',()=>{
 const P=load({files:['campaigns.js','city-map.js']}),Camp=P.window.Campaigns,c={id:'k1',name:'Job',notes:'',round:1,turnIndex:0,roster:[]};P.st.campaigns.push(c);
 let saves=0,renders=0,current=true;const notices=[];
 const ctx={lang:'ru',campaigns:P.st.campaigns,characters:[],save:()=>saves++,render:()=>renders++,notify:m=>notices.push(m),isCurrent:()=>current};
 const click=(sel,data,root)=>Camp.handle({type:'click',target:{dataset:data,closest:s=>s===sel?{dataset:data}:s==='[data-cm-root]'?root||null:null}},ctx);
 const body={innerHTML:''},root={querySelector:s=>s==='[data-cm-body]'?body:null,contains:()=>false};
 click('[data-campaign-action]',{campaignAction:'open',id:'k1'});
 let html=Camp.render(P.st.campaigns,[],'ru',null);
 assert.match(html,/data-campaign-view="k1"/);assert.match(html,/data-cm-card/);assert.match(html,/Открыть карту города/);
 assert.equal(click('[data-cm-act]',{cmAct:'open'},root),true);assert.equal(renders,2);assert.equal(saves,0);
 html=Camp.render(P.st.campaigns,[],'ru',null);
 assert.match(html,/^<div class="cm-page" data-cm-root data-cm-page="k1">/);assert.equal(html.includes('data-campaign-view'),false);
 assert.equal(click('[data-cm-act]',{cmAct:'add-centre'},root),true);assert.equal(saves,1);assert.equal(c.cityMap.pins.length,1);assert.match(body.innerHTML,/data-cm-pin="/);
 current=false;assert.equal(click('[data-cm-act]',{cmAct:'add-centre'},root),true);assert.equal(c.cityMap.pins.length,1,'a stale page changes nothing');assert.match(notices.at(-1),/повторите действие/);
 current=true;click('[data-cm-act]',{cmAct:'close'},root);assert.match(Camp.render(P.st.campaigns,[],'ru',null),/data-campaign-view="k1"/);
 assert.match(Camp.render(P.st.campaigns,[],'ru',null),/Меток: 1 · игрокам показано: 0/);
});
