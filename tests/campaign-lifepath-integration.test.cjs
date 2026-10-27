const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=name=>fs.readFileSync(__dirname+'/../public/game/'+name,'utf8');
function setup(){
 const handlers={},saved=[],node=()=>({innerHTML:'',addEventListener(type,fn){handlers[type]=fn},setAttribute(){}}),nodes={'#app':node(),'#sync-root':node(),'#sync-adapter-status':node(),'#app-notice':{textContent:'',classList:{add(){},remove(){}}}};let scope='account-a',whenConfirm=()=>true;
 const character={id:'person',name:'Nova',role:'solo',rank:4,stats:{INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{},hp:45,humanity:60,extra:{life:{culture:'Manual origin'}}},campaign={id:'campaign',name:'First job',notes:'Keep',round:1,turnIndex:0,roster:[{id:'npc',kind:'npc',name:'Guard',initiative:5}]};
 const w={ROLES:[{id:'solo',name:{en:'Solo',ru:'Соло'},description:{en:'',ru:''},ability:{en:'Combat',ru:'Бой'}}],CharacterExtra:{specializationCost:()=>0},CombatTools:{handle:()=>false},Book:{handle:()=>false},NetTools:{setScope(){},validArchitectures:Array.isArray},EquipmentTools:{setScope(){}},SyncAdapter:{create(){return{start(){},getScope:()=>scope,stateLabel:()=>'',canEdit:()=>scope!==null,save(value){saved.push(JSON.parse(JSON.stringify(value)));return Promise.resolve({ok:true})}}}},scrollTo(){}};
 const context={window:w,document:{querySelector:key=>nodes[key]||null,documentElement:{},title:''},localStorage:{getItem:()=>JSON.stringify({characters:[character],campaigns:[campaign],lang:'en'})},globalThis:{crypto:{randomUUID:()=> 'uuid'}},confirm:()=>whenConfirm(),setTimeout:()=>0,clearTimeout(){},console,Math,Date,JSON,Set,Number,String,Array,Object,Promise};vm.createContext(context);
 for(const name of ['lifepath.js','campaigns.js'])vm.runInContext(src(name),context);vm.runInContext(src('app.js')+'\nwindow.qa={go:view=>{state.view=view;render()},snapshot:snapshotAppState,apply:applySyncedSnapshot};',context);
 return {w,saved,setScope:x=>scope=x,onConfirm:fn=>whenConfirm=fn,dispatch(type,target){handlers[type]({type,target})}};
}
test('actual Lifepath handler refuses an old character after hydration during confirmation',()=>{
 const h=setup();h.w.qa.go('lifepath');h.w.Lifepath.setChoice('culture',1);h.dispatch('change',{value:'person',dataset:{},hasAttribute:k=>k==='data-lp-target',closest:()=>null});
 h.onConfirm(()=>{h.w.qa.apply(h.w.qa.snapshot());return true});h.dispatch('click',{closest:s=>s==='[data-lp-action]'||s==='[data-lp-action="apply"]'?{dataset:{lpAction:'apply'}}:null});
 assert.equal(h.saved.length,0);assert.equal(h.w.qa.snapshot().characters[0].extra.life.culture,'Manual origin');
});
test('actual Lifepath handler refuses a changed account during confirmation',()=>{
 const h=setup();h.w.qa.go('lifepath');h.w.Lifepath.setChoice('culture',1);h.dispatch('change',{value:'person',dataset:{},hasAttribute:k=>k==='data-lp-target',closest:()=>null});
 h.onConfirm(()=>{h.setScope('account-b');return true});h.dispatch('click',{closest:s=>s==='[data-lp-action]'||s==='[data-lp-action="apply"]'?{dataset:{lpAction:'apply'}}:null});
 assert.equal(h.saved.length,0);assert.equal(h.w.qa.snapshot().characters[0].extra.life.culture,'Manual origin');
});
test('actual campaign handler refuses removal after its snapshot is replaced',()=>{
 const h=setup();h.w.qa.go('campaigns');const event=(action,id)=>({closest:s=>s==='[data-campaign-action]'?{dataset:{campaignAction:action,id}}:null});h.dispatch('click',event('open','campaign'));
 h.onConfirm(()=>{h.w.qa.apply(h.w.qa.snapshot());return true});h.dispatch('click',event('delete'));assert.equal(h.saved.length,0);assert.equal(h.w.qa.snapshot().campaigns.length,1);assert.equal(h.w.qa.snapshot().campaigns[0].notes,'Keep');
});
