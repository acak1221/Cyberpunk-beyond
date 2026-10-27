const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx={window:{},console};vm.createContext(ctx);
for(const f of ['catalog.js','catalog-extra.js','character-extra.js','equipment-tools.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/game',f),'utf8'),ctx,{filename:f});
const C=ctx.window.CATALOG,M=ctx.window.EquipmentTools;
const cases=[
 ['cyberware-bug-detector',100,113,'Mall','1d6/2',2,3,100],
 ['cyberware-vampyres',500,114,'Clinic','4d6',14,20,500],
 ['cyberware-midnight-lady',100,114,'Clinic','2d6',7,10,500],
 ['cyberware-mr-studd',100,114,'Clinic','2d6',7,10,500]
];
function character(){return {id:'one',stats:{EMP:6},skills:{},humanity:60,head:0,bodyArmor:0,extra:{cash:5000,items:[],weapons:[]}}}
test('four missing cyberware entries match the creation tables and describe their prerequisites',()=>{
 for(const [id,price,page,install,formula,creation] of cases){const xs=C.filter(x=>x.id===id);assert.equal(xs.length,1,id);const x=xs[0];assert.equal(x.category,'cyberware');assert.equal(x.price,price);assert.equal(x.page,page);assert.equal(x.stats.installation,install);assert.equal(x.stats.humanityLoss,formula);assert.equal(x.stats.humanityLossAtCreation,creation);assert(x.name.ru&&x.name.en&&x.details.ru&&x.details.en)}
 const bug=C.find(x=>x.id==='cyberware-bug-detector');assert.match(bug.details.en,/Cyberaudio Suite/);assert.match(bug.details.ru,/Cyberaudio Suite/);
 const fangs=C.find(x=>x.id==='cyberware-vampyres');assert.match(fangs.details.en,/1d6, ROF 2/);assert.match(fangs.details.en,/30 minutes/);
 for(const id of ['cyberware-midnight-lady','cyberware-mr-studd'])assert.match(C.find(x=>x.id===id).details.en,/internal cyberware option slot/);
});
test('purchase and acknowledged installation use creation or rolled loss with correct max and surgery fees',()=>{
 for(const [id,price,, , ,creation,rolled,fee] of cases){const c=character(),item=C.find(x=>x.id===id);M.setScope('local');assert.equal(M.purchase(c,item,'cash','en',{confirmed:true}).ok,true);assert.equal(c.extra.cash,5000-price);assert.equal(M.setMax(c,60,'en',true).ok,true);const rec=c.extra.items[0].id;
  assert.equal(M.prepare(c,rec,'creation','included',false,'en').reason,'needInputs');let preview=M.prepare(c,rec,'creation','included',true,'en',()=>5);assert.equal(preview.ok,true,id);assert.equal(preview.draft.loss,creation);assert.equal(preview.draft.maxLoss,2);assert.equal(preview.draft.fee,0);assert.equal(M.commit(c,preview.draft,'en',true).ok,true);assert.equal(c.humanity,60-creation);assert.equal(c.extra.equipment.maxHumanity,58);
  const d=character();assert.equal(M.purchase(d,item,'cash','en',{confirmed:true}).ok,true);M.setMax(d,60,'en',true);preview=M.prepare(d,d.extra.items[0].id,'play','found',true,'en',()=>5);assert.equal(preview.ok,true,id);assert.equal(preview.draft.loss,rolled);assert.equal(preview.draft.maxLoss,2);assert.equal(preview.draft.fee,fee);assert.equal(M.commit(d,preview.draft,'en',true).ok,true);assert.equal(d.humanity,60-rolled);assert.equal(d.extra.equipment.maxHumanity,58);assert.equal(d.extra.cash,5000-price-fee);
 }
});
