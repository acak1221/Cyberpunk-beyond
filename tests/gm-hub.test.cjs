const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const SRC=fs.readFileSync(path.join(__dirname,'../site/gm-hub.js'),'utf8');
const mem=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>{m.set(k,String(v))},_m:m}};
function load({hash='',stored,doc}={}){
 const ls=mem();if(stored!==undefined)ls.setItem('nc-gm-tab',stored);
 const win={localStorage:ls,location:{hash},history:{replaceState:(a,b,u)=>{win.location.hash=u}},
  GMTools:{render:c=>`<div class="gm-tools" data-panes="${c.panes}" data-lang="${c.lang}"><div data-gm-pane="meeting"></div><div data-gm-pane="npc"></div></div>`},
  NightMarket:{render:l=>`<section data-nm-root>${l}</section>`},GMExtras:{render:l=>`<div data-gx-root>${l}</div>`},
  NpcFilter:{rowHTML:l=>`<div data-nf-root>${l}</div>`},GmRolls:{toggleHTML:()=>'<fieldset data-gmr-mode-root></fieldset>',historyHTML:()=>'<details data-gmr-history></details>'},
  NightCity:{render:l=>`<section data-nc-root>${l}</section>`}};
 const ctx={window:win,document:doc,Object,Array,String,Number,Math,JSON,RegExp};
 vm.runInNewContext(SRC,ctx);return {win,H:win.GmHub,ls};
}
const plain=x=>JSON.parse(JSON.stringify(x));

test('tabFromHash reads #/gm/<tab>, accepts a few aliases and refuses everything else',()=>{
 const {H}=load();
 for(const t of H.TABS)assert.equal(H.tabFromHash('#/gm/'+t),t);
 assert.equal(H.tabFromHash('#/gm/Clocks'),'clocks');assert.equal(H.tabFromHash('#/gm/npcs'),'npc');assert.equal(H.tabFromHash('#/gm/city'),'world');assert.equal(H.tabFromHash('#/gm/clocks?x=1'),'clocks');
 for(const bad of ['','#/gm','#/gm/','#/gm/nope','#/gmx/clocks','#/sheet/clocks','#/gm/<script>',null,undefined,42,'#/gm/'+'a'.repeat(40)])assert.equal(H.tabFromHash(bad),null,String(bad));
});
test('pickTab: the link wins, then the remembered tab, then the first tab',()=>{
 const {H}=load();
 assert.equal(H.pickTab('#/gm/clocks','npc'),'clocks');assert.equal(H.pickTab('#/gm','npc'),'npc');assert.equal(H.pickTab('','weird'),'meeting');assert.equal(H.pickTab('',null),'meeting');
 assert.equal(H.hashFor('world'),'#/gm/world');assert.equal(H.hashFor('x'),'#/gm');
});
test('findTools finds tools by name and by extra words in both languages and ranks name matches first',()=>{
 const {H}=load();
 assert.equal(H.findTools('погода','ru')[0].id,'weather');assert.equal(H.findTools('weather','en')[0].id,'weather');
 assert.ok(H.findTools('часы','ru').some(t=>t.id==='clocks'));assert.equal(H.findTools('clock','en')[0].id,'clocks');
 assert.ok(H.findTools('банды','ru').some(t=>t.id==='city'),'a word from the keywords');
 assert.equal(H.findTools('ёж','ru').length,0);assert.deepEqual(plain(H.findTools('','ru')),[]);assert.deepEqual(plain(H.findTools('   ','en')),[]);assert.deepEqual(plain(H.findTools('zzzzqq','en')),[]);
 assert.equal(H.findTools('npc','en',2).length,2);assert.ok(H.findTools('NIGHT','en').length>=1);
 assert.ok(H.findTools('hidden rolls','en').some(t=>t.id==='hidden'));assert.ok(H.findTools('скрытые броски','ru').some(t=>t.id==='hidden'));
});
test('the tool list is consistent: unique ids, real tabs, both names, a selector',()=>{
 const {H}=load(),ids=new Set();
 for(const t of H.TOOLS){assert.ok(!ids.has(t.id),t.id);ids.add(t.id);assert.ok(H.TABS.includes(t.tab),t.id);assert.ok(t.ru&&t.en&&t.sel,t.id)}
 for(const k of H.TABS){assert.ok(H.NAMES.ru[k]);assert.ok(H.NAMES.en[k])}
});
test('render draws an accessible tab bar, one selected tab, a labelled panel and every piece',()=>{
 for(const lang of ['ru','en']){
  const {H}=load({hash:'#/gm/clocks'}),html=H.render({lang,workspace:{},campaigns:[]});
  assert.match(html,/role="tablist"/);assert.equal((html.match(/role="tab"/g)||[]).length,7);
  assert.equal((html.match(/aria-selected="true"/g)||[]).length,1);assert.match(html,/id="gmh-tab-clocks"[^>]*aria-selected="true"[^>]*aria-controls="gmh-panel" tabindex="0"/);
  assert.equal((html.match(/tabindex="-1">/g)||[]).length>=6,true);
  assert.match(html,/id="gmh-panel" role="tabpanel" aria-labelledby="gmh-tab-clocks"/);assert.match(html,/data-tab="clocks"/);
  assert.match(html,lang==='ru'?/>Встреча</:/>Encounter</);assert.match(html,lang==='ru'?/>Справка</:/>Help</);
  for(const part of ['data-panes="true"','data-nm-root','data-gx-root','data-nf-root','data-gmr-mode-root','data-gmr-history','data-nc-root','data-gmh-find','data-gmh-help'])assert.ok(html.includes(part),part);
  assert.equal((html.match(/<div/g)||[]).length,(html.match(/<\/div>/g)||[]).length);
 }
});
test('render falls back to the remembered tab and ignores damaged storage; missing modules do not break it',()=>{
 assert.match(load({stored:'npc'}).H.render({lang:'en'}),/data-tab="npc"/);
 assert.match(load({stored:'<b>'}).H.render({lang:'en'}),/data-tab="meeting"/);
 assert.match(load({hash:'#/gm',stored:'world'}).H.render({lang:'ru'}),/data-tab="world"/);
 const {win,H}=load();for(const k of ['GMTools','NightMarket','GMExtras','NpcFilter','GmRolls','NightCity'])delete win[k];
 const html=H.render({lang:'en'});assert.match(html,/role="tablist"/);assert.match(html,/data-gmh-help/);
 const bad=load({});Object.defineProperty(bad.win,'localStorage',{get(){throw new Error('blocked')}});assert.match(bad.H.render({lang:'en'}),/data-tab="meeting"/);
});
test('the help pane lists the link of every tab',()=>{
 const {H}=load(),html=H.render({lang:'en'});
 for(const t of H.TABS)assert.ok(html.includes('<code>#/gm/'+t+'</code>'),t);
});
test('setTab remembers the tab, rewrites only a #/gm address and refuses unknown tabs',()=>{
 const {H,win,ls}=load({hash:'#/gm'});
 assert.equal(H.setTab('tables'),true);assert.equal(ls.getItem('nc-gm-tab'),'tables');assert.equal(win.location.hash,'#/gm/tables');assert.equal(H.tab(),'tables');
 assert.equal(H.setTab('nope'),false);assert.equal(H.tab(),'tables');assert.equal(H.setTab('night'),true);assert.equal(H.tab(),'market');
 const other=load({hash:'#/rules'});other.H.setTab('npc');assert.equal(other.win.location.hash,'#/rules','another page keeps its address');
 const quiet=load({hash:'#/gm'});quiet.H.setTab('help',{hash:false,store:false});assert.equal(quiet.win.location.hash,'#/gm');assert.equal(quiet.ls.getItem('nc-gm-tab'),null);
});
function fakePage(){
 const mk=k=>({dataset:{gmhTab:k},attrs:{},tabIndex:0,setAttribute(n,v){this.attrs[n]=v},focus(){page.focused=k}});
 const tabs=['meeting','npc','clocks','tables','market','world','help'].map(mk),panel={attrs:{},setAttribute(n,v){this.attrs[n]=v}};
 const root={dataset:{tab:'meeting'},querySelectorAll:s=>s==='[data-gmh-tab]'?tabs:[],querySelector:s=>s==='#gmh-panel'?panel:(s.match(/data-gmh-tab="(\w+)"/)?tabs.find(t=>t.dataset.gmhTab===s.match(/data-gmh-tab="(\w+)"/)[1]):null)};
 const page={tabs,panel,root,focused:null,doc:{querySelector:s=>s==='[data-gm-hub]'?root:null}};return page;
}
test('switching a tab updates aria-selected, roving tabindex and the panel label without redrawing',()=>{
 const p=fakePage(),{H}=load({doc:p.doc,hash:'#/gm'});
 H.setTab('npc',{focus:true});
 assert.equal(p.root.dataset.tab,'npc');assert.deepEqual(p.tabs.map(t=>t.attrs['aria-selected']),['false','true','false','false','false','false','false']);
 assert.deepEqual(p.tabs.map(t=>t.tabIndex),[-1,0,-1,-1,-1,-1,-1]);assert.equal(p.panel.attrs['aria-labelledby'],'gmh-tab-npc');assert.equal(p.focused,'npc');
});
test('arrow keys, Home and End move between tabs and wrap around',()=>{
 const p=fakePage(),{H}=load({doc:p.doc,hash:'#/gm'});
 const key=(k,from)=>{let prevented=false;const el={closest:s=>s==='[data-gmh-tab]'?p.tabs.find(t=>t.dataset.gmhTab===from):null,matches:()=>false};H.onEvent({type:'keydown',key:k,target:el,preventDefault(){prevented=true}});return prevented};
 assert.equal(key('ArrowRight','meeting'),true);assert.equal(p.root.dataset.tab,'npc');
 key('ArrowLeft','meeting');assert.equal(p.root.dataset.tab,'help');key('ArrowRight','help');assert.equal(p.root.dataset.tab,'meeting');
 key('End','npc');assert.equal(p.root.dataset.tab,'help');key('Home','npc');assert.equal(p.root.dataset.tab,'meeting');
 assert.equal(key('a','meeting'),false);
});
test('goTool opens the tab of a tool and focuses it; the finder input offers results and Enter opens the first',()=>{
 const p=fakePage(),{H}=load({doc:p.doc,hash:'#/gm'});
 const target={attrs:{},hasAttribute(n){return n in this.attrs},setAttribute(n,v){this.attrs[n]=v},scrollIntoView(){this.scrolled=true},focus(){this.focusedIt=true}};
 p.root.querySelector=(old=>s=>s==='[data-gx-section="weather"]'?target:old(s))(p.root.querySelector);
 assert.equal(H.goTool('weather'),true);assert.equal(p.root.dataset.tab,'world');assert.equal(target.focusedIt,true);assert.equal(target.attrs.tabindex,'-1');
 assert.equal(H.goTool('missing'),false);
 const list={innerHTML:''},count={textContent:''},input={value:'погода',matches:s=>s==='[data-gmh-find]',closest:s=>s==='[data-gmh-find-root]'?box:null};
 const box={querySelector:s=>s==='[data-gmh-results]'?list:s==='[data-gmh-count]'?count:null,closest:()=>({dataset:{lang:'ru'}})};
 H.onEvent({type:'input',target:input});assert.match(list.innerHTML,/data-gmh-go="weather"/);assert.match(count.textContent,/Найдено: \d/);
 input.value='qqqq';H.onEvent({type:'input',target:input});assert.equal(list.innerHTML,'');assert.equal(count.textContent,'Ничего не найдено');
 input.value='weather';p.root.dataset.tab='meeting';let prevented=false;H.onEvent({type:'keydown',key:'Enter',target:input,preventDefault(){prevented=true}});assert.equal(prevented,true);assert.equal(p.root.dataset.tab,'world');
});
test('a hash change to another tab is followed only while the hub is on the page',()=>{
 const handlers=[];
 const p2=fakePage(),ls=mem(),win={localStorage:ls,location:{hash:'#/gm/clocks'},history:{replaceState(){}},addEventListener:(t,f)=>handlers.push([t,f])};
 vm.runInNewContext(SRC,{window:win,document:p2.doc,Object,Array,String,Number,Math,JSON,RegExp});
 const h=handlers.find(x=>x[0]==='hashchange');assert.ok(h);
 h[1]();assert.equal(p2.root.dataset.tab,'clocks');win.location.hash='#/gm/market';h[1]();assert.equal(p2.root.dataset.tab,'market');
 win.location.hash='#/rules';h[1]();assert.equal(p2.root.dataset.tab,'market');
});
