// The real app.js drawn for the three role states: not chosen (today's menu plus the chooser), player and Game Master.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const eq=(a,b)=>assert.deepStrictEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
const source=n=>fs.readFileSync(__dirname+'/../site/'+n,'utf8');

function harness({role,lang='ru',view='overview',campaigns=[]}={}){
 const store=new Map(role?[['nc-role',role]]:[]),clicks=[];
 const app={innerHTML:'',setAttribute(){},addEventListener(){}},node=()=>({innerHTML:'',setAttribute(){},addEventListener(){}});
 const nodes={'#app':app,'#sync-root':node(),'#sync-adapter-status':node(),'#store-status':node()};
 const document={querySelector:s=>nodes[s]||null,documentElement:{},addEventListener:(k,f)=>{if(k==='click')clicks.push(f)}};
 const win={document,ROLES:[],CombatTools:{handle:()=>false},Book:{handle:()=>false},Campaigns:{handle:()=>false,render:()=>'<div id="camp"></div>'},NetTools:{setScope(){},validArchitectures:Array.isArray},RoleTools:{handle:()=>({handled:false})},
  GMTools:{render:()=>'<div id="gm"></div>',initial:()=>({})},
  LocalStore:{create(){return {start(){},getScope:()=>'account',canEdit:()=>true,save(){}}}},scrollTo(){},
  localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v))}};
 const ctx={window:win,document,localStorage:win.localStorage,globalThis:{crypto:{randomUUID:()=>'id'},addEventListener(){}},setTimeout:()=>0,clearTimeout(){},console,Math,Date,JSON,Set,Number,String,Array,Object,Promise,WeakMap};
 vm.createContext(ctx);
 for(const f of ['role-mode.js','getting-started.js'])vm.runInContext(source(f),ctx);
 vm.runInContext(source('app.js')+'\nwindow.qa={set:(v,l,c)=>{state.view=v;state.lang=l;state.campaigns=c||[]},draw:()=>render()};',ctx);
 win.qa.set(view,lang,campaigns);win.qa.draw();
 const redraw=(v,l,c)=>{win.qa.set(v,l,c);win.qa.draw();return app.innerHTML};
 return {win,app,store,redraw,click:(role,fromChooser)=>{for(const f of clicks)f({target:{closest:s=>s==='[data-role-set]'?{dataset:{roleSet:role},closest:q=>fromChooser&&q==='.role-chooser'?{}:null}:null}})}};
}
const sidebar=html=>html.slice(html.indexOf('<nav class="nav">'),html.indexOf('</nav>',html.indexOf('<nav class="nav">')));
const bottom=html=>html.slice(html.indexOf('<nav class="bottom-nav"'));
const views=part=>[...part.matchAll(/data-action="navigate" data-view="([a-z-]+)"/g)].map(m=>m[1]);
const home=html=>html.slice(html.indexOf('<div class="quick-grid">'),html.indexOf('</div>',html.indexOf('<div class="quick-grid">')+30));

test('not chosen: the menu, the bottom bar and the cards are the old ones, plus the chooser on the home page',()=>{
 const h=harness();
 eq(views(sidebar(h.app.innerHTML)),['overview','characters','dice','combat','room','campaigns','rules','catalog','lifepath','book','gm','net','medical','repair']);
 eq(views(bottom(h.app.innerHTML)),['overview','characters','combat','dice']);
 eq(views(home(h.app.innerHTML)),['rules','dice','combat','campaigns','catalog','gm','net','book']);
 assert.match(h.app.innerHTML,/class="role-chooser"/);assert.match(h.app.innerHTML,/Кто вы за столом\?/);
 assert.ok(h.app.innerHTML.indexOf('role-chooser')<h.app.innerHTML.indexOf('class="hero'),'at the top of the home page');
 assert.equal(sidebar(h.app.innerHTML).includes('nav-group-label">Ведущему'),false);
 assert.match(h.app.innerHTML,/class="role-switch" role="group" aria-label="Роль"/);
 assert.doesNotMatch(h.redraw('characters','ru'),/role-chooser/,'only the home page asks');
});

test('player: no Game Master entries in the menu, the home cards or the guide; the bottom bar is as before',()=>{
 for(const lang of ['ru','en']){
  const h=harness({role:'player',lang}),html=h.app.innerHTML,menu=views(sidebar(html));
  assert.ok(!menu.includes('gm')&&!menu.includes('campaigns'));assert.ok(menu.includes('room')&&menu.includes('net')&&menu.includes('news')||menu.includes('room'));
  eq(views(bottom(html)),['overview','characters','combat','dice']);
  eq(views(home(html)),['rules','dice','combat','catalog','net','book']);
  assert.doesNotMatch(html,/role-chooser/);assert.match(html,/data-role-set="player" aria-pressed="true"/);
  const guide=html.slice(html.indexOf('class="getting-started"'));
  assert.doesNotMatch(guide,/data-view="(gm|campaigns)"/,'neither the steps nor the directory point at GM screens');
  assert.match(guide,/data-view="room"/);assert.equal((guide.match(/<li>/g)||[]).length,4,'still four steps');
 }
});

test('gm: the «Ведущему» group comes first, the bottom bar and the cards follow, nothing is duplicated',()=>{
 const h=harness({role:'gm'}),html=h.app.innerHTML,menu=views(sidebar(html));
 eq(menu.slice(0,3),['campaigns','gm','room']);assert.equal(menu.length,new Set(menu).size);
 assert.ok(sidebar(html).indexOf('Ведущему')<sidebar(html).indexOf('Игра'));
 eq(views(bottom(html)),['overview','campaigns','room','gm']);
 eq(views(home(html)).slice(0,2),['campaigns','gm']);
 assert.doesNotMatch(html,/role-chooser/);assert.match(html,/data-role-set="gm" aria-pressed="true"/);
 const en=harness({role:'gm',lang:'en'}).app.innerHTML;assert.match(sidebar(en),/Game Master/);
});

test('a Game Master screen opens in full for a player, with the notice on top; not for the other roles',()=>{
 const h=harness({role:'player',view:'gm'});
 assert.match(h.app.innerHTML,/id="gm"/,'the screen itself is drawn');
 const html=h.app.innerHTML;assert.match(html,/Это экран ведущего\. Сейчас выбрана роль игрока\./);
 assert.ok(html.indexOf('role-notice')<html.indexOf('id="gm"')&&html.indexOf('role-notice')>html.indexOf('id="main-content"'));
 assert.match(h.redraw('campaigns','en'),/This is a Game Master screen/);
 assert.doesNotMatch(h.redraw('overview','ru'),/role-notice/);assert.doesNotMatch(h.redraw('net','ru'),/role-notice/);
 for(const role of [undefined,'gm'])assert.doesNotMatch(harness({role,view:'gm'}).app.innerHTML,/role-notice/);
});

test('the notice stays away from the tracker while the first-run trial fight is what the player is doing',()=>{
 const trial={id:'t',name:'Trial',roster:[],trial:{version:1}},done={id:'d',name:'Done',roster:[],trial:{version:1,done:true}},own={id:'o',name:'Mine',roster:[]};
 assert.doesNotMatch(harness({role:'player',view:'campaigns',campaigns:[trial]}).app.innerHTML,/role-notice/);
 assert.match(harness({role:'player',view:'campaigns',campaigns:[done,own]}).app.innerHTML,/role-notice/);
 assert.match(harness({role:'player',view:'gm',campaigns:[trial]}).app.innerHTML,/role-notice/,'only the tracker is excused');
});

test('pressing a role redraws the same screen with the new menu, and the notice button switches to the GM',()=>{
 const h=harness({role:'player',view:'gm'});
 h.click('gm');
 assert.equal(h.store.get('nc-role'),'gm');assert.match(h.app.innerHTML,/id="gm"/,'still on the same screen');
 assert.doesNotMatch(h.app.innerHTML,/role-notice/);eq(views(sidebar(h.app.innerHTML)).slice(0,3),['campaigns','gm','room']);
 const c=harness();c.click('player',true);
 assert.doesNotMatch(c.app.innerHTML,/role-chooser/);assert.ok(!views(sidebar(c.app.innerHTML)).includes('gm'));
 assert.match(c.app.innerHTML,/class="hero/,'still the home page');
});

test('the role never enters the saved archive',()=>{
 const h=harness({role:'gm'});
 h.win.qa.set('overview','ru');
 assert.doesNotMatch(source('app.js').match(/function snapshotAppState[^\n]*/)?.[0]||'',/nc-role|RoleMode/);
 eq([...h.store.keys()],['nc-role']);
});

// The room's start screen: the role only decides which card comes first; both stay, and nothing here writes the role.
test('the room start screen puts «Присоединиться» first for a player and «Создать» first otherwise',()=>{
 const render=role=>{
  const store=new Map(role?[['nc-role',role]]:[]),document={addEventListener(){},querySelector:()=>null,visibilityState:'visible'};
  const win={document,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},crypto:globalThis.crypto,location:{hash:'',origin:'https://example.test',pathname:'/'},addEventListener(){},navigator:{}};
  const ctx={window:win,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Error,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},console};
  vm.createContext(ctx);vm.runInContext(source('role-mode.js')+'\n'+source('room-transport.js')+'\n'+source('room.js'),ctx);
  win.Room.attach?.({getState:()=>({characters:[],campaigns:[],lang:'ru'}),notify(){},rerender(){}});
  return {html:win.Room.render(),store};
 };
 for(const [role,joinFirst] of [[undefined,false],['gm',false],['player',true]]){
  const {html,store}=render(role),join=html.indexOf('data-room-action="join"'),create=html.indexOf('data-room-action="create"');
  assert.ok(join>0&&create>0,'both cards stay');assert.equal(join<create,joinFirst,String(role));
  assert.equal(store.get('nc-role'),role,'opening the room never changes the role');
 }
});
