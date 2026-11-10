const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const site=path.join(__dirname,'..','site');
// The modules as the page loads them: catalog, effects layer, implants.
function load(){
 const w={Math,JSON,Set,Map,Number,String,Array,Object,RegExp,Error,console:{log(){},warn(){},error(){}},setTimeout:()=>0};
 w.window=w;w.globalThis=w;vm.createContext(w);
 for(const f of ['catalog.js','effects.js','implants.js'])vm.runInContext(fs.readFileSync(path.join(site,f),'utf8'),w,{filename:f});
 return w;
}
const W=load(),I=W.Implants,E=W.Effects;
const GRAFT='cyberware-grafted-muscle-and-bone-lace',SIGMA='cyberware-implanted-linear-frame-sigma',BETA='cyberware-implanted-linear-frame-beta',WEAVE='cyberware-skin-weave',SUBDERMAL='cyberware-subdermal-armor',SANDY='cyberware-sandevistan',AIR='cyberware-independent-air-supply';
let n=0;
// A sheet with the named implants installed through the equipment tool.
function person(ids,over={}){
 const installs=ids.map(id=>({id:'ins'+(++n),recordId:'rec'+n,catalogId:id}));
 return {id:'p',name:'Vee',role:'solo',hp:35,humanity:40,head:0,bodyArmor:0,stats:{INT:5,REF:8,DEX:6,TECH:5,COOL:5,WILL:4,LUCK:5,MOVE:6,BODY:6,EMP:4},skills:{},extra:{notes:'keep',equipment:{installs}},...over};
}
const key=(c,i=0)=>'i:'+c.extra.equipment.installs[i].id;
const plain=x=>JSON.parse(JSON.stringify(x));

test('every implant in the tables is a catalog item with the page the table names',()=>{
 for(const [id,spec] of [...Object.entries(I.SHEET),...Object.entries(I.TIMED)]){const item=W.CATALOG.find(x=>x.id===id);assert.ok(item,id);assert.equal(item.category,'cyberware');assert.equal(typeof spec.page,'number')}
 for(const id of Object.keys(I.SHEET))assert.ok(E.CYBER[id]?.note,id+' is a reminder in the effects table');
});

test('Grafted Muscle raises BODY by 2 with one tap, HP follows, and undo puts everything back exactly',()=>{
 const c=person([GRAFT]),before=plain(c);
 const r=I.apply(c,key(c),'en');assert.equal(r.ok,true);assert.equal(r.dirty,true);
 assert.equal(c.stats.BODY,8);assert.equal(c.hp,40,'full HP 35 follows the new maximum');
 assert.match(r.notify,/BODY 6 → 8/);assert.match(r.notify,/HP 35 → 40/);
 assert.deepEqual(plain(c.extra.implants.applied[key(c)]),{catalogId:GRAFT,kind:'body',seq:1,body:[6,8],hp:[35,40]});
 assert.deepEqual(plain(c.extra.implants.body),{base:6,set:8});
 assert.equal(I.apply(c,key(c),'en').ok,false,'a second tap does not add again');assert.equal(c.stats.BODY,8);
 const u=I.undo(c,key(c),'ru');assert.equal(u.ok,true);assert.match(u.notify,/BODY 8 → 6/);
 assert.equal(c.stats.BODY,6);assert.equal(c.hp,35);assert.equal(c.extra.notes,'keep');
 assert.deepEqual(plain(c.stats),before.stats);assert.deepEqual(plain(c.extra.implants.applied),{});assert.equal(c.extra.implants.body,undefined);
});

test('the BODY bonus stops at 10 and does nothing above it',()=>{
 const c=person([GRAFT,GRAFT],{stats:{...person([]).stats,BODY:9}});
 assert.equal(I.apply(c,key(c,0),'en').ok,true);assert.equal(c.stats.BODY,10);
 const r=I.apply(c,key(c,1),'en');assert.equal(r.ok,false);assert.match(r.notify,/already 10/);assert.equal(c.stats.BODY,10);
 assert.equal(Object.keys(c.extra.implants.applied).length,1);
 const two=person([GRAFT,GRAFT]);I.apply(two,key(two,0),'en');I.apply(two,key(two,1),'en');assert.equal(two.stats.BODY,10,'two copies: 6 → 8 → 10');
});

test('a Linear Frame sets BODY, and implants can be undone in any order without losing the base',()=>{
 const c=person([GRAFT,SIGMA]);
 I.apply(c,key(c,0),'en');I.apply(c,key(c,1),'en');assert.equal(c.stats.BODY,12);
 assert.deepEqual(plain(I.bodyRecord(c).trail),[{catalogId:GRAFT,from:6,to:8},{catalogId:SIGMA,from:8,to:12}]);
 I.undo(c,key(c,0),'en');assert.equal(c.stats.BODY,12,'the frame still holds BODY at 12');
 I.undo(c,key(c,1),'en');assert.equal(c.stats.BODY,6);
 const d=person([SIGMA,BETA]);I.apply(d,key(d,1),'en');assert.equal(d.stats.BODY,14);
 assert.equal(I.apply(d,key(d,0),'en').ok,false,'Sigma under a Beta changes nothing');
 assert.equal(I.bodyFrom(6,[BETA,GRAFT,SIGMA]).value,14);assert.equal(I.bodyFrom(11,[GRAFT]).value,11);
});

test('BODY edited by hand after applying moves the base, so undo keeps the edit',()=>{
 const c=person([GRAFT]);I.apply(c,key(c),'en');assert.equal(c.stats.BODY,8);
 c.stats.BODY=9;assert.equal(I.bodyRecord(c).base,7);
 I.undo(c,key(c),'en');assert.equal(c.stats.BODY,7);
});

test('HP that was not full is only pulled down to the new maximum',()=>{
 const c=person([GRAFT],{hp:20});I.apply(c,key(c),'en');assert.equal(c.hp,20);assert.equal(c.extra.implants.applied[key(c)].hp,undefined);
 c.hp=40;I.undo(c,key(c),'en');assert.equal(c.hp,35,'40 HP cannot stay above the old maximum of 35');
});

test('Skin Weave writes SP 7 only where nothing higher is recorded, and undo restores the old SP',()=>{
 const c=person([WEAVE],{head:0,bodyArmor:4});
 const r=I.apply(c,key(c),'en');assert.equal(r.ok,true);assert.equal(c.head,7);assert.equal(c.bodyArmor,7);
 assert.deepEqual(plain(c.extra.implants.applied[key(c)].sp),{head:{from:0,to:7,seq:1},body:{from:4,to:7,seq:1}});
 c.head=5;// ablated in a fight
 const u=I.undo(c,key(c),'en');assert.equal(u.ok,true);assert.equal(c.head,0);assert.equal(c.bodyArmor,4);
 assert.deepEqual(plain(c.extra.implants.applied),{});
});

test('worn armor is never overwritten: the slot is skipped and can be filled in later',()=>{
 const c=person([SUBDERMAL],{head:0,bodyArmor:11});c.extra.equipment.armor={body:{recordId:'jack',piece:0,catalogId:'armor-light-armorjack'}};
 const r=I.apply(c,key(c),'en');assert.equal(r.ok,true);assert.equal(c.head,11);assert.equal(c.bodyArmor,11);
 assert.equal(c.extra.implants.applied[key(c)].sp.body,undefined);assert.match(r.notify,/Not changed: body: armor SP 11 is worn/);
 assert.match(I.render(c,'en'),/body: not changed/);
 // The armor comes off: the body slot is empty and the same tap finishes the job.
 delete c.extra.equipment.armor.body;c.bodyArmor=0;
 assert.match(I.render(c,'en'),/Add the SP/);
 assert.equal(I.apply(c,key(c),'en').ok,true);assert.equal(c.bodyArmor,11);
 // Armor put on after applying: undo leaves that slot alone.
 c.extra.equipment.armor.head={recordId:'helm',piece:0,catalogId:'armor-light-armorjack'};c.head=11;
 const u=I.undo(c,key(c),'en');assert.equal(c.head,11);assert.equal(c.bodyArmor,0);assert.match(u.notify,/left as is/);
 const worn=person([WEAVE],{head:11,bodyArmor:11});worn.extra.equipment.armor={head:{recordId:'a',piece:0},body:{recordId:'a',piece:1}};
 const before=JSON.stringify(worn),no=I.apply(worn,key(worn),'ru');assert.equal(no.ok,false);assert.equal(JSON.stringify(worn),before);assert.match(no.notify,/менять нечего/);
});

test('SP implants stacked on one location are undone newest first',()=>{
 const c=person([WEAVE,SUBDERMAL]);I.apply(c,key(c,0),'en');I.apply(c,key(c,1),'en');assert.equal(c.head,11);
 const blocked=I.undo(c,key(c,0),'en');assert.equal(blocked.ok,false);assert.match(blocked.notify,/Subdermal Armor/);assert.equal(c.head,11);
 I.undo(c,key(c,1),'en');assert.equal(c.head,7);I.undo(c,key(c,0),'en');assert.equal(c.head,0);assert.equal(c.bodyArmor,0);
});

test('starting-pack implants count, removed ones do not, and a removed implant keeps its undo',()=>{
 const c=person([]);c.extra.items=[{id:'it1',catalogId:GRAFT,quantity:1,humanityLossIncluded:true},{id:'it2',catalogId:WEAVE,quantity:1}];
 assert.deepEqual(plain(I.instances(c)),[{key:'r:it1:0',catalogId:GRAFT}]);
 assert.equal(I.apply(c,'r:it1:0','en').ok,true);assert.equal(c.stats.BODY,8);
 const d=person([GRAFT]);I.apply(d,key(d),'en');d.extra.equipment.installs[0].removedAt='2045-01-01';
 assert.equal(I.instances(d).length,0);const html=I.render(d,'en');assert.match(html,/still on the sheet/);assert.match(html,/data-imp-op="undo"/);assert.doesNotMatch(html,/data-imp-op="apply"/);
 assert.equal(I.undo(d,key(d),'en').ok,true);assert.equal(d.stats.BODY,6);assert.equal(I.render(d,'en'),'');
 assert.equal(I.apply(person([]),'i:nope','en').ok,false);
});

test('Sandevistan is a toggle: 20 Rounds on, then an hour of cooldown, then ready again',()=>{
 const c=person([SANDY]);
 assert.deepEqual(plain(I.timedState(c,SANDY)),{state:'ready',left:0});assert.equal(E.initiative(c),0);
 const on=I.timed(c,SANDY,'on',undefined,'en');assert.equal(on.ok,true);assert.match(on.notify,/\+3 Initiative/);
 assert.deepEqual(plain(c.extra.implants.active[SANDY]),{state:'active',left:20});assert.equal(I.isActive(c,SANDY),true);
 assert.equal(I.timed(c,SANDY,'on',undefined,'en').ok,false);
 I.timed(c,SANDY,'tick','1','en');assert.equal(I.timedState(c,SANDY).left,19);
 for(let i=0;i<18;i++)I.timed(c,SANDY,'tick',1,'en');assert.deepEqual(plain(I.timedState(c,SANDY)),{state:'active',left:1});
 const end=I.timed(c,SANDY,'tick',1,'en');assert.match(end.notify,/cooldown 60 min/);assert.deepEqual(plain(I.timedState(c,SANDY)),{state:'cooldown',left:60});
 const refused=I.timed(c,SANDY,'on',undefined,'ru');assert.equal(refused.ok,false);assert.match(refused.notify,/ещё 60 мин/);
 I.timed(c,SANDY,'cool','10','en');assert.equal(I.timedState(c,SANDY).left,50);
 for(let i=0;i<5;i++)I.timed(c,SANDY,'cool',10,'en');assert.deepEqual(plain(I.timedState(c,SANDY)),{state:'ready',left:0});assert.equal(c.extra.implants.active[SANDY],undefined);
 I.timed(c,SANDY,'on',undefined,'en');I.timed(c,SANDY,'off',undefined,'en');assert.equal(I.timedState(c,SANDY).state,'cooldown');
 I.timed(c,SANDY,'ready',undefined,'en');assert.equal(I.timedState(c,SANDY).state,'ready');
 assert.equal(I.timed(person([]),SANDY,'on',undefined,'en').ok,false,'not installed');
});

test('a running Sandevistan feeds Initiative through the effects layer, and only while it runs',()=>{
 const c=person([SANDY,'cyberware-kerenzikov']);
 assert.equal(E.initiative(c),2);assert.match(E.lines(c,'en').find(x=>x.name==='Sandevistan').text,/^ready/);
 I.timed(c,SANDY,'on',undefined,'en');
 assert.equal(E.initiative(c),5);assert.equal(E.collect(c).initiative,5);
 const line=E.lines(c,'ru').find(x=>x.name==='Сандевистан').text;assert.match(line,/\+3 к инициативе/);assert.match(line,/осталось 20/);
 I.timed(c,SANDY,'off',undefined,'en');assert.equal(E.initiative(c),2);assert.match(E.lines(c,'en').find(x=>x.name==='Sandevistan').text,/cooldown, 60 min left/);
 assert.equal(E.checkModifier(c,'','Evasion','DEX'),0,'no other check is touched');
 const starter=person([]);starter.extra.items=[{id:'s',catalogId:SANDY,quantity:1,humanityLossIncluded:true}];
 I.timed(starter,SANDY,'on',undefined,'en');assert.equal(E.initiative(starter),3,'a starting-pack Sandevistan counts too');
});

test('the effects list stops asking for a manual change once the implant is applied',()=>{
 const c=person([GRAFT,WEAVE]);
 assert.match(E.lines(c,'en').find(x=>/Grafted/.test(x.name)).text,/change BODY on the sheet/);
 I.apply(c,key(c,0),'en');I.apply(c,key(c,1),'en');
 assert.equal(E.lines(c,'en').find(x=>/Grafted/.test(x.name)).text,'applied to the sheet: BODY 6 → 8');
 assert.match(E.lines(c,'ru').find(x=>/Бронекожа/.test(x.name)).text,/SP 7 записан на листе \(голова, тело\)/);
});

test('the air supply counts minutes and refills',()=>{
 const c=person([AIR]);I.timed(c,AIR,'on',undefined,'en');assert.deepEqual(plain(I.timedState(c,AIR)),{state:'active',left:30});
 I.timed(c,AIR,'tick','5','en');assert.equal(I.timedState(c,AIR).left,25);assert.equal(E.initiative(c),0);
 I.timed(c,AIR,'off',undefined,'en');assert.equal(I.timedState(c,AIR).state,'cooldown');
 assert.match(I.renderActive(c,'en'),/Refilling/);
});

test('saved data in an unknown shape is never written over, and broken values read as defaults',()=>{
 const c=person([GRAFT,SANDY]);c.extra.implants={version:2,future:{keep:true}};const before=JSON.stringify(c);
 assert.equal(I.apply(c,key(c,0),'en').ok,false);assert.equal(I.timed(c,SANDY,'on',undefined,'en').ok,false);assert.equal(JSON.stringify(c),before);
 assert.match(I.render(c,'ru'),/неизвестном формате/);assert.equal(I.renderActive(c,'ru'),'');assert.equal(E.initiative(c),0);
 const odd=person([SANDY,GRAFT]);odd.extra.implants={version:1,applied:{x:{catalogId:'nope',kind:'body'},y:null,[key(odd,1)]:{catalogId:GRAFT,kind:'sp'}},active:{[SANDY]:{state:'active',left:999}},body:'?'};
 assert.equal(I.timedState(odd,SANDY).state,'ready');assert.equal(I.bodyRecord(odd),null);assert.doesNotThrow(()=>{I.render(odd,'en');I.renderActive(odd,'en');E.collect(odd)});
 for(const bad of [null,undefined,{},{extra:null},{extra:[]},{extra:{equipment:{installs:'x'},items:5}}]){assert.equal(I.render(bad,'en'),'');assert.equal(I.renderActive(bad,'en'),'');assert.doesNotThrow(()=>E.collect(bad))}
 const old=person([]);delete old.extra;assert.equal(I.render(old,'ru'),'');assert.equal(old.extra,undefined,'an old save without implants is not touched');
});

test('the record survives export and import as plain JSON',()=>{
 const c=person([GRAFT,SIGMA,WEAVE,SANDY]);I.apply(c,key(c,0),'en');I.apply(c,key(c,1),'en');I.apply(c,key(c,2),'en');I.timed(c,SANDY,'on',undefined,'en');I.timed(c,SANDY,'tick',3,'en');
 const copy=JSON.parse(JSON.stringify({format:'nightcity-red-character',version:1,character:c})).character;
 assert.deepEqual(copy.extra.implants,plain(c.extra.implants));assert.equal(E.initiative(copy),3);assert.equal(I.timedState(copy,SANDY).left,17);
 for(const k of [key(c,2),key(c,1),key(c,0)])assert.equal(I.undo(copy,k,'en').ok,true);
 assert.equal(copy.stats.BODY,6);assert.equal(copy.head,0);assert.equal(copy.bodyArmor,0);assert.equal(copy.hp,35);
});

test('both languages draw the rows, the record and reachable buttons; names are escaped',()=>{
 const c=person([GRAFT,WEAVE,SANDY]);
 for(const l of ['ru','en']){
  const html=I.render(c,l),act=I.renderActive(c,l);
  assert.equal((html.match(/data-action="implant" data-imp-op="apply"/g)||[]).length,2,l);assert.match(html,/id="sheet-implants"/);
  assert.match(act,/data-imp-op="on"/);assert.match(act,/aria-pressed="false"/);assert.doesNotMatch(html+act,/undefined|NaN/);
 }
 assert.match(I.render(c,'ru'),/Применить/);assert.match(I.render(c,'en'),/Apply/);
 I.apply(c,key(c,0),'ru');I.timed(c,SANDY,'on',undefined,'ru');
 const ru=I.render(c,'ru');assert.match(ru,/Учтено на листе/);assert.match(ru,/<li>BODY 6 → 8<\/li>/);assert.match(ru,/<li>HP 35 → 40<\/li>/);assert.match(ru,/data-imp-trail/);assert.match(ru,/Отменить/);
 const on=I.renderActive(c,'ru');assert.match(on,/data-imp-state="active"/);assert.match(on,/\+3 к инициативе/);assert.match(on,/data-imp-op="tick"[^>]*data-imp-n="1"/);assert.match(on,/aria-pressed="true"/);
 assert.equal(I.renderActive(person([GRAFT]),'en'),'');assert.equal(I.render(person([SANDY]),'en'),'');
 const evil=person([GRAFT]);evil.extra.equipment.installs[0].id='"><img src=x>';assert.doesNotMatch(I.render(evil,'en'),/<img/);
});

test('act() routes the sheet buttons and ignores anything else',()=>{
 const c=person([GRAFT,SANDY]);
 assert.equal(I.act(c,{impOp:'apply',impKey:key(c,0)},'en').dirty,true);assert.equal(c.stats.BODY,8);
 assert.equal(I.act(c,{impOp:'on',impKey:SANDY},'en').dirty,true);assert.equal(I.act(c,{impOp:'tick',impKey:SANDY,impN:'1'},'en').dirty,true);assert.equal(I.timedState(c,SANDY).left,19);
 assert.equal(I.act(c,{impOp:'undo',impKey:key(c,0)},'en').dirty,true);assert.equal(c.stats.BODY,6);
 const before=JSON.stringify(c);assert.equal(I.act(c,{impOp:'wipe',impKey:'x'},'en').ok,false);assert.equal(I.act(c,{},'en').ok,false);assert.equal(JSON.stringify(c),before);
});
