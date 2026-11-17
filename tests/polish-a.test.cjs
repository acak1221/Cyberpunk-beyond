// Polish, lane A: the compact sheet header (portrait, name, HP on one line, chips of 44 px), lifepath selects, the Night City cards,
// the shell labels, settings (focus after «persist», Escape in the erase step, the shake switch), the home heading, the icons of the
// phone context bar, the details path of the «Досье» look and the quick-rolls hint.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=f=>fs.readFileSync(__dirname+'/../site/'+f,'utf8');
// The last declaration block that matches a selector (the cascade: the later rule wins).
const rules=(css,sel)=>[...css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m=>m[1].split(',').some(x=>x.trim()===sel)).map(m=>m[2]);
const last=(css,sel)=>{const r=rules(css,sel);assert.ok(r.length,'no rule for '+sel);return r[r.length-1]};
const some=(css,sel,re)=>assert.ok(rules(css,sel).some(r=>re.test(r)),sel+' with '+re);
const tick=()=>new Promise(r=>setImmediate(r));

/* ---------- 1. the compact header ---------- */
test('the letter of a portrait-less avatar is centred inside the circle (a grid, not a plain block)',()=>{
 const css=src('sheet-compact.css');
 const r=last(css,'html .sheet-dock .hud-avatar.hud-initial');
 assert.match(r,/display:\s*grid/);assert.match(r,/place-items:\s*center/);
 const a=last(css,'html .sheet-dock .hud-avatar');
 assert.match(a,/border-radius:\s*50%/);assert.match(a,/width:\s*40px/);assert.match(a,/object-fit:\s*cover/);
});
test('the HP chip: a readable name that is cut with an ellipsis, the number on one line, the bar beside it',()=>{
 const css=src('sheet-compact.css');
 const name=last(css,'html .sheet-dock .hud-hp .hud-name');
 assert.ok(Number(/font:\s*\d+\s+(\d+)px/.exec(name)?.[1])>=14,'the name is at least 14 px: '+name);
 assert.match(name,/text-overflow:\s*ellipsis/);assert.match(name,/color:\s*var\(--text\)/);
 assert.match(last(css,'html .sheet-dock .hud-hp > b'),/white-space:\s*nowrap/);
 assert.match(last(css,'html .sheet-dock .hud-hp > small'),/white-space:\s*nowrap/);
 assert.match(last(css,'html .sheet-dock .hud-hp .hud-bar'),/grid-row:\s*2/);
 assert.match(last(css,'html .sheet-dock .hud-hp'),/width:\s*clamp\(150px/);
});
test('the strip fades at its right edge over 40 px or more, so a cut chip reads as «scroll»',()=>{
 const m=/mask-image:\s*linear-gradient\(90deg,\s*#000 calc\(100% - (\d+)px\)/.exec(src('sheet-compact.css'));
 assert.ok(m&&Number(m[1])>=40);
});
test('every chip of the header is 44 × 44 at least, also in the scrolled row and in the cyber look (the last stylesheet wins)',()=>{
 const css=src('touch-targets.css');
 const r=last(css,'html .sheet-dock .sheet-hud .hud-chip');
 assert.match(r,/min-width:\s*44px/);assert.match(r,/min-height:\s*44px/);
 assert.match(last(css,'html .sheet-dock.dock-compact .sheet-hud .hud-chip'),/min-height:\s*44px/);
 assert.match(css,/html \.sheet-dock \.sheet-hud \.hud-chip:is\(\.hud-money, \.dt-session, \.hud-lock, \.hud-awake\) \{ min-width: 44px; \}/);
 // sheet-leftovers.css squeezes these chips to min-width 0 in the cyber look; the rule above comes later and is as specific.
 assert.match(src('sheet-leftovers.css'),/\.hud-money,\.dt-session,\.hud-lock,\.hud-awake\)\{padding-inline:8px;min-width:0\}/);
 const html=src('index.html');assert.ok(html.indexOf('sheet-leftovers.css')<html.indexOf('touch-targets.css'));
});
test('the full name of the character is the title of the shortened name in the chip',()=>{
 assert.ok(src('sheet-tabs.js').includes('<span class="hud-name" title="${html(c.name||(ru?\'Без имени\':\'Untitled\'))}">'));
});

/* ---------- 2. lifepath selects ---------- */
test('the lifepath selects are 44 px high in every look',()=>{
 const r=last(src('lifepath.css'),'.lp-card .lp-select select');
 assert.match(r,/min-height:\s*44px/);assert.match(r,/box-sizing:\s*border-box/);
});

/* ---------- 3, 4. Night City cards ---------- */
test('the Night City cards: one column on a phone, two from 600 px, three from 1100 px',()=>{
 const css=src('night-city.css');
 some(css,'.nc-root .nc-grid',/grid-template-columns:\s*minmax\(0,1fr\)/);
 assert.match(css,/@media\(min-width:600px\)\{\.nc-root \.nc-grid\{grid-template-columns:repeat\(2,/);
 assert.match(css,/@media\(min-width:1100px\)\{\.nc-root \.nc-grid\{grid-template-columns:repeat\(3,/);
 assert.doesNotMatch(css,/overflow-wrap:\s*(anywhere|break-word)/);
 // netrun-console.css owns «.nc-grid» too (three narrow columns); the scoped rule has to out-rank its plain selector.
 assert.match(src('netrun-console.css'),/^\.nc-grid \{ grid-template-columns: repeat\(3/m);
});

/* ---------- 5. shell label follows the language ---------- */
test('the menu collapse button takes the language of the app, not of <html lang>, on every redraw',()=>{
 const btn={attrs:{},setAttribute(k,v){this.attrs[k]=v}};
 const root={lang:'ru',classList:{contains:()=>false,toggle(){}}};
 const doc={documentElement:root,querySelectorAll:s=>s==='[data-shell="mini"]'?[btn]:[],querySelector:()=>null,addEventListener(){}};
 const win={document:doc,addEventListener(){},matchMedia:()=>({matches:true,addEventListener(){}}),App:{lang:()=>'en'}};
 vm.runInNewContext(src('shell-ui.js'),{window:win,setTimeout,clearTimeout});
 win.ShellUI.sync();
 assert.equal(btn.attrs['aria-label'],'Collapse the menu to icons');assert.equal(btn.attrs.title,'Collapse the menu to icons');
 win.App.lang=()=>'ru';win.ShellUI.sync();
 assert.equal(btn.attrs['aria-label'],'Свернуть меню до значков');
});

/* ---------- 6, 7, 8. settings ---------- */
function settings({lang='ru',extra={}}={}){
 const listeners={},nodes={},calls={renders:0,notes:[],focus:[]};
 const map=new Map();
 const localStorage={get length(){return map.size},key:i=>[...map.keys()][i]??null,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
 const document={documentElement:{dataset:{}},addEventListener:(t,f)=>{(listeners[t]||=[]).push(f)},querySelector:s=>nodes[s]||null,createElement:()=>({setAttribute(){},after(){}})};
 const window={document,localStorage,indexedDB:{deleteDatabase(){}},location:{pathname:'/',search:'',hash:'#/settings',replace(){}},
  setTimeout:f=>{f();return 1},addEventListener(){},navigator:{storage:{persist:async()=>true,persisted:async()=>false,estimate:async()=>({usage:1,quota:100})}},
  App:{lang:()=>lang,render:()=>{calls.renders++},notify:m=>calls.notes.push(m)},
  Transfer:{status:()=>({at:null,days:null,changes:0,due:false,hasData:true,meta:{days:14}}),setDays(){}},
  ShellUI:{isMini:()=>false,setMini(){}},WhatsNew:{APP_VERSION:'2'},...extra};
 vm.runInNewContext(src('settings.js'),{window,Promise,Date,Math,Number,String,Intl});
 const fire=(type,ev)=>{for(const f of listeners[type]||[])f(ev)};
 const focusable=name=>({name,focus(){calls.focus.push(name)}});
 const storageBox=()=>({textContent:'',classList:{toggle(){}},parentElement:{querySelector:()=>({})},after(){}});
 return {S:window.Settings,window,calls,nodes,fire,focusable,storageBox};
}
test('«persist»: after the answer the focus stays on the button, or on the line that took its place; never on BODY',async()=>{
 const h=settings();
 h.nodes['[data-set-storage]']=h.storageBox();
 h.nodes['[data-set="persist"]']=h.focusable('persist');
 const el={dataset:{set:'persist'}};el.closest=s=>s==='[data-set]'?el:null;
 h.fire('click',{target:el});
 await tick();await tick();
 assert.deepEqual(h.calls.focus,['persist']);
 // The browser said yes: the button is gone and the confirmation line takes the focus.
 const g=settings();
 g.nodes['[data-set-storage]']=g.storageBox();
 g.nodes['[data-set-persist-line]']=g.focusable('line');
 g.fire('click',{target:el});
 await tick();await tick();
 assert.deepEqual(g.calls.focus,['line']);
});
test('the line that confirms «persist» can take the focus',()=>{
 assert.match(src('settings.js'),/<p class="set-hint" tabindex="-1" data-set-persist-line>/);
});
test('Escape cancels the second step of the erase and the focus goes back to the button that opened it',()=>{
 const h=settings();
 h.nodes['.set-page']={};
 const open={dataset:{set:'erase-open'}};open.closest=s=>s==='[data-set]'?open:null;
 h.fire('click',{target:open});
 assert.equal(h.S._test.ui.erase,true);
 h.nodes['[data-set="erase-open"]']=h.focusable('open');
 let prevented=0;
 h.fire('keydown',{key:'Tab',preventDefault(){prevented++}});
 assert.equal(h.S._test.ui.erase,true,'another key does nothing');
 h.fire('keydown',{key:'Escape',preventDefault(){prevented++}});
 assert.equal(h.S._test.ui.erase,false);assert.equal(prevented,1);
 assert.deepEqual(h.calls.focus,['open']);
 // Not when the settings page is not on the screen.
 const g=settings();g.S._test.ui.erase=true;g.fire('keydown',{key:'Escape'});
 assert.equal(g.S._test.ui.erase,true);
});
test('the shake switch: without a touch screen it is shown as unavailable with a reason, not as a switch that snaps back',()=>{
 const controls=()=>'<div class="dice-feel" data-dice-feel><label class="haptics-toggle"><input type="checkbox" data-dice-sound > Sound</label><label class="haptics-toggle"><input type="checkbox" data-dice-shake > Shake</label><small class="dice-feel-help">Shake the phone</small></div>';
 const DiceFeel={controls,supported:()=>true,t:(l,k)=>k==='shake'?(l==='en'?'Roll by shaking':'Бросок встряхиванием'):''};
 const desktop=settings({extra:{DiceFeel,matchMedia:()=>({matches:false})}});
 const a=desktop.S.render('en');
 assert.match(a,/data-set-shake-na/);
 assert.match(a,/<input type="checkbox" disabled aria-describedby="set-shake-why"/);
 assert.doesNotMatch(a,/data-dice-shake/);
 assert.match(a,/id="set-shake-why">Unavailable: this device has no motion sensor\./);
 assert.match(desktop.S.render('ru'),/Недоступно: на этом устройстве нет датчика движения\./);
 // A phone keeps the real switch.
 const phone=settings({extra:{DiceFeel,matchMedia:q=>({matches:q==='(pointer: coarse)'})}});
 const b=phone.S.render('en');
 assert.match(b,/data-dice-shake/);assert.doesNotMatch(b,/data-set-shake-na/);
 // A browser without the motion API is unusable too (DiceFeel then leaves the switch out itself).
 assert.equal(settings({extra:{DiceFeel:{...DiceFeel,supported:()=>false},matchMedia:()=>({matches:true})}}).S._test.shakeUsable(),false);
});

/* ---------- 9. home heading ---------- */
test('«Продолжить» stands as far from the top bar as the h1 of the other pages',()=>{
 const css=src('home.css');
 some(css,'.home-continue',/margin-top:\s*40px/);
 some(css,'html.ui-native .home-continue',/margin-top:\s*22px/);
 assert.match(css,/@media \(max-width:820px\)\{html\.ui-native \.home-continue\{margin-top:16px\}\}/);
 assert.match(src('native.css'),/html\.ui-native \.page-header \{ margin-top: 22px;/);
});

/* ---------- 10. icons of the phone context bar ---------- */
test('«Назад», «След. ход» and «Инициатива» each have an icon of their own, and the icons exist',()=>{
 const win={};vm.runInNewContext(src('icons.js'),{window:win});
 const w={};vm.runInNewContext(src('context-bar.js'),{window:w,globalThis:w});w.CombatDock={};
 const C=w.ContextBar;
 for(const ctx of [{view:'combat'},{view:'campaigns',tracker:true}]){
  const by=Object.fromEntries(C.items({...ctx,lang:'ru'}).map(i=>[i.key,i.icon]));
  const three=[by.prev,by.next,by.init];
  assert.equal(new Set(three).size,3,JSON.stringify(three));
  for(const n of three)assert.ok(win.Icons[n],'icon '+n);
  assert.ok(!three.includes('combat'),'the crosshair is not a turn control');
 }
 assert.notEqual(win.Icons.back,win.Icons.next);
});

/* ---------- 11. the details path in the «Досье» look ---------- */
test('«Досье»: the STAT boxes of the strip open the breakdown (the per-STAT buttons of the cards are hidden there)',()=>{
 const tabs=src('sheet-tabs.js'),dp=src('dossier-panel.js');
 // The strip is drawn in the board look only, one box per STAT with its name in a <small>...
 assert.ok(tabs.includes('${board()?`<div class="sheet-stat-strip"')&&tabs.includes('STATS.map(k=>`<div><small>${k}</small><b>'));
 // ...and the panel of that look marks each box as a button that opens the same breakdown.
 assert.ok(dp.includes(".sheet-extras .sheet-stat-strip > div')){const stat=box.querySelector('small')?.textContent?.trim();if(STATS.includes(stat))mark(box,'stat',stat"));
 assert.ok(dp.includes("el.setAttribute('role','button');el.setAttribute('tabindex','0');el.setAttribute('aria-haspopup','dialog')"));
 assert.match(dp,/function statBreakdown\(/);
});

/* ---------- 12. quick-rolls hint ---------- */
test('the quick-rolls hint wraps on its own row instead of running past the edge, in both languages',()=>{
 const css=src('sheet-compact.css');
 assert.match(last(css,'.sheet-rail-wrap .quick-rail:has(.qr-add)'),/flex-wrap:\s*wrap/);
 const r=last(css,'.sheet-rail-wrap .quick-rail .qr-add');
 assert.match(r,/white-space:\s*normal/);assert.match(r,/flex:\s*1 1 100%/);
 const js=src('quick-rail.js');
 assert.ok(js.includes("empty: '★ у навыка — быстрый бросок'")&&js.includes("empty: 'Star a Skill for a quick roll'"));
});
