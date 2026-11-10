const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync(__dirname+'/../site/'+name,'utf8');
// Purchases go through the cart: add a line, set its options, review the in-page summary, then pay.
// The summary shown in the cart panel (#shop-cart) plays the part the confirm() prompt used to play.
test('catalog purchase passes the selected ammo type and packs to the real transaction',async()=>{
 let saved,prompt='',events={};const el=()=>({innerHTML:'',setAttribute(){},addEventListener(type,fn){events[type]=fn}}),app=el(),nodes={'#app':app,'#sync-root':el(),'#sync-adapter-status':el(),'#shop-cart':{innerHTML:'',hidden:true},'#app-notice':{classList:{add(){},remove(){}}}};
 const item={id:'ammo-basic-ammunition',category:'ammo',price:10,page:345,name:{ru:'Боеприпасы',en:'Basic ammunition'},description:{ru:'',en:''},stats:{}};
 const w={ROLES:[{id:'solo',name:{en:'Solo',ru:'Соло'},description:{en:'',ru:''}}],CATALOG:[item],CombatTools:{handle:()=>false},Book:{handle:()=>false},Campaigns:{handle:()=>false},LocalStore:{create(){return{stateLabel:()=>'',start(){},canEdit:()=>true,getScope:()=>'test-account-123456',save(s){saved=JSON.parse(JSON.stringify(s));return Promise.resolve({ok:true})}}}}};
 const character={id:'person',name:'Nova',role:'solo',stats:{INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{},hp:45,humanity:60,extra:{gearBudget:2550,items:[]}};
 const ctx={window:w,document:{querySelector:s=>nodes[s]||null,documentElement:{},title:''},localStorage:{getItem:()=>JSON.stringify({characters:[character],campaigns:[],lang:'en'})},globalThis:{crypto:{randomUUID:()=> 'new-item'}},confirm:s=>{prompt=s;return true},setTimeout:()=>0,clearTimeout(){},console,Math,JSON,Set,Number,String,Array,Object,Promise};
 vm.createContext(ctx);vm.runInContext(read('character-extra.js'),ctx);vm.runInContext(read('equipment-tools.js'),ctx);vm.runInContext(read('shop-cart.js'),ctx);vm.runInContext(read('app.js'),ctx);
 const click=dataset=>events.click({target:{closest:sel=>sel==='[data-action]'?{dataset}:null}});
 for(const [id,value] of [['catalog-target','person'],['catalog-mode','gearBudget']])await events.change({target:{id,value,dataset:{}}});
 await click({action:'cart-add',id:item.id});
 await events.change({target:{value:'medium-pistol',dataset:{cartOption:'ammo-basic-ammunition||'}}});
 await click({action:'cart-inc',key:'ammo-basic-ammunition|medium-pistol|'});
 await click({action:'cart-review'});prompt=nodes['#shop-cart'].innerHTML;assert.equal(saved,undefined,'nothing is saved before payment');
 await click({action:'cart-pay'});
 assert.match(prompt,/Medium Pistol/);assert.match(prompt,/20 units/);assert.match(prompt,/20 eb will be paid from “Starting gear”/);assert.match(prompt,/2550 eb now and 2530 eb will remain/);
 assert.equal(saved.characters[0].extra.gearBudget,2530);assert.equal(saved.characters[0].extra.items[0].quantity,20);assert.equal(saved.characters[0].extra.items[0].ammoType,'medium-pistol');
});
test('Skill Chip purchase passes the explicit double-cost choice and announces the price',async()=>{
 let saved,prompt='',events={};const el=()=>({innerHTML:'',setAttribute(){},addEventListener(type,fn){events[type]=fn}}),nodes={'#app':el(),'#sync-root':el(),'#sync-adapter-status':el(),'#shop-cart':{innerHTML:'',hidden:true},'#app-notice':{classList:{add(){},remove(){}}}};
 const item={id:'cyberware-skill-chip',category:'cyberware',price:500,page:359,name:{ru:'Чип навыка',en:'Skill Chip'},description:{ru:'',en:''},stats:{}};
 const w={ROLES:[{id:'solo',name:{en:'Solo',ru:'Соло'},description:{en:'',ru:''}}],CATALOG:[item],CombatTools:{handle:()=>false},Book:{handle:()=>false},Campaigns:{handle:()=>false},LocalStore:{create(){return{stateLabel:()=>'',start(){},canEdit:()=>true,getScope:()=>'test-account-123456',save(s){saved=JSON.parse(JSON.stringify(s));return Promise.resolve({ok:true})}}}}};
 const character={id:'person',name:'Nova',role:'solo',stats:{INT:6,REF:6,DEX:6,TECH:6,COOL:6,WILL:6,LUCK:6,MOVE:6,BODY:8,EMP:6},skills:{},hp:45,humanity:60,extra:{gearBudget:2550,items:[]}};
 const ctx={window:w,document:{querySelector:s=>nodes[s]||null,documentElement:{},title:''},localStorage:{getItem:()=>JSON.stringify({characters:[character],campaigns:[],lang:'en'})},globalThis:{crypto:{randomUUID:()=> 'chip-item'}},confirm:s=>{prompt=s;return true},setTimeout:()=>0,clearTimeout(){},console,Math,JSON,Set,Number,String,Array,Object,Promise};
 vm.createContext(ctx);vm.runInContext(read('character-extra.js'),ctx);vm.runInContext(read('equipment-tools.js'),ctx);vm.runInContext(read('shop-cart.js'),ctx);vm.runInContext(read('app.js'),ctx);
 const click=dataset=>events.click({target:{closest:sel=>sel==='[data-action]'?{dataset}:null}});
 for(const [id,value] of [['catalog-target','person'],['catalog-mode','gearBudget']])await events.change({target:{id,value,dataset:{}}});
 await click({action:'cart-add',id:item.id});
 await events.change({target:{value:'double',dataset:{cartOption:'cyberware-skill-chip||'}}});
 await click({action:'cart-review'});prompt=nodes['#shop-cart'].innerHTML;assert.equal(saved,undefined,'nothing is saved before payment');
 await click({action:'cart-pay'});
 assert.match(prompt,/×2/);assert.match(prompt,/1000 eb/);assert.match(prompt,/specific skill for the chip on the sheet manually/);assert.equal(saved.characters[0].extra.gearBudget,1550);assert.equal(saved.characters[0].extra.items[0].skillChipType,'double');assert.equal(saved.characters[0].extra.items[0].purchase.unitPrice,1000);
});
