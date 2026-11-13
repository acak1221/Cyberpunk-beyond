// App-level checks: spec rows in the skill list, rolls through them, filter on rows without inputs, roll breakdown parts.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=n=>fs.readFileSync(__dirname+'/../site/'+n,'utf8');
function harness({extra={},stats={},wounds=0}={}){
 let html='';const events={},saved=[];
 const app={get innerHTML(){return html},set innerHTML(v){html=v},addEventListener(k,f){events[k]=f},setAttribute(){},contains:()=>false,querySelector:()=>null,querySelectorAll:()=>[]};
 const node=()=>({innerHTML:'',addEventListener(){},setAttribute(){}});
 const nodes={'#app':app,'#sync-root':node(),'#sync-adapter-status':node(),'#app-notice':{set textContent(v){},classList:{add(){},remove(){}}}};
 const sheet={isConnected:true,querySelector:()=>null};
 const math=Object.create(Math);math.random=()=>0.5;
 const w={ROLES:[{id:'solo',name:{ru:'Соло',en:'Solo'},description:{ru:'',en:''},ability:{ru:'Бой',en:'Combat'}}],Book:{handle:()=>false},Campaigns:{handle:()=>false},CombatTools:{handle:()=>false},NetTools:{setScope(){},validArchitectures:Array.isArray},
  SheetTabs:{refreshHud(){},takeDV:()=>0},
  LocalStore:{create(){return {start(){},getScope:()=>'account',stateLabel:()=>'',canEdit:()=>true,save(s){saved.push(JSON.parse(JSON.stringify(s)));return Promise.resolve({ok:true})}}}},confirm:()=>true,scrollTo(){}};
 const c={id:'p',name:'Test',role:'solo',rank:4,stats:{INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6,...stats},skills:{Athletics:2,Evasion:4},hp:45-wounds,humanity:60,head:0,bodyArmor:0,extra:{luck:5,luckUse:0,modifier:0,specializations:[{id:'jp',name:'Language (Japanese)',stat:'INT',level:4},{id:'ka',name:'Martial Arts (Karate)',stat:'DEX',level:3,cost:2}],...extra}};
 const document={querySelector:s=>s==='.sheet-layout'?sheet:nodes[s]||null,querySelectorAll:()=>[],documentElement:{classList:{contains:()=>false}},title:'',activeElement:null,body:{}};
 const context={window:w,document,localStorage:{getItem:()=>JSON.stringify({characters:[c],campaigns:[],lang:'en'})},globalThis:{crypto:{randomUUID:()=>'id'},addEventListener(){}},confirm:()=>true,setTimeout:()=>0,clearTimeout(){},console,Math:math,Date,JSON,Set,Number,String,Array,Object,Promise};
 vm.createContext(context);
 for(const f of ['character-extra.js','sheet-leftovers.js'])vm.runInContext(source(f),context,{filename:f});
 vm.runInContext(source('app.js')+'\nwindow.qa={open:()=>{state.active="p";state.view="sheet";render()},character:()=>active(),history:()=>state.history};',context);
 w.qa.open();
 const click=(attr,data)=>{const b={dataset:data,isConnected:true,closest:s=>s===attr?b:null};events.click({type:'click',target:{closest:s=>s===attr?b:null},preventDefault(){}})};
 return {w,click,saved,get html(){return html},character:()=>w.qa.character(),history:()=>w.qa.history()};
}
test('the skill list has spec rows right under their parent',()=>{
 const h=harness(),i=h.html.indexOf('data-skill="Language (Other)"'),j=h.html.indexOf('data-spec-id="jp"'),k=h.html.indexOf('data-skill="Martial Arts"'),m=h.html.indexOf('data-spec-id="ka"');
 assert.ok(i>0&&j>i);assert.ok(k>0&&m>k);
 const nextBase=h.html.indexOf('<div class="skill-row" ',i);assert.ok(j<nextBase);assert.equal(h.html.indexOf('<div class="skill-row" ',i),h.html.indexOf('<div class="skill-row" ',j));
 assert.match(h.html,/data-spec-total="0">\+10</);assert.match(h.html,/data-spec-total="1">\+9</);
});
test('rolling a spec row uses its level and STAT and spends LUCK once',()=>{
 const h=harness({extra:{luckUse:2}});h.click('[data-cx-action]',{cxAction:'roll-skill',cxIndex:'0'});
 const r=h.history()[0];assert.ok(r);assert.equal(r.total,6+6+4+2);assert.equal(h.character().extra.luck,3);
});
test('roll breakdown names wound, modifier and LUCK; total matches the old formula',()=>{
 const h=harness({extra:{luckUse:1,modifier:1},wounds:30});
 h.click('[data-action]',{action:'skill-roll',skill:'Athletics'});
 const r=h.history()[0];assert.ok(r);
 assert.match(r.detail,/\+ 1 \(modifier\)/);assert.match(r.detail,/\+ 1 \(LUCK\)/);assert.match(r.detail,/[−+] \d+ \(wound\)/);
 const wound=Number(r.detail.match(/([−+]) (\d+) \(wound\)/).slice(1).join('').replace('−','-'));
 assert.equal(r.total,6+6+2+1+1+wound);
});
