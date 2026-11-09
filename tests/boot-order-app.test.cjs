const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const site=path.join(__dirname,'..','site'),SCRIPTS=[...fs.readFileSync(path.join(site,'index.html'),'utf8').matchAll(/<script src="([^":?]+\.js)"><\/script>/g)].map(m=>m[1]);
const sheet=(id,name)=>({id,name,role:'solo',rank:4,stats:{INT:6,REF:7,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{Evasion:4},hp:45,humanity:60,head:11,bodyArmor:11});
// Loads every script of index.html in order, as the page does, with a small fake DOM. A script left out (or one that throws
// while loading) leaves its window.X undefined, like a module that failed to load in the bundle.
function boot({hash='#/overview',data={characters:[sheet('v1','Vee')],campaigns:[],lang:'ru'},skip=[],store=null,clock=null}={}){
 const listeners={},on=key=>(type,fn)=>{(listeners[key+':'+type]||(listeners[key+':'+type]=[])).push(fn)};
 const el=()=>{const e={innerHTML:'',textContent:'',hidden:false,dataset:{},style:{},children:[],classList:{add(){},remove(){},toggle(){},contains:()=>false},setAttribute(){},getAttribute:()=>null,removeAttribute(){},hasAttribute:()=>false,addEventListener:on('el'),removeEventListener(){},querySelector:()=>null,querySelectorAll:()=>[],appendChild:x=>x,append(){},remove(){},closest:()=>null,contains:()=>false,isConnected:true};return e};
 const app=el(),nodes={'#app':app,'#store-status':el()};app.addEventListener=on('app');let html='';app.writes=[];Object.defineProperty(app,'innerHTML',{get:()=>html,set:v=>{html=String(v);app.writes.push(html)}});
 const saved={'nightcity-red-v1':JSON.stringify(data)},storage={getItem:k=>Object.hasOwn(saved,k)?saved[k]:null,setItem:(k,v)=>{saved[k]=String(v)},removeItem:k=>{delete saved[k]},key:i=>Object.keys(saved)[i]??null,get length(){return Object.keys(saved).length}};
 const RealDate=Date,FakeDate=class extends RealDate{static now(){return clock?clock.now:RealDate.now()}};
 const w={document:{readyState:'complete',documentElement:el(),body:el(),head:el(),title:'',querySelector:s=>nodes[s]||null,querySelectorAll:()=>[],getElementById:id=>nodes['#'+id]||null,createElement:()=>el(),createTreeWalker:()=>({nextNode:()=>null}),addEventListener:on('doc'),removeEventListener(){},activeElement:null,visibilityState:'visible'},
  localStorage:storage,sessionStorage:storage,location:{hash,href:'http://x/'+hash,pathname:'/',search:'',origin:'http://x',reload(){}},history:{pushState(_,__,h){w.location.hash=h},replaceState(_,__,h){w.location.hash=h}},navigator:{userAgent:'node',language:'ru'},
  matchMedia:()=>({matches:false,addEventListener(){},addListener(){}}),MutationObserver:class{observe(){}disconnect(){}},addEventListener:on('win'),removeEventListener(){},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},requestAnimationFrame:()=>0,scrollTo(){},confirm:()=>true,prompt(){},getComputedStyle:()=>({}),
  console:{log(){},warn(){},error(){}},Math,Date:FakeDate,JSON,Set,Map,WeakMap,WeakSet,Number,String,Array,Object,Promise,Symbol,RegExp,Error,TypeError,URL,URLSearchParams,TextEncoder,TextDecoder,Intl,crypto:{randomUUID:()=>'id-'+Math.random().toString(36).slice(2)}};
 w.window=w;w.globalThis=w;w.self=w;vm.createContext(w);
 for(const f of SCRIPTS){if(skip.includes(f)||f==='app.js')continue;try{vm.runInContext(fs.readFileSync(path.join(site,f),'utf8'),w,{filename:f})}catch{}}
 if(store)w.LocalStore=store;
 vm.runInContext(fs.readFileSync(path.join(site,'app.js'),'utf8')+'\n;window.__qa={state:()=>state};',w,{filename:'app.js'});
 const fire=(key,type,event)=>{for(const fn of listeners[key+':'+type]||[]){if(event.stopped)break;fn(event)}};
 // A click goes through the window capture listeners first, then the #app listener, as in the page.
 const click=(target,extra={})=>{const event={type:'click',target,detail:0,clientX:0,clientY:0,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true},stopImmediatePropagation(){this.stopped=true},...extra};fire('win','click',event);fire('app','click',event);return event};
 const button=dataset=>{const b={dataset,isConnected:true,hasAttribute:()=>false,matches:()=>false};b.closest=s=>s==='#app'?app:/\[data-action\]/.test(s)&&dataset.action?b:null;return b};
 const send=(type,target)=>{const event={type,target};fire('app',type,event);return event};
 return {w,app,saved,click,send,button,state:()=>w.__qa.state()};
}
const blocks=html=>({damage:html.includes('data-da-root'),drugs:html.includes('data-drug-root'),injuries:html.includes('data-ci-root')});

test('a sheet opened by its link or a reload draws damage, drugs and critical injuries at once',()=>{
 for(const lang of ['ru','en']){const h=boot({hash:'#/sheet/v1',data:{characters:[sheet('v1','Vee')],campaigns:[],lang}});assert.equal(h.state().view,'sheet');assert.deepEqual(blocks(h.app.innerHTML),{damage:true,drugs:true,injuries:true},lang)}
});

test('an English sheet opened by its link draws the portrait and contacts in English',()=>{
 const h=boot({hash:'#/sheet/v1',data:{characters:[sheet('v1','Vee')],campaigns:[],lang:'en'}}),html=h.app.innerHTML;
 assert.match(html,/Upload portrait/);assert.match(html,/CONTACTS &amp; GOALS|CONTACTS & GOALS/);
 assert.doesNotMatch(html,/Загрузить портрет|КОНТАКТЫ И ЦЕЛИ/);
 const ru=boot({hash:'#/sheet/v1',data:{characters:[sheet('v1','Vee')],campaigns:[],lang:'ru'}}).app.innerHTML;
 assert.match(ru,/Загрузить портрет/);assert.match(ru,/КОНТАКТЫ И ЦЕЛИ/);
});

test('a scope that arrives after the first render redraws the scope-dependent blocks of the sheet',()=>{
 let scope=null,options;const store={create(o){options=o;return {start(){},save:()=>Promise.resolve({ok:true}),flush:()=>({ok:true}),canEdit:()=>!!scope,getScope:()=>scope,stateLabel:()=>'',hasQueued:()=>false,refreshLanguage(){},copies:()=>[]}}};
 const h=boot({hash:'#/sheet/v1',store});
 assert.deepEqual(blocks(h.app.innerHTML),{damage:false,drugs:false,injuries:false}); // paused: nothing can be edited yet
 scope='local';options.onScopeChange(scope);
 assert.deepEqual(blocks(h.app.innerHTML),{damage:true,drugs:true,injuries:true});
});

test('the app draws its first view once, after the store has started',()=>{
 for(const hash of ['#/net','#/gm','#/medical','#/sheet/v1','#/characters']){
  const h=boot({hash});assert.equal(h.app.writes.length,1,hash);assert.doesNotMatch(h.app.writes[0],/Подождите, данные ещё загружаются/,hash);
 }
});

const MODULES=[['combat-tools.js','CombatTools'],['book.js','Book'],['campaigns.js','Campaigns'],['equipment-tools.js','EquipmentTools'],['character-extra.js','CharacterExtra'],['role-tools.js','RoleTools']];
test('a module that failed to load only takes its own feature: navigation and a skill roll still work',()=>{
 for(const [file,name] of MODULES){
  const h=boot({hash:'#/sheet/v1',skip:[file]});
  assert.equal(h.w[name],undefined,name);assert.equal(h.state().view,'sheet',name);assert.match(h.app.innerHTML,/data-action="skill-roll"/,name);
  const before=h.state().history.length;h.click(h.button({action:'skill-roll',skill:'Evasion'}));
  assert.equal(h.state().history.length,before+1,name+': skill roll');assert.match(h.state().history[0].label,/Уклонение/,name);
  const stat={dataset:{stat:'REF'},value:'8',type:'number',isConnected:true,closest:()=>null,hasAttribute:()=>false,matches:()=>false};h.send('input',stat);assert.equal(h.state().characters[0].stats.REF,8,name+': stat edit');
  for(const view of ['rules','combat','campaigns','book','catalog','characters','overview']){
   h.click(h.button({action:'navigate',view}));assert.equal(h.state().view,view,name+' → '+view);assert.match(h.app.innerHTML,/class="app-shell"/,name+' → '+view);assert.doesNotMatch(h.app.innerHTML,/undefined/,name+' → '+view);
  }
  h.click(h.button({action:'open',id:'v1'}));assert.equal(h.state().view,'sheet',name);
  h.click(h.button({action:'skill-roll',skill:'Evasion'}));assert.equal(h.state().history.length,before+2,name+': second roll');
 }
});

test('a view whose module is missing shows a notice in the page language and keeps the menu',()=>{
 for(const lang of ['ru','en']){
  const h=boot({hash:'#/campaigns',skip:['campaigns.js'],data:{characters:[],campaigns:[],lang}});
  assert.match(h.app.innerHTML,lang==='ru'?/Не удалось показать этот раздел\. Обновите страницу/:/This section could not be shown\. Reload the page/);
  assert.match(h.app.innerHTML,/data-action="navigate"/);
  h.click(h.button({action:'navigate',view:'dice'}));assert.equal(h.state().view,'dice');
 }
});

test('a second tap at the same spot right after a view change is dropped, other taps are not',()=>{
 const clock={now:1000},tap=(h,dataset,x,y,detail=1)=>h.click(h.button(dataset),{clientX:x,clientY:y,detail});
 const h=boot({hash:'#/characters',clock}),first=tap(h,{action:'new-blank'},200,300);
 assert.equal(first.stopped,false);assert.equal(h.state().view,'sheet');assert.equal(h.state().characters.length,2);
 clock.now+=120;const ghost=tap(h,{action:'share-link'},204,297,2); // the sheet's Link button is now under the finger
 assert.equal(ghost.stopped,true);assert.equal(ghost.defaultPrevented,true);assert.equal(h.state().view,'sheet');
 clock.now+=60;assert.equal(tap(h,{action:'navigate',view:'rules'},40,80).stopped,false,'a tap elsewhere goes through');assert.equal(h.state().view,'rules');
 // The same spot works again after 400 ms, and a keyboard press is never dropped.
 const later=boot({hash:'#/characters',clock});tap(later,{action:'new-blank'},200,300);clock.now+=450;
 assert.equal(tap(later,{action:'navigate',view:'rules'},200,300,2).stopped,false,'after 400 ms');assert.equal(later.state().view,'rules');
 const keys=boot({hash:'#/characters',clock});tap(keys,{action:'new-blank'},200,300);clock.now+=50;
 assert.equal(tap(keys,{action:'navigate',view:'rules'},0,0,0).stopped,false,'keyboard');assert.equal(keys.state().view,'rules');
 // Taps that keep the view (switching the language back and forth) are never dropped.
 const same=boot({hash:'#/dice',clock});tap(same,{action:'lang',lang:'en'},200,300);clock.now+=100;
 assert.equal(tap(same,{action:'lang',lang:'ru'},200,300,2).stopped,false,'same view');assert.equal(same.state().lang,'ru');
});
