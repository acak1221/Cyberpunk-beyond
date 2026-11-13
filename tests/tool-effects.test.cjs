/* The effects layer inside the tools that roll for a linked character: medicine, cybersurgery, pharmacy,
   therapy, repairs and NET combat. With numbers typed by hand nothing is added and nothing is shown. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=f=>fs.readFileSync(path.join(__dirname,'../site',f),'utf8');
// One page: the injury names, the effects, this module and the tools asked for. Every die shows `face` (0.5 → 6).
function page(files,{face=0.5,extra={}}={}){
 const math=Object.create(Math);math.random=()=>face;
 const rolls=[],window={confirm:()=>true,Rolls:{check:(label,r)=>{rolls.push({label,total:r.total,success:r.success});return true},opposed:(label,a,b,won)=>{rolls.push({label,total:a.total,success:won});return true},sum:()=>true},...extra};
 const ctx={window,document:{addEventListener(){}},Math:math,addEventListener(){}};vm.createContext(ctx);
 for(const f of ['combat-tools.js','effects.js','tool-effects.js',...files])vm.runInContext(source(f),ctx,{filename:f});
 return {window,rolls,T:window.ToolEffects,E:window.Effects};
}
const injuries=(...rows)=>({version:1,entries:rows.map(([location,score,status='active'],i)=>({id:'i'+i,location,score,status,detail:''}))});
const CONCUSSION=['head',5],BRAIN=['head',3],BROKEN_ARM=['body',6],RIBS=['body',5];
const installs=(...ids)=>({installs:ids.map((catalogId,i)=>({id:'c'+i,catalogId}))});
const plain=x=>JSON.parse(JSON.stringify(x));

test('the number is what the effects layer says, and the listed sources add up to it',()=>{
 const {T,E}=page([]);
 const c={extra:{criticalInjuries:injuries(CONCUSSION,BRAIN,['body',9],['head',4]),equipment:installs('cyberware-medscanner-implant','cyberware-techscanner-implant','cyberware-kerenzikov'),streetDrugs:{version:1,records:{boost:{status:'active',remainingHours:2,addicted:false},smash:{status:'none',addicted:true}}}}};
 for(const skill of ['','First Aid','Paramedic','Surgery','Basic Tech','Weaponstech','Persuasion','Handgun'])for(const stat of ['','TECH','INT','REF'])for(const kind of ['','melee','ranged']){
  const d=T.detail(c,{skill,stat,kind});
  assert.equal(d.mod,E.checkModifier(c,kind,skill,stat),`${skill}/${stat}/${kind}`);
  assert.equal(d.parts.reduce((a,p)=>a+p.value,0),d.mod,`${skill}/${stat}/${kind} parts`);
  assert.ok(d.parts.every(p=>p.value!==0&&p.name.ru&&p.name.en));
 }
 const aid=T.detail(c,{skill:'First Aid',stat:'TECH'});
 assert.equal(aid.mod,-2);assert.deepEqual(plain(aid.parts.map(p=>[p.name.en,p.value])).sort(),[['Brain Injury',-2],['Concussion',-2],[aid.parts.find(p=>p.value===2).name.en,2]].sort());
 assert.equal(T.detail(c,{skill:'Surgery',stat:'TECH'}).mod,-4);
 assert.equal(T.detail(c,{stat:'INT'}).mod,-2,'Boost in effect: INT +2 against two head injuries');
 assert.equal(T.mod(c,{skill:'Persuasion'}),-6,'a Smash addiction on top');
});

test('healed and quick-fixed injuries, removed implants and other people’s numbers give nothing',()=>{
 const {T}=page([]);
 const c={extra:{criticalInjuries:injuries(['head',5,'quickfix'],['head',3,'healed']),equipment:{installs:[{catalogId:'cyberware-medscanner-implant',removedAt:'2045-01-01'}]}}};
 const d=T.detail(c,{skill:'First Aid',stat:'TECH'});assert.equal(d.mod,0);assert.equal(d.parts.length,0);
 for(const lang of ['ru','en']){assert.equal(T.html(c,{skill:'First Aid'},lang),'');assert.equal(T.text(c,{skill:'First Aid'},lang),'');assert.equal(T.label(c,{},lang),'')}
 for(const none of [null,undefined,'x',7,[],{}]){const u=T.use(none,{skill:'First Aid',stat:'TECH'},'en');assert.equal(u.mod,0);assert.equal(u.label,'');assert.equal(u.line,'');assert.equal(u.add(3),3);assert.equal(T.html(none,{},'en'),'')}
});

test('two implants with the same Skill bonus do not stack, and wound penalties are never part of the number',()=>{
 const {T,E}=page([]);
 E.CYBER['test-second-scanner']={skills:{'First Aid':3}};
 const c={hp:1,stats:{BODY:8,WILL:8},extra:{equipment:installs('cyberware-medscanner-implant','test-second-scanner')}};
 const d=T.detail(c,{skill:'First Aid',stat:'TECH'});
 assert.equal(d.mod,3);assert.equal(d.parts.length,1);assert.equal(d.parts[0].value,3);
 delete E.CYBER['test-second-scanner'];
 // Seriously and Mortally Wounded sheets: the tools leave those penalties to the modifier field.
 for(const hp of [40,10,0,-5])assert.equal(T.mod({hp,stats:{BODY:8,WILL:8},extra:{}},{skill:'First Aid',stat:'TECH'}),0);
 const editor={hp:1,stats:{BODY:8,WILL:8},extra:{equipment:installs('cyberware-pain-editor')}},e=T.detail(editor,{stat:'TECH'});
 assert.equal(e.mod,0);assert.equal(e.ignoreSerious,true);assert.match(T.text(editor,{stat:'TECH'},'en'),/no Seriously Wounded penalty — do not enter it/);assert.match(T.text(editor,{stat:'TECH'},'ru'),/штраф тяжёлого ранения не действует/);
});

test('the modifier stays inside what the tools accept, and bad input is left for the tool to refuse',()=>{
 const {T}=page([]),c={extra:{criticalInjuries:injuries(CONCUSSION)}};
 assert.equal(T.apply(0,c,{}),-2);assert.equal(T.apply(-100,c,{}),-100);assert.equal(T.apply(100,c,{}),98);
 for(const bad of [null,undefined,'3',1.5,NaN])assert.ok(Object.is(T.apply(bad,c,{}),bad));
 const u=T.use(c,{},'ru');assert.equal(u.add(5),3);assert.equal(u.add(-99),-100);assert.equal(u.add(null),null);
});

test('the block names the number and its sources in both languages and escapes names',()=>{
 const {T,window}=page([]),c={extra:{criticalInjuries:injuries(CONCUSSION,BROKEN_ARM),equipment:installs('cyberware-medscanner-implant')}};
 window.CATALOG=[{id:'cyberware-medscanner-implant',name:{ru:'Медсканер <b>',en:'Medscanner <b>'}}];
 const en=T.html(c,{skill:'Paramedic',stat:'TECH'},'en'),ru=T.html(c,{skill:'Paramedic',stat:'TECH'},'ru');
 assert.match(en,/data-tool-effects="0"/);assert.match(en,/Sheet effects: <span class="tool-effects-value">0<\/span>/);assert.match(en,/Concussion <b>−2<\/b>/);assert.match(en,/Medscanner &lt;b&gt; <b>\+2<\/b>/);assert.doesNotMatch(en,/Medscanner <b> /);
 assert.match(en,/Keep in mind:<\/span> Broken Arm — The arm cannot be used/);
 assert.match(ru,/Эффекты листа/);assert.match(ru,/Сотрясение <b>−2<\/b>/);assert.match(ru,/Помните:<\/span> Сломанная рука — Рука не действует/);assert.match(ru,/не вносите в модификатор/);
 assert.equal(T.label(c,{skill:'Surgery',stat:'TECH'},'en'),' · effects −2');assert.equal(T.label(c,{skill:'Surgery',stat:'TECH'},'ru'),' · эффекты −2');
 assert.equal(T.use(c,{skill:'Surgery',stat:'TECH'},'en').line,'\nSheet effects: −2 (Concussion −2)');
 assert.match(T.html(c,{stat:'TECH',when:['пока так','while so']},'en'),/ · while so</);
 // An injury that only calls for a reminder still shows up, without a number.
 const arm={extra:{criticalInjuries:injuries(RIBS)}},h=T.html(arm,{stat:'TECH'},'en');assert.doesNotMatch(h,/tool-effects-sum/);assert.match(h,/Broken Ribs/);
});

// ---- Medicine: stabilization -------------------------------------------------------------------------------
function medicine(){
 const p=page(['medical-tools.js']),M=p.window.MedicalTools;M.setScope('acc');
 const patient={id:'p',name:'Patient',hp:20,stats:{BODY:8,WILL:6,TECH:6},skills:{'First Aid':4,Paramedic:1},extra:{}};
 const doctor={id:'d',name:'Doctor',hp:45,role:'medtech',rank:4,stats:{BODY:8,WILL:6,TECH:8},skills:{'First Aid':4,Paramedic:5},extra:{criticalInjuries:injuries(CONCUSSION),roleTools:{medtech:{values:{surgery:2,pharma:1,cryo:1}}}}};
 const ctx={lang:'en',characters:[patient,doctor],isCurrent:(c,s)=>s==='acc'&&ctx.characters.includes(c)},root={isConnected:true};
 const press=op=>{const button={isConnected:true,dataset:{medAction:op},closest:s=>s==='[data-med-root]'?root:null};return M.handle({type:'click',target:{closest:s=>s==='[data-med-action]'?button:null}},ctx)};
 const field=(key,value)=>M.handle({type:'change',target:{dataset:{medField:key},value,checked:value===true,closest:()=>null}},ctx);
 M.render(ctx);return {...p,M,patient,doctor,ctx,press,field};
}
test('stabilization by a linked practitioner counts their injuries and implants; typed numbers get nothing',()=>{
 const x=medicine(),before=JSON.stringify(x.ctx.characters);
 x.field('practitioner','d');
 let html=x.M.render(x.ctx);assert.match(html,/TECH 8 · First Aid 4/);assert.match(html,/data-tool-effects="-2"/);assert.match(html,/Concussion <b>−2<\/b>/);
 assert.equal(x.press('stabilize-roll').rerender,true);
 assert.deepEqual(plain(x.rolls.at(-1)),{label:'Stabilization · First Aid · Patient · effects −2',total:16,success:true});
 html=x.M.render(x.ctx);assert.match(html,/16 &gt; 13/);assert.match(html,/Sheet effects: −2 \(Concussion −2\)/);
 assert.equal(JSON.stringify(x.ctx.characters),before,'a roll changes neither sheet');
 // A Medscanner on the practitioner cancels the Concussion for First Aid and Paramedic.
 x.doctor.extra.equipment=installs('cyberware-medscanner-implant');
 assert.match(x.M.render(x.ctx),/data-tool-effects="0"/);x.press('stabilize-roll');
 assert.equal(x.rolls.at(-1).total,18);assert.equal(x.rolls.at(-1).label,'Stabilization · First Aid · Patient');
 // The same numbers typed by hand: no block, no modifier, even though the patient's own sheet has injuries.
 x.patient.extra.criticalInjuries=injuries(BRAIN);
 x.field('practitioner','');x.field('tech','8');x.field('skill','4');
 html=x.M.render(x.ctx);assert.doesNotMatch(html,/data-tool-effects/);
 x.press('stabilize-roll');assert.deepEqual(plain(x.rolls.at(-1)),{label:'Stabilization · First Aid · Patient',total:18,success:true});
 assert.doesNotMatch(x.M.render(x.ctx),/Sheet effects/);
});
test('a practitioner treating their own patient sheet is still a linked sheet',()=>{
 const x=medicine();x.patient.extra.criticalInjuries=injuries(BRAIN);x.field('practitioner','p');
 assert.match(x.M.render(x.ctx),/data-tool-effects="-2"/);x.press('stabilize-roll');
 assert.equal(x.rolls.at(-1).total,6+4+6-2);
});
test('Critical Injury treatment counts the linked healer’s effects for the Skill actually used',()=>{
 const x=medicine();x.field('injury','5');x.M.render(x.ctx);
 x.doctor.extra.equipment=installs('cyberware-medscanner-implant');
 x.field('treatPractitioner','d');
 let html=x.M.render(x.ctx);assert.match(html,/TECH 8 · Paramedic 5/);assert.match(html,/data-tool-effects="0"/);
 x.press('treatment-roll');assert.equal(x.rolls.at(-1).total,19);assert.equal(x.rolls.at(-1).label,'Critical injury treatment · Patient');
 x.field('treatment','treat');x.M.render(x.ctx);x.field('treatSkill','Surgery|13');
 html=x.M.render(x.ctx);assert.match(html,/TECH 8 · Surgery 4/);assert.match(html,/data-tool-effects="-2"/);
 x.press('treatment-roll');assert.deepEqual(plain(x.rolls.at(-1)),{label:'Critical injury treatment · Patient · effects −2',total:16,success:true});
 assert.match(x.M.render(x.ctx),/Sheet effects: −2 \(Concussion −2\)/);
 x.field('treatPractitioner','');x.field('tech','8');x.field('skill','4');assert.doesNotMatch(x.M.render(x.ctx),/data-tool-effects/);
 x.press('treatment-roll');assert.equal(x.rolls.at(-1).total,18);assert.equal(x.rolls.at(-1).label,'Critical injury treatment · Patient');
});
test('the Critical Injuries tracker counts the linked healer’s effects in the roll it applies to the sheet',()=>{
 const p=page(['medical-tools.js','critical-injury-tools.js']),C=p.window.CriticalInjuryTools;C.setScope('acc');
 const patient={id:'p',name:'Patient',hp:30,stats:{BODY:8,WILL:6,TECH:8},skills:{'First Aid':4,Paramedic:1},extra:{criticalInjuries:injuries(['body',9])}};
 const doctor={id:'d',name:'Doctor',role:'medtech',rank:4,stats:{TECH:8},skills:{'First Aid':4,Paramedic:5},extra:{criticalInjuries:injuries(CONCUSSION)}};
 const ctx={lang:'en',view:'medical',characters:[patient,doctor],isCurrent:(c,s,v)=>s==='acc'&&v==='medical'&&ctx.characters.includes(c)},root={isConnected:true,dataset:{ciView:'medical'}};
 const field=(key,value)=>C.handle({type:'change',target:{dataset:{ciField:key},value,checked:value===true,closest:s=>s==='[data-ci-root]'?root:null}},ctx);
 const click=op=>{const b={dataset:{ciAction:op},isConnected:true,closest:s=>s==='[data-ci-root]'?root:null};return C.handle({type:'click',target:{closest:s=>s==='[data-ci-root]'?root:s==='[data-ci-action]'?b:null}},ctx)};
 C.render(ctx);field('practitioner','d');C.render(ctx);field('choice','First Aid|13');
 let html=C.render(ctx);assert.match(html,/TECH 8 · First Aid 4/);assert.match(html,/data-tool-effects="-2"/);assert.match(html,/Concussion <b>−2<\/b>/);
 assert.equal(click('roll').rerender,true);
 html=C.render(ctx);assert.match(html,/16 &gt; 13/);assert.match(html,/Sheet effects: −2 \(Concussion −2\)/);
 assert.equal(click('apply').dirty,true);assert.equal(patient.extra.criticalInjuries.entries[0].status,'healed','a Quick Fix is the whole cure for a Torn Muscle');
 // A Medscanner cancels the Concussion for First Aid: the block shows 0 and the roll is the bare one.
 patient.extra.criticalInjuries=injuries(['body',9]);doctor.extra.equipment=installs('cyberware-medscanner-implant');
 C.render(ctx);field('choice','First Aid|13');assert.match(C.render(ctx),/data-tool-effects="0"/);click('roll');assert.match(C.render(ctx),/18 &gt; 13/);
 // Typed numbers: no block, nothing added, and no line left over from the linked roll.
 field('practitioner','');C.render(ctx);field('choice','First Aid|13');field('tech','8');field('level','4');
 html=C.render(ctx);assert.doesNotMatch(html,/data-tool-effects/);click('roll');
 html=C.render(ctx);assert.match(html,/18 &gt; 13/);assert.doesNotMatch(html,/Sheet effects/);
 // The patient treating themself is a linked sheet too: their own Torn Muscle is not a check penalty, a Concussion is.
 patient.extra.criticalInjuries=injuries(['body',9],CONCUSSION);field('practitioner','p');C.render(ctx);field('target','i0');C.render(ctx);field('choice','First Aid|13');
 assert.match(C.render(ctx),/data-tool-effects="-2"/);click('roll');assert.match(C.render(ctx),/16 &gt; 13/);
});

// ---- Cybersurgery ------------------------------------------------------------------------------------------
test('cybersurgery by a linked Medtech counts their effects and says so; manual entry does not',()=>{
 const p=page(['cyber-surgery.js'],{extra:{CATALOG:[{id:'clinic',category:'cyberware',name:{en:'Test',ru:'Тест'},stats:{installation:'Clinic'}}]}}),m=p.window.CyberSurgery;
 const c={id:'doc',name:'Doc',role:'medtech',rank:4,stats:{TECH:7},extra:{criticalInjuries:injuries(CONCUSSION),roleTools:{medtech:{values:{surgery:2,pharma:1,cryo:0}}}}};
 const fields={item:{value:'clinic'},operation:{value:'install'},tech:{value:'7',dataset:{},readOnly:false},skill:{value:'4',dataset:{},readOnly:false},modifier:{value:'1'},self:{checked:false},result:{value:''},practitioner:{value:'',dataset:{}},'practitioner-status':{textContent:''}};
 const root={isConnected:true,querySelector:q=>fields[q.match(/data-cybersurgery-([a-z-]+)/)?.[1]]||null},ctx={characters:[c],isCurrent:x=>x===c};
 const choose=(id,lang='en')=>{const el=fields.practitioner;el.value=id;el.matches=s=>s.split(',').includes('[data-cybersurgery-practitioner]');el.closest=s=>s==='[data-cybersurgery-root]'?root:null;return m.handle({type:'change',target:el},lang,ctx)};
 const roll=()=>{const b={dataset:{cybersurgeryAction:'roll'},closest:s=>s==='[data-cybersurgery-root]'?root:null};return m.handle({type:'click',target:{closest:s=>s==='[data-cybersurgery-action]'?b:null}},'en',ctx)};
 roll();assert.equal(p.rolls.at(-1).total,7+4+1+6);assert.equal(p.rolls.at(-1).label,'Cybersurgery · Test');assert.doesNotMatch(fields.result.value,/effects/i);
 choose('doc','ru');assert.match(fields['practitioner-status'].textContent,/Эффекты листа: −2 \(Сотрясение −2\)/);
 choose('doc');assert.match(fields['practitioner-status'].textContent,/Sheet effects: −2 \(Concussion −2\)\. Already in the roll/);
 roll();assert.deepEqual(plain(p.rolls.at(-1)),{label:'Cybersurgery · Test · effects −2',total:16,success:true});
 assert.match(fields.result.value,/TECH 7 \+ Surgery 4 \+ 1 − 2 \+ 1d10 6\nSheet effects: −2 \(Concussion −2\)/);
 choose('');assert.equal(fields['practitioner-status'].textContent,'');roll();assert.equal(p.rolls.at(-1).total,18);
});

// ---- Pharmacy ----------------------------------------------------------------------------------------------
test('synthesis counts the Medtech’s effects while the fields hold the sheet values, and the record stays valid',()=>{
 const p=page(['catalog.js','catalog-extra.js','character-extra.js','dose-stock.js','pharmacy-tools.js']),m=p.window.PharmacyTools;m.setScope('a');
 const c={id:'doctor',name:'Doc',role:'medtech',rank:6,stats:{TECH:6},extra:{criticalInjuries:injuries(CONCUSSION),roleTools:{medtech:{values:{surgery:1,pharma:3,cryo:2}}}}};
 const ctx={lang:'en',characters:[c],isCurrent:(x,s)=>x===c&&s==='a'},values={drug:'speedheal',tech:'6',skill:'5',modifier:'0',target:'Nova',ack:true};
 const html=m.render(ctx);assert.match(html,/data-tool-effects="-2"/);assert.match(html,/while TECH and the skill in the fields match the sheet/);
 const root={isConnected:true,querySelector:q=>{const k=q.match(/data-pharmacy-([a-z]+)/)?.[1];return k in values?(k==='ack'?{checked:values[k]}:{value:values[k]}):null}};
 const act=op=>{const b={isConnected:true,dataset:{pharmacyAction:op},closest:q=>q==='[data-pharmacy-root]'?root:null};return m.handle({type:'click',target:{closest:q=>q==='[data-pharmacy-action]'?b:null}},ctx)};
 const done=act('synth');assert.equal(done.dirty,true);assert.match(done.notify,/Sheet effects: −2 \(Concussion −2\)/);
 assert.deepEqual(plain(p.rolls.at(-1)),{label:'Pharmaceuticals · Speedheal · effects −2',total:15,success:true});
 assert.equal(c.extra.pharmacy.history[0].modifier,-2);assert.equal(c.extra.pharmacy.history[0].total,15);
 assert.equal(m.state(plain(c)).kind,'ok','the stored synthesis still passes the tool’s own validation');
 // Numbers that are not the sheet's are somebody else's: nothing is added.
 values.tech='7';act('synth');assert.equal(p.rolls.at(-1).total,18);assert.equal(p.rolls.at(-1).label,'Pharmaceuticals · Speedheal');assert.equal(c.extra.pharmacy.history[1].modifier,0);
 assert.equal(m.state(plain(c)).kind,'ok');
});

// ---- Therapy -----------------------------------------------------------------------------------------------
test('therapy by a linked Medtech counts their effects; a typed practitioner gets nothing',()=>{
 const p=page(['therapy-tools.js']),M=p.window.TherapyTools;M.setScope('account');
 const patient={id:'p',name:'Patient',role:'solo',rank:4,humanity:20,stats:{EMP:6},extra:{equipment:{maxHumanity:60},criticalInjuries:injuries(BRAIN)}};
 const doctor={id:'d',name:'Doctor',role:'medtech',rank:5,stats:{TECH:8},extra:{criticalInjuries:injuries(CONCUSSION),roleTools:{medtech:{values:{surgery:1,pharma:3,cryo:1}}}}};
 const ctx={lang:'en',characters:[patient,doctor],isCurrent:(c,s)=>s==='account'&&ctx.characters.includes(c)},root={isConnected:true},button={isConnected:true,dataset:{therapyAction:'roll'},closest:s=>s==='[data-therapy-root]'?root:null},event={type:'click',target:{closest:s=>s==='[data-therapy-action]'?button:null}},field=(key,value)=>M.handle({type:'change',target:{dataset:{therapyField:key},value,checked:value===true}},ctx);
 M.render(ctx);field('doctor','d');field('ack',true);
 let html=M.render(ctx);assert.match(html,/TECH 8 · Medical Tech 4/);assert.match(html,/data-tool-effects="-2"/);
 assert.equal(M.handle(event,ctx).rerender,true);
 assert.deepEqual(plain(p.rolls.at(-1)),{label:'Therapy · Patient · effects −2',total:16,success:true});
 html=M.render(ctx);assert.match(html,/16 &gt; 15/);assert.match(html,/<p>Sheet effects: −2 \(Concussion −2\)<\/p>/);
 field('doctor','');field('tech','8');field('skill','4');field('ack',true);
 assert.doesNotMatch(M.render(ctx),/data-tool-effects/);M.handle(event,ctx);
 assert.equal(p.rolls.at(-1).total,18);assert.equal(p.rolls.at(-1).label,'Therapy · Patient');assert.doesNotMatch(M.render(ctx),/Sheet effects/);
});

// ---- Repairs -----------------------------------------------------------------------------------------------
function repairs(extra,files=['repair-tools.js']){
 const p=page(files,{face:0.4}),M=p.window.RepairTools;
 const c={id:'c',name:'Test',role:'solo',rank:7,stats:{TECH:6},skills:{'Basic Tech':4},extra:{advancement:{primaryRole:'solo',latestRole:'tech',additionalRoles:[{role:'tech',rank:2}]},roleTools:{tech:{values:{field:2,fabrication:2}}},repairs:{version:1,jobs:[{id:'j',name:'Device',kind:'item',category:'everyday',damage:'',price:0,skill:'Basic Tech',modifier:-1,attempts:[]}]},...extra}};
 const ctx={lang:'en',characters:[c],isCurrent:(x,s)=>x===c&&s==='account-a'};M.setScope('account-a');
 const html=M.render(ctx),row={isConnected:true,dataset:{repairJob:'j',repairEpoch:html.match(/data-repair-epoch="(\d+)"/)[1],repairToken:html.match(/data-repair-token="(\d+)"/)[1]}},checkbox={isConnected:true,dataset:{repairFieldBonus:'j'},checked:false,closest:s=>s==='[data-repair-job]'?row:null};
 row.querySelector=s=>s==='[data-repair-field-bonus]'?checkbox:null;
 const button={isConnected:true,dataset:{repair:'roll',id:'j'},closest:s=>s==='[data-repair-job]'?row:null};
 return {...p,M,c,ctx,html,checkbox,choose:v=>{checkbox.checked=v;return M.handle({type:'change',target:checkbox},ctx)},roll:()=>M.handle({type:'click',target:{closest:s=>s==='[data-repair]'?button:null}},ctx)};
}
test('a repair check counts the technician’s effects, shows them, and the stored attempt survives a reload',()=>{
 const x=repairs({criticalInjuries:injuries(CONCUSSION),equipment:installs('cyberware-techscanner-implant')});
 assert.match(x.html,/data-tool-effects="0"/);assert.match(x.html,/Concussion <b>−2<\/b>/);
 let asked='';x.window.confirm=text=>{asked=text;return true};
 assert.equal(x.roll().dirty,true);
 const a=x.c.extra.repairs.jobs[0].attempts[0];assert.equal(a.modifier,-1);assert.equal(a.total,6+4-1+5);assert.equal(Object.hasOwn(a,'effects'),false,'effects that cancel out leave no trace');
 assert.match(asked,/Sheet effects: 0 \(/);assert.equal(x.M.getState(plain(x.c)).kind,'ok');

 const y=repairs({criticalInjuries:injuries(CONCUSSION)});assert.match(y.html,/data-tool-effects="-2"/);
 assert.equal(y.roll().dirty,true);const b=y.c.extra.repairs.jobs[0].attempts[0];
 assert.deepEqual(plain(b),{tech:6,skill:4,modifier:-3,die:5,extra:0,total:12,dv:9,success:true,effects:-2});
 assert.deepEqual(plain(y.rolls.at(-1)),{label:'Repair · Device · effects −2',total:12,success:true});
 assert.equal(y.M.getState(plain(y.c)).kind,'ok');assert.match(y.M.render(y.ctx),/\(incl\. sheet effects −2\)/);
 assert.doesNotMatch(y.M.render(y.ctx),/data-tool-effects/,'a finished check no longer advertises a modifier');

 const z=repairs({});assert.doesNotMatch(z.html,/data-tool-effects/);z.roll();
 assert.deepEqual(plain(z.c.extra.repairs.jobs[0].attempts[0]),{tech:6,skill:4,modifier:-1,die:5,extra:0,total:14,dv:9,success:true});
});
test('Field Expertise and the effects are kept apart in the stored attempt, and odd records are refused',()=>{
 const x=repairs({criticalInjuries:injuries(CONCUSSION)},['maker-projects.js','repair-tools.js']);
 assert.equal(x.choose(true).handled,true);assert.equal(x.roll().dirty,true);
 const a=x.c.extra.repairs.jobs[0].attempts[0];
 assert.equal(a.fieldExpertise,2);assert.equal(a.effects,-2);assert.equal(a.manualModifier,-3);assert.equal(a.modifier,-1);assert.equal(a.total,6+4-1+5);
 assert.equal(x.M.getState(plain(x.c)).kind,'ok');
 for(const bad of [0,'-2',1.5,-101,null]){const copy=plain(x.c);copy.extra.repairs.jobs[0].attempts[0].effects=bad;assert.equal(x.M.getState(copy).kind,'invalid',String(bad))}
 // An effect that would push the stored modifier out of range stops the roll instead of writing a bad record.
 const y=repairs({criticalInjuries:injuries(CONCUSSION)});y.c.extra.repairs.jobs[0].modifier=-99;y.M.render(y.ctx);
 assert.equal(y.roll().dirty,undefined);assert.equal(y.c.extra.repairs.jobs[0].attempts.length,0);
});

// ---- NET combat --------------------------------------------------------------------------------------------
test('a program attack from a linked Netrunner’s deck counts their injuries; typed Interface does not',()=>{
 const p=page(['catalog.js','catalog-extra.js','role-tools.js','net-tools.js']),W=p.window,N=W.NetTools;
 const sword=W.RoleTools.deckCatalog('extra-program-sword'),make=(id,x)=>({id,catalogId:x.p.id,name:{...x.p.name},kind:x.kind,slots:x.slots});
 const c={id:'runner',name:'Nova',role:'netrunner',rank:7,stats:{},skills:{},extra:{criticalInjuries:injuries(CONCUSSION,BRAIN),cyberdecks:{version:1,decks:[{id:'deck',name:'Street deck',slots:7,hardwareOnly:0,entries:[make('one',sword)]}]}}},state={lang:'en',architectures:[],characters:[c]};
 const click=op=>({type:'click',target:{closest:()=>({dataset:{net:op}})}}),edit=(k,v)=>({type:'change',target:{dataset:{netCombat:k},value:v,closest:()=>null}});
 N.setScope('owner');N.handle(click('new'),state);
 // Typed numbers first: the runner's sheet exists but is not linked.
 N.handle(edit('program','extra-program-sword'),state);
 assert.doesNotMatch(N.render(state),/data-tool-effects/);N.handle(click('combat-roll'),state);
 assert.equal(p.rolls.at(-1).label,'NET · program attack');assert.doesNotMatch(N.render(state),/Sheet effects/);
 const manual=p.rolls.at(-1).total;
 N.handle(edit('runner','runner'),state);N.handle(edit('deck','deck'),state);N.handle(edit('copy','one'),state);
 let html=N.render(state);assert.match(html,/selected Netrunner’s sheet: 7/);assert.match(html,/data-tool-effects="-4"/);assert.match(html,/Brain Injury <b>−2<\/b>/);
 const before=JSON.stringify(state);N.handle(click('combat-roll'),state);
 assert.equal(p.rolls.at(-1).label,'NET · program attack · effects −4');assert.equal(p.rolls.at(-1).total,7+1-4+6);
 html=N.render(state);assert.match(html,/Attack \/ ICE SPEED: 4 \+ \(6\) = 10 · Sheet effects: −4 \(Concussion −2; Brain Injury −2\)/);
 assert.equal(JSON.stringify(state),before);assert.ok(Number.isSafeInteger(manual));
 // A typed attacker modifier still counts on top.
 N.handle(edit('attackMod','3'),state);N.handle(click('combat-roll'),state);assert.equal(p.rolls.at(-1).total,7+1+3-4+6);
});

test('the page loads the module after the effects and before the app, and the stylesheet after the board look',()=>{
 const html=source('index.html'),at=s=>{const i=html.indexOf(s);assert.ok(i>=0,s);return i};
 assert.ok(at('src="effects.js"')<at('src="tool-effects.js"'));assert.ok(at('src="tool-effects.js"')<at('src="app.js"'));
 assert.ok(at('href="board.css"')<at('href="tool-effects.css"'));
});
