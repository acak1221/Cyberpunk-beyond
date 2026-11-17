// The black (OLED) theme: a fourth mode of the theme switch, for the clean and dossier looks. In the cyberpunk look light and
// black have no effect, and the switch says so instead of doing nothing in silence.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const site=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
function setup({stored,look='native',prefersLight=false,lang='ru'}={}){
 const store=new Map(stored===undefined?[]:[['nc-ui-theme',stored]]);
 const classes=new Set(look==='cyber'?[]:['ui-native',...(look==='board'?['ui-board']:[])]);
 const meta={content:'#11110f',setAttribute(k,v){this.content=v}},notes=[];
 const document={readyState:'complete',documentElement:{classList:{contains:n=>classes.has(n),toggle(n,on){on?classes.add(n):classes.delete(n)}}},querySelector:s=>s==='meta[name="theme-color"]'?meta:null,querySelectorAll:()=>[],addEventListener(){}};
 const window={document,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v))},matchMedia:()=>({matches:prefersLight,addEventListener(){}}),requestAnimationFrame:f=>f(),setTimeout:f=>f(),App:{lang:()=>lang,notify:m=>notes.push(m)}};
 vm.runInNewContext(site('theme-switch.js'),{window,MutationObserver:class{observe(){}}});
 return {T:window.ThemeSwitch,classes,meta,store,notes};
}

test('black is a mode; it stores, round-trips and turns on html.ui-black with a black browser bar',()=>{
 const e=setup();
 assert.deepEqual([...e.T.MODES],['auto','dark','light','black']);
 assert.equal(e.T.set('black'),true);
 assert.equal(e.store.get('nc-ui-theme'),'black');assert.equal(e.T.get(),'black');
 assert.ok(e.classes.has('ui-black'));assert.ok(!e.classes.has('ui-light'));assert.equal(e.meta.content,'#000000');
 const fresh=setup({stored:'black'});assert.ok(fresh.classes.has('ui-black'));
});

test('switching away from black takes the class off again, and black and light never stand together',()=>{
 const e=setup({stored:'black'});
 e.T.set('light');assert.ok(!e.classes.has('ui-black'));assert.ok(e.classes.has('ui-light'));assert.equal(e.meta.content,'#f2f2f4');
 e.T.set('black');assert.ok(!e.classes.has('ui-light'));assert.ok(e.classes.has('ui-black'));
 e.T.set('dark');assert.ok(!e.classes.has('ui-black'));assert.equal(e.meta.content,'#11110f');
 const auto=setup({stored:'auto',prefersLight:true});assert.ok(!auto.classes.has('ui-black'));
});

test('black works in the dossier look too',()=>{
 const e=setup({stored:'black',look:'board'});assert.ok(e.classes.has('ui-black'));assert.ok(e.classes.has('ui-board'));
});

test('in the cyberpunk look neither light nor black applies, and the user is told plainly',()=>{
 for(const mode of ['light','black']){
  const e=setup({stored:mode,look:'cyber'});
  assert.ok(!e.classes.has('ui-black')&&!e.classes.has('ui-light'),mode);
  assert.equal(e.T.ignoredHere(),true);
  assert.match(e.T.note('ru'),/своя палитра/);assert.match(e.T.note('en'),/own palette/);
  e.notes.length=0;e.T.set(mode);
  assert.equal(e.notes.length,1,'a notice is shown when the choice is made');
  assert.match(e.notes[0],/своя палитра/);
 }
 const en=setup({look:'cyber',lang:'en'});en.T.set('black');assert.match(en.notes[0],/Cyberpunk look has its own palette/);
 const dark=setup({look:'cyber'});dark.T.set('dark');assert.equal(dark.notes.length,0,'dark and auto work there: no notice');
 assert.equal(dark.T.note('ru'),'');
 const clean=setup({stored:'black'});clean.T.set('black');assert.equal(clean.notes.length,0);assert.equal(clean.T.note('ru'),'');
});

test('the css has black overrides for the clean and the dossier look, and none for the cyberpunk look',()=>{
 assert.match(site('native.css'),/html\.ui-native\.ui-black\s*\{[^}]*--bg: #000/);
 assert.match(site('board.css'),/html\.ui-native\.ui-board\.ui-black\s*\{[^}]*--bg: #000/);
 assert.match(site('board.css'),/ui-black\s*\{[^}]*--board-frame: url\(/);
 for(const f of fs.readdirSync(path.join(__dirname,'..','site')).filter(n=>n.endsWith('.css')))
  for(const m of site(f).replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/[^{}]*ui-black[^{}]*\{/g))assert.match(m[0],/ui-native/,f+': '+m[0].trim());
});

test('the page note under the theme group follows the look and the theme without a redraw',()=>{
 const classes=new Set(['ui-native']);
 const noteEl={textContent:'',hidden:true};
 const attrs={};const btn=(m)=>({dataset:{uiTheme:m},classList:{toggle(){}},setAttribute(){},removeAttribute(k){delete attrs[m+k]},closest:s=>s==='.set-page'?{}:null});
 const light=btn('light'),dark=btn('dark');
 light.setAttribute=(k,v)=>{attrs['light'+k]=v};
 const store=new Map([['nc-ui-theme','light']]);
 const document={readyState:'complete',documentElement:{classList:{contains:n=>classes.has(n),toggle(n,on){on?classes.add(n):classes.delete(n)}}},querySelector:()=>null,
  querySelectorAll:s=>s==='[data-set-theme-note]'?[noteEl]:s==='[data-ui-theme]'?[light,dark]:[],addEventListener(){}};
 const window={document,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,v)},matchMedia:()=>({matches:false,addEventListener(){}}),requestAnimationFrame:f=>f(),App:{lang:()=>'ru',notify(){}}};
 vm.runInNewContext(site('theme-switch.js'),{window,MutationObserver:class{observe(){}}});
 assert.equal(noteEl.hidden,true,'native look: no note');
 classes.delete('ui-native');window.ThemeSwitch.apply();
 assert.equal(noteEl.hidden,false);assert.match(noteEl.textContent,/своя палитра/);assert.equal(attrs['lightaria-describedby'],'set-theme-note');
 classes.add('ui-native');window.ThemeSwitch.apply();
 assert.equal(noteEl.hidden,true);assert.equal(noteEl.textContent,'');assert.equal(attrs['lightaria-describedby'],undefined);
});
