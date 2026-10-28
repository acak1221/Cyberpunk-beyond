const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=n=>fs.readFileSync(__dirname+'/../public/game/'+n,'utf8');
test('real application dispatcher clears the displayed Grab roll on input and change while leaving manually entered totals intact',async()=>{
 const events={},saves=[],node=()=>({innerHTML:'',setAttribute(){},addEventListener(type,fn){events[type]=fn}}),nodes={'#app':node(),'#sync-root':node(),'#sync-adapter-status':node()};
 const math=Object.create(Math);math.random=()=>0.4;
 const w={ROLES:[],CombatTools:{handle:()=>false},Book:{handle:()=>false},Campaigns:{handle:()=>false},NetTools:{setScope(){},validArchitectures:Array.isArray},RoleTools:{render:()=>'',handle:()=>({handled:false})},SyncAdapter:{create(){return {start(){},getScope:()=> 'account',stateLabel:()=>'',canEdit:()=>true,save(x){saves.push(x)}}}},scrollTo(){}};
 const ctx={window:w,document:{querySelector:s=>nodes[s]||null,documentElement:{},title:''},localStorage:{getItem:()=>null},globalThis:{crypto:{randomUUID:()=> 'id'},addEventListener(){}},setTimeout:()=>0,clearTimeout(){},console,Math:math,Date,JSON,Set,Number,String,Array,Object,Promise};
 vm.createContext(ctx);vm.runInContext(source('grapple-tools.js'),ctx);vm.runInContext(source('app.js'),ctx);
 const fields={};for(const id of ['a','b'])for(const [key,value] of [['dex','6'],['skill','2'],['mod','0']])fields[`[data-gr-grab-${id}-${key}]`]={value};
 fields['[data-gr-grab-roll-result]']={textContent:''};fields['[data-gr-attacker]']={value:'17'};fields['[data-gr-defender]']={value:'13'};fields['[data-gr-grab-result]']={textContent:'manual result'};
 const root={querySelector:s=>fields[s]},button={dataset:{grAction:'grab-roll'},closest:s=>s==='[data-grapple-root]'?root:null},target={closest:s=>s==='[data-gr-action]'?button:null};
 events.click({type:'click',target});assert.match(fields['[data-gr-grab-roll-result]'].textContent,/Brawling/);
 const input={dataset:{},matches:()=>true,closest:s=>s==='[data-grapple-root]'?root:null};events.input({type:'input',target:input});assert.equal(fields['[data-gr-grab-roll-result]'].textContent,'');
 events.click({type:'click',target});assert.match(fields['[data-gr-grab-roll-result]'].textContent,/Brawling/);await events.change({type:'change',target:input});assert.equal(fields['[data-gr-grab-roll-result]'].textContent,'');
 assert.equal(fields['[data-gr-attacker]'].value,'17');assert.equal(fields['[data-gr-defender]'].value,'13');assert.equal(fields['[data-gr-grab-result]'].textContent,'manual result');assert.equal(saves.length,0);
});
