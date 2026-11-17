const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const eq=(a,b,m)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),b,m);
const SRC=fs.readFileSync(path.join(__dirname,'../site/gm-rolls.js'),'utf8');
function load(win){const ctx={window:win,JSON,Date,Math,Number,String,Array,Object};vm.runInNewContext(SRC,ctx);global.window=win;return win.GmRolls}
const mem=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>{m.set(k,String(v))},removeItem:k=>{m.delete(k)},_m:m}};
function setup(){
 const calls=[],ls=mem();
 const win={localStorage:ls,Rolls:{report:(...a)=>{calls.push(a);return true}},App:{lang:()=>'en'}};
 return {R:load(win),calls,ls,win};
}
test('the default is open and an open roll goes through Rolls.report with its faces',()=>{
 const {R,calls}=setup();assert.equal(R.mode(),'open');
 const r=R.emit('Guard · Evasion','1d10 4 = 12',12,[{v:4,s:10}]);
 eq(r,{mode:'open',ok:true});assert.equal(calls.length,1);assert.equal(calls[0][0],'Guard · Evasion');assert.equal(calls[0][2],12);eq(calls[0][3],[{v:4,s:10}]);
 assert.equal(R.entries().length,0,'nothing is kept in the hidden list');
});
test('a hidden roll is never reported and is kept in the GM-only list, newest first',()=>{
 const {R,calls,ls}=setup();R.setMode('hidden');
 assert.equal(R.emit('A','d',1,[{v:1,s:10}]).mode,'hidden');R.emit('B','d',2);
 assert.equal(calls.length,0);eq(R.entries().map(x=>x.label),['B','A']);
 assert.equal(JSON.parse(ls.getItem(R.LOG_KEY)).length,2);assert.equal(ls.getItem(R.MODE_KEY),'hidden');
});
test('the choice for one roll overrides the remembered mode',()=>{
 const {R,calls}=setup();R.setMode('hidden');assert.equal(R.emit('X','d',5,null,{mode:'open'}).mode,'open');assert.equal(calls.length,1);
 R.setMode('open');assert.equal(R.emit('Y','d',5,null,{mode:'hidden'}).mode,'hidden');assert.equal(calls.length,1);
});
test('the mode and the list survive a reload, and damaged stored data is cleaned',()=>{
 const a=setup();a.R.setMode('hidden');a.R.emit('Keep','d',7);
 const store=a.ls;
 const G=load({localStorage:store,Rolls:{report:()=>true}});
 assert.equal(G.mode(),'hidden');assert.equal(G.entries()[0].label,'Keep');
 store.setItem('nc-gm-hidden-rolls','[{"label":"ok","total":3},{"label":"","total":1},{"label":"bad","total":"x"},7,null,{"label":"f","total":2,"faces":[{"v":99,"s":10},{"v":3,"s":6}]}]');
 store.setItem('nc-gm-roll-mode','weird');
 G._reset();assert.equal(G.mode(),'open');
 eq(G.entries().map(x=>x.label),['ok','f']);eq(G.entries()[1].faces,[{v:3,s:6}]);
 store.setItem('nc-gm-hidden-rolls','not json');G._reset();eq(G.entries(),[]);
});
test('the list keeps the last 50 and bad rolls are refused without losing the others',()=>{
 const {R}=setup();R.setMode('hidden');
 for(let i=0;i<60;i++)R.emit('r'+i,'d',i);
 assert.equal(R.entries().length,50);assert.equal(R.entries()[0].label,'r59');
 assert.equal(R.emit('','d',1).ok,false);assert.equal(R.emit('x','d',NaN).ok,false);assert.equal(R.entries().length,50);
 assert.equal(R.cleanEntry({label:'x'.repeat(500),detail:'y'.repeat(900),total:1.9}).label.length,140);
 assert.equal(R.cleanEntry({label:'x',total:1.9}).total,1);
});
test('revealing publishes a hidden roll to the feed and removes it from the list',()=>{
 const {R,calls}=setup();R.setMode('hidden');R.emit('Secret','d',9,[{v:9,s:10}]);R.emit('Other','d',3);
 assert.equal(R.reveal(1),true);assert.equal(calls.length,1);assert.equal(calls[0][0],'Secret');eq(R.entries().map(x=>x.label),['Other']);
 assert.equal(R.reveal(5),false);assert.equal(calls.length,1);
});
test('a failed publish keeps the hidden roll',()=>{
 const {R,win}=setup();R.setMode('hidden');R.emit('Secret','d',9);win.Rolls.report=()=>false;win.App.report=()=>false;
 assert.equal(R.reveal(0),false);assert.equal(R.entries().length,1);
});
test('clear returns the list so it can be restored (undo)',()=>{
 const {R}=setup();R.setMode('hidden');R.emit('A','d',1);R.emit('B','d',2);
 const was=R.clear();assert.equal(was.length,2);assert.equal(R.entries().length,0);R.restore(was);eq(R.entries().map(x=>x.label),['B','A']);
});
test('storage that throws does not break rolling',()=>{
 const calls=[],R=load({Rolls:{report:(...a)=>{calls.push(a);return true}},get localStorage(){throw new Error('blocked')}});
 assert.equal(R.mode(),'open');assert.equal(R.emit('a','d',1).ok,true);R.setMode('hidden');assert.equal(R.emit('b','d',2).ok,true);assert.equal(R.entries().length,1);
});
test('the switch and the history are drawn in both languages with labels and escape the rolls',()=>{
 const {R}=setup();R.setMode('hidden');R.emit('<b>x</b>','a & b',4);
 const ru=R.toggleHTML('ru')+R.historyHTML('ru'),en=R.toggleHTML('en')+R.historyHTML('en');
 assert.match(ru,/Скрытые/);assert.match(ru,/Показать игрокам/);assert.match(en,/Hidden rolls/);assert.match(en,/Show to players/);
 assert.doesNotMatch(en,/<b>x<\/b>/);assert.match(en,/&lt;b&gt;x&lt;\/b&gt;/);assert.match(en,/value="hidden" checked/);assert.match(en,/<fieldset[^>]*>\s*<legend>/);
 assert.match(en,/aria-label="Show to players: /);
});
