const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=name=>fs.readFileSync(__dirname+'/../public/game/'+name,'utf8');
function harness(){
 const npc={id:'npc-source',template:'bodyguard',name:'Patrol',hp:17,notes:'private',armorTrack:{version:1,head:6,body:5},future:{marker:'keep'}};
 const pc={id:'pc-1',name:'Rook',role:'solo',rank:4,stats:{INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{Handgun:4},hp:27,humanity:52,head:7,bodyArmor:8};
 const campaign={id:'campaign-1',name:'Job',notes:'private job',round:3,turnIndex:0,roster:[{id:'combat-pc',kind:'pc',characterId:'pc-1',initiative:9}]};
 const data={characters:[pc],campaigns:[campaign],gmWorkspace:{time:'day',zone:'moderate',party:4,roll:null,roster:[npc]},future:{keep:true}},saved=[];
 let scope='alice',onConfirm=()=>true;const node=()=>({innerHTML:'',listeners:{},addEventListener(k,f){this.listeners[k]=f},setAttribute(){}}),nodes={'#app':node(),'#sync-root':node(),'#sync-adapter-status':node(),'#app-notice':{textContent:'',classList:{add(){},remove(){}}}};
 const w={Book:{handle:()=>false},ROLES:[{id:'solo',name:{ru:'Соло',en:'Solo'}}],CharacterExtra:{specializationCost:()=>0},SyncAdapter:{create(){return{start(){},stateLabel:()=>'',getScope:()=>scope,canEdit:()=>true,save:s=>{saved.push(JSON.parse(JSON.stringify(s)));return Promise.resolve({ok:true})}}}}};
 const ctx={window:w,document:{querySelector:s=>nodes[s]||null,documentElement:{},title:''},localStorage:{getItem:()=>JSON.stringify(data)},globalThis:{crypto:{randomUUID:()=> 'campaign-copy-id'}},console,Math,JSON,Set,Number,String,Array,Object,Promise,setTimeout:()=>0,clearTimeout(){},confirm:()=>onConfirm()};
 vm.createContext(ctx);for(const f of ['combat-tools.js','damage-apply.js','gm-tools.js','campaigns.js'])vm.runInContext(src(f),ctx);vm.runInContext(src('app.js')+'\nwindow.qa={snapshot:snapshotAppState,enter:()=>{state.view="campaigns";window.Campaigns.setScope("alice");render()}};',ctx);w.qa.enter();
 const open={isConnected:true,dataset:{campaignAction:'open',id:'campaign-1'},closest:s=>s==='[data-campaign-action]'?open:null};nodes['#app'].listeners.click({type:'click',target:{closest:s=>s==='[data-campaign-action]'?open:null}});
 const select={value:'npc-source',isConnected:true},refInput={value:'6',isConnected:true},root={isConnected:true,dataset:{campaignGmEpoch:'1'},querySelector:s=>s==='[data-campaign-gm-npc]'?select:s==='[data-campaign-gm-ref]'?refInput:null},button={isConnected:true,dataset:{campaignAction:'add-gm-npc'},closest:s=>s==='[data-campaign-gm-root]'?root:s==='[data-campaign-action]'?button:null};
 return {w,nodes,saved,data,root,select,button,scope:value=>{scope=value},confirm:fn=>{onConfirm=fn},click(){nodes['#app'].listeners.click({type:'click',target:{closest:s=>s==='[data-campaign-action]'?button:null}})}};
}
test('actual dispatcher copies prepared NPC into personal initiative without changing character or GM data',()=>{
 const h=harness(),before=JSON.parse(JSON.stringify(h.w.qa.snapshot()));h.click();assert.equal(h.saved.length,1);const state=h.saved[0];assert.deepEqual(state.characters,before.characters);assert.deepEqual(state.gmWorkspace,before.gmWorkspace);assert.deepEqual(state.future,before.future);assert.equal(state.campaigns[0].roster.length,2);const npc=state.campaigns[0].roster[1];assert.equal(npc.id,'campaign-copy-id');assert.equal(npc.name,'Patrol');assert.equal(npc.hp,17);assert.equal(npc.sourceTemplate,'bodyguard');assert.equal(npc.notes,undefined);assert.equal(npc.armorTrack,undefined);
});
test('actual dispatcher preserves all data on cancelled copy or changed account',()=>{
 for(const mode of ['cancel','scope']){const h=harness(),before=JSON.stringify(h.w.qa.snapshot());h.confirm(()=>{if(mode==='scope')h.scope('bob');return mode!=='cancel'});h.click();assert.equal(h.saved.length,0,mode);assert.equal(JSON.stringify(h.w.qa.snapshot()),before,mode)}
});
