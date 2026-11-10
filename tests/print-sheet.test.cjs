const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync('site/print-sheet.js','utf8');
const css=fs.readFileSync('site/print-sheet.css','utf8');
const SKILLS=[['Concentration','Концентрация','WILL',1,1],['Perception','Восприятие','INT',1,1],['Athletics','Атлетика','DEX',1,1],['Evasion','Уклонение','DEX',1,1],['Brawling','Рукопашный бой','DEX',1,1],['Human Perception','Понимание людей','EMP',1,1],['Stealth','Скрытность','DEX',1,1],['Resist Torture/Drugs','Сопротивление пыткам / наркотикам','WILL',1,0],['Handgun','Пистолеты','REF',1,0],['Autofire','Автоматический огонь','REF',2,0],['Melee Weapon','Холодное оружие','DEX',1,0],['Tactics','Тактика','INT',1,0]];
const ROLES=[{id:'solo',name:{ru:'Соло',en:'Solo'},ability:{ru:'Combat Awareness',en:'Combat Awareness'},page:146},{id:'tech',name:{ru:'Техник',en:'Tech'}}];
function load(){const win={};vm.runInNewContext(code,{window:win});return win.PrintSheet}
const P=load();
const env=(extra={})=>({lang:'en',skills:SKILLS,roles:ROLES,date:'10/11/2026',...extra});
const vee=()=>({id:'v1',name:'Vee <b>',role:'solo',rank:4,stats:{INT:6,REF:8,DEX:7,TECH:5,COOL:6,WILL:7,LUCK:5,MOVE:6,BODY:8,EMP:4},skills:{Perception:6,Evasion:6,Handgun:6,'Human Perception':2,Autofire:4,Tactics:3},hp:12,humanity:34,head:11,bodyArmor:7,native:'Spanish',gear:'Rope\nFlashlight',cyberware:'Neural link',notes:'Owes <script>500</script> eb',
 extra:{cash:740,reputation:3,reputationNote:'Known',luck:3,modifier:-2,luckUse:2,nativeLevel:4,portrait:'data:image/png;base64,AAAA',
  specializations:[{name:'Language (English)',stat:'INT',level:3},{name:'',stat:'INT',level:2}],
  weapons:[{id:'w1',name:'Heavy Pistol',skill:'Handgun',stat:'REF',modifier:1,damage:'3d6',rof:2,capacity:8,ammo:6,usesAmmo:true,notes:'Smart'},{id:'w2',name:'Knife',skill:'Melee Weapon',stat:'DEX',modifier:0,damage:'1d6',rof:2,capacity:0,ammo:0,usesAmmo:false,notes:''}],
  items:[{id:'i1',name:'Light Armorjack',category:'armor',quantity:1,notes:''},{id:'i2',name:'Cybereye',category:'cyberware',quantity:2,notes:'IR'},{id:'i3',name:'Agent',category:'equipment',quantity:1,notes:''},{id:'i4',name:'',category:'equipment',quantity:1,notes:'nameless'},{id:'i5',name:'Odd',category:'weird',quantity:3,notes:''}],
  equipment:{armor:{head:{recordId:'i1',piece:0}},maxHumanity:36,installs:[]},
  life:{culture:'North America',motivation:'Revenge',friends:''}}});

test('model derives the paper values from the character without changing it',()=>{
 const c=vee(),before=JSON.stringify(c),m=P.model(c,env());
 assert.equal(JSON.stringify(c),before);
 assert.equal(m.name,'Vee <b>');assert.equal(m.role,'Solo');assert.equal(m.rank,4);
 assert.equal(m.hp,12);assert.equal(m.hpMax,50);assert.equal(m.serious,25);assert.equal(m.deathSave,8);
 assert.equal(m.humanity,34);assert.equal(m.maxHumanity,36);assert.equal(m.emp,3);assert.equal(m.initiative,8);assert.equal(m.move,6);
 assert.equal(m.spHead,11);assert.equal(m.spBody,7);assert.equal(m.armorHead,'Light Armorjack');assert.equal(m.armorBody,'');
 assert.equal(m.luck,3);assert.equal(m.luckMax,5);assert.equal(m.reputation,3);assert.equal(m.cash,740);assert.equal(m.ip,null);
 assert.deepEqual(JSON.parse(JSON.stringify(m.stats.map(s=>[s.key,s.value]).slice(0,3))),[['INT',6],['REF',8],['DEX',7]]);
 assert.deepEqual(JSON.parse(JSON.stringify(m.ability)),{name:'Combat Awareness',page:146,rows:[]});
 assert.equal(m.picture,'data:image/png;base64,AAAA');
});
test('skill totals are STAT + level, EMP skills use current EMP, and wounds or spent LUCK do not lower them',()=>{
 const m=P.model(vee(),env()),by=Object.fromEntries(m.skills.map(s=>[s.id,s]));
 assert.equal(by.Perception.total,12);assert.equal(by.Evasion.total,13);assert.equal(by['Human Perception'].total,5);assert.equal(by.Concentration.total,7);
 assert.equal(by.Autofire.hard,true);assert.equal(by.Perception.name,'Perception');
 assert.equal(P.model(vee(),env({lang:'ru'})).skills[1].name,'Восприятие');
 assert.equal(m.specs.length,1);assert.equal(m.specs[0].total,9);
 assert.equal(m.weapons[0].attack,15);assert.equal(m.weapons[0].ammo,'6 / 8');assert.equal(m.weapons[0].skill,'Handgun');assert.equal(m.weapons[1].attack,7);assert.equal(m.weapons[1].ammo,'');
});
test('the app calculators are used when present, on a rested copy, and a failing one falls back',()=>{
 const seen=[],c=vee();
 const m=P.model(c,env({checkBonus:(x,stat,level,kind,skill)=>{seen.push([x===c,x.hp,x.extra.modifier,x.extra.luckUse]);return 100+level},initiativeBonus:()=>11,attackBonus:(x,i)=>20+i,perceptionBonus:()=>2,ip:()=>35,lifeField:(x,k)=>k==='culture'?'Translated':x.extra.life[k],roleRows:()=>[['Points','3 / 4'],['',''],'bad']}));
 assert(seen.length>0);assert(seen.every(r=>r[0]===false&&r[1]===50&&r[2]===0&&r[3]===0));
 const by=Object.fromEntries(m.skills.map(s=>[s.id,s]));
 assert.equal(by.Perception.total,108);assert.equal(by.Evasion.total,106);assert.equal(m.initiative,11);assert.equal(m.weapons[1].attack,21);assert.equal(m.ip,35);
 assert.deepEqual(JSON.parse(JSON.stringify(m.life.map(r=>[r.key,r.value]))),[['culture','Translated'],['motivation','Revenge']]);
 assert.deepEqual(JSON.parse(JSON.stringify(m.ability.rows)),[['Points','3 / 4']]);
 assert.equal(c.hp,12);assert.equal(c.extra.modifier,-2);
 const broken=P.model(vee(),env({checkBonus:()=>{throw new Error('x')},initiativeBonus:()=>NaN,attackBonus:()=>{throw new Error('x')},ip:()=>{throw new Error('x')},roleRows:()=>{throw new Error('x')}}));
 assert.equal(broken.skills[1].total,12);assert.equal(broken.initiative,8);assert.equal(broken.weapons[0].attack,15);assert.equal(broken.ip,null);assert.equal(broken.ability.rows.length,0);
});
test('items are sorted into armor, cyberware and gear; nameless rows are dropped',()=>{
 const m=P.model(vee(),env());
 assert.deepEqual(m.armorItems.map(i=>i.name),['Light Armorjack']);assert.deepEqual(m.cyberItems.map(i=>i.name),['Cybereye']);assert.deepEqual(m.gearItems.map(i=>i.name),['Agent','Odd']);
});
test('old and damaged saves still give a sheet',()=>{
 const old={id:'o',name:'',role:'nobody',rank:'x',stats:{BODY:6,WILL:6},skills:null,hp:'?',humanity:null};
 const m=P.model(old,env({lang:'ru'}));
 assert.equal(m.name,'Без имени');assert.equal(m.role,'nobody');assert.equal(m.hpMax,40);assert.equal(m.hp,0);assert.equal(m.weapons.length,0);assert.equal(m.reputation,null);assert.equal(m.cash,null);assert.equal(m.picture,'');
 const odd=P.model({...vee(),extra:{weapons:'no',items:[null,5,{name:{}}],specializations:{},life:[],equipment:[],portrait:'javascript:alert(1)',deathRecord:{dead:true}}},env());
 assert.equal(odd.weapons.length,0);assert.equal(odd.gearItems.length,0);assert.equal(odd.life.length,0);assert.equal(odd.picture,'');assert.equal(odd.dead,true);
 assert.equal(P.model(null,env()),null);assert.equal(P.model({name:'x'},env()),null);assert.equal(P.documentHTML(null,env(),{}),'');
 assert(P.sheetHTML(P.model(old,{}),{}).includes('ps-sheet'));
});
test('the sheet has every section with data, escapes text, and has nothing to press',()=>{
 const html=P.sheetHTML(P.model(vee(),env()),{});
 for(const cls of ['ps-stats-block','ps-vitals-block','ps-skills-block','ps-specs-block','ps-weapons-block','ps-armor-block','ps-cyber-block','ps-gear-block','ps-ability-block','ps-life-block','ps-notes-block'])assert(html.includes(cls),cls);
 assert(html.includes('Vee &lt;b&gt;'));assert(html.includes('Owes &lt;script&gt;500&lt;/script&gt; eb'));assert(!html.includes('<script'));assert(!/<(button|input|select|textarea|a)\b/.test(html));
 assert(html.includes('12 / 50'));assert(html.includes('below 25'));assert(html.includes('34 / 36'));assert(html.includes('740 eb'));assert(html.includes('Heavy Pistol'));assert(html.includes('+15'));assert(html.includes('p. 146'));
 assert(html.includes('<img class="ps-portrait" src="data:image/png;base64,AAAA"'));
 assert.equal((html.match(/class="(ps-trained)?"><span class="ps-skill-name"/g)||[]).length,SKILLS.length);
});
test('empty sections are left out, and the life and notes options remove those sections',()=>{
 const bare={id:'b',name:'',role:'tech',rank:1,stats:{INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:6,EMP:6},skills:{},hp:40,humanity:60,head:0,bodyArmor:0};
 const html=P.sheetHTML(P.model(bare,env()),{});
 for(const cls of ['ps-specs-block','ps-weapons-block','ps-cyber-block','ps-gear-block','ps-ability-block','ps-life-block','ps-notes-block'])assert(!html.includes(cls),cls);
 assert(html.includes('ps-armor-block'));assert(!/<h2>[^]*?<\/h2>\s*<\/section>/.test(html));
 const cut=P.sheetHTML(P.model(vee(),env()),{life:false,notes:false});
 assert(!cut.includes('ps-life-block'));assert(!cut.includes('ps-notes-block'));assert(cut.includes('ps-gear-block'));
});
test('the GM card is compact: key skills first, then the best, at most four weapons',()=>{
 const c=vee();c.extra.weapons=Array.from({length:6},(_,i)=>({name:'W'+i,skill:'Handgun',stat:'REF',damage:'2d6',rof:2}));
 const m=P.model(c,env()),picked=P.cardSkills(m),html=P.cardHTML(m);
 assert.deepEqual([...picked.slice(0,8).map(s=>s.id)],['Perception','Evasion','Athletics','Brawling','Concentration','Human Perception','Stealth','Resist Torture/Drugs']);
 assert.deepEqual([...picked.slice(8).map(s=>s.id)],['Handgun','Autofire','Tactics']);
 assert.equal(P.cardSkills(m,9).length,9);
 assert(html.includes('ps-card'));assert(html.includes('W3'));assert(!html.includes('W4'));assert(!html.includes('ps-portrait'));assert(!/<(button|input|select|textarea)\b/.test(html));
 assert(html.includes('Cybereye; Neural link'));assert(html.includes('GM card'));
});
test('documentHTML follows the chosen mode and bad options fall back to the full sheet',()=>{
 const has=(o,cls)=>P.documentHTML(vee(),env(),o).includes(`<article class="${cls}"`);
 assert(has({mode:'sheet'},'ps-sheet'));assert(!has({mode:'sheet'},'ps-card'));
 assert(has({mode:'card'},'ps-card'));assert(!has({mode:'card'},'ps-sheet'));
 assert(has({mode:'both'},'ps-sheet'));assert(has({mode:'both'},'ps-card'));
 assert(has({mode:'nonsense'},'ps-sheet'));assert(has(null,'ps-sheet'));
 assert.deepEqual(JSON.parse(JSON.stringify(P.normalOptions({mode:'card',life:false,notes:0}))),{mode:'card',life:false,notes:true});
 assert.deepEqual(JSON.parse(JSON.stringify(P.normalOptions('x'))),{mode:'sheet',life:true,notes:true});
});
test('both languages have the same labels',()=>{
 const ru=P.sheetHTML(P.model(vee(),env({lang:'ru'})),{}),en=P.sheetHTML(P.model(vee(),env()),{});
 assert(ru.includes('Лист персонажа'));assert(ru.includes('Характеристики'));assert(ru.includes('Жизненный путь'));assert(en.includes('Character sheet'));assert(en.includes('Lifepath'));
 assert.equal((ru.match(/<h2>/g)||[]).length,(en.match(/<h2>/g)||[]).length);
});
/* A small DOM: enough for prepare/cleanup and the print events. */
function browser({view='sheet',character=vee(),saved=null}={}){
 const events={},made=[];
 const node=tag=>({tag,id:'',className:'',innerHTML:'',textContent:'',lang:'',parent:null,children:[],appendChild(n){n.parent=this;this.children.push(n);return n},remove(){if(this.parent){const i=this.parent.children.indexOf(this);if(i>=0)this.parent.children.splice(i,1);this.parent=null}}});
 const classes=new Set(),body=node('body'),head=node('head');
 const doc={body,head,documentElement:{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)}},createElement:tag=>{const n=node(tag);made.push(n);return n},querySelector:()=>null};
 const store={};if(saved)store['nc-print-options']=JSON.stringify(saved);
 const state={view},win={document:doc,localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v)}},ROLES,addEventListener:(n,f)=>{events[n]=f},App:{getState:()=>state,active:()=>character,lang:()=>'en'},printed:0};
 win.print=()=>{win.printed++};
 vm.runInNewContext(code,{window:win,SKILLS});
 return {win,events,body,head,classes,state,api:win.PrintSheet};
}
test('prepare mounts one paper root with a page rule and cleanup removes both',()=>{
 const b=browser();
 assert.equal(b.api.prepare({mode:'both'}),true);
 assert.equal(b.body.children.length,1);assert.equal(b.body.children[0].id,'print-sheet');assert(b.body.children[0].innerHTML.includes('ps-sheet'));assert(b.body.children[0].innerHTML.includes('ps-card'));
 assert(b.body.children[0].innerHTML.includes('Perception'),'skills come from the app list');
 assert.equal(b.head.children.length,1);assert(b.head.children[0].textContent.includes('A4'));assert(b.classes.has('ps-printing'));
 b.api.prepare({mode:'card'});assert.equal(b.body.children.length,1);assert.equal(b.head.children.length,1);assert(!b.body.children[0].innerHTML.includes('ps-sheet'));
 b.api.cleanup();assert.equal(b.body.children.length,0);assert.equal(b.head.children.length,0);assert(!b.classes.has('ps-printing'));
});
test('printing from the browser menu uses the saved options on a sheet and stays out of the way elsewhere',()=>{
 const b=browser({saved:{mode:'card'}});
 b.events.beforeprint();assert.equal(b.body.children.length,1);assert(b.body.children[0].innerHTML.includes('ps-card'));assert(!b.body.children[0].innerHTML.includes('ps-sheet'));
 b.events.afterprint();assert.equal(b.body.children.length,0);assert(!b.classes.has('ps-printing'));
 const other=browser({view:'rules'});
 other.events.beforeprint();assert.equal(other.body.children.length,0);assert(!other.classes.has('ps-printing'));
 assert.equal(other.api.prepare({mode:'sheet'}),false);assert.equal(other.api.open(),false);
});
test('a root that was just prepared is printed as it is; a stale one is rebuilt or removed',()=>{
 const b=browser({saved:{mode:'card'}});
 b.api.prepare({mode:'sheet'});const first=b.body.children[0];
 b.events.beforeprint();assert.equal(b.body.children[0],first,'kept');
 b.events.beforeprint();assert.notEqual(b.body.children[0],first,'rebuilt from the saved options');assert(b.body.children[0].innerHTML.includes('ps-card'));
 b.state.view='rules';b.events.beforeprint();assert.equal(b.body.children.length,0);
});
test('the stylesheet hides everything but the paper in print and keeps the paper off the screen',()=>{
 assert(/#print-sheet\s*\{\s*display:none/.test(css));
 const print=css.slice(css.indexOf('@media print'));
 assert(print.includes('html.ps-printing body > *:not(#print-sheet) { display:none !important; }'));
 assert(print.includes('html.ps-printing #print-sheet { display:block !important;'));
 assert(!/@page/.test(css),'the page rule is added only while printing');
 assert(!/url\(|@import/.test(css));
});
test('the app wires the print button and loads the files in order',()=>{
 const index=fs.readFileSync('site/index.html','utf8'),app=fs.readFileSync('site/app.js','utf8');
 assert(index.indexOf('<script src="print-sheet.js"></script>')>0&&index.indexOf('<script src="print-sheet.js"></script>')<index.indexOf('<script src="app.js"'));
 assert(index.indexOf('href="print-sheet.css"')>index.indexOf('href="board.css"'));
 assert(app.includes("else if(a==='print'){if(!window.PrintSheet?.open?.({skills:SKILLS}))window.print()}"));
});
