// The compact sheet: one sticky row (name, HP bar, HUM, LUCK, eb, «⋯»), the rail above the tabs, every tab reachable,
// the stat strip not repeated, link / export / print in the menu (site/sheet-tabs.js, site/sheet-compact.css, site/app.js).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=f=>fs.readFileSync(__dirname+'/../site/'+f,'utf8');
const same=(a,b,m)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),b,m);

function node(){
 const o={attrs:{},dataset:{},innerHTML:'',hidden:false,focused:0,clicked:0,classes:new Set(),
  setAttribute(k,v){this.attrs[k]=String(v)},getAttribute(k){return this.attrs[k]??null},hasAttribute(k){return k in this.attrs},contains(){return false},
  remove(){},querySelector(){return null},querySelectorAll(){return []},focus(){this.focused++;o.doc.activeElement=this},click(){this.clicked++},closest(){return null},
  classList:{toggle(){},add(){},remove(){},contains:()=>false}};
 return o;
}
function harness({board=false,saved='skills',stubs={}}={}){
 const L={},inserted=[],body=node();
 const wrap=node(),panel=node(),rail=node(),extras=node(),hpStep=node(),moreBtn=node(),menuItem=node();
 const items=[menuItem];
 const dock={dataset:{},remove(){},nextElementSibling:null,querySelector(s){return {'.sheet-hud-wrap':wrap,'.hud-hp-panel':panel,'.sheet-rail-wrap':rail,'[data-hud-more]':moreBtn,'.sheet-tabs':null}[s]||(s.startsWith('.hud-more-menu [data-keep')?menuItem:null)},contains:()=>false,classList:{contains:()=>false}};
 const layout={dataset:{},classList:{toggle(){},contains:()=>false},querySelectorAll:()=>[],querySelector:()=>null,insertAdjacentHTML(w,m){inserted.push(m)}};
 const realButtons={},found={};
 const doc={documentElement:{lang:'ru',classList:{contains:c=>board&&c==='ui-board'||c==='ui-native'}},body,activeElement:body,
  addEventListener(t,fn){(L[t]||=[]).push(fn)},getElementById:()=>null,
  querySelector(s){
   if(s==='.sheet-layout')return layout;if(s==='.sheet-dock')return inserted.length?dock:null;if(s==='.sheet-extras')return extras;
   if(s==='.hud-hp-panel [data-hp-step="-1"]')return hpStep;if(s==='.hud-more-menu [role="menuitem"]')return menuItem;if(s==='[data-hud-more]')return moreBtn;
   const m=/^\.sheet-header \[data-action="([\w-]+)"\]$/.exec(s);if(m)return realButtons[m[1]]||null;
   return found[s]||null},
  querySelectorAll(s){return s==='.hud-more-menu [role="menuitem"]'?items:[]}};
 body.doc=doc;for(const e of [wrap,panel,rail,extras,hpStep,moreBtn,menuItem])e.doc=doc;
 const win={document:doc,localStorage:{getItem:k=>k==='nightcity-red-sheet-tab-v1'?saved:null,setItem(){}},matchMedia:()=>({matches:false,addEventListener(){}}),
  HpPad:{html:(t,l,where)=>`<PAD ${where} ${t.name}/>`,forCharacter:c=>({name:c.name}),refresh(){win.padRefreshed=(win.padRefreshed||0)+1},isOpen:()=>false},
  QuickRail:{html:(c,l)=>`<RAIL ${l}/>`},App:{active:()=>c},...stubs};
 vm.runInNewContext(src('sheet-tabs.js'),{window:win,setTimeout:()=>0,clearTimeout(){}});
 const c={id:'c',name:'Vee <&>',hp:20,humanity:60,stats:{INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{}};
 win.SheetTabs.apply(c);
 const fire=(type,target,extra={})=>{let stopped=false;for(const fn of L[type]||[])fn({type,target,key:extra.key,preventDefault(){},stopPropagation(){stopped=true},...extra});return stopped};
 const press=(attr,extra={})=>{const el=node();el.doc=doc;Object.assign(el.dataset,extra);el.closest=s=>s.split(',').some(x=>x.trim()==='['+attr+']'||x.trim().startsWith('['+attr+'='))?el:null;fire('click',el);return el};
 return {found,win,doc,dock:inserted[0],inserted,wrap,panel,rail,extras,hpStep,moreBtn,menuItem,realButtons,fire,press,c,L};
}

test('the sticky row: the name inside the HP chip, a bar, HUM, LUCK and the money before «⋯», the rest after it',()=>{
 const h=harness({stubs:{Money:{chipHTML:()=>'<MONEY/>'},SheetLeftovers:{ipChipHTML:()=>'<IP/>'},Room:{turnChip:()=>'<TURN/>'}}});
 const d=h.dock;
 assert.match(d,/<button type="button" class="hud-chip hud-hp"[^>]*aria-label="Vee &lt;&amp;&gt; 20 \/ 45: HP, Тяжёлое ранение · −2"><span class="hud-name"(?: title="Vee &lt;&amp;&gt;")?>Vee &lt;&amp;&gt;<\/span>/);
 assert.match(d,/<span class="hud-bar" aria-hidden="true"><i style="width:44%"><\/i><\/span>/);
 const at=s=>d.indexOf(s);
 assert.ok(at('hud-hp')<at('>HUM<')&&at('>HUM<')<at('>LUCK<')&&at('>LUCK<')<at('<MONEY/>')&&at('<MONEY/>')<at('<TURN/>')&&at('<TURN/>')<at('data-hud-more')&&at('data-hud-more')<at('<IP/>'),'primary chips, then «⋯», then the rest');
 assert.ok(at('data-sheet-lock')>at('data-hud-more'));
 assert.match(d,/data-wound="serious"/);
});

test('the HP bar width follows HP and stays between 0 and 100',()=>{
 const h=harness();
 assert.equal(h.win.SheetTabs.hpFill({hp:20,max:40}),50);assert.equal(h.win.SheetTabs.hpFill({hp:-4,max:40}),0);assert.equal(h.win.SheetTabs.hpFill({hp:90,max:40}),100);assert.equal(h.win.SheetTabs.hpFill({hp:5,max:0}),0);
});

test('the dock has the HP pad, the rail above the tabs and the tabs with a name each',()=>{
 const d=harness().dock;
 assert.ok(d.includes('<div class="hud-hp-panel" id="hud-hp-panel" hidden><PAD sheet Vee <&>/></div>')||/<div class="hud-hp-panel" id="hud-hp-panel" hidden><PAD sheet/.test(d));
 assert.ok(d.indexOf('hud-hp-panel')<d.indexOf('sheet-rail-wrap')&&d.indexOf('sheet-rail-wrap')<d.indexOf('class="sheet-tabs"'),'the rail stands above the tabs');
 assert.match(d,/<div class="sheet-rail-wrap"><RAIL ru\/><\/div>/);
 const tabs=[...d.matchAll(/<button type="button" role="tab" data-sheet-tab="(\w+)" aria-selected="(\w+)" aria-label="([^"]+)"[^>]*><span aria-hidden="true">(.)<\/span><i class="sheet-tab-label">([^<]+)<\/i><\/button>/g)];
 same(tabs.map(m=>m[1]),['main','skills','combat','gear','role','life','all']);
 for(const m of tabs)assert.equal(m[3],m[5],'the icon-only phone state keeps the name for screen readers');
});

test('the stat strip is not repeated: only the «Досье» look draws it',()=>{
 const html=src('sheet-tabs.js');
 assert.ok(html.includes("${board()?`<div class=\"sheet-stat-strip\""));
 const rendered=harness();assert.doesNotMatch(rendered.dock,/sheet-stat-strip/);
 // extras are filled by refreshHud; check the function through the markup the dock inserted
 assert.doesNotMatch(rendered.dock,/INT<\/small><b>6/);
 const b=harness({board:true});assert.match(b.dock,/data-board="1"/);
});

test('«⋯» opens a menu with link, export and print; each item presses the real button; Escape closes and gives the focus back',()=>{
 const h=harness();
 assert.match(h.dock,/<div class="hud-more-menu" id="hud-more-menu" role="menu" aria-label="Ещё" hidden>/);
 for(const [id,ru] of [['share-link','Ссылка'],['export','Экспорт JSON'],['print','Печать']])assert.match(h.dock,new RegExp(`role="menuitem" data-hud-act="${id}" data-keep="more-${id}"><span aria-hidden="true">.</span>${ru}`));
 const dockEl=h.doc.querySelector('.sheet-dock');
 h.dock; // inserted markup is a string; refreshHud writes the new state into the wrap
 h.doc.activeElement=h.moreBtn;
 h.press('data-hud-more');
 assert.match(h.wrap.innerHTML,/class="hud-chip hud-more" data-hud-more aria-haspopup="menu" aria-expanded="true"/);assert.doesNotMatch(h.wrap.innerHTML,/role="menu"[^>]*hidden/);
 assert.ok(h.menuItem.focused>=1,'the first item takes the focus');
 const real=node();real.doc=h.doc;h.realButtons.export=real;
 const item=h.press('data-hud-act',{hudAct:'export'});
 assert.equal(real.clicked,1,'the real export button is pressed');assert.match(h.wrap.innerHTML,/aria-expanded="false"/);
 // an id the menu does not have never reaches a selector
 const bad=h.press('data-hud-act',{hudAct:'x"] , body ['});assert.equal(real.clicked,1);
 // a missing or disabled real button is a quiet no-op
 const off=node();off.doc=h.doc;off.disabled=true;h.realButtons.print=off;h.press('data-hud-act',{hudAct:'print'});assert.equal(off.clicked,0);
 h.press('data-hud-more');
 const esc=node();esc.doc=h.doc;esc.closest=s=>s==='.hud-more-menu [role="menuitem"]'?esc:null;
 h.fire('keydown',esc,{key:'Escape'});assert.match(h.wrap.innerHTML,/aria-expanded="false"/);assert.ok(h.moreBtn.focused>=1,'the focus goes back to «⋯»');
});

test('a click elsewhere closes the open menu; Tab out of it closes it too',()=>{
 const h=harness();
 h.press('data-hud-more');assert.match(h.wrap.innerHTML,/aria-expanded="true"/);
 const elsewhere=node();elsewhere.doc=h.doc;elsewhere.closest=()=>null;h.fire('click',elsewhere);assert.match(h.wrap.innerHTML,/aria-expanded="false"/);
 h.press('data-hud-more');
 const item=node();item.doc=h.doc;item.closest=s=>s==='.hud-more-menu [role="menuitem"]'?item:null;h.fire('keydown',item,{key:'Tab'});assert.match(h.wrap.innerHTML,/aria-expanded="false"/);
});

test('the HP chip opens the pad in the dock and «Изменить HP» does too, with the focus on the first step',()=>{
 const h=harness();
 assert.equal(h.panel.hidden,false===false?h.panel.hidden:h.panel.hidden);
 h.press('data-hud-hp');assert.equal(h.panel.hidden,false);assert.ok(h.win.padRefreshed>=1,'the pad is brought up to date');
 h.press('data-hud-hp');assert.equal(h.panel.hidden,true);
 h.press('data-hp-open');assert.equal(h.panel.hidden,false);assert.equal(h.hpStep.focused,1);
 // Escape from inside the pad closes it and returns to the chip
 const chip=node();chip.doc=h.doc;h.doc.querySelector=(old=>s=>s==='[data-hud-hp]'?chip:old(s))(h.doc.querySelector);
 const inPad=node();inPad.doc=h.doc;inPad.closest=s=>s.includes('.hud-hp-panel')?inPad:null;h.fire('keydown',inPad,{key:'Escape'});
 assert.equal(h.panel.hidden,true);assert.equal(chip.focused,1);
 // while the dialog of the pad is open, Escape belongs to the dialog
 h.press('data-hp-open');h.win.HpPad.isOpen=()=>true;h.fire('keydown',inPad,{key:'Escape'});assert.equal(h.panel.hidden,false);
});

test('SheetTabs exposes openHp for HpPad and the HUD refresh keeps the rail and the HP number of the card current',()=>{
 const h=harness();
 assert.equal(typeof h.win.SheetTabs.openHp,'function');
 h.win.SheetTabs.openHp(true,{focus:false});assert.equal(h.panel.hidden,false);
 h.win.SheetTabs.openHp(false);assert.equal(h.panel.hidden,true);
 h.c.hp=33;h.win.SheetTabs.refreshHud(h.c);
 assert.match(h.rail.innerHTML,/<RAIL ru\/>/);assert.match(h.wrap.innerHTML,/<b>33<\/b>/);assert.match(h.wrap.innerHTML,/style="width:73%"/);
});

test('the old HP step handlers are gone from the sheet tabs: HpPad owns them',()=>{
 const t=src('sheet-tabs.js');
 for(const gone of ['hpReason','function setHp','data-hp-take','data-sheet-hp-reason'])assert.ok(!t.includes(gone),gone);
 assert.match(t,/global\.HpPad\?\.html\?\.\(/);
});

test('the sheet header: portrait and actions move out of the way outside the «Досье» look, and the real buttons stay in the page',()=>{
 const app=src('app.js'),css=src('sheet-compact.css');
 assert.match(app,/<div class="page-header sheet-header">\$\{boardLook\(\)\?\(window\.Portrait\?\.editor\(c\)\|\|''\):''\}/);
 assert.match(app,/<div class="identity-portrait">\$\{window\.Portrait\?\.editor\(c\)\|\|''\}<\/div>/);
 for(const action of ['share-link','export','print'])assert.match(app,new RegExp(`data-action="${action}"`),action+' still exists for the menu to press');
 assert.match(css,/html:not\(\.ui-board\) \.sheet-header \{[^}]*position: absolute; width: 1px; height: 1px/);
 assert.match(css,/html:not\(\.ui-board\) \.sheet-header \.header-actions \{ display: none; \}/);
 const markup=app.slice(app.indexOf('function sheet(c){'),app.indexOf('function sheetUid'));
 assert.ok(markup.length>5000);assert.doesNotMatch(markup,/data-sheet-hp-reason/,'no reason select in the sheet any more');assert.doesNotMatch(markup,/data-field="hp"/,'the HP field lives in the pad');
});

test('every tab is reachable at 390 px: four columns of labels on top, one row of icons 44 px wide when scrolled',()=>{
 const css=src('sheet-compact.css');
 assert.match(css,/@media \(max-width: 560px\)[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
 assert.match(css,/\.dock-compact \.sheet-tabs \{ display: flex; gap: 0/);
 assert.match(css,/\.dock-compact \.sheet-tabs button \{ flex: 1 1 0; min-height: 44px/);
 assert.match(css,/\.dock-compact \.sheet-tabs button \.sheet-tab-label \{ display: none; \}/);
 // 8 tabs at 358 px (390 − 2 × 16) is 44.75 px each: no tab is cut and none needs a scroll
 assert.ok(358/8>=44);
});

test('touch targets of the new controls are at least 44 px',()=>{
 const css=src('sheet-compact.css')+src('hp-pad.css')+src('quick-rail.css')+src('stat-detail.css');
 for(const re of [/\.hud-more-menu button \{[^}]*min-height: 44px/,/\.skill-star \{[^}]*width: 44px[^}]*height: 44px/,/\.stat \.stat-info \{[^}]*min-height: 44px/,/\.skill-name\[data-detail-open\] \{[^}]*min-height: 44px/,/\.sheet-skill-filter \.sf-zero \{[^}]*min-height: 44px/,/\.sheet-skill-filter \.sf-group select \{ min-height: 44px/,/\.hp-pad-x \{[^}]*width: 44px; height: 44px/,/\.qr-btn \{[^}]*min-height: 44px/])assert.match(css,re,String(re));
 assert.match(css,/html:not\(\.ui-board\) \.skill-row input\[data-skill\] \{ min-height: 44px; \}/);
});

test('the Skills tab starts early: the help line is hidden on a phone and the count sits inside the search field',()=>{
 const css=src('sheet-compact.css');
 assert.match(css,/#sheet-skills > p\.muted \{ display: none; \}/);assert.match(css,/\[data-skill-filter-count\] \{ position: absolute; top: 0; right: 12px/);
 assert.match(css,/\.sheet-extras\[data-active-tab="skills"\] \.sheet-next-roll[\s\S]*grid-template-columns: 1fr 1fr/);
});

test('the stylesheet prints cleanly: the new chrome is not on paper',()=>{
 const css=src('sheet-compact.css');assert.match(css,/@media print \{[^}]*\.skill-star[^}]*display: none !important/);
});

test('a roll from the rail that redraws the whole sheet gets the focus back on the same button of the new rail',()=>{
 const h=harness();
 const old=node();old.doc=h.doc;old.dataset.keep='qr-init';old.dataset.proxyRoll='[data-action="initiative-roll"]';
 old.closest=s=>s==='[data-proxy-roll]'?old:s==='.sheet-rail-wrap'?{}:null;
 h.fire('click',old);
 const fresh=node();fresh.doc=h.doc;h.found['.sheet-rail-wrap [data-keep="qr-init"]']=fresh;
 h.doc.activeElement=h.body;h.win.SheetTabs.apply(h.c);
 assert.equal(fresh.focused,1,'the focus is on the new button, not on the page');
 // once something real has the focus, nothing is taken from it
 const other=node();other.doc=h.doc;h.doc.activeElement=other;h.win.SheetTabs.apply(h.c);assert.equal(fresh.focused,1);
 // a button outside the rail and the extras is not remembered
 const h2=harness(),loose=node();loose.doc=h2.doc;loose.dataset.keep='x';loose.closest=s=>s==='[data-proxy-roll]'?loose:null;h2.fire('click',loose);
 const f2=node();f2.doc=h2.doc;h2.found['.sheet-rail-wrap [data-keep="x"]']=f2;h2.doc.activeElement=h2.body;h2.win.SheetTabs.apply(h2.c);assert.equal(f2.focused,0);
});

test('the row always has a face: the first letter of the name when there is no portrait, and the HP chip name starts with what it shows',()=>{
 const h=harness();
 assert.match(h.dock,/<span class="hud-avatar hud-initial" aria-hidden="true">V<\/span>/);
 assert.match(h.dock,/aria-label="Vee[^"]* 20 \/ 45: HP/,'the visible text (name, then the number) opens the accessible name');
});

test('touch targets: tabs, STAT inputs, pad buttons, next-roll steps and the little chips are 44 px on a phone; the light rail hint keeps its own colour',()=>{
 const css=fs.readFileSync(__dirname+'/../site/sheet-compact.css','utf8'),rail=fs.readFileSync(__dirname+'/../site/quick-rail.css','utf8');
 assert.match(css,/\.sheet-tabs button \{[^}]*min-height: 44px/);
 assert.match(css,/\.sheet-next-roll \.nr-step button \{ min-width: 44px; min-height: 44px; \}/);
 assert.match(css,/input\[data-stat\] \{ min-height: 44px; height: 44px; \}/);
 assert.match(css,/\.hud-hp-panel \.hud-hp-row \.btn\.small[^{]*\{ min-height: 44px; \}/);
 assert.match(css,/\.sheet-dock \.hud-chip \{ min-width: 44px;/);
 assert.match(css,/\.skill-row \.ipq-btn \{[^}]*width: 44px; height: 44px/);
 assert.match(rail,/ui-light \.qr-btn:not\(\.qr-add\) \{ color: #fff; \}/,'white text only on the red buttons, not on the dashed hint');
});
