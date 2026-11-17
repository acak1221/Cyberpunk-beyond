const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const site=path.join(__dirname,'..','site'),src=f=>fs.readFileSync(path.join(site,f),'utf8');
const SOURCE=src('lazy-chunks.js');

// A page with a manifest, a recorder for the scripts it is asked to load, and a stand-in for App.
function page(manifest,{view='book',inApp=true}={}){
 const added=[],listeners={},calls={render:0};
 const doc={head:{appendChild:s=>{added.push(s);s.remove=()=>{s.removed=true}}},createElement:()=>({}),body:{},documentElement:{},
  activeElement:null,querySelector:()=>null,addEventListener:(t,fn)=>{listeners[t]=fn}};
 const ctx={document:doc,console,NC_CHUNKS:manifest};
 ctx.window=ctx;
 if(inApp)ctx.App={getState:()=>({view:ctx.__view||view}),render:()=>{calls.render++}};
 vm.createContext(ctx);vm.runInContext(SOURCE,ctx);
 return {ctx,added,listeners,calls,lazy:ctx.NCLazy};
}
const M={book:{u:'nc-book.js?v=abc',p:'Book',v:['book']},shop:{u:'nc-shop.js?v=abc',p:'ShopCart',v:['catalog']}};

test('without the chunk list (development, tests) nothing is pending and callbacks run at once',()=>{
 const {lazy,added}=page(undefined);
 assert.equal(lazy.pending('book',()=>{},'ru'),'');
 let ran=0;lazy.after('book',()=>{ran++});assert.equal(ran,1);
 assert.equal(added.length,0);
 assert.deepEqual([...lazy.missing('book')],[]);
});

test('a screen that needs a chunk shows a status card, asks for the file once, and is redrawn when it has run',async()=>{
 const {lazy,added,ctx}=page(M);
 let redraws=0;const redraw=()=>{redraws++};
 const html=lazy.pending('book',redraw,'ru');
 assert.match(html,/role="status"/);assert.match(html,/<h1[^>]*>Загрузка раздела…<\/h1>/);
 assert.equal(added.length,1);assert.equal(added[0].src,'nc-book.js?v=abc');assert.equal(added[0].async,true);
 // drawing again while it loads asks for nothing more and does not stack a second redraw
 assert.match(lazy.pending('book',redraw,'en'),/Loading the section…/);
 assert.equal(added.length,1);
 let order=[];lazy.after('book',()=>order.push('after'));
 const wasRedraw=redraw;
 ctx.Book={};added[0].onload();
 await new Promise(r=>setImmediate(r));
 assert.equal(redraws,1,'one redraw');assert.deepEqual(order,['after'],'queued callbacks ran');
 assert.equal(lazy.pending('book',redraw,'ru'),'','the screen is let through now');
 assert.equal(added.length,1);
 assert.deepEqual([...lazy.missing('catalog')],['shop'],'another screen still needs its own chunk');
 assert.deepEqual([...lazy.missing('overview')],[]);
});

test('callbacks run before the redraw, so a page number set for the book is in place when the book is drawn',async()=>{
 const {lazy,added,ctx}=page(M);const seen=[];
 lazy.after('book',()=>seen.push('go'));
 lazy.pending('book',()=>seen.push('render'),'ru');
 assert.equal(added.length,1,'one file for both');
 ctx.Book={};added[0].onload();
 await new Promise(r=>setImmediate(r));
 assert.deepEqual(seen,['go','render']);
});

test('someone who has moved on is not redrawn: a redraw would reset what they type',async()=>{
 const {lazy,added,ctx}=page(M);let redraws=0;
 lazy.pending('book',()=>{redraws++},'ru');
 ctx.__view='sheet';ctx.Book={};added[0].onload();
 await new Promise(r=>setImmediate(r));
 assert.equal(redraws,0);
});

test('when the file cannot be loaded the card says so in both languages and offers a retry that asks again',async()=>{
 const {lazy,added,ctx,listeners,calls}=page(M);let redraws=0;
 lazy.pending('book',()=>{redraws++},'en');
 added[0].onerror();await new Promise(r=>setImmediate(r));
 assert.equal(redraws,1);assert.equal(added[0].removed,true);
 const en=lazy.pending('book',()=>{},'en'),ru=lazy.pending('book',()=>{},'ru');
 assert.match(en,/role="alert"/);assert.match(en,/could not be loaded/);assert.match(en,/data-lazy-retry/);assert.match(en,/Try again/);
 assert.match(ru,/Не удалось загрузить раздел/);assert.match(ru,/Повторить/);
 assert.equal(added.length,1,'no request storm: a failed chunk waits for the button');
 // the button: clears the failure and draws again, which asks for the file a second time
 listeners.click({target:{closest:sel=>sel==='[data-lazy-retry]'?{}:null},preventDefault(){}});
 assert.equal(calls.render,1);
 assert.match(lazy.pending('book',()=>{},'ru'),/role="status"/);assert.equal(added.length,2);
 ctx.Book={};added[1].onload();await new Promise(r=>setImmediate(r));
 assert.equal(lazy.pending('book',()=>{},'ru'),'');
});

test('a chunk that is already there (its global exists) is never requested again',()=>{
 const {lazy,added,ctx}=page(M);
 ctx.ShopCart={};
 assert.equal(lazy.pending('catalog',()=>{},'ru'),'');assert.equal(added.length,0);
 assert.equal(lazy.has('shop'),true);assert.equal(lazy.has('nope'),true);
});

test('texts are escaped and both languages have every string',()=>{
 const {lazy}=page(M);
 assert.deepEqual(Object.keys(lazy.T.ru).sort(),Object.keys(lazy.T.en).sort());
 for(const l of ['ru','en'])for(const v of Object.values(lazy.T[l]))assert.ok(v.length>3);
 assert.ok(!/formal|ты /.test(JSON.stringify(lazy.T.ru)),'no informal address');
});

// ---- The configuration: the build's list of lazy chunks against the sources ----------------------------------------
test('the chunk list names real scripts, real screens and a global each chunk defines', async()=>{
 const {CHUNKS}=await import('../scripts/chunks.mjs');
 const index=src('index.html'),scripts=[...index.matchAll(/<script src="([^":?]+\.js)"><\/script>/g)].map(m=>m[1]);
 const views=[...src('app.js').match(/VIEWS=new Set\((\[[^\]]*\])\)/)[1].matchAll(/'([\w-]+)'/g)].map(m=>m[1]);
 const seen=new Set();
 for(const [name,c] of Object.entries(CHUNKS)){
  assert.match(name,/^[a-z][a-z0-9-]*$/);
  assert.ok(c.files.length&&c.views.length,name);
  for(const f of c.files){assert.ok(scripts.includes(f),`${name}: ${f} is in index.html`);assert.notEqual(f,'app.js');assert.ok(!seen.has(f),`${f} is in one chunk only`);seen.add(f)}
  for(const v of c.views)assert.ok(views.includes(v),`${name}: ${v} is a screen`);
  assert.ok(c.files.some(f=>new RegExp(`\\b(?:window|global|root)\\.${c.probe}\\s*=(?!=)`).test(src(f))),`${name} defines ${c.probe}`);
 }
 // lazy-chunks.js and app.js themselves are in the core file, loaded before any chunk can be asked for
 assert.ok(scripts.includes('lazy-chunks.js')&&scripts.indexOf('lazy-chunks.js')<scripts.indexOf('app.js'));
});

// What may reach into a lazy chunk from outside it. Everything not listed here must not mention the chunk's globals:
// a new use in the core file would silently do nothing until the screen has been opened. Each exception is on purpose.
const OUTSIDE_OK={
 'shop':{'catalog.js':'shows the cart button only when ShopCart exists and works without it'},
 'combat-calc':{'combat-dock.js':'asks for the calculators by name while it draws the combat screen, which loads the chunk first'},
};
test('nothing outside a lazy chunk uses what it defines, except the documented, harmless cases',async()=>{
 const {CHUNKS}=await import('../scripts/chunks.mjs');
 const scripts=[...src('index.html').matchAll(/<script src="([^":?]+\.js)"><\/script>/g)].map(m=>m[1]);
 for(const [name,c] of Object.entries(CHUNKS)){
  const globals=new Set();
  for(const f of c.files)for(const m of src(f).matchAll(/\b(?:window|global|root)\.([A-Z][A-Za-z0-9_$]*)\s*=(?!=)/g))globals.add(m[1]);
  assert.ok(globals.size,name);
  for(const f of scripts){
   if(c.files.includes(f)||f==='app.js')continue;
   const code=src(f).replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:])\/\/[^\n]*/g,'$1');
   for(const g of globals){
    // a property access on the global object, or the name in a string handed to a lookup (mod: 'X', call('X'))
    const used=new RegExp(`(?:(?:window|global|root|globalThis|self)\\.${g}\\b|(?:mod\\s*:\\s*|call\\(\\s*)['"]${g}['"])`).test(code);
    if(used)assert.ok(OUTSIDE_OK[name]?.[f],`${f} uses ${g}, which only loads with the ${name} chunk: either move ${f} into the chunk, or document why it is harmless (OUTSIDE_OK) after checking it works without ${g}`);
   }
  }
 }
});

test('app.js reaches the lazy chunks only through the loader or behind the screen that loads them',()=>{
 const app=src('app.js');
 assert.match(app,/window\.NCLazy\?\.pending\?\.\(state\.view,render,state\.lang\)\|\|\(state\.view==='room'/,'the screen switch asks the loader first');
 assert.match(app,/NCLazy\.after\('book',openBook\)/,'the «open page» action waits for the book chunk');
 // the click and key handlers that may meet a missing chunk all test for it
 assert.match(app,/function handleBuilder\(e\)\{if\(state\.view!=='builder'\|\|!window\.Builder\)return false/);
 assert.match(app,/handleBookBookmarks\(e\)\{if\(state\.view!=='book'\|\|!window\.BookBookmarks\)return false/);
 assert.match(app,/if\(state\.view==='book'\)window\.BookSearch\?\.handle/);
});

test('the placeholder card has a stylesheet that keeps the retry button at 44 px',()=>{
 const css=src('lazy-chunks.css'),index=src('index.html');
 assert.match(css,/\.nc-lazy button\s*\{[^}]*min-height:\s*44px/);
 assert.match(css,/prefers-reduced-motion/);
 assert.ok(index.includes('href="lazy-chunks.css"')&&index.indexOf('lazy-chunks.css')<index.indexOf('touch-targets.css'),'touch-targets.css stays last');
});

test('the failure card also offers a reload, for a page left open across an update (its files are gone)',async()=>{
 const {lazy,added,listeners,ctx}=page(M);let reloaded=0;ctx.location={reload:()=>{reloaded++}};
 lazy.pending('book',()=>{},'ru');added[0].onerror();
 await new Promise(r=>setImmediate(r));
 assert.match(lazy.pending('book',()=>{},'ru'),/data-lazy-reload[^>]*>Обновить страницу/);
 assert.match(lazy.pending('book',()=>{},'en'),/data-lazy-reload[^>]*>Reload the page/);
 listeners.click({target:{closest:sel=>sel==='[data-lazy-reload]'?{}:null},preventDefault(){}});
 assert.equal(reloaded,1);
 assert.equal(added.length,1,'a reload is not a retry');
});

// A lazy screen is drawn a moment after it is opened. Code that opens a screen with setView()/navigate() and goes on to
// read or press something on it in the same breath (Home.nextTurn does that with the campaigns screen) would find only
// the placeholder, so no script outside app.js may open a lazy screen by name and then use its DOM.
test('no script opens a lazy screen by name and expects it to be drawn at once',async()=>{
 const {CHUNKS}=await import('../scripts/chunks.mjs');
 const scripts=[...src('index.html').matchAll(/<script src="([^":?]+\.js)"><\/script>/g)].map(m=>m[1]).filter(f=>f!=='app.js');
 const lazyViews=new Set(Object.values(CHUNKS).flatMap(c=>c.views));
 assert.ok(lazyViews.size>=4);
 for(const f of scripts){
  const code=src(f);
  for(const v of lazyViews){
   assert.ok(!new RegExp(`\\.(?:setView|navigate)\\(\\s*['"]${v}['"]`).test(code),`${f} opens the «${v}» screen by name; that screen loads lazily, so what the code does next on it would find only the placeholder. Wait for it (NCLazy.after), or keep the screen's chunk out of scripts/chunks.mjs`);
  }
 }
});

test('the campaigns screen is not lazy: Home opens it and presses «next turn» at once',async()=>{
 const {CHUNKS}=await import('../scripts/chunks.mjs');
 for(const c of Object.values(CHUNKS))assert.ok(!c.views.includes('campaigns'));
 assert.match(src('home.js'),/A\.setView\('campaigns'\);\s*\n\s*const b=doc\?\.querySelector\?\.\('\[data-campaign-action="next"\]'\)/);
});

// A call such as window.Builder.startNew( with no «?.» throws when the chunk is not loaded. Every such call in app.js has to sit
// behind a test of the screen, a test of the global itself, or the loader's after(). (Found by the Continue-draft button of the
// Characters page, which is not a builder screen.)
test('app.js never calls a lazy chunk global bare unless a screen test, an existence test or NCLazy.after is just before it',async()=>{
 const {CHUNKS}=await import('../scripts/chunks.mjs');
 const app=src('app.js'),bad=[];
 for(const [name,c] of Object.entries(CHUNKS)){
  const globals=new Set();
  for(const f of c.files)for(const m of src(f).matchAll(/\b(?:window|global|root)\.([A-Z][A-Za-z0-9_$]*)\s*=(?!=)/g))globals.add(m[1]);
  for(const g of globals)for(const m of app.matchAll(new RegExp(String.raw`window\.${g}\.[A-Za-z_$]`,'g'))){
   const before=app.slice(Math.max(0,m.index-600),m.index);
   const ok=new RegExp(String.raw`state\.view\s*(?:===|!==|==)|(?:views|VIEWS)|window\.${g}\b[^;]{0,40}[&?]|!window\.${g}|if\(window\.${g}\)|NCLazy\??\.after|NCLazy\.has`).test(before);
   // the closure handed to NCLazy.after follows its own definition; shopCart() is only called behind window.ShopCart tests
   const later=app.slice(m.index,m.index+700),guardedLater=later.includes(`NCLazy.after('${name}'`),inShopCart=/function shopCart\(\)\{[^}]*$/.test(app.slice(Math.max(0,m.index-120),m.index+30));
   if(!ok&&!guardedLater&&!inShopCart)bad.push(`${g} at ${m.index}: ${app.slice(m.index-60,m.index+40).replace(/\n/g,' ')}`);
  }
 }
 assert.deepEqual(bad,[]);
});

test('the Continue-draft action of the complete method waits for the builder chunk',()=>{
 const app=src('app.js');
 assert.match(app,/method==='complete'&&!window\.Builder&&window\.NCLazy\)window\.NCLazy\.after\('builder',go\);else go\(\)/);
});
