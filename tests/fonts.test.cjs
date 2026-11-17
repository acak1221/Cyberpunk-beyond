// The fonts of the cyberpunk look are served from this site (fonts/, OFL.txt); nothing is requested from Google, and the
// first-paint script in the page head only sets the look and theme classes.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const site=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const html=site('index.html');
const head=html.match(/<head>[\s\S]*?<script>([\s\S]*?)<\/script>/)[1];
function boot(style,theme,{light=false}={}){
 const classes=new Set();
 const document={documentElement:{classList:{add:c=>classes.add(c),contains:c=>classes.has(c)}}};
 const store={'nc-ui-style':style,'nc-ui-theme':theme};
 const window={matchMedia:()=>({matches:light})};
 vm.runInNewContext(head,{document,window,localStorage:{getItem:k=>store[k]??null},matchMedia:window.matchMedia});
 return classes;
}

test('the page has no link to Google fonts and no font loader',()=>{
 assert.doesNotMatch(html,/fonts\.(googleapis|gstatic)\.com/);
 assert.doesNotMatch(html,/<noscript>(?:(?!<\/noscript>)[^])*(?:googleapis|gstatic|font)/i); // a <noscript> may exist (skeleton text), but never to load fonts
 assert.doesNotMatch(html,/ncFonts/);
 assert.doesNotMatch(site('theme-switch.js'),/ncFonts/);
});

test('no stylesheet or script of the app asks another site for anything',()=>{
 for(const f of fs.readdirSync(path.join(__dirname,'..','site')).filter(n=>/\.(css|html)$/.test(n))){
  assert.doesNotMatch(site(f),/url\(\s*["']?https?:\/\//,f);
  assert.doesNotMatch(site(f),/@import/,f);
 }
});

test('the first-paint script sets the look and theme classes and loads nothing',()=>{
 for(const style of [null,'native','something else']){const c=boot(style,null);assert.ok(c.has('ui-native'),String(style));assert.ok(!c.has('ui-board'))}
 assert.deepEqual([...boot('cyber',null)],[]);
 assert.deepEqual([...boot('board',null)].sort(),['ui-board','ui-native']);
 assert.deepEqual([...boot('native','light')].sort(),['ui-light','ui-native']);
 assert.deepEqual([...boot('native','auto',{light:true})].sort(),['ui-light','ui-native']);
 assert.deepEqual([...boot('native','black')].sort(),['ui-black','ui-native']);
 assert.deepEqual([...boot('board','black')].sort(),['ui-black','ui-board','ui-native']);
 // The cyberpunk look keeps its own palette: neither light nor black classes are set there.
 assert.deepEqual([...boot('cyber','light')],[]);
 assert.deepEqual([...boot('cyber','black')],[]);
});

test('fonts.css declares Rajdhani and Tomorrow from files that exist, only for the weights the look uses',()=>{
 const css=site('fonts.css'),faces=[...css.matchAll(/@font-face\{([^}]*)\}/g)].map(m=>m[1]);
 assert.ok(faces.length>=4);
 const families=new Set();
 for(const face of faces){
  families.add(face.match(/font-family:'([^']+)'/)[1]);
  const url=face.match(/url\(([^)]+)\)/)[1];
  assert.match(url,/^fonts\/[a-z0-9-]+\.woff2$/);
  assert.ok(fs.existsSync(path.join(__dirname,'..','site',url)),url+' exists');
  assert.match(face,/font-display:swap/);
 }
 assert.deepEqual([...families].sort(),['Rajdhani','Tomorrow']);
 // Every file in fonts/ is used (nothing unused is shipped and precached), and the license is next to them.
 const used=new Set(faces.map(f=>f.match(/url\(fonts\/([^)]+)\)/)[1]));
 const present=fs.readdirSync(path.join(__dirname,'..','site','fonts')).filter(n=>n.endsWith('.woff2'));
 assert.deepEqual(present.sort(),[...used].sort());
 assert.match(html,/<link rel="stylesheet" href="fonts\.css">/);
});

test('the cyberpunk look uses the local fonts and the clean looks keep the fonts of the device',()=>{
 const styles=site('styles.css');
 assert.match(styles,/--display: 'Rajdhani'/);assert.match(styles,/--body: 'Tomorrow'/);
 assert.doesNotMatch(site('native.css').match(/html\.ui-native \{[\s\S]*?\n\}/)[0],/Rajdhani|Tomorrow/);
});

test('the license of the bundled fonts is the standard SIL OFL 1.1 and names both authors',()=>{
 const ofl=site('fonts/OFL.txt');
 assert.match(ofl,/SIL OPEN FONT LICENSE Version 1\.1 - 26 February 2007/);
 for(const part of ['PREAMBLE','DEFINITIONS','PERMISSION & CONDITIONS','TERMINATION','DISCLAIMER'])assert.ok(ofl.includes(part),part);
 assert.match(ofl,/Indian Type Foundry/);assert.match(ofl,/Tomorrow Project Authors/);
 assert.ok(!ofl.includes('\r'),'LF line endings');
});

test('the build precaches the fonts with the rest of the site',()=>{
 const build=fs.readFileSync(path.join(__dirname,'..','scripts','build.mjs'),'utf8');
 assert.match(build,/RUNTIME_ONLY = \[\/\^vendor\\\/pdfjs\\\/\/\]/);
});

test('the look switcher no longer asks for web fonts',()=>{
 const source=site('theme-switch.js');
 const run=native=>{
  let asked=0;const classes=new Set(native?['ui-native']:[]);
  const root={classList:{contains:c=>classes.has(c),toggle(c,on){on?classes.add(c):classes.delete(c)}}};
  const document={documentElement:root,readyState:'complete',querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){}};
  const window={document,localStorage:{getItem:()=>null,setItem(){}},matchMedia:()=>({matches:false,addEventListener(){}}),requestAnimationFrame(){},setTimeout(){},ncFonts:()=>{asked++}};
  vm.runInNewContext(source,{window,MutationObserver:class{observe(){}}});
  return asked;
 };
 assert.equal(run(true),0);assert.equal(run(false),0);
});
