// What players in a room see of each tracker participant: the level for the room, the level of one participant,
// what goes into the message and what a page keeps of a message it receives.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const eq=(a,b,msg)=>assert.deepEqual(plain(a),plain(b),msg);

function load(){const window={};vm.runInNewContext(read('room-visibility.js'),{window,Promise,Math,Number,String,Array,Object,JSON});return window.RoomVisibility}
const V=load();
const DEV_A='a'.repeat(16),DEV_B='b'.repeat(16);
const npc=(over={})=>({id:'n1',kind:'npc',name:'Бандит',ref:6,hp:20,initiative:12,order:1,...over});
const pc=(over={})=>({id:'p1',kind:'pc',characterId:'v1',initiative:15,order:2,...over});

/* ---------- The module alone ---------- */

test('with nothing set every participant is at «name», the old behaviour',()=>{
 assert.equal(V.level(npc(),{}),'name');assert.equal(V.level(pc(),{}),'name');assert.equal(V.level(npc(),null),'name');
 assert.equal(V.roomLevel({}),'name');assert.equal(V.roomLevel(undefined),'name');
 eq(V.LEVELS,['hidden','name','state','full']);
});

test('the room level applies to everyone, one participant can differ, «hidden» wins for an NPC',()=>{
 for(const v of ['hidden','name','state','full'])assert.equal(V.level(npc(),{vis:v}),v);
 assert.equal(V.level(npc({vis:'full'}),{vis:'state'}),'full');
 assert.equal(V.level(npc({vis:'name'}),{vis:'hidden'}),'name','an NPC opened by hand in a room that hides by default');
 assert.equal(V.level(npc({hidden:true,vis:'full'}),{vis:'full'}),'hidden');
 assert.equal(V.level(npc({hidden:true}),{}),'hidden','the flag the old button wrote still hides');
});

test('a player\'s own row is never hidden; a junk owner does not un-hide an enemy',()=>{
 assert.equal(V.level(pc(),{vis:'hidden'}),'name');assert.equal(V.level(pc({hidden:true}),{}),'name');
 assert.equal(V.level(pc({vis:'full'}),{vis:'hidden'}),'full');
 const mine=npc({own:DEV_A+':v1'});
 assert.equal(V.owned(mine),true);assert.equal(V.level(mine,{vis:'hidden'}),'name');assert.equal(V.level({...mine,hidden:true},{vis:'state'}),'state');
 for(const own of ['yes',DEV_A,DEV_A+':',123,{},true,'A'.repeat(16)+':v1']){
  const r=npc({own,hidden:true});assert.equal(V.owned(r),false,String(own));assert.equal(V.level(r,{}),'hidden',String(own));
 }
});

test('values that are not levels are ignored',()=>{
 for(const bad of ['','FULL','Full',5,{},[],null,true,'__proto__','toString','constructor']){
  assert.equal(V.level(npc({vis:bad}),{vis:'state'}),'state','row '+String(bad));
  assert.equal(V.level(npc(),{vis:bad}),'name','room '+String(bad));
 }
 assert.equal(V.level(npc({vis:'hidden'}),{}),'name','«hidden» for one participant lives in the hidden flag only');
 assert.equal(V.level(null,{}),'hidden','what is not a row is not shown');
});

test('setRoom and setRow store only what differs from the default',()=>{
 const camp={};
 assert.equal(V.setRoom(camp,'state'),true);assert.equal(camp.vis,'state');
 assert.equal(V.setRoom(camp,'state'),false,'the same value is not a change');
 assert.equal(V.setRoom(camp,'bogus'),false);assert.equal(camp.vis,'state');
 assert.equal(V.setRoom(camp,'hidden'),true);assert.equal(camp.vis,'hidden');
 assert.equal(V.setRoom(camp,'name'),true);assert.equal('vis' in camp,false);
 assert.equal(V.setRoom(null,'full'),false);

 const r=npc();
 assert.equal(V.setRow(r,'full'),true);assert.equal(r.vis,'full');assert.equal('hidden' in r,false);
 assert.equal(V.setRow(r,'hidden'),true);assert.equal(r.hidden,true);assert.equal('vis' in r,false);
 assert.equal(V.setRow(r,'hidden'),false);
 assert.equal(V.setRow(r,'state'),true);assert.equal(r.vis,'state');assert.equal('hidden' in r,false);
 assert.equal(V.setRow(r,'FULL'),false);assert.equal(V.setRow(r,5),false);assert.equal(r.vis,'state');
 assert.equal(V.setRow(r,''),true);assert.equal('vis' in r,false);assert.equal('hidden' in r,false);
 assert.equal(V.setRow(r,''),false);
 // A character and a player's row from the room refuse «hidden».
 const p=pc();assert.equal(V.setRow(p,'hidden'),false);assert.equal('hidden' in p,false);
 const own=npc({own:DEV_A+':v1'});assert.equal(V.setRow(own,'hidden'),false);assert.equal('hidden' in own,false);
 assert.equal(V.setRow(p,'full'),true);assert.equal(p.vis,'full');
});

test('the Wound State code uses the tracker\'s thresholds',()=>{
 assert.equal(V.wound(30,30,false),0);assert.equal(V.wound(15,30,false),0);assert.equal(V.wound(14,30,false),1);
 assert.equal(V.wound(17,35,false),1,'half of 35 rounds up to 18');assert.equal(V.wound(18,35,false),0);
 assert.equal(V.wound(0,30,false),2);assert.equal(V.wound(-4,0,false),2);assert.equal(V.wound(3,0,false),0,'without a known full HP only Mortally Wounded can be told');
 assert.equal(V.wound(30,30,true),3);assert.equal(V.wound(0,30,true),3);
 // The same answers as the tracker itself.
 const window={GMTools:{NPC_TEMPLATES:[]}};vm.runInNewContext(read('campaigns.js'),{window,document:{querySelector:()=>null},confirm:()=>true,Math,Date,globalThis:{crypto:{randomUUID:()=>'x'}}});
 const code={'':0,serious:1,mortal:2};
 for(const [hp,max] of [[30,30],[14,30],[15,30],[17,35],[18,35],[0,30],[-3,30],[1,2],[5,0]])assert.equal(V.wound(hp,max,false),code[window.Campaigns.woundOf({hp,...(max?{maxHp:max}:{})},null)],hp+'/'+max);
});

test('part() returns only what the level shows',()=>{
 const facts={hp:12,max:25,dead:false,out:true,sp:{head:7,body:11}};
 for(const lv of ['hidden','name','','bogus',undefined,null])eq(V.part(lv,facts),{},String(lv));
 assert.equal(Object.keys(V.part('name',facts)).length,0,'no keys at all, not even undefined ones');
 eq(V.part('state',facts),{w:1,out:true});eq(V.part('state',{hp:25,max:25}),{w:0});
 assert.doesNotMatch(JSON.stringify(V.part('state',facts)),/hp|max|sp|12|25|11/);
 eq(V.part('full',facts),{w:1,out:true,hp:12,max:25,sp:[7,11]});
 eq(V.part('full',{hp:20,max:0}),{w:0,hp:20},'full HP unknown: not sent');
 eq(V.part('full',{hp:20,max:20,sp:{head:0,body:0}}),{w:0,hp:20,max:20},'no armor: not sent');
 eq(V.part('full',{hp:20,max:20,sp:null}),{w:0,hp:20,max:20});
 eq(V.part('full',{hp:5000,max:5000,sp:{head:99,body:-3}}),{w:0,hp:999,sp:[30,0]},'numbers are kept inside their ranges');
 eq(V.part('full',{hp:'x',max:'y',dead:true}),{w:3,hp:0});
 eq(V.part('full',null),{w:2,hp:0});
});

test('clean() keeps whole numbers in range and nothing else',()=>{
 eq(V.clean({w:1,out:true,hp:12,max:25,sp:[7,11],name:'x',evil:'<script>',hidden:true}),{w:1,out:true,hp:12,max:25,sp:[7,11]});
 eq(V.clean({w:0}),{w:0});
 for(const raw of [null,undefined,'w',5,[],{},{hp:12,max:25},{w:'1',hp:12},{w:1.5},{w:NaN},{w:4},{w:-1},{w:true},{w:[1]},{w:{valueOf:()=>1}}])eq(V.clean(raw),{},JSON.stringify(raw));
 eq(V.clean({w:2,out:1,hp:'12',max:25.5,sp:[7]}),{w:2});
 eq(V.clean({w:2,out:'true',hp:1000,max:0,sp:[7,11,3]}),{w:2});
 eq(V.clean({w:2,hp:-999,max:999,sp:[0,30]}),{w:2,hp:-999,max:999,sp:[0,30]});
 eq(V.clean({w:2,hp:-1000,max:1000,sp:[0,31]}),{w:2});
 eq(V.clean({w:2,sp:['7',11]}),{w:2});eq(V.clean({w:2,sp:{0:7,1:11,length:2}}),{w:2});
 const hostile=JSON.parse('{"w":1,"__proto__":{"hp":5},"toString":"x","constructor":{"prototype":{}}}'),got=V.clean(hostile);
 eq(Object.keys(got),['w']);assert.equal(got.hp,undefined);
 // The array it returns is its own, not the sender's.
 const sp=[7,11],kept=V.clean({w:0,sp});sp[0]=30;eq(kept.sp,[7,11]);
});

test('the room list shows chips in both languages and escapes nothing it did not check',()=>{
 assert.equal(V.chips({name:'A',init:3},'ru'),'');assert.equal(V.chips({w:'1',hp:5},'ru'),'');assert.equal(V.chips(null,'ru'),'');
 assert.equal(V.chips({w:0},'ru'),'<div class="rv-info"><small class="rv-chip rv-w0">Не ранен</small></div>');
 assert.match(V.chips({w:1},'ru'),/rv-w1">Тяжело ранен</);assert.match(V.chips({w:2},'ru'),/rv-w2">Смертельно ранен</);assert.match(V.chips({w:3},'ru'),/rv-w3">Мёртв</);
 assert.match(V.chips({w:1},'en'),/rv-w1">Seriously Wounded</);assert.match(V.chips({w:2},'en'),/Mortally Wounded/);assert.match(V.chips({w:3},'en'),/Dead/);assert.match(V.chips({w:0},'en'),/Unhurt/);
 const full=V.chips({w:1,out:true,hp:12,max:25,sp:[7,11]},'ru');
 assert.match(full,/rv-out">Выбыл</);assert.match(full,/rv-hp">HP 12\/25</);assert.match(full,/SP: голова 7 · тело 11</);
 assert.match(V.chips({w:1,out:true,hp:12,sp:[7,11]},'en'),/Out<.*HP 12<.*SP: head 7 · body 11</);
 assert.doesNotMatch(V.chips({w:3,out:true},'ru'),/Выбыл/,'dead says it all');
 // Whatever else the row carries is not drawn.
 const html=V.chips({w:1,hp:'<img src=x>',max:'"><script>',sp:['<b>',1],name:'<i>'},'ru');
 assert.doesNotMatch(html,/<img|<script|<b>|<i>/);assert.equal(html,'<div class="rv-info"><small class="rv-chip rv-w1">Тяжело ранен</small></div>');
 // No <span>: the room list colours every span in a row as a name.
 assert.doesNotMatch(full,/<span/);
});

test('the two lists of the tracker: options, the chosen one, escaping',()=>{
 const d=V.defaultHTML({},'ru');
 assert.match(d,/<label class="rv-field">Игроки в комнате видят<select data-rv-room>/);
 eq([...d.matchAll(/<option value="([a-z]*)"( selected)?>([^<]*)</g)].map(m=>[m[1],!!m[2],m[3]]),[['hidden',false,'Никого, пока вы не откроете'],['name',true,'Только имя'],['state',false,'Имя и состояние'],['full',false,'Всё: HP и броня']]);
 assert.match(V.defaultHTML({vis:'full'},'en'),/<option value="full" selected>Everything: HP and armor</);assert.match(V.defaultHTML({vis:'hidden'},'en'),/<option value="hidden" selected>Nobody until you reveal them</);
 assert.match(d,/class="muted rv-help">Это уровень для всех участников трекера/);assert.match(d,/в комнату не отправляется/);

 const opts=html=>[...html.matchAll(/<option value="([a-z]*)"( selected)?>([^<]*)</g)].map(m=>[m[1],!!m[2],m[3]]);
 eq(opts(V.rowHTML(npc(),{vis:'state'},'ru')),[['',true,'Как в комнате: имя и состояние'],['hidden',false,'Скрыт'],['name',false,'Только имя'],['state',false,'Имя и состояние'],['full',false,'Всё: HP и броня']]);
 eq(opts(V.rowHTML(npc({hidden:true,vis:'full'}),{},'en')).filter(o=>o[1]),[['hidden',true,'Hidden']]);
 eq(opts(V.rowHTML(npc({vis:'full'}),{},'en')).filter(o=>o[1]),[['full',true,'Everything: HP and armor']]);
 // A player's row: no «hidden», and «as in the room» says what it really gets in a room that hides by default.
 const mine=opts(V.rowHTML(pc({hidden:true}),{vis:'hidden'},'ru'));
 eq(mine.map(o=>o[0]),['','name','state','full']);eq(mine[0],['',true,'Как в комнате: только имя']);
 eq(opts(V.rowHTML(npc({own:DEV_B+':j1'}),{},'en')).map(o=>o[0]),['','name','state','full']);
 eq(opts(V.rowHTML(npc(),{vis:'hidden'},'en'))[0],['',true,'As in the room: hidden']);
 // «HP» keeps its capitals and the text has one colon, in both languages; every level has its own wording.
 eq(opts(V.rowHTML(npc(),{vis:'full'},'ru'))[0],['',true,'Как в комнате: HP и броня']);
 eq(opts(V.rowHTML(npc(),{vis:'full'},'en'))[0],['',true,'As in the room: HP and armor']);
 eq(opts(V.rowHTML(npc(),{vis:'state'},'en'))[0],['',true,'As in the room: name and state']);
 eq(opts(V.rowHTML(npc(),{},'en'))[0],['',true,'As in the room: name only']);
 for(const lang of ['ru','en'])for(const vis of ['hidden','name','state','full']){
  const first=opts(V.rowHTML(npc(),{vis},lang))[0][2];
  assert.doesNotMatch(first,/\bhp\b/,first);assert.equal(first.split(':').length,2,first);
  // Short enough for the closed list on a 390px phone (the longest text that was seen to fit is 30 characters).
  assert.ok(first.length<=30,first);
 }
 assert.match(V.rowHTML(npc(),{},'ru'),/<label class="rv-field rv-row">Игроки видят<select data-rv-row="n1">/);
 const evil=V.rowHTML(npc({id:'"><img src=x onerror=1>\''}),{},'ru');
 assert.doesNotMatch(evil,/<img/);assert.match(evil,/data-rv-row="&quot;&gt;&lt;img src=x onerror=1&gt;&#39;"/);
 assert.equal(V.rowHTML(null,{},'ru'),'');
 assert.match(V.gmNote('ru'),/^<p class="room-muted rv-note">Так список видят игроки\. Уровень меняется в трекере кампании\.<\/p>$/);assert.match(V.gmNote('en'),/as players see it/);
});

test('every text exists in both languages; Russian addresses the reader formally',()=>{
 const {T}=V._test;eq(Object.keys(T.ru).sort(),Object.keys(T.en).sort());
 for(const k of Object.keys(T.ru)){assert.ok(T.ru[k]&&T.en[k],k);assert.notEqual(V.t(k,'ru'),k);assert.equal(V.t(k,'xx'),T.ru[k],'an unknown language reads Russian')}
 assert.equal(V.t('nope','en'),'nope');
 const ru=Object.values(T.ru).join(' ');
 assert.doesNotMatch(ru,/(^|[^а-яё])(ты|тебя|тебе|тобой|твой|твоя|твоё|твои|твоего|твоих)([^а-яё]|$)/i);
 assert.doesNotMatch(Object.values(T.en).join(' '),/[а-яё]/i);
});

test('the tracker handler changes the campaign only for its own lists',()=>{
 const camp={id:'c',roster:[npc(),pc()]};
 const change=(data,value)=>({type:'change',target:{dataset:data,value}});
 assert.equal(V.owns(change({rvRoom:''},'full')),true);assert.equal(V.owns(change({rvRow:'n1'},'full')),true);
 assert.equal(V.owns({type:'click',target:{dataset:{rvRoom:''}}}),false);assert.equal(V.owns({type:'input',target:{dataset:{rvRow:'n1'}}}),false);
 assert.equal(V.owns(change({campHp:'n1'},'5')),false);assert.equal(V.owns(null),false);assert.equal(V.owns({type:'change',target:{}}),false);
 eq(V.handle(change({rvRoom:''},'state'),camp),{dirty:true,rerender:true});assert.equal(camp.vis,'state');
 eq(V.handle(change({rvRoom:''},'state'),camp),{dirty:false,rerender:false});
 eq(V.handle(change({rvRoom:''},'everything'),camp),{dirty:false,rerender:false});assert.equal(camp.vis,'state');
 eq(V.handle(change({rvRow:'n1'},'hidden'),camp),{dirty:true,rerender:true});assert.equal(camp.roster[0].hidden,true);
 eq(V.handle(change({rvRow:'n1'},'full'),camp),{dirty:true,rerender:true});eq(camp.roster[0],npc({vis:'full'}));
 eq(V.handle(change({rvRow:'nobody'},'full'),camp),{dirty:false,rerender:false});
 eq(V.handle(change({rvRow:'n1'},'<b>'),camp),{dirty:false,rerender:false});
 eq(V.handle(change({rvRow:'p1'},'hidden'),camp),{dirty:false,rerender:false});assert.equal('hidden' in camp.roster[1],false);
 eq(V.handle(change({rvRow:'n1'},''),camp),{dirty:true,rerender:true});eq(camp.roster[0],npc());
 eq(V.handle({type:'click',target:{dataset:{rvRoom:''},value:'full'}},camp),{dirty:false,rerender:false});
 eq(V.handle(change({rvRoom:''},'full'),null),{dirty:false,rerender:false});
});

test('after the tracker is drawn again the list keeps the focus and «Действия» stays open',async()=>{
 const window={},box={open:false};let focused=null;
 const select=(data)=>({dataset:data,closest:s=>s==='details'&&data.rvRow!==undefined?box:null,focus(){focused=this}});
 const els=[select({rvRoom:''}),select({rvRow:'n0'}),select({rvRow:'n1'})],body={};
 window.document={body,activeElement:body,querySelectorAll:()=>els};
 vm.runInNewContext(read('room-visibility.js'),{window,Promise,Math,Number,String,Array,Object,JSON});
 const camp={roster:[npc()]};
 window.RoomVisibility.handle({type:'change',target:{dataset:{rvRow:'n1'},value:'full'}},camp);await Promise.resolve();
 assert.equal(focused,els[2]);assert.equal(box.open,true);
 focused=null;window.RoomVisibility.handle({type:'change',target:{dataset:{rvRoom:''},value:'state'}},camp);await Promise.resolve();assert.equal(focused,els[0]);
 // Focus that already went somewhere else is left alone.
 focused=null;window.document.activeElement={tagName:'INPUT'};
 window.RoomVisibility.handle({type:'change',target:{dataset:{rvRoom:''},value:'full'}},camp);await Promise.resolve();assert.equal(focused,null);
});

/* ---------- In the room ---------- */

function loadRoom({lang='ru',vis=true,map=false}={}){
 const store=new Map(),listeners={},document={addEventListener(type,f){(listeners[type]||=[]).push(f)},querySelector:()=>null,querySelectorAll:()=>[],visibilityState:'visible'};
 const later=(f,ms)=>{const h=setTimeout(f,ms);if(ms>=1000)h.unref?.();return h};
 const window={document,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},crypto:globalThis.crypto,location:{hash:'',origin:'https://example.test',pathname:'/'},addEventListener(){},confirm:()=>true,navigator:{},btoa,atob,Response,Blob,ReadableStream,CompressionStream,DecompressionStream,ROLES:[],GMTools:{NPC_TEMPLATES:[]}};
 const ctx={window,confirm:()=>true,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Error,setTimeout:later,clearTimeout,setInterval,clearInterval,console};
 vm.runInNewContext((map?read('combat-tools.js')+'\n'+read('battle-map.js')+'\n':'')+read('room-transport.js')+'\n'+(vis?read('room-visibility.js')+'\n':'')+read('room.js'),ctx);
 const R=window.Room._test,sent=[];
 window.chars=[];window.camps=[];
 R.setApp({getState:()=>({lang,view:'room',characters:window.chars,campaigns:window.camps}),notify(){}});
 R.setTransport({publish:(sub,bytes)=>{sent.push({sub,bytes});return 1},close(){}});
 return {window,R,sent};
}
const CODE='K7RQM2XAPZ9E',settle=()=>new Promise(ok=>setTimeout(ok,30));
const SUM={name:'Ви',role:'solo',rank:4,hp:45,max:45,humanity:60,luck:6,luckMax:6,head:11,body:11,ref:7,dex:6,rep:0};
// The tracker of one fight: a character with a sheet, an armored enemy, a wounded one, a player's row from the room.
const fight=()=>({id:'c1',name:'Ночной рейс',round:2,turnIndex:0,roster:[
 {id:'p1',kind:'pc',characterId:'v1',initiative:15,order:1},
 {id:'n1',kind:'npc',name:'Бандит',ref:6,hp:20,maxHp:20,initiative:12,order:2,sp:{head:7,body:11}},
 {id:'n2',kind:'npc',name:'Снайпер',ref:8,hp:9,maxHp:30,initiative:9,order:3,out:true},
 {id:'n3',kind:'npc',own:DEV_B+':j1',name:'Джонни',ref:6,hp:38,maxHp:40,initiative:5,order:4,sp:{head:4,body:4}}]});
const sheet=(over={})=>({id:'v1',name:'Ви',role:'solo',rank:4,hp:20,stats:{BODY:8,WILL:6,REF:7,DEX:6,LUCK:6},extra:{},...over});
async function table(opts={}){
 const maker=loadRoom().R,r=await maker.deriveRoom(CODE),keys={};
 for(const n of ['gm','ann','bob']){const key=await maker.newIdentity();keys[n]={key,id:key.fp+'.0000000'+Object.keys(keys).length}}
 const page=(n,role,extra={})=>{const p=loadRoom(extra.load);p.R.setKey(r.key);p.R.setIdentity(keys[n].key);p.R.setSession({code:CODE,role,name:n,memberId:keys[n].id,gmFp:keys.gm.key.fp,toasts:false,...(extra.session||{})},r.topic);return p};
 const msg=(from,t,d,sub='e')=>maker.signedEnvelope(keys[from].key,keys[from].id,r.topic,r.key,sub,t,d,Date.now(),Math.random().toString(16).slice(2,14));
 const give=async(to,bytes,sub='e')=>{await to.R.receive({topic:r.topic+'/'+sub,retain:false,payload:bytes});await settle()};
 const gm=page('gm','gm',{session:{campaignId:'c1'},load:opts.gm});
 gm.window.camps.push(fight());gm.window.chars.push(sheet());gm.window.App={save(){},render(){}};
 const seat=(n,dev,cid,character)=>gm.R.members().set(keys[n].id,{name:n,role:'player',fp:keys[n].key.fp,dev,cid,character,at:Date.now()});
 return {r,keys,page,msg,give,gm,seat,camp:gm.window.camps[0]};
}
const OLD_KEYS=['name','pc','none','own','init','current'];

test('with no setting the message is the same as from a page without this file',async()=>{
 const withIt=await table(),without=await table({gm:{vis:false}});
 const a=withIt.gm.R.combatPayload(),b=without.gm.R.combatPayload();
 assert.equal(JSON.stringify(a),JSON.stringify(b));
 eq(a.order,[{name:'Ви',pc:true,init:15,current:true},{name:'Бандит',pc:false,init:12,current:false},{name:'Снайпер',pc:false,init:9,current:false},{name:'Джонни',pc:true,own:DEV_B+':j1',init:5,current:false}]);
 for(const row of a.order)for(const k of Object.keys(row))assert.ok(OLD_KEYS.includes(k),k);
 // The old hidden flag hides in both.
 withIt.camp.roster[1].hidden=true;without.camp.roster[1].hidden=true;
 assert.equal(JSON.stringify(withIt.gm.R.combatPayload()),JSON.stringify(without.gm.R.combatPayload()));
 assert.equal(withIt.gm.R.combatPayload().order.length,3);
});

test('«state» for the room: every row carries the Wound State and no number',async()=>{
 const {gm,camp}=await table();camp.vis='state';
 const p=gm.R.combatPayload();
 eq(p.order.map(r=>[r.name,r.w,r.out===true]),[['Ви',1,false],['Бандит',0,false],['Снайпер',1,true],['Джонни',0,false]]);
 for(const row of p.order){assert.equal('hp' in row,false);assert.equal('max' in row,false);assert.equal('sp' in row,false)}
 assert.doesNotMatch(JSON.stringify(p.order),/"hp"|"max"|"sp"/);
 // Dead is told apart from Mortally Wounded, for an NPC and for a character.
 camp.roster[1].hp=0;assert.equal(gm.R.combatPayload().order[1].w,2);
 camp.roster[1].dead=true;assert.equal(gm.R.combatPayload().order[1].w,3);
 gm.window.chars[0].extra={deathRecord:{dead:true}};assert.equal(gm.R.combatPayload().order[0].w,3);
});

test('«full» for one participant: that row alone has HP, and armor only for an NPC the Game Master runs',async()=>{
 const {gm,camp}=await table();camp.roster[1].vis='full';
 let p=gm.R.combatPayload();
 eq(p.order[1],{name:'Бандит',pc:false,init:12,current:false,w:0,hp:20,max:20,sp:[7,11]});
 for(const i of [0,2,3])for(const k of Object.keys(p.order[i]))assert.ok(OLD_KEYS.includes(k),p.order[i].name+' '+k);
 // An NPC whose full HP was never set: the number alone.
 delete camp.roster[1].maxHp;delete camp.roster[1].sp;eq(gm.R.combatPayload().order[1],{name:'Бандит',pc:false,init:12,current:false,w:0,hp:20});
 // A character with a sheet and a player's row: HP, never armor.
 camp.vis='full';p=gm.R.combatPayload();
 eq(p.order[0],{name:'Ви',pc:true,init:15,current:true,w:1,hp:20,max:45});
 eq(p.order[3],{name:'Джонни',pc:true,own:DEV_B+':j1',init:5,current:false,w:0,hp:38,max:40});
 // A room that shows everything, one participant kept to the name.
 camp.roster[2].vis='name';eq(gm.R.combatPayload().order[2],{name:'Снайпер',pc:false,init:9,current:false});
});

test('a hidden participant is not in the message at all; on its turn players learn only that somebody hidden acts',async()=>{
 const {gm,camp}=await table();camp.vis='full';camp.roster[2].hidden=true;camp.roster[2].vis='full';
 let p=gm.R.combatPayload();
 eq(p.order.map(r=>r.name),['Ви','Бандит','Джонни']);assert.doesNotMatch(JSON.stringify(p),/Снайпер/);assert.equal('veiled' in p,false);
 camp.turnIndex=2;p=gm.R.combatPayload();assert.equal(p.veiled,true);assert.equal(p.order.some(r=>r.current),false);assert.doesNotMatch(JSON.stringify(p),/Снайпер/);
});

test('a room that hides by default: enemies stay out until opened, players\' rows stay in, tokens of hidden rows stay home',async()=>{
 const {gm,camp}=await table({gm:{map:true}});camp.vis='hidden';
 camp.map={v:1,w:14,h:10,tokens:[{id:'p1',x:0,y:0},{id:'n1',x:4,y:4},{id:'n2',x:6,y:6},{id:'n3',x:9,y:9}],cover:[]};
 let p=gm.R.combatPayload();
 eq(p.order,[{name:'Ви',pc:true,init:15,current:true},{name:'Джонни',pc:true,own:DEV_B+':j1',init:5,current:false}]);
 assert.doesNotMatch(JSON.stringify(p),/Бандит|Снайпер|4,4|6,6/);
 eq(p.map.t,[[0,0,0],[1,9,9]]);
 // The Game Master opens one enemy: it appears, with its token, at the level chosen.
 gm.window.RoomVisibility.setRow(camp.roster[1],'state');p=gm.R.combatPayload();
 eq(p.order.map(r=>r.name),['Ви','Бандит','Джонни']);eq(p.order[1],{name:'Бандит',pc:false,init:12,current:false,w:0});
 eq(p.map.t,[[0,0,0],[1,4,4],[2,9,9]]);assert.doesNotMatch(JSON.stringify(p),/Снайпер|6,6/);
 // The Game Master's own map marks what players do not see.
 const html=gm.window.BattleMap.render(camp,gm.window.chars,'ru');
 assert.equal((html.match(/bm-hidden/g)||[]).length>=1,true);
 camp.vis='name';assert.doesNotMatch(gm.window.BattleMap.render(camp,gm.window.chars,'ru'),/bm-hidden/);
});

test('a player who is online: the row carries their own HP, not the Game Master\'s copy; a deleted sheet carries none',async()=>{
 const {gm,camp,seat}=await table();camp.vis='full';
 gm.window.chars[0].extra={sourceKey:'room-dev:'+DEV_A+':v1'};
 eq(gm.R.combatPayload().order[0],{name:'Ви',pc:true,own:DEV_A+':v1',init:15,current:true,w:1,hp:20,max:45});
 seat('ann',DEV_A,'v1',{...SUM,hp:31,max:45});
 eq(gm.R.combatPayload().order[0],{name:'Ви',pc:true,own:DEV_A+':v1',init:15,current:true,w:0,hp:31,max:45});
 seat('bob',DEV_B,'j1',{...SUM,name:'Джонни',hp:3,max:40});
 eq(gm.R.combatPayload().order[3],{name:'Джонни',pc:true,own:DEV_B+':j1',init:5,current:false,w:1,hp:3,max:40});
 gm.window.chars.length=0;
 eq(gm.R.combatPayload().order[0],{name:'—',pc:true,none:true,init:15,current:true});
});

test('a player\'s page rebuilds what it receives; an older page keeps the old fields; an old message draws as before',async()=>{
 const {gm,camp,page,msg,give}=await table();camp.vis='full';camp.roster[2].vis='state';
 const d=plain(gm.R.combatPayload());
 // Junk and hostile values mixed in by a sender.
 d.order[1]={...d.order[1],evil:'<script>',hidden:true,vis:'full',hp:'20',sp:[7,'11'],w:0};
 d.order[2]={...d.order[2],w:'1',hp:9,max:30};
 d.order[3]={...d.order[3],w:9,hp:1};
 const ann=page('ann','player');await give(ann,await msg('gm','combat',d,'c'),'c');
 const got=plain(ann.R.state().combat.order);
 eq(got[0],{name:'Ви',pc:true,none:false,own:'',init:15,current:true,w:1,hp:20,max:45});
 eq(got[1],{name:'Бандит',pc:false,none:false,own:'',init:12,current:false,w:0},'a string is not HP, a broken pair is not armor');
 eq(got[2],{name:'Снайпер',pc:false,none:false,own:'',init:9,current:false},'no valid state code: nothing extra is kept');
 eq(got[3],{name:'Джонни',pc:true,none:false,own:DEV_B+':j1',init:5,current:false});
 const html=ann.R.roomView();
 assert.match(html,/<span>Ви<\/span><div class="rv-info"><small class="rv-chip rv-w1">Тяжело ранен<\/small><small class="rv-chip rv-hp">HP 20\/45<\/small><\/div><em>/);
 assert.match(html,/<span>Бандит<\/span><div class="rv-info"><small class="rv-chip rv-w0">Не ранен<\/small><\/div><\/li>/);
 assert.match(html,/<span>Снайпер<\/span><\/li>/);assert.doesNotMatch(html,/<script>|evil/);
 assert.doesNotMatch(html,/rv-note/,'the note about the tracker is for the Game Master');

 // The same message on a page that does not have this file.
 const old=page('bob','player',{load:{vis:false}});await give(old,await msg('gm','combat',plain(gm.R.combatPayload()),'c'),'c');
 for(const row of plain(old.R.state().combat.order))eq(Object.keys(row),['name','pc','none','own','init','current']);
 assert.doesNotMatch(old.R.roomView(),/rv-/);assert.match(old.R.roomView(),/<span>Бандит<\/span><\/li>/);

 // An old-format message on a new page.
 camp.vis='name';delete camp.roster[2].vis;
 const fresh=page('ann','player');await give(fresh,await msg('gm','combat',plain(gm.R.combatPayload()),'c'),'c');
 assert.equal(fresh.R.state().combat.order.length,4);assert.doesNotMatch(fresh.R.roomView(),/rv-info/);
});

test('the Game Master\'s room page shows the list as players get it, with a line that says so',async()=>{
 const {gm,camp}=await table();camp.vis='state';camp.roster[1].hidden=true;
 gm.window.Room.changed();await new Promise(ok=>setTimeout(ok,500));
 const html=gm.R.roomView();
 assert.match(html,/rv-w1">Тяжело ранен</);assert.doesNotMatch(html,/Бандит/);
 assert.match(html,/<\/ol><p class="room-muted rv-note">Так список видят игроки\. Уровень меняется в трекере кампании\.<\/p>/);
});

/* ---------- A player's status, and a co-GM ---------- */

// A player's status as their page sends it; the Game Master's page takes the HP from it.
const status=(name,dev,cid,hp)=>({name,role:'player',dev,cid,character:{...SUM,hp,max:45}});
const subsAfter=(page,from)=>page.sent.slice(from).map(x=>x.sub);

test('a player\'s HP change reaches a row that shows it at once, and nothing is sent before a list exists',async()=>{
 const {gm,camp,keys,msg,give}=await table();camp.vis='full';
 gm.window.chars[0].extra={sourceKey:'room-dev:'+DEV_A+':v1'};
 const sub='m/'+keys.ann.id;
 // No list was ever sent from this device: a status alone must not start one.
 await give(gm,await msg('ann','member',status('ann',DEV_A,'v1',40),sub),sub);
 assert.equal(subsAfter(gm,0).includes('c'),false,'nothing on the list topic before the first list');
 gm.R.auth.publishCombat(true);await settle();
 assert.equal(gm.R.state().combat.order[0].hp,40);
 let from=gm.sent.length;
 await give(gm,await msg('ann','member',status('ann',DEV_A,'v1',12),sub),sub);
 eq(subsAfter(gm,from).filter(x=>x==='c'),['c'],'one new list, without Room.changed()');
 eq(plain(gm.R.state().combat.order[0]),{name:'Ви',pc:true,own:DEV_A+':v1',init:15,current:true,w:1,hp:12,max:45});
 // The same status again changes nothing, so nothing is sent.
 from=gm.sent.length;
 await give(gm,await msg('ann','member',status('ann',DEV_A,'v1',12),sub),sub);
 assert.equal(subsAfter(gm,from).includes('c'),false);
 // At «name» the list does not depend on HP: a status sends no list.
 delete camp.vis;gm.R.auth.publishCombat(true);await settle();from=gm.sent.length;
 await give(gm,await msg('ann','member',status('ann',DEV_A,'v1',3),sub),sub);
 assert.equal(subsAfter(gm,from).includes('c'),false);
});

test('while a co-GM runs the table, a player\'s HP change does not put the Game Master\'s old list over it',async()=>{
 for(const vis of [undefined,'state','full']){
  const {gm,camp,keys,msg,give}=await table();if(vis)camp.vis=vis;
  gm.window.chars[0].extra={sourceKey:'room-dev:'+DEV_A+':v1'};
  const s=gm.R.session();Object.assign(s,{deputyFp:keys.bob.key.fp,deputyBy:s.gmFp,deputyAt:Date.now()});
  gm.R.auth.publishCombat(true);await settle();
  // The co-GM moves the fight on.
  const theirs={campaign:'Ночной рейс',round:3,order:[{name:'Ви',pc:true,init:15,current:false,...(vis?{w:0}:{})},{name:'Бандит',pc:false,init:12,current:true}]};
  await give(gm,await msg('bob','combat',theirs,'c'),'c');
  assert.equal(gm.R.state().combat.round,3,String(vis));assert.equal(gm.R.auth.by().combatBy,keys.bob.key.fp);
  let from=gm.sent.length;const sub='m/'+keys.ann.id;
  await give(gm,await msg('ann','member',status('ann',DEV_A,'v1',12),sub),sub);
  assert.equal(subsAfter(gm,from).includes('c'),false,'vis='+vis+': the status alone sends no list');
  // Neither does the heartbeat's repeat, nor a second change of HP.
  gm.R.auth.publishCombat(true);await give(gm,await msg('ann','member',status('ann',DEV_A,'v1',5),sub),sub);gm.R.auth.publishCombat();
  assert.equal(subsAfter(gm,from).includes('c'),false,'vis='+vis);
  assert.equal(gm.R.state().combat.round,3,'vis='+vis+': the co-GM\'s list stays');assert.equal(gm.R.auth.by().combatBy,keys.bob.key.fp);
  // A change the Game Master makes by hand still wins, as before.
  camp.round=7;from=gm.sent.length;gm.R.auth.publishCombat();await settle();
  eq(subsAfter(gm,from).filter(x=>x==='c'),['c'],'vis='+vis);assert.equal(gm.R.state().combat.round,7);assert.equal(gm.R.auth.by().combatBy,keys.gm.key.fp);
  if(vis==='full')assert.equal(gm.R.state().combat.order[0].hp,5,'and it carries the HP as it is now');
 }
});

test('without this file a campaign whose room hides by default still hides: list, map and tracker chip',async()=>{
 const {gm,camp}=await table({gm:{vis:false,map:true}});camp.vis='hidden';
 camp.map={v:1,w:14,h:10,tokens:[{id:'p1',x:0,y:0},{id:'n1',x:4,y:4},{id:'n2',x:6,y:6},{id:'n3',x:9,y:9}],cover:[]};
 assert.equal(gm.window.RoomVisibility,undefined);
 let p=gm.R.combatPayload();
 eq(p.order.map(r=>r.name),['Ви','Джонни']);assert.doesNotMatch(JSON.stringify(p),/Бандит|Снайпер|4,4|6,6/);eq(p.map.t,[[0,0,0],[1,9,9]]);
 // One opened by hand is sent (as a plain row: this page cannot build more); the old flag still wins over it.
 camp.roster[1].vis='full';p=gm.R.combatPayload();
 eq(p.order.map(r=>r.name),['Ви','Бандит','Джонни']);eq(p.order[1],{name:'Бандит',pc:false,init:12,current:false});eq(p.map.t,[[0,0,0],[1,4,4],[2,9,9]]);
 camp.roster[1].hidden=true;eq(gm.R.combatPayload().order.map(r=>r.name),['Ви','Джонни']);
 // A value that is not a level opens nobody.
 delete camp.roster[1].hidden;for(const bad of ['hidden','FULL','',5,null,true]){camp.roster[1].vis=bad;eq(gm.R.combatPayload().order.map(r=>r.name),['Ви','Джонни'],String(bad))}
 // The Game Master's own map marks the hidden ones, and not the player's row.
 const html=gm.window.BattleMap.render(camp,gm.window.chars,'ru');
 assert.match(html,/bm-has bm-npc bm-hidden" data-bm-cell="4,4"/);assert.match(html,/bm-has bm-npc bm-hidden bm-out" data-bm-cell="6,6"/);assert.doesNotMatch(html,/bm-hidden" data-bm-cell="9,9"/);
 // Any other room level changes nothing on such a page.
 for(const v of [undefined,'name','state','full','bogus']){if(v===undefined)delete camp.vis;else camp.vis=v;delete camp.roster[1].vis;eq(gm.R.combatPayload().order.map(r=>r.name),['Ви','Бандит','Снайпер','Джонни'],String(v))}
 // The tracker shows the chip for those hidden by the room level alone.
 const h=tracker({vis:false,roster:[{id:'a',kind:'npc',name:'A',hp:30,ref:6,initiative:9,order:1},{id:'b',kind:'npc',name:'B',hp:30,ref:6,initiative:8,order:2,vis:'state'},{id:'o',kind:'npc',own:DEV_B+':j1',name:'O',hp:30,ref:6,initiative:7,order:3},{id:'p',kind:'pc',characterId:'v1',initiative:2,order:4}]});
 h.campaign.vis='hidden';
 const rows=h.render().split('class="combatant').slice(1),of=id=>rows.find(x=>x.includes('data-id="'+id+'"'));
 assert.match(of('a'),/camp-chip-hidden/);assert.doesNotMatch(of('b'),/camp-chip-hidden/);assert.doesNotMatch(of('o'),/camp-chip-hidden/);assert.doesNotMatch(of('p'),/camp-chip-hidden/);
});

test('a player\'s row that an older save marked hidden is listed and keeps its token on the players\' map',async()=>{
 const {gm,camp}=await table({gm:{map:true}});
 camp.roster[3].hidden=true; // the old «hide» button was offered for a player's row too
 camp.map={v:1,w:14,h:10,tokens:[{id:'n1',x:4,y:4},{id:'n3',x:9,y:9}],cover:[]};
 const p=gm.R.combatPayload();
 eq(p.order.map(r=>r.name),['Ви','Бандит','Снайпер','Джонни']);
 eq(p.map.t,[[1,4,4],[3,9,9]],'the row is in the list, so its token goes with it');
 assert.doesNotMatch(gm.window.BattleMap.render(camp,gm.window.chars,'ru'),/bm-hidden/);
 // An enemy hidden by hand still leaves no token.
 camp.roster[1].hidden=true;eq(gm.R.combatPayload().map.t,[[2,9,9]]);
});

test('only a row with labels may wrap in the room list; other rows are drawn as before',async()=>{
 const {gm,camp,page,msg,give}=await table();camp.roster[1].vis='state';
 const ann=page('ann','player');await give(ann,await msg('gm','combat',plain(gm.R.combatPayload()),'c'),'c');
 const html=ann.R.roomView(),li=name=>html.split('<li').find(x=>x.includes('<span>'+name+'</span>'));
 assert.match(li('Бандит'),/^ class="[^"]*\brv-has\b[^"]*"/);
 for(const name of ['Ви','Снайпер','Джонни'])assert.doesNotMatch(li(name),/rv-has/,name);
 const old=page('bob','player',{load:{vis:false}});await give(old,await msg('gm','combat',plain(gm.R.combatPayload()),'c'),'c');
 assert.doesNotMatch(old.R.roomView(),/rv-has/);
 const css=read('room-visibility.css');
 assert.match(css,/\.room-order li\.rv-has \{ flex-wrap: wrap; \}/);
 assert.doesNotMatch(css,/\.room-order li \{[^}]*flex-wrap/,'a rule for every row made long names drop under the number');
});

/* ---------- The tracker and the file ---------- */

function tracker({vis=true,roster}={}){
 let saves=0,renders=0;const window={GMTools:{NPC_TEMPLATES:[]}};
 const ctxVm={window,document:{querySelector:()=>null},confirm:()=>true,Math,Date,Promise,Number,String,Array,Object,JSON,globalThis:{crypto:{randomUUID:()=>'x'}}};
 if(vis)vm.runInNewContext(read('room-visibility.js'),ctxVm);
 vm.runInNewContext(read('campaigns.js'),ctxVm);
 const campaign={id:'c',name:'Job',notes:'',round:1,turnIndex:0,roster:roster||[{id:'a',kind:'npc',name:'A',hp:30,maxHp:30,ref:6,initiative:9,order:1},{id:'p',kind:'pc',characterId:'v1',initiative:2,order:2}]};
 const characters=[{id:'v1',name:'Ви',hp:45,stats:{REF:7,BODY:8,WILL:6}}];
 const ctx={lang:'ru',campaigns:[campaign],characters,isCurrent:x=>x===campaign,scope:'account',save:()=>saves++,render:()=>renders++,notify(){}};
 const C=window.Campaigns;
 C.handle({type:'click',target:{closest:()=>({dataset:{campaignAction:'open',id:'c'}})}},ctx);
 const change=(data,value)=>C.handle({type:'change',target:{dataset:data,value,closest:()=>null}},ctx);
 return {C,campaign,change,render:(lang='ru')=>C.render(ctx.campaigns,characters,lang),saves:()=>saves,renders:()=>renders,by:id=>campaign.roster.find(r=>r.id===id)};
}

test('the tracker offers the room level and a level per participant, saves a change and draws again',()=>{
 const h=tracker();let html=h.render();
 assert.match(html,/<select data-rv-room>/);assert.match(html,/<select data-rv-row="a">/);assert.match(html,/<select data-rv-row="p">/);
 assert.doesNotMatch(html,/data-campaign-action="hide"/,'the list replaces the old button');
 assert.doesNotMatch(html,/camp-chip-hidden/);
 const s=h.saves(),r=h.renders();
 assert.equal(h.change({rvRoom:''},'hidden'),true);assert.equal(h.campaign.vis,'hidden');assert.equal(h.saves(),s+1);assert.equal(h.renders(),r+1);
 html=h.render();
 const rowA=html.split('class="combatant').find(x=>x.includes('data-rv-row="a"')),rowP=html.split('class="combatant').find(x=>x.includes('data-rv-row="p"'));
 assert.match(rowA,/camp-chip-hidden">Скрыт от игроков</,'hidden by the room level shows the same chip');assert.doesNotMatch(rowP,/camp-chip-hidden/);
 assert.match(rowA,/<option value="hidden">Скрыт</);assert.doesNotMatch(rowP,/<option value="hidden"/);
 h.change({rvRow:'a'},'full');assert.equal(h.by('a').vis,'full');assert.doesNotMatch(h.render().split('class="combatant').find(x=>x.includes('data-rv-row="a"')),/camp-chip-hidden/);
 h.change({rvRow:'a'},'hidden');assert.equal(h.by('a').hidden,true);assert.equal('vis' in h.by('a'),false);
 // Nothing changed: nothing saved.
 const s2=h.saves();h.change({rvRow:'a'},'hidden');h.change({rvRow:'zzz'},'full');h.change({rvRoom:''},'nope');assert.equal(h.saves(),s2);
 assert.match(h.render('en'),/Players in the room see/);
});

test('without the file the tracker keeps the old button and chip',()=>{
 const h=tracker({vis:false});let html=h.render();
 assert.doesNotMatch(html,/data-rv-/);assert.match(html,/data-campaign-action="hide" data-id="a">Скрыть от игроков</);
 h.by('a').hidden=true;h.campaign.vis='hidden';h.by('a').vis='full';html=h.render();
 assert.match(html,/camp-chip-hidden">Скрыт от игроков</);assert.match(html,/data-campaign-action="hide" data-id="a">Показать игрокам</);
});

test('a campaign file carries the levels; values that are not levels are dropped; an old file is unchanged',()=>{
 const window={document:{addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]},crypto:{randomUUID:()=>'u-'+Math.random()},confirm:()=>true};
 const ctx={window,document:window.document,globalThis:window,Math,Number,String,Array,Object,Set,Map,WeakMap,JSON,Date,Promise,RegExp,Error,Infinity,setTimeout,clearTimeout,console,TextEncoder,URL,Blob};
 for(const f of ['beat-chart.js','campaigns.js','campaign-io.js'])vm.runInNewContext(read(f),ctx,{filename:f});
 const IO=window.CampaignIO,base={id:'camp-1',name:'Арасака',notes:'',round:1,turnIndex:0};
 const clean=c=>plain(IO.cleanCampaign(c).campaign);
 const got=clean({...base,vis:'state',roster:[{id:'r1',kind:'npc',name:'A',ref:6,hp:20,initiative:9,order:1,vis:'full'},{id:'r2',kind:'npc',name:'B',ref:6,hp:20,initiative:8,order:2,hidden:true},{id:'r3',kind:'pc',characterId:'pc-1',initiative:7,order:3,vis:'name'}]});
 assert.equal(got.vis,'state');eq(got.roster.map(r=>[r.vis,r.hidden]),[['full',undefined],[undefined,true],['name',undefined]]);
 assert.equal(clean({...base,vis:'hidden',roster:[]}).vis,'hidden');
 for(const bad of ['name','FULL','',5,{},['full'],null,true]){
  const c=clean({...base,vis:bad,roster:[{id:'r1',kind:'npc',name:'A',ref:6,hp:20,initiative:9,order:1,vis:bad==='name'?'hidden':bad}]});
  assert.equal('vis' in c,false,'campaign '+JSON.stringify(bad));assert.equal('vis' in c.roster[0],false,'row '+JSON.stringify(bad));
 }
 const old=clean({...base,roster:[{id:'r1',kind:'npc',name:'A',ref:6,hp:20,initiative:9,order:1}]});
 assert.equal('vis' in old,false);eq(old.roster[0],{id:'r1',kind:'npc',name:'A',ref:6,hp:20,initiative:9,order:1});
 // Out through the export and back in.
 const st={lang:'ru',characters:[],campaigns:[{...base,vis:'full',roster:[{id:'r1',kind:'npc',name:'A',ref:6,hp:20,initiative:9,order:1,vis:'state'}]}]};
 const r=IO.parse(JSON.stringify(IO.buildExport(st,{})));assert.equal(r.ok,true);
 assert.equal(r.bundle.campaigns[0].vis,'full');assert.equal(r.bundle.campaigns[0].roster[0].vis,'state');
});

test('the page loads the file before the room and its styles with the others',()=>{
 const html=read('index.html');
 assert.ok(html.includes('<link rel="stylesheet" href="room-visibility.css">'));
 const at=s=>html.indexOf(`<script src="${s}"></script>`);
 assert.ok(at('room-visibility.js')>0&&at('room-visibility.js')<at('room.js')&&at('room.js')<at('app.js'));
 assert.ok(html.trimEnd().endsWith('<script src="app.js"></script></body></html>'));
});
