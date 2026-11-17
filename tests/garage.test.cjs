const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.join(__dirname,'../site'),read=f=>fs.readFileSync(path.join(dir,f),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const eq=(a,b,m)=>assert.deepEqual(plain(a),b,m);
// A fresh copy per test: the module keeps the latest collision roll and the open folds in memory.
function load(options={}){
 const calls=[],window={},char={id:'c1',name:'Test',role:'solo',extra:options.extra};
 const state={characters:[char]};
 if(options.app!==false)window.App={getState:()=>state,active:()=>char,save(){calls.push(['save'])},render(){calls.push(['render'])},lang:()=>options.lang||'ru',notify:m=>calls.push(['notify',m]),notifyAction:options.noAction?undefined:(m,label,fn)=>calls.push(['action',m,label,fn])};
 window.Rolls={sum:(...a)=>calls.push(['sum',...a])};
 const context={window,Math,Number,String,Array,Object,Set,Map,Infinity,JSON,Date};
 for(const f of ['catalog.js','catalog-extra.js','defenses-extra.js','vehicle-tools.js','garage.js'])if(f!=='vehicle-tools.js'||options.tools!==false)vm.runInNewContext(read(f),context);
 return {G:window.Garage,window,char,state,calls,CATALOG:window.CATALOG};
}
function btn(action,ds={}){const el={dataset:{grAction:action,grChar:'c1',...ds},closest:()=>null};el.closest=s=>s==='[data-gr-action]'?el:null;return {type:'click',target:el}}
let n=0;const ids=()=>'v'+(++n);

test('garage: a catalog vehicle starts with its catalog SDP and a custom one needs a name and SDP',()=>{
 const {G,char}=load(),road='extra-vehicle-roadbike';
 const r=G.addVehicle(char,{catalogId:road},'ru',ids);
 assert(r.ok);const v=G.readVehicles(char)[0];
 assert.equal(v.catalogId,road);assert.equal(v.sdp,35);assert.equal(v.sdpMax,35);eq(v.upgrades,[]);
 assert.equal(G.displayName(v,'en'),'Roadbike');assert.equal(G.displayName(v,'ru'),'Дорожный мотоцикл');
 assert.deepEqual(plain(G.stats(v)),{seats:'2',move:20,kph:161});
 assert.equal(G.addVehicle(char,{catalogId:'extra-upgrade-nos'},'ru',ids).key,'unknown','an upgrade is not a vehicle');
 assert.equal(G.addVehicle(char,{catalogId:'nope'},'ru',ids).key,'unknown');
 assert.equal(G.addVehicle(char,{name:'  ',sdpMax:20},'ru',ids).key,'noName');
 assert.equal(G.addVehicle(char,{name:'Truck',sdpMax:0},'ru',ids).key,'badSdp');
 assert.equal(G.addVehicle(char,{name:'Truck',sdpMax:'1.5'},'ru',ids).key,'badSdp');
 const c=G.addVehicle(char,{name:'  Old   truck ',sdpMax:'40'},'en',ids);assert(c.ok);
 const t=G.readVehicles(char)[1];assert.equal(t.name,'Old truck');assert.equal(t.sdp,40);assert.equal(t.catalogId,undefined);
 assert.equal(G.displayName(t,'ru'),'Old truck');
});

test('garage: cap of 20 vehicles and 12 upgrades per vehicle',()=>{
 const {G,char}=load();
 for(let i=0;i<20;i++)assert(G.addVehicle(char,{catalogId:'extra-vehicle-roadbike'},'ru',ids).ok);
 assert.equal(G.addVehicle(char,{catalogId:'extra-vehicle-roadbike'},'ru',ids).key,'full');
 assert.equal(G.readVehicles(char).length,20);
 const id=G.readVehicles(char)[0].id,ups=G.upgradeChoices().map(u=>u.id);
 for(let i=0;i<12;i++)assert(G.installUpgrade(char,id,ups[i],'ru').ok,String(i));
 assert.equal(G.installUpgrade(char,id,ups[12],'ru').key,'fullUpgrades');
});

test('garage: SDP steps stay between 0 and the maximum, typed values are checked',()=>{
 const {G,char}=load();
 G.addVehicle(char,{catalogId:'extra-vehicle-roadbike'},'ru',ids);const id=G.readVehicles(char)[0].id;
 assert(G.adjustSdp(char,id,-1,'ru').ok);assert.equal(G.readVehicles(char)[0].sdp,34);
 assert(G.adjustSdp(char,id,5,'ru').ok);assert.equal(G.readVehicles(char)[0].sdp,35,'not above the maximum');
 for(let i=0;i<40;i++)G.adjustSdp(char,id,-1,'ru');assert.equal(G.readVehicles(char)[0].sdp,0);
 assert(G.repair(char,id,'ru').ok);assert.equal(G.readVehicles(char)[0].sdp,35);
 assert(G.setSdp(char,id,'12','ru').ok);assert.equal(G.readVehicles(char)[0].sdp,12);
 assert(G.setSdp(char,id,500,'ru').ok);assert.equal(G.readVehicles(char)[0].sdp,35,'clamped to the maximum');
 for(const bad of ['','x',-1,1.5,10000,'1e2',null])assert.equal(G.setSdp(char,id,bad,'ru').key,'badSdp',String(bad));
 assert(G.setSdpMax(char,id,20,'ru').ok);const v=G.readVehicles(char)[0];assert.equal(v.sdpMax,20);assert.equal(v.sdp,20,'SDP follows a lowered maximum');
 assert.equal(G.setSdpMax(char,id,0,'ru').key,'badSdp');
 assert.equal(G.adjustSdp(char,'missing',1,'ru').key,'stale');
 assert.equal(G.adjustSdp(char,id,'1','ru').ok,false);
});

test('garage: damage lowers SDP to 0 at most and can be taken back only while the sheet is unchanged',()=>{
 const {G,char}=load();
 G.addVehicle(char,{catalogId:'extra-vehicle-roadbike'},'ru',ids);const id=G.readVehicles(char)[0].id;
 const r=G.applyDamage(char,id,'30','ru');assert(r.ok);assert.equal(r.sdp,5);assert.match(r.message,/30/);
 assert.equal(G.applyDamage(char,id,'abc','ru').key,'badDamage');assert.equal(G.applyDamage(char,id,-3,'ru').key,'badDamage');
 const r2=G.applyDamage(char,id,99,'ru');assert.equal(r2.sdp,0);assert.match(r2.restoredMessage,/5/,'the undo notice names the SDP it brings back');
 assert(G.restore(char,r2.undo,'ru').ok);assert.equal(G.readVehicles(char)[0].sdp,5);
 G.adjustSdp(char,id,1,'ru');
 assert.equal(G.restore(char,r2.undo,'ru').key,'stale','changed since: refused');
 assert.equal(G.restore({id:'other',extra:{}},r2.undo,'ru').key,'stale');
});

test('garage: upgrades come from the catalog, once each, and removal can be taken back',()=>{
 const {G,char}=load();
 G.addVehicle(char,{catalogId:'extra-vehicle-compact-groundcar'},'ru',ids);const id=G.readVehicles(char)[0].id;
 assert(G.upgradeChoices().length>=15);assert(G.upgradeChoices().every(u=>u.stats.type==='upgrade'));
 assert(G.installUpgrade(char,id,'extra-upgrade-nos','ru').ok);
 assert.equal(G.installUpgrade(char,id,'extra-upgrade-nos','ru').key,'dup');
 assert.equal(G.installUpgrade(char,id,'extra-vehicle-roadbike','ru').key,'unknown');
 assert.equal(G.installUpgrade(char,'missing','extra-upgrade-nos','ru').key,'stale');
 eq(G.readVehicles(char)[0].upgrades,['extra-upgrade-nos']);
 const r=G.removeUpgrade(char,id,'extra-upgrade-nos','en');assert(r.ok);eq(G.readVehicles(char)[0].upgrades,[]);assert.match(r.message,/NOS/);
 assert(G.restore(char,r.undo,'en').ok);eq(G.readVehicles(char)[0].upgrades,['extra-upgrade-nos']);
 assert.equal(G.removeUpgrade(char,id,'extra-upgrade-hover','en').key,'stale');
});

test('garage: remove, rename and notes; an empty garage leaves no field in the save',()=>{
 const {G,char}=load();
 G.addVehicle(char,{catalogId:'extra-vehicle-roadbike'},'ru',ids);const id=G.readVehicles(char)[0].id;
 assert(G.setName(char,id,'  Red   bike ','ru').ok);assert.equal(G.readVehicles(char)[0].name,'Red bike');
 assert(G.setName(char,id,'','ru').ok);assert.equal(G.readVehicles(char)[0].name,undefined,'a catalog vehicle may go back to its catalog name');
 assert(G.setNotes(char,id,'line1\r\nline2\u0007'+'x'.repeat(600),'ru').ok);const notes=G.readVehicles(char)[0].notes;assert.equal(notes.length,500);assert(notes.startsWith('line1\nline2 '));
 const r=G.removeVehicle(char,id,'ru');assert(r.ok);assert.equal(char.extra.vehicles,undefined);
 assert(G.restore(char,r.undo,'ru').ok);assert.equal(G.readVehicles(char).length,1);assert.equal(G.readVehicles(char)[0].catalogId,'extra-vehicle-roadbike');
 const {G:G2,char:c2}=load();G2.addVehicle(c2,{name:'Own',sdpMax:10},'ru',ids);const own=G2.readVehicles(c2)[0].id;
 assert.equal(G2.setName(c2,own,'','ru').key,'noName','a custom vehicle keeps a name');
});

test('garage: saved data is rebuilt field by field and old saves are untouched',()=>{
 const {G}=load();
 assert.equal(G.valid({extra:{}}),true);assert.equal(G.valid({}),true);assert.equal(G.valid({extra:{vehicles:undefined}}),true);
 assert.equal(G.valid({extra:{vehicles:'x'}}),false);assert.equal(G.valid({extra:{vehicles:[1]}}),false);
 assert.equal(G.valid({extra:{vehicles:[{id:'a b',name:'x'}]}}),false);
 assert.equal(G.valid({extra:{vehicles:Array.from({length:21},(_,i)=>({id:'a'+i,name:'x',sdp:1,sdpMax:1}))}}),false);
 assert.equal(G.valid({extra:{vehicles:[{id:'a',name:'x',sdp:1,sdpMax:1}]}}),true);
 const dirty={id:'a1',catalogId:'extra-vehicle-roadbike',name:'<b>x</b>',sdp:900,sdpMax:35.5,upgrades:['u','u',5,'v'],notes:7,evil:'<script>'};
 const v=G.cleanVehicle(dirty);
 eq(v,{id:'a1',catalogId:'extra-vehicle-roadbike',name:'<b>x</b>',sdp:900,sdpMax:900,upgrades:['u','v'],notes:''},'a non-integer maximum falls back to the SDP; extra keys are dropped');
 const w=G.cleanVehicle({id:'a2',name:'n',sdp:50,sdpMax:20});assert.equal(w.sdp,20);
 assert.equal(G.cleanVehicle({id:'a3'}),null);assert.equal(G.cleanVehicle({id:'bad id',name:'n'}),null);assert.equal(G.cleanVehicle(null),null);assert.equal(G.cleanVehicle([]),null);
 const c={extra:{vehicles:[{id:'a',name:'x',sdp:1,sdpMax:2},{id:'a',name:'dup'},null,{id:'b',name:'y'}]}};
 eq(G.readVehicles(c).map(x=>x.id),['a','b']);
 const before=JSON.stringify(c.extra);G.readVehicles(c);assert.equal(JSON.stringify(c.extra),before,'reading never writes');
});

test('garage: collision damage uses vehicle-tools dice (6d6) and reaches the roll history',()=>{
 const {G,char,calls}=load();
 const rolled=G.rollCollision(()=>0.5);eq(rolled,{dice:[4,4,4,4,4,4],total:24});
 const r=G.rollCollision();assert.equal(r.dice.length,6);assert(r.dice.every(d=>d>=1&&d<=6));assert.equal(r.total,r.dice.reduce((a,b)=>a+b,0));
 assert.equal(load({tools:false}).G.rollCollision(),null,'without the vehicle module there is no roll');
 G.addVehicle(char,{catalogId:'extra-vehicle-roadbike'},'ru',ids);const id=G.readVehicles(char)[0].id;
 assert(G.handle(btn('hit',{grId:id})));
 const sum=calls.find(c=>c[0]==='sum');assert(sum,'goes to Rolls');assert.equal(sum[2].length,6);assert.equal(sum[3],6);
 assert(calls.some(c=>c[0]==='render'));
 assert.equal(G.readVehicles(char)[0].sdp,35,'rolling alone changes nothing');
 const html=G.render(char,'en');assert(html.includes('data-gr-action="hit-apply"'));assert(html.includes(`value="${sum[4].total}"`));
 assert(G.combatRows(char,'ru').includes('data-gr-action="hit-apply"'));
 // The offered sum can be corrected before it is applied.
 const input={value:'7'},apply=btn('hit-apply',{grId:id});apply.target.closest=s=>s==='[data-gr-action]'?apply.target:s==='.gr-hit'?{querySelector:()=>input}:null;
 assert(G.handle(apply));assert.equal(G.readVehicles(char)[0].sdp,28);
 assert(calls.some(c=>c[0]==='action'&&/7/.test(c[1])&&c[2]==='Вернуть'),'a notice with undo');
 assert(!G.render(char,'en').includes('hit-apply'),'the offer is gone once applied');
});

test('garage: click handling checks the sheet, steps SDP and offers undo for removal',()=>{
 const {G,char,calls}=load();
 G.addVehicle(char,{catalogId:'extra-vehicle-roadbike'},'ru',ids);const id=G.readVehicles(char)[0].id;
 assert(G.handle(btn('sdp-minus',{grId:id})));assert.equal(G.readVehicles(char)[0].sdp,34);
 assert(calls.some(c=>c[0]==='save'));assert(calls.some(c=>c[0]==='render'));
 assert(G.handle(btn('sdp-plus',{grId:id})));assert.equal(G.readVehicles(char)[0].sdp,35);
 // Another character, or a vehicle that is gone: nothing is written.
 calls.length=0;
 assert(G.handle(btn('sdp-minus',{grId:id,grChar:'other'})));assert(G.handle(btn('sdp-minus',{grId:'gone'})));
 assert.equal(G.readVehicles(char)[0].sdp,35);assert.equal(calls.filter(c=>c[0]==='notify').length,2);assert(!calls.some(c=>c[0]==='save'));
 assert.equal(G.handle({type:'click',target:{closest:()=>null}}),false);
 assert.equal(G.handle({type:'input',target:btn('remove').target}),false);
 calls.length=0;
 assert(G.handle(btn('remove',{grId:id})));assert.equal(G.readVehicles(char).length,0);
 const act=calls.find(c=>c[0]==='action');assert(act);assert.match(act[1],/Дорожный мотоцикл/);
 act[3]();assert.equal(G.readVehicles(char).length,1,'the notice brings it back');
 assert.equal(calls.filter(c=>c[0]==='notify').pop()[1].includes('Возвращено'),true);
 act[3]();assert.equal(G.readVehicles(char).length,1,'a second press does nothing');
});

test('garage: add from the form, typed fields are saved and bad input is reported',()=>{
 const {G,char,calls}=load();
 const fields={'[data-gr-vehicle-pick]':{value:'extra-vehicle-av4',focus(){}},'[data-gr-new-name]':{value:''},'[data-gr-new-sdp]':{value:''}};
 const root={querySelector:s=>fields[s]||null},add=btn('add');add.target.closest=s=>s==='[data-gr-action]'?add.target:s==='[data-garage]'?root:null;
 assert(G.handle(add));assert.equal(G.readVehicles(char).length,1);assert.equal(G.readVehicles(char)[0].catalogId,'extra-vehicle-av4');
 fields['[data-gr-vehicle-pick]'].value='';calls.length=0;
 assert(G.handle(add));assert.equal(G.readVehicles(char).length,1);assert(calls.some(c=>c[0]==='notify'&&/Впишите/.test(c[1])));
 fields['[data-gr-new-name]'].value='Свой';fields['[data-gr-new-sdp]'].value='25';assert(G.handle(add));assert.equal(G.readVehicles(char)[1].sdpMax,25);
 const id=G.readVehicles(char)[0].id,field=(k,value)=>({type:'change',target:{value,dataset:{grField:k,grChar:'c1',grId:id}}});
 assert(G.handleChange(field('sdp','10')));assert.equal(G.readVehicles(char)[0].sdp,10);
 assert(G.handleChange(field('notes','tow')));assert.equal(G.readVehicles(char)[0].notes,'tow');
 assert(G.handleChange(field('name','Blue')));assert.equal(G.readVehicles(char)[0].name,'Blue');
 calls.length=0;assert(G.handleChange(field('sdp','abc')));assert.equal(G.readVehicles(char)[0].sdp,10);assert(calls.some(c=>c[0]==='notify'));
 assert.equal(G.handleChange({type:'change',target:{dataset:{}}}),false);
});

test('garage: the card is escaped, bilingual and carries accessible names and 44px-ready controls',()=>{
 const {G,char}=load();
 G.addVehicle(char,{name:'<img src=x onerror=alert(1)>',sdpMax:12},'ru',ids);G.addVehicle(char,{catalogId:'extra-vehicle-helicopter'},'ru',ids);
 const id=G.readVehicles(char)[1].id;G.installUpgrade(char,id,'extra-upgrade-nos','ru');
 for(const lang of ['ru','en']){
  const html=G.render(char,lang);
  assert(!html.includes('<img src=x'),'escaped');assert(!/<script/i.test(html));
  assert(html.includes('data-garage'));assert(html.includes('role="progressbar"'));
  assert(/aria-label="[^"]*(SDP|Гараж|Дорожный|Helicopter|Вертолёт)[^"]*"/.test(html));
  for(const m of html.matchAll(/<button [^>]*data-gr-action="[^"]+"[^>]*>/g))assert(/aria-label=|>[^<]/.test(m[0]+'x'));
 }
 assert(G.render(char,'ru').includes('ГАРАЖ'));assert(G.render(char,'en').includes('GARAGE'));assert(G.render(char,'ru').includes('Вертолёт'));
 assert(G.render(char,'en').includes('Helicopter'));assert(G.render(char,'en').includes('NOS'));
 assert.equal(G.render(null,'ru'),'');
 assert(load().G.render({id:'z',extra:{}},'ru').includes('нет транспорта'));
 // Every T string exists in both languages.
 const {T}=G;eq(Object.keys(T.ru).sort(),Object.keys(T.en).sort());
 // Zero SDP is flagged.
 G.setSdp(char,id,0,'en');assert(G.render(char,'en').includes('gr-zero'));
 assert(G.combatRows(char,'en').includes('data-gr-combat'));assert.equal(G.combatRows({id:'q',extra:{}},'en'),'');
});

test('garage: files are registered, the script loads before app.js and sources use LF',()=>{
 const html=read('index.html');
 assert.match(html,/<script src="vehicle-tools\.js"><\/script><script src="garage\.js"><\/script>/);
 assert(html.indexOf('garage.js')<html.indexOf('src="app.js"'));assert(html.includes('href="garage.css"'));assert(html.includes('href="night-market-saved.css"'));
 for(const f of ['garage.js','garage.css','night-market.js','night-market-saved.css'])assert(!read(f).includes('\r'),f);
 assert(/min-height:\s*44px|min-width:44px/.test(read('garage.css')));
});

test('garage: valid() refuses hand-edited vehicles instead of repairing them',()=>{
 const ok={id:'v1',catalogId:'extra-vehicle-roadbike',sdp:5,sdpMax:35,upgrades:['extra-upgrade-nos'],notes:'x'};
 const {G}=load();const v=x=>G.valid({id:'c',extra:{vehicles:x}});
 assert.equal(G.valid({id:'c'}),true);assert.equal(G.valid({id:'c',extra:{}}),true);assert.equal(v([ok]),true);assert.equal(v([{id:'v2',name:'Truck',sdp:0,sdpMax:9999}]),true);
 for(const bad of [
  {...ok,sdp:'5'},{...ok,sdpMax:'abc'},{...ok,sdpMax:1e9},{...ok,sdp:-5},{...ok,sdp:36},{...ok,sdp:1.5},{...ok,upgrades:'nos'},{...ok,upgrades:[1]},{...ok,upgrades:['a','a']},
  {...ok,notes:5},{...ok,name:5},{...ok,id:'a b'},{id:'v3',sdp:1,sdpMax:1},{...ok,catalogId:7},null,'x'])assert.equal(v([bad]),false,JSON.stringify(bad));
 assert.equal(v([ok,{...ok}]),false,'duplicate ids');assert.equal(v('no'),false);assert.equal(v(Array.from({length:21},(_,i)=>({...ok,id:'v'+i}))),false);
});

test('garage: undo of one vehicle survives later changes to others; lowering the maximum can be undone',()=>{
 const {G,char}=load();
 G.addVehicle(char,{name:'A',sdpMax:20},'ru',ids);G.addVehicle(char,{name:'B',sdpMax:20},'ru',ids);
 const [a,b]=G.readVehicles(char).map(x=>x.id);
 const hit=G.applyDamage(char,a,8,'ru');assert.equal(G.readVehicles(char)[0].sdp,12);
 G.setNotes(char,b,'later','ru');G.repair(char,b,'ru');
 assert(G.restore(char,hit.undo,'ru').ok,'the other vehicle changed, this one did not');assert.equal(G.readVehicles(char)[0].sdp,20);assert.equal(G.readVehicles(char)[1].notes,'later');
 G.applyDamage(char,a,1,'ru');const cut=G.setSdpMax(char,a,5,'ru');assert(cut.clipped);assert.equal(G.readVehicles(char)[0].sdp,5);
 assert(G.restore(char,cut.undo,'ru').ok);assert.equal(G.readVehicles(char)[0].sdpMax,20);assert.equal(G.readVehicles(char)[0].sdp,19);
 assert.equal(G.setSdpMax(char,a,30,'ru').clipped,undefined,'raising the maximum clips nothing');
 const rm=G.removeVehicle(char,a,'ru');G.removeVehicle(char,b,'ru');
 assert(G.restore(char,rm.undo,'ru').ok);assert.equal(G.readVehicles(char)[0].id,a);
 G.applyDamage(char,a,1,'ru');assert.equal(G.restore(char,rm.undo,'ru').key,'stale','the vehicle itself changed: refused');
});

test('garage: the id and the sheet id are escaped, and every on-screen copy of the counter is updated',()=>{
 const {G,char}=load();char.id='c1"><b id=x>';
 G.addVehicle(char,{name:'A',sdpMax:20},'ru',ids);
 const html=G.render(char,'en')+G.combatRows(char,'en');
 assert(!html.includes('<b id=x>'),'sheet id escaped');
 assert.equal((html.match(/data-gr-box="/g)||[]).length,2,'card and dock both carry a box');
 const css=read('garage.css');assert(/\.garage \.rule-source[^{]*\{[^}]*min-height:44px/.test(css),'page links are 44px');assert(/html \.garage input/.test(css),'inputs win over the look rules');
});

test('garage: SDP + never goes above the maximum and - never below zero',()=>{
 const {G,char}=load(),r=G.addVehicle(char,{name:'Van',sdpMax:20},'en',ids);assert(r.ok);
 const id=r.id,sdp=()=>G.readVehicles(char)[0].sdp;
 assert.equal(sdp(),20);
 assert(G.adjustSdp(char,id,1,'en').ok);assert.equal(sdp(),20,'+1 at full stays at the maximum');
 assert(G.adjustSdp(char,id,-5,'en').ok);assert.equal(sdp(),15);
 assert(G.adjustSdp(char,id,100,'en').ok);assert.equal(sdp(),20);
 assert(G.adjustSdp(char,id,-100,'en').ok);assert.equal(sdp(),0);
});
