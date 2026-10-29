const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=name=>fs.readFileSync(__dirname+'/../public/game/'+name,'utf8');
function harness(){
 const saves=[],node=()=>({innerHTML:'',listeners:{},addEventListener(k,f){this.listeners[k]=f},setAttribute(){}}),nodes={'#app':node(),'#sync-root':node(),'#sync-adapter-status':node(),'#app-notice':{textContent:'',classList:{add(){},remove(){}}}};
 const w={ROLES:[],CombatTools:{handle:()=>false},SyncAdapter:{create(){return{start(){},stateLabel:()=>'',getScope:()=> 'qa',canEdit:()=>true,save:s=>{saves.push(s);return Promise.resolve({ok:true})}}}}};
 const ctx={window:w,document:{querySelector:s=>nodes[s]||null,documentElement:{},title:''},localStorage:{getItem:()=>null},globalThis:{crypto:{randomUUID:()=> 'unused'}},console,Math,JSON,Set,Number,String,Array,Object,Promise,setTimeout:()=>0,clearTimeout(){}};
 vm.createContext(ctx);vm.runInContext(src('hazard-tools.js'),ctx);vm.runInContext(src('app.js')+'\nwindow.qa={enter:()=>{state.view="combat"}};',ctx);w.qa.enter();
 const fields={'[data-hz-poison-will]':{value:'6'},'[data-hz-poison-skill]':{value:'4'},'[data-hz-poison-mod]':{value:'0'},'[data-hz-resist]':{value:'0',dataset:{}},'[data-hz-result="poison"]':{textContent:'previous effect'},'[data-hz-result="poison-resist-roll"]':{textContent:''}},root={querySelector(s){return fields[s]||null}},button={dataset:{hzAction:'poison-resist-roll'},closest:s=>s==='[data-hazard-root]'?root:null},target={closest:s=>s==='[data-hz-action]'?button:null};
 const input={matches:s=>s.split(',').includes('[data-hz-poison-will]'),closest:s=>s==='[data-hazard-root]'?root:null};
 return {fields,nodes,saves,target,input};
}
test('actual dispatcher routes hazard roll and invalidates stale output on input without saving',()=>{
 const h=harness(),random=Math.random;try{Math.random=()=>.5;h.nodes['#app'].listeners.click({type:'click',target:h.target});assert.equal(h.fields['[data-hz-resist]'].value,'16');assert.match(h.fields['[data-hz-result="poison-resist-roll"]'].textContent,/16/);h.fields['[data-hz-result="poison"]'].textContent='stale';h.nodes['#app'].listeners.input({type:'input',target:h.input});assert.equal(h.fields['[data-hz-resist]'].value,'');assert.equal(h.fields['[data-hz-result="poison-resist-roll"]'].textContent,'');assert.equal(h.fields['[data-hz-result="poison"]'].textContent,'');assert.equal(h.saves.length,0)}finally{Math.random=random}
});
test('actual dispatcher routes change events and leaves a manual result intact',async()=>{
 const h=harness();h.fields['[data-hz-resist]'].value='12';h.fields['[data-hz-result="poison"]'].textContent='stale';await h.nodes['#app'].listeners.change({type:'change',target:h.input});assert.equal(h.fields['[data-hz-resist]'].value,'12');assert.equal(h.fields['[data-hz-result="poison"]'].textContent,'');assert.equal(h.saves.length,0)
});
