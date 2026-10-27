const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/game/shared-campaigns.js'),'utf8');
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
function setup({role='owner',shared={description:'Original',future:{keep:true}},conflict=false,shares=[]}={}){
 const handlers={},posts=[];let nextId=0;
 const root={innerHTML:'',addEventListener:(type,fn)=>handlers[type]=fn,querySelector:()=>null};
 const fetch=async(url,opts)=>{
  if(opts.method==='GET'&&url==='/api/campaigns')return response({scope:'scope-a',campaigns:[]});
  if(opts.method==='GET'&&url==='/api/campaigns/c')return response({scope:'scope-a',id:'c',name:'Crew',role,revision:7,shared,members:[{id:'m',role,mine:true}]});
  if(opts.method==='GET'&&url.endsWith('/notes'))return response({scope:'scope-a',notes:'private secret',revision:1});
  if(opts.method==='GET'&&url.endsWith('/invites'))return response({scope:'scope-a',invites:[]});
  if(opts.method==='GET'&&url.endsWith('/shares'))return response({scope:'scope-a',shares});
  if(opts.method==='PUT'&&url==='/api/campaigns/c'){posts.push(JSON.parse(opts.body));return conflict?response({error:'revision_conflict'},409):response({revision:8})}
  throw Error(opts.method+' '+url);
 };
 const m=Object.create(Math);m.random=()=>0.4;
 const box={window:{},document:{querySelector:s=>s==='#shared-campaigns'?root:null},location:{hash:'',pathname:'/game/index.html',search:'',origin:'https://site.test'},history:{replaceState(){}},navigator:{onLine:true},confirm:()=>true,fetch,Date,Math:m,crypto:{randomUUID:()=>`id-${++nextId}`},console};
 vm.runInNewContext(source,box);box.window.SharedCampaigns.mount({scope:'scope-a',lang:'en',getScope:()=>'scope-a',characters:[]});
 return {root,posts,async click(action,id){await handlers.click({target:{closest:()=>({dataset:{shared:action,...id?{id}:{} }})},stopPropagation(){}})},input(id,value){handlers.input({target:{id,value}})},change(target){handlers.change({target})}};
}
async function open(x){await x.click('toggle');await x.click('open','c')}
test('GM saves combat as a CAS update, preserving other shared fields and private notes',async()=>{
 const x=setup();await open(x);x.input('shared-combat-name','<Guard>');x.input('shared-combat-ref','6');x.input('shared-combat-hp','30');await x.click('combat-add');assert(x.root.innerHTML.includes('&lt;Guard&gt;'));assert(!x.root.innerHTML.includes('<Guard>'));await x.click('combat-roll');await x.click('combat-next');await x.click('save-shared');
 assert.equal(x.posts.length,1);let req=x.posts[0];assert.equal(req.scope,'scope-a');assert.equal(req.revision,7);assert.equal(req.shared.future.keep,true);assert.equal(req.shared.combat.roster[0].name,'<Guard>');assert.equal(req.shared.combat.roster[0].initiative,11);assert.equal(req.shared.combat.round,2);assert.equal(req.shared.combat.turnId,req.shared.combat.roster[0].id);assert(!JSON.stringify(req).includes('private secret'));
});
test('copy from a published character includes only name, REF and HP',async()=>{
 let x=setup({shares:[{id:'sh',memberId:'m',data:{name:'Nova',role:'solo',stats:{REF:8,INT:6},hp:41,unexpected:'should-not-copy'},mine:true}]});await open(x);x.change({id:'shared-combat-share',value:'sh',dataset:{}});await x.click('combat-add-share');await x.click('save-shared');let r=x.posts[0].shared.combat.roster[0];assert.equal(r.name,'Nova');assert.equal(r.ref,8);assert.equal(r.hp,41);assert(!JSON.stringify(r).includes('should-not-copy'));assert(!Object.hasOwn(r,'stats'));assert(!Object.hasOwn(r,'role'));
});
test('players see saved combat read-only and fake combat actions do not mutate it',async()=>{
 let shared={description:'Test',combat:{version:1,round:1,turnId:'r',roster:[{id:'r',name:'Guard',ref:6,hp:12,bonus:0,initiative:9,ties:[]}]}};let x=setup({role:'player',shared});await open(x);assert(x.root.innerHTML.includes('Guard'));assert(x.root.innerHTML.includes('readonly'));assert(!x.root.innerHTML.includes('data-shared="combat-add"'));await x.click('combat-remove','r');assert(x.root.innerHTML.includes('Guard'));assert.equal(x.posts.length,0);assert.equal(shared.combat.roster.length,1);
});
test('unknown future combat is preserved when saving another shared field',async()=>{
 const shared={description:'Before',combat:{version:2,whatever:'must stay'}};let x=setup({shared});await open(x);assert(x.root.innerHTML.includes('not supported'));x.input('shared-description','After');await x.click('save-shared');assert.equal(x.posts[0].shared.combat.version,2);assert.equal(x.posts[0].shared.combat.whatever,'must stay');
});
test('combat conflict retains combat and unrelated GM drafts for manual recovery',async()=>{
 let x=setup({conflict:true});await open(x);x.input('shared-name','Edited crew');x.input('shared-description','Unsaved plan');x.input('shared-notes','Unsaved private');x.input('shared-combat-name','Rogue');await x.click('combat-add');await x.click('save-shared');for(const text of ['Rogue','Unsaved plan','Unsaved private','Edited crew'])assert(x.root.innerHTML.includes(text),text);
});
