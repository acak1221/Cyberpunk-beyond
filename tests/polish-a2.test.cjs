// Polish A, second round: what the page renders (a real browser against site/), not what the CSS text says. Skipped without Playwright.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),net=require('node:net');
const {spawn}=require('node:child_process'),path=require('node:path');
let pw=null;try{pw=require('playwright')}catch{}
const ROOT=path.join(__dirname,'..'),src=f=>fs.readFileSync(path.join(ROOT,'site',f),'utf8');
const character={id:'v1',name:'Vee',role:'solo',rank:4,stats:{INT:6,REF:7,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{Evasion:4,Athletics:2},hp:45,humanity:60};
let server,browser,base;
const freePort=()=>new Promise((res,rej)=>{const s=net.createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const{port}=s.address();s.close(()=>res(port))})});
before(async()=>{if(!pw)return;const port=await freePort();base=`http://127.0.0.1:${port}/`;
 server=spawn(process.execPath,[path.join(ROOT,'scripts','serve.mjs'),path.join(ROOT,'site'),'--port',String(port)],{stdio:'ignore'});
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,200))}
 browser=await pw.chromium.launch()});
after(async()=>{await browser?.close();server?.kill()});
async function open(look,width,hash){const ctx=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
 await ctx.addInitScript(([s,l])=>{if(sessionStorage.getItem('seeded'))return;localStorage.setItem('nc-pref-role-asked','true');localStorage.setItem('nightcity-red-v1',s);localStorage.setItem('nc-ui-style',l);localStorage.setItem('nc-ui-theme','dark');sessionStorage.setItem('seeded','1')},[JSON.stringify({characters:[character],campaigns:[],lang:'ru'}),look]);
 const page=await ctx.newPage();await page.goto(base+hash);await page.waitForTimeout(1200);return{ctx,page}}
const skip=()=>!pw&&'Playwright is not installed';

test('«Досье» on a phone: the five sheet tabs are 44 px high',{skip:skip()},async()=>{
 const {ctx,page}=await open('board',390,'#/sheet/v1');
 const h=await page.evaluate(()=>[...document.querySelectorAll('.sheet-tabs button')].filter(b=>b.getClientRects().length).map(b=>b.getBoundingClientRect().height));
 await ctx.close();assert.ok(h.length>=5);for(const x of h)assert.ok(x>=44,'tab height '+x);
});
test('the compact HUD keeps money, the lock and sleep reachable: nothing is hidden, the strip scrolls',{skip:skip()},async()=>{
 for(const look of ['native','cyber','board']){
  const {ctx,page}=await open(look,390,'#/sheet/v1');
  await page.evaluate(()=>window.scrollTo(0,400));await page.waitForTimeout(500);
  const r=await page.evaluate(()=>{const hud=document.querySelector('.sheet-hud'),kids=[...hud.children].filter(k=>!k.hidden&&k.className);
   const hidden=kids.filter(k=>!k.getClientRects().length).map(k=>k.className);
   const chip=hud.querySelector('.hud-lock');chip.scrollIntoView({inline:'center',block:'nearest'});
   const rr=chip.getBoundingClientRect(),hr=hud.getBoundingClientRect();
   return{hidden,scroll:hud.scrollWidth>hud.clientWidth,money:!!hud.querySelector('.hud-money'),lockIn:rr.left>=hr.left-1&&rr.right<=hr.right+1,fade:document.querySelector('.sheet-dock').classList.contains('hud-overflow')||hud.scrollLeft+hud.clientWidth>=hud.scrollWidth-2}});
  await ctx.close();
  assert.deepEqual(r.hidden,[],look+': hidden chips '+r.hidden);assert.ok(r.scroll,look+': the strip scrolls');assert.ok(r.lockIn,look+': the lock chip can be scrolled into view');
 }
});
test('«Продолжить» stands at the same height as the h1 of «Персонажи» in every look',{skip:skip()},async()=>{
 for(const look of ['native','board','cyber'])for(const w of [390,1280]){
  const {ctx,page}=await open(look,w,'#/overview');
  const a=await page.evaluate(()=>Math.round(document.querySelector('.home-continue h1,.home h1').getBoundingClientRect().top));
  await page.goto(base+'#/characters');await page.waitForTimeout(800);
  const b=await page.evaluate(()=>Math.round(document.querySelector('main h1,h1').getBoundingClientRect().top));
  await ctx.close();assert.equal(a,b,look+' '+w);
 }
});
test('the role select of the sheet is 44 px high in cyber at 1280',{skip:skip()},async()=>{
 const {ctx,page}=await open('cyber',1280,'#/sheet/v1');
 const h=await page.evaluate(()=>document.querySelector('select[data-field="role"]').getBoundingClientRect().height);
 await ctx.close();assert.ok(h>=44,'height '+h);
});

/* ---------- the shake switch follows the sensor, not the pointer ---------- */
function settings(extra){const listeners={};
 const win={document:{addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[],documentElement:{lang:'ru'}},addEventListener:(t,f)=>{(listeners[t]=listeners[t]||[]).push(f)},matchMedia:()=>({matches:false}),
  App:{lang:()=>'ru'},DiceFeel:{supported:()=>true,controls:()=>'',t:()=>''},localStorage:{getItem:()=>null,setItem(){},removeItem(){},key:()=>null,length:0},...extra};
 try{vm.runInNewContext(src('settings.js'),{window:win,setTimeout,clearTimeout,Date,JSON,Math,Object,Array,Promise,console})}catch(e){}
 return{S:win.Settings,fire:(t,e)=>(listeners[t]||[]).forEach(f=>f(e)),win}}
test('shake switch: a real motion reading enables it even without a coarse pointer; an all-null reading disables it even with one',()=>{
 const a=settings();assert.ok(a.S,'settings loaded');
 assert.equal(a.S._test.shakeUsable(),false);
 a.fire('devicemotion',{accelerationIncludingGravity:{x:0.1,y:9.8,z:0.2},rotationRate:{}});
 assert.equal(a.S._test.shakeUsable(),true,'a sensor was seen');
 const b=settings({matchMedia:q=>({matches:q==='(pointer: coarse)'})});
 assert.equal(b.S._test.shakeUsable(),true,'unknown yet: the pointer decides');
 b.fire('devicemotion',{accelerationIncludingGravity:{x:null,y:null,z:null},rotationRate:{alpha:null,beta:null,gamma:null}});
 assert.equal(b.S._test.shakeUsable(),false,'the event came empty: no sensor');
 const c=settings({DeviceMotionEvent:{requestPermission(){}}});
 assert.equal(c.S._test.shakeUsable(),true,'iOS asks for permission: a sensor is there');
});
