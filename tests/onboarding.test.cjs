const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=n=>fs.readFileSync(__dirname+'/../site/'+n,'utf8'),plain=x=>JSON.parse(JSON.stringify(x));
const booster={id:'boosterganger',name:{ru:'Бустергангер',en:'Boosterganger'},stats:{REF:6,BODY:4},hp:20,page:412,armor:{name:'Leather',headSP:4,bodySP:4},weapons:[{name:'Rippers',damage:'2d6'}]};
// A fixed sequence of dice: each value is the face that comes up next.
const d10=(...faces)=>{let i=0;return ()=>(faces[i++%faces.length]-0.5)/10};
const d6=(...faces)=>{let i=0;return ()=>(faces[i++%faces.length]-0.5)/6};

// Loads onboarding.js (and, when asked, the real tracker) against a small stand-in for the app.
function setup({lang='ru',characters=[],campaigns=[],stored=null,tracker=true,templates=[booster],bin,quarantine}={}){
 const storage=new Map(stored?[['nc-onboarding',stored]]:[]),notices=[],reports=[],opened=[],views=[];let saves=0,renders=0,next=0,importResult=null;
 const state={lang,characters,campaigns,bin,quarantine};
 const window={GMTools:{NPC_TEMPLATES:templates}};
 window.App={getState:()=>state,save:()=>saves++,render:()=>renders++,notify:m=>notices.push(m),report:(...a)=>reports.push(a),open:id=>opened.push(id),setView:v=>{views.push(v);return true},
  checkBonus:(c,stat,level)=>(Number(c.stats?.[stat])||0)+(Number(level)||0),
  importCharacter(obj){if(importResult)return importResult;const c={...plain(obj),id:'pc-'+(++next)};state.characters=[c,...state.characters];return {ok:true,id:c.id}}};
 const ctx={window,localStorage:{getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v))},confirm:()=>true,Math,Date,globalThis:{crypto:{randomUUID:()=>`id-${++next}`}}};
 if(tracker){vm.runInNewContext(source('campaigns.js'),Object.assign(ctx,{document:{querySelector:()=>null}}));}
 vm.runInNewContext(source('onboarding.js'),ctx);
 const O=window.Onboarding,click=(action,inIntro=false)=>O.handle({type:'click',target:{closest:s=>s==='[data-ob]'?{dataset:{ob:action},closest:q=>q==='[data-ob-intro]'&&inIntro?{}:null}:null}});
 const campaignCtx=()=>({lang,campaigns:state.campaigns,characters:state.characters,isCurrent:()=>true,scope:'local',save:()=>saves++,render(){},notify:m=>notices.push(m)});
 return {O,window,state,storage,notices,reports,opened,views,click,campaignCtx,failImport:r=>{importResult=r},get saves(){return saves},get renders(){return renders}};
}
const pc=(id='pc',extra)=>({id,name:'Vega',role:'solo',rank:4,stats:{REF:8,DEX:7,BODY:8,WILL:7},skills:{Handgun:6},hp:50,...(extra?{extra}:{})});

test('the introduction opens by itself only in an empty app',()=>{
 const {O}=setup();
 assert.equal(O.shouldShow({characters:[],campaigns:[]},{open:null,dismissed:false}),true);
 assert.equal(O.shouldShow({characters:[pc()],campaigns:[]},{open:null,dismissed:false}),false,'a player with characters never gets it');
 assert.equal(O.shouldShow({characters:[],campaigns:[{id:'c'}]},{open:null,dismissed:false}),false);
 assert.equal(O.shouldShow({characters:[],campaigns:[],bin:[{id:'b'}]},{open:null,dismissed:false}),false,'a character in the bin is still a returning player');
 assert.equal(O.shouldShow({characters:[],campaigns:[],quarantine:[{}]},{open:null,dismissed:false}),false);
 assert.equal(O.shouldShow({characters:[],campaigns:[]},{open:null,dismissed:true}),false);
 assert.equal(O.shouldShow({characters:[pc()],campaigns:[]},{open:true,dismissed:true}),true,'opened on request');
 assert.equal(O.shouldShow({characters:[],campaigns:[]},{open:false,dismissed:false}),false);
 assert.equal(O.shouldShow(null,{}),false);
});

test('the introduction has four steps in both languages and can be walked back and forth',()=>{
 for(const lang of ['ru','en']){
  const h=setup({lang}),titles=[];
  for(let i=0;i<4;i++){const html=h.O.intro(h.state);assert.match(html,lang==='ru'?new RegExp(`Шаг ${i+1} из 4`):new RegExp(`Step ${i+1} of 4`));titles.push(/<h2[^>]*>([^<]+)</.exec(html)[1]);assert.match(html,/data-ob="skip"/);if(i<3)h.click('next')}
  assert.equal(new Set(titles).size,4);assert.match(h.O.intro(h.state),/data-ob="finish"/);assert.doesNotMatch(h.O.intro(h.state),/data-ob="next"/);
  h.click('next');assert.match(h.O.intro(h.state),/4/,'stays on the last step');
  h.click('back');assert.match(h.O.intro(h.state),lang==='ru'?/Шаг 3 из 4/:/Step 3 of 4/);
  assert.equal(h.O.entry(h.state),'','the way back in is not shown next to the open introduction');
 }
});

test('skipping is remembered and the introduction never opens by itself again',()=>{
 const h=setup();assert.notEqual(h.O.intro(h.state),'');
 h.click('skip');
 assert.equal(h.storage.get('nc-onboarding'),'done');assert.equal(h.O.intro(h.state),'');assert.match(h.O.entry(h.state),/data-ob="reopen"/);
 const again=setup({stored:'done'});assert.equal(again.O.intro(again.state),'','a new visit');assert.match(again.O.entry(again.state),/data-ob="reopen"/);
 again.click('reopen');assert.match(again.O.intro(again.state),/Шаг 1 из 4/,'reachable later from the overview');
 again.click('finish');assert.equal(again.O.intro(again.state),'');
});

test('a player who already has characters gets no introduction, only the way in',()=>{
 const h=setup({characters:[pc()]});
 assert.equal(h.O.intro(h.state),'');assert.equal(h.storage.get('nc-onboarding'),'done','and deleting the characters later does not bring it up');
 h.state.characters=[];assert.equal(h.O.intro(h.state),'');
 assert.match(h.O.entry(h.state),/<details class="ob-entry">/);
});

test('a browser without localStorage still shows and closes the introduction',()=>{
 const window={App:{getState:()=>state,render(){},save(){}}},state={lang:'en',characters:[],campaigns:[]};
 vm.runInNewContext(source('onboarding.js'),{window,Math,Date,globalThis:{}});
 assert.match(window.Onboarding.intro(state),/Step 1 of 4/);
 window.Onboarding.handle({target:{closest:()=>({dataset:{ob:'skip'},closest:()=>null})}});
 assert.equal(window.Onboarding.intro(state),'');
});

test('the sample character is a Streetrat Solo from the Role tables',()=>{
 const w={};const ctx={window:w};vm.createContext(ctx);for(const f of ['rules.js','catalog.js','archetypes.js','onboarding.js'])vm.runInContext(source(f),ctx);
 const template=w.Archetypes.getTemplate('solo'),ru=w.Onboarding.sampleCharacter('ru'),en=w.Onboarding.sampleCharacter('en');
 assert.ok(template.statRows.some(row=>w.Archetypes.ORDER.every((k,i)=>row[i]===ru.stats[k])),'one row of the Solo STAT table');
 assert.deepEqual(plain(ru.skills),Object.fromEntries(template.streetratSkills.map(s=>[s.name,s.level])));
 assert.equal(ru.hp,10+5*Math.ceil((ru.stats.BODY+ru.stats.WILL)/2));assert.equal(ru.humanity,ru.stats.EMP*10);
 for(const c of [ru,en]){assert.equal(c.role,'solo');assert.equal(c.extra.sample,true);assert.equal(w.Onboarding.isSample(c),true);
  for(const weapon of c.extra.weapons){const item=w.CATALOG.find(x=>x.id===weapon.catalogId);assert.ok(item,weapon.catalogId);assert.equal(weapon.damage,item.stats.damage);assert.equal(weapon.skill,item.stats.skill);assert.equal(weapon.capacity,item.stats.magazine);assert.equal(weapon.rof,item.stats.rof);assert.ok(c.skills[weapon.skill]>0)}}
 assert.notEqual(ru.name,en.name);assert.notEqual(ru.notes,en.notes);assert.equal(ru.id,undefined,'the app gives the id');
 assert.equal(w.Onboarding.isSample({extra:{sample:'yes'}}),false);assert.equal(w.Onboarding.findSample([{id:'a'},null,ru]),ru);
});

test('one tap adds the sample character once',()=>{
 const h=setup();h.click('next');assert.match(h.O.intro(h.state),/data-ob="add-sample"/);
 h.click('add-sample',true);
 assert.equal(h.state.characters.length,1);assert.equal(h.state.characters[0].extra.sample,true);
 const html=h.O.intro(h.state);assert.match(html,/Шаг 2 из 4/,'the introduction stays open although a character now exists');assert.match(html,/data-ob="open-sample"/);assert.doesNotMatch(html,/data-ob="add-sample"/);
 h.click('add-sample',true);assert.equal(h.state.characters.length,1,'never twice');
 h.click('open-sample',true);assert.deepEqual(h.opened,[h.state.characters[0].id]);
});

test('a failed write says why and adds nothing',()=>{
 for(const [reason,text] of [['paused',/нельзя менять/],['storage',/места/],['other',/Не удалось/]]){
  const h=setup();h.failImport({ok:false,reason});h.click('add-sample');
  assert.equal(h.state.characters.length,0);assert.match(h.notices.at(-1),text);
  h.click('start-trial');assert.equal(h.state.campaigns.length,0,'no fight without a character');assert.deepEqual(h.views,[]);
 }
});

test('the trial fight is a valid campaign with the character and two book enemies',()=>{
 const h=setup({lang:'en'}),c=h.O.buildTrial('en','pc',{now:1000,campaigns:h.window.Campaigns});
 assert.equal(c.name,'Trial fight');assert.equal(typeof c.id,'string');assert.equal(c.round,1);assert.equal(c.turnIndex,0);assert.deepEqual(plain(c.trial),{version:1});
 assert.equal(c.roster.length,3);assert.deepEqual(plain(c.roster.map(r=>r.kind)),['pc','npc','npc']);assert.equal(c.roster[0].characterId,'pc');
 assert.deepEqual(plain(c.roster.slice(1).map(r=>r.name)),['Boosterganger 1','Boosterganger 2']);
 for(const r of c.roster.slice(1)){assert.equal(r.hp,20);assert.equal(r.maxHp,20);assert.deepEqual(plain(r.sp),{head:4,body:4});assert.equal(r.sourcePage,412)}
 assert.equal(new Set(c.roster.map(r=>r.id)).size,3);assert.equal(h.O.isTrial(c),true);assert.equal(h.O.isTrial({id:'x',roster:[]}),false);assert.equal(h.O.isTrial({trial:[]}),false);
});

test('without the GM module the trial fight still gets two stand-in enemies',()=>{
 for(const h of [setup({templates:[]}),setup({tracker:false})]){
  const c=h.O.buildTrial('ru','pc',{campaigns:h.window.Campaigns});
  assert.deepEqual(plain(c.roster.map(r=>r.kind)),['pc','npc','npc']);assert.deepEqual(plain(c.roster.slice(1).map(r=>r.name)),['Противник 1','Противник 2']);
  for(const r of c.roster.slice(1)){assert.ok(r.hp>0&&r.hp===r.maxHp);assert.ok(Number.isSafeInteger(r.ref))}
 }
});

test('attack and damage rolls follow the dice',()=>{
 const {O}=setup({tracker:false});
 assert.deepEqual(plain(O.rollAttack(14,13,d10(5))),{first:5,extra:0,total:19,hit:true});
 assert.deepEqual(plain(O.rollAttack(3,13,d10(10,4))),{first:10,extra:4,total:17,hit:true},'a 10 adds another d10');
 assert.deepEqual(plain(O.rollAttack(14,13,d10(1,6))),{first:1,extra:6,total:9,hit:false},'a 1 subtracts another d10');
 assert.equal(O.rollAttack(8,13,d10(5)).hit,false,'a tie with the DV is a miss');
 assert.deepEqual(plain(O.rollDamage(4,d6(6,2,6,1))),{rolls:[6,2,6,1],total:15,critical:true});
 assert.equal(O.rollDamage(3,d6(6,5,4)).critical,false);assert.equal(O.rollDamage(0,d6(3)).rolls.length,1);assert.equal(O.rollDamage(99,d6(1)).rolls.length,10);
});

test('the lesson weapon is the first usable one, with the sheet bonus, or a stand-in pistol',()=>{
 const {O,window}=setup({tracker:false});
 const armed=pc('a',{weapons:[{name:'Нож',damage:'особый',skill:'Melee Weapon'},{name:' Очень тяжёлый пистолет ',damage:'4d6',skill:'Handgun',stat:'REF',modifier:1}]});
 assert.deepEqual(plain(O.trialWeapon(armed,'ru')),{name:'Очень тяжёлый пистолет',dice:4,damage:'4d6',base:15});
 assert.deepEqual(plain(O.trialWeapon(pc('b'),'en')),{name:'Heavy Pistol (stand-in)',dice:3,damage:'3d6',base:14});
 assert.equal(O.trialWeapon(pc('c',{weapons:'broken'}),'en').dice,3);
 window.App.checkBonus=()=>{throw Error('x')};assert.equal(O.trialWeapon(armed,'ru').base,15,'falls back to STAT + skill');
});

// Drives the real tracker the way the page does.
function fight(lang='ru'){
 const h=setup({lang,characters:[pc('pc',{weapons:[{name:'VHP',damage:'4d6',skill:'Handgun',stat:'REF',modifier:0}]})]});
 const c=h.O.buildTrial(lang,'pc',{campaigns:h.window.Campaigns});h.state.campaigns.unshift(c);
 const press=(action,button={})=>h.window.Campaigns.handle({type:'click',target:{closest:s=>s==='[data-campaign-action]'?{dataset:{campaignAction:action,...button.dataset},closest:button.closest||(()=>null)}:null}},h.campaignCtx());
 press('open',{dataset:{id:c.id}});
 const step=()=>h.O.trialStep(c,h.state.characters),hint=()=>h.O.trialHint(c,h.state.characters,lang);
 const setInitiative=(...values)=>c.roster.forEach((r,i)=>{r.initiative=values[i]});
 const damage=(id,amount)=>press('damage',{dataset:{id},closest:s=>s==='.combatant'?{querySelector:q=>q==='[data-camp-dmg]'?{value:String(amount)}:q==='[data-camp-dmg-loc]'?{value:'body'}:null}:null});
 return {...h,c,press,step,hint,setInitiative,damage};
}

test('the hints follow one round: initiative, attack, damage, next turn',()=>{
 const f=fight();
 assert.equal(f.step(),'initiative');assert.match(f.hint(),/data-ob-step="initiative"/);assert.match(f.hint(),/шаг 1 из 4/);
 f.press('roll-all');assert.notEqual(f.step(),'initiative','the real roll moves the lesson on');
 f.setInitiative(5,20,10);f.c.turnIndex=0; // an enemy goes first
 assert.equal(f.step(),'wait');assert.match(f.hint(),/Бустергангер 1/);
 f.press('next');assert.equal(f.step(),'wait');assert.match(f.hint(),/Бустергангер 2/);
 f.press('next');assert.equal(f.step(),'attack');assert.match(f.hint(),/data-ob="trial-attack"/);assert.match(f.hint(),/прибавляется 14/);
 // A miss keeps the step and says so.
 f.c.trial.attack={total:9,hit:false,target:f.c.roster[1].id,hpBefore:20,turnIndex:2,round:1};
 assert.equal(f.step(),'attack');assert.match(f.hint(),/мимо/);
 // A hit asks for the damage to be applied in the tracker.
 const target=f.c.roster[1];f.c.trial.attack={total:19,hit:true,target:target.id,hpBefore:20,turnIndex:2,round:1,dice:'4d6',damage:14,critical:true};
 assert.equal(f.step(),'damage');assert.match(f.hint(),/шаг 3 из 4/);assert.match(f.hint(),/14/);assert.match(f.hint(),/стр\. 187/);
 f.damage(target.id,3);assert.equal(target.hp,20,'stopped by armor');assert.equal(f.step(),'damage','armor stopped it: still to do');
 f.damage(target.id,14);assert.equal(target.hp,10);assert.deepEqual(plain(target.sp),{head:4,body:3});
 assert.equal(f.step(),'next');assert.match(f.hint(),/осталось 10 HP/);
 f.press('next');assert.equal(f.step(),'done');assert.equal(f.c.round,2);
 assert.match(f.hint(),/data-ob="trial-remove"/);assert.match(f.hint(),/data-ob="trial-keep"/);assert.doesNotMatch(f.hint(),/data-ob="trial-hide"/);
});

test('when the character rolls highest the attack comes straight after initiative',()=>{
 const f=fight('en');f.setInitiative(30,4,2);
 assert.equal(f.step(),'attack');assert.match(f.hint(),/step 2 of 4/);assert.match(f.hint(),/Target: Boosterganger 1/);
});

test('hints are escaped, optional and safe on damaged data',()=>{
 const f=fight('en');f.state.characters[0].name='<b>"V"</b>';f.setInitiative(30,4,2);
 assert.doesNotMatch(f.hint(),/<b>"V"/);assert.match(f.hint(),/&lt;b&gt;/);
 assert.equal(f.O.trialHint({id:'x',name:'Job',roster:[]},[],'en'),'','an ordinary campaign has no hints');assert.equal(f.O.trialStep(null,[]),null);
 for(const attack of ['x',[],{total:'19',hit:true},{hit:true},null]){f.c.trial.attack=attack;assert.equal(f.step(),'attack')}
 f.c.trial.attack={total:19,hit:true,target:'gone',hpBefore:20};assert.equal(f.step(),'done','a record without a turn ends the lesson instead of trapping it');
 delete f.c.trial.attack;f.c.roster=f.c.roster.filter(r=>r.kind==='pc');assert.equal(f.step(),'broken');assert.match(f.hint(),/data-ob="trial-remove"/);
 f.c.roster=[];assert.equal(f.step(),'broken');
 f.c.trial.done=true;assert.equal(f.step(),'done');
 f.c.trial='yes';assert.equal(f.step(),null);
});

test('starting the trial fight adds the sample character when there is none and never makes a second fight',()=>{
 const h=setup();h.click('start-trial');
 assert.equal(h.state.characters.length,1);assert.equal(h.state.campaigns.length,1);assert.deepEqual(h.views,['campaigns']);
 const c=h.state.campaigns[0];assert.equal(c.roster[0].characterId,h.state.characters[0].id);assert.equal(c.roster.filter(r=>r.kind==='npc').length,2);
 assert.equal(h.storage.get('nc-onboarding'),'done','the introduction is over once the fight starts');assert.ok(h.saves>=1);
 h.click('start-trial');assert.equal(h.state.campaigns.length,1);assert.equal(h.state.characters.length,1);
});

test('a player with characters fights with their own first character',()=>{
 const h=setup({characters:[pc('mine'),pc('other')]});h.click('start-trial');
 assert.equal(h.state.characters.length,2,'no sample is added');assert.equal(h.state.campaigns[0].roster[0].characterId,'mine');
 const withSample=setup({characters:[pc('mine'),pc('s',{sample:true})]});withSample.click('start-trial');
 assert.equal(withSample.state.campaigns[0].roster[0].characterId,'s','the sample is preferred when it exists');
});

test('unknown clicks are left to the app',()=>{
 const h=setup();
 assert.equal(h.O.handle({target:{closest:()=>null}}),false);assert.equal(h.click('something-else'),false);assert.equal(h.O.handle(null),false);
 assert.equal(h.click('trial-attack'),true,'a trial action away from the tracker does nothing');assert.equal(h.saves,0);
});

// ---- With the real app.js: the sample and the trial fight pass the app's own checks and survive a backup ----
function appHarness(archive){
 const saved=[],events={};let pending=null,uid=0;
 const adapter={stateLabel:()=>'',start(){},canEdit:()=>true,getScope:()=>'local',hasQueued:()=>false,save(s){pending=plain(s);saved.push(pending);return Promise.resolve({ok:true})},flush(){pending=null;return {ok:true}}};
 const nodes={'#app':{innerHTML:'',setAttribute(){},addEventListener(t,fn){events[t]=fn}},'#app-notice':{set textContent(v){},classList:{add(){},remove(){}}}};
 const w={ROLES:[{id:'solo',name:{en:'Solo',ru:'Соло'},description:{en:'',ru:''}}],GMTools:{NPC_TEMPLATES:[booster],initial:()=>null,validWorkspace:()=>true},CombatTools:{handle:()=>false},Book:{handle:()=>false},NetTools:{setScope(){},validArchitectures:Array.isArray},RoleTools:{render:()=>'',handle:()=>({handled:false}),refresh(){}},LocalStore:{create:()=>adapter},confirm:()=>true,scrollTo(){}};
 const store=new Map(archive?[['nightcity-red-v1',JSON.stringify({campaigns:[],lang:'en',...archive})]]:[]);
 const ctx={window:w,document:{querySelector:s=>nodes[s]||null,documentElement:{},title:''},localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v))},globalThis:{crypto:{randomUUID:()=>'id-'+(++uid)}},setTimeout:()=>0,clearTimeout(){},confirm:()=>true,console,Math,Date,JSON,Set,Map,Number,String,Array,Object,Promise,WeakMap};
 vm.createContext(ctx);for(const f of ['archetypes.js','character-extra.js','equipment-tools.js','campaigns.js','onboarding.js'])vm.runInContext(source(f),ctx);
 vm.runInContext(source('app.js')+'\nrender=()=>{};\nwindow.qa={state:()=>state,valid:validateSnapshot,snapshot:snapshotAppState,salvage:salvageArchive,overview};',ctx);
 const click=action=>w.Onboarding.handle({type:'click',target:{closest:s=>s==='[data-ob]'?{dataset:{ob:action},closest:()=>null}:null}});
 return {w,O:w.Onboarding,qa:w.qa,state:()=>w.qa.state(),saved,click,store};
}

test('in the real app the sample character and the trial fight are valid data and survive a backup',()=>{
 const h=appHarness();h.click('start-trial');
 const state=h.state();assert.equal(state.characters.length,1);assert.equal(state.campaigns.length,1);
 const sample=state.characters[0];assert.equal(sample.extra.sample,true);assert.equal(sample.name,'Вега');assert.equal(typeof sample.id,'string');assert.equal(sample.extra.weapons.length,2);
 const snapshot=plain(h.qa.snapshot());assert.equal(h.qa.valid(snapshot),true,'the store accepts it');
 assert.ok(h.saved.length>=2,'both the character and the fight were written');
 // A lesson in the middle of the attack step goes into the backup too.
 const c=state.campaigns[0];c.roster.forEach((r,i)=>{r.initiative=30-i});c.trial.attack={total:19,hit:true,target:c.roster[1].id,hpBefore:20,turnIndex:0,round:1,dice:'4d6',damage:14,critical:false};
 const backup=JSON.parse(JSON.stringify(h.qa.snapshot())),read=h.qa.salvage(backup);
 assert.equal(read.items.length,0,'nothing is set aside on import');
 assert.equal(h.qa.valid(plain(read.snapshot)),true);
 assert.equal(h.O.isSample(read.snapshot.characters[0]),true);assert.deepEqual(plain(read.snapshot.campaigns[0].trial),plain(c.trial));
 assert.equal(h.O.trialStep(read.snapshot.campaigns[0],read.snapshot.characters),'damage','the lesson continues where it stopped');
 // The same data opens as a saved archive on the next visit.
 const again=appHarness(backup);assert.equal(again.state().characters.length,1);assert.equal(again.state().campaigns[0].trial.attack.damage,14);
 assert.equal(again.O.intro(again.state()),'','and brings no introduction');
});

test('the overview shows the introduction to a new player and only the way in to everyone else',()=>{
 const fresh=appHarness();
 assert.match(fresh.qa.overview(),/data-ob-intro/);assert.doesNotMatch(fresh.qa.overview(),/class="ob-entry"/);
 fresh.click('skip');assert.doesNotMatch(fresh.qa.overview(),/data-ob-intro/);assert.match(fresh.qa.overview(),/class="ob-entry"/);
 const old=appHarness({characters:[{id:'a',name:'Old',role:'solo',rank:4,stats:{INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{},hp:45,humanity:60}]});
 assert.doesNotMatch(old.qa.overview(),/data-ob-intro/);assert.match(old.qa.overview(),/class="ob-entry"/);
});

test('the tracker draws the hints inside a trial fight and nowhere else',()=>{
 const h=setup({lang:'en',characters:[pc('pc')]}),c=h.O.buildTrial('en','pc',{campaigns:h.window.Campaigns}),plainCampaign={id:'job',name:'Job',notes:'',round:1,turnIndex:0,roster:[]};
 h.state.campaigns.push(c,plainCampaign);
 const open=id=>h.window.Campaigns.handle({type:'click',target:{closest:s=>s==='[data-campaign-action]'?{dataset:{campaignAction:'open',id}}:null}},h.campaignCtx());
 const draw=()=>h.window.Campaigns.render(h.state.campaigns,h.state.characters,'en',null);
 open(c.id);const html=draw();assert.match(html,/data-ob-trial data-ob-step="initiative"/);assert.ok(html.indexOf('data-ob-trial')<html.indexOf('class="campaign-turnbar"'),'right above the turn buttons');
 open('job');assert.doesNotMatch(draw(),/data-ob-trial/);
});

test('the sample character carries its spare rounds and can unload and reload them',()=>{
 const w={};const ctx={window:w,console,Math,Date,globalThis:{crypto:{randomUUID:()=>'x'}}};vm.createContext(ctx);for(const f of ['rules.js','catalog.js','catalog-extra.js','archetypes.js','equipment-tools.js','reload-tools.js','onboarding.js'])vm.runInContext(source(f),ctx);
 w.ReloadTools.setScope('s');
 for(const lang of ['ru','en']){
  const c=plain(w.Onboarding.sampleCharacter(lang));c.id='sample-1';assert.equal(c.extra.startingPack.method,'streetrat');assert.equal(c.extra.startingPack.confirmed,true);assert.equal(c.extra.startingPack.humanityLossApplied,undefined);
  assert.equal(JSON.stringify(c.extra.items.map(x=>x.quantity)),'[22,45]');
  for(const weapon of c.extra.weapons){assert.equal(weapon.ammo,weapon.capacity);assert.equal(weapon.lastReload.units,weapon.capacity);assert.ok(c.extra.items.some(i=>i.id===weapon.lastReload.ammoRecordId));assert.equal(w.ReloadTools.validReceipt(weapon.lastReload),true);
   const q=w.ReloadTools.quoteUnload(c,weapon.id,lang);assert.equal(q.ok,true,weapon.id)}
  const rifle=c.extra.weapons.find(x=>x.id==='sample-assault-rifle');rifle.ammo=10;
  const plan=w.ReloadTools.quickPlan(c,rifle.id,lang);assert.equal(plan.ok,true);
 }
});
