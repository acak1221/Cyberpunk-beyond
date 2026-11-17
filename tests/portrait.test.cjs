const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','site','portrait.js'),'utf8');
const JPEG='data:image/jpeg;base64,'+'A'.repeat(400);
const AV={closest:s=>s==='[data-portrait-avatar]'?{}:null};

// A page stand-in: records listeners, focus and what the dialog and canvases were asked to paint.
function load({lang='ru',char={id:'c1',name:'Ви',role:'solo',extra:{}},jpeg=JPEG,bitmap=null,withUndo=false}={}){
 const L={},dialogs=[],focused=[],notices=[],calls=[],canvases=[],actions=[];let saves=0,renders=0,cur=char;
 const ctxFor=log=>new Proxy({},{get:(o,k)=>k in o?o[k]:(...a)=>{log.push([k,...a]);return k==='createLinearGradient'?{addColorStop(){}}:undefined},set:(o,k,v)=>{o[k]=v;log.push(['set',k,v]);return true}});
 const mk=sel=>({sel,listeners:{},focus(){focused.push(sel)},addEventListener(t,f){this.listeners[t]=f},getContext(){return ctxFor(calls)},getBoundingClientRect:()=>({width:280})});
 const document={body:{appendChild(){}},
  createElement(tag){
   if(tag==='canvas'){const log=[];canvases.push({log,get w(){return cv.width}});const cv={width:0,height:0,log,getContext:()=>ctxFor(log),toDataURL:(t,q)=>{calls.push(['toDataURL',cv.width,t,q]);return typeof jpeg==='function'?jpeg(cv.width,q):jpeg}};return cv}
   const el={tag,className:'',innerHTML:'',attrs:{},listeners:{},parts:{},
    setAttribute(k,v){this.attrs[k]=v},addEventListener(t,f){(this.listeners[t]=this.listeners[t]||[]).push(f)},fire(t,e){(this.listeners[t]||[]).forEach(f=>f(e))},showModal(){this.open=true},close(){this.closed=true},remove(){this.removed=true},contains:()=>true,
    querySelector(s){return this.parts[s]||(this.parts[s]=mk(s))},querySelectorAll(){return this.tabs||(this.tabs=[mk('first'),mk('mid'),mk('last')])}};
   dialogs.push(el);return el;
  },
  addEventListener(t,f){L[t]=f},querySelector:s=>({focus(){focused.push(s)}}),activeElement:null};
 const App={lang:()=>lang,active:()=>cur,save:()=>{saves++},render:()=>{renders++},notify:m=>notices.push(m)};
 if(withUndo)App.notifyAction=(m,label,fn)=>actions.push({m,label,fn});
 const window={document,App,confirm:()=>true};
 if(bitmap)window.createImageBitmap=bitmap;
 class Image{set src(u){this.url=u;Promise.resolve().then(()=>{this.width=640;this.height=480;this.onload()})}}
 vm.runInNewContext(src,{window,Image,Math,Number,String,Array,Object,Map,JSON,Promise,Error,Uint8Array});
 return {actions,canvases,document,P:window.Portrait,L,dialogs,focused,notices,calls,App,set:c=>{cur=c},saves:()=>saves,renders:()=>renders,char};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,a+' vs '+b);

test('crop maths: the first view is the short side, nudged up on tall images',()=>{
 const {P}=load(),C=P.crop;
 let r=C.rect(1000,500,C.initial(1000,500));
 assert.deepEqual([r.sx,r.sy,r.side],[250,0,500]);
 r=C.rect(500,1000,C.initial(500,1000));near(r.sx,0);near(r.sy,150);near(r.side,500);
});
test('crop maths: zoom is clamped and the window never leaves the image',()=>{
 const {P}=load(),C=P.crop;
 assert.equal(C.clampZoom(0.2),1);assert.equal(C.clampZoom(99),4);assert.equal(C.clampZoom(NaN),1);assert.equal(C.clampZoom(undefined),1);
 const st=C.zoomTo(800,600,C.initial(800,600),4);
 near(C.sideOf(800,600,4),150);
 for(const [cx,cy] of [[-500,-500],[9999,9999],[NaN,NaN]]){
  const r=C.rect(800,600,C.fit(800,600,st.zoom,cx,cy));
  assert.ok(r.sx>=0&&r.sy>=0&&r.sx+r.side<=800+1e-9&&r.sy+r.side<=600+1e-9,JSON.stringify(r));
 }
 const r=C.rect(800,600,C.fit(800,600,1,0,0));near(r.sx,0);near(r.sy,0);near(r.side,600);
});
test('crop maths: a drag moves the picture with the finger and stops at the edges',()=>{
 const {P}=load(),C=P.crop;
 const st=C.zoomTo(1000,1000,{zoom:1,cx:500,cy:500},2); // side 500 shown in 250 px: 2 image px per screen px
 const m=C.panBy(1000,1000,st,10,-20,250);
 near(m.cx,500-20);near(m.cy,500+40);
 const far=C.panBy(1000,1000,st,-100000,100000,250);
 near(far.cx,750);near(far.cy,250);
 assert.equal(C.panBy(1000,1000,st,NaN,NaN,0).cx,500);
});
test('crop maths: pinch scales the start zoom by the finger distance',()=>{
 const {P}=load(),C=P.crop;
 near(C.pinchZoom(1.5,100,200),3);assert.equal(C.pinchZoom(2,100,1000),4);assert.equal(C.pinchZoom(2,100,1),1);
 assert.equal(C.pinchZoom(2,0,50),2);
});
test('crop maths: arrows pan, plus and minus zoom, other keys are ignored',()=>{
 const {P}=load(),C=P.crop,st={zoom:2,cx:500,cy:500};
 assert.equal(C.applyKey(1000,1000,st,'a',false),null);
 near(C.applyKey(1000,1000,st,'ArrowLeft',false).cx,500-0.05*500);
 near(C.applyKey(1000,1000,st,'ArrowDown',true).cy,500+0.2*500);
 near(C.applyKey(1000,1000,st,'+',false).zoom,2.25);near(C.applyKey(1000,1000,st,'-',false).zoom,1.75);
 assert.equal(C.applyKey(1000,1000,{zoom:4,cx:500,cy:500},'=',false).zoom,4);
 assert.equal(C.applyKey(1000,1000,{zoom:1,cx:500,cy:500},'-',false).zoom,1);
});
test('a transparent source is painted on a neutral fill before it is drawn',()=>{
 const {P}=load(),log=[];
 const ctx=new Proxy({},{get:(o,k)=>(...a)=>log.push([k,...a]),set:(o,k,v)=>{log.push(['set',k,v]);return true}});
 P.crop.paint(ctx,{},{sx:1,sy:2,side:30},320);
 assert.deepEqual(log.map(x=>x[0]),['set','fillRect','drawImage']);
 assert.equal(log[0][2],P.crop.BG);assert.deepEqual(log[1].slice(1),[0,0,320,320]);
 assert.deepEqual(log[2].slice(2),[1,2,30,30,0,0,320,320]);
});
test('avatar spec is deterministic per seed, differs between variants and ignores unknown roles',()=>{
 const {P}=load(),A=P.avatar;
 const c={id:'c1',name:'Ви',role:'solo'};
 assert.deepEqual(A.spec(A.seedOf(c,0),'solo'),A.spec(A.seedOf(c,0),'solo'));
 assert.notDeepEqual(A.spec(A.seedOf(c,0),'solo'),A.spec(A.seedOf(c,1),'solo'));
 assert.equal(A.spec('x','__proto__').glyph,'');assert.equal(A.spec('x','constructor').glyph,'');
 assert.equal(A.glyphOf('toString'),A.glyphOf('nope'));
 assert.equal(A.spec('x','nomad').glyph,'nomad');
 const seen=new Set();for(let i=0;i<60;i++)seen.add(A.spec('s'+i,'solo').pattern);
 assert.equal(seen.size,4);
 for(const k of Object.keys(A.GLYPHS))assert.ok(A.GLYPHS[k].length>0);
});
test('avatar drawing stays inside the canvas and paints the role glyph',()=>{
 const {P}=load(),A=P.avatar;
 for(const role of Object.keys(A.GLYPHS).concat(['',undefined])){
  const log=[];const ctx=new Proxy({},{get:(o,k)=>(...a)=>{log.push([k,...a]);return k==='createLinearGradient'?{addColorStop(){}}:undefined},set:()=>true});
  A.draw(ctx,A.spec('seed',role),320);
  assert.ok(log.some(x=>x[0]==='stroke'),String(role));
  for(const x of log.filter(x=>x[0]==='arc'))assert.ok(x[1]>=-32&&x[1]<=352&&x[2]>=-32&&x[2]<=352,JSON.stringify(x));
 }
});
test('editor offers upload, avatar and remove as real buttons in both languages',()=>{
 for(const lang of ['ru','en']){
  const {P}=load({lang});
  const none=P.editor({name:'Ви',extra:{}}),has=P.editor({name:'Ви',extra:{portrait:JPEG}});
  assert.match(none,/data-portrait-pick/);assert.match(none,/data-portrait-avatar/);assert.doesNotMatch(none,/data-portrait-remove/);
  assert.match(has,/data-portrait-remove/);
  assert.match(none,lang==='ru'?/Загрузить портрет/:/Upload portrait/);
  assert.match(none,lang==='ru'?/Создать аватар/:/Create avatar/);
  assert.match(has,lang==='ru'?/Сменить портрет/:/Change portrait/);
 }
 assert.match(load().P.editor({name:'<b>',extra:{}}),/&lt;/);
});
test('the old validators still accept only inline raster images',()=>{
 const {P}=load();
 assert.ok(P.valid(JPEG));assert.ok(!P.valid('javascript:alert(1)'));assert.ok(!P.valid('data:image/svg+xml;base64,AAAA'));
 assert.equal(P.src({extra:{portrait:'x'}}),'');assert.equal(P.thumb({extra:{portraitThumb:JPEG}}),JPEG);
});
test('Create avatar opens a dialog; Save stores a full picture and a thumb like an upload',()=>{
 const h=load();
 h.L.click({target:AV});
 const d=h.dialogs[0];assert.equal(d.open,true);assert.equal(d.className,'portrait-dialog');
 assert.match(d.innerHTML,/Создать аватар/);assert.match(d.innerHTML,/data-portrait-shuffle/);
 let prevented=0;d.fire('submit',{preventDefault(){prevented++}});
 assert.equal(prevented,1);
 assert.equal(h.char.extra.portrait,JPEG);assert.equal(h.char.extra.portraitThumb,JPEG);
 assert.equal(h.saves(),1);assert.equal(h.renders(),1);assert.equal(d.removed,true);
 assert.equal(h.focused.at(-1),'[data-portrait-pick]','focus returns to the editor after the sheet is redrawn');
 assert.deepEqual(h.calls.filter(x=>x[0]==='toDataURL').map(x=>x[1]),[320,72]);
});
test('Cancel, Escape and a changed sheet save nothing and give focus back',()=>{
 let h=load();
 h.L.click({target:AV});
 let d=h.dialogs[0];
 d.fire('click',{target:{closest:s=>s==='[data-portrait-cancel]'?{}:null}});
 assert.equal(d.removed,true);assert.equal(h.char.extra.portrait,undefined);assert.equal(h.focused.at(-1),'[data-portrait-avatar]');
 h=load();h.L.click({target:AV});d=h.dialogs[0];
 d.fire('cancel',{preventDefault(){}});assert.equal(d.removed,true);assert.equal(h.saves(),0);
 h=load();h.L.click({target:AV});d=h.dialogs[0];
 h.set({id:'other',extra:{}});d.fire('submit',{preventDefault(){}});
 assert.equal(d.removed,true);assert.equal(h.saves(),0);assert.deepEqual(h.notices,['Лист персонажа изменился, портрет не сохранён.']);
});
test('a result that is too large is retried with lower quality, then refused',()=>{
 const big='data:image/jpeg;base64,'+'A'.repeat(200001);
 let h=load({jpeg:(w,q)=>q>0.7?big:JPEG});
 h.L.click({target:AV});h.dialogs[0].fire('submit',{preventDefault(){}});
 assert.equal(h.char.extra.portrait,JPEG);
 h=load({jpeg:()=>big});
 h.L.click({target:AV});h.dialogs[0].fire('submit',{preventDefault(){}});
 assert.equal(h.char.extra.portrait,undefined);assert.equal(h.saves(),0);
 assert.deepEqual(h.notices,[],'the error is shown inside the dialog, not under its backdrop');
 const box=h.dialogs[0].querySelector('[data-portrait-error]');assert.match(box.textContent,/Не удалось/);assert.equal(box.hidden,false);
 assert.ok(h.dialogs[0].removed!==true,'the dialog stays open so the player can try again');
 assert.match(h.dialogs[0].innerHTML,/role="alert"/);
});
test('Tab on the last control of the dialog wraps to the first, Shift+Tab on the first to the last',()=>{
 const h=load();h.L.click({target:AV});
 const d=h.dialogs[0],tabs=d.querySelectorAll();
 let stopped=0;const ev=shiftKey=>({key:'Tab',shiftKey,preventDefault(){stopped++}});
 h.document.activeElement=tabs[1];d.fire('keydown',ev(false));
 assert.equal(stopped,0,'a middle control keeps the normal tab order');
 h.document.activeElement=tabs[2];d.fire('keydown',ev(false));
 assert.equal(stopped,1);assert.equal(h.focused.at(-1),'first');
 h.document.activeElement=tabs[0];d.fire('keydown',ev(true));
 assert.equal(stopped,2);assert.equal(h.focused.at(-1),'last');
});
test('removing a portrait deletes both fields and keeps focus on the editor',()=>{
 const h=load({char:{id:'c',name:'A',extra:{portrait:JPEG,portraitThumb:JPEG}}});
 h.L.click({target:{closest:s=>s==='[data-portrait-remove]'?{}:null}});
 assert.equal(h.char.extra.portrait,undefined);assert.equal(h.char.extra.portraitThumb,undefined);
 assert.equal(h.focused.at(-1),'[data-portrait-pick]');
});
test('the stylesheet is linked once, keeps 44 px targets, and the script is registered before app.js',()=>{
 const css=fs.readFileSync(path.join(__dirname,'..','site','portrait.css'),'utf8'),html=fs.readFileSync(path.join(__dirname,'..','site','index.html'),'utf8');
 assert.equal(html.split('href="portrait.css"').length,2);
 assert.ok(html.indexOf('portrait.js')<html.indexOf('app.js'));
 assert.match(css,/portrait-button \{[^}]*min-height: 44px/);assert.match(css,/portrait-btn \{[^}]*min-height: 44px/);
 assert.doesNotMatch(css,/\r/);assert.doesNotMatch(src,/\r/);
});

// ---------- the crop dialog wiring ----------
const FILE=(size=1000)=>({size});
const bmp=(w=1000,h=500)=>{const b={width:w,height:h,close(){b.closed=true}};b.make=()=>Promise.resolve(b);return b};
async function openFor(h,file=FILE()){h.L.change({target:{closest:()=>({files:[file],value:'x'})}});await new Promise(r=>setImmediate(r));return h.dialogs[0]}
const loadCrop=(opts={})=>{const b=bmp(opts.w,opts.h);return {b,h:load({...opts,bitmap:()=>b.make()})}};
const lastDraw=h=>h.calls.filter(x=>x[0]==='drawImage').at(-1);
const drawsOf=h=>h.calls.filter(x=>x[0]==='drawImage').length;
const ptr=(id,x,y)=>({pointerId:id,clientX:x,clientY:y,preventDefault(){}});

test('a file over 20 MB is refused and opens no dialog',async()=>{
 const {h}=loadCrop();
 const d=await openFor(h,FILE(20*1024*1024+1));
 assert.equal(d,undefined);assert.deepEqual(h.notices,['Файл слишком большой (больше 20 МБ).']);
 const ok=await openFor(loadCrop().h,FILE(20*1024*1024));assert.ok(ok);
});
test('an empty image is refused and released',async()=>{
 const {b,h}=loadCrop({w:0,h:0});
 assert.equal(await openFor(h),undefined);assert.equal(b.closed,true);assert.match(h.notices[0],/Не удалось/);
});
test('a sheet switched while the image loads opens nothing',async()=>{
 const {b,h}=loadCrop();
 b.make=()=>{h.set({id:'other',extra:{}});return Promise.resolve(b)};
 assert.equal(await openFor(h),undefined);assert.equal(b.closed,true);
});
test('crop dialog: first view, drag pans, wheel and slider and buttons zoom',async()=>{
 const {b,h}=loadCrop();
 const d=await openFor(h);
 assert.equal(d.open,true);assert.match(d.innerHTML,/Кадрирование портрета/);
 assert.deepEqual(lastDraw(h).slice(1,6),[b,250,0,500,500]);
 const cv=d.querySelector('[data-portrait-canvas]'),range=d.querySelector('[data-portrait-range]');
 cv.listeners.pointerdown(ptr(1,100,100));cv.listeners.pointermove(ptr(1,80,100));
 near(lastDraw(h)[2],250+20*500/280);
 cv.listeners.pointerup(ptr(1,80,100));const n=drawsOf(h);cv.listeners.pointermove(ptr(1,10,10));assert.equal(drawsOf(h),n,'moves after release do nothing');
 cv.listeners.wheel({deltaY:-1,preventDefault(){}});assert.ok(lastDraw(h)[4]<500,'wheel up zooms in');
 const z1=lastDraw(h)[4];cv.listeners.wheel({deltaY:1,preventDefault(){}});assert.ok(lastDraw(h)[4]>z1,'wheel down zooms out');
 range.value='200';range.listeners.input();near(lastDraw(h)[4],250);assert.equal(range.value,'200');
 const btn=dir=>d.fire('click',{target:{closest:s=>s==='[data-portrait-zoom]'?{getAttribute:()=>dir}:null}});
 btn('1');near(lastDraw(h)[4],500/2.25);btn('-1');btn('-1');near(lastDraw(h)[4],500/1.75);
});
test('crop dialog: two fingers pinch, keys pan and zoom, other keys do nothing',async()=>{
 const {h}=loadCrop({w:1000,h:1000});
 const d=await openFor(h),cv=d.querySelector('[data-portrait-canvas]');
 cv.listeners.pointerdown(ptr(1,0,0));cv.listeners.pointerdown(ptr(2,100,0));
 cv.listeners.pointermove(ptr(2,200,0));near(lastDraw(h)[4],500);
 cv.listeners.pointermove(ptr(2,50,0));near(lastDraw(h)[4],1000);
 cv.listeners.pointerup(ptr(2,50,0));cv.listeners.pointerup(ptr(1,0,0));
 let prevented=0;const key=(k,shift=false)=>cv.listeners.keydown({key:k,shiftKey:shift,preventDefault(){prevented++}});
 key('+');near(lastDraw(h)[4],800);key('-');near(lastDraw(h)[4],1000);
 key('+');key('+');key('ArrowRight');
 const sx=lastDraw(h)[2];key('ArrowRight',true);assert.ok(lastDraw(h)[2]>sx,'arrow right moves the frame right');
 const p=prevented,n=drawsOf(h);key('a');assert.equal(prevented,p);assert.equal(drawsOf(h),n);
});
test('crop dialog: Save paints through the neutral fill, saves picture and thumb, then closes',async()=>{
 const {b,h}=loadCrop();
 const d=await openFor(h);
 d.fire('submit',{preventDefault(){}});
 const full=h.canvases.find(c=>c.w===320),small=h.canvases.find(c=>c.w===72);
 const names=full.log.map(x=>x[0]==='set'?x[1]:x[0]);
 assert.ok(names.indexOf('fillRect')>=0&&names.indexOf('fillRect')<names.indexOf('drawImage'),'fill comes before the picture');
 assert.equal(full.log.find(x=>x[0]==='set'&&x[1]==='fillStyle')[2],h.P.crop.BG);
 assert.deepEqual(full.log.find(x=>x[0]==='drawImage').slice(1,10),[b,250,0,500,500,0,0,320,320]);
 assert.ok(small.log.some(x=>x[0]==='fillRect'));
 assert.equal(h.char.extra.portrait,JPEG);assert.equal(d.removed,true);assert.equal(b.closed,true);
});
test('crop dialog: Cancel releases the image and saves nothing; an oversize thumb is dropped',async()=>{
 let {b,h}=loadCrop();let d=await openFor(h);
 d.fire('click',{target:{closest:s=>s==='[data-portrait-cancel]'?{}:null}});
 assert.equal(b.closed,true);assert.equal(h.saves(),0);assert.equal(h.focused.at(-1),'[data-portrait-pick]');
 const big='data:image/jpeg;base64,'+'A'.repeat(16001);
 ({b,h}=loadCrop({jpeg:w=>w===72?big:JPEG,char:{id:'c',name:'A',extra:{portraitThumb:JPEG}}}));
 d=await openFor(h);d.fire('submit',{preventDefault(){}});
 assert.equal(h.char.extra.portrait,JPEG);assert.equal(h.char.extra.portraitThumb,undefined);
});
test('a portrait that is already saved can be cropped again, with the same save path',async()=>{
 const h=load({char:{id:'c',name:'A',extra:{portrait:JPEG}}});
 assert.match(h.P.editor({name:'A',extra:{portrait:JPEG}}),/data-portrait-recrop/);
 assert.doesNotMatch(h.P.editor({name:'A',extra:{}}),/data-portrait-recrop/);
 h.L.click({target:{closest:s=>s==='[data-portrait-recrop]'?{}:null}});
 await new Promise(r=>setImmediate(r));
 const d=h.dialogs[0];assert.ok(d&&d.open);
 assert.deepEqual(lastDraw(h).slice(2,6),[80,0,480,480]);
 d.fire('submit',{preventDefault(){}});assert.equal(h.saves(),1);
});
test('replacing or removing a portrait can be undone',()=>{
 const OLD='data:image/jpeg;base64,'+'B'.repeat(300);
 let h=load({withUndo:true,char:{id:'c1',name:'A',role:'solo',extra:{portrait:OLD,portraitThumb:OLD}}});
 h.L.click({target:AV});h.dialogs[0].fire('submit',{preventDefault(){}});
 assert.equal(h.char.extra.portrait,JPEG);
 assert.equal(h.actions.length,1);assert.equal(h.actions[0].m,'Портрет заменён.');assert.equal(h.actions[0].label,'Отменить');
 h.actions[0].fn();
 assert.equal(h.char.extra.portrait,OLD);assert.equal(h.char.extra.portraitThumb,OLD);
 h.L.click({target:{closest:s=>s==='[data-portrait-remove]'?{}:null}});
 assert.equal(h.char.extra.portrait,undefined);assert.equal(h.actions.at(-1).m,'Портрет убран.');
 h.actions.at(-1).fn();assert.equal(h.char.extra.portrait,OLD);assert.equal(h.char.extra.portraitThumb,OLD);
 h=load({withUndo:true,lang:'en'});h.L.click({target:AV});h.dialogs[0].fire('submit',{preventDefault(){}});
 assert.equal(h.actions[0].m,'Portrait saved.');assert.equal(h.actions[0].label,'Undo');
 const keep=h.char;h.set({id:'x',extra:{}});h.actions[0].fn();assert.equal(keep.extra.portrait,JPEG);
 h.set(keep);h.actions[0].fn();assert.equal(keep.extra.portrait,undefined);assert.equal(keep.extra.portraitThumb,undefined);
});
test('the primary button keeps readable contrast in both themes, and action buttons look like buttons',()=>{
 const css=fs.readFileSync(path.join(__dirname,'..','site','portrait.css'),'utf8');
 const m=css.match(/\.portrait-btn\.primary \{([^}]*)\}/)[1];
 assert.match(m,/color: #fff/);assert.doesNotMatch(m,/var\(--yellow/);
 assert.match(css,/\.portrait-box \.portrait-actions \.portrait-button \{[^}]*border: 1px solid/);
});
