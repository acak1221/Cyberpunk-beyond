const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const appCode=fs.readFileSync(__dirname+'/../public/game/app.js','utf8'),gmCode=fs.readFileSync(__dirname+'/../public/game/gm-tools.js','utf8');
function run(raw){let writes=0,options,scope=null,saved=[];const n=()=>({innerHTML:'',listeners:{},addEventListener(type,fn){this.listeners[type]=fn},setAttribute(){}}),nodes={'#app':n(),'#sync-root':n(),'#sync-adapter-status':n()};const w={ROLES:[],CharacterExtra:{specializationCost:()=>0},SyncAdapter:{create(o){options=o;return{start(){},stateLabel:()=>'',getScope:()=>scope,canEdit:()=>true,save:x=>{saved.push(JSON.parse(JSON.stringify(x)));return Promise.resolve({ok:true})}}}}};const context={window:w,document:{querySelector:s=>nodes[s]||null,documentElement:{},title:''},localStorage:{getItem:()=>raw,setItem(){writes++}},globalThis:{crypto:{randomUUID:()=> 'test-id'}},console,Math,JSON,Set,Number,String,Array,Object,Promise};vm.createContext(context);for(const f of ['combat-tools.js','damage-apply.js'])vm.runInContext(fs.readFileSync(__dirname+'/../public/game/'+f,'utf8'),context);vm.runInContext(gmCode,context);vm.runInContext(appCode+'\nwindow.qa={snapshot:snapshotAppState,validate:validateSnapshot,apply:applySyncedSnapshot,handle:handleGMTools,enter:()=>{state.view="gm";render()}};',context);return{w,getWrites:()=>writes,opts:()=>options,enable:()=>{scope='alice'},saved,nodes}}
test('GM workspace survives loading and hydration without a write and rejects malformed workspaces',()=>{
 const workspace={time:'evening',zone:'moderate',party:4,roll:72,roster:[{id:'npc-1',template:'bodyguard',name:'Patrol',hp:30,notes:'Keep me'}]};
 const data={characters:[],campaigns:[],gmWorkspace:workspace,future:{key:'unchanged'}},h=run(JSON.stringify(data));
 assert.equal(h.opts().initialIssue,null);assert.equal(h.w.qa.snapshot().gmWorkspace.roster[0].notes,'Keep me');assert.equal(h.getWrites(),0);
 h.w.qa.apply({...data,gmWorkspace:{...workspace,roll:11}});assert.equal(h.w.qa.snapshot().gmWorkspace.roll,11);assert.equal(h.w.qa.snapshot().future.key,'unchanged');assert.equal(h.getWrites(),0);
 assert.equal(h.w.qa.validate({...data,gmWorkspace:{...workspace,roster:[{id:'broken'}]}}),false);
});

test('the actual GM handler persists an armor and HP change through the adapter',()=>{
 const workspace={time:'day',zone:'moderate',party:4,roll:null,roster:[{id:'npc',template:'bodyguard',name:'Patrol',hp:35,notes:'keep'}]};
 const h=run(JSON.stringify({characters:[],campaigns:[],gmWorkspace:workspace}));h.enable();h.w.qa.enter();h.w.confirm=()=>true;
 const fields={head:{value:'7'},body:{value:'7'},raw:{value:'20'},location:{value:'body'},type:{value:'standard'},critical:{checked:false}},root={isConnected:true,dataset:{npcId:'npc'},querySelector:s=>fields[s.match(/"([^"]+)"/)[1]]},b={dataset:{gm:'armor-damage'},isConnected:true,closest:()=>root},target={closest:s=>s==='[data-gm]'?b:null};
 assert.match(h.nodes['#app'].innerHTML,/data-gm-armor/);h.nodes['#app'].listeners.click({type:'click',target});assert.equal(h.saved.length,1);assert.equal(h.saved[0].gmWorkspace.roster[0].hp,22);assert.equal(h.saved[0].gmWorkspace.roster[0].armorTrack.body,6);assert.equal(h.saved[0].gmWorkspace.roster[0].notes,'keep');
});
