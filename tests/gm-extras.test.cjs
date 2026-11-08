const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.join(__dirname,'../site');
let saves=0;const appState={lang:'ru'};
const context={window:{App:{getState:()=>appState,save:()=>{saves++},lang:()=>'en'}},Math,Number,String,Array,Object,Set,Infinity,JSON,Date};
for(const f of ['catalog.js','catalog-extra.js','gm-extras.js'])vm.runInNewContext(fs.readFileSync(path.join(dir,f),'utf8'),context);
const {GMExtras:GX,CATALOG}=context.window;
function seq(values){let i=0;return ()=>values[i++%values.length]}
function seeded(seed){return ()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648}}
const plain=x=>JSON.parse(JSON.stringify(x));

test('clocks: sanitizes bad data from old or edited backups',()=>{
 assert.deepEqual(plain(GX.readClocks({})),[]);
 assert.deepEqual(plain(GX.readClocks({gmExtras:[]})),[]);
 assert.deepEqual(plain(GX.readClocks({gmExtras:{clocks:'x'}})),[]);
 const st={gmExtras:{clocks:[
  {id:'a',name:'  Gang\n  on trail ',size:6,filled:9,shared:true},
  {id:'b',name:'x'.repeat(100),size:8,filled:-2,shared:'yes'},
  {id:'c',name:'bad size',size:5,filled:1},
  {id:'a',name:'dup',size:4,filled:0},
  {id:'<x>',name:'bad id',size:4},
  null,7,
  {id:'d',name:42,size:'12',filled:3.7}
 ]}};
 const c=plain(GX.readClocks(st));
 assert.deepEqual(c.map(x=>x.id),['a','b','d']);
 assert.equal(c[0].name,'Gang on trail');assert.equal(c[0].filled,6);assert.equal(c[0].shared,true);
 assert.equal(c[1].name.length,60);assert.equal(c[1].filled,0);assert.equal(c[1].shared,false);
 assert.equal(c[2].name,'');assert.equal(c[2].size,12);assert.equal(c[2].filled,3);
 const many={gmExtras:{clocks:Array.from({length:40},(_,i)=>({id:'k'+i,name:'n',size:4,filled:0}))}};
 assert.equal(GX.readClocks(many).length,30);
});
test('clocks: add, segment click, step, cap at 30',()=>{
 let r=GX.addClock([],'Pursuit',8,'p1');assert(r.ok);let list=r.clocks;assert.deepEqual(plain(list[0]),{id:'p1',name:'Pursuit',size:8,filled:0,shared:false});
 assert.equal(GX.addClock([],'x',7,'q').clocks[0].size,6,'invalid size falls back to 6');
 list=GX.updateClock(list,'p1',c=>GX.clickSegment(c,2)).clocks;assert.equal(list[0].filled,3);
 list=GX.updateClock(list,'p1',c=>GX.clickSegment(c,2)).clocks;assert.equal(list[0].filled,2,'clicking the last filled segment clears it');
 list=GX.updateClock(list,'p1',c=>GX.clickSegment(c,99)).clocks;assert.equal(list[0].filled,2);
 list=GX.updateClock(list,'p1',c=>GX.step(c,100)).clocks;assert.equal(list[0].filled,8);
 list=GX.updateClock(list,'p1',c=>GX.step(c,-100)).clocks;assert.equal(list[0].filled,0);
 assert.equal(GX.updateClock(list,'nope',c=>c).ok,false);
 const full=Array.from({length:30},(_,i)=>({id:'k'+i,name:'',size:4,filled:0,shared:false}));
 assert.equal(GX.addClock(full,'one more',4).ok,false);
});
test('clocks: writeClocks creates gmExtras lazily and keeps other keys',()=>{
 const st={};GX.writeClocks(st,[{id:'a',name:'A',size:4,filled:1,shared:true}]);assert.equal(st.gmExtras.clocks.length,1);
 const st2={gmExtras:{other:1}};GX.writeClocks(st2,[]);assert.equal(st2.gmExtras.other,1);assert.deepEqual(plain(st2.gmExtras.clocks),[]);
 const st3={gmExtras:[1]};GX.writeClocks(st3,[]);assert.deepEqual(plain(st3.gmExtras),{clocks:[]});
});
test('sharedClocks: only shared, sanitized, at most 12, no ids leak',()=>{
 const clocks=Array.from({length:20},(_,i)=>({id:'s'+i,name:'<b>'+i,size:4,filled:i%5,shared:i!==0}));
 const s=plain(GX.sharedClocks({gmExtras:{clocks}}));
 assert.equal(s.length,12);assert.equal(s[0].name,'<b>1');assert.deepEqual(Object.keys(s[0]).sort(),['filled','name','size']);
 for(const c of s)assert(c.filled<=c.size);
 assert.deepEqual(plain(GX.sharedClocks(null)),[]);assert.deepEqual(plain(GX.sharedClocks({gmExtras:{clocks:[{id:'x',size:4,shared:1}]}})),[]);
});
test('clock UI: create, click a segment, rename, share, two-step delete; saves through App',()=>{
 GX.reset();for(const k of Object.keys(appState))if(k!=='lang')delete appState[k];saves=0;
 const fields={'[data-gx-field="draft"]':{value:'Banda <i>'},'[data-gx-field="size"]':{value:'4'}};
 const root={dataset:{lang:'en'},querySelector:s=>fields[s]||null,isConnected:true,outerHTML:''};
 const click=ds=>{const b={dataset:ds,closest:s=>s==='[data-gx-root]'?root:b};return GX.handle({type:'click',target:b},'en')};
 assert(click({gxAction:'add'}));
 assert.equal(appState.gmExtras.clocks.length,1);const id=appState.gmExtras.clocks[0].id;assert.equal(appState.gmExtras.clocks[0].size,4);assert.equal(saves,1);
 assert(root.outerHTML.includes('Banda &lt;i&gt;'));assert(!root.outerHTML.includes('<i>'));
 assert(root.outerHTML.includes('PROGRESS CLOCKS'));assert.equal((root.outerHTML.match(/class="gx-seg/g)||[]).length,4);
 click({gxAction:'seg',gxId:id,gxSeg:'2'});assert.equal(appState.gmExtras.clocks[0].filled,3);
 click({gxAction:'plus',gxId:id});assert.equal(appState.gmExtras.clocks[0].filled,4);assert(root.outerHTML.includes('Full!'));
 const input={dataset:{gxField:'name',gxId:id},value:'  Renamed ',closest:()=>root};
 root.outerHTML='untouched';assert(GX.handle({type:'change',target:input},'en'));assert.equal(appState.gmExtras.clocks[0].name,'Renamed');assert.equal(root.outerHTML,'untouched','rename does not re-render');
 GX.handle({type:'change',target:{dataset:{gxField:'shared',gxId:id},checked:true,closest:()=>root}},'en');
 assert.deepEqual(plain(GX.sharedClocks(appState)),[{name:'Renamed',size:4,filled:4}]);
 click({gxAction:'reset',gxId:id});assert.equal(appState.gmExtras.clocks[0].filled,0);
 click({gxAction:'del',gxId:id});assert.equal(appState.gmExtras.clocks.length,1,'first click only arms');assert(root.outerHTML.includes('Really delete?'));
 click({gxAction:'del',gxId:id});assert.equal(appState.gmExtras.clocks.length,0);
 assert.equal(GX.handle({type:'click',target:{closest:()=>null}},'en'),false);
});
test('names: bilingual pairs, Cyrillic in RU and Latin in EN',()=>{
 for(const list of [GX.FIRST,GX.LAST,GX.HANDLES]){assert(list.length>=30);for(const [ru,en] of list){assert(/[А-Яа-яЁё]/.test(ru),ru);assert(!/[А-Яа-яЁё]/.test(en),en)}}
 const n=GX.genName(seq([0,0,0]),true);assert.equal(GX.formatName(n,'ru'),'Мигель «Ржавчина» Окафор');assert.equal(GX.formatName(n,'en'),'Miguel “Rust” Okafor');
 assert.equal(GX.formatName(GX.genName(seeded(3),false),'en').split(' ').length>=2,true);
});
test('gigs: every part present and pay is an eb range',()=>{
 for(let s=1;s<40;s++){const g=GX.genGig(seeded(s));for(const k of ['client','job','place','complication'])assert(g[k].ru&&g[k].en,k);assert(g.pay.min<g.pay.max&&g.pay.min>=100)}
});
test('loot: catalog items within the cap, distinct, plus flavor and cash',()=>{
 for(const mode of ['pockets','stash']){for(let s=1;s<30;s++){const o=GX.genLoot(mode,seeded(s),CATALOG);const cap=mode==='stash'?1000:100;assert(o.items.length>=1);assert.equal(new Set(o.items.map(i=>i.id)).size,o.items.length);for(const i of o.items){const c=CATALOG.find(x=>x.id===i.id);assert(c&&c.price<=cap)}assert(o.flavor.length>=1);assert(o.cash>=10&&o.cash%10===0)}}
 assert.equal(GX.genLoot('bogus',seeded(1),CATALOG).mode,'pockets');
 assert.equal(GX.genLoot('pockets',seeded(1),[]).items.length,0);
});
test('oracle: thresholds and and/but edges',()=>{
 assert.equal(GX.oracleAnswer(10,'even'),'yesand');assert.equal(GX.oracleAnswer(6,'even'),'yesbut');assert.equal(GX.oracleAnswer(7,'even'),'yes');
 assert.equal(GX.oracleAnswer(5,'even'),'nobut');assert.equal(GX.oracleAnswer(3,'even'),'no');assert.equal(GX.oracleAnswer(1,'even'),'noand');
 assert.equal(GX.oracleAnswer(2,'sure'),'yesbut');assert.equal(GX.oracleAnswer(1,'sure'),'noand');
 assert.equal(GX.oracleAnswer(9,'vu'),'yesbut');assert.equal(GX.oracleAnswer(8,'vu'),'nobut');
 // Probability of a yes rises with likelihood.
 const yes=id=>Array.from({length:10},(_,i)=>GX.oracleAnswer(i+1,id)).filter(a=>a.startsWith('yes')).length;
 const ys=GX.LIKELIHOOD.map(x=>yes(x.id));for(let i=1;i<ys.length;i++)assert(ys[i]>ys[i-1]);
 const o=GX.oracle('l',seq([0.95]));assert.equal(o.roll,10);assert.equal(o.answer,'yesand');
 assert.equal(GX.oracle('bogus',seq([0])).likelihood,'even');
});
test('weather: season tables reference valid conditions; auto season from date',()=>{
 for(const s of GX.SEASONS){assert.equal(GX.SEASON_TABLE[s.id].length,10);for(const c of GX.SEASON_TABLE[s.id])assert(GX.WEATHER[c],c)}
 for(const c of Object.values(GX.WEATHER)){assert(c.ru&&c.en&&c.hint.ru&&c.hint.en)}
 assert.equal(GX.seasonFor(new Date(2026,0,5)),'winter');assert.equal(GX.seasonFor(new Date(2026,11,5)),'winter');assert.equal(GX.seasonFor(new Date(2026,3,5)),'spring');assert.equal(GX.seasonFor(new Date(2026,6,5)),'summer');assert.equal(GX.seasonFor(new Date(2026,9,5)),'autumn');
 const w=GX.genWeather('summer',seq([0.25]));assert.equal(w.roll,3);assert.equal(w.condition,'heat');assert(w.temp[0]<w.temp[1]);
 const a=GX.genWeather(null,seq([0]),new Date(2026,1,1));assert.equal(a.season,'winter');
 for(let s=1;s<40;s++){const x=GX.genWeather('winter',seeded(s));assert(x.temp[1]-x.temp[0]>=3)}
});
test('render: both languages, three sections, tables log via handle',()=>{
 GX.reset();const ru=GX.render('ru');assert(ru.includes('ЧАСЫ ПРОГРЕССА')&&ru.includes('СЛУЧАЙНЫЕ ТАБЛИЦЫ')&&ru.includes('ПОГОДА В НАЙТ-СИТИ'));
 const en=GX.render('en');assert(en.includes('PROGRESS CLOCKS')&&en.includes('RANDOM TABLES')&&en.includes('NIGHT CITY WEATHER'));
 const root={dataset:{lang:'en'},querySelector:s=>s==='[data-gx-field="likelihood"]'?{value:'vl'}:s==='[data-gx-field="season"]'?{value:'autumn'}:null,isConnected:true,outerHTML:''};
 const click=a=>{const b={dataset:{gxAction:a},closest:s=>s==='[data-gx-root]'?root:b};return GX.handle({type:'click',target:b},'en',seeded(11))};
 for(const a of ['name1','name5','handle','gig','loot-pockets','loot-stash','oracle'])assert(click(a),a);
 assert.equal(GX.log.length,6,'only the last few results are kept');assert.equal(GX.log[0].oracle.likelihood,'vl');
 assert(click('weather'));assert.equal(GX.weatherLog[0].season,'autumn');assert(root.outerHTML.includes('Roll again'));
 click('clear-log');assert.equal(GX.log.length,0);GX.reset();
});
test('index.html loads gm-extras before app.js and its stylesheet before theme.css',()=>{
 const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 assert(html.indexOf('gm-extras.js')>html.indexOf('night-market.js'));assert(html.indexOf('gm-extras.js')<html.indexOf('src="app.js"'));
 assert(html.indexOf('gm-extras.css')>0&&html.indexOf('gm-extras.css')<html.indexOf('theme.css'));
});
