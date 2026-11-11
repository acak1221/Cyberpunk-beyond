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

test('on a wide board the «Навыки» tab shows «Действия»: the skills already stand in their own column',()=>{
 const h=tabs();
 assert.equal(h.T.current(),'skills','the choice itself is kept');assert.equal(h.T.shown(),'combat');
 assert.equal(h.layout.dataset.activeTab,'combat');assert.equal(h.selected(),'combat');
 assert.match(h.inserted[0],/class="sheet-dock" data-active-tab="combat" data-board="1"/);assert.match(h.inserted[0],/class="sheet-extras" data-active-tab="combat"/);
});

test('the board has its own tabs: «Действия», «Особенности» and «Персонаж», without «Основное» and «Весь лист»',()=>{
 const h=tabs(),bar=h.inserted[0],ids=[...bar.matchAll(/data-sheet-tab="(\w+)"/g)].map(m=>m[1]);
 assert.deepEqual(ids,['combat','skills','gear','role','life']);assert.deepEqual([...h.T.boardTabs],['combat','skills','gear','role','life','netrun']);
 for(const label of ['Действия','Навыки','Снаряжение','Особенности','Персонаж'])assert.ok(bar.includes(`</span>${label}</button>`),label);
 for(const gone of ['Основное','Весь лист','>Бой<'])assert.ok(!bar.includes(gone),gone);
 const plain=tabs({board:false}).inserted[0];
 assert.deepEqual([...plain.matchAll(/data-sheet-tab="(\w+)"/g)].map(m=>m[1]),['main','skills','combat','gear','role','life','all']);assert.match(plain,/data-board="0"/);
});

test('a tab saved in another look that the board does not have opens «Действия», and the choice is kept',()=>{
 for(const saved of ['main','all'])for(const wide of [true,false]){const h=tabs({saved,wide});assert.equal(h.T.current(),saved);assert.equal(h.T.shown(),'combat');assert.equal(h.layout.dataset.activeTab,'combat');assert.equal(h.selected(),'combat')}
 for(const saved of ['main','all']){const h=tabs({saved,board:false});assert.equal(h.T.shown(),saved)}
});

test('each section of the sheet knows the tab it stands under in the board',()=>{
 const wide=tabs({saved:'gear'}).T,phone=tabs({saved:'gear',wide:false}).T,plain=tabs({board:false}).T;
 for(const id of ['sheet-identity','sheet-stats','sheet-resources','sheet-reputation'])for(const T of [wide,phone])assert.equal(T.owner(id),'life',id);
 for(const T of [wide,phone]){assert.equal(T.owner('sheet-role'),'combat');assert.equal(T.owner('sheet-role-ability'),'role');assert.equal(T.owner('sheet-features'),'role');assert.equal(T.owner('sheet-weapons'),'combat');assert.equal(T.owner('sheet-items'),'gear')}
 assert.equal(wide.owner('sheet-specializations'),'role');assert.equal(phone.owner('sheet-specializations'),'skills');
 assert.equal(wide.owner('sheet-vitals'),'gear','with a column of its own the condition is on every tab');assert.equal(phone.owner('sheet-vitals'),'life');
 assert.equal(plain.owner('sheet-identity'),'main');assert.equal(plain.owner('sheet-role'),'role');assert.equal(plain.owner('sheet-vitals'),'main');
});

test('the stylesheet puts the sections under the board tabs',()=>{
 assert.match(css,/\[data-active-tab="combat"\] \.sheet-primary > #sheet-role \{ display: block; \}/);
 assert.match(css,/\[data-active-tab="role"\] \.sheet-primary > :is\(#sheet-role, \.hustle-tools\) \{ display: none; \}/);
 assert.match(css,/\[data-active-tab="role"\] \.sheet-primary > #sheet-features \{ display: block; \}/);
 assert.match(css,/\[data-active-tab="life"\] \.sheet-primary > :is\(#sheet-identity, #sheet-stats, \.hustle-tools\) \{ display: block; \}/);
 assert.match(css,/\[data-active-tab="life"\] \.cx-root > #sheet-resources \{ display: block; \}/);
 assert.match(css,/\[data-active-tab="life"\] \.sheet-primary > :is\(\.delete-button, #sheet-none\) \{ display: inline-block; \}/,'the character can still be deleted; the id gives the rule its weight');
 assert.match(css,/\[data-active-tab="role"\] \.cx-root > #sheet-specializations \{ display: block; \}/);
 assert.match(css,/#sheet-skills > \.skills-list \{ max-height: none; overflow: visible; \}/,'the skills are one long list, not a box that scrolls');
 assert.doesNotMatch(css,/#sheet-skills \{[^}]*position: sticky/);
 assert.match(source('theme.css'),/\.sheet-features \{ display: none; \}/,'the card of effects is hidden in the other looks');
 assert.match(source('app.js'),/id="sheet-features"[^`]*data-calc-effects/);
});

test('on a narrow board, and in the other looks, «Навыки» is an ordinary tab',()=>{
 for(const h of [tabs({wide:false}),tabs({board:false}),tabs({board:false,wide:false})]){assert.equal(h.T.shown(),'skills');assert.equal(h.layout.dataset.activeTab,'skills');assert.equal(h.selected(),'skills')}
});

test('other tabs are never replaced',()=>{
 for(const tab of ['combat','gear','role','life']){const h=tabs({saved:tab});assert.equal(h.layout.dataset.activeTab,tab);assert.equal(h.T.shown(),tab)}
});

test('when the window becomes narrow or wide the sheet is laid out again',()=>{
 const h=tabs();assert.equal(h.media.listeners.length,1);
 h.media.matches=false;h.media.listeners[0]();assert.equal(h.layout.dataset.activeTab,'skills');
 h.media.matches=true;h.media.listeners[0]();assert.equal(h.layout.dataset.activeTab,'combat');
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
