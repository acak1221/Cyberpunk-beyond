const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=f=>fs.readFileSync(__dirname+'/../site/'+f,'utf8');
function load({wakeLock=true,stored=null,visibility='visible',fail=false}={}){
 const listeners={},store=new Map(stored===null?[]:[['nc-keep-awake',stored]]),locks=[],buttons=[];
 const document={visibilityState:visibility,addEventListener:(type,fn)=>{listeners[type]=fn},querySelectorAll:()=>buttons};
 const navigator=wakeLock?{wakeLock:{request:async kind=>{if(fail)throw new Error('denied');const lock={kind,released:false,release:async()=>{lock.released=true},addEventListener(){}};locks.push(lock);return lock}}}:{};
 const window={document,navigator,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v))}};
 vm.runInNewContext(source('keep-awake.js'),{window,Promise});
 return {K:window.KeepAwake,document,listeners,store,locks,buttons};
}
const settle=()=>new Promise(r=>setImmediate(r));

test('the button is offered only where the browser can hold a wake lock',()=>{
 assert.equal(load({wakeLock:false}).K.button('ru'),'');
 const {K}=load();
 assert.match(K.button('ru'),/data-keep-awake aria-pressed="false"[^>]*>.*Не гасить экран/);
 assert.match(K.button('en'),/Keep the screen on/);
 assert.match(K.button('ru',true),/class="hud-chip hud-awake" data-keep-awake aria-pressed="false" aria-label="Не гасить экран"/);
});

test('switching on takes the lock and remembers the choice; switching off releases it',async()=>{
 const h=load();
 assert.equal(await h.K.set(true),true);
 assert.equal(h.locks.length,1);assert.equal(h.locks[0].kind,'screen');assert.equal(h.K.held(),true);assert.equal(h.store.get('nc-keep-awake'),'1');
 await h.K.set(false);await settle();
 assert.equal(h.locks[0].released,true);assert.equal(h.K.held(),false);assert.equal(h.store.get('nc-keep-awake'),'0');
});

test('a remembered choice takes the lock on load, and again when the tab comes back',async()=>{
 const h=load({stored:'1'});await settle();
 assert.equal(h.K.wanted(),true);assert.equal(h.locks.length,1);
 h.locks[0].released=true;h.document.visibilityState='hidden';h.listeners.visibilitychange();await settle();
 assert.equal(h.locks.length,1,'nothing is requested while hidden');
 // The browser dropped the lock when the tab was hidden.
 await h.K.set(false);await h.K.set(true);await settle();
 assert.equal(h.locks.length,1,'still hidden: no request');
 h.document.visibilityState='visible';h.listeners.visibilitychange();await settle();
 assert.equal(h.locks.length,2);assert.equal(h.K.held(),true);
});

test('a refused lock leaves the app working and the choice stored',async()=>{
 const h=load({fail:true});
 assert.equal(await h.K.set(true),false);
 assert.equal(h.K.held(),false);assert.equal(h.K.wanted(),true);
});

test('pressing any keep-awake button toggles, and every button shows the state',async()=>{
 const h=load(),make=()=>{const attrs={},classes=new Set();return {attrs,classes,setAttribute:(k,v)=>{attrs[k]=v},classList:{toggle:(c,on)=>on?classes.add(c):classes.delete(c)}}};
 h.buttons.push(make(),make());
 h.listeners.click({target:{closest:s=>s==='[data-keep-awake]'?{}:null}});await settle();
 assert.equal(h.K.wanted(),true);for(const b of h.buttons){assert.equal(b.attrs['aria-pressed'],'true');assert.ok(b.classes.has('active'))}
 h.listeners.click({target:{closest:()=>null}});await settle();assert.equal(h.K.wanted(),true,'other clicks change nothing');
});

test('the sheet and the dice page offer it, and the script is loaded before the sheet tabs',()=>{
 assert.match(source('index.html'),/<script src="keep-awake\.js"><\/script><script src="sheet-tabs\.js">/);
 assert.match(source('sheet-tabs.js'),/KeepAwake\?\.button\?\.\(lang\(\),true\)/);
 assert.match(source('app.js'),/KeepAwake\?\.button\?\.\(state\.lang\)/);
});

test('a sheet leads to the catalog and to the Lifepath generator with the character set',()=>{
 const app=source('app.js'),tabs=source('sheet-tabs.js'),life=source('lifepath.js'),sheet=source('character-extra.js');
 assert.match(app,/shopFor\(id,opts\)\{if\(!state\.characters\.some\(c=>c\.id===id\)\)return false;state\.catalogTarget=id;[^]{0,400}state\.view='catalog'/);
 assert.match(app,/lifepathFor\(id\)\{const c=state\.characters\.find\(x=>x\.id===id\);if\(!c\)return false;window\.Lifepath\?\.setTarget\?\.\(c\.id,c\.role\)/);
 assert.match(app,/state\.catalogTarget=state\.characters\.length===1\?state\.characters\[0\]\.id:/,'a single character is the buyer without asking');
 assert.match(tabs,/data-sheet-shop/);assert.match(tabs,/App\?\.shopFor\?\./);assert.match(tabs,/App\?\.lifepathFor\?\./);
 assert.match(sheet,/data-sheet-lifepath/);
 assert.match(life,/function setTarget\(id,role\)\{const value=typeof id==='string'\?id:'';api\.setGeneralTarget\(value\);rs\.target=value;if\(roles\[role\]\)rs\.role=role\}/);
});

test('the skills step of the wizard has a sticky counter, steppers and search',()=>{
 const builder=source('builder.js'),css=source('builder.css');
 assert.match(builder,/class="builder-meter builder-meter-sticky"/);assert.match(css,/\.builder-meter-sticky \{position:sticky;top:0;/);
 assert.match(builder,/data-builder-bump="-1"/);assert.match(builder,/data-builder-bump="1"/);
 assert.doesNotMatch(builder,/data-builder-step="-1"/,'the steppers must not share the attribute of the step navigation');
 assert.match(builder,/Math\.max\(0,Math\.min\(6,now\+/,'the same 0–6 limits as the field (p. 85)');
 assert.match(builder,/data-builder-skill-search/);assert.match(builder,/data-builder-skill-row=/);
});
