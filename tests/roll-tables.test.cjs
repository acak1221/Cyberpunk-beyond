const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.join(__dirname,'../site'),read=f=>fs.readFileSync(path.join(dir,f),'utf8');
const source=read('roll-tables.js');
const plain=x=>JSON.parse(JSON.stringify(x));
// Values made inside the vm context have another Array and Object: compare their plain copies.
const eq=(a,b,m)=>assert.deepEqual(plain(a),b,m);
const seq=values=>{let i=0;return ()=>values[i++%values.length]};
// A fresh copy for every test: the module keeps the open form, the last result and the undo slot in memory.
function load(options={}){
 const calls=[],state=options.state||{},window={};
 if(options.app!==false)window.App={getState:()=>state,save(){calls.push(['save'])},lang:()=>options.lang||'ru',report:(...a)=>{calls.push(['report',...a]);return true},notify:m=>calls.push(['notify',m])};
 if(options.history!==false)window.RollHistory={add:e=>{calls.push(['history',e]);return true}};
 if(options.room!==undefined)window.Room={active:()=>options.room};
 if(options.session)window.sessionStorage=options.session;
 if(options.gx)window.GMExtras={push:e=>{calls.push(['push',e]);return true}};
 vm.runInNewContext(source,{window,Date,Math,JSON,Promise,setTimeout,Blob,URL});
 return {RT:window.RollTables,window,state,calls};
}
const mkRoot=()=>({isConnected:true,dataset:{lang:'ru'},outerHTML:'',box:{innerHTML:''},querySelector(s){return s==='[data-rtb-problems]'?this.box:null}});
const target=(root,ds={},extra={})=>({closest:s=>s==='[data-rtb-root]'?root:s==='[data-rtb-action]'&&ds.rtbAction?{dataset:ds}:null,dataset:ds,...extra});
const click=(RT,root,action,data={},rng)=>RT.handle({type:'click',target:target(root,{rtbAction:action,...data})},'ru',rng);
const type=(RT,root,field,value,row)=>RT.handle({type:'input',target:target(root,{rtbField:field,...(row===undefined?{}:{rtbRow:String(row)})},{value})},'ru');
const d6={id:'t1',name:'Слухи',group:'Улицы',die:'1d6',entries:[{from:1,to:3,text:'Правда'},{from:4,to:6,text:'Ложь'}]};
const d2d6={id:'t2',name:'Порт',group:'',die:'2d6',entries:[{from:2,to:6,text:'Тихо'},{from:9,to:10,text:'Патруль'},{from:12,to:12,text:'Облава'}]};
const withTables=(...list)=>({gmExtras:{rollTables:plain(list)}});
// Builds a table through the editor exactly as the user would: new, type, add a list, save.
function build(RT,root,name,lines,die){
 click(RT,root,'new');type(RT,root,'name',name);
 if(die)RT.handle({type:'change',target:target(root,{rtbField:'die'},{value:die})},'ru');
 type(RT,root,'bulk',lines);click(RT,root,'bulk-add');
 return click(RT,root,'save');
}

test('both languages have the same strings, and the English card has no Russian in it',()=>{
 const {RT}=load({lang:'en',state:withTables({...d6,name:'Rumors',group:'Streets',entries:[{from:1,to:5,text:'True'}]}),room:true});
 eq(Object.keys(RT.T.ru).sort(),Object.keys(RT.T.en).sort());
 for(const k of Object.keys(RT.T.ru))assert.equal(typeof RT.T.ru[k],typeof RT.T.en[k],k);
 const root=mkRoot();root.dataset.lang='en';
 assert.doesNotMatch(RT.render('en'),/[А-Яа-яЁё]/);
 RT.handle({type:'click',target:target(root,{rtbAction:'edit',rtbId:'t1'})},'en');
 type(RT,root,'to','9',0);RT.handle({type:'click',target:target(root,{rtbAction:'save'})},'en');
 assert.match(root.outerHTML,/rtb-error/);assert.doesNotMatch(root.outerHTML,/[А-Яа-яЁё]/);
 assert.doesNotMatch(load({lang:'en'}).RT.render('en'),/[А-Яа-яЁё]/,'empty state');
 assert.match(load().RT.render('ru'),/Своих таблиц пока нет/);
});

test('dieInfo knows the listed dice only',()=>{
 const {RT}=load();
 eq(plain(RT.dieInfo('1d100')),{count:1,sides:100,min:1,max:100});
 eq(plain(RT.dieInfo('2d6')),{count:2,sides:6,min:2,max:12});
 eq(plain(RT.dieInfo('3d6')),{count:3,sides:6,min:3,max:18});
 for(const d of RT.DICE){const i=RT.dieInfo(d);assert.equal(i.min,i.count);assert.equal(i.max,i.count*i.sides)}
 for(const bad of ['4d6','1d7','d6','1D6',' 1d6',null,undefined,6,['1d6'],{}])assert.equal(RT.dieInfo(bad),null);
});

test('cleanTable rebuilds a table from known fields and never throws',()=>{
 const {RT}=load();
 const raw=JSON.parse('{"id":"a-1","name":"  My\\n\\u0000 table  ","group":"G","die":"1d6","html":"<b>","onclick":"x","__proto__":{"polluted":1},"entries":[{"from":"4","to":6,"text":" B ","evil":1},{"from":1,"to":3,"text":"A"},{"from":1.5,"to":2,"text":"x"},{"from":1,"to":2,"text":"  "},null,7,[1,2,"x"]]}');
 eq(plain(RT.cleanTable(raw)),{id:'a-1',name:'My table',group:'G',die:'1d6',entries:[{from:1,to:3,text:'A'},{from:4,to:6,text:'B'}]});
 assert.equal({}.polluted,undefined);
 const long=RT.cleanTable({id:'x',name:'n'.repeat(200),group:'g'.repeat(200),die:'1d100',entries:Array.from({length:300},(_,i)=>({from:i,to:i,text:'t'.repeat(500)}))});
 assert.equal(long.name.length,60);assert.equal(long.group.length,40);assert.equal(long.entries.length,100);assert.equal(long.entries[0].text.length,160);
 assert.equal(RT.cleanTable({id:'x',name:'n',die:'1d6',entries:[{from:1,to:1,text:'a'}]}).group,'');
 for(const bad of [null,undefined,5,'x',[],[d6],{...d6,id:'<x>'},{...d6,id:'a'.repeat(33)},{...d6,id:7},{...d6,name:'  '},{...d6,name:5},{...d6,die:'4d6'},{...d6,entries:'x'},{...d6,entries:[]},{...d6,entries:[{from:'x',to:1,text:'a'}]}])assert.equal(RT.cleanTable(bad),null);
});

test('check finds overlaps, ranges outside the die, reversed ranges, empty text; gaps are only a warning',()=>{
 const {RT}=load();
 eq(plain(RT.check(d6)),{errors:[],gaps:[]});
 eq(plain(RT.check(d2d6)),{errors:[],gaps:[[7,8],[11,11]]});
 eq(plain(RT.check({die:'1d6',entries:[{from:1,to:4,text:'a'},{from:3,to:6,text:'b'}]}).errors),[{key:'overlap',row:2,rows:[1,2],value:3}]);
 eq(plain(RT.check({die:'2d6',entries:[{from:1,to:12,text:'a'}]})),{errors:[{key:'range',row:1}],gaps:[]});
 eq(plain(RT.check({die:'1d6',entries:[{from:1,to:7,text:'a'}]}).errors),[{key:'range',row:1}]);
 eq(plain(RT.check({die:'1d6',entries:[{from:5,to:2,text:'a'}]})),{errors:[{key:'order',row:1}],gaps:[[1,6]]});
 eq(plain(RT.check({die:'1d6',entries:[{from:1,to:6,text:' '},{from:'',to:'2',text:'b'}]}).errors),[{key:'text',row:1},{key:'number',row:2}]);
 eq(plain(RT.check({die:'1d6',entries:[]})),{errors:[{key:'empty'}],gaps:[]});
 eq(plain(RT.check({die:'9d9',entries:[]}).errors),[{key:'die'}]);
 eq(plain(RT.check({die:'1d100',entries:[{from:1,to:50,text:'a'},{from:52,to:99,text:'b'}]})),{errors:[],gaps:[[51,51],[100,100]]});
 // Strings typed into the form are read as numbers.
 eq(plain(RT.check({die:'1d6',entries:[{from:'1',to:'6',text:'a'}]})),{errors:[],gaps:[]});
 for(const bad of [null,undefined,5,{}])assert.equal(RT.check(bad).errors.length,1);
});

test('lookup and roll: the dice are summed, a gap gives no entry, a broken random source stays on the die',()=>{
 const {RT}=load();
 eq(plain(RT.roll(d6,seq([0.5]))),{dice:[4],total:4,entry:{from:4,to:6,text:'Ложь'}});
 eq(plain(RT.roll(d2d6,seq([0,0.99]))),{dice:[1,6],total:7,entry:null});
 eq(plain(RT.roll(d2d6,seq([0.99]))),{dice:[6,6],total:12,entry:{from:12,to:12,text:'Облава'}});
 const big={id:'b',name:'b',group:'',die:'1d100',entries:[{from:1,to:100,text:'всё'}]};
 assert.equal(RT.roll(big,seq([0.565])).total,57);
 for(const v of [1,-1,NaN,2,undefined,'x',Infinity])for(const die of RT.DICE){const info=RT.dieInfo(die),r=RT.roll({die,entries:[]},()=>v);assert.equal(r.dice.length,info.count);for(const f of r.dice)assert(Number.isInteger(f)&&f>=1&&f<=info.sides,`${die} with ${v}: ${f}`)}
 assert.equal(RT.lookup({entries:[{from:1,to:4,text:'first'},{from:3,to:6,text:'second'}]},3).text,'first');
 assert.equal(RT.lookup(d6,7),null);assert.equal(RT.lookup(null,1),null);assert.equal(RT.roll({die:'5d5'}),null);
});

test('spread hands out the whole die in order, the leftover to the first rows',()=>{
 const {RT}=load();
 eq(plain(RT.spread(3,1,6)),[[1,2],[3,4],[5,6]]);
 eq(plain(RT.spread(4,1,10)),[[1,3],[4,6],[7,8],[9,10]]);
 eq(plain(RT.spread(3,2,12)),[[2,5],[6,9],[10,12]]);
 eq(plain(RT.spread(8,1,6)),[[1,1],[2,2],[3,3],[4,4],[5,5],[6,6],null,null]);
 eq(plain(RT.spread(0,1,6)),[]);
 for(const die of RT.DICE){const {min,max}=RT.dieInfo(die);for(let n=1;n<=max-min+1&&n<=100;n++){
  const s=RT.spread(n,min,max);assert.equal(s.length,n);assert.equal(s[0][0],min);assert.equal(s[n-1][1],max);
  for(let i=1;i<n;i++){assert.equal(s[i][0],s[i-1][1]+1);assert(s[i][1]-s[i][0]<=s[i-1][1]-s[i-1][0])}
 }}
});

test('parseLines reads one entry per line with an optional range in front',()=>{
 const {RT}=load();
 const p=RT.parseLines('3-4 Патруль\n3–4: Патруль\r\n5 Тишина\n\n   \nПросто текст\n7-8\n9:\n10.Облава\n2 — 3 Дождь\n1d6 урона\n4 -');
 eq(plain(p.rows),[{from:'3',to:'4',text:'Патруль'},{from:'3',to:'4',text:'Патруль'},{from:'5',to:'5',text:'Тишина'},{from:'',to:'',text:'Просто текст'},{from:'10',to:'10',text:'Облава'},{from:'2',to:'3',text:'Дождь'},{from:'',to:'',text:'1d6 урона'}]);
 eq(plain(p.bad),['7-8','9:','4 -']);assert.equal(p.more,0);
 assert.equal(RT.parseLines('x'.repeat(500)).rows[0].text.length,160);
 const many=RT.parseLines(Array.from({length:130},(_,i)=>'строка '+i).join('\n'));
 assert.equal(many.rows.length,100);assert.equal(many.more,30);
 for(const bad of [null,undefined,5,''])eq(plain(RT.parseLines(bad)),{rows:[],bad:[],more:0});
});

test('label and detail: exact lines for the history and the feed, always inside the room clips',()=>{
 const {RT}=load();
 assert.equal(RT.label('Слухи','ru'),'Таблица: Слухи');assert.equal(RT.label('Rumors','en'),'Table: Rumors');
 assert.equal(RT.detail({dice:[4],total:4,entry:{text:'Ложь'}},'1d6','ru'),'1d6: 4 · Ложь');
 assert.equal(RT.detail({dice:[3,4],total:7,entry:{text:'Quiet'}},'2d6','en'),'2d6: 3 + 4 = 7 · Quiet');
 assert.equal(RT.detail({dice:[3,4],total:7,entry:null},'2d6','ru'),'2d6: 3 + 4 = 7 · нет записи');
 assert.equal(RT.detail({dice:[57],total:57,entry:null},'1d100','en'),'1d100: 57 · no entry');
 // room.js cuts a label at 80 and a detail at 200 characters: nothing of a longest table may be lost.
 for(const lang of ['ru','en']){
  assert(RT.label('W'.repeat(RT.MAX_NAME),lang).length<=80);
  for(const die of RT.DICE){const info=RT.dieInfo(die),dice=Array(info.count).fill(info.sides);assert(RT.detail({dice,total:info.max,entry:{text:'W'.repeat(RT.MAX_TEXT)}},die,lang).length<=200,die)}
 }
});

test('storage: old saves without tables work, broken data is dropped, the neighbours in gmExtras are left alone',()=>{
 const {RT}=load();
 for(const st of [null,undefined,{},{gmExtras:[]},{gmExtras:null},{gmExtras:{}},{gmExtras:{rollTables:'x'}},{gmExtras:{rollTables:{}}}])eq(plain(RT.readTables(st)),[]);
 const st={gmExtras:{rollTables:[d6,{...d6,name:'дубль'},{...d6,id:'bad id'},{...d6,id:'u',die:'1d7'},null,5,{...d2d6}]}};
 eq(RT.readTables(st).map(t=>t.id),['t1','t2']);
 assert.equal(RT.readTables({gmExtras:{rollTables:Array.from({length:80},(_,i)=>({...d6,id:'k'+i}))}}).length,50);
 // A hand-edited backup with overlapping rows is still readable and still answers a roll.
 const odd={gmExtras:{rollTables:[{...d6,entries:[{from:1,to:6,text:'a'},{from:2,to:3,text:'b'}]}]}};
 assert.equal(RT.readTables(odd).length,1);assert.equal(RT.roll(RT.readTables(odd)[0],seq([0.2])).entry.text,'a');
 const keep={gmExtras:{clocks:[{id:'c'}],npcLibrary:[{id:'n'}]}};
 assert.equal(RT.writeTables(keep,[d6]),true);
 eq(plain(keep.gmExtras.clocks),[{id:'c'}]);eq(plain(keep.gmExtras.npcLibrary),[{id:'n'}]);eq(plain(keep.gmExtras.rollTables),[d6]);
 const fresh={};RT.writeTables(fresh,[d6,{bad:1}]);eq(plain(fresh.gmExtras),{rollTables:[d6]});
 const arr={gmExtras:[]};RT.writeTables(arr,[]);eq(plain(arr.gmExtras),{rollTables:[]});
 assert.equal(RT.writeTables(null,[]),false);assert.equal(RT.writeTables({},'x'),false);
});

test('the editor: a new table is typed, checked as it is typed, and saved clean with one save',()=>{
 const {RT,state,calls}=load(),root=mkRoot();
 assert.equal(click(RT,root,'new'),true);
 assert.match(root.outerHTML,/data-rtb-form/);assert.match(root.outerHTML,/Добавьте хотя бы одну строку/);
 type(RT,root,'name','  Слухи  ');type(RT,root,'group','Улицы');
 click(RT,root,'row-add');click(RT,root,'row-add');
 eq(plain(RT.ui.draft.rows),[{from:'1',to:'1',text:''},{from:'2',to:'2',text:''}],'a new row continues after the last one');
 type(RT,root,'text','Правда',0);type(RT,root,'to','3',0);type(RT,root,'from','4',1);type(RT,root,'to','5',1);
 assert.match(root.box.innerHTML,/Строка 2: впишите результат/,'problems are refreshed on every keystroke');
 type(RT,root,'text','Ложь',1);
 assert.match(root.box.innerHTML,/Нет результата для: 6\./);assert.doesNotMatch(root.box.innerHTML,/rtb-bad/);
 type(RT,root,'to','6',1);assert.match(root.box.innerHTML,/Все значения кубика заняты/);
 // What was typed survives a redraw made by somebody else.
 assert.match(RT.render('ru'),/value="Правда"/);
 click(RT,root,'save');
 const saved=plain(state.gmExtras.rollTables);
 assert.equal(saved.length,1);assert.match(saved[0].id,/^[A-Za-z0-9_-]{1,32}$/);
 eq({...saved[0],id:''},{id:'',name:'Слухи',group:'Улицы',die:'1d6',entries:[{from:1,to:3,text:'Правда'},{from:4,to:6,text:'Ложь'}]});
 assert.equal(calls.filter(c=>c[0]==='save').length,1);assert.equal(RT.ui.draft,null);
 assert.match(root.outerHTML,/data-rtb-action="roll"/);assert.doesNotMatch(root.outerHTML,/data-rtb-form/);
});

test('the editor: errors keep the form open and store nothing; an edit keeps the id; a list is pasted and spread',()=>{
 const {RT,state,calls}=load({state:withTables(d6)}),root=mkRoot();
 click(RT,root,'edit',{rtbId:'t1'});
 eq(plain(RT.ui.draft),{id:'t1',name:'Слухи',group:'Улицы',die:'1d6',rows:[{from:'1',to:'3',text:'Правда'},{from:'4',to:'6',text:'Ложь'}]});
 type(RT,root,'from','3',1);
 assert.match(root.box.innerHTML,/Строки 1 и 2 пересекаются на значении 3/);
 click(RT,root,'save');
 assert.equal(RT.ui.error,'fix');assert.match(root.outerHTML,/role="alert"/);assert.equal(calls.length,0);eq(plain(state.gmExtras.rollTables),[d6]);
 type(RT,root,'from','4',1);type(RT,root,'name',' ');click(RT,root,'save');assert.equal(RT.ui.error,'name');
 type(RT,root,'name','Слухи порта');
 // A gap is allowed: the table is saved, and the list marks it.
 click(RT,root,'row-del',{rtbRow:'1'});click(RT,root,'save');
 eq(plain(state.gmExtras.rollTables),[{...d6,name:'Слухи порта',entries:[d6.entries[0]]}]);assert.match(root.outerHTML,/есть пропуски/);
 // A pasted list without ranges is spread over the die at once; with ranges it is taken as written.
 click(RT,root,'new');type(RT,root,'name','Встречи');type(RT,root,'bulk','Патруль\nТихо\nДождь\n7-9');click(RT,root,'bulk-add');
 eq(plain(RT.ui.draft.rows),[{from:'1',to:'2',text:'Патруль'},{from:'3',to:'4',text:'Тихо'},{from:'5',to:'6',text:'Дождь'}]);
 eq(plain(RT.ui.bulkNote),{added:3,bad:1,more:0});assert.equal(RT.ui.bulk,'');
 RT.handle({type:'change',target:target(root,{rtbField:'die'},{value:'2d6'})},'ru');
 assert.match(root.outerHTML,/Значения от 2 до 12/);assert.match(root.outerHTML,/диапазон выходит за кубик \(2–12\)/);
 RT.handle({type:'change',target:target(root,{rtbField:'die'},{value:'7d7'})},'ru');assert.equal(RT.ui.draft.die,'2d6');
 click(RT,root,'spread');
 eq(RT.ui.draft.rows.map(r=>r.from+'-'+r.to),['2-5','6-9','10-12']);
 type(RT,root,'bulk','12 Облава');click(RT,root,'bulk-add');
 eq(RT.ui.draft.rows.map(r=>r.from+'-'+r.to),['2-5','6-9','10-12','12-12'],'ranges that are already there are not touched');
 click(RT,root,'cancel');assert.equal(RT.ui.draft,null);assert.equal(state.gmExtras.rollTables.length,1);
});

test('limits: fifty tables and a size budget, both said in words',()=>{
 const full=load({state:{gmExtras:{rollTables:Array.from({length:50},(_,i)=>({...d6,id:'k'+i}))}}}),root=mkRoot();
 build(full.RT,root,'Лишняя','Раз\nДва');
 assert.equal(full.RT.ui.error,'full');assert.match(root.outerHTML,/Достигнут предел — 50 таблиц/);assert.equal(full.state.gmExtras.rollTables.length,50);assert.equal(full.calls.length,0);
 // Editing one of the fifty is still possible.
 click(full.RT,root,'cancel');click(full.RT,root,'edit',{rtbId:'k3'});type(full.RT,root,'name','Новое имя');click(full.RT,root,'save');
 assert.equal(full.state.gmExtras.rollTables[3].name,'Новое имя');
 const fat=Array.from({length:7},(_,i)=>({id:'f'+i,name:'n',group:'',die:'1d100',entries:Array.from({length:100},(_,j)=>({from:j+1,to:j+1,text:'т'.repeat(160)}))}));
 const big=load({state:{gmExtras:{rollTables:fat}}}),r2=mkRoot();
 assert(JSON.stringify(fat).length>big.RT.MAX_TOTAL-20000&&JSON.stringify(fat).length<big.RT.MAX_TOTAL);
 build(big.RT,r2,'Ещё одна',Array.from({length:100},()=>'т'.repeat(160)).join('\n'),'1d100');
 assert.equal(big.RT.ui.error,'big');assert.equal(big.state.gmExtras.rollTables.length,7);assert.equal(big.calls.length,0);
});

test('delete is one press with an undo that puts the exact list back',()=>{
 const {RT,state,calls}=load({state:withTables(d6,d2d6)}),root=mkRoot();
 click(RT,root,'del',{rtbId:'t1'});
 eq(state.gmExtras.rollTables.map(t=>t.id),['t2']);assert.equal(calls.filter(c=>c[0]==='save').length,1);
 assert.match(root.outerHTML,/Таблица «Слухи» удалена\./);assert.match(root.outerHTML,/data-rtb-action="undo"/);
 click(RT,root,'undo');
 eq(plain(state.gmExtras.rollTables),[d6,d2d6]);assert.equal(RT.ui.undo,null);assert.doesNotMatch(root.outerHTML,/data-rtb-action="undo"/);
 // The next change closes the offer.
 click(RT,root,'del',{rtbId:'t2'});assert(RT.ui.undo);
 build(RT,root,'Новая','Раз\nДва');
 assert.equal(RT.ui.undo,null);eq(state.gmExtras.rollTables.map(t=>t.name),['Слухи','Новая']);
 assert.equal(click(RT,root,'del',{rtbId:'nope'}),true);assert.equal(state.gmExtras.rollTables.length,2);
 assert.equal(click(RT,root,'del',{rtbId:'"]<x'}),true);assert.equal(state.gmExtras.rollTables.length,2);
});

test('a roll goes to the history and the feed through App.report, and to the recent results of the GM tools',()=>{
 const {RT,calls}=load({state:withTables(d6,d2d6),gx:true,room:true}),root=mkRoot();
 click(RT,root,'roll',{rtbId:'t2'},seq([0.5,0.99]));
 eq(plain(calls),[['report','Таблица: Порт','2d6: 4 + 6 = 10 · Патруль',10,[{v:4,s:6},{v:6,s:6}]],['push',{kind:'custom',custom:{name:'Порт',die:'2d6',dice:[4,6],total:10,text:'Патруль'}}]]);
 assert.match(root.outerHTML,/role="status"[^>]*>.*Патруль/);assert.doesNotMatch(root.outerHTML,/только у вас/);
 calls.length=0;click(RT,root,'roll',{rtbId:'t2'},seq([0,0.99]));
 assert.equal(calls[0][2],'2d6: 1 + 6 = 7 · нет записи');assert.equal(calls[1][1].custom.text,'');assert.match(root.outerHTML,/Для 7 нет записи\./);
 // Nothing is stored by a roll: the tables themselves do not change.
 assert.equal(calls.some(c=>c[0]==='save'||c[0]==='history'),false);
});

test('a quiet roll in a room stays out of the feed; outside a room the tick does nothing',()=>{
 const inRoom=load({state:withTables(d6),gx:true,room:true}),root=mkRoot();
 assert.match(inRoom.RT.render('ru'),/Не показывать бросок игрокам/);
 inRoom.RT.handle({type:'change',target:target(root,{rtbField:'quiet'},{checked:true})},'ru');
 click(inRoom.RT,root,'roll',{rtbId:'t1'},seq([0]));
 eq(plain(inRoom.calls),[['history',{label:'Таблица: Слухи',detail:'1d6: 1 · Правда',total:1}],['push',{kind:'custom',custom:{name:'Слухи',die:'1d6',dice:[1],total:1,text:'Правда'}}]]);
 assert.match(root.outerHTML,/только у вас/);assert.match(root.outerHTML,/data-rtb-field="quiet" checked/);
 const alone=load({state:withTables(d6),room:false}),r2=mkRoot();
 assert.doesNotMatch(alone.RT.render('ru'),/data-rtb-field="quiet"/);
 alone.RT.handle({type:'change',target:target(r2,{rtbField:'quiet'},{checked:true})},'ru');
 click(alone.RT,r2,'roll',{rtbId:'t1'},seq([0]));
 assert.equal(alone.calls[0][0],'report');assert.equal(alone.calls.length,1);
});

test('without the other modules a roll still shows its result, and a stray event is ignored',()=>{
 const {RT,window}=load({state:withTables(d6),history:false}),root=mkRoot();
 window.App.report=undefined;
 assert.equal(click(RT,root,'roll',{rtbId:'t1'},seq([0.9])),true);
 assert.match(root.outerHTML,/Ложь/);
 const bare=load({app:false,history:false});
 assert.match(bare.RT.render('ru'),/Своих таблиц пока нет/);
 const r=mkRoot();assert.equal(click(bare.RT,r,'roll',{rtbId:'t1'}),true);
 build(bare.RT,r,'Таблица','Раз');assert.equal(bare.RT.ui.error,'store');
 assert.equal(RT.handle({type:'click',target:{closest:()=>null,dataset:{}}}),false);
 assert.equal(RT.handle({type:'click',target:target({...mkRoot(),isConnected:false},{rtbAction:'new'})}),false);
 assert.equal(RT.handle({type:'click',target:target(mkRoot(),{rtbAction:'nonsense'})}),false);
 assert.equal(RT.handle({type:'keydown',target:target(mkRoot(),{rtbAction:'new'})}),false);
 assert.equal(RT.handle(null),false);assert.equal(type(RT,mkRoot(),'name','x'),false,'no open form');
});

test('entryHtml draws a saved result safely and refuses a broken one',()=>{
 const {RT}=load();
 const h=RT.entryHtml({name:'<script>x</script>"',die:'2d6',dice:[3,4],total:7,text:'<img src=x onerror=1>&'},'ru');
 assert.doesNotMatch(h,/<script|<img/);assert.match(h,/&lt;script&gt;x&lt;\/script&gt;&quot;/);assert.match(h,/&lt;img src=x onerror=1&gt;&amp;/);
 assert.match(h,/Таблица: /);assert.match(h,/2d6: 3 \+ 4 =<\/span><span class="gx-die rtb-total">7</);
 assert.match(RT.entryHtml({name:'T',die:'1d6',dice:[2],total:2,text:''},'en'),/No entry for 2\./);
 const ok={name:'T',die:'2d6',dice:[3,4],total:7,text:'x'};
 for(const bad of [null,5,'x',[],{...ok,dice:undefined},{...ok,dice:[3]},{...ok,dice:[3,7]},{...ok,dice:[3,'4']},{...ok,total:8},{...ok,die:'2d7'},{...ok,name:''},{...ok,name:5}])assert.equal(RT.entryHtml(bad,'ru'),'');
 // The same line gm-extras writes to a campaign journal from this markup.
 const gx={window:{RollTables:RT},Math,Number,String,Array,Object,Set,Infinity,JSON,Date};vm.runInNewContext(read('gm-extras.js'),gx);
 assert.equal(gx.window.GMExtras.push({kind:'custom',custom:ok}),true);
 const text=String(RT.entryHtml(ok,'ru')).replace(/<\/strong>/g,'; ').replace(/<\/span>/g,' ').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
 assert.equal(text,'Таблица: T 2d6: 3 + 4 = 7 x;');
});

test('a table file: round trip, and every kind of wrong file is refused with a reason',()=>{
 const {RT}=load();
 const file=RT.buildFile([d6,d2d6,{junk:1}],'  Мой\nнабор  ',new Date('2026-01-02T03:04:05Z'));
 eq(plain(file),{format:'nightcity-red-roll-tables',version:1,title:'Мой набор',exportedAt:'2026-01-02T03:04:05.000Z',tables:[d6,d2d6]});
 const back=RT.parseFile(JSON.stringify(file,null,2));
 assert.equal(back.ok,true);assert.equal(back.title,'Мой набор');eq(plain(back.tables),[d6,d2d6]);eq(plain(back.rejected),[]);
 assert.equal(RT.parseFile('x'.repeat(RT.MAX_FILE_CHARS+1)).reason,'size');assert.equal(RT.parseFile(null).reason,'size');
 assert.equal(RT.parseFile('{nope').reason,'json');
 for(const wrong of ['[]','5','null','{}',JSON.stringify({format:'other',tables:[]}),JSON.stringify({format:RT.FORMAT,tables:{}}),JSON.stringify({characters:[],campaigns:[],gmExtras:{rollTables:[d6]}})])assert.equal(RT.parseFile(wrong).reason,'format');
 assert.equal(RT.parseFile(JSON.stringify({...file,version:2})).reason,'newer');
 assert.equal(RT.parseFile(JSON.stringify({...file,tables:[]})).reason,'empty');
 const mixed=RT.parseFile(JSON.stringify({format:RT.FORMAT,version:1,title:5,tables:[d6,{...d6,name:'дубль'},{...d2d6,name:'N'.repeat(90),entries:[{from:2,to:8,text:'a'},{from:8,to:12,text:'b'}]},{...d2d6,id:'z',entries:[{from:1,to:12,text:'a'}]},{name:'<b>без id</b>'},7,null]}));
 assert.equal(mixed.ok,true);assert.equal(mixed.title,'');eq(mixed.tables.map(t=>t.id),['t1']);
 eq(plain(mixed.rejected),[{name:'дубль',reason:'twice'},{name:'N'.repeat(60),reason:'ranges'},{name:'Порт',reason:'ranges'},{name:'<b>без id</b>',reason:'broken'},{name:'',reason:'broken'},{name:'',reason:'broken'}]);
 const none=RT.parseFile(JSON.stringify({format:RT.FORMAT,version:1,tables:[{...d6,die:'1d7'}]}));
 assert.equal(none.reason,'empty');assert.equal(none.rejected.length,1);
});

test('import: a plan first, nothing stored until the user agrees, then one undo',()=>{
 const {RT}=load();
 const changed={...d6,name:'Слухи 2'},fresh={...d2d6,id:'t9'};
 const plan=RT.planImport([d6,d2d6],{tables:[d2d6,changed,fresh]});
 eq(plan.rows.map(r=>r.status),['same','update','new']);
 eq([plan.added,plan.updated,plan.same,plan.overflow],[1,1,1,0]);
 eq(plain(RT.applyImport([d6,d2d6],{tables:[d2d6,changed,fresh]})),{list:[changed,d2d6,fresh],added:1,updated:1});
 const fifty=Array.from({length:50},(_,i)=>({...d6,id:'k'+i}));
 const over=RT.planImport(fifty,{tables:[fresh,{...d6,id:'k0',name:'замена'}]});
 eq(over.rows.map(r=>r.status),['overflow','update']);assert.equal(over.list.length,50);
 const fat=i=>({id:'f'+i,name:'n',group:'',die:'1d100',entries:Array.from({length:100},(_,j)=>({from:j+1,to:j+1,text:'т'.repeat(160)}))});
 const heavy=RT.planImport(Array.from({length:7},(_,i)=>fat(i)),{tables:[fat(20),d6]});
 eq(heavy.rows.map(r=>r.status),['overflow','new'],'the size budget is kept as well');

 const live=load({state:withTables(d6)}),root=mkRoot();
 live.RT.openFile(JSON.stringify(RT.buildFile([changed,fresh,d2d6],'Набор <b>')));
 const before=plain(live.state);
 const html=live.RT.render('ru');
 assert.match(html,/data-rtb-preview/);assert.match(html,/Набор &lt;b&gt;/);assert.match(html,/Новых: 2 · заменит ваши: 1 · без изменений: 0/);
 eq(plain(live.state),before);assert.equal(live.calls.length,0);
 click(live.RT,root,'apply');
 eq(live.state.gmExtras.rollTables.map(t=>t.name),['Слухи 2','Порт','Порт']);assert.equal(live.calls.filter(c=>c[0]==='save').length,1);
 assert.match(root.outerHTML,/Таблицы из файла добавлены: новых — 2, заменено — 1\./);assert.doesNotMatch(root.outerHTML,/data-rtb-preview/);
 click(live.RT,root,'undo');eq(plain(live.state.gmExtras.rollTables),[d6]);
 // The same file again: nothing new, so there is nothing to press.
 live.RT.openFile(JSON.stringify(RT.buildFile([d6],'')));
 const again=live.RT.render('ru');assert.match(again,/Новых: 0 · заменит ваши: 0 · без изменений: 1/);assert.match(again,/Добавлять нечего/);assert.doesNotMatch(again,/data-rtb-action="apply"/);
 click(live.RT,root,'discard');assert.equal(live.RT.ui.preview,null);
 live.RT.openFile('{"format":"x"}');assert.match(live.RT.render('ru'),/role="alert"[^>]*>Это не файл таблиц бросков/);
});

test('a file is read from the file field: too large is refused before reading',async()=>{
 const {RT}=load({state:withTables(d6)}),root=mkRoot();
 const pick=file=>RT.handle({type:'change',target:target(root,{rtbFile:''},{files:[file]})},'ru');
 let readCalls=0;
 assert.equal(pick({size:RT.MAX_FILE_CHARS*4+1,text:()=>{readCalls++;return Promise.resolve('')}}),true);
 assert.equal(readCalls,0);assert.equal(RT.ui.fileError,'size');assert.match(root.outerHTML,/Файл слишком большой/);
 pick({size:100,text:()=>Promise.resolve(JSON.stringify(RT.buildFile([d2d6],'Порт')))});
 await new Promise(r=>setTimeout(r,5));
 assert.equal(RT.ui.fileError,null);assert.equal(RT.ui.preview.tables[0].id,'t2');assert.match(root.outerHTML,/data-rtb-preview/);
 pick({size:100,text:()=>Promise.reject(new Error('gone'))});
 await new Promise(r=>setTimeout(r,5));
 assert.equal(RT.ui.fileError,'json');assert.equal(RT.ui.preview,null);
 assert.equal(RT.handle({type:'change',target:target(root,{rtbFile:''},{files:[]})},'ru'),false);
});

test('everything the user or a file wrote is escaped wherever it is drawn',()=>{
 const evil='<img src=x onerror=alert(1)>"\'&',t={id:'e1',name:evil,group:evil.slice(0,40),die:'1d6',entries:[{from:1,to:6,text:evil}]};
 const {RT,state}=load({state:{gmExtras:{rollTables:[t,{...d6,id:'x" onclick="1'},{...d6,id:'ok_id-2'}]}},gx:true}),root=mkRoot();
 const safe=h=>{assert.doesNotMatch(h,/<img/);assert.doesNotMatch(h,/onerror=alert\(1\)>"/);assert.match(h,/&lt;img src=x onerror=alert\(1\)&gt;&quot;&#39;&amp;/)};
 safe(RT.render('ru'));
 assert.doesNotMatch(RT.render('ru'),/onclick/,'an id that is not plain never reaches the markup');assert.match(RT.render('ru'),/data-rtb-id="ok_id-2"/);
 click(RT,root,'roll',{rtbId:'e1'},seq([0.1]));safe(root.outerHTML);assert.match(root.outerHTML,/rtb-result/);
 click(RT,root,'edit',{rtbId:'e1'});safe(root.outerHTML);assert.match(root.outerHTML,/<datalist id="rtb-groups"><option value="&lt;img/);
 type(RT,root,'bulk','</textarea><script>');assert.doesNotMatch(RT.render('ru'),/<script>/);
 click(RT,root,'cancel');
 RT.openFile(JSON.stringify(RT.buildFile([{...t,id:'e2'}],evil)));safe(RT.render('ru'));
 click(RT,root,'apply');click(RT,root,'del',{rtbId:'e2'});safe(root.outerHTML);assert.match(root.outerHTML,/rtb-undo/);
 assert.equal(state.gmExtras.rollTables.length,2);
});

test('the module and its stylesheet are registered, the styles use theme colours only',()=>{
 const html=read('index.html'),css=read('roll-tables.css');
 assert(html.indexOf('src="roll-tables.js"')>0&&html.indexOf('src="roll-tables.js"')<html.indexOf('src="gm-extras.js"'),'before gm-extras, which reads the saved results while it loads');assert(html.indexOf('src="roll-tables.js"')<html.indexOf('src="app.js"'));
 assert(html.indexOf('href="roll-tables.css"')>0);
 assert.doesNotMatch(css,/#[0-9a-fA-F]{3,8}\b|rgba?\(/,'no hard-coded colours');
 assert.match(css,/\.rtb-card \.btn[^{]*\{[^}]*min-height:44px/);
 assert.doesNotMatch(source,/\r/);assert.doesNotMatch(css,/\r/);
});

// A stand-in for sessionStorage that can be handed from one copy of the module to the next, like a reload.
const tabStore=()=>{const m=new Map();return {m,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>{m.set(k,String(v))},removeItem:k=>{m.delete(k)}}};

test('a saved result is still in «recent results» after a reload: the scripts load in the order of index.html',()=>{
 // gm-extras drops every saved result it cannot draw while it loads, so the module that draws them must be there first.
 const html=read('index.html'),order=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(f=>f==='roll-tables.js'||f==='gm-extras.js');
 eq(order,['roll-tables.js','gm-extras.js']);
 const ok={name:'Слухи',die:'2d6',dice:[3,4],total:7,text:'Патруль'},kept=new Map([['nc-gm-prep-v1',JSON.stringify({v:1,log:[{kind:'custom',custom:ok},{kind:'custom',custom:{...ok,total:9}}],weatherLog:[]})]]);
 const window={localStorage:{getItem:k=>kept.has(k)?kept.get(k):null,setItem:(k,v)=>{kept.set(k,String(v))}}};
 const context={window,Math,Number,String,Array,Object,Set,Infinity,JSON,Date,Promise,setTimeout,Blob,URL};
 for(const f of order)vm.runInNewContext(read(f),context);
 eq(plain(window.GMExtras.log),[{kind:'custom',custom:ok}],'the sound result is kept, the broken one is dropped');
 // The next result of any kind rewrites the saved list: the old one must still be in it.
 assert.equal(window.GMExtras.push({kind:'custom',custom:{...ok,dice:[1,1],total:2}}),true);
 eq(JSON.parse(kept.get('nc-gm-prep-v1')).log.map(e=>e.custom.total),[2,7]);
});

test('the undo offer is withdrawn when the tables were changed from outside the card',()=>{
 const other={id:'b1',name:'Из копии',group:'',die:'1d6',entries:[{from:1,to:6,text:'x'}]};
 // After a delete: a backup is restored on another screen, then the GM comes back to the card.
 const a=load({state:withTables(d6,d2d6)}),ra=mkRoot();
 click(a.RT,ra,'del',{rtbId:'t1'});assert.match(ra.outerHTML,/data-rtb-action="undo"/);
 a.state.gmExtras={rollTables:plain([other])};
 assert.doesNotMatch(a.RT.render('ru'),/rtb-undo|data-rtb-action="undo"/);assert.equal(a.RT.ui.undo,null);
 // A press on a bar that is still on the screen (drawn before the change) must not write the old list either.
 const b=load({state:withTables(d6,d2d6)}),rb=mkRoot();
 click(b.RT,rb,'del',{rtbId:'t1'});b.state.gmExtras={rollTables:plain([other])};const saves=b.calls.length;
 click(b.RT,rb,'undo');
 eq(plain(b.state.gmExtras.rollTables),[other]);assert.equal(b.calls.length,saves,'nothing was saved');assert.doesNotMatch(rb.outerHTML,/data-rtb-action="undo"/);
 // The same after an import.
 const c=load({state:withTables(d6)}),rc=mkRoot();
 c.RT.openFile(JSON.stringify(c.RT.buildFile([d2d6],'')));click(c.RT,rc,'apply');assert(c.RT.ui.undo);
 c.state.gmExtras.rollTables.push(plain(other));
 click(c.RT,rc,'undo');eq(c.state.gmExtras.rollTables.map(t=>t.id),['t1','t2','b1']);
 // Untouched tables: the way back still works, also after a redraw.
 const d=load({state:withTables(d6,d2d6)}),rd=mkRoot();
 click(d.RT,rd,'del',{rtbId:'t1'});assert.match(d.RT.render('ru'),/data-rtb-action="undo"/);
 click(d.RT,rd,'undo');eq(plain(d.state.gmExtras.rollTables),[d6,d2d6]);
});

test('the open form survives a reload and is cleared by save and by cancel',()=>{
 const session=tabStore(),KEY='nc-rtb-draft-v1';
 const one=load({session}),root=mkRoot();
 assert.equal(session.m.size,0,'nothing is written before a form is opened');
 click(one.RT,root,'new');type(one.RT,root,'name','Порт ');type(one.RT,root,'group','Улицы');
 one.RT.handle({type:'change',target:target(root,{rtbField:'die'},{value:'2d6'})},'ru');
 click(one.RT,root,'row-add');type(one.RT,root,'text','Патруль',0);type(one.RT,root,'to','6',0);
 type(one.RT,root,'bulk','Раз\nДва');
 // A reload: a new copy of the module with the same tab storage.
 const two=load({session}),r2=mkRoot();
 eq(plain(two.RT.ui.draft),{id:null,name:'Порт ',group:'Улицы',die:'2d6',rows:[{from:'2',to:'6',text:'Патруль'}]});
 assert.equal(two.RT.ui.bulk,'Раз\nДва');
 const html=two.RT.render('ru');assert.match(html,/data-rtb-form/);assert.match(html,/value="Порт "/);assert.match(html,/value="Патруль"/);
 click(two.RT,r2,'bulk-add');click(two.RT,r2,'spread');click(two.RT,r2,'save');
 assert.equal(two.RT.ui.error,null);eq(two.state.gmExtras.rollTables.map(t=>t.name),['Порт']);
 assert.equal(session.m.has(KEY),false,'a saved table leaves no draft behind');
 assert.equal(load({session}).RT.ui.draft,null);
 // Cancel clears it too; an edited table keeps its id over the reload.
 const three=load({session,state:withTables(d6)}),r3=mkRoot();
 click(three.RT,r3,'edit',{rtbId:'t1'});type(three.RT,r3,'name','Слухи порта');
 const four=load({session,state:withTables(d6)}),r4=mkRoot();
 assert.equal(four.RT.ui.draft.id,'t1');assert.equal(four.RT.ui.draft.name,'Слухи порта');assert.match(four.RT.render('ru'),/Изменение таблицы/);
 click(four.RT,r4,'cancel');assert.equal(session.m.has(KEY),false);assert.equal(load({session}).RT.ui.draft,null);
 eq(plain(four.state.gmExtras.rollTables),[d6],'cancel stores nothing');
});

test('a draft read back from the tab storage is rebuilt, clipped and escaped; broken storage is ignored',()=>{
 const KEY='nc-rtb-draft-v1',put=v=>{const s=tabStore();s.setItem(KEY,typeof v==='string'?v:JSON.stringify(v));return s};
 const evil='"><img src=x onerror=1><script>x</script>';
 const hostile=put({v:1,bulk:'</textarea><script>y</script>',draft:{id:'"]<x',name:evil+'n'.repeat(300),group:evil,die:'9d9',html:'<b>',rows:[{from:'1"><b>',to:'12345678',text:evil+'t'.repeat(500),evil:1},null,5,{from:3,to:'-2',text:7},...Array.from({length:300},()=>({from:'1',to:'1',text:'x'}))]}});
 const {RT}=load({session:hostile}),d=RT.ui.draft;
 assert.equal(d.id,null);assert.equal(d.die,'1d6');assert.equal(d.name.length,RT.MAX_NAME);assert.equal(d.group.length,RT.MAX_GROUP);
 assert.equal(d.rows.length,RT.MAX_ENTRIES);eq(Object.keys(d).sort(),['die','group','id','name','rows']);
 eq(plain(d.rows[0]),{from:'',to:'',text:(evil+'t'.repeat(500)).slice(0,RT.MAX_TEXT)});eq(plain(d.rows[1]),{from:'',to:'-2',text:''});
 const html=RT.render('ru');assert.doesNotMatch(html,/<img|<script|<b>/);assert.match(html,/&lt;img src=x onerror=1&gt;/);
 for(const bad of ['{','null','5','[]','{"v":2,"draft":{"rows":[]}}','{"v":1}','{"v":1,"draft":{"name":"x"}}','{"v":1,"draft":[]}','x'.repeat(RT.MAX_FILE_CHARS+1)]){
  const r=load({session:put(bad)}).RT;assert.equal(r.ui.draft,null,bad.slice(0,30));assert.match(r.render('ru'),/data-rtb-action="new"/);
 }
 assert.equal(RT.cleanDraft(null),null);assert.equal(RT.cleanDraft({rows:'x'}),null);
 // Storage that throws (private mode, blocked site data): the editor works as before, only without the copy.
 const broken={getItem(){throw new Error('no')},setItem(){throw new Error('no')},removeItem(){throw new Error('no')}};
 const b=load({session:broken}),root=mkRoot();
 assert.equal(b.RT.ui.draft,null);
 build(b.RT,root,'Без хранилища','Раз\nДва');eq(b.state.gmExtras.rollTables.map(t=>t.name),['Без хранилища']);
 const none=load(),rn=mkRoot();build(none.RT,rn,'Совсем без него','Раз');assert.equal(none.state.gmExtras.rollTables.length,1);
});

test('the message for a wrong file names a place the app really has',()=>{
 const {RT}=load(),app=read('app.js');
 assert.doesNotMatch(RT.T.ru.fFormat+RT.T.en.fFormat,/настро|settings/i);
 // The words in quotes are the ones the «Персонажи» screen shows; if that menu is renamed, this message must follow.
 for(const [lang,page,menu,item] of [['ru','Персонажи','Файлы и резервные копии','Импорт копии'],['en','Characters','Files and backups','Import backup']]){
  for(const word of [page,menu,item])assert(RT.T[lang].fFormat.includes(word),lang+': '+word);
  assert(app.includes(`characters:'${page}'`));assert(app.includes(`'${menu}'`));assert(app.includes(`importAll:'${item}'`));
 }
 const root=mkRoot();RT.openFile('{"format":"nope"}');
 assert.match(RT.render('ru'),/role="alert"[^>]*>Это не файл таблиц бросков\. Если это резервная копия/);
});

test('a row of the editor has no fill of its own, so its fields stay visible in the clean dark look',()=>{
 const rule=/\.rtb-entry\{[^}]*\}/.exec(read('roll-tables.css'))?.[0]||'';
 assert.match(rule,/border:1px solid var\(--border\)/);assert.doesNotMatch(rule,/background/);
});
