const fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test'),assert=require('node:assert/strict');
const source=f=>fs.readFileSync(__dirname+'/../public/game/'+f,'utf8');
function harness(){
 const events={},saved=[],node=()=>({innerHTML:'',addEventListener(k,fn){events[k]=fn},setAttribute(){}}),nodes={'#app':node(),'#sync-root':node(),'#sync-adapter-status':node(),'#app-notice':{textContent:'',classList:{add(){},remove(){}}}};
 const window={scrollTo(){},Book:{handle:()=>false},Campaigns:{handle:()=>false},CombatTools:{handle:()=>false},EquipmentTools:{render:()=>'',setScope(){},handle:()=>({handled:false})},SyncAdapter:{create(){return {start(){},getScope:()=> 'owner',stateLabel:()=>'',canEdit:()=>true,save(value){saved.push(JSON.parse(JSON.stringify(value)));return Promise.resolve({ok:true})}}}}};
 const context={window,document:{querySelector:s=>nodes[s]||null,documentElement:{},title:''},localStorage:{getItem:()=>null},globalThis:{addEventListener(){}},setTimeout:()=>0,clearTimeout(){},console,Math,Date,JSON,Set,Number,String,Array,Object,Promise};vm.createContext(context);vm.runInContext(source('check-modifiers.js'),context);vm.runInContext(source('app.js')+'\nwindow.qa={start:()=>{state.lang="en";state.view="dice";state.characters=[{id:"c1",name:"Choom",extra:{items:[{id:"i1",name:"gear"}]}}];state.campaigns=[{id:"campaign",notes:"preserve"}]},snapshot:snapshotAppState};',context);window.qa.start();
 const fields={'[data-cm-result]':{textContent:''},'[data-cm-manual]':{value:'0'},'[data-cm-complementary]':{checked:true},'[data-cm-time]':{checked:false}},boxes=[{dataset:{cmCondition:'stress'}},{dataset:{cmCondition:'lowLight'}}],root={querySelector:s=>fields[s],querySelectorAll:()=>boxes},button={dataset:{cmAction:'calculate'},closest:s=>s==='[data-cm-root]'?root:null};
 function click(){events.click({type:'click',target:{closest:s=>s==='[data-cm-action]'?button:null}})}
 function edit(type){const el=fields['[data-cm-manual]'];el.dataset={};el.matches=s=>s.split(',').includes('[data-cm-manual]');el.closest=s=>s==='[data-cm-root]'?root:null;events[type]({type,target:el})}
 return {window,saved,fields,click,edit};
}
test('actual click dispatcher calculates the optional modifiers without changing sheets or campaigns',()=>{
 const h=harness(),before=JSON.stringify(h.window.qa.snapshot());h.click();assert.equal(h.fields['[data-cm-result]'].textContent,'Total modifier: -2');assert.equal(JSON.stringify(h.window.qa.snapshot()),before);assert.equal(h.saved.length,0);
});
test('actual input and change dispatchers discard the stale total without saving',()=>{
 for(const type of ['input','change']){const h=harness(),before=JSON.stringify(h.window.qa.snapshot());h.click();h.fields['[data-cm-manual]'].value='3';h.edit(type);assert.match(h.fields['[data-cm-result]'].textContent,/Select conditions/);assert.equal(JSON.stringify(h.window.qa.snapshot()),before);assert.equal(h.saved.length,0)}
});
