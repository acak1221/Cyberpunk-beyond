const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),test=require('node:test');
const site=path.join(__dirname,'..','site');
const WORDS={no:0,a:1,an:1,one:1,two:2,three:3,four:4,five:5};
// The first number (digit or word) in a catalog fragment.
function numberIn(text){const m=/\b(\d+|no|an?|one|two|three|four|five)\b/i.exec(text);if(!m)return null;const w=m[1].toLowerCase();return /^\d+$/.test(w)?Number(w):WORDS[w]}
function load(files){
 const ctx={window:{confirm:()=>true},console};vm.createContext(ctx);
 for(const f of files)vm.runInContext(fs.readFileSync(path.join(site,f),'utf8'),ctx,{filename:f});
 return ctx.window;
}
const BASE=['catalog.js','catalog-extra.js'];
const W=load([...BASE,'cyber-slots.js']),S=W.CyberSlots,CAT=W.CATALOG;
const find=id=>CAT.find(x=>x.id===id);
const plain=x=>JSON.parse(JSON.stringify(x));
const lower=s=>String(s).toLowerCase();

test('every foundation number is read back from the catalog text of that item',()=>{
 for(const [k,f] of Object.entries(S.FOUNDATIONS)){
  const it=find('cyberware-'+k);assert.ok(it,k);
  assert.ok(it.details.en.includes(f.text),`${k}: catalog text lacks "${f.text}"`);
  assert.equal(numberIn(f.text),f.slots,`${k}: "${f.text}" does not say ${f.slots}`);
  assert.equal(it.stats.optionSlots,f.slots,`${k}: stats.optionSlots`);
 }
});
test('every option cost and requirement is read back from the catalog text',()=>{
 for(const [k,o] of Object.entries(S.OPTIONS)){
  const it=find('cyberware-'+k);assert.ok(it,k);
  const text=lower(it.details.en);
  if(o.pool){assert.ok(it.details.en.includes(o.text),k);assert.equal(numberIn(o.text),o.cost);assert.equal(it.stats.pool,o.pool);assert.equal(it.stats.slotCost,o.cost);continue}
  for(const r of o.requires)assert.ok(find('cyberware-'+r)&&S.FOUNDATIONS[r],`${k}: ${r} is not a foundation`);
  const named=o.requires.map(r=>lower(find('cyberware-'+r).name.en)).join(' or ');
  assert.ok(text.includes(named),`${k}: text does not name ${named}`);
  assert.deepEqual(Array.from(it.stats.requires),Array.from(o.requires,x=>'cyberware-'+x));
  if(o.cost!==undefined){
   assert.equal(it.stats.slotCost,o.cost,k);
   if(o.costFrom){assert.equal(S.FOUNDATIONS[o.costFrom].slots,o.cost,`${k}: one chip fills the socket`);assert.ok(find('cyberware-'+o.costFrom).details.en.includes(S.FOUNDATIONS[o.costFrom].text))}
   else{assert.ok(o.text,`${k}: a cost needs a quoted fragment`);assert.ok(it.details.en.includes(o.text),`${k}: catalog text lacks "${o.text}"`);assert.equal(numberIn(o.text),o.cost,`${k}: "${o.text}" does not say ${o.cost}`)}
  }else assert.equal(it.stats.slotCost,undefined,`${k}: no cost is stated, so none is invented`);
  if(o.standalone&&k!=='standard-hand'&&k!=='standard-foot')assert.match(it.details.en,/sole cyberware in a meat (arm|leg)/);
 }
});
test('only-one groups quote the catalog and name real items',()=>{
 for(const [g,def] of Object.entries(S.GROUPS)){
  for(const m of def.members){const it=find('cyberware-'+m);assert.ok(it,m);assert.equal(S.groupOf(it),g);if(def.text)assert.ok(lower(it.details.en).includes(lower(def.text)),`${g}/${m}`)}
 }
});
test('every catalog cyberware that says it requires a foundation is in the table',()=>{
 const re=/requires?\b[^.;]*\b(cyberarm|cyberleg|cybereye|cyberaudio suite|neural link|chipware socket)/i;
 const missing=CAT.filter(x=>x.category==='cyberware'&&!x.custom&&re.test(x.details.en)&&!S.isOption(x)).map(x=>x.id);
 assert.deepEqual(Array.from(missing),[]);
 // options and foundations are distinct from plain cyberware
 assert.equal(S.isOption(find('cyberware-biomonitor')),false);assert.equal(S.isFoundation(find('cyberware-cyberarm')),true);
});
test('applying the table twice changes nothing',()=>{const before=JSON.stringify(CAT);assert.equal(S.applyToCatalog(),0);assert.equal(JSON.stringify(CAT),before)});

const person=(items=[],installs=[],extra={})=>({id:'c1',stats:{EMP:6,BODY:8},humanity:60,extra:{items,equipment:{installs},...extra}});
let n=0;const inst=(catalogId,host)=>({id:'i'+(++n),recordId:'r'+n,catalogId,...(host?{host}:{})});
const id=x=>'cyberware-'+x;

test('a foundation shows used and free slots with the options inside',()=>{
 const arm=inst(id('cyberarm')),deck=inst(id('cyberdeck'),'i:'+arm.id),rip=inst(id('rippers'));
 const c=person([],[arm,deck,rip]);
 const l=S.layout(c);assert.equal(l.hosts.length,1);
 const h=l.hosts[0];assert.equal(h.capacity,4);assert.equal(h.used,4);assert.equal(h.free,0);
 assert.deepEqual(Array.from(h.options,o=>[o.catalogId,o.cost]),[[id('cyberdeck'),3],[id('rippers'),1]]);
 const html=S.renderPanel(c,'en');assert.match(html,/4 of 4 used/);assert.match(html,/no free slots/);assert.match(html,/Cyberarm/);
 assert.match(S.renderPanel(c,'ru'),/занято 4 из 4/);
});
test('installing an option without a free compatible slot is refused with a reason',()=>{
 const none=person();
 let r=S.check(none,id('chyron'),{lang:'en'});assert.equal(r.ok,false);assert.equal(r.reason,'noFoundation');assert.match(r.message,/Cybereye/);
 assert.match(S.check(none,id('chyron'),{lang:'ru'}).message,/нужна основа/);
 const eye=inst(id('cybereye')),dart=inst(id('dartgun-cybereye'),'i:'+eye.id);
 const full=person([],[eye,dart]);
 r=S.check(full,id('chyron'),{lang:'en'});assert.equal(r.reason,'noFreeSlot');assert.match(r.message,/takes 1/);
 const roomy=person([],[eye]);
 r=S.check(roomy,id('microvideo'),{lang:'en'});assert.equal(r.ok,true);assert.equal(r.host,'i:'+eye.id);assert.equal(r.cost,2);
 r=S.check(roomy,id('dartgun-cybereye'),{lang:'en'});assert.equal(r.ok,true);
 // a chip needs a socket, and a socket needs a Neural Link
 assert.equal(S.check(person([],[inst(id('neural-link'))]),id('memory-chip')).reason,'noFoundation');
 const link=inst(id('neural-link')),sock=inst(id('chipware-socket'),'i:'+link.id);
 assert.equal(S.check(person([],[link,sock]),id('memory-chip')).ok,true);
 const chip=inst(id('memory-chip'),'i:'+sock.id);
 assert.equal(S.check(person([],[link,sock,chip]),id('skill-chip')).reason,'noFreeSlot','one socket holds one chip');
});
test('nested foundations: a Sensor Array adds audio slots and needs a Suite',()=>{
 assert.equal(S.check(person(),id('sensor-array')).reason,'noFoundation');
 const suite=inst(id('cyberaudio-suite')),arr=inst(id('sensor-array'));
 const opts=['amplified-hearing','level-damper','bug-detector'].map(k=>inst(id(k)));
 const c=person([],[suite,...opts]);
 assert.equal(S.check(c,id('radar-detector-implant')).reason,'noFreeSlot');
 const c2=person([],[suite,arr,...opts]);
 assert.equal(S.check(c2,id('radar-detector-implant')).ok,true);
 const lay=S.layout(c2);assert.equal(lay.hosts.length,2);assert.equal(lay.loose.length,0);
});
test('standalone limb options may go on a meat limb; others need a foundation',()=>{
 const r=S.check(person(),id('wolvers'),{lang:'en'});assert.equal(r.ok,true);assert.equal(r.host,null);assert.equal(r.loose,true);
 assert.equal(S.check(person(),id('grapple-hand')).ok,false);
 const lay=S.layout(person([],[inst(id('wolvers'))]));assert.equal(lay.loose[0].reason,'standalone');
 assert.equal(S.check(person(),id('standard-hand')).ok,true,'a standard hand takes no slot');
 // zero-cost coverings still need a limb
 assert.equal(S.check(person(),id('plastic-covering')).reason,'noFoundation');
 const arm=inst(id('cyberarm'));assert.equal(S.check(person([],[arm]),id('plastic-covering')).ok,true);
 assert.equal(S.check(person([],[inst(id('cyberleg'))]),id('superchrome-covering')).ok,true);
});
test('one-only groups warn, name the installed item and offer replace for installed copies only',()=>{
 const sig=inst(id('implanted-linear-frame-sigma'));
 let r=S.check(person([],[sig]),id('implanted-linear-frame-beta'),{lang:'en'});
 assert.equal(r.reason,'oneOnly');assert.equal(r.replaceable,true);assert.deepEqual(Array.from(r.conflicts),['i:'+sig.id]);assert.match(r.message,/Linear Frame/);
 assert.equal(S.check(person([],[sig]),id('implanted-linear-frame-sigma')).reason,'oneOnly');
 assert.equal(S.check(person([],[sig]),id('implanted-linear-frame-beta'),{skip:new Set(['i:'+sig.id])}).ok,true);
 assert.equal(S.check(person([],[inst(id('kerenzikov'))]),id('sandevistan')).reason,'oneOnly','the group is checked before the foundation');
 assert.equal(S.check(person(),id('sandevistan')).reason,'noFoundation');
 const link=inst(id('neural-link')),ker=inst(id('kerenzikov'));
 assert.equal(S.check(person([],[link,ker]),id('sandevistan')).reason,'oneOnly');
 assert.equal(S.check(person([],[inst(id('cyberaudio-suite'))]),id('cyberaudio-suite')).reason,'oneOnly');
 // a starting implant is counted but cannot be replaced by the tool
 const starter=person([{id:'s1',catalogId:id('implanted-linear-frame-sigma'),quantity:1,humanityLossIncluded:true}]);
 r=S.check(starter,id('implanted-linear-frame-beta'));assert.equal(r.reason,'oneOnly');assert.equal(r.replaceable,false);
});
test('starting implants fill slots too; removed installs free them',()=>{
 const items=[{id:'s1',catalogId:id('cyberarm'),quantity:2,humanityLossIncluded:true},{id:'s2',catalogId:id('cyberdeck'),quantity:1,humanityLossIncluded:true}];
 const c=person(items);const l=S.layout(c);assert.equal(l.hosts.length,2);
 assert.equal(l.hosts.map(h=>h.used).sort().join(),'0,3');
 const arm=inst(id('cyberarm')),rip=inst(id('rippers'),'i:'+arm.id);rip.removedAt='2026-01-01';
 assert.equal(S.layout(person([],[arm,rip])).hosts[0].used,0);
});
test('paired options spread over foundations; a chosen foundation is honoured',()=>{
 const e1=inst(id('cybereye')),e2=inst(id('cybereye'));
 const a=inst(id('image-enhance')),b=inst(id('image-enhance'));
 const lay=S.layout(person([],[e1,e2,a,b]));assert.deepEqual(Array.from(lay.hosts,h=>h.used),[1,1]);
 const pinned=inst(id('chyron'),'i:'+e2.id);
 assert.equal(S.layout(person([],[e1,e2,pinned])).hosts[1].used,1);
 const ch=S.hostChoices(person([],[e1,e2]),id('chyron'),'en');assert.equal(ch.length,2);assert.match(ch[0].label,/Cybereye #1/);
 assert.match(S.hostSelect(person([],[e1,e2]),id('chyron'),'en'),/data-eq-host/);assert.equal(S.hostSelect(person([],[e1]),id('chyron'),'en'),'');
 assert.equal(S.check(person([],[e1,e2]),id('chyron'),{host:'i:'+e2.id}).host,'i:'+e2.id);
 assert.equal(S.check(person([],[e1,e2]),id('chyron'),{host:'i:nope'}).reason,'noFreeSlot');
});
test('a cost the catalog does not state is the player setting; the catalog number cannot be overridden',()=>{
 const arm=inst(id('cyberarm')),g=inst(id('grapple-hand'),'i:'+arm.id);
 const c=person([],[arm,g]);
 assert.equal(S.layout(c).hosts[0].options[0].source,'default');assert.equal(S.layout(c).hosts[0].used,1);
 assert.equal(S.setDefaultCost(c,2).dirty,true);assert.equal(S.layout(c).hosts[0].used,2);
 assert.equal(S.setCost(c,id('grapple-hand'),3).ok,true);assert.equal(S.layout(c).hosts[0].used,3);assert.equal(S.layout(c).hosts[0].options[0].source,'user');
 assert.equal(S.setCost(c,id('cyberdeck'),1).ok,false,'a stated cost stays');
 assert.equal(S.setCost(c,'nonsense',1).ok,false);assert.equal(S.setCost(c,id('grapple-hand'),9).ok,false);assert.equal(S.setDefaultCost(c,'x').ok,false);
 assert.deepEqual(plain(c.extra.cyberSlots),{version:1,defaultCost:2,costs:{[id('grapple-hand')]:3}});
 assert.match(S.renderPanel(c,'en'),/data-cs-cost="cyberware-grapple-hand"/);
 // change events
 const el={dataset:{csCost:id('grapple-hand')},value:'1'};const r=S.handleChange(el,c,'en');assert.equal(r.handled,true);assert.equal(r.dirty,true);assert.equal(c.extra.cyberSlots.costs[id('grapple-hand')],1);
 assert.equal(S.handleChange({dataset:{csDefault:''},value:'0'},c,'en').dirty,true);assert.equal(c.extra.cyberSlots.defaultCost,0);
 assert.equal(S.handleChange({dataset:{}},c,'en').handled,false);
});
test('old and damaged saves load: unreadable settings and shapes fall back, nothing is written by reading',()=>{
 for(const extra of [undefined,null,5,'x',[],{},{cyberSlots:5},{cyberSlots:{version:2,defaultCost:9}},{cyberSlots:JSON.parse('{"version":1,"defaultCost":"x","costs":{"a":99,"__proto__":1,"cyberware-grapple-hand":"2"},"manual":{"__proto__":2}}')},{equipment:5},{equipment:{installs:'x'}},{items:'x'},{equipment:{installs:[null,5,{id:3},{id:'a',catalogId:{}}]},items:[null,{humanityLossIncluded:true}]}]){
  const c={id:'c',extra},before=JSON.stringify(c);
  const lay=S.layout(c);assert.deepEqual(plain(lay),{hosts:[],loose:[]});assert.match(S.renderPanel(c,'en'),/data-cs-panel/);
  const st=S.settings(c);assert.ok(st.defaultCost>=0&&st.defaultCost<=5);assert.equal(JSON.stringify(c),before);
 }
 assert.equal(S.settings({extra:{cyberSlots:{version:1,defaultCost:'x',costs:{[id('grapple-hand')]:'2',zz:99}}}}).costs[id('grapple-hand')],2);
 // foreign extra.cyberSlots is not written over
 const foreign={extra:{cyberSlots:'mine'}};assert.equal(S.setDefaultCost(foreign,2).reason,'foreign');assert.equal(foreign.extra.cyberSlots,'mine');
 assert.equal(S.setDefaultCost({id:'x',extra:5},2).reason,'foreign');
 assert.equal(S.check({id:'x'},id('biomonitor')).ok,true);assert.equal(S.check({id:'x'},'no-such-item').ok,true);
 // too many installs for the foundation (an old save) is shown, not refused
 const arm=inst(id('cyberarm')),o1=inst(id('cyberdeck'),'i:'+arm.id),o2=inst(id('popup-shield'));
 const lay=S.layout(person([],[arm,o1,o2]));assert.equal(lay.loose[0].reason,'overflow');assert.match(S.renderPanel(person([],[arm,o1,o2]),'ru'),/проверьте запись вручную/);
});
test('the panel escapes names and carries accessible names for its selects',()=>{
 const win=load([...BASE,'cyber-slots.js']);const cs=win.CyberSlots;
 win.CATALOG.push({id:'custom-x',custom:true,category:'cyberware',name:{ru:'<b>X</b>',en:'<img src=x onerror=1>'},price:null,details:{ru:'',en:''},stats:{humanityLoss:'0',humanityLossAtCreation:0,installation:'Clinic',optionSlots:2}});
 win.CATALOG.push({id:'custom-y',custom:true,category:'cyberware',name:{ru:'Y',en:'"><script>1</script>'},price:null,details:{ru:'',en:''},stats:{humanityLoss:'0',humanityLossAtCreation:0,installation:'Clinic',requires:['custom-x']}});
 const c=person([],[{id:'ia',recordId:'ra',catalogId:'custom-x'},{id:'ib',recordId:'rb',catalogId:'custom-y'}]);
 const html=cs.renderPanel(c,'en');assert.ok(!/<img|<script/.test(html));assert.match(html,/&lt;img/);assert.match(html,/aria-label="Slot cost/);
 assert.match(html,/1 of 2 used/);
});

// ---------- the equipment tool ----------
const E=load([...BASE,'character-extra.js','equipment-tools.js','cyber-slots.js']),M=E.EquipmentTools;
const eq=id=>E.CATALOG.find(x=>x.id===id);
const character=()=>({id:'c1',name:'V',role:'solo',stats:{INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{Handgun:2},hp:45,humanity:60,head:0,bodyArmor:0,extra:{cash:100000,gearBudget:2550,fashionBudget:800,items:[],weapons:[]}});
function ready(){const c=character();M.setScope('slots-'+(++n));M.setMax(c,60,'en',true);return c}
function buy(c,cat){assert.equal(M.purchase(c,eq(cat),'cash','en',{confirmed:true}).ok,true);return c.extra.items[c.extra.items.length-1].id}
function put(c,cat,opts){const rec=buy(c,cat),p=M.prepare(c,rec,'creation','included',true,'en',undefined,opts);if(!p.ok)return p;const r=M.commit(c,p.draft,'en',true);return {...r,recordId:rec}}
const slotText=c=>M.render(c,'en');

test('the equipment tool refuses an option without a foundation and keeps the data unchanged',()=>{
 const c=ready(),rec=buy(c,id('chyron')),before=JSON.stringify(c);
 const r=M.prepare(c,rec,'creation','included',true,'en');
 assert.equal(r.ok,false);assert.equal(r.reason,'noFoundation');assert.match(r.message,/Cybereye/);assert.equal(JSON.stringify(c),before);
 assert.match(slotText(c),/Needs a foundation: Cybereye/);
});
test('install a foundation, then options; the record remembers the host, slots fill, the 4th option is refused',()=>{
 const c=ready();
 assert.equal(put(c,id('cyberarm')).ok,true);
 const armKey='i:'+c.extra.equipment.installs[0].id;
 let r=put(c,id('cyberdeck'));assert.equal(r.ok,true);assert.equal(c.extra.equipment.installs[1].host,armKey);
 r=put(c,id('rippers'));assert.equal(r.ok,true);
 const h=S.layout(c).hosts[0];assert.equal(h.used,4);
 r=put(c,id('tool-hand'));assert.equal(r.ok,true,'standalone limb options may go on a meat limb even when the cyberarm is full');
 const rec=buy(c,id('grapple-hand')),p=M.prepare(c,rec,'creation','included',true,'en');
 assert.equal(p.ok,false);assert.equal(p.reason,'noFreeSlot');
 const html=slotText(c);assert.match(html,/data-cs-panel/);assert.match(html,/4 of 4 used/);
});
test('the preview goes stale when the slot is taken before confirming',()=>{
 const c=ready();put(c,id('cybereye'));
 const a=buy(c,id('dartgun-cybereye')),b=buy(c,id('microoptics'));
 const pa=M.prepare(c,a,'creation','included',true,'en');assert.equal(pa.ok,true);
 // meanwhile the slots are used by hand-edited data
 c.extra.equipment.installs.push({id:'zz',recordId:'x',catalogId:id('microvideo'),host:'i:'+c.extra.equipment.installs[0].id});
 const r=M.commit(c,pa.draft,'en',true);assert.equal(r.ok,false);assert.equal(r.reason,'stale');
 void b;
});
test('removing a foundation that still holds options is refused; removing the options first works',()=>{
 const c=ready();put(c,id('cyberarm'));put(c,id('rippers'));
 const [arm,rip]=c.extra.equipment.installs;
 let r=M.uninstall(c,arm.id,true,true,'en');assert.equal(r.ok,false);assert.equal(r.reason,'hasOptions');assert.match(r.message,/Rippers/);assert.ok(!arm.removedAt);
 r=M.uninstall(c,rip.id,true,true,'en');assert.equal(r.ok,true);
 r=M.uninstall(c,arm.id,true,true,'en');assert.equal(r.ok,true);
});
function click(c,action,data){
 const row={querySelector:()=>null},btn={dataset:{eqAction:action,...data},closest:s=>s==='.et-root'?{isConnected:true}:s==='[data-eq-cyber]'?row:null,isConnected:true};
 return M.handle({type:'click',target:{closest:s=>s==='[data-eq-action]'?btn:null,hasAttribute:()=>false,dataset:{}}},c,'en',{});
}
test('a second Linear Frame: the row says it replaces, the preview shows it, nothing changes until confirmed',()=>{
 const c=ready();let r=put(c,id('implanted-linear-frame-sigma'));assert.equal(r.ok,true);
 const rec=buy(c,id('implanted-linear-frame-beta')),plainTry=M.prepare(c,rec,'creation','included',true,'en');
 assert.equal(plainTry.reason,'oneOnly');assert.equal(plainTry.replaceable,true);
 assert.match(M.render(c,'en'),/Installing this replaces it/);
 const before=JSON.stringify(c.extra.equipment),humBefore=c.humanity;
 let h=click(c,'prepare',{eqId:rec});
 assert.equal(h.handled,true);assert.equal(h.rerender,true);assert.ok(!h.dirty,'the sheet is untouched by the preview');
 assert.equal(JSON.stringify(c.extra.equipment),before);assert.equal(c.humanity,humBefore);
 assert.match(M.render(c,'en'),/This replaces the implant: Implanted Linear Frame/);
 click(c,'cancel',{});assert.equal(JSON.stringify(c.extra.equipment),before);assert.doesNotMatch(M.render(c,'en'),/data-eq-preview/);
 click(c,'prepare',{eqId:rec});
 const maxBeforeCommit=c.extra.equipment.maxHumanity;
 const done=click(c,'commit',{});assert.equal(done.dirty,true);
 assert.ok(c.extra.equipment.installs[0].removedAt);
 assert.deepEqual(Array.from(c.extra.equipment.installs.filter(i=>!i.removedAt),i=>i.catalogId),[id('implanted-linear-frame-beta')]);
 assert.equal(c.extra.equipment.maxHumanity,maxBeforeCommit,'the old cut came back and the new one applied: one frame counts once');
});
test('replace is all or nothing: a failing preview or commit leaves the old implant, Humanity and maximum unchanged',()=>{
 const c=ready();put(c,id('implanted-linear-frame-sigma'));
 const rec=buy(c,id('implanted-linear-frame-beta'));
 // the new frame cannot be prepared (a found implant needs surgery money): the old one stays
 const bad=M.prepare(c,rec,'creation','found',true,'en');assert.equal(bad.reason,'oneOnly');
 c.extra.cash=0;const snap=JSON.stringify(c);
 const row={querySelector:s=>s==='[data-eq-origin]'?{value:'found'}:null};
 const btn={dataset:{eqAction:'prepare',eqId:rec},closest:s=>s==='.et-root'?{isConnected:true}:s==='[data-eq-cyber]'?row:null,isConnected:true};
 const h=M.handle({type:'click',target:{closest:s=>s==='[data-eq-action]'?btn:null,hasAttribute:()=>false,dataset:{}}},c,'en',{});
 assert.equal(h.handled,true);assert.ok(!h.rerender);assert.match(h.notify,/Not enough money/);assert.equal(JSON.stringify(c),snap);
 // a preview that goes stale before the commit changes nothing either
 c.extra.cash=100000;click(c,'prepare',{eqId:rec});
 c.humanity=c.humanity-1;
 const snap2=JSON.stringify(c.extra.equipment),humNow=c.humanity;
 const r=click(c,'commit',{});assert.ok(!r.dirty);
 assert.equal(c.humanity,humNow);assert.equal(JSON.stringify(c.extra.equipment),snap2);assert.ok(!c.extra.equipment.installs[0].removedAt);
});
test('replace is not offered for starting implants and fails whole when removal is impossible',()=>{
 const c=ready();c.extra.items.push({id:'st1',catalogId:id('implanted-linear-frame-sigma'),quantity:1,humanityLossIncluded:true});
 const rec=buy(c,id('implanted-linear-frame-beta')),p=M.prepare(c,rec,'creation','included',true,'en');
 assert.equal(p.reason,'oneOnly');assert.equal(p.replaceable,false);
 const h=click(c,'prepare',{eqId:rec});assert.match(h.notify,/starting implant/);
 const d=ready();put(d,id('cyberaudio-suite'));put(d,id('amplified-hearing'));
 const rec2=buy(d,id('cyberaudio-suite')),snap=JSON.stringify(d);
 const h2=click(d,'prepare',{eqId:rec2});assert.equal(h2.handled,true);assert.match(h2.notify,/Remove them first/);assert.equal(JSON.stringify(d),snap);
});
test('without the slots module the equipment tool behaves as before',()=>{
 const bare=load([...BASE,'character-extra.js','equipment-tools.js']),m=bare.EquipmentTools,cc=character();m.setScope('bare');m.setMax(cc,60,'en',true);
 m.purchase(cc,bare.CATALOG.find(x=>x.id===id('chyron')),'cash','en',{confirmed:true});
 assert.equal(m.prepare(cc,cc.extra.items[0].id,'creation','included',true,'en').ok,true);
 assert.doesNotMatch(m.render(cc,'en'),/data-cs-panel/);
});
test('slot panel selects work through the equipment tool change handler',()=>{
 const c=ready();put(c,id('cyberarm'));put(c,id('grapple-hand'));
 const el={dataset:{csCost:id('grapple-hand')},value:'2',hasAttribute:()=>false};
 const r=M.handle({type:'change',target:el},c,'en',{});assert.equal(r.handled,true);assert.equal(r.dirty,true);assert.equal(S.layout(c).hosts[0].used>=0,true);
 assert.equal(c.extra.cyberSlots.costs[id('grapple-hand')],2);
});

// ---------- custom foundations ----------
function loadCustom(){
 const store=new Map(),calls=[];
 const win={localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),key:i=>[...store.keys()][i]??null,get length(){return store.size}},App:{getState:()=>({gmExtras:{},campaigns:[]}),save(){},render(){},notify(){},lang:()=>'en'}};
 const ctx={window:win,Date,Math,JSON,Promise,setTimeout,globalThis:{}};vm.createContext(ctx);
 for(const f of ['catalog.js','catalog-extra.js','custom-content.js','cyber-slots.js'])vm.runInContext(fs.readFileSync(path.join(site,f),'utf8'),ctx,{filename:f});
 return {win,C:win.CustomContent,calls};
}
test('custom content: a foundation with N slots and an option that needs it are validated and optional',()=>{
 const {C}=loadCustom();
 const base={id:'shell',category:'cyberware',name:{en:'My shell'},price:'900',stats:{humanityLoss:'4d6',installation:'Hospital',optionSlots:'7'}};
 let r=C.checkItem(base);assert.equal(r.ok,true);assert.deepEqual(plain(r.item.stats),{humanityLoss:'4d6',humanityLossAtCreation:14,installation:'Hospital',optionSlots:7});
 r=C.checkItem({...base,stats:{...base.stats,optionSlots:'',slotCost:'2',requires:['cyberware-cyberarm','bad id!','x'.repeat(65),'cyberware-cyberarm']}});
 assert.equal(r.ok,true);assert.deepEqual(plain(r.item.stats),{humanityLoss:'4d6',humanityLossAtCreation:14,installation:'Hospital',slotCost:2,requires:['cyberware-cyberarm']});
 for(const bad of [{optionSlots:21},{optionSlots:'x'},{optionSlots:1.5},{slotCost:11},{slotCost:-1},{slotCost:'a'}])assert.equal(C.checkItem({...base,stats:{...base.stats,...bad}}).reason,'slots',JSON.stringify(bad));
 assert.deepEqual(plain(C.checkItem({...base,stats:{humanityLoss:'0'}}).item.stats),{humanityLoss:'0',humanityLossAtCreation:0,installation:'Clinic'},'old items are unchanged');
 assert.deepEqual(plain(C.checkItem({id:'g',category:'gear',name:{en:'Lamp'},stats:{optionSlots:5}}).item.stats),{},'only cyberware carries slot fields');
 assert.equal(C.checkItem({...base,stats:{...base.stats,requires:{},optionSlots:0}}).item.stats.optionSlots,undefined);
});
test('custom content: custom foundations hold options in the slot panel and in refusals',()=>{
 const {win,C}=loadCustom();
 const shell=C.cleanItem({id:'shell',category:'cyberware',name:{en:'My shell'},stats:{humanityLoss:'2d6',optionSlots:2}});
 const opt=C.cleanItem({id:'mod',category:'cyberware',name:{en:'My mod'},stats:{humanityLoss:'1d6',slotCost:2,requires:['custom-shell']}});
 const toCat=i=>({id:'custom-'+i.id,custom:true,category:i.category,name:{ru:i.name.en,en:i.name.en},price:null,page:null,details:{ru:'',en:''},stats:plain(i.stats)});
 win.CATALOG.push(toCat(shell),toCat(opt));
 const S2=win.CyberSlots;
 assert.equal(S2.check(person(),'custom-mod',{lang:'en'}).reason,'noFoundation');
 const host={id:'h1',recordId:'rh',catalogId:'custom-shell'};
 assert.equal(S2.check(person([],[host]),'custom-mod').ok,true);
 const m1={id:'m1',recordId:'rm',catalogId:'custom-mod',host:'i:h1'};
 assert.equal(S2.check(person([],[host,m1]),'custom-mod').reason,'noFreeSlot');
 assert.match(S2.renderPanel(person([],[host,m1]),'en'),/2 of 2 used/);
 // a custom option can also name a catalog foundation
 const arm=C.cleanItem({id:'arm2',category:'cyberware',name:{en:'Arm mod'},stats:{humanityLoss:'0',requires:['cyberware-cyberarm'],slotCost:1}});
 win.CATALOG.push(toCat(arm));assert.equal(S2.check(person([],[inst(id('cyberarm'))]),'custom-arm2').ok,true);
 assert.deepEqual(plain(S2.foundations('en').filter(x=>x.id==='custom-shell')),[{id:'custom-shell',name:'My shell'}]);
});
test('custom content: a pack file with slot fields is imported through the same validator and the form offers them',()=>{
 const {win,C}=loadCustom();
 const pack={format:C.PACK_FORMAT,version:C.VERSION,title:'t',items:[{id:'f',category:'cyberware',name:{en:'F'},stats:{humanityLoss:'1d6',optionSlots:3,evil:1}},{id:'bad',category:'cyberware',name:{en:'B'},stats:{humanityLoss:'1d6',optionSlots:99}}],npcs:[]};
 const r=C.parsePack?C.parsePack(JSON.stringify(pack)):C.cleanData(pack);
 const items=r.items||[];assert.equal(items.length,1);assert.equal(items[0].stats.optionSlots,3);assert.equal(items[0].stats.evil,undefined);
 const rejected=r.rejected||[];assert.equal(rejected.some(x=>x.reason==='slots'),true);
 void win;
});

test('__proto__ keys in saved settings are ignored',()=>{
 const c={id:'p',extra:{cyberSlots:JSON.parse('{"version":1,"defaultCost":1,"costs":{"__proto__":3},"manual":{"__proto__":2}}')}};
 const st=S.settings(c);assert.equal(Object.keys(st.costs).length,0);assert.equal(Object.keys(st.manual).length,0);assert.equal(({}).polluted,undefined);
});
test('foundations the sheet holds only as plain items can be counted by hand; options then fit and nothing else changes',()=>{
 const c=person([],[]);const before=JSON.stringify(c);
 const r0=S.check(c,id('kerenzikov'),{lang:'en'});assert.equal(r0.reason,'noFoundation');
 assert.equal(S.setManual(c,id('neural-link'),1).dirty,true);
 const r1=S.check(c,id('kerenzikov'));assert.equal(r1.ok,true);assert.ok(r1.host.startsWith('m:'));
 assert.equal(S.layout(c).hosts[0].capacity,5);assert.equal(S.setManual(c,id('neural-link'),1).dirty,false);
 assert.equal(S.setManual(c,id('kerenzikov'),1).ok,false,'only foundations');assert.equal(S.setManual(c,id('neural-link'),9).ok,false);
 assert.equal(c.humanity,60);assert.deepEqual(Array.from(Object.keys(c.extra.cyberSlots.manual)),[id('neural-link')]);
 assert.equal(S.setManual(c,id('neural-link'),0).dirty,true);assert.equal(S.check(c,id('kerenzikov')).ok,false);
 assert.notEqual(JSON.stringify(c),before);
 const html=(S.setManual(c,id('cyberarm'),2),S.renderPanel(c,'en'));assert.match(html,/data-cs-manual="cyberware-cyberarm"/);assert.match(html,/<option value="2" selected>2/);
 assert.equal(S.handleChange({dataset:{csManual:id('cyberleg')},value:'1'},c,'en').dirty,true);assert.equal(S.settings(c).manual[id('cyberleg')],1);
});
test('manual foundations work through the equipment tool and old sheets still load',()=>{
 const c=ready();c.extra.cyberSlots={version:1,defaultCost:1,costs:{},manual:{[id('neural-link')]:1}};
 const r=put(c,id('kerenzikov'));assert.equal(r.ok,true);assert.equal(c.extra.equipment.installs[0].host,'m:'+id('neural-link')+':0');
});
test('internal body options need a slot count the player enters; none is invented',()=>{
 for(const k of ['gills','toxin-binders','midnight-lady','mr-studd'])assert.equal(find(id(k)).stats.pool,'internal');
 const c=person([],[inst(id('gills'))]);
 assert.equal(S.layout(c).loose[0].reason,'noPool');assert.equal(S.check(c,id('toxin-binders')).ok,true,'untracked until a count is set');
 assert.equal(S.setInternal(c,2).dirty,true);assert.equal(S.layout(c).hosts[0].pool,true);assert.equal(S.layout(c).hosts[0].used,1);
 assert.equal(S.check(c,id('toxin-binders')).ok,true);
 c.extra.equipment.installs.push(inst(id('toxin-binders')));
 const r=S.check(c,id('midnight-lady'),{lang:'en'});assert.equal(r.ok,false);assert.equal(r.reason,'noFreeSlot');assert.match(r.message,/internal body slots/);
 assert.match(S.renderPanel(c,'en'),/Internal body slots/);assert.equal(S.setInternal(c,'').dirty,true);assert.equal(S.settings(c).internalSlots,null);assert.equal(S.setInternal(c,99).ok,false);
});
test('a third Cybereye needs a MultiOptic Mount; legs stay at two; a third Cyberarm needs the shoulder mount',()=>{
 const spec=S.LIMITS;
 assert.ok(find(id('anti-dazzle')).details.en.toLowerCase().includes(spec.cybereye.baseText.toLowerCase()));
 assert.ok(find(id('multioptic-mount')).details.en.includes(spec.cybereye.text));assert.ok(find(id('artificial-shoulder-mount')).details.en.includes(spec.cyberarm.text));
 assert.ok(find(id('jump-booster')).details.en.includes(spec.cyberleg.baseText));
 const eyes=person([],[inst(id('cybereye')),inst(id('cybereye'))]);
 const r=S.check(eyes,id('cybereye'),{lang:'en'});assert.equal(r.reason,'limbLimit');assert.match(r.message,/2 of 2/);assert.match(r.message,/MultiOptic Mount/);
 eyes.extra.equipment.installs.push(inst(id('multioptic-mount')));assert.equal(S.check(eyes,id('cybereye')).ok,true);
 const legs=person([],[inst(id('cyberleg')),inst(id('cyberleg'))]);assert.equal(S.check(legs,id('cyberleg')).reason,'limbLimit');
 const arms=person([],[inst(id('cyberarm')),inst(id('cyberarm'))]);assert.equal(S.check(arms,id('cyberarm')).reason,'limbLimit');
 arms.extra.equipment.installs.push(inst(id('artificial-shoulder-mount')));assert.equal(S.check(arms,id('cyberarm')).ok,true);
 assert.equal(S.limbLimit(arms,find(id('cyberarm'))).max,4);
});
test('paired options with one copy are flagged in the panel',()=>{
 for(const k of ['anti-dazzle','image-enhance','low-light-infrared-uv','virtuality','jump-booster','grip-foot'])assert.equal(S.isPaired(find(id(k))),true,k);
 assert.equal(S.isPaired(find(id('chyron'))),false);
 const c=person([],[inst(id('cybereye')),inst(id('cybereye')),inst(id('image-enhance'))]);
 assert.match(S.renderPanel(c,'en'),/Paired option “Image Enhance”/);
 c.extra.equipment.installs.push(inst(id('image-enhance')));assert.doesNotMatch(S.renderPanel(c,'en'),/Paired option/);
});
test('the install check agrees with the layout drawn after saving: no overflow is created by an accepted install',()=>{
 const a1=inst(id('cyberarm')),a2=inst(id('cyberarm')),s1=inst(id('popup-shield'));
 const c=person([{id:'st',catalogId:id('rippers'),quantity:1,humanityLossIncluded:true},{id:'st2',catalogId:id('grapple-hand'),quantity:1,humanityLossIncluded:true}],[a1,a2,s1]);
 for(const k of ['popup-shield','cyberdeck','popup-melee-weapon']){
  const r=S.check(c,id(k));if(!r.ok)continue;
  const before=S.layout(c).loose.filter(o=>o.reason==='overflow').length;
  c.extra.equipment.installs.push({...inst(id(k)),host:r.host});
  assert.ok(S.layout(c).loose.filter(o=>o.reason==='overflow').length<=before,k);
 }
});
test('a custom option whose foundation was deleted is a plain item, not uninstallable',()=>{
 const win=load([...BASE,'cyber-slots.js']),cs=win.CyberSlots;
 win.CATALOG.push({id:'custom-opt',custom:true,category:'cyberware',name:{ru:'О',en:'O'},price:null,details:{ru:'',en:''},stats:{humanityLoss:'0',humanityLossAtCreation:0,installation:'Clinic',requires:['custom-gone']}});
 const c={id:'x',extra:{}};assert.equal(cs.isOption(win.CATALOG.find(x=>x.id==='custom-opt')),false);assert.equal(cs.check(c,'custom-opt').ok,true);
});
test('Russian plurals in the row notes and costs',()=>{
 const c={id:'x'};
 assert.match(S.rowNote(c,find(id('cyberarm')),'ru'),/4 слота опций/);assert.match(S.rowNote(c,find(id('cyberleg')),'ru'),/3 слота опций/);
 assert.match(S.rowNote(c,find(id('subdermal-grip')),'ru'),/Занимает: 1 слот\./);
 assert.match(S.rowNote(c,find(id('popup-shield')),'ru'),/Занимает: 3 слота\./);assert.match(S.rowNote(c,find(id('popup-shield')),'en'),/Takes 3 slots\./);
 assert.match(S.rowNote(c,find(id('subdermal-grip')),'en'),/Takes 1 slot\./);
});
test('row notes say before the tap that an install will be refused or will replace, and offer the cost setting when it is ours',()=>{
 const c=person([],[]);
 const note=S.rowNote(c,find(id('kerenzikov')),'en');assert.match(note,/cs-warn/);assert.match(note,/needs a foundation first/);assert.match(note,/data-cs-cost="cyberware-kerenzikov"/);
 assert.doesNotMatch(S.rowNote(c,find(id('popup-shield')),'en'),/data-cs-cost/,'a stated cost has no select');
 const d=person([],[inst(id('neural-link')),inst(id('kerenzikov'))]);
 assert.match(S.rowNote(d,find(id('sandevistan')),'en'),/Installing this replaces it/);
});
test('the panel is shown before anything is installed, its summary and selects are labelled',()=>{
 const html=S.renderPanel({id:'x',extra:{}},'ru');assert.match(html,/СЛОТЫ ОПЦИЙ/);assert.match(html,/<summary>Настройки слотов<\/summary>/);
 assert.equal((html.match(/<select/g)||[]).length,html.match(/<label/g).length);
});
