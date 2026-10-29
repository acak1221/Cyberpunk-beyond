const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=name=>fs.readFileSync(__dirname+'/../public/game/'+name,'utf8');
function harness(){
 const npc={id:'npc-source',template:'bodyguard',name:'Patrol',hp:17,notes:'private',armorTrack:{version:1,head:6,body:5},future:{marker:'keep'}};
 const pc={id:'pc-1',name:'Rook',role:'solo',rank:4,stats:{INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{Handgun:4},hp:27,humanity:52,head:7,bodyArmor:8};
 const campaign={id:'campaign-1',name:'Job',notes:'private job',round:3,turnIndex:0,roster:[{id:'npc-copy-id',kind:'npc',name:'Campaign guard',hp:20,ref:6,initiative:8},{id:'combat-pc',kind:'pc',characterId:'pc-1',initiative:9}]};
 const data={characters:[pc],campaigns:[campaign],gmWorkspace:{time:'day',zone:'moderate',party:4,roll:null,roster:[npc]},future:{keep:true}},saved=[];
 let scope='alice';const node=()=>({innerHTML:'',listeners:{},addEventListener(k,f){this.listeners[k]=f},setAttribute(){}}),nodes={'#app':node(),'#sync-root':node(),'#sync-adapter-status':node(),'#app-notice':{textContent:'',classList:{add(){},remove(){}}}};
 const w={ROLES:[{id:'solo',name:{ru:'Соло',en:'Solo'}}],CharacterExtra:{specializationCost:()=>0},SyncAdapter:{create(){return{start(){},stateLabel:()=>'',getScope:()=>scope,canEdit:()=>true,save:s=>{saved.push(JSON.parse(JSON.stringify(s)));return Promise.resolve({ok:true})}}}}};
 const ctx={window:w,document:{querySelector:s=>nodes[s]||null,documentElement:{},title:''},localStorage:{getItem:()=>JSON.stringify(data)},globalThis:{crypto:{randomUUID:()=> 'npc-copy-id'}},console,Math,JSON,Set,Number,String,Array,Object,Promise,setTimeout:()=>0,clearTimeout(){}};
 vm.createContext(ctx);for(const f of ['combat-tools.js','damage-apply.js','gm-tools.js'])vm.runInContext(src(f),ctx);vm.runInContext(src('app.js')+'\nwindow.qa={snapshot:snapshotAppState,enter:()=>{state.view="gm";render()}};',ctx);w.qa.enter();
 const root={isConnected:true},button={isConnected:true,dataset:{gm:'duplicate',index:'0'},closest:s=>s==='[data-gm-root]'?root:s==='[data-gm]'?button:null},target={closest:s=>s==='[data-gm]'?button:null};
 return {w,nodes,saved,data,root,button,scope:value=>{scope=value},click(){nodes['#app'].listeners.click({type:'click',target})}};
}
test('actual app dispatcher saves independent NPC copy and leaves character and campaign data untouched',()=>{
 const h=harness(),before=JSON.parse(JSON.stringify(h.w.qa.snapshot()));h.w.confirm=()=>true;h.click();assert.equal(h.saved.length,1);const state=h.saved[0];
 assert.deepEqual(state.characters,before.characters);assert.deepEqual(state.campaigns,before.campaigns);assert.deepEqual(state.future,before.future);assert.equal(state.gmWorkspace.roster.length,2);
 assert.deepEqual(state.gmWorkspace.roster[0],before.gmWorkspace.roster[0]);assert.equal(state.gmWorkspace.roster[1].id,'npc-copy-id');assert.equal(state.gmWorkspace.roster[1].name,'Patrol (копия)');assert.equal(state.gmWorkspace.roster[1].hp,17);assert.deepEqual(state.gmWorkspace.roster[1].armorTrack,before.gmWorkspace.roster[0].armorTrack);
 const live=h.w.qa.snapshot();live.gmWorkspace.roster[1].future.marker='changed';assert.equal(live.gmWorkspace.roster[0].future.marker,'keep');assert.equal(live.campaigns[0].roster[0].name,'Campaign guard');
});
test('actual dispatcher does not save a cancelled copy or an account switch during confirmation',()=>{
 for(const mode of ['cancel','scope']){const h=harness(),before=JSON.stringify(h.w.qa.snapshot());h.w.confirm=()=>{if(mode==='scope')h.scope('bob');return mode!=='cancel'};h.click();assert.equal(h.saved.length,0,mode);assert.equal(JSON.stringify(h.w.qa.snapshot()),before,mode)}
});
