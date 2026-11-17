// The menu: a labelled modal dialog on phones with a focus trap that returns to its opener, icons only on wide screens
// (nc-nav-mini), and in the drawer only navigation, three quick toggles and a link to the settings.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const source=read('shell-ui.js');

function setup({phone=true,wide=false,store={}}={}){
 const classes=new Set(),timers=[],listeners={},map=new Map(Object.entries(store));let active=null;
 const el=(name,more={})=>({name,attrs:{},inert:false,hidden:false,isConnected:true,focused:0,
  setAttribute(k,v){this.attrs[k]=String(v)},removeAttribute(k){delete this.attrs[k]},getAttribute(k){return this.attrs[k]??null},
  focus(){this.focused++;active=this},contains(x){return x===this||(this.kids||[]).includes(x)},...more});
 const first=el('first'),middle=el('middle'),last=el('last');
 const sidebar=el('sidebar',{kids:[first,middle,last],querySelectorAll(){return [first,middle,last]}});
 const toggle=el('toggle'),more=el('more'),mini=el('mini'),content=el('content'),main=el('main');
 const document={documentElement:{lang:'ru',classList:{contains:c=>classes.has(c),toggle(c,on){on?classes.add(c):classes.delete(c)},add:c=>classes.add(c)}},body:el('body'),get activeElement(){return active},
  querySelectorAll:s=>s==='[data-shell="menu"]'?[toggle,more]:s==='[data-shell="mini"]'?[mini]:s.includes('.content')?[content]:[],
  querySelector:s=>s==='#app-sidebar'?sidebar:s==='.menu-toggle'?toggle:s==='#main-content'?main:s==='[data-shell="mini"]'?mini:s.startsWith('#app-sidebar .nav-item')?first:null,
  addEventListener(type,fn,capture){(listeners[type+(capture?':capture':'')]||=[]).push(fn)}};
 const window={document,localStorage:{getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v))},addEventListener(){},
  matchMedia:q=>({matches:q.includes('max-width: 820px')?phone:q.includes('min-width: 1024px')?wide:false,addEventListener(){}})};
 vm.runInNewContext(source,{window,setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout:id=>{if(timers[id-1])timers[id-1].fn=()=>{}}});
 const click=(dataset,target={})=>{let prevented=false;const t={dataset,...target};for(const fn of listeners['click:capture'])fn({target:{closest:()=>t},preventDefault(){prevented=true}});return prevented};
 const key=(k,extra={})=>{let prevented=false;for(const fn of listeners.keydown)fn({key:k,preventDefault(){prevented=true},...extra});return prevented};
 return {S:window.ShellUI,classes,map,sidebar,first,middle,last,toggle,more,mini,main,click,key,focus:x=>{active=x},get active(){return active},runTimers(){for(const t of timers.splice(0))t.fn()}};
}

test('on a phone the open drawer is a modal dialog; closed, it is not',()=>{
 const h=setup();h.click({shell:'menu'});
 assert.equal(h.sidebar.attrs.role,'dialog');assert.equal(h.sidebar.attrs['aria-modal'],'true');
 h.click({shell:'close'});
 assert.equal(h.sidebar.attrs.role,undefined);assert.equal(h.sidebar.attrs['aria-modal'],undefined);
});

test('on a wide screen the sidebar is an ordinary sidebar: no dialog role',()=>{
 const h=setup({phone:false,wide:true});h.S.setOpen(true);
 assert.equal(h.sidebar.attrs.role,undefined);assert.equal(h.sidebar.attrs['aria-modal'],undefined);
});

test('Tab wraps inside the open drawer on a phone, in both directions, and pulls a stray focus in',()=>{
 const h=setup();h.click({shell:'menu'});
 h.focus(h.last);assert.equal(h.key('Tab'),true);assert.equal(h.active,h.first);
 h.focus(h.first);assert.equal(h.key('Tab',{shiftKey:true}),true);assert.equal(h.active,h.last);
 h.focus(h.middle);assert.equal(h.key('Tab'),false,'inside the list the browser moves the focus');
 h.focus(h.main);assert.equal(h.key('Tab'),true);assert.equal(h.active,h.first);
});

test('Tab is left alone when the drawer is closed or the screen is wide',()=>{
 const closed=setup();closed.focus(closed.last);assert.equal(closed.key('Tab'),false);
 const wide=setup({phone:false,wide:true});wide.S.setOpen(true);wide.focus(wide.last);assert.equal(wide.key('Tab'),false);
});

test('the focus returns to the control that opened the drawer, the top button or «Ещё»',()=>{
 const a=setup();a.focus(a.more);a.click({shell:'menu'});a.runTimers();assert.equal(a.active,a.first);
 a.click({shell:'close'});assert.equal(a.active,a.more,'back to «Ещё»');
 const b=setup();b.focus(b.toggle);b.click({shell:'menu'});b.runTimers();b.key('Escape');assert.equal(b.active,b.toggle);
 // An opener that has been drawn again falls back to the top button.
 const c=setup();c.focus(c.more);c.click({shell:'menu'});c.runTimers();c.more.isConnected=false;c.click({shell:'close'});assert.equal(c.active,c.toggle);
});

test('the compact menu: the button flips nc-nav-mini and html.nav-mini, keeps the focus, and names itself',()=>{
 const h=setup({wide:true});
 assert.ok(!h.classes.has('nav-mini'));
 h.click({shell:'mini'});
 assert.ok(h.classes.has('nav-mini'));assert.equal(h.map.get('nc-nav-mini'),'1');assert.equal(h.S.isMini(),true);
 assert.equal(h.mini.attrs['aria-pressed'],'true');assert.match(h.mini.attrs['aria-label'],/Развернуть/);assert.equal(h.mini.attrs.title,h.mini.attrs['aria-label']);
 assert.equal(h.active,h.mini);
 h.click({shell:'mini'});
 assert.ok(!h.classes.has('nav-mini'));assert.equal(h.map.get('nc-nav-mini'),'0');assert.match(h.mini.attrs['aria-label'],/Свернуть/);assert.equal(h.mini.attrs['aria-pressed'],'false');
});

test('the compact menu is remembered per device, and is not reported pressed on a narrow screen',()=>{
 const h=setup({wide:true,store:{'nc-nav-mini':'1'}});assert.ok(h.classes.has('nav-mini'));
 const narrow=setup({wide:false,store:{'nc-nav-mini':'1'}});narrow.S.sync();assert.equal(narrow.mini.attrs['aria-pressed'],'false');
 const off=setup({store:{'nc-nav-mini':'0'}});assert.ok(!off.classes.has('nav-mini'));
 const blocked=setup();assert.doesNotThrow(()=>blocked.S.setMini(true));
});

test('the drawer markup: names, a settings link, quick toggles and no long settings list',()=>{
 const app=read('app.js');
 const shell=app.slice(app.indexOf('function appShell('),app.indexOf('function appShell(')+9000);
 assert.match(shell,/<aside class="sidebar" id="app-sidebar" aria-label=/);
 assert.match(shell,/data-shell="mini"/);
 assert.match(shell,/class="drawer-quick" role="group"/);
 assert.match(shell,/data-action="navigate" data-view="settings"/);
 // The three quick toggles are theme, language and role; the look, install and browser notes moved to the settings page.
 assert.match(shell,/data-ui-theme=/);assert.match(shell,/data-action="lang" data-lang=/);assert.match(shell,/RoleMode\?\.switchHTML/);
 assert.doesNotMatch(shell,/data-ui-style=/);assert.doesNotMatch(shell,/data-shell="install"/);assert.doesNotMatch(shell,/class="status"/);
 // Each nav item carries a title, so it keeps a name when only its icon shows.
 assert.match(shell,/data-view="\$\{v\}" title="\$\{tr\(v\)\}"/);
 // A gear in the top bar opens the settings and has a name.
 assert.match(shell,/class="top-gear[^"]*"[^>]*data-view="settings"[^>]*aria-label=/);
});

test('the settings css hides the compact toggle below 1024 px and keeps names for screen readers when icons only',()=>{
 const css=read('settings.css');
 assert.match(css,/\.nav-mini-toggle \{ display: none; \}/);
 assert.match(css,/@media \(min-width: 1024px\)[\s\S]*html\.nav-mini \.sidebar \.nav-item \.nav-text \{ position: absolute; width: 1px/);
 assert.match(css,/\.top-gear \{[^}]*width: 44px; height: 44px/);
 assert.match(css,/\.set-seg button \{[^}]*min-height: 44px/);
 assert.match(css,/@media \(max-width: 820px\) \{ \.drawer-seg button \{ min-height: 44px/);
});

test('on phones the toggles block sticks to the bottom of the open menu and every tap target is 44 px',()=>{
 const css=read('settings.css');
 assert.match(css,/\.sidebar \.sidebar-bottom \{[^}]*position: sticky; bottom:/);
 assert.match(css,/html \.sidebar \.nav-item[^{]*\{ min-height: 44px; \}/);
 assert.match(css,/html \.menu-toggle, html\.ui-native \.menu-toggle \{ width: 44px; height: 44px; \}/);
 assert.match(css,/html \.lang-switch button[^{]*\{ min-width: 44px; min-height: 44px; \}/);
 assert.match(css,/html\.ui-native\.ui-board \.set-page \.btn[^{]*\{ min-height: 44px; \}/);
});
