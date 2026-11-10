// The default look uses the fonts of the device; only the cyberpunk look asks Google for its fonts.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../site/index.html','utf8');
const head=html.match(/<head>[\s\S]*?<script>([\s\S]*?)<\/script>/)[1];
function boot(style){
 const added=[],classes=new Set();
 const document={documentElement:{classList:{add:c=>classes.add(c),contains:c=>classes.has(c)}},head:{appendChild:l=>added.push(l)},createElement:()=>({}),getElementById:id=>added.find(l=>l.id===id)||null};
 const window={matchMedia:()=>({matches:false})};
 vm.runInNewContext(head,{document,window,localStorage:{getItem:k=>k==='nc-ui-style'?style:null},matchMedia:window.matchMedia});
 return {added,classes,window};
}

test('the page has no static link to Google fonts',()=>{
 assert.doesNotMatch(html,/<link[^>]+fonts\.(googleapis|gstatic)\.com/);
 assert.doesNotMatch(html,/<noscript>/);
});

test('the default look starts without any font request',()=>{
 for(const style of [null,'native','something else']){const h=boot(style);assert.equal(h.added.length,0,String(style));assert.ok(h.classes.has('ui-native'))}
});

test('the cyberpunk look adds the stylesheet and both preconnects from the head',()=>{
 const h=boot('cyber');
 assert.ok(!h.classes.has('ui-native'));
 assert.deepEqual(h.added.map(l=>l.rel),['preconnect','preconnect','stylesheet']);
 const sheet=h.added[2];assert.equal(sheet.id,'nc-fonts');
 assert.match(sheet.href,/^https:\/\/fonts\.googleapis\.com\/css2\?family=Barlow\+Condensed/);assert.match(sheet.href,/&family=Inter/);assert.doesNotMatch(sheet.href,/&amp;/);
 assert.equal(h.added[1].crossOrigin,'anonymous');
});

test('asking for the fonts again adds nothing',()=>{
 const h=boot('cyber');h.window.ncFonts();h.window.ncFonts();assert.equal(h.added.length,3);
});

test('switching to the cyberpunk look later loads the fonts once',()=>{
 const h=boot('native');assert.equal(h.added.length,0);
 h.window.ncFonts();h.window.ncFonts();
 assert.equal(h.added.filter(l=>l.rel==='stylesheet').length,1);
});

test('the look switcher asks for the fonts only outside the default look',()=>{
 const source=fs.readFileSync(__dirname+'/../site/theme-switch.js','utf8');
 const run=native=>{
  let asked=0;const classes=new Set(native?['ui-native']:[]);
  const root={classList:{contains:c=>classes.has(c),toggle(c,on){on?classes.add(c):classes.delete(c)}}};
  const document={documentElement:root,readyState:'complete',querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){}};
  const window={document,localStorage:{getItem:()=>null,setItem(){}},matchMedia:()=>({matches:false,addEventListener(){}}),requestAnimationFrame(){},setTimeout(){},ncFonts:()=>{asked++}};
  vm.runInNewContext(source,{window,MutationObserver:class{observe(){}}});
  return asked;
 };
 assert.equal(run(true),0);assert.ok(run(false)>=1);
});
