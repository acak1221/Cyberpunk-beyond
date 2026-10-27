const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const appCode=fs.readFileSync(__dirname+'/../public/game/app.js','utf8'),gmCode=fs.readFileSync(__dirname+'/../public/game/gm-tools.js','utf8');
function run(raw){let writes=0,options;const n=()=>({innerHTML:'',addEventListener(){},setAttribute(){}}),nodes={'#app':n(),'#sync-root':n(),'#sync-adapter-status':n()};const w={ROLES:[],CharacterExtra:{specializationCost:()=>0},SyncAdapter:{create(o){options=o;return{start(){},stateLabel:()=>'',getScope:()=>null}}}};const context={window:w,document:{querySelector:s=>nodes[s]||null,documentElement:{},title:''},localStorage:{getItem:()=>raw,setItem(){writes++}},globalThis:{crypto:{randomUUID:()=> 'test-id'}},console,Math,JSON,Set,Number,String,Array,Object,Promise};vm.createContext(context);vm.runInContext(gmCode,context);vm.runInContext(appCode+'\nwindow.qa={snapshot:snapshotAppState,validate:validateSnapshot,apply:applySyncedSnapshot};',context);return{w,getWrites:()=>writes,opts:()=>options}}
test('GM workspace survives loading and hydration without a write and rejects malformed workspaces',()=>{
 const workspace={time:'evening',zone:'moderate',party:4,roll:72,roster:[{id:'npc-1',template:'bodyguard',name:'Patrol',hp:30,notes:'Keep me'}]};
 const data={characters:[],campaigns:[],gmWorkspace:workspace,future:{key:'unchanged'}},h=run(JSON.stringify(data));
 assert.equal(h.opts().initialIssue,null);assert.equal(h.w.qa.snapshot().gmWorkspace.roster[0].notes,'Keep me');assert.equal(h.getWrites(),0);
 h.w.qa.apply({...data,gmWorkspace:{...workspace,roll:11}});assert.equal(h.w.qa.snapshot().gmWorkspace.roll,11);assert.equal(h.w.qa.snapshot().future.key,'unchanged');assert.equal(h.getWrites(),0);
 assert.equal(h.w.qa.validate({...data,gmWorkspace:{...workspace,roster:[{id:'broken'}]}}),false);
});
