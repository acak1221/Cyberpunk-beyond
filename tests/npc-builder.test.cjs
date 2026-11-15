const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const site=f=>fs.readFileSync(path.join(__dirname,'..','site',f),'utf8');
const SOURCES=Object.fromEntries(['catalog.js','catalog-extra.js','gm-tools.js','npc-library.js','npc-builder.js'].map(f=>[f,site(f)]));
const plain=x=>JSON.parse(JSON.stringify(x));
// A fresh copy for every test: the builder keeps its steps in module memory.
function load({skip=[],state}={}){
 const calls=[],st=state||{gmExtras:{},campaigns:[{id:'k',name:'Job',roster:[{id:'r1',kind:'npc',name:'Ganger',ref:6,hp:20}]}]};
 const window={App:{getState:()=>st,save(){calls.push(['save'])},notify:m=>calls.push(['notify',m]),notifyAction:(m,label,fn,ms)=>calls.push(['action',m,label,fn,ms]),lang:()=>'ru'}};
 const ctx=vm.createContext({window,Date,Math,console,globalThis:{}});
 for(const [f,src] of Object.entries(SOURCES))if(!skip.includes(f))vm.runInContext(src,ctx);
 return {B:window.NpcBuilder,N:window.NpcLibrary,G:window.GMTools,window,state:st,calls};
}
const ROOT=()=>({isConnected:true,dataset:{lang:'ru'},outerHTML:'',querySelector:()=>null});
const click=(B,action,data={},lang='ru',root=ROOT())=>B.handle({type:'click',target:{closest:s=>s==='[data-nb-root]'?root:s==='[data-nb-action]'?{dataset:{nbAction:action,...data},getAttribute:()=>null}:null,dataset:{}}},lang);
const field=(B,name,value,type='change',lang='ru',root=ROOT())=>B.handle({type,target:{closest:s=>s==='[data-nb-root]'?root:null,dataset:{nbField:name},value}},lang);
const byId=(B,id)=>B.archetypes().find(x=>x.id===id);

test('the ten archetypes are read from the app\'s templates; without them or without the library the card is not drawn',()=>{
 const {B}=load();
 assert.equal(B.archetypes().length,10);assert.match(B.render('ru'),/data-nb-root/);
 const noTools=load({skip:['gm-tools.js']}).B;assert.deepEqual(plain(noTools.archetypes()),[]);assert.equal(noTools.render('ru'),'');
 assert.equal(load({skip:['npc-library.js']}).B.render('ru'),'');
 const {B:broken,G}=load();G.NPC_TEMPLATES.push({id:'x',name:{ru:'x'}},null);assert.equal(broken.archetypes().length,10,'a malformed template is skipped');
});

test('the archetype\'s own level gives the template numbers exactly; each step moves them by the app\'s setting',()=>{
 const {B}=load();
 for(const t of B.archetypes())for(const tier of [null,t.tier,'no such level']){
  assert.deepEqual(plain(B.scaled(t,tier)),{shift:0,ref:t.stats.REF,body:t.stats.BODY,will:t.stats.WILL,hp:t.hp,sp:Math.max(t.armor.headSP,t.armor.bodySP)},t.id);
 }
 assert.equal(B.scaled(byId(B,'boosterganger'),null).hp,20,'the template that does not follow the HP formula stays as it is');
 assert.deepEqual(plain(B.scaled(byId(B,'bodyguard'),'lieutenant')),{shift:1,ref:7,body:7,will:5,hp:40,sp:11});
 assert.deepEqual(plain(B.scaled(byId(B,'cyberpsycho'),'mook')),{shift:-3,ref:5,body:7,will:4,hp:40,sp:0});
 assert.deepEqual(plain(B.scaled(byId(B,'road-ganger'),'boss')),{shift:3,ref:9,body:6,will:6,hp:40,sp:12});
 const weak={...byId(B,'boosterganger'),stats:{REF:2,BODY:1,WILL:1},hp:10,tier:'boss'};
 assert.deepEqual(plain(B.scaled(weak,'mook')),{shift:-3,ref:1,body:1,will:1,hp:10,sp:0},'numbers never fall under their floor');
});

test('armor moves along the SP values of the catalog and stops at both ends',()=>{
 const {B,window}=load();
 assert.deepEqual(plain(B.ARMOR_LADDER),[0,4,7,11,12,13,15,18]);
 const inCatalog=new Set(window.CATALOG.filter(x=>x.category==='armor'&&Number.isInteger(x.stats.sp)).map(x=>x.stats.sp));
 for(const sp of B.ARMOR_LADDER.slice(1))assert.ok(inCatalog.has(sp),'SP '+sp+' is an armor of the catalog');
 assert.equal(B.ladderStep(7,1),11);assert.equal(B.ladderStep(7,-1),4);assert.equal(B.ladderStep(4,-1),0);assert.equal(B.ladderStep(0,-1),0);
 assert.equal(B.ladderStep(18,1),18);assert.equal(B.ladderStep(11,3),15);assert.equal(B.ladderStep(11,-9),0);
 assert.equal(B.ladderStep(9,0),9,'no move keeps an SP that is not a rung');assert.equal(B.ladderStep(9,1),11);assert.equal(B.ladderStep(9,-1),4);
});

test('skill totals: the armored value, an unreadable one skipped, two per level step, a default pick of twelve',()=>{
 const {B}=load(),officer=byId(B,'security-officer');
 assert.equal(B.skillTotal(officer,'Evasion',0),8,'the armored value of a slowed NPC');assert.equal(B.skillTotal(officer,'Tactics',0),null);assert.equal(B.skillTotal(officer,'No such skill',0),null);
 assert.equal(B.skillTotal(officer,'toString',0),null);
 assert.equal(B.skillTotal(officer,'Evasion',1),10);assert.equal(B.skillTotal(officer,'Evasion',-3),2);
 assert.equal(B.skillTotal({skillBases:{A:1}},'A',-3),0);assert.equal(B.skillTotal({skillBases:{A:39}},'A',3),40);
 for(const t of B.archetypes()){
  const pick=B.defaultSkills(t);
  assert.ok(pick.length<=12&&pick.length>0,t.id);assert.equal(pick[0],'Evasion',t.id);assert.deepEqual(plain(pick),plain(B.defaultSkills(t)),'deterministic');
  for(const k of pick){assert.ok(!['Handgun','Shoulder Arms','Archery','Heavy Weapons','Autofire','Melee Weapon','Melee Weapons'].includes(k),k);assert.notEqual(B.skillTotal(t,k,0),null)}
 }
 assert.ok(!B.defaultSkills(officer).includes('Tactics'));
});

test('attacks come from the template weapons with the total of their skill',()=>{
 const {B}=load();
 assert.deepEqual(plain(B.defaultAttacks(byId(B,'bodyguard'),0,'en')),[{name:'Poor Quality Shotgun',base:10,damage:'5d6',on:true},{name:'Very Heavy Pistol',base:10,damage:'4d6',on:true}]);
 assert.deepEqual(plain(B.defaultAttacks(byId(B,'bodyguard'),1,'ru')),[{name:'Дробовик низкого качества',base:12,damage:'5d6',on:true},{name:'Очень тяжёлый пистолет',base:12,damage:'4d6',on:true}]);
 assert.equal(B.defaultAttacks(byId(B,'outrider'),0,'en')[2].base,12,'the plural «Melee Weapons» key of one template is found');
 assert.equal(B.attackBase(byId(B,'road-ganger'),'Crossbow',0),10);assert.equal(B.attackBase(byId(B,'pyro'),'Flamethrower',0),14);
 // A weapon whose skill the archetype lacks: the bare stat, REF for ranged and DEX for melee.
 const guard=byId(B,'bodyguard');
 assert.equal(B.attackBase(guard,'Grenade Launcher',0,'Heavy Weapons'),6);assert.equal(B.attackBase(guard,'Heavy Melee Weapon',1,'Melee Weapon'),7);
 for(const l of ['ru','en'])for(const t of B.archetypes()){const a=B.defaultAttacks(t,0,l);assert.ok(a.length>=1&&a.length<=6,t.id);for(const x of a){assert.ok(x.name.length>0&&x.name.length<=40,x.name);assert.match(x.damage,/^\d{1,2}d(6|10)$/)}}
 const many={...guard,weapons:Array.from({length:9},(_,i)=>({name:'Pistol '+i,damage:'2d6'})).concat([{name:'Odd',damage:'a lot'}])};
 assert.equal(B.defaultAttacks(many,0,'en').length,6);
 const weapons=B.catalogWeapons('ru');assert.ok(weapons.length>=10);for(const w of weapons){assert.match(w.damage,/^\d{1,2}d(6|10)$/);assert.ok(w.name.length<=40&&w.skill)}
});

test('the kit line of a template is split into items with quantities',()=>{
 const {B}=load();
 assert.deepEqual(plain(B.splitKit('Rifle Ammo x50, Bulletproof Shield (10 HP), Handcuffs x2, Neural Link (Chipware Socket, Tactile Boost)')),[{name:'Rifle Ammo',qty:50},{name:'Bulletproof Shield (10 HP)',qty:1},{name:'Handcuffs',qty:2},{name:'Neural Link (Chipware Socket, Tactile Boost)',qty:1}]);
 assert.deepEqual(plain(B.splitKit('Пули для дробовика ×25, радиокоммуникатор.')),[{name:'Пули для дробовика',qty:25},{name:'радиокоммуникатор',qty:1}]);
 assert.deepEqual(plain(B.splitKit('Cybereye ×2 (Anti-Dazzle ×2), Techhair, , Max2')),[{name:'Cybereye (Anti-Dazzle ×2)',qty:2},{name:'Techhair',qty:1},{name:'Max2',qty:1}]);
 assert.deepEqual(plain(B.splitKit(null)),[]);assert.equal(B.splitKit(Array.from({length:40},(_,i)=>'item '+i).join(', ')).length,16);
 for(const l of ['ru','en'])for(const t of B.archetypes()){
  const kit=B.archetypeKit(t,l);assert.ok(kit.length>0&&kit.length<=B.MAX_KIT,t.id);
  for(const x of kit){assert.ok(x.name.length>0&&x.name.length<=B.MAX_KIT_NAME,x.name);assert.ok(!/[.,]$/.test(x.name),x.name);assert.ok(x.qty>=1&&x.qty<=B.MAX_QTY)}
  assert.ok(B.kitText(kit).length<=B.KIT_BUDGET,t.id+' fits the notes');
 }
 assert.equal(B.archetypeKit(byId(B,'bodyguard'),'ru')[0].name,'Пули для дробовика');
 // As rows of a list every item starts with a capital, though the Russian source line is one sentence.
 for(const l of ['ru','en'])for(const t of B.archetypes())for(const x of B.archetypeKit(t,l))assert.equal(x.name.charAt(0),x.name.charAt(0).toLocaleUpperCase(l),t.id+' '+x.name);
 assert.deepEqual(plain(B.archetypeKit(byId(B,'bodyguard'),'ru').map(x=>x.name)),['Пули для дробовика','Патроны для очень тяжёлого пистолета','Радиокоммуникатор']);assert.equal(B.archetypeKit(byId(B,'bodyguard'),'en')[0].name,'Slug Ammo');
});

test('plus and minus on the kit: quantities, removal, the caps, and inputs left as they were',()=>{
 const {B}=load(),kit=[{name:'Агент',qty:1},{name:'Фонарь',qty:2}],before=JSON.stringify(kit);
 assert.deepEqual(plain(B.kitStep(kit,1,1)),[{name:'Агент',qty:1},{name:'Фонарь',qty:3}]);
 assert.deepEqual(plain(B.kitStep(kit,1,-1)),[{name:'Агент',qty:1},{name:'Фонарь',qty:1}]);
 assert.deepEqual(plain(B.kitStep(kit,0,-1)),[{name:'Фонарь',qty:2}],'minus on the last piece removes the row');
 assert.deepEqual(plain(B.kitStep(kit,7,1)),plain(kit));assert.equal(B.kitStep([{name:'A',qty:B.MAX_QTY}],0,1)[0].qty,B.MAX_QTY);
 assert.equal(B.kitText(B.kitStep(kit,1,1)),'Агент, Фонарь ×3');
 assert.deepEqual(plain(B.kitAdd(kit,'  агент ')),{ok:true,kit:[{name:'Агент',qty:2},{name:'Фонарь',qty:2}],name:'Агент'});
 assert.deepEqual(plain(B.kitAdd(kit,'Верёвка').kit[2]),{name:'Верёвка',qty:1});assert.equal(B.kitAdd(kit,' \u0000 ').reason,'empty');
 const full=Array.from({length:16},(_,i)=>({name:'i'+i,qty:1}));
 assert.equal(B.kitAdd(full,'one more').reason,'full');assert.equal(B.kitAdd(full,'I3').ok,true,'one more of a thing already listed still fits');
 const long=Array.from({length:6},(_,i)=>({name:String(i).repeat(70),qty:1}));
 assert.equal(B.kitAdd(long,'x'.repeat(30)).reason,'long');assert.deepEqual(plain(B.kitStep(long.concat([{name:'y'.repeat(9),qty:9}]),6,1)).pop(),{name:'y'.repeat(9),qty:9},'a step that would overflow the notes is refused');
 assert.equal(JSON.stringify(kit),before);
});

test('every archetype at every level in both languages becomes a preset the library keeps whole',()=>{
 const {B,N}=load();
 for(const l of ['ru','en'])for(const t of B.archetypes())for(const tier of B.TIERS){
  const d=B.draftOf({arch:t.id,tier},l),e=N.cleanEntry({...d,id:'x'}),where=`${l} ${t.id} ${tier}`;
  assert.ok(e,where);
  for(const k of ['name','ref','body','will','hp','head','torso','notes'])assert.equal(e[k],d[k],where+' '+k);
  assert.deepEqual(plain(e.skills),plain(d.skills),where);assert.deepEqual(plain(e.attacks),plain(d.attacks),where);
  assert.equal(d.name,t.name[l]);assert.ok(d.notes.includes(String(t.page)),where+' has the page');assert.ok(d.notes.startsWith(l==='ru'?'Снаряжение: ':'Gear: '),where);assert.ok(d.notes.length<=500);
  if(l==='en')assert.ok(!/[А-Яа-яЁё]/.test(JSON.stringify(d)),where+' is English');
 }
 const d=B.draftOf({arch:'bodyguard',tier:'lieutenant',name:'  Охрана\u0007 клуба ',nameTouched:true,sp:13,attacks:[{name:'Нож',base:9,damage:'1d6',on:true},{name:'Дробовик',base:12,damage:'5d6',on:false},{name:'Плохой',base:1,damage:'drop'}],skills:['Stealth','Handgun','Stealth','Nope','Evasion'],kit:[{name:'Агент',qty:2}]},'ru');
 assert.deepEqual(plain(d),{name:'Охрана клуба',ref:7,body:7,will:5,hp:40,head:13,torso:13,skills:[{name:'Stealth',base:9},{name:'Evasion',base:9}],attacks:[{name:'Нож',base:9,damage:'1d6'}],weapons:'',notes:'Снаряжение: Агент ×2\nОснова: Телохранитель · лейтенант · стр. 412'});
 assert.equal(B.draftOf({arch:'bodyguard',kit:[]},'en').notes,'Based on: Bodyguard · mook · p. 412','an empty kit leaves the origin line alone');
 const big=B.draftOf({arch:'bodyguard',kit:Array.from({length:6},(_,i)=>({name:String(i).repeat(80),qty:1}))},'ru');assert.ok(big.notes.length<=500&&!big.notes.includes('\n'),'the origin line is dropped when the kit fills the notes');
 assert.equal(B.draftOf({arch:'nobody'},'ru').name,'Телохранитель','an unknown archetype falls back to the first one');
});

test('saving adds one preset and numbered copies to the tracker; the caps are respected and old data works',()=>{
 const {B,state}=load();let n=0;const uid=()=>'u'+(++n);
 state.campaigns[0].roster.push({id:'r2',kind:'npc',name:'Телохранитель 2',ref:6,hp:35});
 const r=B.save(state,{arch:'bodyguard',sp:12},'ru',{copies:3,campaignId:'k',uid,now:1000,id:'npc-a'});
 assert.equal(r.ok,true);assert.equal(state.gmExtras.npcLibrary.length,1);assert.equal(state.gmExtras.npcLibrary[0].id,'npc-a');assert.equal(state.gmExtras.npcLibrary[0].head,12);
 assert.deepEqual(plain(r.added.map(x=>x.name)),['Телохранитель 3','Телохранитель 4','Телохранитель 5'],'numbering continues after the names already in the roster');
 for(const row of state.campaigns[0].roster.slice(2)){assert.equal(row.kind,'npc');assert.equal(row.sourceLibrary,'npc-a');assert.deepEqual(plain(row.sp),{head:12,body:12});assert.equal(row.body,6);assert.equal(row.hp,35);assert.match(row.combatNote.text,/SP 12\/12 · Дробовик низкого качества \+10 5d6/)}
 assert.equal(r.campaignName,'Job');
 const only=B.save(state,{arch:'netrunner'},'en',{copies:0,campaignId:'k',uid,id:'npc-b'});assert.equal(only.ok,true);assert.equal(only.added.length,0);assert.equal(state.campaigns[0].roster.length,5);
 assert.equal(B.save(state,{arch:'pyro'},'ru',{copies:2,campaignId:'gone',uid}).added.length,0,'a campaign that is not there gets no rows, the preset is saved');assert.equal(state.gmExtras.npcLibrary.length,3);
 assert.equal(B.save(state,{arch:'pyro',name:' ',nameTouched:true},'ru',{uid}).reason,'name');assert.equal(state.gmExtras.npcLibrary.length,3);
 const old={campaigns:[{id:'k',name:'',roster:[]}]};assert.equal(B.save(old,{arch:'pyro'},'ru',{copies:1,campaignId:'k',uid}).added.length,1);assert.equal(old.gmExtras.npcLibrary.length,1);
 assert.equal(B.save(null,{arch:'pyro'},'ru').ok,false);
 const crowded={gmExtras:{npcLibrary:Array.from({length:100},(_,i)=>({id:'e'+i,name:'N'+i}))},campaigns:[]},was=JSON.stringify(crowded);
 assert.deepEqual(plain(B.save(crowded,{arch:'pyro'},'ru',{uid})),{ok:false,reason:'full',added:[]});assert.equal(JSON.stringify(crowded),was,'a full library is left untouched');
 const packed={campaigns:[{id:'k',name:'Job',roster:Array.from({length:2044},(_,i)=>({id:'x'+i,kind:'npc',name:'x'}))}]},full=B.save(packed,{arch:'pyro'},'ru',{copies:2,campaignId:'k',uid});
 assert.equal(full.ok,true);assert.equal(full.rosterFull,true);assert.equal(full.added.length,0);assert.equal(packed.campaigns[0].roster.length,2044);assert.equal(packed.gmExtras.npcLibrary.length,1);
});

test('undo removes exactly what one save made',()=>{
 const {B,N,state}=load();let n=0;const uid=()=>'u'+(++n);
 state.gmExtras.npcLibrary=[{id:'keep',name:'Свой'}];
 const r=B.save(state,{arch:'bodyguard'},'ru',{copies:2,campaignId:'k',uid,id:'npc-a'}),receipt={entryId:'npc-a',campaignId:'k',rowIds:r.added.map(x=>x.id)};
 // The GM adds one more copy by hand from the library card: it is not part of the save.
 N.addToCampaign(state.campaigns[0],r.entry,1,'ru',uid);state.campaigns[0].turnIndex=3;
 assert.deepEqual(plain(B.undo(state,receipt)),{ok:true,removedRows:2,keptEntry:false,keptRows:0});
 assert.deepEqual(plain(state.gmExtras.npcLibrary.map(x=>x.id)),['keep']);
 assert.deepEqual(plain(state.campaigns[0].roster.map(x=>x.name)),['Ganger','Телохранитель 3']);assert.equal(state.campaigns[0].turnIndex,1,'the turn pointer stays inside the roster');
 assert.deepEqual(plain(B.undo(state,receipt)),{ok:false,removedRows:0,keptEntry:false,keptRows:0},'a second undo changes nothing');
 assert.deepEqual(plain(B.undo(state,{entryId:'npc-a',campaignId:'gone',rowIds:['r1']})),{ok:false,removedRows:0,keptEntry:false,keptRows:0});
 assert.deepEqual(plain(B.undo(state,{entryId:'keep',campaignId:'k',rowIds:['r1']})),{ok:true,removedRows:0,keptEntry:false,keptRows:0},'a row that does not point at the preset stays');assert.equal(state.campaigns[0].roster[0].id,'r1');
 assert.equal(B.undo(state,null).ok,false);assert.equal(B.undo(null,receipt).ok,false);
});

test('the steps: open, choose, move, adjust; a change of archetype resets the later steps but keeps a typed name',()=>{
 const {B}=load();
 assert.equal(B.handle({type:'click',target:{closest:()=>null}},'ru'),false,'clicks outside the card are not ours');
 assert.equal(B.handle({type:'click',target:{closest:s=>s==='[data-nb-root]'?{isConnected:false}:null}},'ru'),false);
 click(B,'open');assert.deepEqual([B._state().open,B._state().step,B._state().arch],[true,0,'bodyguard']);
 click(B,'next');click(B,'next');click(B,'next');click(B,'next');assert.equal(B._state().step,3);
 click(B,'back');assert.equal(B._state().step,2);click(B,'goto',{nbStep:'0'});assert.equal(B._state().step,0);click(B,'back');assert.equal(B._state().step,0);
 // Armor steps along the ladder and stops at its ends.
 for(let i=0;i<9;i++)click(B,'sp',{nbD:'1'});assert.equal(B._state().sp,18);
 for(let i=0;i<9;i++)click(B,'sp',{nbD:'-1'});assert.equal(B._state().sp,0);click(B,'sp',{nbD:'1'});assert.equal(B._state().sp,4);
 click(B,'attack',{nbI:'0'});assert.deepEqual(plain(B._state().attacks.map(a=>a.on)),[false,true]);
 click(B,'kit',{nbI:'0',nbD:'1'});click(B,'kit',{nbI:'2',nbD:'-1'});
 assert.deepEqual(plain(B._state().kit),[{name:'Пули для дробовика',qty:26,ref:'t:0'},{name:'Патроны для очень тяжёлого пистолета',qty:25,ref:'t:1'}]);
 // Another archetype: the adjusted armor, weapons and kit go back to that archetype's set.
 field(B,'arch','netrunner');
 let s=B._state();assert.deepEqual([s.arch,s.sp,s.attacks,s.skills,s.kit,s.nameTouched],['netrunner',null,null,null,null,false]);
 assert.equal(field(B,'arch','nobody'),false);assert.equal(field(B,'tier','legend'),false);assert.equal(B._state().arch,'netrunner');
 field(B,'name','Сова','input');click(B,'kit',{nbI:'0',nbD:'1'});field(B,'tier','boss');
 s=B._state();assert.deepEqual([s.name,s.nameTouched,s.tier,s.kit],['Сова',true,'boss',null]);
 assert.equal(B.draftOf(s,'ru').name,'Сова');assert.equal(B.draftOf(s,'ru').hp,40);
 field(B,'name','   ','input');field(B,'arch','pyro');assert.equal(B.draftOf(B._state(),'ru').name,'Поджигатель','an emptied name follows the archetype again');
 click(B,'kit-reset');assert.equal(B._state().kit,null);
 click(B,'close');assert.equal(B._state().open,false);assert.equal(B._state().arch,'pyro','closing keeps the unfinished NPC');
 B.reset();assert.equal(B._state().arch,'');
});

test('the steps stop at the library\'s limits: twelve skills, six attacks, sixteen kit rows',()=>{
 const {B}=load();click(B,'open');field(B,'arch','outrider');
 assert.equal(B.resolve(B._state(),'ru').skills.length,12);
 click(B,'skill',{nbKey:'Streetwise'});assert.equal(B._state().skills.length,12,'a thirteenth skill is refused');assert.ok(!B._state().skills.includes('Streetwise'));
 click(B,'skill',{nbKey:'Evasion'});click(B,'skill',{nbKey:'Streetwise'});assert.equal(B._state().skills.length,12);assert.equal(B._state().skills[11],'Streetwise');
 assert.equal(click(B,'skill',{nbKey:'Handgun'}),false,'an attack skill is not a skill chip');assert.equal(click(B,'skill',{nbKey:'Nope'}),false);
 const select=id=>({isConnected:true,dataset:{lang:'ru'},outerHTML:'',querySelector:s=>/addWeapon/.test(s)?{value:id}:null});
 click(B,'add-weapon',{},'ru',select('weapon-shotgun'));
 assert.deepEqual(plain(B._state().attacks[3]),{name:'Дробовик',base:14,damage:'5d6',on:true,cat:'weapon-shotgun'});
 click(B,'attack',{nbI:'3'});click(B,'add-weapon',{},'ru',select('weapon-shotgun'));assert.equal(B._state().attacks.length,4,'the same weapon is switched back on, not added twice');assert.equal(B._state().attacks[3].on,true);
 for(const id of ['weapon-smg','weapon-heavy-smg','weapon-sniper-rifle','weapon-rocket-launcher'])click(B,'add-weapon',{},'ru',select(id));
 assert.equal(B._state().attacks.length,6);assert.equal(B.draftOf(B._state(),'ru').attacks.length,6);
 const typed=text=>({isConnected:true,dataset:{lang:'ru'},outerHTML:'',querySelector:s=>/"own"/.test(s)?{value:text}:null});
 for(let i=0;i<12;i++)click(B,'add-own',{},'ru',typed('Вещь '+i));
 assert.equal(B._state().kit.length,16);assert.equal(B._state().kit[15].name,'Вещь 7');
 const gear=id=>({isConnected:true,dataset:{lang:'ru'},outerHTML:'',querySelector:s=>/addGear|addCyber/.test(s)?{value:id}:null});
 click(B,'add-gear',{},'ru',gear('gear-agent'));assert.equal(B._state().kit.length,16);
 click(B,'kit',{nbI:'15',nbD:'-1'});click(B,'add-gear',{},'ru',gear('gear-agent'));assert.equal(B._state().kit[15].name,'Агент');
 click(B,'kit',{nbI:'15',nbD:'-1'});click(B,'add-cyber',{},'ru',gear('cyberware-neural-link'));assert.equal(B._state().kit[15].name,'Нейронная связь');
});

test('the save button: an empty name sends the GM back to step one; a save is written once and can be undone',()=>{
 const {B,state,calls}=load();
 click(B,'open');field(B,'arch','bodyguard');field(B,'tier','lieutenant');click(B,'goto',{nbStep:'3'});
 field(B,'name','  ','input');click(B,'next');click(B,'next');click(B,'next');click(B,'save');
 assert.equal((state.gmExtras.npcLibrary||[]).length,0);assert.deepEqual([B._state().open,B._state().step],[true,0]);assert.equal(calls.length,0);
 field(B,'name','Охрана <b>клуба</b>','input');click(B,'goto',{nbStep:'3'});field(B,'count','3','input');field(B,'campaign','k');
 const before=JSON.stringify(state);click(B,'save');
 assert.equal(calls.filter(c=>c[0]==='save').length,1,'saved once');
 assert.equal(state.gmExtras.npcLibrary[0].name,'Охрана <b>клуба</b>');assert.equal(state.gmExtras.npcLibrary[0].hp,40);
 assert.deepEqual(plain(state.campaigns[0].roster.map(r=>r.name)),['Ganger','Охрана <b>клуба</b> 1','Охрана <b>клуба</b> 2','Охрана <b>клуба</b> 3']);
 const action=calls.find(c=>c[0]==='action');
 assert.equal(action[1],'Сохранено в библиотеку: Охрана <b>клуба</b>. В «Job» добавлено: Охрана <b>клуба</b> 1, Охрана <b>клуба</b> 2, Охрана <b>клуба</b> 3.');assert.equal(action[2],'Отменить');assert.equal(action[4],15000);
 assert.deepEqual([B._state().open,B._state().arch],[false,''],'the card closes and forgets the finished NPC');
 action[3]();
 assert.deepEqual(plain(state.gmExtras.npcLibrary),[]);assert.deepEqual(plain(state.campaigns[0].roster.map(r=>r.name)),['Ganger']);
 assert.equal(JSON.stringify({...plain(state),gmExtras:{}}),JSON.stringify({...JSON.parse(before),gmExtras:{}}),'undo puts the data back');
 assert.equal(calls.filter(c=>c[0]==='save').length,2);assert.equal(calls.at(-1)[1],'Сохранение отменено.');
 // No notifyAction in the app: a plain notice, and zero copies means the library only.
 const bare=load();delete bare.window.App.notifyAction;
 click(bare.B,'open');click(bare.B,'goto',{nbStep:'3'});click(bare.B,'count',{nbD:'-1'});click(bare.B,'save');
 assert.equal(bare.state.gmExtras.npcLibrary.length,1);assert.equal(bare.state.campaigns[0].roster.length,1);assert.deepEqual(bare.calls.filter(c=>c[0]==='notify').map(c=>c[1]),['Сохранено в библиотеку: Телохранитель.']);
});

test('a language switch in the middle of a build: archetype and catalog rows follow the language, typed text stays',()=>{
 const {B}=load();
 const pickW=id=>({isConnected:true,dataset:{lang:'ru'},outerHTML:'',querySelector:sel=>/addWeapon/.test(sel)?{value:id}:null});
 const pickK=(id,text)=>({isConnected:true,dataset:{lang:'ru'},outerHTML:'',querySelector:sel=>/addGear|addCyber/.test(sel)?{value:id}:/"own"/.test(sel)?{value:text}:null});
 click(B,'open');click(B,'attack',{nbI:'0'});click(B,'add-weapon',{},'ru',pickW('weapon-smg'));
 click(B,'kit',{nbI:'0',nbD:'1'});click(B,'add-cyber',{},'ru',pickK('cyberware-neural-link'));click(B,'add-own',{},'ru',pickK('','Жетон клуба'));
 const ru=B.draftOf(B._state(),'ru'),en=B.draftOf(B._state(),'en');
 assert.deepEqual(plain(ru.attacks.map(a=>a.name)),['Очень тяжёлый пистолет','Пистолет-пулемёт']);
 assert.deepEqual(plain(en.attacks.map(a=>a.name)),['Very Heavy Pistol','SMG']);
 assert.equal(en.notes,'Gear: Slug Ammo ×26, Very Heavy Pistol Ammo ×25, Radio Communicator, Neural Link, Жетон клуба\nBased on: Bodyguard · mook · p. 412','only the typed item keeps its own text');
 assert.ok(!/[А-Яа-яЁё]/.test(JSON.stringify({...en,notes:en.notes.replace('Жетон клуба','')})),'no Russian is left in the English preset');
 assert.match(ru.notes,/^Снаряжение: Пули для дробовика ×26, Патроны для очень тяжёлого пистолета ×25, Радиокоммуникатор, Нейронная связь, Жетон клуба\n/);
 // The card itself, and the next press, work in the new language: no row stays behind and nothing is doubled.
 click(B,'goto',{nbStep:'2'},'en');
 const html=B.render('en');assert.match(html,/aria-label="Less: Slug Ammo"/);assert.ok(!/[А-Яа-яЁё]/.test(html.replace(/Жетон клуба/g,'')),'step 3 in English');
 click(B,'add-cyber',{},'en',pickK('cyberware-neural-link'));
 assert.deepEqual(plain(B._state().kit.map(x=>[x.name,x.qty])),[['Slug Ammo',26],['Very Heavy Pistol Ammo',25],['Radio Communicator',1],['Neural Link',2],['Жетон клуба',1]]);
 click(B,'add-weapon',{},'en',pickW('weapon-smg'));
 assert.deepEqual(plain(B._state().attacks.map(a=>[a.name,a.on])),[['Poor Quality Shotgun',false],['Very Heavy Pistol',true],['SMG',true]],'the same catalog weapon is found again after the switch');
 click(B,'goto',{nbStep:'1'},'en');assert.ok(!/[А-Яа-яЁё]/.test(B.render('en')),'step 2 in English');
 // References that point nowhere fall back to the stored text instead of dropping the row.
 const odd=B.draftOf({arch:'bodyguard',attacks:[{name:'Свой ствол',base:5,damage:'2d6',cat:'no-such-id'}],kit:[{name:'Своя вещь',qty:2,ref:'t:99'},{name:'Ещё',qty:1,ref:'c:no-such-id'},{name:'Плохая ссылка',qty:1,ref:'<b>'}]},'en');
 assert.deepEqual(plain(odd.attacks),[{name:'Свой ствол',base:5,damage:'2d6'}]);assert.match(odd.notes,/^Gear: Своя вещь ×2, Ещё, Плохая ссылка\n/);
 assert.equal(B.kitAdd([{name:'A',qty:1}],'B','<b>').kit[1].ref,undefined,'a malformed reference is not kept');
});

test('six weapon slots: the counter and the limit mean the same, a new weapon takes the place of a switched-off one',()=>{
 const {B}=load();
 const pick=id=>({isConnected:true,dataset:{lang:'ru'},outerHTML:'',querySelector:sel=>/addWeapon/.test(sel)?{value:id}:null});
 click(B,'open');for(const id of ['weapon-shotgun','weapon-smg','weapon-heavy-smg','weapon-sniper-rifle'])click(B,'add-weapon',{},'ru',pick(id));
 click(B,'goto',{nbStep:'1'});
 assert.match(B.render('ru'),/Оружие · 6\/6/);assert.match(B.render('ru'),/data-nb-action="add-weapon" data-nb-focus="add-weapon" aria-disabled="true"/);
 click(B,'add-weapon',{},'ru',pick('weapon-rocket-launcher'));
 assert.equal(B._state().attacks.length,6);assert.ok(!B._state().attacks.some(a=>a.cat==='weapon-rocket-launcher'),'six weapons switched on: a seventh is refused');
 click(B,'attack',{nbI:'1'});click(B,'attack',{nbI:'4'});
 assert.match(B.render('ru'),/Оружие · 4\/6/);assert.ok(!/data-nb-action="add-weapon"[^>]*aria-disabled/.test(B.render('ru')),'with a switched-off row the button is live');
 const gone=B._state().attacks[1].name;
 click(B,'add-weapon',{},'ru',pick('weapon-rocket-launcher'));
 const rows=B._state().attacks;
 assert.equal(rows.length,6);assert.equal(rows[5].cat,'weapon-rocket-launcher');assert.equal(rows[5].on,true);assert.ok(!rows.some(a=>a.name===gone),'the first switched-off row gave up its place');
 assert.equal(rows.filter(a=>a.on).length,5);
 assert.equal(B.draftOf(B._state(),'ru').attacks.length,5);
 assert.match(SOURCES['npc-builder.js'],/новое оружие займёт место выключенного/);assert.match(SOURCES['npc-builder.js'],/a new weapon takes the place of a switched-off one/);
});

test('undo keeps the turn with the same combatant',()=>{
 const roster=()=>[{id:'A',kind:'npc',name:'A',initiative:15,order:1},{id:'B',kind:'npc',name:'B',initiative:10,order:2},{id:'C',kind:'npc',name:'C',initiative:5,order:3}];
 const run=(inits,turnIndex)=>{
  const st={gmExtras:{},campaigns:[{id:'k',name:'Job',roster:roster(),turnIndex:1}]},{B}=load({state:st});let n=0;
  const r=B.save(st,{arch:'bodyguard'},'ru',{copies:3,campaignId:'k',uid:()=>'u'+(++n),id:'npc-a'}),c=st.campaigns[0];
  c.roster.slice(3).forEach((row,i)=>{row.initiative=inits[i]});c.turnIndex=turnIndex;
  assert.equal(B.undo(st,B.receiptOf(r)).removedRows,3);
  return c;
 };
 // The copies rolled high and stand before B in the order: B is fifth, and must still be the active one after.
 let c=run([22,21,20],4);assert.equal(c.roster.length,3);assert.equal(c.turnIndex,1,'B keeps the turn');
 c=run([12,11,1],0);assert.equal(c.turnIndex,0,'A keeps the turn');
 // The active combatant was one of the removed copies: the pointer stays in place, inside the roster.
 c=run([22,21,20],1);assert.equal(c.turnIndex,1);
 c=run([4,3,2],5);assert.equal(c.turnIndex,2);
 // A campaign without a turn pointer (old data) gets none.
 const st={gmExtras:{},campaigns:[{id:'k',name:'Job',roster:roster()}]},{B}=load({state:st}),r=B.save(st,{arch:'pyro'},'ru',{copies:1,campaignId:'k',id:'npc-b'});
 B.undo(st,B.receiptOf(r));assert.equal('turnIndex' in st.campaigns[0],false);
});

test('undo leaves alone what the GM changed after the save, and says so',()=>{
 const {B,N,state,calls,window}=load();
 click(B,'open');click(B,'goto',{nbStep:'3'});field(B,'count','3','input');click(B,'save');
 const id=state.gmExtras.npcLibrary[0].id,c=state.campaigns[0];
 const u=N.updateEntry(N.readLibrary(state),id,{...state.gmExtras.npcLibrary[0],name:'Правка мастера'});assert.equal(u.ok,true);N.writeLibrary(state,u.list);
 c.roster[1].hp=3;c.roster[2].initiative=17;c.roster[2].ties=[4];
 calls.find(x=>x[0]==='action')[3]();
 assert.deepEqual(plain(state.gmExtras.npcLibrary.map(x=>x.name)),['Правка мастера'],'the edited preset is not deleted');
 assert.deepEqual(plain(c.roster.map(x=>x.name)),['Ganger','Телохранитель 1'],'the copy with changed HP stays; a rolled initiative alone does not protect a copy');
 assert.equal(calls.at(-1)[1],'Сохранение отменено. Заготовку вы уже изменили — она осталась в библиотеке. Изменённые копии остались в трекере: 1.');
 // Nothing at all could be taken back: the notice does not claim an undo. The language is the current one.
 const two=load();click(two.B,'open');click(two.B,'goto',{nbStep:'3'});click(two.B,'count',{nbD:'-1'});click(two.B,'save');
 const e=two.state.gmExtras.npcLibrary[0];two.N.writeLibrary(two.state,two.N.updateEntry(two.N.readLibrary(two.state),e.id,{...e,notes:'мои заметки'}).list);
 two.window.App.lang=()=>'en';two.calls.find(x=>x[0]==='action')[3]();
 assert.equal(two.state.gmExtras.npcLibrary.length,1);assert.equal(two.calls.at(-1)[1],'You have already changed the preset, so it stays in the library.');
 // A receipt without pictures (made before this check existed) behaves as before: removal by id.
 const old=load(),r=old.B.save(old.state,{arch:'pyro'},'ru',{copies:1,campaignId:'k',id:'npc-x'});old.state.campaigns[0].roster[1].hp=1;
 assert.deepEqual(plain(old.B.undo(old.state,{entryId:'npc-x',campaignId:'k',rowIds:r.added.map(x=>x.id)})),{ok:true,removedRows:1,keptEntry:false,keptRows:0});
});

test('a roster with no room: the preset is saved, the notice says the copies were not added, undo removes the preset',()=>{
 const st={gmExtras:{},campaigns:[{id:'k',name:'Job',roster:Array.from({length:2044},(_,i)=>({id:'x'+i,kind:'npc',name:'x'}))}]},{B,calls}=load({state:st});
 click(B,'open');click(B,'goto',{nbStep:'3'});field(B,'count','2','input');click(B,'save');
 assert.equal(st.gmExtras.npcLibrary.length,1);assert.equal(st.campaigns[0].roster.length,2044);
 const action=calls.find(x=>x[0]==='action');
 assert.equal(action[1],'Сохранено в библиотеку: Телохранитель. Ростер кампании переполнен: копии не добавлены.');
 action[3]();assert.equal(st.gmExtras.npcLibrary.length,0);assert.equal(st.campaigns[0].roster.length,2044);assert.equal(calls.at(-1)[1],'Сохранение отменено.');
 assert.match(SOURCES['npc-builder.js'],/The campaign roster is full: no copies were added\./);
});

test('markup: four steps with one current, groups with legends, named plus and minus buttons, both languages',()=>{
 for(const l of ['ru','en']){
  const {B}=load();
  const closed=B.render(l);assert.match(closed,/data-nb-root/);assert.match(closed,/data-nb-action="open"/);assert.match(closed,/role="status"/);
  click(B,'open',{},l);
  for(let step=0;step<4;step++){
   const html=B.render(l);
   assert.equal((html.match(/<li/g)||[]).length>=4,true);assert.equal((html.match(/aria-current="step"/g)||[]).length,1,l+' step '+step);
   assert.equal((html.match(/data-nb-action="goto"/g)||[]).length,step,'earlier steps are buttons');
   assert.match(html,/<h3 class="nb-title" tabindex="-1" data-nb-heading/);
   for(const m of html.matchAll(/<button[^>]*class="btn ghost nb-pm"[^>]*>/g))assert.match(m[0],/aria-label="[^"]+"/);
   if(step===0){assert.equal((html.match(/<fieldset/g)||[]).length,2);assert.equal((html.match(/<legend>/g)||[]).length,2);assert.equal((html.match(/type="radio"/g)||[]).length,14);assert.match(html,/HP 35/)}
   if(step===1){assert.match(html,/role="group" aria-label="[^"]+"/);assert.match(html,/aria-pressed="true"/);assert.match(html,/data-nb-field="addWeapon"/)}
   if(step===2){assert.match(html,/data-nb-field="addCyber"/);assert.match(html,/data-nb-field="addGear"/);assert.match(html,/data-nb-field="own"/)}
   if(step===3){assert.match(html,/data-nb-preview/);assert.match(html,/data-nb-field="campaign"/);assert.match(html,/<label[^>]*for="nb-count"/);assert.match(html,/data-nb-action="save"/)}
   if(l==='en')assert.ok(!/[А-Яа-яЁё]/.test(html),'no Russian in the English card, step '+step);
   assert.ok(!/ disabled/.test(html),'controls stay focusable: aria-disabled, never disabled');
   click(B,'next',{},l);
  }
 }
 const {B,state}=load();state.campaigns=[];click(B,'open');click(B,'goto',{nbStep:'3'});
 assert.ok(!/data-nb-field="count"/.test(B.render('ru')));assert.match(B.render('ru'),/Сохранить в библиотеку/);
 const full=load();full.state.gmExtras.npcLibrary=Array.from({length:100},(_,i)=>({id:'e'+i,name:'N'+i}));
 assert.ok(!/data-nb-action="open"/.test(full.B.render('ru')));assert.match(full.B.render('ru'),/Библиотека заполнена/);
 assert.match(full.B.render('ru'),/<p class="nb-note" tabindex="-1" data-nb-focus="@heading">Библиотека заполнена/,'the closed card without its button still has a place for the focus');
 const noCatalog=load({skip:['catalog.js','catalog-extra.js']}).B;click(noCatalog,'open');click(noCatalog,'goto',{nbStep:'2'});
 assert.ok(!/data-nb-field="addCyber"/.test(noCatalog.render('ru')));assert.match(noCatalog.render('ru'),/data-nb-field="own"/,'without the catalog a typed item still works');
});

test('typed text is cleaned and escaped everywhere it is shown',()=>{
 const {B,state}=load();state.campaigns[0].name='<i>Job</i>';
 click(B,'open');field(B,'name','<img src=x onerror=alert(1)>\u0000"','input');
 assert.ok(!B.render('ru').includes('<img'));assert.match(B.render('ru'),/&lt;img src=x onerror=alert\(1\)&gt;/);
 click(B,'goto',{nbStep:'2'});
 click(B,'add-own',{},'ru',{isConnected:true,dataset:{},outerHTML:'',querySelector:s=>/"own"/.test(s)?{value:'<b>x</b>\u0007'}:null});
 let html=B.render('ru');assert.ok(!html.includes('<b>x</b>'));assert.match(html,/&lt;b&gt;x&lt;\/b&gt;/);assert.match(html,/aria-label="Меньше: &lt;b&gt;x&lt;\/b&gt;"/);
 click(B,'next');html=B.render('ru');
 assert.ok(!html.includes('<b>x</b>')&&!html.includes('<img')&&!html.includes('<i>Job</i>'));
 assert.equal(B.draftOf(B._state(),'ru').name,'<img src=x onerror=alert(1)> "','control characters are gone, the text itself is kept as text');
});

test('Russian text of the card addresses the GM formally and calls the level shift an app setting',()=>{
 const src=SOURCES['npc-builder.js'];
 assert.match(src,/Выберите архетип/);assert.match(src,/настройка приложения, а не правило книги/);assert.match(src,/an app setting, not a book rule/);
 assert.ok(!/(?<![А-Яа-яЁё])(выбери|нажми|поправь|сохрани|добавь|учти)(?![А-Яа-яЁё])/i.test(src));
});

test('wiring: the files are loaded in order, the GM group draws the card, the styles keep to their prefix',()=>{
 const html=site('index.html'),at=s=>{const i=html.indexOf(s);assert.ok(i>=0,s);return i};
 assert.ok(at('src="gm-tools.js"')<at('src="npc-builder.js"'));assert.ok(at('src="npc-library.js"')<at('src="npc-builder.js"'));assert.ok(at('src="gm-extras.js"')<at('src="npc-builder.js"'));
 assert.ok(at('src="catalog-extra.js"')<at('src="npc-builder.js"'));assert.ok(at('src="npc-builder.js"')<at('src="app.js"'));
 assert.ok(at('href="npc-builder.css"')<at('href="theme.css"'));
 assert.match(site('gm-extras.js'),/window\.NpcBuilder\?\.render\?\.\(l\)\|\|''\}\$\{window\.NpcLibrary\?\.render/,'the builder card sits right above the library card');
 const {G}=load();assert.equal(typeof G.SKILLS_RU,'object');assert.equal(typeof G.EQUIPMENT_RU.bodyguard,'string');
 const css=site('npc-builder.css').replace(/\/\*[\s\S]*?\*\//g,'');
 for(const m of css.matchAll(/([^{}@]+)\{[^{}]*\}/g))for(const sel of m[1].split(','))assert.match(sel,/\.nb-/,'selector «'+sel.trim()+'»');
 assert.ok(!/#[0-9a-f]{3,8}\b/i.test(css),'colours come from the theme variables');
 assert.ok(!/\r/.test(site('npc-builder.js'))&&!/\r/.test(site('npc-builder.css')),'LF line endings');
});
