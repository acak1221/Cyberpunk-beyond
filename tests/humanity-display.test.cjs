const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(__dirname+'/../public/game/app.js','utf8');
function harness(){
 const node=()=>({innerHTML:'',textContent:'',addEventListener(){},setAttribute(){}}),nodes={'#app':node(),'#sync-root':node(),'#sync-adapter-status':node(),'[data-calc="max-humanity"]':node(),'[data-calc="base-humanity"]':node()};
 const window={ROLES:[{id:'solo',name:{ru:'Соло',en:'Solo'},description:{ru:'',en:''}}],CharacterExtra:{render:()=>'',specializationCost:()=>0},EquipmentTools:{render:()=>'',setScope(){}},RoleTools:{render:()=>'',refresh(){}},SyncAdapter:{create(){return {stateLabel:()=>'',start(){},getScope:()=>null}}}};
 const context={window,document:{querySelector:s=>nodes[s]||null,documentElement:{lang:''},title:''},localStorage:{getItem:()=>null},globalThis:{crypto:{randomUUID:()=> 'x'}},console,Math,JSON,Set,Number,String,Array,Object,Promise};
 vm.runInNewContext(code+'\nwindow.qa={sheet,refreshSheet,lang:x=>{state.lang=x}};',context);return {window,nodes};
}
function character(){return {id:'x',name:'Rook',role:'solo',rank:4,stats:{INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{},hp:45,humanity:53,extra:{equipment:{maxHumanity:54}}}}
test('sheet shows confirmed maximum, its separate base, and localized explanation without mutation',()=>{
 const h=harness(),c=character(),before=JSON.stringify(c);
 for(const lang of ['en','ru']){h.window.qa.lang(lang);const out=h.window.qa.sheet(c);assert.match(out,/data-calc="max-humanity">54</);assert.match(out,/data-calc="base-humanity">60</);assert.ok(lang==='ru'?out.includes('ещё не подтверждён'):out.includes('has not been confirmed'))}
 assert.equal(JSON.stringify(c),before);
});
test('unconfirmed or malformed maxima show a dash while confirmed zero remains valid',()=>{
 const h=harness(),c=character();for(const val of [undefined,null,'54',-1,201]){c.extra.equipment.maxHumanity=val;assert.match(h.window.qa.sheet(c),/data-calc="max-humanity">—</)}c.extra.equipment.maxHumanity=0;assert.match(h.window.qa.sheet(c),/data-calc="max-humanity">0</);
});
test('refreshing a live sheet shows changed confirmed maximum and base separately',()=>{
 const h=harness(),c=character();h.window.qa.refreshSheet(c);assert.equal(h.nodes['[data-calc="max-humanity"]'].textContent,'54');assert.equal(h.nodes['[data-calc="base-humanity"]'].textContent,'60');c.extra.equipment.maxHumanity=52;c.stats.EMP=5;h.window.qa.refreshSheet(c);assert.equal(h.nodes['[data-calc="max-humanity"]'].textContent,'52');assert.equal(h.nodes['[data-calc="base-humanity"]'].textContent,'50');delete c.extra.equipment.maxHumanity;h.window.qa.refreshSheet(c);assert.equal(h.nodes['[data-calc="max-humanity"]'].textContent,'—');
});
