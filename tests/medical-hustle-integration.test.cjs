const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=name=>fs.readFileSync(__dirname+'/../public/game/'+name,'utf8');
function harness({therapy=false}={}){
 const events={},saved=[],element=()=>({innerHTML:'',addEventListener(k,fn){events[k]=fn},setAttribute(){}}),nodes={'#app':element(),'#sync-root':element(),'#sync-adapter-status':element(),'#app-notice':{textContent:'',classList:{add(){},remove(){}}}};
 let scope='scope-123',confirmAction=()=>true;
 const w={ROLES:[{id:'solo',name:{en:'Solo',ru:'Соло'},description:{en:'',ru:''},ability:{en:'Combat',ru:'Бой'}}],CATALOG:[],Book:{handle:()=>false},Campaigns:{handle:()=>false},CombatTools:{handle:()=>false},NetTools:{setScope(){},validArchitectures:Array.isArray},RoleTools:{render:()=>'',handle:()=>({handled:false})},EquipmentTools:{render:()=>'',setScope(){},handle:()=>({handled:false})},SyncAdapter:{create(){return {start(){},getScope:()=>scope,stateLabel:()=>'',canEdit:()=>scope!==null,save(s){saved.push(JSON.parse(JSON.stringify(s)));return Promise.resolve({ok:true})}}}},confirm:()=>confirmAction(),scrollTo(){}};
 const character={id:'person',name:'Test',role:'solo',rank:4,stats:{INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{},hp:20,humanity:60,extra:{cash:100}};
 if(therapy){character.humanity=40;character.extra.equipment={maxHumanity:54};}
 const math=Object.create(Math);math.random=()=>0.9;
 const context={window:w,document:{querySelector:s=>nodes[s]||null,documentElement:{},title:''},localStorage:{getItem:()=>JSON.stringify({characters:[character],campaigns:[],lang:'en'})},globalThis:{crypto:{randomUUID:()=> 'roll-id'}},confirm:()=>confirmAction(),setTimeout:()=>0,clearTimeout(){},console,Math:math,JSON,Set,Number,String,Array,Object,Promise};
 vm.createContext(context);for(const file of ['character-extra.js','hustle-tools.js','medical-tools.js','therapy-tools.js'])vm.runInContext(source(file),context);
 vm.runInContext(source('app.js')+'\nwindow.__integration={go:(view,id)=>{state.view=view;state.active=id;render()},snapshot:snapshotAppState,replace:applySyncedSnapshot};',context);
 return {window:w,saved,setScope(value){scope=value},setConfirm(fn){confirmAction=fn},click(selector,action){const dataset=selector==='[data-hustle]'?{hustle:action}:{medAction:action};events.click({type:'click',target:{closest:s=>s===selector?{dataset}:null}})},therapyField(key,value){events.change({type:'change',target:{dataset:{therapyField:key},value,checked:value===true,closest:()=>null}})},clickTherapy(action){const root={isConnected:true},button={isConnected:true,dataset:{therapyAction:action},closest:s=>s==='[data-therapy-root]'?root:null};events.click({type:'click',target:{closest:s=>s==='[data-therapy-action]'?button:null}})}};
}
test('actual sheet and medical handlers save a confirmed Hustle and stabilization in their character snapshot',()=>{
 const h=harness();h.window.__integration.go('sheet','person');h.click('[data-hustle]','roll');assert.equal(h.saved.at(-1).characters[0].extra.hustle.pending.status,'ready');
 h.click('[data-hustle]','credit');assert.equal(h.saved.at(-1).characters[0].extra.hustle.pending.status,'credited');assert(h.saved.at(-1).characters[0].extra.cash>100);
 h.window.__integration.go('medical',null);h.click('[data-med-action]','stabilize-roll');h.click('[data-med-action]','stabilize-apply');assert.equal(h.saved.at(-1).characters[0].extra.medical.stabilized,true);
});
test('an account switch during Hustle confirmation cannot add cash or save stale state',()=>{
 const h=harness();h.window.__integration.go('sheet','person');h.click('[data-hustle]','roll');const count=h.saved.length;h.setConfirm(()=>{h.setScope(null);return true});h.click('[data-hustle]','credit');
 assert.equal(h.saved.length,count);assert.equal(h.window.__integration.snapshot().characters[0].extra.cash,100);assert.equal(h.window.__integration.snapshot().characters[0].extra.hustle.pending.status,'ready');
});
test('an account switch during medical confirmation cannot stabilize or save a stale patient',()=>{
 const h=harness();h.window.__integration.go('medical',null);h.click('[data-med-action]','stabilize-roll');const count=h.saved.length;h.setConfirm(()=>{h.setScope(null);return true});h.click('[data-med-action]','stabilize-apply');
 assert.equal(h.saved.length,count);assert.equal(h.window.__integration.snapshot().characters[0].extra.medical,undefined);
});
test('hydration replacing an identical character during confirmation prevents writes through the stale reference',()=>{
 const h=harness();h.window.__integration.go('sheet','person');h.click('[data-hustle]','roll');let count=h.saved.length;h.setConfirm(()=>{h.window.__integration.replace(h.window.__integration.snapshot());return true});h.click('[data-hustle]','credit');
 assert.equal(h.saved.length,count);assert.equal(h.window.__integration.snapshot().characters[0].extra.cash,100);assert.equal(h.window.__integration.snapshot().characters[0].extra.hustle.pending.status,'ready');
 h.setConfirm(()=>true);h.window.__integration.go('medical',null);h.click('[data-med-action]','stabilize-roll');count=h.saved.length;h.setConfirm(()=>{h.window.__integration.replace(h.window.__integration.snapshot());return true});h.click('[data-med-action]','stabilize-apply');
 assert.equal(h.saved.length,count);assert.equal(h.window.__integration.snapshot().characters[0].extra.medical,undefined);
});
test('actual therapy handler applies one confirmed recovery in a saved snapshot',()=>{
 const h=harness({therapy:true});h.window.__integration.go('medical',null);h.therapyField('ack',true);h.clickTherapy('roll');assert.equal(h.saved.length,0);h.clickTherapy('apply');assert.equal(h.saved.length,1);assert.equal(h.saved[0].characters[0].humanity,52);assert.equal(h.saved[0].characters[0].extra.equipment.maxHumanity,54);h.clickTherapy('apply');assert.equal(h.saved.length,1);
});
test('therapy does not save if the account changes during application',()=>{
 const h=harness({therapy:true});h.window.__integration.go('medical',null);h.therapyField('ack',true);h.clickTherapy('roll');h.setConfirm(()=>{h.setScope(null);return true});h.clickTherapy('apply');assert.equal(h.saved.length,0);assert.equal(h.window.__integration.snapshot().characters[0].humanity,40);
});
