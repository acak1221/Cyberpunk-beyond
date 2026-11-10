const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
// The module with the real range table and a book template, in its own context.
function load({confirm=()=>true}={}){
 const window={GMTools:{NPC_TEMPLATES:[{id:'bodyguard',stats:{MOVE:4}}]}};
 vm.runInNewContext(read('combat-tools.js')+'\n'+read('battle-map.js'),{window,confirm,Math,Date,JSON,Number,String,Array,Object,Map,Set});
 return window;
}
const W=load(),B=W.BattleMap;
const roster=()=>[{id:'p1',kind:'pc',characterId:'c1',initiative:15,order:1},{id:'n1',kind:'npc',name:'Бандит 1',initiative:12,order:2,sourceTemplate:'bodyguard'},{id:'n2',kind:'npc',name:'Снайпер',initiative:9,order:3,hidden:true},{id:'n3',kind:'npc',name:'Босс',initiative:5,order:4}];
const chars=()=>[{id:'c1',name:'Нокс',stats:{MOVE:6}}];
let campSeq=0;
const camp=(map)=>({id:'k'+(++campSeq),name:'Job',notes:'',round:1,turnIndex:0,roster:roster(),...(map?{map}:{})});
const mapOf=(tokens=[],cover=[],w=14,h=10)=>({v:1,w,h,tokens,cover});

// A stand-in for the map card: closest() answers by selector, the root records what is drawn into it.
function scene(campaign,{lang='ru',characters=chars(),win=W}={}){
 const notices=[];let saves=0;
 const root={innerHTML:'',querySelector:()=>null,contains:()=>false};
 const ctx={lang,characters,notify:m=>notices.push(m),save:()=>saves++};
 const el=(data,sel)=>({dataset:data,value:data.value,closest:s=>s==='[data-bm-root]'?root:s===sel?{dataset:data}:null});
 const fire=(type,target)=>{const r=win.BattleMap.handle({type,target},campaign,ctx);if(r.dirty)saves++;return r};
 return {root,notices,saves:()=>saves,
  cell:(x,y)=>fire('click',el({bmCell:x+','+y},'[data-bm-cell]')),
  act:(a,value)=>fire('click',el({bmAct:a,bmValue:value},'[data-bm-act]')),
  tray:id=>fire('click',el({bmTray:id},'[data-bm-tray]')),
  change:(data,value)=>fire('change',{...el(data,null),value}),
  view:()=>win.BattleMap._view(campaign)};
}

test('one square is 2 m and diagonals count as one square',()=>{
 assert.equal(B.CELL_M,2);
 assert.deepEqual(plain(B.distance({x:0,y:0},{x:3,y:0})),{squares:3,metres:6});
 assert.deepEqual(plain(B.distance({x:1,y:1},{x:4,y:6})),{squares:5,metres:10});
 assert.deepEqual(plain(B.distance({x:2,y:2},{x:2,y:2})),{squares:0,metres:0});
});

test('the range DV comes from the combat tools table',()=>{
 assert.deepEqual(plain(B.rangeHint('pistol',6)),{single:13,auto:null});
 assert.deepEqual(plain(B.rangeHint('pistol',14)),{single:20,auto:null});
 assert.deepEqual(plain(B.rangeHint('smg',8)),{single:13,auto:17});
 assert.deepEqual(plain(B.rangeHint('assault',30)),{single:13,auto:20});
 assert.deepEqual(plain(B.rangeHint('pistol',58)),{single:30,auto:null});
 assert.equal(B.rangeHint('nope',10).single,null);
 for(const [type,row] of Object.entries(W.CombatTools.RANGE))for(const m of [2,12,26,58])assert.equal(B.rangeHint(type,m).single,W.CombatTools.rangeDV(type,m,'single'),type+' '+m);
 assert.deepEqual(B.weaponTypes('en').map(x=>x.id),Object.keys(W.CombatTools.RANGE));
 assert.equal(B.weaponTypes('ru').find(x=>x.id==='pistol').name,'Пистолет');
 assert.equal(B.weaponTypes('en').find(x=>x.id==='smg').auto,true);
});

test('a saved map is cleaned: bad squares, duplicates, strangers and overlaps are dropped',()=>{
 assert.equal(B.clean(undefined),null);assert.equal(B.clean([]),null);assert.equal(B.clean({v:2,w:14,h:10}),null);
 assert.equal(B.clean({v:1,w:5,h:10}),null);assert.equal(B.clean({v:1,w:14,h:99}),null);assert.equal(B.clean({v:1,w:'14',h:10}),null);
 const raw={v:1,w:8,h:6,extra:'x',cover:[[1,1],[1,1],[9,0],[0,-1],'x',[2,2,2],[3,3]],tokens:[{id:'p1',x:0,y:0,m:7},{id:'p1',x:2,y:0},{id:'n1',x:1,y:1},{id:'n3',x:0,y:0},{id:'ghost',x:5,y:5},{id:'n2',x:7,y:5,m:99},{id:'',x:4,y:4},null,{id:'n3',x:1.5,y:2}]};
 const c=camp(raw),m=B.read(c);
 assert.deepEqual(plain(m),{v:1,w:8,h:6,cover:[[1,1],[3,3]],tokens:[{id:'p1',x:0,y:0,m:7},{id:'n2',x:7,y:5}]});
 assert.equal(B.foreign(c),false);
 assert.deepEqual(plain(B.clean(raw).tokens.map(t=>t.id)),['p1','ghost','n2'],'without a roster only the shape is checked');
 assert.equal(B.read(camp()),null);assert.equal(B.foreign(camp()),false);
 assert.equal(B.foreign(camp({v:2,w:14,h:10,tokens:[],cover:[]})),true);assert.equal(B.foreign(camp('junk')),true);
 const many={v:1,w:30,h:20,tokens:[],cover:[]};for(let i=0;i<600;i++)many.cover.push([i%30,Math.floor(i/30)]);
 assert.equal(B.clean(many).cover.length,B.MAX_COVER);
 const crowd={v:1,w:30,h:20,cover:[],tokens:Array.from({length:200},(_,i)=>({id:'t'+i,x:i%30,y:Math.floor(i/30)}))};
 assert.equal(B.clean(crowd).tokens.length,B.MAX_TOKENS);
});

test('tokens are placed, moved and removed; cover and tokens never share a square',()=>{
 const m=B.blank();
 assert.equal(B.placeToken(m,'a',2,3),'');assert.equal(B.placeToken(m,'b',2,3),'occupied');assert.equal(B.placeToken(m,'a',2,3),'');
 assert.equal(B.toggleCover(m,2,3),'tokenBusy');assert.equal(B.toggleCover(m,4,4),'');assert.equal(B.placeToken(m,'a',4,4),'coverBusy');
 assert.equal(B.placeToken(m,'a',99,0),'occupied');assert.equal(B.placeToken(m,'a',5,5),'');
 assert.deepEqual(plain(m.tokens),[{id:'a',x:5,y:5}]);
 assert.equal(B.toggleCover(m,4,4),'');assert.deepEqual(plain(m.cover),[]);
 assert.equal(B.removeToken(m,'a'),true);assert.equal(B.removeToken(m,'a'),false);
 const full=B.blank(30,20);for(let i=0;i<B.MAX_TOKENS;i++)assert.equal(B.placeToken(full,'t'+i,i%30,Math.floor(i/30)),'');
 assert.equal(B.placeToken(full,'one-more',29,19),'full');
});

test('resizing keeps what fits and sends the rest back off the map',()=>{
 const m=mapOf([{id:'a',x:1,y:1},{id:'b',x:12,y:8}],[[2,2],[13,9]]);
 assert.equal(B.resize(m,8,6),true);
 assert.deepEqual(plain(m),{v:1,w:8,h:6,tokens:[{id:'a',x:1,y:1}],cover:[[2,2]]});
 assert.equal(B.resize(m,5,6),false);assert.equal(B.resize(m,8,21),false);assert.equal(m.w,8);
});

test('"place everyone" puts characters on the left and NPCs on the right without touching those already placed',()=>{
 const m=mapOf([{id:'n1',x:5,y:5}],[[0,0]],8,6);
 assert.equal(B.placeAll(m,roster()),3);
 assert.deepEqual(plain(m.tokens),[{id:'n1',x:5,y:5},{id:'p1',x:0,y:1},{id:'n2',x:7,y:0},{id:'n3',x:7,y:1}]);
 assert.equal(B.placeAll(m,roster()),0);
});

test('movement walks around cover; a walled-in square falls back to the straight count',()=>{
 const open=mapOf();
 assert.equal(B.moveCost(open,{x:0,y:0},{x:4,y:3}),4);
 const wall=mapOf([],[[2,0],[2,1],[2,2]],6,4);
 assert.equal(B.moveCost(wall,{x:1,y:1},{x:3,y:1}),4,'around the end of the wall');
 const d=B.steps(wall,{x:1,y:1});
 assert.equal(d.get('1,1'),0);assert.equal(d.has('2,1'),false,'cover cannot be entered');assert.equal(d.get('2,3'),2);
 const box=mapOf([],[[4,0],[4,1],[5,1]],6,4);
 assert.equal(B.steps(box,{x:0,y:0}).has('5,0'),false);
 assert.equal(B.moveCost(box,{x:0,y:0},{x:5,y:0}),5);
});

test('cover on the straight line between two tokens is noticed',()=>{
 const m=mapOf([],[[3,0],[2,2]]);
 assert.deepEqual(plain(B.lineCover(m,{x:0,y:0},{x:6,y:0})),[[3,0]]);
 assert.deepEqual(plain(B.lineCover(m,{x:0,y:0},{x:4,y:4})),[[2,2]]);
 assert.deepEqual(plain(B.lineCover(m,{x:0,y:1},{x:6,y:1})),[]);
 assert.deepEqual(plain(B.lineCover(m,{x:2,y:0},{x:3,y:0})),[],'the end squares do not count');
});

test('MOVE comes from the token, the sheet or the book template',()=>{
 const r=roster(),c=chars();
 assert.equal(B.moveOf(r[0],c,null),6);assert.equal(B.moveOf(r[1],c,null),4);assert.equal(B.moveOf(r[3],c,null),null);
 assert.equal(B.moveOf(r[3],c,{id:'n3',x:0,y:0,m:5}),5);assert.equal(B.moveOf(r[0],c,{m:0}),0);
 assert.equal(B.moveOf(r[0],[{id:'c1',stats:{MOVE:'fast'}}],null),null);assert.equal(B.moveOf(r[0],[],null),null);
 assert.equal(B.moveOf({id:'x',kind:'npc',sourceTemplate:'unknown'},c,null),null);
});

test('squares are named like a chessboard and tokens get short labels',()=>{
 assert.equal(B.cellName(0,0),'A1');assert.equal(B.cellName(25,9),'Z10');assert.equal(B.cellName(26,0),'AA1');assert.equal(B.cellName(29,19),'AD20');
 assert.equal(B.label('Бандит 2'),'Б2');assert.equal(B.label('Нокс'),'Но');assert.equal(B.label('Johnny Silverhand'),'JS');assert.equal(B.label('Boss 12'),'B12');
 assert.equal(B.label(''),'?');assert.equal(B.label('7'),'7');assert.equal(B.label('x'),'X');
});

test('without a map the card offers to create one; the campaign is not changed until then',()=>{
 const c=camp(),before=JSON.stringify(c);
 for(const lang of ['ru','en']){const html=B.render(c,chars(),lang);assert.match(html,/data-bm-root/);assert.match(html,/data-bm-act="create"/);assert.doesNotMatch(html,/data-bm-cell/);assert.match(html,/<span data-page-ref>169 \/ 172–173<\/span>/)}
 assert.equal(JSON.stringify(c),before);
 const s=scene(c);assert.deepEqual(plain(s.act('create')),{handled:true,dirty:true});
 assert.deepEqual(plain(c.map),{v:1,w:14,h:10,tokens:[],cover:[]});
 assert.match(s.root.innerHTML,/data-bm-cell="13,9"/);assert.equal((s.root.innerHTML.match(/data-bm-cell=/g)||[]).length,140);
 assert.equal((s.root.innerHTML.match(/tabindex="0"/g)||[]).length,1,'one square is in the tab order, arrows reach the rest');
});

test('a foreign map is shown as a notice and left untouched',()=>{
 const c=camp({v:7,grid:'hex'}),before=JSON.stringify(c),s=scene(c);
 for(const lang of ['ru','en']){const html=B.render(c,chars(),lang);assert.match(html,/role="status"/);assert.doesNotMatch(html,/data-bm-act/)}
 assert.deepEqual(plain(s.act('create')),{handled:true,dirty:false});assert.deepEqual(plain(s.cell(0,0)),{handled:true,dirty:false});
 assert.equal(JSON.stringify(c),before);
});

test('select in the list, tap a square to place, tap again to move; movement is counted against MOVE',()=>{
 const c=camp(mapOf()),s=scene(c);
 assert.equal(s.tray('p1').dirty,false);assert.equal(s.view().sel,'p1');
 assert.equal(s.cell(1,1).dirty,true);assert.deepEqual(plain(c.map.tokens),[{id:'p1',x:1,y:1}]);
 assert.match(s.root.innerHTML,/Нокс: клетка B2\./);
 assert.match(s.root.innerHTML,/до 12 м \(6 кл\.\)/,'MOVE 6 is 12 m, 6 squares');
 assert.match(s.root.innerHTML,/class="bm-cell bm-reach" data-bm-cell="7,1"/);assert.match(s.root.innerHTML,/class="bm-cell bm-run" data-bm-cell="8,1"/);assert.match(s.root.innerHTML,/class="bm-cell bm-run" data-bm-cell="13,1"/);
 assert.equal(s.cell(5,3).dirty,true);assert.deepEqual(plain(c.map.tokens),[{id:'p1',x:5,y:3}]);
 assert.match(s.root.innerHTML,/Нокс: перемещение на 8 м \(4 кл\.\)/);assert.match(s.root.innerHTML,/Пройдено за этот ход: 8 м из 12 м\./);
 assert.match(s.root.innerHTML,/class="bm-cell bm-reach" data-bm-cell="7,3"/);assert.match(s.root.innerHTML,/class="bm-cell bm-run" data-bm-cell="8,3"/,'2 squares of the Move Action are left');
 s.cell(9,3);assert.match(s.root.innerHTML,/class="bm-cell" data-bm-cell="2,3"/,'nothing of the Move Action is left, the Run Action reaches 6 squares');assert.match(s.root.innerHTML,/class="bm-cell bm-run" data-bm-cell="3,3"/);assert.match(s.root.innerHTML,/class="bm-warn">Пройдено за этот ход: 16 м из 12 м\. Больше одного действия перемещения/);
 s.cell(13,9);assert.match(s.root.innerHTML,/Больше, чем позволяет перемещение вместе с «Бегом»/);
 assert.equal(s.act('undo').dirty,true);assert.deepEqual(plain(c.map.tokens),[{id:'p1',x:9,y:3}]);assert.equal(s.view().spent.p1,8);
 assert.match(s.root.innerHTML,/data-bm-act="undo" disabled/);
 c.turnIndex=1;assert.deepEqual(plain(s.view().spent),{},'the counter starts again on the next turn');
 assert.equal(s.saves(),5);assert.deepEqual(s.notices,[]);
});

test('a second token is the target: distance in metres, DV for the chosen weapon, cover on the line',()=>{
 const c=camp(mapOf([{id:'p1',x:0,y:0},{id:'n1',x:7,y:0},{id:'n3',x:0,y:4}],[[3,0]])),s=scene(c,{lang:'en'});
 s.cell(0,0);assert.match(s.root.innerHTML,/Tap another token to measure/);
 assert.equal(s.cell(7,0).dirty,false);assert.equal(s.view().target,'n1');
 assert.match(s.root.innerHTML,/Нокс → Бандит 1: 14 m \(7 sq\.\)/);assert.match(s.root.innerHTML,/DV 20 \(single shot\)/);assert.match(s.root.innerHTML,/cover on the straight line/);
 assert.match(s.root.innerHTML,/bm-target" data-bm-cell="7,0"/);assert.match(s.root.innerHTML,/bm-sel" data-bm-cell="0,0"[^>]*aria-pressed="true"/);
 assert.equal(s.change({bmWeapon:''},'smg').dirty,false);assert.match(s.root.innerHTML,/DV 15 \(single shot\) · DV 20 \(autofire\)/);
 s.change({bmWeapon:''},'laser');assert.equal(s.view().weapon,'smg');
 s.cell(0,4);assert.match(s.root.innerHTML,/Нокс → Босс: 8 m \(4 sq\.\)/);assert.match(s.root.innerHTML,/DV 13 \(single shot\) · DV 17 \(autofire\)/);assert.doesNotMatch(s.root.innerHTML,/straight line/);
 s.cell(0,0);assert.equal(s.view().sel,null);assert.equal(s.view().target,null);
 assert.equal(s.saves(),0,'measuring saves nothing');
});

test('cover mode toggles cover squares; busy squares are refused with a notice',()=>{
 const c=camp(mapOf([{id:'p1',x:0,y:0}])),s=scene(c);
 s.act('mode','cover');assert.match(s.root.innerHTML,/data-bm-mode="cover"/);
 assert.equal(s.cell(2,2).dirty,true);assert.deepEqual(plain(c.map.cover),[[2,2]]);assert.match(s.root.innerHTML,/class="bm-cell bm-cover" data-bm-cell="2,2"/);
 assert.equal(s.cell(0,0).dirty,false);assert.deepEqual(s.notices,['В клетке стоит фишка.']);
 assert.equal(s.cell(2,2).dirty,true);assert.deepEqual(plain(c.map.cover),[]);
 s.cell(3,3);s.act('mode','move');s.cell(0,0);assert.equal(s.cell(3,3).dirty,false);assert.deepEqual(s.notices.slice(1),['В клетке укрытие.']);
 assert.deepEqual(plain(c.map.tokens),[{id:'p1',x:0,y:0}]);
});

test('a dragged token is dropped through the hidden field; a drop on another token is refused',()=>{
 const c=camp(mapOf([{id:'p1',x:0,y:0},{id:'n1',x:5,y:5}])),s=scene(c);
 assert.equal(s.change({bmDrop:''},'p1|3,2').dirty,true);assert.deepEqual(plain(c.map.tokens[0]),{id:'p1',x:3,y:2});assert.equal(s.view().sel,'p1');
 assert.equal(s.change({bmDrop:''},'p1|5,5').dirty,false);assert.deepEqual(s.notices,['Клетка занята.']);
 for(const junk of ['','p1','p1|99,99','ghost|1,1','p1|a,b','|1,1'])assert.equal(s.change({bmDrop:''},junk).dirty,false,junk);
 assert.deepEqual(plain(c.map.tokens[0]),{id:'p1',x:3,y:2});
});

test('MOVE can be set on a token and is dropped again when it matches the sheet',()=>{
 const c=camp(mapOf([{id:'p1',x:0,y:0},{id:'n3',x:5,y:5}])),s=scene(c);
 s.cell(5,5);assert.match(s.root.innerHTML,/Укажите MOVE/);
 assert.equal(s.change({bmMove:''},'5').dirty,true);assert.deepEqual(plain(c.map.tokens[1]),{id:'n3',x:5,y:5,m:5});assert.match(s.root.innerHTML,/до 10 м \(5 кл\.\)/);
 for(const bad of ['21','-1','2.5','abc']){s.change({bmMove:''},bad);assert.equal(c.map.tokens[1].m,5,bad)}
 s.change({bmMove:''},'');assert.equal(c.map.tokens[1].m,undefined);
 s.cell(5,5);s.cell(0,0);s.change({bmMove:''},'4');assert.equal(c.map.tokens[0].m,4);s.change({bmMove:''},'6');assert.equal(c.map.tokens[0].m,undefined,'6 is what the sheet says');
});

test('size, place everyone, take off, clear and delete',()=>{
 const c=camp(mapOf([{id:'p1',x:12,y:8}],[[1,1]])),s=scene(c);
 assert.equal(s.change({bmSize:'w'},'8').dirty,true);assert.equal(c.map.w,8);assert.deepEqual(plain(c.map.tokens),[]);
 assert.equal(s.change({bmSize:'h'},'99').dirty,false);assert.equal(c.map.h,10);
 assert.equal(s.act('place-all').dirty,true);assert.deepEqual(plain(c.map.tokens.map(t=>t.id)),['p1','n1','n2','n3']);
 s.cell(0,0);assert.equal(s.act('unplace').dirty,true);assert.deepEqual(plain(c.map.tokens.map(t=>t.id)),['n1','n2','n3']);
 assert.equal(s.act('clear').dirty,true);assert.deepEqual(plain(c.map),{v:1,w:8,h:10,tokens:[],cover:[]});
 assert.equal(s.act('remove').dirty,true);assert.equal('map' in c,false);assert.match(s.root.innerHTML,/data-bm-act="create"/);
 const no=load({confirm:()=>false}),c2=camp(mapOf([{id:'p1',x:0,y:0}])),s2=scene(c2,{win:no});
 assert.equal(s2.act('clear').dirty,false);assert.equal(s2.act('remove').dirty,false);assert.deepEqual(plain(c2.map.tokens),[{id:'p1',x:0,y:0}]);
});

test('a participant removed from the tracker leaves the map on the next change',()=>{
 const c=camp(mapOf([{id:'p1',x:0,y:0},{id:'n1',x:3,y:3}])),s=scene(c);
 c.roster=c.roster.filter(r=>r.id!=='n1');
 assert.doesNotMatch(B.render(c,chars(),'ru'),/Бандит/);
 s.act('mode','cover');s.cell(3,3);
 assert.deepEqual(plain(c.map),{v:1,w:14,h:10,tokens:[{id:'p1',x:0,y:0}],cover:[[3,3]]});
});

test('the GM sees hidden NPCs marked as hidden; names are escaped; both languages render',()=>{
 const c=camp(mapOf([{id:'p1',x:0,y:0},{id:'n2',x:4,y:4}]));c.roster[3].name='<img src=x onerror=alert(1)>';
 for(const lang of ['ru','en']){
  const html=B.render(c,chars(),lang);
  assert.match(html,/bm-has bm-npc bm-hidden" data-bm-cell="4,4"/);assert.match(html,lang==='ru'?/скрыт от игроков/:/hidden from players/);
  assert.match(html,/bm-has bm-pc bm-current" data-bm-cell="0,0"/,'the acting participant is ringed');
  assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img src=x/);
  assert.doesNotMatch(html,/undefined|\[object|NaN/);
 }
 const ru=B.render(c,chars(),'ru'),en=B.render(c,chars(),'en');
 assert.match(ru,/КАРТА БОЯ/);assert.match(en,/BATTLE MAP/);assert.doesNotMatch(en,/Одна клетка|Выберите|Укрытия|Фишки/);
});

test('events of other kinds inside the card are swallowed and change nothing',()=>{
 const c=camp(mapOf([{id:'p1',x:0,y:0}])),before=JSON.stringify(c),root={innerHTML:'',querySelector:()=>null};
 const r=B.handle({type:'input',target:{dataset:{bmMove:''},value:'9',closest:s=>s==='[data-bm-root]'?root:null}},c,{lang:'ru',characters:chars()});
 assert.deepEqual(plain(r),{handled:true,dirty:false});assert.equal(JSON.stringify(c),before);
 assert.equal(B.handle({type:'click',target:{closest:()=>null}},c,{}).handled,false);
 assert.equal(B.owns({target:{closest:s=>s==='[data-bm-root]'?{}:null}}),true);assert.equal(B.owns({target:{closest:()=>null}}),false);
});

test('players get only the tokens of visible participants, by their place in the sent order',()=>{
 const c=camp(mapOf([{id:'n3',x:9,y:9},{id:'n2',x:4,y:4},{id:'p1',x:0,y:0},{id:'n1',x:13,y:0}],[[2,2]]));
 const shown=c.roster.filter(r=>r.hidden!==true),part=B.sharedPart(c,shown);
 assert.deepEqual(plain(part),{map:{w:14,h:10,c:[[2,2]],t:[[2,9,9],[0,0,0],[1,13,0]]}});
 assert.equal(JSON.stringify(B.sharedPart(c,c.roster)).includes('[2,4,4]'),false,'a hidden NPC is not sent even when it is passed in');
 assert.equal(B.sharedPart(camp(),shown),null);assert.equal(B.sharedPart(c,null),null);
 assert.ok(JSON.stringify(B.sharedPart({...c,map:{v:1,w:30,h:20,tokens:[],cover:Array.from({length:200},(_,i)=>[i%30,Math.floor(i/30)])}},shown)).length<2500,'the largest map stays small on the wire');
});

test('a received map is cleaned before it is drawn',()=>{
 assert.equal(B.cleanShared(null,3),null);assert.equal(B.cleanShared({w:99,h:10},3),null);assert.equal(B.cleanShared({w:14,h:'10'},3),null);
 assert.deepEqual(plain(B.cleanShared({w:14,h:10,c:[[2,2],[2,2],[99,1],'x'],t:[[0,1,1],[0,3,3],[5,4,4],[1,2,2],[2,1,1],[1,6,6,'x'],[-1,0,0],'y'],extra:1},3)),{w:14,h:10,c:[[2,2]],t:[[0,1,1],[1,6,6]]});
 const order=[{name:'Нокс',pc:true,current:true},{name:'<b>Ганг</b>',pc:false},{name:'',pc:true,none:true}];
 for(const lang of ['ru','en']){
  const html=B.sharedHTML({order,map:{w:14,h:10,c:[[2,2]],t:[[0,0,0],[1,13,0],[2,5,5],[7,6,6]]}},lang);
  assert.match(html,/data-bm-shared/);assert.equal((html.match(/class="bm-token"/g)||[]).length,3);assert.doesNotMatch(html,/<button|data-bm-cell|<b>Ганг/);
  assert.match(html,/&lt;b&gt;Ганг&lt;\/b&gt; — N1/);assert.match(html,lang==='ru'?/без персонажа — F6/:/no character — F6/);assert.match(html,lang==='ru'?/Укрытия: C3/:/Cover: C3/);
  assert.match(html,/bm-has bm-pc bm-current/);
 }
 assert.equal(B.sharedHTML({order,map:null},'ru'),'');assert.equal(B.sharedHTML(null,'ru'),'');assert.equal(B.sharedHTML({order:[],map:{w:1,h:1}},'en'),'');
});

test('import: the tokens follow the new roster ids',()=>{
 const old=camp(mapOf([{id:'p1',x:0,y:0,m:5},{id:'n1',x:3,y:3},{id:'gone',x:5,y:5}],[[1,1]]));
 const copy={...old,roster:old.roster.map((r,i)=>({...r,id:'new'+i}))};
 B.rekey(copy,old.roster);
 assert.deepEqual(plain(copy.map),{v:1,w:14,h:10,tokens:[{id:'new0',x:0,y:0,m:5},{id:'new1',x:3,y:3}],cover:[[1,1]]});
 assert.notEqual(copy.map,old.map);assert.deepEqual(plain(old.map.tokens.map(t=>t.id)),['p1','n1','gone'],'the imported object is not rewritten');
 assert.deepEqual(plain(B.read(copy).tokens.map(t=>t.id)),['new0','new1']);
 const junk={id:'x',roster:[],map:'junk'};B.rekey(junk,[]);assert.equal(junk.map,'junk');
 const none={id:'x',roster:[]};B.rekey(none,[]);assert.equal('map' in none,false);
 assert.doesNotThrow(()=>B.rekey(null,null));
});

test('the map is wired into the tracker, the import, the room and the page with small insertions',()=>{
 const campaigns=read('campaigns.js'),app=read('app.js'),room=read('room.js'),index=read('index.html');
 assert.ok(campaigns.includes("${window.BattleMap?.render?.(c,characters,lang)||''}"));
 assert.ok(campaigns.includes("if(c&&window.BattleMap?.owns?.(e)){if(!current())return stale();const r=window.BattleMap.handle(e,c,ctx);if(r.dirty)ctx.save();return true}"));
 assert.ok(app.includes("window.BattleMap?.rekey?.(copy,k.roster);pruneRoster("));
 assert.ok(room.includes("...(global.BattleMap?.sharedPart?.(camp,shown.map(x=>x.r))||{})"));
 assert.ok(room.includes("map:global.BattleMap?.cleanShared?.(d.map,Math.min(d.order.length,40))||null"));
 assert.ok(room.includes("${global.BattleMap?.sharedHTML?.(combat,lang())||''}"));
 assert.ok(index.indexOf('<script src="battle-map.js">')>0&&index.indexOf('<script src="battle-map.js">')<index.indexOf('<script src="app.js">'));
 assert.ok(index.indexOf('href="battle-map.css"')>index.indexOf('href="board.css"'));
});

test('the tracker draws the map card, saves through the campaign handler and refuses a stale campaign',()=>{
 const window={},notices=[];let saves=0,renders=0;
 vm.runInNewContext(read('battle-map.js')+'\n'+read('campaigns.js'),{window,document:{querySelector:()=>null,activeElement:null},confirm:()=>true,Math,Date,JSON,Promise,globalThis:{}});
 const c=camp(mapOf([{id:'p1',x:0,y:0}])),root={innerHTML:'',querySelector:()=>null};
 const ctx={lang:'ru',campaigns:[c],characters:chars(),scope:'s',isCurrent:x=>x===c,save:()=>saves++,render:()=>renders++,notify:m=>notices.push(m)};
 window.Campaigns.handle({type:'click',target:{dataset:{},closest:s=>s==='[data-campaign-action]'?{dataset:{campaignAction:'open',id:c.id}}:null}},ctx);
 const html=window.Campaigns.render([c],chars(),'ru');
 assert.match(html,/data-bm-root/);assert.ok(html.indexOf('data-bm-root')>html.indexOf('campaign-roster'));
 const click=(data,sel)=>({type:'click',target:{dataset:data,closest:s=>s==='[data-bm-root]'?root:s===sel?{dataset:data}:null}});
 renders=0;
 assert.equal(window.Campaigns.handle(click({bmCell:'0,0'},'[data-bm-cell]'),ctx),true);assert.equal(saves,0);
 assert.equal(window.Campaigns.handle(click({bmCell:'4,0'},'[data-bm-cell]'),ctx),true);assert.equal(saves,1);assert.equal(renders,0,'only the card is redrawn');
 assert.deepEqual(plain(c.map.tokens),[{id:'p1',x:4,y:0}]);
 ctx.isCurrent=()=>false;
 assert.equal(window.Campaigns.handle(click({bmCell:'6,0'},'[data-bm-cell]'),ctx),true);assert.equal(saves,1);assert.deepEqual(plain(c.map.tokens),[{id:'p1',x:4,y:0}]);assert.equal(notices.length,1);
});

test('online room: the GM payload carries the map without hidden NPCs and a player keeps a cleaned copy',async()=>{
 const listeners={},store=new Map(),document={addEventListener(type,f){(listeners[type]||=[]).push(f)},querySelector:()=>null,visibilityState:'visible'};
 const later=(f,ms)=>{const h=setTimeout(f,ms);if(ms>=1000)h.unref?.();return h};
 const tab=()=>{const window={document,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},crypto:globalThis.crypto,location:{hash:'',origin:'https://example.test',pathname:'/'},addEventListener(){},confirm:()=>true,navigator:{},btoa,atob};
  vm.runInNewContext(read('room-transport.js')+'\n'+read('room.js')+'\n'+read('battle-map.js'),{window,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,JSON,Math,Date,Number,String,Array,Object,Map,Set,Promise,Error,setTimeout:later,clearTimeout,setInterval:(f,ms)=>{const h=setInterval(f,ms);h.unref?.();return h},clearInterval,console});
  return window};
 const CODE='K7RQM2XAPZ9E',gmWin=tab(),G=gmWin.Room._test;
 const c=camp(mapOf([{id:'p1',x:0,y:0},{id:'n2',x:4,y:4},{id:'n3',x:9,y:9}],[[2,2]]));
 const state={lang:'ru',view:'room',characters:chars(),campaigns:[c]};
 G.setApp({getState:()=>state,notify(){}});G.setTransport({publish:()=>1,close(){}});
 const room=await G.deriveRoom(CODE),gm=await G.ensureIdentity();G.setKey(room.key);
 G.setSession({code:CODE,role:'gm',name:'GM',memberId:gm.fp+'.000000a1',gmFp:gm.fp,campaignId:c.id},room.topic);
 const p=G.combatPayload();
 assert.deepEqual(plain(p.order.map(r=>r.name)),['Нокс','Бандит 1','Босс']);
 assert.deepEqual(plain(p.map),{w:14,h:10,c:[[2,2]],t:[[0,0,0],[2,9,9]]});
 assert.equal(JSON.stringify(p).includes('Снайпер'),false);assert.equal(JSON.stringify(p).includes('4,4'),false);
 delete c.map;assert.equal('map' in G.combatPayload(),false,'no map, no extra field');
 // A player receives it, with junk mixed in.
 const pWin=tab(),P=pWin.Room._test;P.setApp({getState:()=>({lang:'en',characters:[],campaigns:[]}),notify(){}});P.setTransport({publish:()=>1,close(){}});
 const me=await P.ensureIdentity();P.setKey(room.key);
 P.setSession({code:CODE,role:'player',name:'V',memberId:me.fp+'.000000b1',gmFp:gm.fp,gmPin:'link',toasts:false},room.topic);
 const d={...plain(p),map:{w:14,h:10,c:[[2,2],[50,50]],t:[[0,0,0],[2,9,9],[9,1,1]],evil:'<script>'}};
 await P.receive({topic:room.topic+'/c',retain:false,payload:await G.signedEnvelope(gm,gm.fp+'.000000a1',room.topic,room.key,'c','combat',d,Date.now(),'m1')});
 await new Promise(ok=>setTimeout(ok,20));
 const html=P.roomView();
 assert.match(html,/data-bm-shared/);assert.match(html,/Battle map/);assert.equal((html.match(/class="bm-token"/g)||[]).length,2);assert.doesNotMatch(html,/evil|<script>/);
 assert.match(html,/Босс — J10/);
});
