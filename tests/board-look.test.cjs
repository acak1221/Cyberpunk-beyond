// «Досье», the third look: the switch, the classes on <html>, and the sheet tabs on a wide board.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=n=>fs.readFileSync(__dirname+'/../site/'+n,'utf8');
const html=source('index.html'),css=source('board.css');

function classList(initial=[]){const set=new Set(initial);return {set,contains:c=>set.has(c),add:c=>set.add(c),remove:c=>set.delete(c),toggle(c,on){const want=on===undefined?!set.has(c):!!on;want?set.add(c):set.delete(c);return want}}}

// ---------- the script in <head> ----------
function boot(style){
 const added=[],classes=classList();
 const document={documentElement:{classList:classes},head:{appendChild:l=>added.push(l)},createElement:()=>({}),getElementById:()=>null};
 const window={matchMedia:()=>({matches:false})};
 vm.runInNewContext(html.match(/<head>[\s\S]*?<script>([\s\S]*?)<\/script>/)[1],{document,window,localStorage:{getItem:k=>k==='nc-ui-style'?style:null},matchMedia:window.matchMedia});
 return {added,classes:[...classes.set].sort()};
}

test('the saved look «board» starts with both classes and without web fonts',()=>{
 const h=boot('board');assert.deepEqual(h.classes,['ui-board','ui-native']);assert.equal(h.added.length,0);
});

test('the other looks start as before',()=>{
 assert.deepEqual(boot('native').classes,['ui-native']);assert.deepEqual(boot(null).classes,['ui-native']);assert.deepEqual(boot('cyber').classes,[]);
});

test('the page loads the board stylesheet after the clean look and its light theme',()=>{
 const at=name=>html.indexOf(`href="${name}"`);
 assert.ok(at('native.css')>0&&at('native.css')<at('light.css')&&at('light.css')<at('board.css'));
});

// ---------- the look switch ----------
function looks({classes=['ui-native'],saved=null}={}){
 const root={classList:classList(classes),lang:'ru'},stored={},renders=[],applied=[];
 const button=style=>({dataset:{uiStyle:style},classList:classList(),attrs:{},setAttribute(k,v){this.attrs[k]=v}});
 const buttons=['native','board','cyber'].map(button),listeners={};
 const document={documentElement:root,readyState:'complete',querySelectorAll:s=>s==='[data-ui-style]'?buttons:[],querySelector:()=>null,addEventListener(type,fn){listeners[type]=fn},createTreeWalker:()=>({nextNode:()=>false}),createElement:()=>({})};
 const window={document,localStorage:{getItem:()=>saved,setItem(k,v){stored[k]=v}},requestAnimationFrame(){},App:{render:()=>renders.push(1)},SheetTabs:{apply:()=>applied.push(1)}};
 vm.runInNewContext(source('native.js'),{window,MutationObserver:class{observe(){}}});
 const click=style=>listeners.click({target:{closest:s=>s==='[data-ui-style]'?{dataset:{uiStyle:style}}:null}});
 const pressed=()=>buttons.filter(b=>b.attrs['aria-pressed']==='true').map(b=>b.dataset.uiStyle);
 return {N:window.NativeUI,root,stored,renders,applied,click,pressed,classes:()=>[...root.classList.set].sort()};
}

test('there are three looks and the current one is read from the classes',()=>{
 const h=looks();assert.deepEqual([...h.N.STYLES],['native','board','cyber']);
 assert.equal(h.N.currentStyle(),'native');
 assert.equal(looks({classes:['ui-native','ui-board']}).N.currentStyle(),'board');
 assert.equal(looks({classes:[]}).N.currentStyle(),'cyber');
});

test('choosing «Досье» keeps the clean base, adds the board class, saves the choice and marks its button',()=>{
 const h=looks();h.click('board');
 assert.deepEqual(h.classes(),['ui-board','ui-native']);assert.equal(h.stored['nc-ui-style'],'board');
 assert.deepEqual(h.pressed(),['board']);assert.equal(h.applied.length,1,'the sheet is laid out again');assert.equal(h.renders.length,0);
});

test('from «Досье» to «Киберпанк» both classes go and the page is redrawn; back to «Обычное» only the clean class returns',()=>{
 const h=looks({classes:['ui-native','ui-board']});
 h.click('cyber');assert.deepEqual(h.classes(),[]);assert.equal(h.stored['nc-ui-style'],'cyber');assert.deepEqual(h.pressed(),['cyber']);assert.equal(h.renders.length,1);
 h.click('native');assert.deepEqual(h.classes(),['ui-native']);assert.equal(h.stored['nc-ui-style'],'native');assert.deepEqual(h.pressed(),['native']);
});

test('an unknown look falls back to the default one',()=>{
 const h=looks({classes:[]});h.N.setStyle('something');
 assert.deepEqual(h.classes(),['ui-native']);assert.equal(h.stored['nc-ui-style'],'native');
});

test('the menu offers the three looks in both languages',()=>{
 const app=source('app.js');
 assert.match(app,/data-ui-style="native">\$\{state\.lang==='ru'\?'Обычное':'Clean'\}<\/button><button type="button" data-ui-style="board">\$\{state\.lang==='ru'\?'Досье':'Dossier'\}<\/button><button type="button" data-ui-style="cyber">/);
});

// ---------- the sheet tabs ----------
function tabs({board=true,wide=true,saved='skills'}={}){
 const root={lang:'ru',classList:classList(board?['ui-native','ui-board']:['ui-native'])},inserted=[],media={matches:wide,listeners:[],addEventListener(type,fn){this.listeners.push(fn)}};
 const layout={dataset:{},classList:classList(),querySelectorAll:()=>[],querySelector:()=>null,insertAdjacentHTML(where,markup){inserted.push(markup)}};
 const document={documentElement:root,addEventListener(){},getElementById:()=>null,querySelector:s=>s==='.sheet-layout'?layout:null,querySelectorAll:()=>[]};
 const window={document,localStorage:{getItem:k=>k==='nightcity-red-sheet-tab-v1'?saved:null,setItem(){}},matchMedia:()=>media};
 vm.runInNewContext(source('sheet-tabs.js'),{window,setTimeout:()=>0,clearTimeout(){}});
 const c={id:'c',name:'V',hp:40,humanity:60,stats:{INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:6,EMP:6},skills:{}};
 window.SheetTabs.apply(c);
 const selected=markup=>(markup.match(/data-sheet-tab="(\w+)" aria-selected="true"/)||[])[1];
 return {T:window.SheetTabs,layout,inserted,media,root,selected:()=>selected(inserted.at(-1))};
}

test('on a wide board the «Навыки» tab shows «Основное»: the skills already stand in their own column',()=>{
 const h=tabs();
 assert.equal(h.T.current(),'skills','the choice itself is kept');assert.equal(h.T.shown(),'main');
 assert.equal(h.layout.dataset.activeTab,'main');assert.equal(h.selected(),'main');
 assert.match(h.inserted[0],/class="sheet-dock" data-active-tab="main"/);assert.match(h.inserted[0],/class="sheet-extras" data-active-tab="main"/);
});

test('on a narrow board, and in the other looks, «Навыки» is an ordinary tab',()=>{
 for(const h of [tabs({wide:false}),tabs({board:false}),tabs({board:false,wide:false})]){assert.equal(h.T.shown(),'skills');assert.equal(h.layout.dataset.activeTab,'skills');assert.equal(h.selected(),'skills')}
});

test('other tabs are never replaced',()=>{
 for(const tab of ['main','combat','gear','role','life','all']){const h=tabs({saved:tab});assert.equal(h.layout.dataset.activeTab,tab);assert.equal(h.T.shown(),tab)}
});

test('when the window becomes narrow or wide the sheet is laid out again',()=>{
 const h=tabs();assert.equal(h.media.listeners.length,1);
 h.media.matches=false;h.media.listeners[0]();assert.equal(h.layout.dataset.activeTab,'skills');
 h.media.matches=true;h.media.listeners[0]();assert.equal(h.layout.dataset.activeTab,'main');
});

test('a browser without matchMedia keeps the ordinary tabs',()=>{
 const root={lang:'ru',classList:classList(['ui-native','ui-board'])},layout={dataset:{},classList:classList(),querySelectorAll:()=>[],querySelector:()=>null,insertAdjacentHTML(){}};
 const document={documentElement:root,addEventListener(){},getElementById:()=>null,querySelector:s=>s==='.sheet-layout'?layout:null,querySelectorAll:()=>[]};
 const window={document,localStorage:{getItem:()=>'skills',setItem(){}}};
 vm.runInNewContext(source('sheet-tabs.js'),{window,setTimeout:()=>0,clearTimeout(){}});
 window.SheetTabs.apply({id:'c',stats:{},skills:{}});assert.equal(layout.dataset.activeTab,'skills');
});

// ---------- the stylesheet ----------
test('every rule of the look is scoped to it, so the other looks are untouched',()=>{
 const body=css.replace(/\/\*[\s\S]*?\*\//g,'');
 const selectors=[...body.matchAll(/(^|[{}])\s*([^{}@]+)\{/g)].map(m=>m[2].trim()).filter(Boolean);
 assert.ok(selectors.length>80);
 for(const list of selectors)for(const one of list.split(/,\s*(?![^()]*\))/))assert.ok(one.trim().startsWith('html.ui-native.ui-board'),one.trim().slice(0,80));
});

test('the board layout is for screens only and starts at the two widths the tabs know about',()=>{
 assert.match(css,/@media screen and \(min-width: 1024px\)/);assert.match(css,/@media screen and \(min-width: 1360px\)/);
 assert.match(source('sheet-tabs.js'),/WIDE='\(min-width: 1024px\)'/);
 assert.match(css,/@media print \{[\s\S]*border-image: none/);
});

test('the frames are drawn by the stylesheet itself: nothing is fetched from another site',()=>{
 assert.doesNotMatch(css,/url\((?!"data:image\/svg\+xml)/);assert.doesNotMatch(css,/https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
});
