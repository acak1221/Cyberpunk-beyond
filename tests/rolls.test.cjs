// The shared door for dice the tools roll themselves: what they rolled reaches the history of rolls and the room.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=n=>fs.readFileSync(__dirname+'/../site/'+n,'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
function load({app=true,lang='ru',modules=[]}={}){
 const sent=[],window={};
 if(app)window.App={report:(label,detail,total,faces)=>{sent.push(plain({label,detail,total,faces}));return true},lang:()=>lang};
 const ctx={window,Math:Object.create(Math),Number,String,Array,Object,JSON,Set,Map,WeakMap,Date,globalThis:{}};vm.createContext(ctx);
 for(const f of ['rolls.js',...modules])vm.runInContext(source(f),ctx,{filename:f});
 return {R:window.Rolls,window,sent,ctx};
}
const seq=(...values)=>{let i=0;return ()=>values[i++]};

test('d10 follows the critical rule: a 10 adds one more die, a 1 subtracts one, nothing explodes twice',()=>{
 const {R}=load();
 assert.deepEqual(plain(R.d10(seq(0.5))),{first:6,extra:0,value:6});
 assert.deepEqual(plain(R.d10(seq(0.95,0.95))),{first:10,extra:10,value:20});
 assert.deepEqual(plain(R.d10(seq(0.0,0.7))),{first:1,extra:8,value:-7});
 let calls=0;R.d10(()=>{calls++;return 0.95});assert.equal(calls,2);
});

test('a random source that misbehaves gives null, never a wrong face',()=>{
 const {R}=load();
 for(const bad of [1,-0.1,NaN,'0.5',undefined])assert.equal(R.d(6,()=>bad),null,String(bad));
 assert.equal(R.d10(seq(0.95,2)),null);assert.equal(R.d(6,()=>0.999),6);assert.equal(R.d(6,()=>0),1);
});

test('a check is reported with the die, the rest of the sum and the verdict against the DV',()=>{
 const {R,sent}=load();
 assert.equal(R.check('Ремонт · Дрон',{die:7,extra:0,total:19,dv:15,success:true},'ru'),true);
 assert.deepEqual(sent[0],{label:'Ремонт · Дрон',detail:'1d10 7 + 12 = 19 > DV 15 — успех',total:19,faces:[{v:7,s:10}]});
 R.check('Repair',{die:3,extra:0,total:15,dv:15,success:false},'en');
 assert.equal(sent[1].detail,'1d10 3 + 12 = 15 ≤ DV 15 — failure');
});

test('a tie is a failure when the tool gave only the DV',()=>{
 const {R,sent}=load();R.check('X',{first:5,total:13,dv:13},'en');R.check('X',{first:6,total:14,dv:13},'en');
 assert.match(sent[0].detail,/≤ DV 13 — failure$/);assert.match(sent[1].detail,/> DV 13 — success$/);
});

test('critical dice are shown and both faces are sent',()=>{
 const {R,sent}=load();
 R.check('A',{one:10,extra:4,total:24,dv:20},'en');R.check('B',{first:1,extra:6,total:3},'en');
 assert.equal(sent[0].detail,'1d10 10 + 4 + 10 = 24 > DV 20 — success');assert.deepEqual(sent[0].faces,[{v:10,s:10},{v:4,s:10}]);
 assert.equal(sent[1].detail,'1d10 1 − 6 + 8 = 3');assert.deepEqual(sent[1].faces,[{v:1,s:10},{v:6,s:10}]);
});

test('a negative rest of the sum is written with a minus',()=>{
 const {R,sent}=load();R.check('A',{first:4,total:1},'en');assert.equal(sent[0].detail,'1d10 4 − 3 = 1');
});

test('a check without a DV has no verdict',()=>{
 const {R,sent}=load();R.check('Credibility',{first:6,extra:0,total:12},'ru');assert.equal(sent[0].detail,'1d10 6 + 6 = 12');
});

test('broken results are not reported',()=>{
 const {R,sent}=load();
 for(const bad of [null,undefined,'x',{},{die:0,total:5},{die:11,total:5},{die:5},{die:5,total:'abc'},{die:5,extra:11,total:9}])assert.equal(R.check('X',bad,'ru'),false,JSON.stringify(bad));
 assert.equal(R.check('',{die:5,total:9},'ru'),false);assert.equal(R.check('   ',{die:5,total:9},'ru'),false);
 assert.equal(sent.length,0);
});

test('an opposed roll shows both sides; the first side wins only with the higher total',()=>{
 const {R,sent}=load();
 R.opposed('Захват',{first:7,extra:0,total:15},{first:3,extra:0,total:11},true,'ru');
 assert.deepEqual(sent[0],{label:'Захват',detail:'1d10 7 + 8 = 15 против 1d10 3 + 8 = 11 — успех',total:15,faces:[{v:7,s:10}]});
 R.opposed('Grab',{first:5,extra:0,total:13},{first:5,extra:0,total:13},undefined,'en');
 assert.match(sent[1].detail,/ vs .* — failure$/);
});

test('an opposed roll against a fixed number is an ordinary check against that DV',()=>{
 const {R,sent}=load();R.opposed('Attack',{first:8,extra:null,total:20},15,true,'en');
 assert.equal(sent[0].detail,'1d10 8 + 12 = 20 > DV 15 — success');
});

test('added dice: the faces, a bonus, the total and a note',()=>{
 const {R,sent}=load();
 R.sum('Урон',[3,5,6],6);assert.deepEqual(sent[0],{label:'Урон',detail:'3d6: 3 + 5 + 6 = 14',total:14,faces:[{v:3,s:6},{v:5,s:6},{v:6,s:6}]});
 R.sum('Damage',[2,2],6,{bonus:-1,note:'3 after armor'});assert.equal(sent[1].detail,'2d6: 2 + 2 − 1 = 3 · 3 after armor');assert.equal(sent[1].total,3);
 R.sum('Table',[4],6);assert.equal(sent[2].detail,'1d6: 4');
 R.sum('Hit',[6,6],6,{total:12});assert.equal(sent[3].total,12);
});

test('added dice with a wrong face are not reported',()=>{
 const {R,sent}=load();
 for(const bad of [[],[0],[7],[3,'x'],null,'33'])assert.equal(R.sum('X',bad,6),false,JSON.stringify(bad));
 assert.equal(sent.length,0);
});

test('without a language the app language is used',()=>{
 const en=load({lang:'en'});en.R.check('X',{die:5,total:20,dv:9});assert.match(en.sent[0].detail,/success$/);
 const ru=load({lang:'ru'});ru.R.check('X',{die:5,total:20,dv:9});assert.match(ru.sent[0].detail,/успех$/);
});

test('without the app every call is a quiet no-op',()=>{
 const {R}=load({app:false});
 assert.equal(R.check('X',{die:5,total:9}),false);assert.equal(R.sum('X',[1],6),false);assert.equal(R.opposed('X',{first:5,total:9},{first:4,total:8}),false);assert.equal(R.report('X','d',1),false);
});

test('an app that throws does not break the tool',()=>{
 const {R,window}=load();window.App.report=()=>{throw new Error('no')};
 assert.equal(R.check('X',{die:5,total:9},'ru'),false);
});

test('labels are trimmed to one line',()=>{
 const {R,sent}=load();R.report('  Ремонт \n  Дрон ','d',3);assert.equal(sent[0].label,'Ремонт Дрон');
});

// --- the tools hand their rolls over

test('hazards: catching a ledge is reported with DV 15',()=>{
 const {window,sent,ctx}=load({lang:'en',modules:['hazard-tools.js']});ctx.Math.random=()=>0.5;
 const values={'[data-hz-ledge-situation]':{value:'edge'},'[data-hz-ledge-dex]':{value:'6'},'[data-hz-ledge-athletics]':{value:'4'},'[data-hz-ledge-mod]':{value:'0'}},outputs={},root={querySelector(s){return values[s]||(outputs[s]??={textContent:''})}},button={dataset:{hzAction:'ledge'},closest(){return root}};
 window.HazardTools.handle({type:'click',target:{closest(){return button}}},'en');
 assert.deepEqual(sent,[{label:'Catch a ledge',detail:'1d10 6 + 10 = 16 > DV 15 — success',total:16,faces:[{v:6,s:10}]}]);
});

test('hazards: a situation that needs no roll reports nothing',()=>{
 const {window,sent}=load({modules:['hazard-tools.js']});
 const values={'[data-hz-ledge-situation]':{value:'gear'},'[data-hz-ledge-dex]':{value:'6'},'[data-hz-ledge-athletics]':{value:'4'},'[data-hz-ledge-mod]':{value:'0'}},outputs={},root={querySelector(s){return values[s]||(outputs[s]??={textContent:''})}},button={dataset:{hzAction:'ledge'},closest(){return root}};
 window.HazardTools.handle({type:'click',target:{closest(){return button}}},'ru');
 assert.equal(sent.length,0);
});

test('every tool that rolls on its own hands the roll over',()=>{
 const tools={'medical-tools.js':2,'repair-tools.js':1,'cyber-surgery.js':1,'pharmacy-tools.js':1,'hazard-tools.js':3,'vehicle-tools.js':3,'net-tools.js':2,'lifestyle-tools.js':1,'therapy-tools.js':2,'grapple-tools.js':6,'combat-tools.js':3,'autofire-tools.js':2,'area-tools.js':4,'critical-injury-tools.js':1,'role-tools.js':9};
 for(const [file,least] of Object.entries(tools)){const n=(source(file).match(/window\.Rolls\?\.(check|sum|opposed)\(/g)||[]).length;assert.ok(n>=least,`${file}: ${n} of ${least}`)}
});

test('the page loads the roll service before the app',()=>{
 const html=source('index.html');assert.ok(html.indexOf('src="rolls.js"')>0&&html.indexOf('src="rolls.js"')<html.indexOf('src="app.js"'));
});
