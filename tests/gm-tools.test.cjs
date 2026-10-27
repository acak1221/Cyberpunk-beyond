const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context={window:{confirm:()=>true},globalThis:{crypto:{randomUUID:()=>Math.random().toString(36).slice(2)}},Math,Number,String,Array,Object,Set};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/game/gm-tools.js'),'utf8'),context);const G=context.window.GMTools;
test('encounter ranges reflect the PDF, including both evening 72 results and missing midnight 100',()=>{
 for(let n=1;n<=100;n++)assert.equal(G.matches('day',n).length,1,'day '+n);
 for(let n=1;n<=100;n++)assert.equal(G.matches('evening',n).length,n===72?2:1,'evening '+n);
 for(let n=1;n<=100;n++)assert.equal(G.matches('midnight',n).length,n===100?0:1,'midnight '+n);
 assert.equal(G.matches('day',100)[0][2],419);assert.equal(G.matches('evening',72)[0][2],421);assert.equal(G.matches('evening',72)[1][2],422);
});
test('all indexed encounters have both languages and valid printed pages',()=>{
 for(const rows of Object.values(G.ENCOUNTERS))for(const r of rows){assert(r[0]>=1&&r[1]<=100&&r[0]<=r[1]);assert(r[2]>=417&&r[2]<=424);for(const i of [3,4,5,6])assert(r[i].trim())}
});
test('initial state validates, rejects corrupted or oversized saved data',()=>{
 let w=G.initial();assert(G.validWorkspace(w));assert(!G.validWorkspace({...w,roll:101}));assert(!G.validWorkspace({...w,time:'wrong'}));assert(!G.validWorkspace({...w,party:0}));assert(!G.validWorkspace({...w,roster:Array(201).fill({})}));
});
test('uncertain source rows are shown explicitly and custom text is escaped',()=>{
 let w=G.initial();w.time='evening';w.roll=72;let html=G.render({workspace:w,lang:'en'});assert(html.includes('two evening ranges'));assert(html.includes('Solo team'));assert(html.includes('Iron Sights'));
 w.time='midnight';w.roll=100;html=G.render({workspace:w,lang:'ru'});assert(html.includes('запись отсутствует'));
});
test('all ten Corebook NPC templates retain their STATs, armor, weapons and skill bases',()=>{
 assert.equal(G.NPC_TEMPLATES.length,10);assert.equal(new Set(G.NPC_TEMPLATES.map(n=>n.id)).size,10);
 for(const n of G.NPC_TEMPLATES){assert(n.name.ru&&n.name.en);assert(n.page>=412&&n.page<=416);assert(Number.isInteger(n.hp));assert(Number.isInteger(n.armor.headSP));assert(Number.isInteger(n.armor.bodySP));assert(Object.keys(n.stats).length===9);assert(n.weapons.length);assert(Object.keys(n.skillBases).length>10)}
 const officer=G.NPC_TEMPLATES.find(n=>n.id==='security-officer');assert.equal(officer.skillBases.Tactics,null);assert.equal(officer.skillBases.Autofire.base,12);assert.equal(officer.skillBases.Autofire.armored,10);
 const pyro=G.NPC_TEMPLATES.find(n=>n.id==='pyro');assert.equal(pyro.weapons.find(w=>w.name==='Heavy Pistol').damage,'3d6');assert.match(pyro.equipment,/VH Pistol Ammo/);assert.match(pyro.note,/inconsistency/);
});
test('adding and editing a roster copy preserves the source template and escapes user input',()=>{
 let w=G.initial(),ctx={workspace:w,lang:'en'},target={closest:()=>({dataset:{gm:'add',id:'bodyguard'}})};
 let result=G.handle({type:'click',target},ctx);assert(result.dirty&&result.rerender);assert.equal(w.roster.length,1);assert.equal(w.roster[0].hp,35);assert(G.validWorkspace(w));
 result=G.handle({type:'input',target:{dataset:{gmNpc:'name',gmIndex:'0'},value:'<img src=x>',closest:()=>null}},ctx);assert(result.dirty);let html=G.render(ctx);assert(!html.includes('<img src=x>'));assert(html.includes('&lt;img src=x&gt;'));assert.equal(G.NPC_TEMPLATES[0].name.en,'Bodyguard');
 context.window.confirm=()=>false;assert(!G.handle({type:'click',target:{closest:()=>({dataset:{gm:'remove',index:'0'}})}},ctx).dirty);assert.equal(w.roster.length,1);
});
