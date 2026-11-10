// A skill roll updates the open sheet in place (LUCK, next-roll fields, HUD); the page is rebuilt only when it has to be.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=n=>fs.readFileSync(__dirname+'/../site/'+n,'utf8');
function harness({layout=true,extra={}}={}){
 let builds=0,html='',hud=0;const events={},saved=[],notices=[];
 const app={get innerHTML(){return html},set innerHTML(v){html=v;builds++},addEventListener(k,f){events[k]=f},setAttribute(){},contains:()=>false,querySelector:()=>null,querySelectorAll:()=>[]};
 const node=()=>({innerHTML:'',addEventListener(){},setAttribute(){}});
 const nodes={'#app':app,'#sync-root':node(),'#sync-adapter-status':node(),'#app-notice':{set textContent(v){notices.push(v)},classList:{add(){},remove(){}}}};
 const fields={luck:{value:'?'},luckUse:{value:'?'},modifier:{value:'?'}};
 const sheet={isConnected:true,querySelector:s=>{const m=s.match(/^\[data-cx-field="(\w+)"\]$/);return m?fields[m[1]]||null:null}};
 const math=Object.create(Math);math.random=()=>0.5;
 const w={ROLES:[{id:'solo',name:{ru:'Соло',en:'Solo'},description:{ru:'',en:''},ability:{ru:'Бой',en:'Combat'}}],Book:{handle:()=>false},Campaigns:{handle:()=>false},CombatTools:{handle:()=>false},NetTools:{setScope(){},validArchitectures:Array.isArray},
  SheetTabs:{refreshHud(){hud++},takeDV:()=>0},
  LocalStore:{create(){return {start(){},getScope:()=>'account',stateLabel:()=>'',canEdit:()=>true,save(s){saved.push(JSON.parse(JSON.stringify(s)));return Promise.resolve({ok:true})}}}},confirm:()=>true,scrollTo(){}};
 const c={id:'p',name:'Test',role:'solo',rank:4,stats:{INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{Athletics:2,Evasion:4},hp:45,humanity:60,head:0,bodyArmor:0,extra:{luck:5,luckUse:2,modifier:3,...extra}};
 const document={querySelector:s=>s==='.sheet-layout'?(layout?sheet:null):nodes[s]||null,querySelectorAll:()=>[],documentElement:{classList:{contains:()=>false}},title:'',activeElement:null,body:{}};
 const context={window:w,document,localStorage:{getItem:()=>JSON.stringify({characters:[c],campaigns:[],lang:'en'})},globalThis:{crypto:{randomUUID:()=>'id'},addEventListener(){}},confirm:()=>true,setTimeout:()=>0,clearTimeout(){},console,Math:math,Date,JSON,Set,Number,String,Array,Object,Promise};
 vm.createContext(context);
 for(const f of ['character-extra.js'])vm.runInContext(source(f),context,{filename:f});
 vm.runInContext(source('app.js')+'\nwindow.qa={open:()=>{state.active="p";state.view="sheet";render()},view:v=>{state.view=v},character:()=>active(),history:()=>state.history};',context);
 w.qa.open();
 const roll=skill=>{const b={dataset:{action:'skill-roll',skill},isConnected:true,closest:s=>s==='[data-action]'?b:null};events.click({type:'click',target:{closest:s=>s==='[data-action]'?b:null},preventDefault(){}})};
 return {w,roll,fields,saved,notices,sheet,get builds(){return builds},get hud(){return hud},character:()=>w.qa.character(),history:()=>w.qa.history()};
}

test('a roll on the open sheet does not rebuild the page',()=>{
 const h=harness(),before=h.builds;h.roll('Athletics');
 assert.equal(h.history().length,1);assert.equal(h.builds,before,'#app was not rewritten');
 assert.ok(h.hud>0,'the HUD was refreshed');assert.ok(h.saved.length>0,'the roll was saved');assert.ok(h.notices.length>0,'the result was shown');
});

test('the fields of «Resources» get the values left after the roll',()=>{
 const h=harness();h.roll('Athletics');
 const x=h.character().extra;assert.equal(x.luck,3);assert.equal(x.luckUse,0);assert.equal(x.modifier,0);
 assert.deepEqual([h.fields.luck.value,h.fields.luckUse.value,h.fields.modifier.value],['3','0','0']);
});

test('the roll itself still counts the modifier and the LUCK that were set',()=>{
 const h=harness();h.roll('Athletics');
 const r=h.history()[0];assert.match(r.label,/Athletics/);assert.match(r.label,/LUCK \+2/);
 // random 0.5 is a 6 on the d10: 6 + DEX 6 + skill 2 + modifier 3 + LUCK 2
 assert.equal(r.total,19);
});

test('a pinned modifier stays in the field',()=>{
 const h=harness({extra:{modifierHold:true}});h.roll('Evasion');
 assert.equal(h.character().extra.modifier,3);assert.equal(h.fields.modifier.value,'3');assert.equal(h.fields.luckUse.value,'0');
});

test('without a sheet on the page the page is rebuilt as before',()=>{
 const h=harness({layout:false}),before=h.builds;h.roll('Athletics');
 assert.equal(h.history().length,1);assert.equal(h.builds,before+1);
});

test('a sheet element that is no longer in the document is not trusted',()=>{
 const h=harness(),before=h.builds;h.sheet.isConnected=false;h.roll('Athletics');
 assert.equal(h.builds,before+1);
});

test('an unknown skill rolls nothing and changes nothing',()=>{
 const h=harness(),before=h.builds;h.roll('No Such Skill');
 assert.equal(h.history().length,0);assert.equal(h.builds,before);assert.equal(h.character().extra.luck,5);
});
