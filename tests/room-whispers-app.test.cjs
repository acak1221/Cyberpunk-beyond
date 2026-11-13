// A secret check (room-whispers.js) with the real app.js checkBase: the same base as a sheet roll, without the
// sheet's general modifier and the LUCK set aside on the sheet (the player picks LUCK for the secret roll).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=n=>fs.readFileSync(__dirname+'/../site/'+n,'utf8');
const dice=(...faces)=>{let i=0;return ()=>((faces[i++]??5)-1)/10+0.01};

function harness(){
 let nextId=0;
 const node=()=>({innerHTML:'',addEventListener(){},setAttribute(){}}),nodes={'#app':node(),'#sync-root':node(),'#sync-adapter-status':node(),'#app-notice':{set textContent(v){},classList:{add(){},remove(){}}}};
 const c={id:'p',name:'Test',role:'solo',rank:4,stats:{INT:6,REF:7,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:8},
  skills:{'Language (Streetslang)':4,'Language (Other)':2,'Local Expert (Home)':3,Perception:5,Handgun:4,'Human Perception':3},hp:45,humanity:45,head:0,bodyArmor:0,
  extra:{luck:3,luckUse:2,modifier:5,items:[]}};
 const w={ROLES:[{id:'solo',name:{ru:'Соло',en:'Solo'},description:{ru:'',en:''},ability:{ru:'Бой',en:'Combat'}}],Book:{handle:()=>false},Campaigns:{handle:()=>false},CombatTools:{handle:()=>false},NetTools:{setScope(){},validArchitectures:Array.isArray},RoleTools:{render:()=>'',handle:()=>({handled:false}),refresh(){}},
  LocalStore:{create(){return {start(){},getScope:()=>'account',stateLabel:()=>'',canEdit:()=>true,save(){return Promise.resolve({ok:true})}}}},confirm:()=>true,scrollTo(){},crypto:globalThis.crypto};
 const context={window:w,document:{querySelector:s=>nodes[s]||null,querySelectorAll:()=>[],documentElement:{},title:''},localStorage:{getItem:()=>JSON.stringify({characters:[c],campaigns:[],lang:'en'})},globalThis:{crypto:{randomUUID:()=>`id-${++nextId}`},addEventListener(){}},confirm:()=>true,setTimeout:()=>0,clearTimeout(){},console,Math,Date,JSON,Set,Map,Number,String,Array,Object,Promise,Uint8Array};
 vm.createContext(context);
 for(const f of ['catalog.js','catalog-extra.js','character-extra.js','equipment-tools.js','pharmacy-tools.js','stim-roll.js','role-tools.js','skill-reference.js','rolls.js'])vm.runInContext(source(f),context,{filename:f});
 vm.runInContext(source('app.js')+'\nwindow.qa={character:()=>state.characters[0]};',context);
 vm.runInContext(source('room-whispers.js'),context,{filename:'room-whispers.js'});
 return {w,c:w.qa.character()};
}
// What a sheet roll would add, minus the sheet's general modifier and its LUCK.
const sheetBase=(w,c,stat,skill)=>{const x=c.extra,keep=[x.modifier,x.luckUse];x.modifier=0;x.luckUse=0;try{return w.App.checkBonus(c,stat,Number(c.skills[skill])||0,'',skill)}finally{[x.modifier,x.luckUse]=keep}};

test('the secret check base is the sheet base: wounds, EMP from Humanity, the sheet skill keys',()=>{
 const {w,c}=harness(),W=w.RoomWhispers._test;
 assert.equal(W.rollFor(c,'Perception',0,dice(5)).base,11);
 assert.equal(W.rollFor(c,'Perception',0,dice(5)).base,sheetBase(w,c,'INT','Perception'));
 // The two languages and two areas are separate skills on the sheet.
 assert.equal(W.rollFor(c,'Language (Streetslang)',0,dice(5)).base,10);
 assert.equal(W.rollFor(c,'Language (Streetslang)',0,dice(5)).base,sheetBase(w,c,'INT','Language (Streetslang)'));
 assert.equal(W.rollFor(c,'Language (Other)',0,dice(5)).base,8);
 assert.equal(W.rollFor(c,'Local Expert (Home)',0,dice(5)).base,9);
 assert.equal(W.rollFor(c,'Local Expert (Other)',0,dice(5)).base,6);
 // A reference id from an older page takes the higher of the two.
 assert.equal(W.rollFor(c,'Language',0,dice(5)).base,10);assert.equal(W.rollFor(c,'Local Expert',0,dice(5)).base,9);
 // EMP comes from Humanity (45 -> 4), not the EMP field (8).
 assert.equal(W.rollFor(c,'Human Perception',0,dice(5)).base,7);
 assert.equal(W.rollFor(c,'Human Perception',0,dice(5)).base,sheetBase(w,c,'EMP','Human Perception'));
 // Seriously wounded: −2, as on the sheet.
 c.hp=10;
 assert.equal(W.rollFor(c,'Perception',0,dice(5)).base,9);
 assert.equal(W.rollFor(c,'Perception',0,dice(5)).base,sheetBase(w,c,'INT','Perception'));
 c.hp=0;assert.equal(W.rollFor(c,'Perception',0,dice(5)).base,7,'mortally wounded: −4');
});

test('the secret check base follows armour automation for REF, and is blocked when the armour is unknown',()=>{
 const {w,c}=harness(),W=w.RoomWhispers._test;
 assert.equal(W.rollFor(c,'Handgun',0,dice(5)).base,11);
 c.extra.items.push({id:'armor',catalogId:'armor-metalgear',quantity:1,category:'armor'});
 assert.ok(w.EquipmentTools.equip(c,'armor','body','en',true).ok);
 c.extra.armorRollAutomation={version:1,enabled:true};
 const armoured=W.rollFor(c,'Handgun',0,dice(5)).base;
 assert.ok(armoured<11,'heavy armour lowers REF');
 assert.equal(armoured,sheetBase(w,c,'REF','Handgun'));
 assert.equal(W.rollFor(c,'Perception',0,dice(5)).base,11,'INT is not touched');
 c.extra.armorRollAutomation={version:2,enabled:true};
 assert.deepEqual(JSON.parse(JSON.stringify(W.rollFor(c,'Handgun',0,dice(5)))),{ok:false,why:'armor'});
});

test('the ask list offers the sheet keys, not the reference ones',()=>{
 const {w}=harness(),ids=w.RoomWhispers._test.skillList().map(r=>r[0]);
 for(const id of ['Language (Streetslang)','Language (Other)','Local Expert (Home)','Local Expert (Other)','Perception'])assert.ok(ids.includes(id),id);
 assert.ok(!ids.includes('Language')&&!ids.includes('Local Expert'));
 assert.equal(new Set(ids).size,ids.length);
});
