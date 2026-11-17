const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=name=>fs.readFileSync(__dirname+'/../site/'+name,'utf8');
function setup(){
 const handlers={},saved=[],node=()=>({innerHTML:'',addEventListener(type,fn){handlers[type]=fn},setAttribute(){}}),nodes={'#app':node(),'#sync-root':node(),'#sync-adapter-status':node(),'#app-notice':{textContent:'',classList:{add(){},remove(){}},append(b){this.last=b}}};let scope='account-a',whenConfirm=()=>true;
 const character={id:'person',name:'Nova',role:'solo',rank:4,stats:{INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{},hp:45,humanity:60,extra:{life:{culture:'Manual origin'}}},campaign={id:'campaign',name:'First job',notes:'Keep',round:1,turnIndex:0,roster:[{id:'npc',kind:'npc',name:'Guard',initiative:5}]};
 const w={ROLES:[{id:'solo',name:{en:'Solo',ru:'Соло'},description:{en:'',ru:''},ability:{en:'Combat',ru:'Бой'}}],CharacterExtra:{specializationCost:()=>0},CombatTools:{handle:()=>false},Book:{handle:()=>false},NetTools:{setScope(){},validArchitectures:Array.isArray},EquipmentTools:{setScope(){}},LocalStore:{create(){return{start(){},getScope:()=>scope,stateLabel:()=>'',canEdit:()=>scope!==null,save(value){saved.push(JSON.parse(JSON.stringify(value)));return Promise.resolve({ok:true})}}}},scrollTo(){}};
 const context={window:w,document:{querySelector:key=>nodes[key]||null,createElement:()=>({clicks:[],addEventListener(t,fn){this.clicks.push(fn)}}),documentElement:{},title:''},localStorage:{getItem:()=>JSON.stringify({characters:[character],campaigns:[campaign],lang:'en'})},globalThis:{crypto:{randomUUID:()=> 'uuid'}},confirm:()=>whenConfirm(),setTimeout:()=>0,clearTimeout(){},console,Math,Date,JSON,Set,Number,String,Array,Object,Promise};vm.createContext(context);
 for(const name of ['lifepath.js','campaigns.js'])vm.runInContext(src(name),context);vm.runInContext(src('app.js')+'\nwindow.qa={go:view=>{state.view=view;render()},snapshot:snapshotAppState,apply:applySyncedSnapshot,restore:restoreFromBin,move:moveCampaignToBin,state:()=>state};',context);
 return {w,saved,nodes,setScope:x=>scope=x,onConfirm:fn=>whenConfirm=fn,dispatch(type,target){handlers[type]({type,target})}};
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
test('actual campaign handler moves a deleted campaign to the bin, and the bin brings it back whole',()=>{
 const h=setup();h.w.qa.go('campaigns');const event=(action,id)=>({closest:s=>s==='[data-campaign-action]'?{dataset:{campaignAction:action,id}}:null});h.dispatch('click',event('open','campaign'));
 h.onConfirm(()=>{throw new Error('a deleted campaign goes to the bin; there is no browser dialog')});h.dispatch('click',event('delete'));
 let snap=h.w.qa.snapshot();assert.equal(snap.campaigns.length,0);assert.equal(snap.bin.length,1);assert.equal(snap.bin[0].kind,'campaign');assert.equal(snap.bin[0].campaign.notes,'Keep');assert.ok(h.saved.length>=1);
 const r=h.w.qa.restore(snap.bin[0].id);assert.equal(r.ok,true);assert.equal(r.campaign,true);snap=h.w.qa.snapshot();assert.equal(snap.campaigns.length,1);assert.equal(snap.campaigns[0].name,'First job');assert.equal(snap.campaigns[0].roster.length,1);assert.equal(snap.bin,undefined);
});
test('a bin entry of a campaign passes the saved-data validator and a broken one is refused',()=>{
 const h=setup(),entry={id:'b1',at:Date.now(),kind:'campaign',index:0,campaign:{id:'k',name:'X',roster:[]}};
 h.w.qa.apply({...h.w.qa.snapshot(),bin:[entry]});assert.equal(h.w.qa.snapshot().bin[0].kind,'campaign');
 assert.throws(()=>h.w.qa.apply({...h.w.qa.snapshot(),bin:[{...entry,campaign:{id:'k',name:7,roster:[]}}]}));
 assert.throws(()=>h.w.qa.apply({...h.w.qa.snapshot(),bin:[{id:'b2',at:Date.now(),kind:'campaign'}]}));
});

test('deleting a campaign shows an undo toast; pressing it brings the campaign back at its old place',()=>{
 const h=setup();h.w.qa.go('campaigns');const event=(action,id)=>({closest:s=>s==='[data-campaign-action]'?{dataset:{campaignAction:action,id}}:null});h.dispatch('click',event('open','campaign'));
 h.dispatch('click',event('delete'));assert.equal(h.w.qa.snapshot().campaigns.length,0);
 const undo=h.nodes['#app-notice'].last;assert.ok(undo&&undo.clicks.length===1,'the notice carries an undo button');
 undo.clicks[0]();const snap=h.w.qa.snapshot();assert.equal(snap.campaigns.length,1);assert.equal(snap.campaigns[0].name,'First job');assert.equal((snap.bin||[]).length,0);
});
test('a campaign in the bin is dropped after 30 days, like a character',()=>{
 const h=setup(),state=h.w.qa.state(),day=864e5,k=state.campaigns[0];
 h.w.qa.move(k,Date.now());assert.equal(h.w.qa.state().bin.length,1);
 const again={...JSON.parse(JSON.stringify(k)),id:'second'};h.w.qa.state().campaigns.push(again);
 h.w.qa.move(h.w.qa.state().campaigns.find(x=>x.id==='second'),Date.now()+29*day);assert.equal(h.w.qa.state().bin.length,2,'29 days later the first is still kept');
 const third={...JSON.parse(JSON.stringify(k)),id:'third'};h.w.qa.state().campaigns.push(third);
 h.w.qa.move(h.w.qa.state().campaigns.find(x=>x.id==='third'),Date.now()+31*day);
 const left=h.w.qa.state().bin;assert.equal(left.length,2,'the entry older than 30 days is purged, the newer one stays');assert.ok(!left.some(e=>e.campaign.id==='campaign'));
});
