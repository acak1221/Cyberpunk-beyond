const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../public/game/shared-campaigns.js','utf8');
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
const combat=()=>({version:1,round:4,turnId:'a',future:'keep',roster:[
 {id:'a',name:'Alice',ref:6,hp:30,bonus:0,initiative:15,ties:[12],unknown:'keep'},
 {id:'b',name:'Bob',ref:6,hp:20,bonus:0,initiative:15,ties:[8]},
 {id:'new',name:'<New>',ref:6,hp:10,bonus:1,initiative:0,ties:[]}
]});
function setup({role='owner',values=[],pending=false,initial=combat()}={}){
 const handlers={},posts=[];let draws=0,resolveSave,scope='scope-a';
 const root={innerHTML:'',inert:false,addEventListener:(type,fn)=>handlers[type]=fn,querySelector:()=>null};
 const shared={description:'Plan',combat:initial,future:{keep:true}};
 const fetch=async(url,opts)=>{
  if(opts.method==='GET'&&url==='/api/campaigns')return response({scope:'scope-a',campaigns:[]});
  if(opts.method==='GET'&&url==='/api/campaigns/c')return response({scope:'scope-a',id:'c',name:'Crew',role,revision:7,shared,members:[]});
  if(opts.method==='GET'&&url.endsWith('/notes'))return response({scope:'scope-a',notes:'private',revision:1});
  if(opts.method==='GET'&&url.endsWith('/invites'))return response({scope:'scope-a',invites:[]});
  if(opts.method==='GET'&&url.endsWith('/shares'))return response({scope:'scope-a',shares:[]});
  if(opts.method==='PUT'&&url==='/api/campaigns/c'){posts.push(JSON.parse(opts.body));if(pending&&posts.length===1)return await new Promise(r=>resolveSave=r);return response({revision:7+posts.length})}
  throw Error(opts.method+' '+url);
 };
 const math=Object.create(Math);math.random=()=>{assert(draws<values.length,'unexpected random draw');return (values[draws++]-1)/10+0.001};
 const box={window:{},document:{querySelector:s=>s==='#shared-campaigns'?root:null},location:{hash:'',pathname:'/game/index.html',search:'',origin:'https://site.test'},history:{replaceState(){}},navigator:{onLine:true},confirm:()=>true,fetch,Date,Math:math,console};
 vm.runInNewContext(source,box);box.window.SharedCampaigns.mount({scope,lang:'en',getScope:()=>scope,characters:[]});
 return {root,posts,get draws(){return draws},setScope:x=>scope=x,resolve:()=>resolveSave(response({revision:8})),click:(action,id)=>handlers.click({target:{closest:()=>({dataset:{shared:action,...id?{id}:{}}})},stopPropagation(){}}),inputField:(id,key,value)=>handlers.input({target:{dataset:{combatField:key,id},value}})};
}
async function open(x){await x.click('toggle');await x.click('open','c')}
test('one participant rolls REF + d10 + bonus without resetting the round or current turn',async()=>{
 const x=setup({values:[3]});await open(x);
 assert.match(x.root.innerHTML,/Roll initiative for all/);assert.match(x.root.innerHTML,/aria-label="Roll initiative · &lt;New&gt;"/);
 await x.click('combat-roll-one','new');await x.click('save-shared');
 const c=x.posts[0].shared.combat;assert.equal(c.round,4);assert.equal(c.turnId,'a');assert.equal(c.roster[2].initiative,10);assert.deepEqual(c.roster[2].ties,[]);assert.deepEqual(c.roster[0].ties,[12]);assert.equal(c.future,'keep');assert.equal(c.roster[0].unknown,'keep');assert.equal(x.posts[0].shared.future.keep,true);assert.equal(x.draws,1);
});
test('a new tie reuses earlier tie rolls and rolls only unresolved comparisons',async()=>{
 // New total 15; its first tie roll is 12, matching Alice. They then roll 8 and 11.
 const x=setup({values:[8,5,2,4]});await open(x);await x.click('combat-roll-one','new');await x.click('save-shared');
 const c=x.posts[0].shared.combat;assert.equal(c.round,4);assert.equal(c.turnId,'a');assert.deepEqual(c.roster.map(r=>r.ties),[[12,8],[8],[12,11]]);assert.equal(x.draws,4);
});
test('unresolved ties stop after twelve rounds of tie rolls and remain visible',async()=>{
 const initial={version:1,round:7,turnId:'a',roster:[{id:'a',name:'A',ref:6,hp:20,bonus:0,initiative:11,ties:[]},{id:'new',name:'B',ref:6,hp:20,bonus:0,initiative:0,ties:[]}]};
 const x=setup({initial,values:Array(25).fill(5)});await open(x);await x.click('combat-roll-one','new');await x.click('save-shared');const c=x.posts[0].shared.combat;
 assert.equal(c.round,7);assert.equal(c.turnId,'a');assert.equal(c.roster[0].ties.length,12);assert.equal(c.roster[1].ties.length,12);assert.equal(x.draws,25);assert.match(x.root.innerHTML,/Resolve remaining ties manually/);
});
test('draft numeric input prevents rolling and is kept for correction',async()=>{
 const x=setup({values:[]});await open(x);x.inputField('new','ref','-');await x.click('combat-roll-one','new');assert.equal(x.draws,0);assert.match(x.root.innerHTML,/value="-"/);await x.click('save-shared');assert.equal(x.posts.length,0);
});
test('players, stale scopes and unknown combatants cannot perform the action',async()=>{
 const player=setup({role:'player',values:[]});await open(player);assert.doesNotMatch(player.root.innerHTML,/data-shared="combat-roll-one"/);await player.click('combat-roll-one','new');assert.equal(player.draws,0);
 const missing=setup({values:[]});await open(missing);await missing.click('combat-roll-one','missing');assert.equal(missing.draws,0);
 const stale=setup({values:[]});await open(stale);stale.setScope('scope-b');await stale.click('combat-roll-one','new');assert.equal(stale.draws,0);
});
test('the in-flight save remains immutable; a subsequent individual roll stays unsaved until its own save',async()=>{
 const x=setup({values:[3],pending:true});await open(x);const saving=x.click('save-shared');assert.equal(x.posts.length,1);await x.click('combat-roll-one','new');assert.equal(x.draws,0);x.resolve();await saving;await x.click('combat-roll-one','new');assert.equal(x.draws,1);await x.click('save-shared');
 assert.equal(x.posts.length,2);assert.equal(x.posts[0].shared.combat.roster[2].initiative,0);assert.equal(x.posts[1].revision,8);assert.equal(x.posts[1].shared.combat.roster[2].initiative,10);assert.equal(x.posts[1].shared.combat.round,4);assert.equal(x.posts[1].shared.combat.turnId,'a');
});
