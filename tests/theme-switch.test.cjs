'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const site=f=>fs.readFileSync(path.join(__dirname,'../site',f),'utf8');
function setup({stored,native=true,prefersLight=false}={}){
 const store=new Map(stored===undefined?[]:[['nc-ui-theme',stored]]);
 const classes=new Set(native?['ui-native']:[]);
 const meta={content:'#11110f',setAttribute(k,v){this.content=v}};
 const buttons=['auto','dark','light'].map(v=>{const cl=new Set();return {dataset:{uiTheme:v},classList:{toggle(n,on){on?cl.add(n):cl.delete(n)},has:n=>cl.has(n)},attrs:{},setAttribute(k,v2){this.attrs[k]=v2},closest(s){return s==='[data-ui-theme]'?this:null}}});
 const listeners={};
 const document={readyState:'complete',documentElement:{classList:{contains:n=>classes.has(n),toggle(n,on){on?classes.add(n):classes.delete(n)}}},querySelector:s=>s==='meta[name="theme-color"]'?meta:null,querySelectorAll:s=>s==='[data-ui-theme]'?buttons:[],addEventListener:(t,f)=>{listeners[t]=f}};
 const mq={matches:prefersLight,addEventListener(t,f){mq.cb=f}};
 const window={document,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v))},matchMedia:()=>mq,requestAnimationFrame:f=>f(),setTimeout:f=>f()};
 vm.runInNewContext(site('theme-switch.js'),{window,MutationObserver:class{observe(){}}});
 return {window,store,classes,meta,buttons,listeners,mq};
}
const click=(env,b)=>env.listeners.click({target:b});

test('every theme button rendered by app.js is a handled mode',()=>{
 const values=[...site('app.js').matchAll(/data-ui-theme="([a-z]+)"/g)].map(m=>m[1]);
 assert.deepEqual([...new Set(values)].sort(),['auto','dark','light']);
 const env=setup();
 for(const v of values)assert.ok(env.window.ThemeSwitch.MODES.includes(v),v);
 assert.equal(env.window.ThemeSwitch.set('sepia'),false);
});
test('clicking a button stores the value and round-trips',()=>{
 for(const mode of ['light','dark','auto']){
  const env=setup();
  click(env,env.buttons.find(b=>b.dataset.uiTheme===mode));
  assert.equal(env.store.get('nc-ui-theme'),mode);
  assert.equal(env.window.ThemeSwitch.get(),mode);
  const fresh=setup({stored:env.store.get('nc-ui-theme')});
  assert.equal(fresh.window.ThemeSwitch.get(),mode);
 }
});
test('light class follows the mode, the clean look and the OS preference',()=>{
 let env=setup({stored:'light'});assert.equal(env.classes.has('ui-light'),true);assert.equal(env.meta.content,'#f2f2f4');
 env=setup({stored:'dark',prefersLight:true});assert.equal(env.classes.has('ui-light'),false);assert.equal(env.meta.content,'#11110f');
 env=setup({stored:'auto',prefersLight:true});assert.equal(env.classes.has('ui-light'),true);
 env=setup({stored:'auto',prefersLight:false});assert.equal(env.classes.has('ui-light'),false);
 env=setup({stored:'light',native:false});assert.equal(env.classes.has('ui-light'),false,'cyberpunk look stays dark');
 env=setup({stored:'bogus'});assert.equal(env.window.ThemeSwitch.get(),'auto');
});
test('active button is marked and auto reacts to OS changes',()=>{
 const env=setup({stored:'auto'});
 assert.equal(env.buttons[0].attrs['aria-pressed'],'true');assert.equal(env.buttons[2].attrs['aria-pressed'],'false');
 env.mq.matches=true;env.mq.cb();assert.equal(env.classes.has('ui-light'),true);
 click(env,env.buttons[1]);assert.equal(env.classes.has('ui-light'),false);assert.equal(env.buttons[1].attrs['aria-pressed'],'true');
 env.mq.matches=false;env.mq.matches=true;env.mq.cb();assert.equal(env.classes.has('ui-light'),false,'explicit dark ignores OS');
});
test('index.html loads theme-switch.js before app.js and light.css after native.css',()=>{
 const html=site('index.html');
 assert(html.indexOf('theme-switch.js')>0&&html.indexOf('theme-switch.js')<html.indexOf('src="app.js'));
 assert(html.indexOf('light.css')>html.indexOf('native.css'));
});
