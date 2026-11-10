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
 assert.deepEqual(plain({...E.collect(c),sources:undefined}),{all:-4,melee:-2,ranged:-2,move:-4,death:1});
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
 assert.match(app,/return base\+\(Number\(level\)\|\|0\)\+woundPenalty\(c\)\+effectModifier\(c,kind\)\+/,'the number on a button');
 assert.match(app,/woundPenalty\(c\)\)\+effectModifier\(c\)\+modifier\+spent/,'a skill check');
 assert.match(app,/woundPenalty\(c\)\)\+effectModifier\(c,q\.attackKind\)/,'checks and attacks from the sheet tools');
 assert.match(app,/mod=wounds&&c\?woundPenalty\(c\)\+effectModifier\(c\):0/,'rolls made through the bridge');
 assert.match(app,/String\(effectMove\(c,state==='mortal'\?Math\.max\(1,move-6\):move\)\)/);
 assert.match(app,/data-action="death-base-fix"/);assert.match(sheet,/attackKind:window\.Effects\?\.attackKind\?\.\(skill\)\|\|''/);
});
