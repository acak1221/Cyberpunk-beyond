const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=n=>fs.readFileSync(__dirname+'/../public/game/'+n,'utf8');
test('real dispatcher removes old area result and blocks using a roll after its inputs change',async()=>{
 const events={},saves=[],node=()=>({innerHTML:'',setAttribute(){},addEventListener(type,fn){events[type]=fn}}),nodes={'#app':node(),'#sync-root':node(),'#sync-adapter-status':node()};
 const math=Object.create(Math);math.random=()=>0.4;
 const w={ROLES:[],Book:{handle:()=>false},Campaigns:{handle:()=>false},NetTools:{setScope(){},validArchitectures:Array.isArray},RoleTools:{render:()=>'',handle:()=>({handled:false})},SyncAdapter:{create(){return {start(){},getScope:()=> 'account',stateLabel:()=>'',canEdit:()=>true,save(x){saves.push(x)}}}},scrollTo(){}};
 const ctx={window:w,document:{querySelector:s=>nodes[s]||null,documentElement:{},title:''},localStorage:{getItem:()=>null},globalThis:{crypto:{randomUUID:()=> 'id'},addEventListener(){}},setTimeout:()=>0,clearTimeout(){},console,Math:math,Date,JSON,Set,WeakMap,Number,String,Array,Object,Promise};
 vm.createContext(ctx);vm.runInContext(source('combat-tools.js'),ctx);vm.runInContext(source('area-tools.js'),ctx);vm.runInContext(source('app.js'),ctx);
 const vals={type:'blast','attack-method':'grenade','attack-stat':'6','attack-skill':'4','attack-mod':'0','attack-distance':'10',attack:'18',dv:'13',dice:'3,3,3'};
 const fields=Object.fromEntries(Object.entries(vals).map(([key,value])=>[`[data-area-${key}]`,{value}]));
 const status=()=>({textContent:'',innerHTML:''});const attackResult=status(),out=status(),container={querySelectorAll:()=>[]};fields['[data-area-targets]']=container;fields['[data-area-result]']=out;fields['[data-area-attack-result]']=attackResult;
 const root={querySelector:s=>fields[s]||null};
 const click=op=>{const b={dataset:{areaAction:op},closest:s=>s==='[data-area-root]'?root:null};events.click({type:'click',target:{closest:s=>s==='[data-area-action]'?b:null}})};
 click('roll-attack');assert.match(attackResult.textContent,/= 15/);click('calculate');assert.match(out.innerHTML,/РЕЗУЛЬТАТ/);
 fields['[data-area-attack-distance]'].value='30';const el={dataset:{},matches:s=>s==='input,select,textarea'||s.includes('[data-area-attack-distance]'),closest:s=>s==='[data-area-root]'?root:null};events.input({type:'input',target:el});assert.equal(out.textContent,'');assert.equal(attackResult.textContent,'');
 click('calculate');assert.match(out.textContent,/Параметры атаки изменились/);assert.equal(fields['[data-area-attack]'].value,'15');assert.equal(fields['[data-area-dv]'].value,'15');assert.equal(saves.length,0);
});
