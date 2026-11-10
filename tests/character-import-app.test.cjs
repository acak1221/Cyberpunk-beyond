const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=n=>fs.readFileSync(__dirname+'/../site/'+n,'utf8'),plain=x=>JSON.parse(JSON.stringify(x));
const stats={INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6};
const sheet=(id,extra,more={})=>({id,name:id,role:'solo',rank:4,stats:{...stats},skills:{Handgun:2},hp:45,humanity:60,...(extra?{extra}:{}),...more});
const PNG='data:image/png;base64,iVBORw0KGgo=';
// Loads app.js with a saved archive and a LocalStore stub whose writes can be made to fail (a full browser storage).
function harness(archive={characters:[]},{shareLink=null,draw=false}={}){
 const saved=[],writes=[],notices=[],events={};let fails=0,pending=null,uid=0,clock=1_700_000_000_000,editable=true;
 const adapter={stateLabel:()=>'',start(){},canEdit:()=>editable,getScope:()=>'local',hasQueued:()=>false,
  save(s){pending=plain(s);saved.push(pending);return Promise.resolve({ok:true})},
  flush(){if(!pending)return {ok:true};const s=pending;pending=null;if(fails>0){fails--;return {ok:false,reason:'storage'}}writes.push(s);return {ok:true}}};
 const nodes={'#app':{innerHTML:'',setAttribute(){},addEventListener(t,fn){events[t]=fn}},'#app-notice':{set textContent(v){notices.push(v)},classList:{add(){},remove(){}}}};
 const w={ROLES:[{id:'solo',name:{en:'Solo',ru:'Соло'},description:{en:'',ru:''}}],CombatTools:{handle:()=>false},Book:{handle:()=>false},Campaigns:{handle:()=>false,render:()=>''},NetTools:{setScope(){},validArchitectures:Array.isArray},RoleTools:{render:()=>'',handle:()=>({handled:false}),refresh(){}},LocalStore:{create:()=>adapter},ShareLink:shareLink||undefined,confirm:()=>true,scrollTo(){}};
 class FakeDate extends Date{static now(){return clock}}
 const ctx={window:w,document:{querySelector:s=>nodes[s]||null,documentElement:{},title:''},localStorage:{getItem:k=>k==='nightcity-red-v1'?JSON.stringify({campaigns:[],lang:'en',...archive}):null,setItem(){}},globalThis:{crypto:{randomUUID:()=>'id-'+(++uid)}},setTimeout:()=>0,clearTimeout(){},console,Math,Date:FakeDate,JSON,Set,Map,Number,String,Array,Object,Promise,WeakMap};
 vm.createContext(ctx);for(const f of ['character-extra.js','equipment-tools.js'])vm.runInContext(source(f),ctx);
 vm.runInContext(source('app.js')+(draw?'':'\nrender=()=>{};')+'\nwindow.qa={state:()=>state,go:(v,id)=>{state.view=v;state.active=id},toBin:moveToBin,fromBin:restoreFromBin};',ctx);
 const change=(id,data)=>{const target={id,files:[{text:async()=>JSON.stringify(data)}],value:'x',isConnected:true,dataset:{}};nodes['#'+id]=target;w.qa.go('characters',null);return events.change({type:'change',target})};
 return {w,App:w.App,state:()=>w.qa.state(),chars:()=>w.qa.state().characters,saved,writes,notices,change,at:()=>clock,tick:(ms=60000)=>{clock+=ms},failWrites:n=>{fails=n},pause:()=>{editable=false}};
}

test('a sheet from a link is cut to what the editors accept: name, text, lists, nesting and odd keys',()=>{
 const h=harness({characters:[sheet('a')]});
 let deep={};const root=deep;for(let i=0;i<40;i++){deep.next={};deep=deep.next}
 const extra=JSON.parse('{"__proto__":{"polluted":true},"items":[],"weapons":[]}');extra.items=Array.from({length:1500},(_,i)=>({id:'i'+i,name:'x'}));extra.items[0]=JSON.parse('{"id":"i0","name":"x","__proto__":{"polluted":true}}');extra.deep=root;extra.ipLog=[{note:'y'.repeat(20000)}];
 const res=h.App.importCharacter({...sheet('remote'),name:'Ж'.repeat(79)+'😀😀',notes:'n'.repeat(6e6),gear:'g'.repeat(12000),extra},{sourceKey:'link:remote'});
 assert.equal(res.ok,true);const c=h.chars()[0];
 assert.equal(c.name,'Ж'.repeat(79),'the name is cut to 80 code units without leaving half an emoji');
 assert.equal(c.notes.length,10000);assert.equal(c.gear.length,10000);assert.equal(c.extra.items.length,1000);assert.equal(c.extra.ipLog[0].note.length,10000);
 let depth=0;for(let x=c.extra.deep;x&&x.next;x=x.next)depth++;assert.ok(depth<24,'nesting is cut: '+depth);
 assert.equal(c.extra.polluted,undefined);assert.equal(c.extra.items[0].polluted,undefined,'a "__proto__" key never becomes a prototype');assert.equal(Object.getPrototypeOf(Object.getPrototypeOf(c.extra.items[0])),null);
 assert.ok(JSON.stringify(h.writes.at(-1)).length<400000,'what is written stays small');
});

test('a sheet that is still too big after cutting is refused before anything changes',()=>{
 const h=harness({characters:[sheet('a')]}),before=h.chars();
 const res=h.App.importCharacter({...sheet('big'),extra:{items:Array.from({length:1000},(_,i)=>({id:'i'+i,name:'x'.repeat(10000)}))}},{sourceKey:'link:big'});
 assert.equal(res.ok,false);assert.equal(res.reason,'too_big');assert.equal(h.chars(),before);assert.equal(h.saved.length,0);
});

test('pictures are kept only when they are valid images within their size limits',()=>{
 const h=harness();
 h.App.importCharacter({...sheet('p'),extra:{portrait:PNG,portraitThumb:'javascript:alert(1)'}},{});
 assert.equal(h.chars()[0].extra.portrait,PNG);assert.equal(h.chars()[0].extra.portraitThumb,undefined);
 h.App.importCharacter({...sheet('q'),extra:{portrait:'data:image/png;base64,'+'A'.repeat(200001)}},{});
 assert.equal(h.chars()[0].extra.portrait,undefined);
});

test('when the sheet does not fit in storage the import is undone and the user keeps the old data',()=>{
 const h=harness({characters:[sheet('a')]});h.state().view='characters';
 const before=h.chars();h.failWrites(1);
 const res=h.App.importCharacter({...sheet('remote'),notes:'n'.repeat(9000)},{sourceKey:'link:remote',open:true});
 assert.deepEqual(plain(res),{ok:false,reason:'storage'});
 assert.equal(h.chars(),before,'the list of characters is the one from before');assert.equal(h.state().view,'characters');assert.equal(h.state().active,null);
 assert.deepEqual(h.writes.at(-1).characters.map(c=>c.id),['a'],'the old data is written back');
 const again=h.App.importCharacter({...sheet('remote')},{sourceKey:'link:remote'});
 assert.equal(again.ok,true);assert.equal(again.updated,false);assert.equal(h.chars().length,2);
 h.pause();assert.equal(h.App.importCharacter(sheet('later'),{}).reason,'paused');
});

test('loaded sheets get a permanent uid from their id or from the link or room they came from, without writing',()=>{
 const h=harness({characters:[sheet('a'),sheet('b',{sourceKey:'link:phone-1'}),sheet('c',{sourceKey:'room:m1:pc-9'}),sheet('d',{uid:'kept'}),sheet('e',{uid:'kept'})]});
 assert.deepEqual(plain(h.chars().map(c=>c.extra.uid)),['a','phone-1','pc-9','kept','e'],'a uid stays unique on this device');
 assert.equal(h.saved.length,0);assert.ok(h.chars().every(c=>c.extra.updatedAt===undefined));
});

test('updatedAt moves only when a sheet really changes',()=>{
 const h=harness({characters:[sheet('a'),sheet('b')]}),[a,b]=h.chars();
 h.App.save();assert.equal(a.extra.updatedAt,undefined,'a save without changes is not an edit');
 h.tick();a.hp=20;h.App.save();assert.equal(a.extra.updatedAt,h.at());assert.equal(b.extra.updatedAt,undefined);
 const first=h.at();h.tick();h.App.save();h.App.save();assert.equal(a.extra.updatedAt,first,'saving again changes nothing');
 a.extra.uid='other';h.App.save();assert.equal(a.extra.updatedAt,first,'the uid is not part of the sheet');
 h.tick();b.extra.items=[{id:'x',name:'Radio'}];h.App.save();assert.equal(b.extra.updatedAt,h.at());assert.equal(a.extra.updatedAt,first);
 // A sheet created in the app gets its uid and a first edit time on its first save.
 h.tick();h.state().characters=[sheet('new'),...h.chars()];h.App.save();const n=h.chars()[0];assert.equal(n.extra.uid,'new');assert.equal(n.extra.updatedAt,h.at());
});

test('defaults a render fills in are not an edit, but a render never swallows an unsaved edit',()=>{
 const h=harness({characters:[sheet('a'),sheet('b')]},{draw:true}),[a,b]=h.chars();h.w.qa.go('characters',null);
 h.w.Motion={afterRender(){a.extra??={};a.extra.luck??=6;b.extra??={};b.extra.cash??=0}};
 h.App.render();h.tick();h.App.save();
 assert.equal(a.extra.luck,6);assert.equal(a.extra.updatedAt,undefined,'filling in defaults while drawing is not an edit');assert.equal(b.extra.updatedAt,undefined);
 h.tick();a.hp=20;h.App.render();h.App.save();
 assert.equal(a.extra.updatedAt,h.at(),'an edit made before the render is still recorded');assert.equal(b.extra.updatedAt,undefined);
});

test('a backup adds its sheets as they were: no edit time is made up, so an old backup never looks newer',async()=>{
 const h=harness(),backup={format:'nightcity-red-backup',version:1,lang:'en',campaigns:[],characters:[sheet('v1'),sheet('v2',{uid:'U2',updatedAt:500}),sheet('v3',{updatedAt:h.at()+2*864e5})]};
 await h.change('import-backup',backup);
 const times=list=>plain(list.map(c=>c.extra.updatedAt??null)),[a]=h.chars();
 assert.deepEqual(plain(h.chars().map(c=>c.extra.uid)),['v1','U2','v3'],'a sheet from before uids keeps the identity of its original id');
 assert.ok(h.chars().every(c=>!['v1','v2','v3'].includes(c.id)),'ids stay local');
 assert.deepEqual(times(h.saved.at(-1).characters),[null,500,null],'a time far ahead of this clock is dropped');
 h.tick();h.App.save();assert.deepEqual(times(h.chars()),[null,500,null]);
 assert.equal(h.App.findImport(sheet('phone-v1',{uid:'v1',updatedAt:h.at()-1000}),{}).id,a.id,'a link from the phone finds this sheet');
 h.tick();a.hp=20;h.App.save();assert.equal(a.extra.updatedAt,h.at(),'the first real edit sets the time');
 // The same backup again: separate characters with their own uids, still without made-up times.
 await h.change('import-backup',backup);
 assert.equal(h.chars().length,6);assert.equal(new Set(h.chars().map(c=>c.extra.uid)).size,6);assert.equal(a.extra.uid,'v1');
 assert.deepEqual(times(h.chars().slice(0,3)),[null,500,null]);
});

test('a sheet restored from the bin keeps its own edit time',()=>{
 const h=harness({characters:[sheet('a'),sheet('b',{updatedAt:400})]});
 for(const id of ['a','b']){const entry=h.w.qa.toBin(h.chars().find(c=>c.id===id));h.App.save();h.tick();assert.equal(h.w.qa.fromBin(entry.id).ok,true);h.App.save()}
 assert.deepEqual(plain(h.chars().map(c=>[c.id,c.extra.updatedAt??null])),[['a',null],['b',400]]);
});

test('edit times only move forward, and a time far ahead of this clock is not believed',()=>{
 const h=harness({characters:[sheet('a',{uid:'A',updatedAt:100}),sheet('far',{uid:'F',updatedAt:1e15})]}),get=id=>h.chars().find(c=>c.id===id);
 assert.equal(h.App.findImport(sheet('x',{uid:'F'}),{}).updatedAt,null,'a stored time far in the future reads as unknown');
 h.tick();get('far').hp=10;h.App.save();assert.equal(get('far').extra.updatedAt,h.at(),'and the next edit replaces it with a real one');
 // A sheet from a device whose clock runs four minutes ahead keeps its time; edits here still come after it.
 const ahead=h.at()+4*60000;
 assert.equal(h.App.importCharacter({...sheet('remote',{uid:'A',updatedAt:ahead}),hp:30},{replace:'a'}).ok,true);assert.equal(get('a').extra.updatedAt,ahead);
 h.tick(1000);get('a').hp=12;h.App.save();assert.equal(get('a').extra.updatedAt,ahead+1,'a later edit never gets an earlier time');
 h.tick(1000);get('a').hp=11;h.App.save();assert.equal(get('a').extra.updatedAt,ahead+2);
 // A link time more than five minutes ahead is dropped, so it cannot keep the sheet "newest".
 h.App.importCharacter({...sheet('remote',{uid:'A',updatedAt:h.at()+2*864e5}),hp:5},{replace:'a'});assert.equal(get('a').hp,5);assert.equal(get('a').extra.updatedAt,undefined);
 h.App.save();assert.equal(get('a').extra.updatedAt,undefined);h.tick();get('a').hp=4;h.App.save();assert.equal(get('a').extra.updatedAt,h.at());
 // The limit itself: five minutes ahead is still a clock that runs fast, a millisecond more is not believed.
 const edge=h.at()+3e5;
 h.App.importCharacter({...sheet('remote',{uid:'A',updatedAt:edge}),hp:3},{replace:'a'});assert.equal(get('a').extra.updatedAt,edge);
 h.App.importCharacter({...sheet('remote',{uid:'A',updatedAt:edge+1}),hp:2},{replace:'a'});assert.equal(get('a').extra.updatedAt,undefined);
});

test('the same character from another device is found by uid and updated in place on request',()=>{
 const archive={characters:[sheet('local-id',{uid:'U',portrait:PNG,updatedAt:100})],campaigns:[{id:'k',name:'K',roster:[{id:'r1',kind:'pc',characterId:'local-id',initiative:5}]}]};
 const h=harness(archive),incoming={...sheet('remote-id',{uid:'U',updatedAt:200}),hp:20,name:'Renamed'};
 assert.deepEqual(plain(h.App.findImport(incoming,{sourceKey:'link:remote-id'})),{id:'local-id',name:'local-id',role:'solo',rank:4,updatedAt:100,by:'uid'});
 assert.equal(h.App.findImport({...sheet('z',{uid:'other'})},{sourceKey:'link:z'}),null);
 const res=h.App.importCharacter(incoming,{sourceKey:'link:remote-id',open:true,replace:'local-id'});
 assert.deepEqual(plain(res),{ok:true,id:'local-id',updated:true,kept:true});
 const [old]=h.state().bin;assert.equal(h.state().bin.length,1);assert.equal(old.replaced,true);assert.equal(old.character.hp,45);assert.equal(old.character.name,'local-id');assert.deepEqual(plain(old.roster),[],'the places in initiative stay with the updated sheet');
 const [c]=h.chars();assert.equal(h.chars().length,1);assert.equal(c.hp,20);assert.equal(c.name,'Renamed');
 assert.equal(c.extra.portrait,PNG,'a link carries no picture, so the local one stays');assert.equal(c.extra.uid,'U');assert.equal(c.extra.sourceKey,undefined);
 assert.equal(c.extra.updatedAt,200,'the incoming edit time is kept, the import itself is not an edit');
 assert.equal(h.state().campaigns[0].roster[0].characterId,'local-id');assert.equal(h.state().active,'local-id');
 h.App.save();assert.equal(c.extra.updatedAt,200);
 assert.equal(h.App.importCharacter(incoming,{replace:'gone'}).reason,'missing');
});

test('keep both adds a separate character with its own uid',()=>{
 const h=harness({characters:[sheet('local-id',{uid:'U',updatedAt:300})]}),incoming=sheet('remote-id',{uid:'U',updatedAt:100});
 const res=h.App.importCharacter(incoming,{copy:true,open:true});
 assert.equal(res.ok,true);assert.equal(res.updated,false);assert.equal(h.chars().length,2);
 const copy=h.chars()[0];assert.equal(copy.extra.uid,copy.id);assert.notEqual(copy.id,'local-id');assert.equal(copy.extra.updatedAt,100);
 assert.equal(h.App.findImport(incoming,{}).id,'local-id','later links still update the original');
});

test('links from older versions match by id, and older link imports match by their source key',()=>{
 const h=harness({characters:[sheet('phone-id'),sheet('laptop-id',{sourceKey:'link:other-phone-id'})]});
 assert.equal(h.App.findImport(sheet('phone-id'),{sourceKey:'link:phone-id'}).id,'phone-id');
 assert.equal(h.App.findImport(sheet('other-phone-id'),{sourceKey:'link:other-phone-id'}).id,'laptop-id');
 assert.equal(h.App.findImport({...sheet('x'),id:undefined,name:'Nameless'},{sourceKey:'link:Nameless'}),null);
});

test('room sheets keep updating in place by source key, and their uid never merges them with another copy',()=>{
 const h=harness({characters:[sheet('link-copy',{uid:'P',updatedAt:50})]});
 const first=h.App.importCharacter({...sheet('pc',{uid:'P',updatedAt:60}),hp:30},{sourceKey:'room:m1:pc'});
 assert.equal(first.ok,true);assert.equal(first.updated,false);
 const room=h.chars().find(c=>c.id===first.id);assert.equal(room.extra.sourceKey,'room:m1:pc');assert.equal(room.extra.uid,first.id,'the uid already belongs to another sheet here');
 const second=h.App.importCharacter({...sheet('pc',{uid:'P',updatedAt:70}),hp:25},{sourceKey:'room:m1:pc'});
 assert.deepEqual(plain(second),{ok:true,id:first.id,updated:true,kept:true});
 assert.equal(h.chars().length,2);assert.equal(h.chars().find(c=>c.id===first.id).hp,25);assert.equal(h.chars().find(c=>c.id==='link-copy').hp,45);
 const [x]=h.chars().filter(c=>c.id===first.id);assert.equal(x.extra.updatedAt,70);assert.equal(x.extra.uid,first.id);
});

test('a room sheet is matched to the copy from that device first, a link or file to the same character first',()=>{
 const h=harness({characters:[sheet('mine',{uid:'P',updatedAt:50}),sheet('from-room',{uid:'from-room',sourceKey:'room-dev:d1:pc'}),sheet('old-room',{sourceKey:'room:seat7:npc'})]});
 const found=(obj,sourceKey)=>{const m=h.App.findImport(obj,{sourceKey});return m&&[m.id,m.by]};
 assert.deepEqual(found(sheet('pc',{uid:'P'}),'room-dev:d1:pc'),['from-room','source'],'the copy received from that device goes first');
 assert.deepEqual(found(sheet('pc',{uid:'P'}),'room-dev:d2:pc'),['mine','uid'],'another device: the same character by uid');
 assert.deepEqual(found(sheet('pc',{uid:'P'}),'link:pc'),['mine','uid']);
 assert.deepEqual(found(sheet('npc',{uid:'N'}),'room-dev:d9:npc'),['old-room','source'],'a copy keyed by the seat (older versions) still counts');
 assert.equal(found(sheet('npc2',{uid:'N'}),'room-dev:d9:npc2'),null);
 assert.equal(h.App.findImport(null,{sourceKey:'room-dev:d1:pc'}),null);assert.equal(h.App.findImport([],{}),null);
 assert.deepEqual(found(sheet('x',{uid:'X'}),{toString:()=>'room-dev:d1:pc'}),null,'a key that is not text is ignored');
});

test('rebind ties the updated sheet to the source, unless another sheet already answers to it',()=>{
 const h=harness({characters:[sheet('mine',{uid:'P',updatedAt:50}),sheet('other',{uid:'O'})]}),get=id=>h.chars().find(c=>c.id===id);
 assert.equal(h.App.importCharacter({...sheet('pc',{uid:'P',updatedAt:60}),hp:30},{sourceKey:'room-dev:d1:pc',replace:'mine',rebind:true}).ok,true);
 assert.equal(get('mine').extra.sourceKey,'room-dev:d1:pc');assert.equal(h.App.findImport(sheet('pc',{uid:'zz'}),{sourceKey:'room-dev:d1:pc'}).id,'mine','later sheets from that device update it');
 // The key is taken: another sheet updated from the same source keeps its own key.
 assert.equal(h.App.importCharacter({...sheet('pc',{uid:'O',updatedAt:70}),hp:20},{sourceKey:'room-dev:d1:pc',replace:'other',rebind:true}).ok,true);
 assert.equal(get('other').extra.sourceKey,undefined);assert.equal(get('mine').extra.sourceKey,'room-dev:d1:pc');
 // Without rebind an update by uid leaves the key alone; a kept copy with rebind takes a free key.
 assert.equal(h.App.importCharacter({...sheet('pc',{uid:'O',updatedAt:80}),hp:10},{sourceKey:'room-dev:d2:pc',replace:'other'}).ok,true);assert.equal(get('other').extra.sourceKey,undefined);
 const copy=h.App.importCharacter(sheet('pc',{uid:'O'}),{sourceKey:'room-dev:d2:pc',copy:true,rebind:true});assert.equal(get(copy.id).extra.sourceKey,'room-dev:d2:pc');
 const second=h.App.importCharacter(sheet('pc',{uid:'O'}),{sourceKey:'room-dev:d2:pc',copy:true,rebind:true});assert.equal(get(second.id).extra.sourceKey,undefined);
 assert.equal(h.App.importCharacter(sheet('pc',{uid:'O'}),{sourceKey:'room-dev:d3:pc',copy:true}).ok,true);assert.equal(h.chars()[0].extra.sourceKey,undefined,'a plain copy is tied to nothing');
});

test('the replaced version waits in the bin: one per character, and it comes back as a separate sheet',()=>{
 const archive={characters:[sheet('a',{uid:'A',updatedAt:100,sourceKey:'room-dev:d1:a'}),sheet('b')],campaigns:[{id:'k',name:'K',roster:[{id:'r1',kind:'pc',characterId:'a',initiative:5}]}]};
 const h=harness(archive),get=id=>h.chars().find(c=>c.id===id),upd=(hp,at)=>h.App.importCharacter({...sheet('remote',{uid:'A',updatedAt:at}),hp},{sourceKey:'room-dev:d1:a'});
 assert.equal(upd(30,200).kept,true);assert.equal(h.state().bin[0].character.hp,45);
 assert.deepEqual(plain(upd(30,200)),{ok:true,id:'a',updated:true,kept:false},'the same content leaves nothing to keep');assert.equal(h.state().bin[0].character.hp,45);
 h.tick();assert.equal(upd(20,300).kept,true);
 assert.deepEqual(plain(h.state().bin.map(e=>[e.replaced,e.character.hp])),[[true,30]],'only the latest replaced version of a character is kept');
 // A deleted character and a replaced version of another one live side by side.
 const gone=h.w.qa.toBin(get('b'));assert.equal(upd(10,400).kept,true);assert.deepEqual(plain(h.state().bin.map(e=>e.character.id)).sort(),['a','b']);assert.ok(h.state().bin.includes(gone));
 const entry=h.state().bin.find(e=>e.replaced),back=h.w.qa.fromBin(entry.id);
 assert.equal(back.ok,true);assert.notEqual(back.id,'a','the id is taken by the updated sheet');assert.equal(get(back.id).hp,20);
 assert.equal(get(back.id).extra.sourceKey,undefined,'the updated sheet keeps receiving the updates');assert.equal(get('a').extra.sourceKey,'room-dev:d1:a');
 assert.deepEqual(plain(h.state().campaigns[0].roster.map(r=>r.characterId)),['a'],'initiative places are not doubled');
 assert.equal(h.state().bin.some(e=>e.replaced),false);
});

test('a copy of the previous version never makes an update fail, except a step back to an older one',()=>{
 const h=harness({characters:[sheet('a',{uid:'A',updatedAt:500})]}),get=()=>h.chars().find(c=>c.id==='a');
 // Newer incoming sheet, no room for the copy as well: the update is written alone.
 h.failWrites(1);
 assert.deepEqual(plain(h.App.importCharacter({...sheet('remote',{uid:'A',updatedAt:600}),hp:30},{replace:'a'})),{ok:true,id:'a',updated:true,kept:false});
 assert.equal(get().hp,30);assert.equal(h.state().bin.length,0);assert.equal(h.writes.at(-1).characters[0].hp,30);assert.equal(h.writes.at(-1).bin,undefined);
 // Not even the update fits: everything stays.
 const before=h.chars();h.failWrites(2);
 assert.deepEqual(plain(h.App.importCharacter({...sheet('remote',{uid:'A',updatedAt:700}),hp:25},{replace:'a'})),{ok:false,reason:'storage'});
 assert.equal(h.chars(),before);assert.equal(get().hp,30);assert.equal(h.state().bin.length,0);
 // An older incoming sheet over a newer local one is refused without its copy: the newer sheet would be gone for good.
 h.failWrites(1);
 assert.deepEqual(plain(h.App.importCharacter({...sheet('remote',{uid:'A',updatedAt:100}),hp:5},{replace:'a'})),{ok:false,reason:'storage'});
 assert.equal(get().hp,30);assert.equal(get().extra.updatedAt,600);assert.equal(h.state().bin.length,0);assert.equal(h.writes.at(-1).characters[0].hp,30,'the data from before is written back');
 // The same holds for a sheet without an edit time, and with room for the copy the step back goes through.
 h.failWrites(1);assert.equal(h.App.importCharacter({...sheet('remote',{uid:'A'}),hp:4},{replace:'a'}).reason,'storage');
 assert.deepEqual(plain(h.App.importCharacter({...sheet('remote',{uid:'A',updatedAt:100}),hp:5},{replace:'a'})),{ok:true,id:'a',updated:true,kept:true});
 assert.equal(get().hp,5);assert.equal(h.state().bin[0].character.hp,30);assert.equal(h.state().bin[0].character.extra.updatedAt,600);
});

test('a bin entry gives back only initiative places of a player character, and its link or room key only while it is free',()=>{
 const archive={characters:[sheet('a',{sourceKey:'link:a'})],campaigns:[{id:'k',name:'K',roster:[{id:'r1',kind:'pc',characterId:'a',initiative:5},{id:'n1',kind:'npc',name:'Goon',initiative:3}]}]};
 const h=harness(archive),get=id=>h.chars().find(c=>c.id===id);
 const entry=h.w.qa.toBin(get('a'));assert.deepEqual(plain(entry.roster.map(r=>r.entry.id)),['r1']);
 entry.roster.push({campaignId:'k',index:0,entry:{id:'evil',kind:'npc',name:'Planted',initiative:99}},{campaignId:'k',index:0,entry:{id:'n1',kind:'pc',characterId:'a'}},{campaignId:'k',index:0,entry:null});
 assert.equal(h.w.qa.fromBin(entry.id).ok,true);
 assert.deepEqual(plain(h.state().campaigns[0].roster.map(r=>r.id)),['r1','n1'],'only the player place is back, once');assert.equal(get('a').extra.sourceKey,'link:a');
 // Deleted, then the link is imported again as a new sheet: the restored one no longer answers to the link.
 const again=h.w.qa.toBin(get('a')),fresh=h.App.importCharacter(sheet('a'),{sourceKey:'link:a'});assert.equal(fresh.ok,true);
 const back=h.w.qa.fromBin(again.id);assert.equal(back.ok,true);assert.equal(get(back.id).extra.sourceKey,undefined);assert.equal(get(fresh.id).extra.sourceKey,'link:a');
 assert.equal(h.w.qa.fromBin('nope').reason,'missing');
});

test('a source key inside an imported sheet is never trusted, but it still tells which character it is',()=>{
 const h=harness();
 const res=h.App.importCharacter({...sheet('file-id',{sourceKey:'room:m1:origin'})},{});
 const c=h.chars()[0];assert.equal(res.ok,true);assert.equal(c.extra.sourceKey,undefined);assert.equal(c.extra.uid,'origin');
});

test('importing a character file goes through the same comparing dialog',async()=>{
 const calls=[],h=harness({characters:[sheet('a',{uid:'U'})]},{shareLink:{offer:(obj,o)=>{calls.push([obj.id,plain(o)]);return Promise.resolve(null)}}});
 await h.change('import-file',{format:'nightcity-red-character',version:1,character:sheet('remote',{uid:'U'})});
 assert.deepEqual(calls,[['remote',{kind:'file'}]]);assert.equal(h.chars().length,1);
 await h.change('import-file',{format:'nightcity-red-character',version:1,character:{name:'broken'}});
 assert.equal(calls.length,1);assert.match(h.notices.at(-1),/Could not import/);
});

test('without the dialog module a character file is still imported with the same limits',async()=>{
 const h=harness({characters:[sheet('a')]});
 await h.change('import-file',{format:'nightcity-red-character',version:1,character:{...sheet('remote'),notes:'n'.repeat(20000)}});
 assert.equal(h.chars().length,2);assert.equal(h.chars()[0].notes.length,10000);assert.equal(h.state().view,'sheet');
});
