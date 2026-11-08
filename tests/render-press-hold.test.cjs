const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(__dirname+'/../site/app.js','utf8');
function harness(){
 const listeners={},timers=[],node=()=>({innerHTML:'',textContent:'',addEventListener(){},setAttribute(){}}),nodes={'#app':node()};
 const window={ROLES:[{id:'solo',name:{ru:'Соло',en:'Solo'},description:{ru:'',en:''}}],addEventListener(type,fn){(listeners[type]||=[]).push(fn)},EquipmentTools:{setScope(){}},LocalStore:{create(){return {stateLabel:()=>'',start(){},getScope:()=>null}}}};
 const context={window,document:{querySelector:s=>nodes[s]||null,documentElement:{lang:''},title:''},localStorage:{getItem:()=>null},globalThis:{crypto:{randomUUID:()=>'x'}},setTimeout:(fn)=>{timers.push(fn);return timers.length},clearTimeout(){},console,Math,JSON,Set,Number,String,Array,Object,Promise};
 vm.runInNewContext(code+'\nwindow.qa={render,go:v=>{state.view=v}};',context);
 const fire=(type,target)=>{for(const fn of listeners[type]||[])fn({type,button:0,target})};
 const runTimers=()=>{while(timers.length)timers.shift()()};
 return {app:nodes['#app'],qa:window.qa,fire,runTimers};
}
const button={closest:s=>s==='#app'||s.startsWith('button')?{}:null,matches:()=>false};
test('a re-render caused while a button is pressed waits until the click is handled',()=>{
 const h=harness();h.qa.go('dice');h.runTimers();h.app.innerHTML='old';
 h.fire('mousedown',button);h.qa.render();assert.equal(h.app.innerHTML,'old','blur-triggered render must not replace the pressed button');
 h.fire('mouseup',button);h.fire('click',button);assert.equal(h.app.innerHTML,'old');
 h.runTimers();assert.notEqual(h.app.innerHTML,'old','queued render runs right after the click');
});
test('renders are immediate without a pressed button, and a click handler render is not delayed',()=>{
 const h=harness();h.qa.go('dice');h.app.innerHTML='old';h.qa.render();assert.notEqual(h.app.innerHTML,'old');
 h.app.innerHTML='old';h.fire('mousedown',button);h.fire('mouseup',button);h.fire('click',button);h.qa.render();assert.notEqual(h.app.innerHTML,'old');
});
