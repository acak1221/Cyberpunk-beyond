const fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test'),assert=require('node:assert/strict');
const source=f=>fs.readFileSync(__dirname+'/../site/'+f,'utf8');
// The app shell with stubs, plus a hook to the functions that put numbers on the roll buttons.
function app(extraWindow={}){
 const node=()=>({innerHTML:'',addEventListener(){},setAttribute(){}}),nodes={'#app':node(),'#sync-root':node(),'#sync-adapter-status':node(),'#app-notice':{textContent:'',classList:{add(){},remove(){}}}};
 const window={scrollTo(){},Book:{handle:()=>false},Campaigns:{handle:()=>false},CombatTools:{handle:()=>false},EquipmentTools:{render:()=>'',setScope(){},handle:()=>({handled:false})},LocalStore:{create(){return {start(){},getScope:()=>'owner',stateLabel:()=>'',canEdit:()=>true,save:()=>Promise.resolve({ok:true})}}},...extraWindow};
 const context={window,document:{querySelector:s=>nodes[s]||null,documentElement:{},title:''},localStorage:{getItem:()=>null},globalThis:{addEventListener(){}},setTimeout:()=>0,clearTimeout(){},console,Math,Date,JSON,Set,Number,String,Array,Object,Promise};
 vm.createContext(context);vm.runInContext(source('app.js')+'\nwindow.qa={checkBonus,initiativeBonus,skillTotal,skills:SKILLS};',context);
 return window;
}
const hero=(over={})=>({id:'c1',name:'Vi',role:'solo',rank:4,hp:45,humanity:60,stats:{INT:6,REF:7,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:8},skills:{Evasion:4,Perception:3,'Human Perception':2},...over});

test('a check button adds STAT and Skill, with EMP read from Humanity',()=>{
 const {qa}=app();
 assert.equal(qa.checkBonus(hero(),'DEX',4),10);
 assert.equal(qa.checkBonus(hero(),'EMP',2),8,'Humanity 60 means EMP 6, not the EMP 8 written on the sheet');
 assert.equal(qa.checkBonus(null,'DEX',4),0);
});

test('wound penalties are part of the number on the button (p. 186)',()=>{
 const {qa}=app();
 assert.equal(qa.checkBonus(hero({hp:22}),'DEX',4),8,'Seriously Wounded: −2');
 assert.equal(qa.checkBonus(hero({hp:0}),'DEX',4),6,'Mortally Wounded: −4');
 assert.equal(qa.checkBonus(hero({hp:23}),'DEX',4),10,'half of 45 rounds up to 23');
});

test('the modifier and the LUCK set for the next roll are included, LUCK never above the pool (p. 130)',()=>{
 const {qa}=app();
 assert.equal(qa.checkBonus(hero({extra:{modifier:-2}}),'DEX',4),8);
 assert.equal(qa.checkBonus(hero({extra:{luck:2,luckUse:5}}),'DEX',4),12,'only the 2 LUCK left can be spent');
 assert.equal(qa.checkBonus(hero({extra:{luckUse:3}}),'DEX',4),13,'a sheet without a LUCK pool yet starts from the LUCK STAT');
 assert.equal(qa.checkBonus(hero({extra:{modifier:1000}}),'DEX',4),110,'the modifier is clamped like the field');
});

test('the skill row shows the same number, with the sign',()=>{
 const {qa}=app(),row=name=>[...qa.skills].find(s=>s[0]===name);
 assert.equal(qa.skillTotal(hero(),row('Evasion')),'+10');
 assert.equal(qa.skillTotal(hero({hp:0,stats:{...hero().stats,DEX:2},skills:{Evasion:0}}),row('Evasion')),'−2');
});

test('initiative shows REF after armor and the Solo bonus, and ignores the check modifier',()=>{
 const plain=app().qa;
 assert.equal(plain.initiativeBonus(hero({extra:{modifier:-3,luckUse:2}})),7);
 const withTools=app({RoleTools:{soloRollBonuses:()=>({ok:true,enabled:true,initiative:2,threat:1})},EquipmentTools:{render:()=>'',setScope(){},handle:()=>({handled:false}),armorRollAdjustment:(c,stat)=>({ok:true,enabled:true,value:Number(c.stats[stat])-2})}}).qa;
 assert.equal(withTools.initiativeBonus(hero()),7,'REF 7 − 2 armor + 2 Initiative Reaction');
 assert.equal(withTools.checkBonus(hero(),'DEX',4),8,'armor lowers DEX for the check');
 assert.equal(withTools.skillTotal(hero(),[...withTools.skills].find(s=>s[0]==='Perception')),'+10','INT 6 + 3 + Threat Detection 1');
});

test('rolls use the modifier once unless it is pinned',()=>{
 const sheet=source('character-extra.js'),shell=source('app.js');
 assert.match(sheet,/function useModifier\(x\)\{const m=num\(x\.modifier,-100,100\);if\(x\.modifierHold!==true\)x\.modifier=0;return m\}/);
 assert.equal((sheet.match(/m=useModifier\(x\)/g)||[]).length,3,'native language, specialization and weapon attack');
 assert.doesNotMatch(sheet,/modifier:num\(x\.modifier,-100,100\)\+/);
 assert.match(shell,/x\.luckUse=0;if\(x\.modifierHold!==true\)x\.modifier=0;const stimOn=[^;]*;let out=checkRoll\(/);
 assert.match(shell,/' · LUCK \+'\+spent/);assert.match(shell,/' · LUCK \+'\+q\.luckSpent/);
});

test('the next-roll bar and quick HP reuse the sheet fields instead of writing data themselves',()=>{
 const tabs=source('sheet-tabs.js');
 assert.match(tabs,/\[data-cx-field="\$\{kind==='luckUse'\?'luckUse':'modifier'\}"\]/);
 assert.match(tabs,/\[data-sheet-hp-reason\]/);assert.match(tabs,/\[data-field="hp"\]/);
 for(const f of ['app.js','character-extra.js'])for(const hook of ['data-cx-field','data-sheet-hp-reason'])if(f==='app.js'||hook==='data-cx-field')assert.match(source(f),new RegExp(hook));
 assert.match(tabs,/'< '\+death/,'a Death Save succeeds only under BODY (p. 188)');
});
