const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const base=path.join(__dirname,'..','public','game'),app=fs.readFileSync(path.join(base,'app.js'),'utf8'),start=app.indexOf('function handleEquipment(e){'),end=app.indexOf('\nfunction handleExtra(e)',start);assert(start>=0&&end>start);
function harness(){
 const c={id:'c',humanity:60,head:0,bodyArmor:0,stats:{EMP:6,LUCK:6},extra:{cash:1000,items:[],weapons:[]}},snapshots=[],messages=[];
 const ctx={window:{},console,active:()=>c,state:{view:'sheet',lang:'en'},syncAdapter:{getScope:()=>'scope-a'},save:()=>snapshots.push(JSON.parse(JSON.stringify(c))),render(){},notify:m=>messages.push(m)};vm.createContext(ctx);
 for(const file of ['catalog.js','catalog-extra.js','character-extra.js','equipment-tools.js'])vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),ctx);
 vm.runInContext(app.slice(start,end)+'\nthis.handle=handleEquipment;',ctx);
 const m=ctx.window.EquipmentTools,item=ctx.window.CATALOG.find(x=>x.id==='armor-kevlar');m.purchase(c,item,'cash','en',{quantity:2,confirmed:true});let id=c.extra.items[0].id;m.equip(c,id,'head','en',true);m.equip(c,id,'body','en',true);m.setSP(c,'body',2);m.unequip(c,'body','en',true);
 const input={dataset:{cxList:'items',cxKey:'quantity',cxIndex:'0'},value:'2'};return {c,m,id,input,snapshots,messages,handle:ctx.handle};
}
test('quantity commits on change, never on partial input; snapshots carry quantity and history atomically',()=>{
 const h=harness(),{c,id,input,handle,snapshots}=h;input.value='';assert.equal(handle({type:'input',target:input}),true);assert.equal(c.extra.items[0].quantity,2);assert.equal(snapshots.length,0);
 input.value='1';handle({type:'input',target:input});assert.equal(c.extra.items[0].quantity,2);assert.equal(snapshots.length,0);
 handle({type:'change',target:input});assert.equal(c.extra.items[0].quantity,1);assert.equal(snapshots.length,1);assert(!snapshots[0].extra.equipment.armorHistory.some(r=>r.recordId===id&&r.piece>=1));
 input.value='2';handle({type:'change',target:input});assert.equal(snapshots.length,2);assert.equal(snapshots[0].extra.items[0].quantity,1);assert.equal(snapshots[1].extra.items[0].quantity,2);assert(!snapshots[1].extra.equipment.armorHistory.some(r=>r.recordId===id&&r.piece>=1));
 input.value='';handle({type:'change',target:input});assert.equal(input.value,2);assert.equal(snapshots.length,2);
});
