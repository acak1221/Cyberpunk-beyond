const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=f=>fs.readFileSync(__dirname+'/../site/'+f,'utf8');
function load(){const window={};const ctx={window,globalThis:{window},Math,Number,String,Set,Array,Object};ctx.globalThis.window=window;vm.runInNewContext(source('combat-tools.js'),{window,document:{addEventListener(){}},Math,Number});vm.runInNewContext(source('effects.js'),ctx);return {E:window.Effects,INJ:window.CombatTools.INJURIES}}
const hero=entries=>({stats:{MOVE:6,BODY:8},extra:{criticalInjuries:{version:1,entries:entries.map(([location,score,status='active'],i)=>({id:'i'+i,location,score,status,detail:''}))}}});
const plain=x=>JSON.parse(JSON.stringify(x));

test('the effect numbers agree with the injury table the players read (pp. 187–188)',()=>{
 const {E,INJ}=load();
 for(const location of ['body','head'])for(let score=2;score<=12;score++){
  const text=INJ[location][score-2].effect.en,e=E.INJURY[location][score];assert.ok(e,`${location} ${score}`);
  const move=/MOVE −(\d)/.exec(text);assert.equal(e.move||0,move?-Number(move[1]):0,`${location} ${score} MOVE: ${text}`);
  assert.equal(e.death||0,/Death Save Penalty \+1/i.test(text)?1:0,`${location} ${score} Death Save: ${text}`);
  const all=/−(\d) to all Actions/.exec(text);assert.equal(e.all||0,all?-Number(all[1]):0,`${location} ${score} all Actions: ${text}`);
  const melee=/−(\d) to melee attacks/.exec(text);assert.equal(e.melee||0,melee?-Number(melee[1]):0,`${location} ${score} melee: ${text}`);
  const ranged=/−(\d) ranged attacks/.exec(text);assert.equal(e.ranged||0,ranged?-Number(ranged[1]):0,`${location} ${score} ranged: ${text}`);
 }
});

test('active injuries add up; a Quick Fix or healing takes the effect away',()=>{
 const {E}=load();
 const c=hero([['head',5],['head',3],['body',8],['body',9],['head',4]]);
 assert.deepEqual(plain({...E.collect(c),sources:undefined}),{all:-4,melee:-2,ranged:-2,move:-4,death:1,initiative:0,ignoreSerious:false,skills:{},stats:{}});
 assert.equal(E.checkModifier(c),-4,'Concussion and Brain Injury: −2 each to all Actions');
 assert.equal(E.checkModifier(c,'melee'),-6,'plus Torn Muscle');assert.equal(E.checkModifier(c,'ranged'),-6,'plus Damaged Eye');
 const treated=hero([['head',5,'fixed'],['head',3,'healed'],['body',8,'fixed']]);
 assert.equal(E.checkModifier(treated),0);assert.equal(E.move(treated,6),6);assert.equal(E.collect(treated).death,0);
});

test('MOVE penalties stack but never go under 1',()=>{
 const {E}=load();
 assert.equal(E.move(hero([['body',8]]),6),2);assert.equal(E.move(hero([['body',12]]),6),1);assert.equal(E.move(hero([['body',4],['body',8],['body',12]]),8),1);
 assert.equal(E.move(hero([]),6),6);assert.equal(E.move(hero([['head',8]]),6),6,'Whiplash does not slow anyone');
});

test('an attack is melee or ranged by its skill',()=>{
 const {E}=load();
 for(const s of ['Handgun','Shoulder Arms','Heavy Weapons','Archery','Autofire'])assert.equal(E.attackKind(s),'ranged',s);
 for(const s of ['Brawling','Melee Weapon','Martial Arts','Martial Arts (Karate)'])assert.equal(E.attackKind(s),'melee',s);
 for(const s of ['Persuasion','',undefined])assert.equal(E.attackKind(s),'');
});

test('damaged or missing records are ignored, not guessed at',()=>{
 const {E}=load();
 for(const c of [null,{},{extra:null},{extra:{criticalInjuries:null}},{extra:{criticalInjuries:{version:2,entries:[{location:'head',score:5,status:'active'}]}}},{extra:{criticalInjuries:{version:1,entries:[null,5,{location:'leg',score:5,status:'active'},{location:'head',score:13,status:'active'},{location:'head',score:5}]}}}]){assert.equal(E.checkModifier(c),0);assert.deepEqual(plain(E.lines(c,'ru')),[])}
});

test('the sheet lists each effect with its name, and situational ones as reminders',()=>{
 const {E}=load();
 const ru=E.lines(hero([['head',5],['body',12],['head',6]]),'ru'),en=E.lines(hero([['head',2]]),'en');
 assert.deepEqual(plain(ru),[{name:'Сотрясение',text:'−2 ко всем действиям'},{name:'Потеря ноги',text:'MOVE −6; базовый штраф Death Save +1; Уклоняться нельзя'},{name:'Сломанная челюсть',text:'−4 к действиям, требующим речи'}]);
 assert.deepEqual(plain(en),[{name:'Lost Eye',text:'−4 to ranged attacks; Base Death Save Penalty +1; −4 to Perception by sight'}]);
});

test('rolls, buttons, MOVE and the Death Save hint all read the same layer',()=>{
 const app=source('app.js'),sheet=source('character-extra.js');
 assert.match(source('index.html'),/<script src="combat-tools\.js"><\/script><script src="effects\.js">/);
 assert.match(app,/return base\+\(Number\(level\)\|\|0\)\+woundPenalty\(c\)\+effectModifier\(c,kind,skill,stat\)\+/,'the number on a button');
 assert.match(app,/woundPenalty\(c\)\)\+effectModifier\(c,'',s\[0\],s\[2\]\)\+modifier\+spent/,'a skill check');
 assert.match(app,/woundPenalty\(c\)\)\+effectModifier\(c,q\.attackKind,q\.skillKey,q\.statKey\)/,'checks and attacks from the sheet tools');
 assert.match(app,/mod=\(wounds&&c\?woundPenalty\(c\)\+effectModifier\(c\):0\)/,'rolls made through the bridge');
 assert.match(app,/String\(effectMove\(c,state==='mortal'\?Math\.max\(1,move-6\):move\)\)/);
 assert.match(app,/data-action="death-base-fix"/);assert.match(sheet,/attackKind:window\.Effects\?\.attackKind\?\.\(skill\)\|\|''/);
});

const withCyber=(ids,extra={})=>({stats:{MOVE:6,BODY:8,REF:7},extra:{equipment:{installs:ids.map((id,i)=>typeof id==='string'?{id:'x'+i,catalogId:id}:id)},...extra}});

test('installed cyberware: only always-on effects are applied, and twice the same implant counts once',()=>{
 const {E}=load();
 const c=withCyber(['cyberware-kerenzikov','cyberware-kerenzikov','cyberware-toxin-binders','cyberware-voice-stress-analyzer','cyberware-techscanner-implant','cyberware-pain-editor']);
 assert.equal(E.initiative(c),2,'Kerenzikov: +2 Initiative, speedware does not stack');assert.equal(E.ignoresSerious(c),true);
 assert.equal(E.checkModifier(c,'','Resist Torture/Drugs'),2);assert.equal(E.checkModifier(c,'','Human Perception'),2);assert.equal(E.checkModifier(c,'','Interrogation'),2);
 for(const k of ['Basic Tech','Cybertech','Land Vehicle Tech','Sea Vehicle Tech','Air Vehicle Tech','Electronics/Security Tech','Weaponstech'])assert.equal(E.checkModifier(c,'',k),2,k);
 assert.equal(E.checkModifier(c,'','Perception'),0);assert.equal(E.checkModifier(c,'ranged','Handgun'),0);assert.equal(E.checkModifier(c),0,'no skill named, no skill bonus');
});

test('removed implants and unknown records do nothing',()=>{
 const {E}=load();
 const c=withCyber([{id:'a',catalogId:'cyberware-kerenzikov',removedAt:'2045-01-01'},{id:'b',catalogId:'cyberware-unknown'},null,{id:'c'},{id:'d',catalogId:5}]);
 assert.equal(E.initiative(c),0);assert.deepEqual(plain(E.lines(c,'ru')),[]);
 assert.equal(E.initiative({extra:{equipment:{installs:'oops'}}}),0);assert.equal(E.initiative(null),0);
});

test('situational implants and those that change the sheet are reminders only',()=>{
 const {E}=load();
 const c=withCyber(['cyberware-sandevistan','cyberware-targeting-scope','cyberware-subdermal-armor','cyberware-grafted-muscle-and-bone-lace']);
 assert.equal(E.initiative(c),0,'Sandevistan needs to be switched on');assert.equal(E.checkModifier(c,'ranged','Handgun'),0,'Targeting Scope is for Aimed Shots only');
 const text=E.lines(c,'ru').map(x=>x.text).join(' | ');
 assert.match(text,/\+3 к инициативе на минуту/);assert.match(text,/\+1 к прицельным выстрелам/);assert.match(text,/SP 11 на голове и теле/);assert.match(text,/BODY \+2, но не выше 10/);
});

test('injuries and cyberware add up in one total',()=>{
 const {E}=load();
 const c=withCyber(['cyberware-medscanner-implant','cyberware-kerenzikov'],{criticalInjuries:{version:1,entries:[{id:'i',location:'head',score:5,status:'active',detail:''}]}});
 assert.equal(E.checkModifier(c,'','First Aid'),0,'+2 Medscanner − 2 Concussion');assert.equal(E.checkModifier(c,'','Paramedic'),0);assert.equal(E.checkModifier(c,'','Stealth'),-2);assert.equal(E.initiative(c),2);
 assert.equal(E.lines(c,'en').length,3);
});

test('the sheet, the tracker and the wound penalty read the cyberware effects',()=>{
 const app=source('app.js');
 assert.match(app,/soloBonus\(c,'initiative'\)\+effectInitiative\(c\)\}/,'the number the tracker and the quick button use');
 assert.match(app,/speed=effectInitiative\(c\),total=effectiveRef\+first\+modifier\+bonus\+speed,/,'the initiative roll on the sheet');
 assert.match(app,/Math\.ceil\(hpMax\(c\)\/2\)\?\(noSerious\(c\)\?0:-2\):0;/,'Pain Editor removes only the Seriously Wounded penalty');
 assert.match(app,/skillTotal\(c,s\)\{const n=checkBonus\(c,s\[2\],c\?\.skills\?\.\[s\[0\]\],'',s\[0\]\)/);
});

const drug=(records)=>({stats:{REF:7,INT:6},extra:{streetDrugs:{version:1,records}}});
const dose=(over={})=>({status:'active',remainingHours:3,addicted:false,yearVulnerability:false,...over});
const clean=(over={})=>({status:'resolved',remainingHours:0,addicted:false,yearVulnerability:false,...over});

test('a street drug acts while its Primary Effect lasts (pp. 227–229)',()=>{
 const {E}=load();
 assert.equal(E.ignoresSerious(drug({'black-lace':dose()})),true,'Black Lace: no Seriously Wounded penalty');
 assert.equal(E.checkModifier(drug({boost:dose()}),'','Education','INT'),2,'Boost: INT +2');assert.equal(E.checkModifier(drug({boost:dose()}),'','Evasion','DEX'),0);
 assert.equal(E.checkModifier(drug({synthcoke:dose()}),'ranged','Handgun','REF'),1,'Synthcoke: REF +1');assert.equal(E.initiative(drug({synthcoke:dose()})),1,'and Initiative with it');
 const smash=drug({smash:dose()});for(const k of ['Dance','Contortionist','Conversation','Human Perception','Persuasion','Acting'])assert.equal(E.checkModifier(smash,'',k,'COOL'),2,k);assert.equal(E.checkModifier(smash,'','Stealth','DEX'),0);
 for(const key of ['black-lace','boost','smash','synthcoke'])assert.equal(E.lines(drug({[key]:clean()}),'ru').length,0,key+': nothing once it has worn off');
});

test('an addiction acts on its own, and some only between doses',()=>{
 const {E}=load();
 assert.equal(E.checkModifier(drug({boost:clean({addicted:true})}),'','Education','INT'),-2);assert.equal(E.checkModifier(drug({boost:dose({addicted:true})}),'','Education','INT'),0,'Boost: +2 from the dose, −2 from the addiction');
 assert.equal(E.checkModifier(drug({smash:clean({addicted:true})}),'','Persuasion','COOL'),-2);assert.equal(E.checkModifier(drug({smash:dose({addicted:true})}),'','Persuasion','COOL'),0);
 assert.equal(E.checkModifier(drug({'black-lace':clean({addicted:true})}),'ranged','Handgun','REF'),-2,'Black Lace: REF −2 between doses');assert.equal(E.checkModifier(drug({'black-lace':dose({addicted:true})}),'ranged','Handgun','REF'),0,'but not under the Primary Effect');
 assert.equal(E.checkModifier(drug({synthcoke:clean({addicted:true})}),'','Stealth','REF'),-2);assert.equal(E.checkModifier(drug({synthcoke:dose({addicted:true})}),'','Stealth','REF'),1);
 assert.equal(E.initiative(drug({'black-lace':clean({addicted:true}),synthcoke:clean({addicted:true})})),-4);
 assert.equal(E.checkModifier(drug({'black-lace':{status:'awaiting',remainingHours:0,addicted:true,yearVulnerability:false}}),'','Stealth','REF'),-2,'waiting for the Secondary Effect check counts as between doses');
});

test('Blue Glass is a reminder, and the dose turns into protection once addicted',()=>{
 const {E}=load();
 assert.match(E.lines(drug({'blue-glass':dose()}),'ru')[0].text,/Приступы по слову ведущего/);
 assert.equal(E.lines(drug({'blue-glass':dose({addicted:true})}),'ru').length,0,'addicted and dosed: no flashouts');
 assert.match(E.lines(drug({'blue-glass':clean({addicted:true})}),'en')[0].name,/Blue Glass \(addiction, no dose\)/);
 assert.equal(E.checkModifier(drug({'blue-glass':dose()}),'','Stealth','DEX'),0);
});

test('drug bonuses add to cyberware ones, and damaged drug records are ignored',()=>{
 const {E}=load();
 const c={...drug({smash:dose()}),extra:{streetDrugs:{version:1,records:{smash:dose()}},equipment:{installs:[{id:'a',catalogId:'cyberware-voice-stress-analyzer'}]}}};
 assert.equal(E.checkModifier(c,'','Human Perception','EMP'),4,'+2 implant, +2 Smash');assert.equal(E.checkModifier(c,'','Interrogation','COOL'),2);
 for(const bad of [{version:2,records:{boost:dose()}},{version:1,records:null},{version:1,records:{boost:null,smash:5,unknown:dose()}},null])assert.equal(E.checkModifier({extra:{streetDrugs:bad}},'','Education','INT'),0);
 assert.equal(E.checkModifier(drug({boost:{status:'active',remainingHours:0,addicted:false}}),'','Education','INT'),0,'an active record with no hours left is not in effect');
});
