const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const shared=fs.readFileSync(__dirname+'/../public/game/shared-campaigns.js','utf8'),gm=fs.readFileSync(__dirname+'/../public/game/gm-tools.js','utf8');
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
function setup({lang='en',role='owner',templateArray}={}){
 const events={},posts=[];let scope='account',nextId=0;
 const root={innerHTML:'',inert:false,isConnected:true,addEventListener:(k,fn)=>events[k]=fn,querySelector:()=>null};
 const combat={version:1,round:4,turnId:'existing',future:'preserved',roster:[{id:'existing',name:'Existing',ref:8,hp:15,bonus:1,initiative:17,ties:[4],future:'kept'}]};
 const fetch=async(url,opts)=>{
  if(opts.method==='GET'&&url==='/api/campaigns')return response({scope:'account',campaigns:[]});
  if(opts.method==='GET'&&url==='/api/campaigns/c')return response({scope:'account',id:'c',name:'Crew',role,revision:7,shared:{description:'Plan',combat,future:'preserved'},members:[]});
  if(opts.method==='GET'&&url.endsWith('/shares'))return response({scope:'account',shares:[]});
  if(opts.method==='GET'&&url.endsWith('/notes'))return response({scope:'account',notes:'private',revision:1});
  if(opts.method==='GET'&&url.endsWith('/invites'))return response({scope:'account',invites:[]});
  if(opts.method==='PUT'&&url==='/api/campaigns/c'){posts.push(JSON.parse(opts.body));return response({revision:7+posts.length})}
  throw Error(opts.method+' '+url);
 };
 const ctx={window:{},document:{querySelector:s=>s==='#shared-campaigns'?root:null},location:{hash:'',pathname:'/game/index.html',search:'',origin:'https://site.test'},history:{replaceState(){}},navigator:{onLine:true},TextEncoder,confirm:()=>true,fetch,Date,Math,console,crypto:{randomUUID:()=>`new-${++nextId}`}};
 vm.runInNewContext(gm,ctx);if(templateArray!==undefined)ctx.window.GMTools.NPC_TEMPLATES=templateArray;vm.runInNewContext(shared,ctx);
 ctx.window.SharedCampaigns.mount({scope,lang,getScope:()=>scope,characters:[]});
 const click=(action,id,connected=true)=>events.click({target:{closest:()=>({dataset:{shared:action,...id?{id}:{}},isConnected:connected})},stopPropagation(){}});
 return {ctx,root,posts,click,choose(value,connected=true){events.change({target:{id:'shared-combat-template',dataset:{},value,isConnected:connected}})},open:async()=>{await click('toggle');await click('open','c')}};
}

test('a Corebook template adds a new combatant with the original REF and HP, preserving the encounter',async()=>{const h=setup();await h.open();assert.match(h.root.innerHTML,/Corebook NPC template/);assert.match(h.root.innerHTML,/Boosterganger/);h.choose('boosterganger');await h.click('combat-add-template');await h.click('combat-add-template');await h.click('save-shared');assert.equal(h.posts.length,1);const c=h.posts[0].shared.combat;assert.equal(c.round,4);assert.equal(c.turnId,'existing');assert.equal(c.future,'preserved');assert.equal(c.roster[0].future,'kept');assert.equal(c.roster.length,3);assert.deepEqual(c.roster.slice(1),[{id:'new-1',name:'Boosterganger',ref:6,hp:20,initiative:0,bonus:0,ties:[]},{id:'new-2',name:'Boosterganger',ref:6,hp:20,initiative:0,bonus:0,ties:[]}]);assert.equal(h.posts[0].shared.future,'preserved')});
test('Russian copy offers translated templates and explains what is copied',async()=>{const h=setup({lang:'ru'});await h.open();assert.match(h.root.innerHTML,/Шаблон противника из Corebook/);assert.match(h.root.innerHTML,/В бой копируются имя, HP и REF шаблона/);h.choose('bodyguard');await h.click('combat-add-template');await h.click('save-shared');const n=h.posts[0].shared.combat.roster[1];assert.equal(n.name,'Телохранитель');assert.equal(n.ref,6);assert.equal(n.hp,35)});
test('unselected, missing and duplicate templates never create combatants',async()=>{for(const source of [[],[{id:'dup',name:{ru:'Дубль',en:'Duplicate'},stats:{REF:6},hp:20,page:412},{id:'dup',name:{ru:'Дубль',en:'Duplicate'},stats:{REF:6},hp:20,page:412}], [{id:'invalid',name:{ru:'Имя',en:'Name'},stats:{REF:999},hp:20,page:412}]]){const h=setup({templateArray:source});await h.open();h.choose(source[0]?.id||'missing');await h.click('combat-add-template');assert.match(h.root.innerHTML,/template is unavailable/);await h.click('save-shared');assert.equal(h.posts[0].shared.combat.roster.length,1)}});
test('a detached template selector or button cannot add an NPC',async()=>{const h=setup();await h.open();h.choose('bodyguard',false);await h.click('combat-add-template');assert.match(h.root.innerHTML,/template is unavailable/);h.choose('bodyguard');await h.click('combat-add-template',undefined,false);await h.click('save-shared');assert.equal(h.posts[0].shared.combat.roster.length,1)});
test('players cannot add templates by forging an event',async()=>{const h=setup({role:'player'});await h.open();assert.doesNotMatch(h.root.innerHTML,/Corebook NPC template/);h.choose('boosterganger');await h.click('combat-add-template');await h.click('save-shared');assert.equal(h.posts.length,0)});

test('template armor REF is used for new Security Officer; existing combatants and explicit bonus remain unchanged',async()=>{for(const lang of ['en','ru']){const h=setup({lang});await h.open();assert.match(h.root.innerHTML,/Kerenzikov/);h.choose('security-officer');await h.click('combat-add-template');await h.click('save-shared');const c=h.posts[0].shared.combat;assert.equal(c.roster[0].ref,8);assert.equal(c.roster[0].bonus,1);assert.equal(c.roster[0].initiative,17);assert.equal(c.turnId,'existing');assert.equal(c.roster[1].ref,6);assert.equal(c.roster[1].bonus,0)}});
test('invalid armor REF or malformed effective stats cannot silently fall back to base REF',async()=>{for(const eff of [{REF:'6'},{REF:99},null,[]]){const x={id:'guard',name:{ru:'Охранник',en:'Guard'},stats:{REF:8},effectiveStats:eff,hp:20,page:412};const h=setup({templateArray:[x]});await h.open();h.choose('guard');await h.click('combat-add-template');assert.match(h.root.innerHTML,/template is unavailable/);await h.click('save-shared');assert.equal(h.posts[0].shared.combat.roster.length,1)}});
