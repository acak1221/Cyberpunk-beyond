const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.join(__dirname,'../site'),read=f=>fs.readFileSync(path.join(dir,f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const mem=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>{m.set(k,String(v))},removeItem:k=>{m.delete(k)}}};

// ---- finder ranking and multi-word matching ----
function hub(){const win={localStorage:mem(),location:{hash:''}};vm.runInNewContext(read('gm-hub.js'),{window:win,Object,Array,String,Number,Math,JSON,RegExp});return win.GmHub}
test('findTools: a name match outranks a keyword-only match, and every word has to match',()=>{
 const H=hub(),ids=H.findTools('roll','en',20).map(t=>t.id);
 assert.ok(ids.includes('encounter'),'matched through its keywords');
 assert.ok(ids.indexOf('mytables')<ids.indexOf('encounter'),'a name match comes before the keyword-only match');
 assert.ok(ids.indexOf('hidden')<ids.indexOf('encounter'));
 assert.deepEqual(plain(H.findTools('clocks weather','en')),[],'one word matching is not enough');
 assert.deepEqual(plain(H.findTools('погода сезон','ru').map(t=>t.id)),['weather']);
});
test('the hub keeps the tab in the address, scrolls the chosen tab into view and has a pane heading',()=>{
 const src=read('gm-hub.js');
 assert.match(src,/scrollIntoView\?\.\(\{inline:'center'/);assert.match(src,/data-gmh-h2/);assert.match(src,/#\\\/city/);
 assert.equal(typeof hub().afterDraw,'function');
});

// ---- GmRolls.check / sum: the combat tracker's rolls respect the open / hidden choice ----
function rolls(){
 const calls=[],notes=[],win={localStorage:mem(),Rolls:{report:(...a)=>{calls.push(['report',...a]);return true},check:(...a)=>{calls.push(['check',...a]);return true},sum:(...a)=>{calls.push(['sum',...a]);return true}},App:{lang:()=>'en',notify:m=>notes.push(m)}};
 vm.runInNewContext(read('gm-rolls.js'),{window:win,JSON,Date,Math,Number,String,Array,Object});return {R:win.GmRolls,calls,notes};
}
test('GmRolls.check and sum go to Rolls when open and to the hidden list when hidden',()=>{
 const o=rolls();
 assert.equal(o.R.check('Ganger · Pistol',{first:4,extra:0,total:12},'en'),true);assert.equal(o.R.sum('Ganger · Pistol',[3,4],6,{total:7}),true);
 assert.deepEqual(plain(o.calls.map(c=>c[0])),['check','sum']);assert.equal(o.R.entries().length,0);
 const h=rolls();h.R.setMode('hidden');
 assert.equal(h.R.check('Ganger · Pistol',{first:10,extra:3,total:20},'en'),true);assert.equal(h.R.sum('Ganger · Pistol',[3,4],6,{total:7}),true);
 assert.equal(h.calls.length,0,'nothing reaches the history or the room feed');
 const e=plain(h.R.entries());assert.equal(e.length,2);assert.equal(e[1].detail,'1d10 10 + 3 + 7 = 20');assert.equal(e[0].detail,'2d6: 3 + 4 = 7');
 assert.equal(h.R.check('x',{first:11,total:1}),false);assert.equal(h.R.sum('x',[9],6),false);
 assert.equal(h.notes.length,2,'every hidden roll is announced where the GM is looking');assert.match(h.notes[0],/only/);
});
test('an open roll refused by Rolls.report is not reported a second time',()=>{
 const app=[],win={localStorage:mem(),Rolls:{report:()=>false},App:{report:(...a)=>{app.push(a);return true}}};
 vm.runInNewContext(read('gm-rolls.js'),{window:win,JSON,Date,Math,Number,String,Array,Object});
 assert.equal(win.GmRolls.emit('A','d',1).ok,false);assert.equal(app.length,0);
 const win2={localStorage:mem(),App:{report:(...a)=>{app.push(a);return true}}};vm.runInNewContext(read('gm-rolls.js'),{window:win2,JSON,Date,Math,Number,String,Array,Object});
 assert.equal(win2.GmRolls.emit('A','d',1).ok,true);assert.equal(app.length,1,'without Rolls the app report is the fallback');
});
test('the empty hidden list takes no room and the combat tracker rolls through GmRolls',()=>{
 const {R}=rolls();assert.match(R.historyHTML('en'),/data-gmr-empty/);R.setMode('hidden');R.emit('A','d',1);assert.doesNotMatch(R.historyHTML('en'),/data-gmr-empty/);
 const t=read('gm-table.js');assert.match(t,/\(window\.GmRolls\|\|window\.Rolls\)\?\.check\?\./);assert.match(t,/\(window\.GmRolls\|\|window\.Rolls\)\?\.sum\?\./);
});

// ---- roll tables: GmRolls.emit is taken; quiet gives way to hidden ----
function tables(mode,room){
 const calls=[],state={gmExtras:{rollTables:[{id:'t1',name:'Слухи',group:'',die:'1d6',entries:[{from:1,to:6,text:'Правда'}]}]}},window={};
 window.App={getState:()=>state,save(){},lang:()=>'ru',report:(...a)=>{calls.push(['report',...a]);return true},notify(){}};
 window.RollHistory={add:e=>{calls.push(['history',e]);return true}};window.Room={active:()=>room};
 window.GmRolls={mode:()=>mode,emit:(...a)=>{calls.push(['emit',...a]);return {mode,ok:true}}};
 vm.runInNewContext(read('roll-tables.js'),{window,Date,Math,JSON,Promise,setTimeout,Blob,URL});
 return {RT:window.RollTables,calls};
}
const root=()=>({isConnected:true,dataset:{lang:'ru'},outerHTML:'',box:{innerHTML:''},querySelector(s){return s==='[data-rtb-problems]'?this.box:null}});
const tgt=(r,ds,extra={})=>({closest:s=>s==='[data-rtb-root]'?r:s==='[data-rtb-action]'&&ds.rtbAction?{dataset:ds}:null,dataset:ds,...extra});
test('a table roll goes through GmRolls.emit; a ticked quiet box still writes the history only unless the GM rolls hidden',()=>{
 const a=tables('open',false),r=root();a.RT.handle({type:'click',target:tgt(r,{rtbAction:'roll',rtbId:'t1'})},'ru',()=>0);
 assert.equal(a.calls[0][0],'emit');assert.equal(a.calls.filter(c=>c[0]==='report').length,0);
 for(const [mode,first] of [['open','history'],['hidden','emit']]){
  const b=tables(mode,true),rr=root();
  b.RT.handle({type:'change',target:tgt(rr,{rtbField:'quiet'},{checked:true})},'ru');
  b.RT.handle({type:'click',target:tgt(rr,{rtbAction:'roll',rtbId:'t1'})},'ru',()=>0);
  assert.equal(b.calls[0][0],first,mode);
 }
});

// ---- scaled armor, effectiveStats clamp ----
test('a scaled template drops the armor name that would contradict the SP; effective stats stay in range',()=>{
 const win={},ctx={window:win,Math,Number,String,Array,Object,Set,JSON,Date,Infinity,Map,RegExp};
 for(const f of ['gm-tools.js','npc-builder.js'])vm.runInNewContext(read(f),ctx);
 const t=win.GMTools.NPC_TEMPLATES.find(x=>x.id==='bodyguard'),B=win.NpcBuilder;
 assert.equal(B.scale(t,'boss').armor.name,'');assert.equal(B.scale(t,'mook').armor.name,t.armor.name,'unchanged SP keeps the name');
 const e=JSON.parse(JSON.stringify(t));e.effectiveStats={REF:10,BODY:15,WILL:1};
 const up=B.scale(e,'boss');
 assert.equal(up.effectiveStats.REF,10,'REF is capped at 10');assert.equal(up.effectiveStats.BODY,15);
});
test('the encounter result says when it went to the hidden list and a missing campaign links to Campaigns',()=>{
 const src=read('gm-tools.js');assert.match(src,/gm-hidden-tag/);assert.match(src,/href="#\/campaigns"/);
});
