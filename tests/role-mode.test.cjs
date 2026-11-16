// «Игрок / Ведущий» (site/role-mode.js): a view preference kept in its own key. The unset state is today's menu, unchanged;
// the player's menu loses the Game Master screens; the GM's menu puts them first. Nothing here touches the archive.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const eq=(a,b)=>assert.deepStrictEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
const source=n=>fs.readFileSync(__dirname+'/../site/'+n,'utf8');

// A stand-in page: a storage that may be absent or broken, a document that remembers its click listeners, and App.render.
function load({store={},broken=false,failWrite=false}={}){
 const map=new Map(Object.entries(store)),writes=[],clicks=[],renders=[],focused=[];
 const localStorage=broken?{getItem(){throw new Error('no storage')},setItem(){throw new Error('no storage')}}
  :{getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>{if(failWrite)throw new Error('full');writes.push([k,String(v)]);map.set(k,String(v))}};
 const main={focus:o=>focused.push(['main',o])},pressed={focus:o=>focused.push(['switch',o])};
 const document={addEventListener:(k,f)=>{if(k==='click')clicks.push(f)},querySelector:s=>s==='#main-content'?main:s.startsWith('.role-switch')?pressed:null};
 const window={document,localStorage,App:{render:()=>renders.push(1)}};
 vm.runInNewContext(source('role-mode.js'),{window});
 const click=(role,fromChooser=false,fromNotice=false)=>{for(const f of clicks)f({target:{closest:s=>s==='[data-role-set]'?{dataset:{roleSet:role},closest:q=>(fromChooser&&q.includes('.role-chooser'))||(fromNotice&&q.includes('.role-notice'))?{}:null}:null}})};
 return {R:window.RoleMode,map,writes,renders,focused,click,window};
}
const NAV=[['Игра',['overview','characters','dice','combat','room','campaigns']],['Справочник',['rules','catalog','lifepath','book']],['Инструменты',['gm','net','medical','repair']],['Приложение',['news']]];
const flat=g=>g.flatMap(([,v])=>v);
const CYR=/[А-Яа-яЁё]/;

test('nothing, garbage or a broken storage mean «not chosen», and the key is nc-role',()=>{
 assert.equal(load().R.KEY,'nc-role');
 for(const raw of [undefined,'','GM','Player','gm ','1','null','{"role":"gm"}']){
  const {R}=load({store:raw===undefined?{}:{'nc-role':raw}});
  assert.equal(R.get(),null,JSON.stringify(raw));assert.equal(R.isSet(),false);assert.equal(R.hides('gm'),false);
 }
 const dead=load({broken:true});assert.equal(dead.R.get(),null);assert.equal(dead.R.isSet(),false);
 assert.equal(load({store:{'nc-role':'player'}}).R.get(),'player');assert.equal(load({store:{'nc-role':'gm'}}).R.get(),'gm');
});

test('set accepts only the two roles, writes only its own key, and still holds for the visit when storage fails',()=>{
 const h=load();
 assert.equal(h.R.set('admin'),false);assert.equal(h.R.set(''),false);assert.equal(h.R.set(undefined),false);assert.equal(h.writes.length,0);
 assert.equal(h.R.set('player'),true);eq(h.writes,[['nc-role','player']]);assert.equal(h.R.get(),'player');
 assert.equal(h.R.set('gm'),true);assert.equal(h.R.get(),'gm');
 for(const opts of [{broken:true},{failWrite:true}]){
  const s=load(opts);assert.equal(s.R.set('gm'),true,'no exception');assert.equal(s.R.get(),'gm');assert.equal(s.R.isSet(),true);
  assert.equal(s.R.set('player'),true);assert.equal(s.R.get(),'player');
 }
});

test('only a player loses the Game Master views, and only gm and campaigns are Game Master views',()=>{
 eq([...load().R.GM_VIEWS],['gm','campaigns']);
 const p=load({store:{'nc-role':'player'}}).R;
 assert.equal(p.hides('gm'),true);assert.equal(p.hides('campaigns'),true);
 for(const v of ['overview','characters','room','net','dice','sheet','news'])assert.equal(p.hides(v),false,v);
 for(const role of ['gm',undefined])assert.equal(load(role?{store:{'nc-role':role}}:{}).R.hides('gm'),false);
});

test('unset: the menu, the bottom bar and the cards are what they were',()=>{
 const {R}=load(),cards=[['rules'],['campaigns'],['gm']];
 eq(R.groups(NAV,'ru'),NAV);eq(R.bottom(['characters','combat','dice','room']),['characters','combat','dice','room']);
 eq(R.cards(cards),cards);
});

test('player: no gm and no campaigns anywhere, empty groups vanish, the input is not changed',()=>{
 const {R}=load({store:{'nc-role':'player'}}),before=JSON.stringify(NAV),g=R.groups(NAV,'en');
 assert.equal(JSON.stringify(NAV),before);
 assert.ok(!flat(g).includes('gm')&&!flat(g).includes('campaigns'));
 assert.ok(flat(g).includes('room')&&flat(g).includes('net'),'room and net stay');
 eq(R.groups([['Only GM',['gm','campaigns']],['Rest',['dice']]],'ru'),[['Rest',['dice']]]);
 eq(R.bottom(['characters','combat','dice','room']),['characters','combat','dice','room']);
 eq(R.cards([['rules'],['campaigns'],{view:'gm'},'net']),[['rules'],'net']);
});

test('gm: a first group «Ведущему» with campaigns, gm and room, and no view appears twice',()=>{
 for(const lang of ['ru','en']){
  const {R}=load({store:{'nc-role':'gm'}}),g=R.groups(NAV,lang);
  eq(g[0],[lang==='ru'?'Ведущему':'Game Master',['campaigns','gm','room']]);
  const all=flat(g);assert.equal(all.length,new Set(all).size,'no duplicates');
  eq([...all].sort(),[...flat(NAV)].sort(),'nothing lost');
  eq(g.slice(1).map(([l])=>l),['Игра','Справочник','Инструменты','Приложение'].filter(Boolean));
 }
 const {R}=load({store:{'nc-role':'gm'}});
 // A group left empty by the move is dropped.
 eq(R.groups([['A',['gm','campaigns']],['B',['dice']]],'ru').map(([l])=>l),['Ведущему','B']);
});

test('gm: the phone bottom bar and the home cards put the Game Master first',()=>{
 const {R}=load({store:{'nc-role':'gm'}});
 eq(R.bottom(['characters','combat','dice','room']),['campaigns','room','dice','gm']);
 const cards=[['rules'],['dice'],['campaigns'],['catalog'],['gm'],['net']];
 eq(R.cards(cards).map(c=>c[0]),['campaigns','gm','rules','dice','catalog','net']);
 eq(R.cards([['rules']]).map(c=>c[0]),['rules']);
});

test('the chooser exists only while unset, has two buttons and a hint, in both languages',()=>{
 const un=load().R;
 for(const lang of ['ru','en']){
  const html=un.chooser(lang);
  assert.match(html,/aria-labelledby="role-chooser-title"/);assert.match(html,/id="role-chooser-title"/);
  assert.equal((html.match(/data-role-set="player"/g)||[]).length,1);assert.equal((html.match(/data-role-set="gm"/g)||[]).length,1);
  assert.equal(CYR.test(html),lang==='ru');
 }
 assert.match(un.chooser('ru'),/Кто вы за столом\?/);assert.match(un.chooser('ru'),/Я игрок/);assert.match(un.chooser('ru'),/Я ведущий/);
 assert.match(un.chooser('ru'),/в меню в любой момент/);
 assert.equal(load({store:{'nc-role':'player'}}).R.chooser('ru'),'');assert.equal(load({store:{'nc-role':'gm'}}).R.chooser('en'),'');
});

test('the switch is a named group of two pressed-state buttons that follows the role',()=>{
 for(const [role,player,gm] of [[null,'false','false'],['player','true','false'],['gm','false','true']]){
  const R=load(role?{store:{'nc-role':role}}:{}).R,ru=R.switchHTML('ru'),en=R.switchHTML('en');
  assert.match(ru,/role="group" aria-label="Роль"/);assert.match(en,/role="group" aria-label="Role"/);
  assert.match(ru,new RegExp(`data-role-set="player" aria-pressed="${player}"`));assert.match(ru,new RegExp(`data-role-set="gm" aria-pressed="${gm}"`));
  assert.match(ru,/>Игрок</);assert.match(ru,/>Ведущий</);assert.match(en,/>Player</);assert.match(en,/>Game Master</);assert.doesNotMatch(en,CYR);
 }
});

test('the notice shows only to a player on a Game Master screen, with the button that switches',()=>{
 const p=load({store:{'nc-role':'player'}}).R;
 for(const view of ['gm','campaigns']){
  const ru=p.notice(view,'ru'),en=p.notice(view,'en');
  assert.match(ru,/Это экран ведущего\. Сейчас выбрана роль игрока\./);assert.match(ru,/data-role-set="gm"/);assert.match(ru,/Переключить на ведущего/);
  assert.match(en,/Switch to Game Master/);assert.doesNotMatch(en,CYR);
 }
 for(const view of ['overview','room','net','characters','sheet'])assert.equal(p.notice(view,'ru'),'',view);
 assert.equal(p.notice('campaigns','ru',{quiet:true}),'','the trial fight is why they are here');
 assert.equal(load().R.notice('gm','ru'),'');assert.equal(load({store:{'nc-role':'gm'}}).R.notice('gm','ru'),'');
});

test('every string is in both languages, Russian is formal, and output is escaped',()=>{
 const {R}=load();
 for(const key of ['chooserTitle','player','gm','chooserHint','switchLabel','switchPlayer','switchGm','groupGm','notice','noticeButton']){
  assert.ok(R.t('ru',key)&&R.t('en',key),key);assert.match(R.t('ru',key),CYR);assert.doesNotMatch(R.t('en',key),CYR);
 }
 assert.equal(R.t('de','player'),R.t('ru','player'),'an unknown language falls back to Russian');assert.equal(R.t('en','nope'),'');
 assert.doesNotMatch(['chooserHint','notice'].map(k=>R.t('ru',k)).join(' '),/\b(ты|тебя|тебе|твой)\b/i);
 // Labels from the caller are escaped in the Game Master group heading path as well (the group label is ours, but the page never trusts markup).
 assert.doesNotMatch(R.chooser('ru')+R.switchHTML('en'),/<script/i);
});

test('the notice button is gone after the redraw, so the focus goes to the content and not to a hidden menu',()=>{
 const h=load({store:{'nc-role':'player'}});
 h.click('gm',false,true);
 assert.equal(h.R.get(),'gm');eq(h.focused.map(f=>f[0]),['main']);
});

test('the board look keeps the 44 px target on the chooser and the notice buttons',()=>{
 const css=source('role-mode.css');
 assert.match(css,/html\.ui-native\.ui-board \.role-chooser \.btn,html\.ui-native\.ui-board \.role-notice \.btn\{min-height:44px\}/);
 assert.match(source('board.css'),/html\.ui-native\.ui-board :is\(\.btn[^)]*\) \{\s*min-height: 40px/,'the rule being overridden is still there');
});

test('clicking a role button saves it, redraws the page and puts the focus back',()=>{
 const h=load();
 h.click('player',true);
 eq(h.writes,[['nc-role','player']]);assert.equal(h.renders.length,1);eq(h.focused.map(f=>f[0]),['main'],'the chooser is gone, so the page takes the focus');
 h.click('gm');assert.equal(h.R.get(),'gm');assert.equal(h.renders.length,2);assert.equal(h.focused.at(-1)[0],'switch');
 h.click('owner');assert.equal(h.renders.length,2,'an unknown role is ignored');assert.equal(h.map.get('nc-role'),'gm');
 const dead=load({broken:true});dead.click('gm');assert.equal(dead.R.get(),'gm');assert.equal(dead.renders.length,1,'works for the visit without storage');
});

test('the role is a view preference: it is not part of the saved archive, transfers or room messages',()=>{
 for(const f of ['transfer.js','share-link.js','campaign-io.js','local-store.js','room-transport.js'])assert.doesNotMatch(source(f),/nc-role|RoleMode/,f);
 // The module touches exactly one storage key and reads nothing else.
 eq(source('role-mode.js').match(/localStorage\.\w+\(/g),['localStorage.getItem(','localStorage.setItem(']);
 assert.doesNotMatch(source('role-mode.js'),/nightcity-red-v1|fetch\(|XMLHttpRequest|WebSocket/);
});
