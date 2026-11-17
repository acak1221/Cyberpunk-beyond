// What the sheet's own markup says after the compact redesign (site/app.js): STAT boxes and Skill rows with details, a star,
// data for grouping, no reason select, the vitals card pointing at the one HP pad; App.skillInfo and App.applyHp.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=n=>fs.readFileSync(__dirname+'/../site/'+n,'utf8');
function harness({board=false,lang='ru',window:extra={}}={}){
 let nextId=0;const events={},saved=[],notices=[];
 const node=()=>({innerHTML:'',addEventListener(k,f){events[k]=f},setAttribute(){}}),nodes={'#app':node(),'#sync-root':node(),'#sync-adapter-status':node(),'#app-notice':{set textContent(v){notices.push(v)},classList:{add(){},remove(){}}}};
 const w={ROLES:[{id:'solo',name:{ru:'Соло',en:'Solo'},description:{ru:'',en:''},ability:{ru:'Бой',en:'Combat'}}],Book:{handle:()=>false},CombatTools:{handle:()=>false},NetTools:{setScope(){},validArchitectures:Array.isArray},RoleTools:{render:()=>'',handle:()=>({handled:false}),refresh(){}},
  LocalStore:{create(){return {start(){},getScope:()=>'account',stateLabel:()=>'',canEdit:()=>true,save(s){saved.push(1);return Promise.resolve({ok:true})}}}},confirm:()=>true,scrollTo(){},
  QuickRail:{starHTML:(c,name)=>`<button class="skill-star" data-quick-star="${name}">★</button>`},Portrait:{editor:()=>'<PORTRAIT/>'},...extra};
 const c={id:'p',name:'Test',role:'solo',rank:4,stats:{INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{Handgun:2,Athletics:2},hp:45,humanity:60,head:0,bodyArmor:0,extra:{}};
 const context={window:w,document:{querySelector:s=>nodes[s]||null,documentElement:{classList:{contains:x=>board&&x==='ui-board'}},title:''},localStorage:{getItem:()=>JSON.stringify({characters:[c],campaigns:[],lang})},globalThis:{crypto:{randomUUID:()=>`id-${++nextId}`},addEventListener(){}},confirm:()=>true,setTimeout:()=>0,clearTimeout(){},console,Math,Date,JSON,Set,Number,String,Array,Object,Promise};
 vm.createContext(context);
 for(const f of ['campaigns.js','catalog.js','catalog-extra.js','character-extra.js','equipment-tools.js'])vm.runInContext(source(f),context,{filename:f});
 vm.runInContext(source('app.js')+'\nwindow.qa={open:()=>{state.active="p";state.view="sheet";render()},character:()=>active()};',context);
 w.qa.open();
 return {w,c:w.qa.character(),html:()=>nodes['#app'].innerHTML,saved,notices};
}

test('every STAT box has a name button that opens the breakdown, and the number field keeps its own name',()=>{
 const h=harness(),html=h.html();
 for(const s of ['INT','REF','DEX','TECH','COOL','WILL','LUCK','MOVE','BODY','EMP']){
  assert.ok(html.includes(`<button type="button" class="stat-name stat-info" data-detail-open="stat:${s}" aria-haspopup="dialog" aria-label="${s}: из чего складывается число">${s}<i aria-hidden="true">ⓘ</i></button><input type="number" min="0" max="20" data-stat="${s}"`),s);
  assert.ok(new RegExp(`data-stat="${s}" value="\\d+" aria-label="${s}"`).test(html),s+' input has a name');
 }
 assert.doesNotMatch(html,/<label class="stat">/);
 assert.match(harness({lang:'en'}).html(),/aria-label="REF: what the number is made of"/);
});

test('every Skill row: the name is a button-like trigger, the STAT and the Russian name are data, the star is the last cell',()=>{
 const h=harness(),html=h.html();
 const rows=[...html.matchAll(/<div class="skill-row" data-skill-search="[^"]*" data-skill-stat="(\w+)" data-skill-ru="([^"]*)"><div class="skill-name" role="button" tabindex="0" data-detail-open="skill:([^"]+)" aria-haspopup="dialog" aria-label="([^"]+)">/g)];
 assert.equal(rows.length,[...html.matchAll(/<input aria-label="[^"]*" type="number" data-skill=/g)].length,'one per Skill of the sheet');assert.ok(rows.length>=60);
 const handgun=rows.find(m=>m[3]==='Handgun');assert.equal(handgun[1],'REF');assert.equal(handgun[2],'Пистолеты');assert.equal(handgun[4],'Пистолеты: из чего складывается число');
 assert.match(html,/data-skill="Handgun" value="2"[^>]*><button class="skill-roll"[^]*?<button class="skill-star" data-quick-star="Handgun">★<\/button><\/div>/);
 assert.match(html,/class="skill-i" aria-hidden="true">ⓘ<\/i>/);
});

test('in the «Досье» look the Skill name is left to its own panel and the portrait editor stays in the header',()=>{
 const h=harness({board:true}),html=h.html();
 assert.doesNotMatch(html,/data-detail-open="skill:/);assert.doesNotMatch(html,/class="skill-i"/);
 assert.ok(html.indexOf('<PORTRAIT/>')<html.indexOf('class="sheet-title"'),'the portrait is in the header');assert.doesNotMatch(html,/identity-portrait/);
 const plain=harness().html();
 assert.match(plain,/<div class="identity-portrait"><PORTRAIT\/><\/div>/);assert.ok(plain.indexOf('<PORTRAIT/>')>plain.indexOf('id="sheet-identity"'),'outside the board look the portrait is in the identity card');
 assert.equal(plain.split('<PORTRAIT/>').length,2,'once, not twice');
});

test('the vitals card has no reason select and no HP field: it points at the pad and explains it in both languages',()=>{
 const ru=harness().html(),en=harness({lang:'en'}).html();
 for(const html of [ru,en]){assert.doesNotMatch(html,/data-sheet-hp-reason/);assert.doesNotMatch(html,/data-field="hp"/);assert.match(html,/data-hp-open aria-controls="hud-hp-panel"/);assert.match(html,/data-calc="hp-now">45</)}
 assert.match(ru,/>Изменить HP</);assert.match(ru,/Откроет панель здоровья вверху листа/);assert.match(en,/>Change HP</);assert.match(en,/Opens the health pad at the top of the sheet/);
});

test('the sheet has all the markup of the old header buttons for the menu to press',()=>{
 const html=harness().html();
 for(const a of ['share-link','export','print'])assert.match(html,new RegExp(`<div class="header-actions">[^]*data-action="${a}"`));
});

test('App.skillInfo describes a Skill of the sheet and nothing else; the total is the one on the row',()=>{
 const h=harness(),A=h.w.App;
 const i=A.skillInfo('Handgun');assert.equal(i.name,'Handgun');assert.equal(i.ru,'Пистолеты');assert.equal(i.stat,'REF');assert.equal(i.mult,1);assert.equal(i.total,'+8');assert.equal(i.required,false);
 assert.equal(A.skillInfo('Concentration').required,true);assert.equal(A.skillInfo('Martial Arts').mult,2);
 assert.equal(A.skillInfo('Nothing'),null);assert.equal(A.skillInfo(undefined),null);assert.equal(A.skillInfo('toString'),null,'prototype names are not skills');
 assert.match(h.html(),/data-skill-total="Handgun">\+8</,'the same number as the row');
});

test('App.applyHp changes HP through the guarded rules: whole numbers, the damage reason, saved once, and the notice when it fails',()=>{
 const h=harness(),A=h.w.App,c=h.c;
 const r=A.applyHp(30,'damage',c);assert.equal(r.ok,true);assert.equal(c.hp,30);assert.equal(h.saved.length,1);
 assert.equal(A.applyHp(30,'damage',c).changed,false);assert.equal(h.saved.length,1,'nothing changed, nothing saved');
 assert.equal(A.applyHp('abc','damage',c),false);assert.equal(c.hp,30);assert.ok(h.notices.at(-1).includes('Проверьте HP'));
 assert.equal(A.applyHp(1001,'damage',c),false,'above the sheet\'s ceiling');assert.equal(A.applyHp(-1000,'damage',c),false);
 assert.equal(A.applyHp(35,'whatever',c).ok,true,'raising HP never needs a reason');
 const reports=[];h.w.HpPad={noted:(...a)=>reports.push(a.length)};A.applyHp(10,'correction',c);assert.deepEqual(reports,[4],'the pad is told');
});
