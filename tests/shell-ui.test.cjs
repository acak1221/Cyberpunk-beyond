// The phone drawer: the page under it is inert while it is open, the focus goes in and comes back, and a redraw keeps that state.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../site/shell-ui.js','utf8');
function setup(){
 const classes=new Set(),timers=[],listeners={},winListeners={};let active=null;
 const el=name=>({name,inert:false,attrs:{},focused:0,setAttribute(k,v){this.attrs[k]=v},focus(){this.focused++;active=this},contains(x){return x===this||this.kids?.includes(x)},scrollIntoView(){this.scrolled=true}});
 const page={content:el('content'),context:el('context'),actions:el('actions'),toggle:el('toggle'),nav:el('nav'),sidebar:el('sidebar'),main:el('main')};
 page.sidebar.kids=[page.nav];
 const document={documentElement:{classList:{contains:c=>classes.has(c),toggle(c,on){on?classes.add(c):classes.delete(c)}}},get activeElement(){return active},
  querySelectorAll:s=>s==='[data-shell="menu"]'?[page.toggle]:s.includes('.content')?[page.content,page.context,page.actions]:[],
  querySelector:s=>s==='#app-sidebar'?page.sidebar:s==='.menu-toggle'?page.toggle:s==='#main-content'?page.main:s.startsWith('#app-sidebar .nav-item')?page.nav:null,
  addEventListener(type,fn,capture){(listeners[type+(capture?':capture':'')]||=[]).push(fn)}};
 const window={document,addEventListener(type,fn){winListeners[type]=fn},matchMedia:()=>({addEventListener(){}})};
 vm.runInNewContext(source,{window,setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout:id=>{if(timers[id-1])timers[id-1].fn=()=>{}}});
 const click=dataset=>{const target={dataset};let prevented=false;for(const fn of listeners['click:capture'])fn({target:{closest:()=>target},preventDefault(){prevented=true}});return prevented};
 const key=k=>{for(const fn of listeners.keydown)fn({key:k})};
 return {S:window.ShellUI,page,classes,timers,click,key,runTimers(){for(const t of timers.splice(0))t.fn()},focus(x){active=x},get active(){return active},winListeners};
}

test('opening makes the page behind the drawer inert and marks the button as expanded',()=>{
 const h=setup();h.click({shell:'menu'});
 assert.ok(h.classes.has('nav-open'));
 assert.deepEqual([h.page.content.inert,h.page.context.inert,h.page.actions.inert],[true,true,true]);
 assert.equal(h.page.toggle.attrs['aria-expanded'],'true');
});

test('the focus enters the drawer only after the slide has finished',()=>{
 const h=setup();h.click({shell:'menu'});
 assert.equal(h.page.nav.focused,0);assert.equal(h.timers[0].ms,260);
 h.runTimers();assert.equal(h.page.nav.focused,1);
});

test('closing before the slide ends does not pull the focus into a hidden drawer',()=>{
 const h=setup();h.click({shell:'menu'});h.click({shell:'close'});h.runTimers();
 assert.equal(h.page.nav.focused,0);assert.equal(h.page.content.inert,false);
});

test('closing frees the page and returns the focus to the menu button',()=>{
 const h=setup();h.click({shell:'menu'});h.runTimers();
 h.click({shell:'close'});
 assert.ok(!h.classes.has('nav-open'));assert.equal(h.page.content.inert,false);
 assert.equal(h.page.toggle.attrs['aria-expanded'],'false');assert.equal(h.active,h.page.toggle);
});

test('closing does not steal the focus when it is not inside the drawer',()=>{
 const h=setup();h.click({shell:'menu'});h.focus(h.page.main);
 h.S.setOpen(false);assert.equal(h.active,h.page.main);assert.equal(h.page.toggle.focused,0);
});

test('Escape closes the drawer and returns the focus',()=>{
 const h=setup();h.click({shell:'menu'});h.runTimers();h.key('Escape');
 assert.ok(!h.classes.has('nav-open'));assert.equal(h.page.content.inert,false);assert.equal(h.active,h.page.toggle);
});

test('choosing a section closes the drawer',()=>{
 const h=setup();h.click({shell:'menu'});h.click({action:'navigate',view:'dice'});
 assert.ok(!h.classes.has('nav-open'));assert.equal(h.page.content.inert,false);
});

test('a redraw while the drawer is open keeps the new page inert and the button expanded',()=>{
 const h=setup();h.click({shell:'menu'});
 // the page was rebuilt: fresh elements with default state
 h.page.content.inert=false;h.page.context.inert=false;h.page.toggle.attrs={};
 h.S.sync();
 assert.equal(h.page.content.inert,true);assert.equal(h.page.context.inert,true);assert.equal(h.page.toggle.attrs['aria-expanded'],'true');
});

test('a redraw with the drawer closed leaves the page usable',()=>{
 const h=setup();h.S.sync();
 assert.equal(h.page.content.inert,false);assert.equal(h.page.toggle.attrs['aria-expanded'],'false');
});

test('«К содержимому» moves the focus to the content and scrolls to it',()=>{
 const h=setup();h.click({shell:'skip'});
 assert.equal(h.active,h.page.main);assert.ok(h.page.main.scrolled);
});

test('going back in history closes the drawer',()=>{
 const h=setup();h.click({shell:'menu'});h.winListeners.popstate();
 assert.ok(!h.classes.has('nav-open'));assert.equal(h.page.content.inert,false);
});
