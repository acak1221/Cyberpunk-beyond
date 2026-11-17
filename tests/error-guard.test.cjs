// The error guard: a non-blocking, bilingual banner, a log of the last 20 messages in memory, and diagnostics to copy.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'..','site','error-guard.js'),'utf8');

function node(tag){
 const n={tag,attrs:{},children:[],listeners:{},hidden:false,textContent:'',isConnected:false,style:{},
  setAttribute(k,v){this.attrs[k]=String(v)},getAttribute(k){return this.attrs[k]??null},
  append(...k){for(const c of k){this.children.push(c);c.parent=this}},appendChild(c){this.append(c);c.isConnected=this.isConnected;return c},
  remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)},
  addEventListener(t,f){(this.listeners[t]||=[]).push(f)},contains(x){return x===this||this.children.some(c=>c.contains?.(x))},
  querySelector(s){const all=[];const walk=x=>{for(const c of x.children){all.push(c);walk(c)}};walk(this);
   if(s==='textarea')return all.find(c=>c.tag==='textarea')||null;
   const m=s.match(/^\[([a-z-]+)\]$/);if(m)return all.find(c=>m[1] in c.attrs)||null;return null},
  select(){},focus(){this.focused=true}};
 return n;
}
function load({lang='ru',clipboard,build='b1'}={}){
 const listeners={},body=node('body');body.isConnected=true;
 const head=node('head');
 const document={documentElement:{lang,dataset:{build}},body,head,activeElement:null,createElement:node,getElementById:id=>[...head.children].find(c=>c.attrs.id===id)||null,querySelector:s=>s==='#main-content'?{focus(){this.focused=true}}:null,execCommand:()=>false};
 const reloads=[];
 const window={document,addEventListener:(t,f)=>{(listeners[t]||=[]).push(f)},location:{hash:'#/sheet/secret-id-123',reload:()=>reloads.push(1)},navigator:{userAgent:'UA/1',language:'ru-RU',onLine:true,...(clipboard?{clipboard}:{})}};
 vm.runInNewContext(code,{window,Date,Math,Number,String,Object,Promise});
 return {G:window.ErrorGuard,body,head,reloads,document,
  error:e=>{for(const f of listeners.error)f(e)},reject:e=>{for(const f of listeners.unhandledrejection)f(e)}};
}
const banner=h=>h.body.children.find(c=>c.attrs.id==='nc-error-guard');
const button=(b,what)=>b.children.flatMap(c=>c.children).find(c=>c.attrs['data-ncg']===what);
const press=async(b,what)=>{const btn=button(b,what);for(const f of b.listeners.click)await f({target:{closest:s=>s==='[data-ncg]'?{getAttribute:()=>what}:null}});return btn};

test('a script error shows one banner with the data-is-saved message and three buttons',()=>{
 const h=load();h.error({message:'boom',filename:'app.js',lineno:7});
 const b=banner(h);assert.ok(b);
 assert.equal(b.attrs.role,'alert');
 assert.match(b.children[0].textContent,/Ваши данные сохранены/);
 assert.deepEqual(b.children[1].children.map(c=>c.attrs['data-ncg']),['reload','copy','close']);
 for(const btn of b.children[1].children)assert.equal(btn.attrs.type,'button');
 h.error({message:'again',filename:'app.js',lineno:8});
 assert.equal(h.body.children.filter(c=>c.attrs.id==='nc-error-guard').length,1,'still one banner');
});

test('the banner speaks the language of the page',()=>{
 const h=load({lang:'en'});h.reject({reason:new Error('nope')});
 assert.match(banner(h).children[0].textContent,/Your data is saved/);
 assert.equal(button(banner(h),'reload').textContent,'Reload');
});

test('a rejected promise is caught with its name and message',()=>{
 const h=load();h.reject({reason:{name:'TypeError',message:'x is not a function'}});
 const [e]=h.G.log();assert.equal(e.kind,'promise');assert.equal(e.message,'TypeError: x is not a function');
 h.reject({reason:'plain text'});assert.equal(h.G.log()[1].message,'plain text');
});

test('only the last 20 messages are kept, in memory',()=>{
 const h=load();for(let i=0;i<30;i++)h.error({message:'m'+i});
 const log=h.G.log();assert.equal(log.length,20);assert.equal(log[0].message,'m10');assert.equal(log[19].message,'m29');
 assert.equal(h.G.MAX_LOG,20);
 log.push({});assert.equal(h.G.log().length,20,'the copy handed out is not the log');
 assert.doesNotMatch(code,/localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|sendBeacon/);
});

test('long messages are cut, and extension errors and the layout notice are ignored',()=>{
 const h=load();h.error({message:'x'.repeat(2000)});assert.ok(h.G.log()[0].message.length<=300);
 const g=load();
 g.error({message:'oops',filename:'chrome-extension://abc/x.js'});g.error({message:'ResizeObserver loop completed with undelivered notifications.'});
 assert.equal(g.G.log().length,0);assert.equal(banner(g),undefined);
});

test('a failed image or stylesheet (an event with a target and no message) is not an app error',()=>{
 const h=load();h.error({target:{tagName:'IMG'}});
 assert.equal(h.G.log().length,0);assert.equal(banner(h),undefined);
});

test('a repeated error counts up in the banner instead of stacking banners',()=>{
 const h=load();h.error({message:'same'});h.error({message:'same'});h.error({message:'same'});
 const note=banner(h).children.find(c=>'data-ncg-repeat' in c.attrs);
 assert.equal(note.hidden,false);assert.match(note.textContent,/3/);
});

test('diagnostics hold the build, the browser and the messages, and cut the address after the section name',()=>{
 const h=load();h.error({message:'boom',filename:'app.js',lineno:7});
 const d=h.G.diagnostics(Date.UTC(2026,0,2,3,4,5));
 assert.match(d,/build: b1/);assert.match(d,/agent: UA\/1/);assert.match(d,/2026-01-02T03:04:05\.000Z/);assert.match(d,/error: boom @ app\.js:7/);
 assert.match(d,/view: #\/sheet(?!\/)/);assert.ok(!d.includes('secret-id-123'),'no sheet id leaves the page');
 assert.match(load().G.diagnostics(),/no errors recorded/);
});

test('copy puts the diagnostics on the clipboard; without a clipboard it shows them to select by hand',async()=>{
 let copied='';
 const h=load({clipboard:{writeText:async t=>{copied=t}}});h.error({message:'boom'});
 await press(banner(h),'copy');
 assert.match(copied,/boom/);assert.match(banner(h).children.find(c=>'data-ncg-status' in c.attrs).textContent,/скопированы/);
 const g=load();g.error({message:'boom'});await press(banner(g),'copy');
 const ta=banner(g).querySelector('textarea');assert.ok(ta);assert.match(ta.value,/boom/);assert.equal(ta.attrs.readonly,'');
 assert.match(banner(g).children.find(c=>'data-ncg-status' in c.attrs).textContent,/вручную/);
});

test('reload reloads, and close removes the banner without stealing or dropping the focus',async()=>{
 const h=load();h.error({message:'boom'});
 await press(banner(h),'reload');assert.equal(h.reloads.length,1);
 await press(banner(h),'close');assert.equal(banner(h),undefined);
 // A later error brings the banner back.
 h.error({message:'next'});assert.ok(banner(h));
 // Showing the banner never moves the focus.
 assert.ok(!h.body.focused&&!banner(h).focused);
});

test('the guard never throws out of its own handlers',()=>{
 const h=load();
 assert.doesNotThrow(()=>{h.error(undefined);h.error({});h.reject(undefined);h.reject({})});
 const noBody=load();noBody.document.body=null;assert.doesNotThrow(()=>noBody.error({message:'x'}));
});

test('it is the first script of the page and a reachable file',()=>{
 const index=fs.readFileSync(path.join(__dirname,'..','site','index.html'),'utf8');
 const scripts=[...index.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(scripts[0],'error-guard.js');assert.equal(scripts.at(-1),'app.js');
 assert.doesNotMatch(code,/\r/);
});

test('when the store reports a failed save or paused editing the banner does not promise that data is saved',()=>{
 const h=load();
 let status='СОХРАНЕНО В БРАУЗЕРЕ';
 h.document.querySelector=s=>s==='#store-status'?{textContent:status}:s==='#main-content'?{focus(){}}:null;
 assert.equal(h.G.saveProblem(),false);
 status='ОШИБКА СОХРАНЕНИЯ';assert.equal(h.G.saveProblem(),true);
 h.error({message:'boom',filename:'a.js',lineno:1});
 const t=banner(h).children[0].textContent;
 assert.doesNotMatch(t,/данные сохранены/);assert.match(t,/могут быть не сохранены/);
 h.G._test.reset();status='EDITING PAUSED';
 h.error({message:'boom2',filename:'a.js',lineno:1});
 assert.match(banner(h).children[0].textContent,/могут быть не сохранены/);
});
