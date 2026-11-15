const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=n=>fs.readFileSync(__dirname+'/../site/'+n,'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
// app.js as the page loads it, with or without char-tags.js next to it.
function harness({tags=true}={}){
 const events={},saved=[],notices=[],node=()=>({innerHTML:'',setAttribute(){},addEventListener:(k,f)=>events[k]=f}),nodes={'#app':node(),'#sync-root':node(),'#sync-adapter-status':node(),'#app-notice':{set textContent(v){notices.push(v)},classList:{add(){},remove(){}}}};
 let uid='copy-id';const win={ROLES:[{id:'solo',name:{ru:'Соло',en:'Solo'},description:{ru:'',en:''}}],CombatTools:{handle:()=>false},Book:{handle:()=>false},Campaigns:{handle:()=>false},NetTools:{setScope(){},validArchitectures:Array.isArray},RoleTools:{handle:()=>({handled:false})},LocalStore:{create(){return {start(){},getScope:()=>'account',canEdit:()=>true,save:s=>{saved.push(JSON.parse(JSON.stringify(s)))}}}},scrollTo(){}};
 const ctx={window:win,document:{querySelector:s=>nodes[s]||null,documentElement:{}},localStorage:{getItem:()=>null},globalThis:{crypto:{randomUUID:()=>uid},addEventListener(){}},setTimeout:()=>0,clearTimeout(){},console,Math,Date,JSON,Set,Number,String,Array,Object,Promise,WeakMap};vm.createContext(ctx);
 vm.runInContext(source('character-extra.js'),ctx);vm.runInContext(source('equipment-tools.js'),ctx);if(tags)vm.runInContext(source('char-tags.js'),ctx);
 vm.runInContext(source('app.js')+'\nconst realRender=render;render=()=>{};window.qa={realRender,set:(c,v,lang)=>{state.characters=c;state.view=v;state.lang=lang||"ru"},state:()=>state,snapshot:snapshotAppState,characters,overview,save,importSheet,sheetPrint};',ctx);
 const mk=(id,name,extra={})=>({id,name,role:'solo',rank:4,stats:{INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{Handgun:4},hp:27,humanity:52,head:7,bodyArmor:8,extra:{items:[],weapons:[],specializations:[],ipLog:[],uid:id,updatedAt:1000,...extra}});
 const click=(action,id)=>{const card={isConnected:true,dataset:{characterCard:id}},button={isConnected:true,dataset:{action,id},closest:s=>s==='[data-character-card]'?card:null};events.click({type:'click',target:{closest:s=>s==='[data-action]'?button:null}})};
 return {win,ctx,qa:win.qa,mk,saved,notices,click,uid:x=>uid=x};
}

test('the «Персонажи» page gets the bar above the list and a folder line with an editor on every card',()=>{
 const h=harness(),a=h.mk('a','Vee',{folder:'Банда',tags:['долг']}),b=h.mk('b','Rook');h.qa.set([a,b],'characters');
 const html=h.qa.characters();
 assert.ok(html.indexOf('data-char-tags-root')>0&&html.indexOf('data-char-tags-root')<html.indexOf('class="character-grid"'),'the bar is above the list');
 assert.ok(html.indexOf('class="countbar"')<html.indexOf('data-char-tags-root'));
 for(const id of ['a','b'])assert.match(html,new RegExp(`data-character-card="${id}".*data-char-tags-card="${id}".*</article>`));
 assert.equal((html.match(/data-char-tags-card=/g)||[]).length,2);assert.match(html,/aria-label="Папка и метки: Vee"/);assert.match(html,/data-char-tags="folder" value="банда"/);
 h.qa.set([a,b],'characters','en');assert.match(h.qa.characters(),/aria-label="Folder and tags: Rook"/);
});
test('the cards of the first page have no editor, and the page works without the module',()=>{
 const h=harness(),a=h.mk('a','Vee',{folder:'Банда',tags:['долг']});h.qa.set([a],'overview');
 const first=h.qa.overview();assert.match(first,/data-character-card="a"/);assert.doesNotMatch(first,/char-tags/);
 const bare=harness({tags:false});bare.qa.set([a],'characters');const html=bare.qa.characters();
 assert.match(html,/<\/b><\/div><div class="character-grid"><article class="character-card" data-character-card="a">/,'the old markup');assert.doesNotMatch(html,/char-tags|undefined/);
 // A build without the module keeps the fields it does not know.
 bare.qa.save();assert.equal(bare.saved.at(-1).characters[0].extra.folder,'Банда');assert.deepEqual(bare.saved.at(-1).characters[0].extra.tags,['долг']);
});
test('sheets without a folder or tags are drawn and saved exactly as before',()=>{
 const h=harness(),a=h.mk('a','Vee'),b=h.mk('b','Rook');h.qa.set([a,b],'characters');h.qa.save();
 const before=JSON.stringify(h.qa.snapshot().characters);h.qa.characters();h.qa.save();
 assert.equal(JSON.stringify(h.qa.snapshot().characters),before);assert.equal('folder' in a.extra,false);assert.equal('tags' in a.extra,false);
});
test('filing a sheet is not an edit: the time of the latest edit moves for a new name, not for a folder or tags',()=>{
 const h=harness(),a=h.mk('a','Vee');h.qa.set([a],'characters');h.qa.save();
 const t0=a.extra.updatedAt;assert.ok(Number.isFinite(t0));
 h.win.CharTags.set(a,{folder:'Банда'});h.qa.save();assert.equal(a.extra.updatedAt,t0);assert.equal(h.saved.at(-1).characters[0].extra.folder,'Банда','yet it is written');
 h.win.CharTags.set(a,{tags:'долг, босс'});h.qa.save();assert.equal(a.extra.updatedAt,t0);
 h.win.CharTags.set(a,{folder:'',tags:''});h.qa.save();assert.equal(a.extra.updatedAt,t0);
 a.name='Vee Second';h.qa.save();assert.ok(a.extra.updatedAt>t0,'a real change still counts');
 assert.equal(h.qa.sheetPrint(h.mk('x','X',{folder:'A',tags:['b']})),h.qa.sheetPrint(h.mk('x','X')));
 assert.notEqual(h.qa.sheetPrint({...h.mk('x','X'),folder:'a field of the sheet itself is another matter'}),h.qa.sheetPrint(h.mk('x','X')));
});
test('a sheet that arrives over one already here leaves the local folder and tags, whatever it brings',()=>{
 const h=harness(),mine=h.mk('a','Vee',{folder:'Мои игроки',tags:['долг'],sourceKey:'room:p1:v1'});h.qa.set([mine],'characters');h.qa.save();
 const sent=()=>{const c=h.mk('v1','Vee',{updatedAt:2000});c.hp=11;return c};
 let res=h.qa.importSheet(sent(),{sourceKey:'room:p1:v1'});assert.equal(res.ok,true);assert.equal(res.updated,true);
 let now=h.qa.state().characters[0];assert.equal(now.hp,11);assert.equal(now.extra.folder,'Мои игроки');assert.deepEqual(plain(now.extra.tags),['долг']);
 // The sender filed the same sheet their own way, or a crafted link names an empty folder or junk: the receiver's filing stays, both fields.
 let hp=12;for(const came of [{folder:'  Их папка  ',tags:['#x','x','y']},{folder:''},{folder:'Только папка'},{tags:['x']},{tags:null},{folder:{a:1}}]){
  const theirs=sent();theirs.hp=hp++;Object.assign(theirs.extra,came);
  res=h.qa.importSheet(theirs,{replace:'a'});assert.equal(res.ok,true,JSON.stringify(came));now=h.qa.state().characters[0];
  assert.equal(now.hp,hp-1,'the sheet itself is updated');assert.equal(now.extra.folder,'Мои игроки',JSON.stringify(came));assert.deepEqual(plain(now.extra.tags),['долг'],JSON.stringify(came));
 }
 // A copy the receiver left unfiled stays unfiled.
 const g=harness(),bare=g.mk('b','Rook');g.qa.set([bare],'characters');g.qa.save();
 const filed=g.mk('v2','Rook',{folder:'Их папка',tags:['x']});filed.hp=3;
 assert.equal(g.qa.importSheet(filed,{replace:'b'}).ok,true);now=g.qa.state().characters[0];assert.equal(now.hp,3);assert.equal('folder' in now.extra,false);assert.equal('tags' in now.extra,false);
});
test('an update that differs only by folder or tags changes nothing, so nothing is lost and nothing goes to the bin',()=>{
 // The sheet is taken in once first, so that the copy on the device has every field an import gives it.
 const h=harness();h.qa.set([],'characters');h.uid('a');assert.equal(h.qa.importSheet(h.mk('v1','Vee',{folder:'Старая'}),{}).id,'a');
 const same=plain(h.qa.state().characters[0]);same.extra.folder='Новая';same.extra.tags=['t'];
 const res=h.qa.importSheet(same,{replace:'a'});assert.equal(res.ok,true);assert.equal(res.kept,false);assert.equal((h.qa.state().bin||[]).length,0);
 assert.equal(h.qa.state().characters[0].extra.folder,'Старая');assert.equal('tags' in h.qa.state().characters[0].extra,false);
 const other=plain(same);other.hp=1;assert.equal(h.qa.importSheet(other,{replace:'a'}).kept,true,'a real difference still keeps the old version');
 // The version in the bin and the one that replaced it are filed the same way: bringing the old one back loses nothing either.
 assert.equal(h.qa.state().bin[0].character.extra.folder,'Старая');assert.equal(h.qa.state().characters[0].extra.folder,'Старая');
});
test('every redraw of the «Персонажи» page applies the filter again, and no other page asks for it',()=>{
 // The filter hides cards in place; a redraw (another language, a deleted card and its undo) brings fresh cards that must be hidden again.
 const calls=[],h=harness(),a=h.mk('a','Vee',{folder:'Банда'}),b=h.mk('b','Rook');
 h.win.CharTags.apply=(root,lang)=>calls.push([root===h.ctx.document,lang]);
 h.qa.set([a,b],'characters','en');h.qa.realRender();assert.deepEqual(calls,[[true,'en']]);
 h.qa.set([a,b],'characters','ru');h.qa.realRender();assert.deepEqual(calls.at(-1),[true,'ru']);assert.equal(calls.length,2);
 h.qa.set([a,b],'overview');h.qa.realRender();assert.equal(calls.length,2);
 const bare=harness({tags:false});bare.qa.set([a,b],'characters');assert.doesNotThrow(()=>bare.qa.realRender());
});
test('a new sheet from a link or a file brings the folder and tags of the sender, cut to size',()=>{
 const h=harness();h.qa.set([],'characters');
 const c=h.mk('n1','New',{folder:'F'.repeat(90),tags:[...Array.from({length:30},(_,i)=>'tag'+i),5,null]});
 const res=h.qa.importSheet(c,{});assert.equal(res.ok,true);const got=h.qa.state().characters[0];
 assert.equal(got.extra.folder,'F'.repeat(40));assert.equal(got.extra.tags.length,8);assert.deepEqual(plain(got.extra.tags.slice(0,2)),['tag0','tag1']);
 const odd=h.mk('n2','Odd',{folder:{a:1},tags:'nope'});h.qa.importSheet(odd,{});const o=h.qa.state().characters[0];assert.equal(o.name,'Odd');assert.equal('folder' in o.extra,false);assert.equal('tags' in o.extra,false);
 // Without the module an import still works and keeps what it was given.
 const bare=harness({tags:false});bare.qa.set([],'characters');assert.equal(bare.qa.importSheet(h.mk('n3','Bare',{folder:'X',tags:['y']}),{}).ok,true);assert.equal(bare.qa.state().characters[0].extra.folder,'X');
});
test('a duplicate lands in the same folder with the same tags, as a list of its own',()=>{
 const h=harness(),a=h.mk('a','Vee',{folder:'Банда',tags:['долг','босс']});h.qa.set([a],'characters','en');h.click('duplicate','a');
 const list=h.qa.state().characters;assert.equal(list.length,2);const copy=list.find(c=>c.id==='copy-id');
 assert.equal(copy.extra.folder,'Банда');assert.deepEqual(plain(copy.extra.tags),['долг','босс']);assert.notEqual(copy.extra.tags,a.extra.tags);
 copy.extra.tags.push('new');assert.equal(a.extra.tags.length,2);
});
test('a backup file carries the folder and tags, and reading it back keeps them',()=>{
 const h=harness(),a=h.mk('a','Vee',{folder:'Банда',tags:['долг']});h.qa.set([a],'characters');h.qa.save();
 assert.equal(h.saved.at(-1).characters[0].extra.folder,'Банда');
 const file=h.qa.snapshot(),read=h.win.App.archive.read(plain(file));
 assert.equal(JSON.stringify(read).includes('"folder":"Банда"'),true);assert.equal(JSON.stringify(read).includes('"tags":["долг"]'),true);
});
