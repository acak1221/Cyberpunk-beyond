const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','site','index.html'),'utf8');
const app=html.match(/<div id="app"[^>]*>([\s\S]*?)<\/div><noscript>/);

// The page paints a skeleton before any script has run (index.html); the first render of the app replaces it.
test('#app keeps its guard attributes and holds a skeleton with the loading text in both languages',()=>{
 assert.match(html,/<div id="app" inert aria-busy="true"><div class="nc-skel">/);
 const skeleton=app[1];
 assert.match(skeleton,/<span lang="ru">Загрузка…<\/span>/);assert.match(skeleton,/<span lang="en">Loading…<\/span>/);
 assert.match(skeleton,/NIGHT CITY \/\/ RED/);
 assert.equal((skeleton.match(/class="nc-skel-nav"/g)||[]).length,1,'one bottom bar');
 assert.ok((skeleton.match(/class="nc-skel-block"/g)||[]).length>=2);
});

test('the skeleton is not interactive and has no heading, so the first heading is the app\'s own',()=>{
 const skeleton=app[1];
 assert.ok(!/<(button|a|input|select|textarea|h1|h2)\b/i.test(skeleton),'only decoration and a status line');
 assert.ok(!/\bhref=|\bsrc=|\bonclick=/i.test(skeleton),'it loads nothing');
});

test('no script text without scripts: a <noscript> message in both languages, and the skeleton is hidden then',()=>{
 const noscript=html.match(/<noscript><p class="nc-noscript">([\s\S]*?)<\/p><\/noscript>/);
 assert.ok(noscript,'a message for people without JavaScript');
 assert.match(noscript[1],/<span lang="ru">[^<]*JavaScript[^<]*<\/span>/);assert.match(noscript[1],/<span lang="en">[^<]*JavaScript[^<]*<\/span>/);
 assert.match(html,/<noscript><style>\.nc-skel\{display:none\}<\/style><\/noscript>/);
});

test('the skeleton has its own inline styles for every look, a reduced-motion rule, and nothing external',()=>{
 const css=html.match(/<style id="nc-boot-css">([\s\S]*?)<\/style>/)[1];
 assert.match(css,/html\.ui-light/);assert.match(css,/html\.ui-black/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.ok(!/url\(|@import|https?:/.test(css),'no request');
 assert.match(css,/html\.nc-css #app>:not\(\.nc-skel\)\{visibility:hidden\}/,'the guard that keeps unstyled content from showing');
 assert.ok(html.indexOf('id="nc-boot-css"')<html.indexOf('href="fonts.css"'),'the inline styles come first');
});

test('the inline look script is still the first script and still only sets classes',()=>{
 const first=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 assert.match(first,/localStorage\.getItem\("nc-ui-style"\)/);
 const classes=new Set();
 vm.runInNewContext(first,{document:{documentElement:{classList:{add:c=>classes.add(c)}}},window:{matchMedia:()=>({matches:false})},localStorage:{getItem:()=>null},matchMedia:()=>({matches:false})});
 assert.ok(classes.has('ui-native'));
 assert.ok(html.indexOf(first)<html.indexOf('<style id="nc-boot-css">'));
});

test('the sources still load app.js last, after the loader of the lazy chunks',()=>{
 const scripts=[...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]);
 assert.equal(scripts.at(-1),'app.js');
 assert.ok(scripts.indexOf('lazy-chunks.js')>=0&&scripts.indexOf('lazy-chunks.js')<scripts.indexOf('app.js'));
});

// The production page (scripts/build.mjs): the same skeleton, the script deferred, the style applied without blocking.
test('the built page starts the stylesheet as a preload and drops the guard when it is applied, or after 15 s, or on an error',()=>{
 const {execFileSync}=require('node:child_process'),os=require('node:os');
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'ncred-skel-'));
 try{
  execFileSync(process.execPath,[path.join(__dirname,'..','scripts','build.mjs'),out],{stdio:'pipe'});
  const built=fs.readFileSync(path.join(out,'index.html'),'utf8');
  const head=built.slice(0,built.indexOf('</head>'));
  assert.ok(head.includes('h.classList.add("nc-css")')&&head.includes('},15000)'));
  const link=head.match(/<link rel="preload" as="style" href="(nc-red\.css\?v=[0-9a-f]{12})" onload="([^"]*)" onerror="([^"]*)">/);
  assert.ok(link,'the stylesheet is a preload');
  // run the handlers the way a browser does: this is the link element
  const classes=new Set(['nc-css']),el={rel:'preload',onload:null};
  const doc={documentElement:{classList:{remove:c=>classes.delete(c)}}};
  new Function('document',link[2]).call(el,doc);
  assert.equal(el.rel,'stylesheet','the preload turns into the stylesheet');
  assert.ok(classes.has('nc-css'),'the guard stays until the stylesheet itself has loaded');
  el.onload();assert.ok(!classes.has('nc-css'),'and goes when it has');
  classes.add('nc-css');new Function('document',link[3])(doc);assert.ok(!classes.has('nc-css'),'an error also lifts the guard');
  assert.match(built,/<script src="nc-red\.js\?v=[0-9a-f]{12}" defer><\/script><\/body>/);
 }finally{fs.rmSync(out,{recursive:true,force:true})}
});
